import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { assertMysql, translateSql } from "./sqlDialect.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: process.env.TDCP_ENV_PATH || path.join(__dirname, "../.env") });

let pool = null;
const orgPools = new Map();
const requestDb = new AsyncLocalStorage();
let dbOnline = false;
let lastPing = 0;
let lastDbError = "";
export const usingEmbeddedPostgres = false;

const CONNECTION_ERRORS = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EPIPE",
  "PROTOCOL_CONNECTION_LOST",
  "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR",
  "ER_CON_COUNT_ERROR",
]);

export function databaseOnline() {
  return dbOnline;
}

export function lastDatabaseError() {
  return lastDbError;
}

function isConnectionError(err) {
  const code = err?.code || err?.errno;
  return CONNECTION_ERRORS.has(code) || /connect|ECONN|closed the connection/i.test(String(err?.message || ""));
}

function activePool() {
  return requestDb.getStore()?.pool || pool;
}

export function orgDatabaseName(code) {
  const safe = String(code || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  if (!safe) throw new Error("Organization code is required.");
  return `rms_${safe}`;
}

export function runWithPool(nextPool, fn) {
  return requestDb.run({ pool: nextPool }, fn);
}

function offlineError() {
  const err = new Error("Database is offline");
  err.code = "DB_OFFLINE";
  return err;
}

function databaseUrl() {
  return String(process.env.DATABASE_URL || "").trim();
}

function poolOptions() {
  const url = new URL(databaseUrl());
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  return {
    host: url.hostname || "127.0.0.1",
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username || "root"),
    password: decodeURIComponent(url.password || ""),
    database,
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 5000,
    charset: "utf8mb4_unicode_ci",
    timezone: process.env.DB_TIMEZONE || "local",
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    supportBigNumbers: true,
    dateStrings: false,
    typeCast(field, next) {
      if (field.type === "TINY" && field.length === 1) {
        const value = field.string();
        if (value == null) return null;
        return value === "1";
      }
      return next();
    },
  };
}

function normalizeValue(value) {
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return value;
}

function safeDbMessage(err) {
  return String(err?.code ? `${err.code}: ${err.message || ""}` : err?.message || err || "unknown")
    .replace(/mysql:\/\/[^@\s]+@/gi, "mysql://***@")
    .slice(0, 240);
}

async function openPool(options) {
  if (pool) {
    try {
      await pool.end();
    } catch {
      /* replace a dead pool */
    }
    pool = null;
  }
  pool = mysql.createPool(options);
  await pool.query("SELECT 1");
  dbOnline = true;
  lastPing = Date.now();
  lastDbError = "";
}

export async function connectDb() {
  const url = databaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  if (/^postgres(ql)?:/i.test(url)) {
    throw new Error("DATABASE_URL still points at PostgreSQL. Use mysql://USER:PASSWORD@127.0.0.1:3306/tdcp_rms");
  }
  const base = poolOptions();
  const attempts = [base];
  if (base.host === "localhost" || base.host === "127.0.0.1") {
    const socketOptions = { ...base };
    delete socketOptions.host;
    delete socketOptions.port;
    for (const socketPath of ["/var/lib/mysql/mysql.sock", "/tmp/mysql.sock", "/var/run/mysqld/mysqld.sock"]) {
      attempts.push({ ...socketOptions, socketPath });
    }
    if (base.host !== "127.0.0.1") attempts.push({ ...base, host: "127.0.0.1" });
  }
  let last;
  for (const options of attempts) {
    try {
      await openPool(options);
      return;
    } catch (err) {
      last = err;
      lastDbError = safeDbMessage(err);
    }
  }
  throw last;
}

export async function ensureDb() {
  if (pool && dbOnline && Date.now() - lastPing < 4000) return true;
  if (pool && dbOnline) {
    try {
      await pool.query("SELECT 1");
      lastPing = Date.now();
      return true;
    } catch (err) {
      if (!isConnectionError(err)) throw err;
      dbOnline = false;
    }
  }
  try {
    await connectDb();
    return true;
  } catch (err) {
    dbOnline = false;
    lastDbError = safeDbMessage(err);
    console.error(lastDbError);
    return false;
  }
}

async function addColumnIfMissing(sql) {
  const match = String(sql).match(
    /ALTER\s+TABLE\s+([A-Za-z0-9_]+)\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+([A-Za-z0-9_]+)\s+([A-Za-z0-9_()]+)/i
  );
  if (!match) return null;
  const [, table, column, type] = match;
  const mysqlType = /^timestamptz$/i.test(type) ? "DATETIME" : type;
  const [rows] = await activePool().query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (Number(rows[0].c) > 0) return { rows: [], rowCount: 0 };
  await activePool().query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${mysqlType}`);
  return { rows: [], rowCount: 0 };
}

async function fetchReturning(original, returning, result, params) {
  const cols = returning === "*" ? "*" : returning;
  const insert = original.match(/INSERT\s+(?:IGNORE\s+)?INTO\s+([A-Za-z0-9_]+)/i);
  const update = original.match(/UPDATE\s+([A-Za-z0-9_]+)/i);
  const table = (insert || update)?.[1];
  if (!table) throw new Error("RETURNING could not identify a table");

  let id = insert ? result.insertId : null;
  if (!insert) {
    const idMatch = original.match(/\bid\s*=\s*\$(\d+)/i);
    if (!idMatch) throw new Error("UPDATE ... RETURNING needs a WHERE id=$n clause");
    id = params[Number(idMatch[1]) - 1];
  }
  if (!id) return { rows: [], rowCount: 0 };
  const [rows] = await activePool().query(`SELECT ${cols} FROM \`${table}\` WHERE id = ?`, [id]);
  return { rows, rowCount: rows.length };
}

