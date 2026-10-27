import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { query, ensureOrganizationDatabase, withOrganization, rawPlatform, dropOrganizationDatabase, eachOrganization } from "./db.js";
import { DEFAULT_MENU, SHARED_MENU_CATEGORIES } from "./menuCatalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROLE_DEFS = [
  ["super_admin", "Super Admin", true],
  ["org_admin", "Organization Admin", false],
  ["manager", "Site Manager", false],
  ["order_taker", "Waiter / Order Taker", false],
  ["cashier", "Cashier", false],
  ["kitchen", "Kitchen", false],
  ["staff", "Staff", false],
];

const PERMISSIONS = [
  "org.manage",
  "org.branding",
  "site.manage",
  "user.manage",
  "menu.manage",
  "table.manage",
  "order.manage",
  "pos.use",
  "kitchen.use",
  "report.view",
  "report.org",
  "report.global",
];

function isSafeDevDatabase() {
  if (process.env.FORCE_DB_RESET === "1" && process.env.ALLOW_NONLOCAL_RESET === "1") return true;
  const url = String(process.env.DATABASE_URL || "");
  const local = /localhost|127\.0\.0\.1/.test(url);
  const named = /\/tdcp_rms(\?|$)/.test(url) || url.endsWith("/tdcp_rms");
  return local && named;
}

async function tableExists(name) {
  const row = (
    await query(
      `SELECT COUNT(*) AS t FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = $1`,
      [name]
    )
  ).rows[0];
  return Number(row?.t) > 0;
}

async function execSql(text) {
  const cleaned = String(text)
    .split("\n")
    .map((line) => (line.trim().startsWith("--") ? "" : line))
    .join("\n");
  const statements = cleaned
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await query(statement);
  }
}

async function schemaSqlPath() {
  const bundled = path.join(__dirname, "../schema.sql");
  const repo = path.join(__dirname, "../../database_reset.sql");
  if (fs.existsSync(bundled)) return bundled;
  return repo;
}

async function applyFullSchema() {
  const sqlPath = await schemaSqlPath();
  if (!fs.existsSync(sqlPath)) {
    throw new Error("Schema file not found. Upload database_reset.sql as server/schema.sql");
  }
  const sql = fs.readFileSync(sqlPath, "utf8");
  console.log("Applying database schema");
  await execSql(sql);
}

async function rebuildSchema() {
  if (!isSafeDevDatabase()) {
    throw new Error(
      `Refusing to drop tables. DATABASE_URL is not the local development database tdcp_rms. Current: ${process.env.DATABASE_URL || "(embedded/unset)"}`
    );
  }
  await applyFullSchema();
}

async function seedRoles() {
  for (const [code, name, isGlobal] of ROLE_DEFS) {
    await query(
      `INSERT INTO roles (code, name, is_global)
       VALUES ($1,$2,$3)
       ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, is_global=EXCLUDED.is_global`,
      [code, name, isGlobal]
    );
  }
  for (const code of PERMISSIONS) {
    await query(
      `INSERT INTO permissions (code, name) VALUES ($1,$2) ON CONFLICT (code) DO NOTHING`,
      [code, code]
    );
  }
  const grant = {
    super_admin: PERMISSIONS,
    org_admin: PERMISSIONS.filter((p) => p !== "report.global" && p !== "org.manage"),
    manager: ["menu.manage", "table.manage", "order.manage", "pos.use", "kitchen.use", "report.view", "user.manage"],
    order_taker: ["pos.use", "table.manage", "order.manage"],
    cashier: ["pos.use", "order.manage"],
    kitchen: ["kitchen.use", "order.manage"],
    staff: ["pos.use"],
  };
  for (const [roleCode, perms] of Object.entries(grant)) {
    const role = (await query(`SELECT id FROM roles WHERE code=$1`, [roleCode])).rows[0];
    for (const perm of perms) {
      const p = (await query(`SELECT id FROM permissions WHERE code=$1`, [perm])).rows[0];
      await query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [role.id, p.id]
      );
    }
  }
}

async function seedDiningTables(orgId, siteId) {
  const sections = [
    ["Main Hall", 1, 5],
    ["Outdoor", 6, 10],
    ["VIP Area", 11, 15],
  ];
  for (const [section, from, to] of sections) {
    for (let n = from; n <= to; n += 1) {
      await query(
        `INSERT INTO dining_tables (organization_id, site_id, restaurant_id, label, section, seats, status)
         VALUES ($1,$2,$2,$3,$4,$5,'available')`,
        [orgId, siteId, String(n).padStart(2, "00").slice(-2), section, n <= 5 ? 4 : n <= 10 ? 6 : 8]
      );
    }
  }
}

