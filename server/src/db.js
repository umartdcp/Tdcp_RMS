import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { assertMysql, translateSql } from "./sqlDialect.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: process.env.TDCP_ENV_PATH || path.join(__dirname, "../.env") });

let pool = null;
let dbOnline = false;
let lastPing = 0;
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

function isConnectionError(err) {
  const code = err?.code || err?.errno;
  return CONNECTION_ERRORS.has(code) || /connect|ECONN|closed the connection/i.test(String(err?.message || ""));
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

export async function connectDb() {
  const url = databaseUrl();
  if (!url) {
    throw new Error("Set DATABASE_URL in server/.env, for example mysql://tdcp:tdcp123@127.0.0.1:3306/tdcp_rms");
  }
  if (/^postgres(ql)?:/i.test(url)) {
    throw new Error("DATABASE_URL still points at PostgreSQL. Use mysql://USER:PASSWORD@127.0.0.1:3306/tdcp_rms");
  }
  if (pool) {
    try {
      await pool.end();
    } catch {
      /* replace a dead pool */
    }
    pool = null;
  }
  pool = mysql.createPool(poolOptions());
  await pool.query("SELECT 1");
  dbOnline = true;
  lastPing = Date.now();
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
    if (!isConnectionError(err) && !/access denied|ER_ACCESS_DENIED/i.test(String(err?.message || ""))) {
      console.error(err.message);
    }
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
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (Number(rows[0].c) > 0) return { rows: [], rowCount: 0 };
  await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${mysqlType}`);
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
  const [rows] = await pool.query(`SELECT ${cols} FROM \`${table}\` WHERE id = ?`, [id]);
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
    return await runQuery(pool, text, params);
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
  const conn = await pool.getConnection();
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
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export { pool };