function asResult(result) {
  if (Array.isArray(result)) return { rows: result, rowCount: result.length };
  return { rows: [], rowCount: result.affectedRows || 0 };
}

function normalizeError(err) {
  if (err && (err.code === "ER_DUP_ENTRY" || err.errno === 1062)) {
    err.mysqlCode = err.code;
    err.code = "23505";
  }
  return err;
}

async function runQuery(executor, text, params = []) {
  const added = await addColumnIfMissing(text);
  if (added) return added;
  const translated = translateSql(text, params || []);
  assertMysql(translated.sql);
  const values = translated.params.map(normalizeValue);
  const [result] = await executor.query(translated.sql, values);
  if (!translated.returning) return asResult(result);
  return fetchReturning(text, translated.returning, result, params || []);
}

export async function query(text, params = []) {
  const up = await ensureDb();
  if (!up || !pool) return Promise.reject(offlineError());
  try {
    return await runQuery(activePool(), text, params);
  } catch (err) {
    if (isConnectionError(err)) {
      dbOnline = false;
      throw offlineError();
    }
    throw normalizeError(err);
  }
}

export async function withTransaction(work) {
  const up = await ensureDb();
  if (!up || !pool) throw offlineError();
  const conn = await activePool().getConnection();
  const run = (text, params = []) => runQuery(conn, text, params);
  try {
    await conn.beginTransaction();
    const result = await work(run);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    if (isConnectionError(err)) {
      dbOnline = false;
      throw offlineError();
    }
    throw normalizeError(err);
  } finally {
    conn.release();
  }
}

export async function closeDb() {
  dbOnline = false;
  lastPing = 0;
  const pools = [pool, ...orgPools.values()];
  pool = null;
  orgPools.clear();
  await Promise.all(
    pools.filter(Boolean).map((item) => item.end().catch(() => {}))
  );
}

export async function platformQuery(text, params = []) {
  if (!pool) {
    const up = await ensureDb();
    if (!up || !pool) return Promise.reject(offlineError());
  }
  return runWithPool(pool, () => query(text, params));
}

export async function rawPlatform(sql, params = []) {
  const up = await ensureDb();
  if (!up || !pool) throw offlineError();
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function ensureOrganizationDatabase(code) {
  const name = orgDatabaseName(code);
  await rawPlatform(
    `CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  return name;
}

export async function dropOrganizationDatabase(dbName) {
  if (!/^rms_[a-z0-9_]+$/.test(String(dbName || ""))) return;
  const existing = orgPools.get(dbName);
  if (existing) {
    orgPools.delete(dbName);
    await existing.end().catch(() => {});
  }
  await rawPlatform(`DROP DATABASE IF EXISTS \`${dbName}\``);
}

export async function getOrganizationPool(dbName) {
  if (!/^rms_[a-z0-9_]+$/.test(String(dbName || ""))) {
    throw new Error("Invalid organization database.");
  }
  const cached = orgPools.get(dbName);
  if (cached) return cached;
  const options = { ...poolOptions(), database: dbName };
  const next = mysql.createPool(options);
  await next.query("SELECT 1");
  orgPools.set(dbName, next);
  return next;
}

export function withOrganization(dbName, fn) {
  return getOrganizationPool(dbName).then((next) => runWithPool(next, fn));
}

export async function eachOrganization(fn) {
  const orgs = (
    await platformQuery(
      `SELECT id, code, name, db_name FROM organizations WHERE db_name IS NOT NULL AND TRIM(db_name) <> '' ORDER BY name`
    )
  ).rows;
  const all = [];
  for (const org of orgs) {
    const part = await withOrganization(org.db_name, () => fn(org));
    if (Array.isArray(part)) all.push(...part);
  }
  return all;
}

export async function bindRequestDatabase(req) {
  const role = req.user?.role;
  const requested = Number(req.query?.organization_id || req.body?.organization_id || 0);
  const orgId = role === "super_admin" || role === "admin" ? requested : Number(req.user?.organization_id || 0);
  if (!orgId) return (fn) => fn();
  const row = (await platformQuery(`SELECT db_name FROM organizations WHERE id=$1`, [orgId])).rows[0];
  if (!row?.db_name) return (fn) => fn();
  const next = await getOrganizationPool(row.db_name);
  return (fn) => runWithPool(next, fn);
}

export { pool };