async function seedMenu(orgId, siteId) {
  const cats = {};
  let sort = 1;
  for (const name of SHARED_MENU_CATEGORIES.filter((n) => n !== "Deserts")) {
    const row = (
      await query(
        `INSERT INTO menu_categories (organization_id, site_id, restaurant_id, name, sort_order)
         VALUES ($1,$2,$2,$3,$4) RETURNING id`,
        [orgId, siteId, name, sort]
      )
    ).rows[0];
    cats[name] = row.id;
    sort += 1;
  }
  for (const [name, price, category] of DEFAULT_MENU) {
    await query(
      `INSERT INTO menu_items (organization_id, site_id, restaurant_id, category_id, name, price, emoji)
       VALUES ($1,$2,$2,$3,$4,$5,$6)
       ON CONFLICT (site_id, name) DO NOTHING`,
      [orgId, siteId, cats[category] || null, name, price, ""]
    );
  }
}

async function insertOrg(row) {
  return (
    await query(
      `INSERT INTO organizations
        (code, name, logo_url, primary_color, secondary_color, background_color, text_color, app_name, address, phone, email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        row.code,
        row.name,
        String(row.code).toUpperCase() === "TDCP" ? row.logo_url || "/tdcp-logo.png" : row.logo_url || null,
        row.primary_color,
        row.secondary_color,
        row.background_color || "#f4f6f5",
        row.text_color || "#143028",
        row.app_name,
        row.address || null,
        row.phone || null,
        row.email || null,
      ]
    )
  ).rows[0];
}

async function insertSite(orgId, row) {
  return (
    await query(
      `INSERT INTO sites (organization_id, code, name, address, phone, email)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [orgId, row.code, row.name, row.address || null, row.phone || null, row.email || null]
    )
  ).rows[0];
}

async function insertUser({ orgId, siteId, role, name, email, username, password }) {
  const hash = await bcrypt.hash(password || process.env.SEED_ADMIN_PASSWORD || "admin123", 10);
  const roleRow = (await query(`SELECT id FROM roles WHERE code=$1`, [role])).rows[0];
  return (
    await query(
      `INSERT INTO users
        (organization_id, site_id, restaurant_id, role_id, name, username, email, password_hash, role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, email, role`,
      [orgId || null, siteId || null, siteId || null, roleRow?.id || null, name, username, email, hash, role]
    )
  ).rows[0];
}

const TDCP_LIVE_SITES = [
  ["TDCP_TAUNSA_RESTAURANT", "TDCP Taunsa Restaurant", "Taunsa Barrage"],
  ["TDCP_CHEWRA_RESTAURANT", "TDCP Chewra Restaurant", "Chewra"],
  ["TDCP_DERAWAR_RESTAURANT", "TDCP Derawar Restaurant", "Derawar Fort"],
  ["TDCP_DAUD_KHEL_RESTAURANT", "TDCP Daud Khel Restaurant", "Daud Khel"],
  ["TDCP_KHABEKI_RESTAURANT", "TDCP Khabeki Restaurant", "Khabeki Lake"],
  ["TDCP_CHAREHAN_RESTAURANT", "TDCP Charehan Restaurant", "Charehan Murree"],
];

function tdcpOnly() {
  return String(process.env.TDCP_ONLY || "") === "1";
}

async function seedTdcpOnly() {
  const tdcp = await insertOrg({
    code: "TDCP",
    name: "Tourism Development Corporation of Punjab",
    logo_url: "/tdcp-logo.png",
    primary_color: "#0c553c",
    secondary_color: "#2fa87a",
    app_name: "TDCP Restaurant Management System",
    address: "Lahore, Punjab",
    email: "info@tdcp.gov.pk",
  });
  for (const [code, name, address] of TDCP_LIVE_SITES) {
    const site = await insertSite(tdcp.id, { code, name, address });
    await seedDiningTables(tdcp.id, site.id);
    await seedMenu(tdcp.id, site.id);
  }
  await insertUser({
    orgId: tdcp.id,
    role: "org_admin",
    name: "TDCP Organization Admin",
    email: "admin@tdcp.gov.pk",
    username: "tdcp_admin",
    password: process.env.SEED_ADMIN_PASSWORD || "admin123",
  });
  console.log("Seeded TDCP only, with all six resorts.");
}

async function seedIfEmpty() {
  const existing = await query(`SELECT id FROM users WHERE role IN ('super_admin','admin') LIMIT 1`);
  if (existing.rows[0]) return;
  await seedRoles();
  await insertUser({
    role: "super_admin",
    name: "Platform Super Admin",
    email: "superadmin@rms.local",
    username: "superadmin",
    password: process.env.SEED_ADMIN_PASSWORD || "admin123",
  });
}

