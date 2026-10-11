import { query } from "../db.js";
import { isMainAdmin } from "./roles.js";

let schemaReady = false;
let historyFilled = false;

export async function resortNameFor(restaurantId) {
  if (!restaurantId) return "Platform";
  const row = (await query(`SELECT name FROM restaurants WHERE id=$1`, [restaurantId])).rows[0];
  return row?.name || "Unknown site";
}

export async function ensureAuditLogsSchema() {
  if (schemaReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      restaurant_id INT NULL,
      restaurant_name VARCHAR(255),
      user_id INT NULL,
      user_name VARCHAR(255),
      user_role VARCHAR(64),
      action VARCHAR(64) NOT NULL,
      entity VARCHAR(64),
      entity_id VARCHAR(64),
      details TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS restaurant_name TEXT`);
  await query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_name TEXT`);
  await query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_role TEXT`);
  await query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details TEXT`);
  await query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity TEXT`);
  await query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id TEXT`).catch(() => {});
  await query(`UPDATE audit_logs SET details = detail WHERE details IS NULL AND detail IS NOT NULL`).catch(() => {});
  await query(`
    UPDATE audit_logs a
    JOIN restaurants r ON a.restaurant_id = r.id
    SET a.restaurant_name = r.name
    WHERE a.restaurant_name IS NULL OR TRIM(a.restaurant_name) = ('' COLLATE utf8mb4_unicode_ci)
  `);
  await query(`
    UPDATE audit_logs
    SET restaurant_name = 'Platform'
    WHERE restaurant_name IS NULL OR TRIM(restaurant_name) = ('' COLLATE utf8mb4_unicode_ci)
  `);
  await query(`UPDATE audit_logs SET user_name = COALESCE(user_name, 'System') WHERE user_name IS NULL`);
  schemaReady = true;
}

export async function backfillAuditHistory() {
  if (historyFilled) return;
  await ensureAuditLogsSchema();
  await query(`
    INSERT INTO audit_logs
      (restaurant_id, restaurant_name, user_id, user_name, user_role, action, entity, entity_id, details, created_at)
    SELECT
      o.restaurant_id,
      r.name,
      NULL,
      'System',
      NULL,
      CASE WHEN o.payment_status = 'paid' THEN 'collect_payment' ELSE 'create_order' END,
      'order',
      CAST(o.id AS CHAR),
      CONCAT('Order ', o.order_no, ' · ', o.status, ' · Rs ', o.total),
      o.created_at
    FROM orders o
    JOIN restaurants r ON r.id = o.restaurant_id
    WHERE NOT EXISTS (
      SELECT 1 FROM audit_logs a
      WHERE a.entity = ('order' COLLATE utf8mb4_unicode_ci)
        AND a.entity_id = (CAST(o.id AS CHAR) COLLATE utf8mb4_unicode_ci)
    )
  `);
  await query(`
    INSERT INTO audit_logs
      (restaurant_id, restaurant_name, user_id, user_name, user_role, action, entity, entity_id, details, created_at)
    SELECT
      u.restaurant_id,
      COALESCE(r.name, 'Platform'),
      u.id,
      u.name,
      u.role,
      CASE WHEN u.role = 'admin' THEN 'hq_account' ELSE 'create_user' END,
      'user',
      CAST(u.id AS CHAR),
      CONCAT(u.email, ' (', u.role, ')'),
      u.created_at
    FROM users u
    LEFT JOIN restaurants r ON r.id = u.restaurant_id
    WHERE NOT EXISTS (
      SELECT 1 FROM audit_logs a
      WHERE a.entity = ('user' COLLATE utf8mb4_unicode_ci)
        AND a.entity_id = (CAST(u.id AS CHAR) COLLATE utf8mb4_unicode_ci)
        AND a.action IN (('create_user' COLLATE utf8mb4_unicode_ci), ('hq_account' COLLATE utf8mb4_unicode_ci))
    )
  `);
  historyFilled = true;
}

export async function writeAudit({
  req,
  action,
  entity = null,
  entityId = null,
  details = null,
  restaurantId,
  restaurantName,
  actor,
}) {
  try {
    await ensureAuditLogsSchema();
    const user = actor || req?.user || {};
    const rid = restaurantId === undefined ? user.restaurant_id ?? null : restaurantId;
    const name = String(restaurantName || (await resortNameFor(rid)) || "Unknown resort").trim();
    const text =
      details == null ? null : typeof details === "string" ? details : JSON.stringify(details);
    await query(
      `INSERT INTO audit_logs
        (restaurant_id, restaurant_name, user_id, user_name, user_role, action, entity, entity_id, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        rid || null,
        name,
        user.id || null,
        user.name || user.email || "System",
        user.role || null,
        action,
        entity,
        entityId == null ? null : String(entityId),
        text,
      ]
    );
  } catch (err) {
    console.error("audit log failed", err.message || err);
  }
}

export function audit(req, payload) {
  return writeAudit({ req, ...payload });
}

export function auditScope(req) {
  if (isMainAdmin(req.user)) return null;
  return req.user.site_id || req.user.restaurant_id;
}
