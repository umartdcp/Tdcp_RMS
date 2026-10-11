import { Router } from "express";
import { query } from "../db.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { isMainAdmin } from "./roles.js";
import { backfillAuditHistory, ensureAuditLogsSchema } from "./audit.js";

const router = Router();
router.use(authRequired);

router.get("/audit-logs", requireRole("admin", "super_admin", "org_admin", "manager"), async (req, res) => {
  try {
    await ensureAuditLogsSchema();
    await backfillAuditHistory();

    const resort = String(req.query.resort || req.query.restaurant_name || "").trim();
    const params = [];
    let sql = `
      SELECT
        a.id,
        a.restaurant_id,
        COALESCE(NULLIF(btrim(a.restaurant_name), ''), r.name, 'Platform') AS restaurant_name,
        a.user_id,
        COALESCE(NULLIF(btrim(a.user_name), ''), u.name, u.email, 'System') AS user_name,
        COALESCE(NULLIF(btrim(a.user_role), ''), u.role, '') AS user_role,
        a.action,
        a.entity,
        a.entity_id,
        COALESCE(a.details, '') AS details,
        a.created_at
      FROM audit_logs a
      LEFT JOIN restaurants r ON r.id = a.restaurant_id
      LEFT JOIN users u ON u.id = a.user_id
      WHERE 1=1
    `;
    if (!isMainAdmin(req.user) && req.user.role !== "org_admin") {
      params.push(req.user.site_id || req.user.restaurant_id);
      sql += ` AND a.restaurant_id=$${params.length}`;
    } else if (req.user.role === "org_admin") {
      params.push(req.user.organization_id);
      sql += ` AND COALESCE(a.organization_id, r.organization_id)=$${params.length}`;
    } else if (resort) {
      params.push(resort);
      sql += ` AND lower(COALESCE(NULLIF(btrim(a.restaurant_name), ''), r.name, '')) = (lower($${params.length}) COLLATE utf8mb4_unicode_ci)`;
    }
    sql += " ORDER BY a.created_at DESC, a.id DESC LIMIT 500";
    const rows = await query(sql, params);

    const names =
      isMainAdmin(req.user) || req.user.role === "org_admin"
        ? (
            await query(
              isMainAdmin(req.user)
                ? `SELECT name FROM restaurants WHERE COALESCE(status COLLATE utf8mb4_unicode_ci, 'open') <> 'closed' ORDER BY name`
                : `SELECT name FROM restaurants WHERE organization_id=$1 AND COALESCE(status COLLATE utf8mb4_unicode_ci, 'open') <> 'closed' ORDER BY name`,
              isMainAdmin(req.user) ? [] : [req.user.organization_id]
            )
          ).rows.map((r) => r.name)
        : [];

    res.json({ logs: rows.rows, resorts: names });
  } catch (err) {
    console.error("audit-logs list failed", err);
    res.status(500).json({ message: err.message || "Could not load audit logs", logs: [], resorts: [] });
  }
});

export default router;