export async function provisionOrganizationDatabase(org) {
  const dbName = await ensureOrganizationDatabase(org.code);
  await query(`UPDATE organizations SET db_name=$1 WHERE id=$2`, [dbName, org.id]);
  org.db_name = dbName;
  await withOrganization(dbName, async () => {
    if (!(await tableExists("organizations"))) await applyFullSchema();
    await query(`ALTER TABLE organizations ADD COLUMN db_name VARCHAR(64) NULL`).catch(() => {});
    await seedRoles();
    const exists = (await query(`SELECT id FROM organizations WHERE id=$1`, [org.id])).rows[0];
    if (!exists) {
      await query(
        `INSERT INTO organizations
          (id, code, name, logo_url, favicon_url, primary_color, secondary_color, background_color, text_color, app_name, address, phone, email, is_active, db_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,1,$14)`,
        [
          org.id,
          org.code,
          org.name,
          org.logo_url || null,
          org.favicon_url || null,
          org.primary_color || "#0c553c",
          org.secondary_color || "#2fa87a",
          org.background_color || "#f4f6f5",
          org.text_color || "#143028",
          org.app_name || org.name,
          org.address || null,
          org.phone || null,
          org.email || null,
          dbName,
        ]
      );
    }
    await ensureRuntimeColumns();
  });
  return dbName;
}

export async function flushLocalDatabases() {
  if (!isSafeDevDatabase()) {
    throw new Error("Refusing to flush a database that is not the local tdcp_rms database.");
  }
  const rows = await rawPlatform("SHOW DATABASES");
  for (const row of rows) {
    const name = String(row.Database || row.database || "");
    if (/^rms_[a-z0-9_]+$/.test(name)) await dropOrganizationDatabase(name);
  }
  await applyFullSchema();
  await seedRoles();
  await insertUser({
    role: "super_admin",
    name: "Platform Super Admin",
    email: "superadmin@rms.local",
    username: "superadmin",
    password: process.env.SEED_ADMIN_PASSWORD || "admin123",
  });
}

async function ensureRuntimeColumns() {
  await query(`ALTER TABLE sites ADD COLUMN IF NOT EXISTS image_url TEXT`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_ref VARCHAR(64)`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at DATETIME NULL`);
  await query(`ALTER TABLE orders MODIFY table_id INT NULL`).catch(() => {});
  await query(`ALTER TABLE orders MODIFY status VARCHAR(32) NOT NULL DEFAULT 'new'`).catch(() => {});
  await query(`CREATE UNIQUE INDEX orders_client_ref ON orders (client_ref)`).catch((err) => {
    const code = err?.mysqlCode || err?.code;
    if (code !== "ER_DUP_KEYNAME" && err?.errno !== 1061) throw err;
  });
}

export async function initDb() {
  const hasOrgs = await tableExists("organizations");
  if (!hasOrgs) {
    await applyFullSchema();
  }
  await seedRoles();
  await seedIfEmpty();
  if (tdcpOnly()) {
    await query(`UPDATE organizations SET is_active=0 WHERE upper(code) <> 'TDCP'`);
  }
  await query(
    `UPDATE organizations
     SET logo_url = NULL
     WHERE upper(code) <> 'TDCP'
       AND (logo_url IS NULL OR btrim(logo_url) = '' OR logo_url ILIKE '%tdcp-logo%')`
  );
  await query(
    `UPDATE organizations
     SET logo_url = '/tdcp-logo.png'
     WHERE upper(code) = 'TDCP'
       AND (logo_url IS NULL OR btrim(logo_url) = '')`
  );
  await ensureRuntimeColumns();
  await eachOrganization(async () => {
    await ensureRuntimeColumns();
    return [];
  });
  await query(`DROP VIEW IF EXISTS restaurants`);
  await query(`
    CREATE VIEW restaurants AS
    SELECT
      s.id,
      s.organization_id,
      s.name,
      s.address AS location,
      s.image_url,
      (CASE WHEN s.is_active THEN 'open' ELSE 'closed' END) COLLATE utf8mb4_unicode_ci AS status,
      s.code AS site_code,
      s.phone,
      s.email,
      o.code AS organization_code,
      o.name AS organization_name,
      o.logo_url,
      o.primary_color,
      o.secondary_color,
      o.app_name
    FROM sites s
    JOIN organizations o ON o.id = s.organization_id
  `);
  await query(
    `UPDATE organizations
     SET logo_url = CASE WHEN upper(code) = 'TDCP' THEN '/tdcp-logo.png' ELSE NULL END
     WHERE logo_url ILIKE '/uploads/resort-%'`
  );
}

export { isSafeDevDatabase, rebuildSchema };

if (process.argv[1]?.includes("initDb.js")) {
  const { connectDb, closeDb } = await import("./db.js");
  connectDb()
    .then(() => initDb())
    .then(async () => {
      console.log("Database ready");
      await closeDb();
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
