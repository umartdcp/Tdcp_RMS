import bcrypt from "bcryptjs";
import { Router } from "express";
import { query } from "../db.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { attachTenant, oid, rid } from "../tenant.js";
import { isOrgAdmin, isSuperAdmin } from "../modules/roles.js";
import { audit } from "../modules/audit.js";
import { canDeleteTdcpSite, removeSite, tdcpOrganizationId } from "../modules/siteDelete.js";
import { withSafeLogo } from "../orgBranding.js";

const router = Router();

function orgScopeSql(req, alias = "o") {
  if (isSuperAdmin(req.user)) return { sql: "TRUE", params: [] };
  return { sql: `${alias}.id=$1`, params: [req.user.organization_id] };
}

router.get("/public/branding/:code", async (req, res) => {
  const code = String(req.params.code || "").trim().toUpperCase();
  const row = (
    await query(
      `SELECT id AS organization_id, code, name, logo_url, favicon_url,
              primary_color, secondary_color, background_color, text_color, app_name
       FROM organizations WHERE upper(code)=$1 AND is_active=TRUE`,
      [code]
    )
  ).rows[0];
  if (!row) return res.status(404).json({ message: "Organization not found" });
  res.json({ organization: withSafeLogo(row) });
});

router.use(authRequired);
router.use(attachTenant);

router.get("/platform/summary", requireRole("super_admin", "admin"), async (_req, res) => {
  const orgs = await query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active)::int AS active FROM organizations`);
  const sites = await query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active)::int AS active FROM sites`);
  const users = await query(`SELECT COUNT(*)::int AS total FROM users`);
  const orders = await query(
    `SELECT COUNT(*)::int AS total, COALESCE(SUM(total),0)::float AS revenue
     FROM orders WHERE payment_status='paid'`
  );
  res.json({
    organizations: orgs.rows[0].total,
    active_organizations: orgs.rows[0].active,
    sites: sites.rows[0].total,
    active_sites: sites.rows[0].active,
    users: users.rows[0].total,
    orders: orders.rows[0].total,
    revenue: orders.rows[0].revenue,
  });
});

const ORG_LIST_SQL = `
  SELECT o.*,
         (SELECT COUNT(*)::int FROM sites s WHERE s.organization_id = o.id) AS site_count,
         (SELECT COUNT(*)::int FROM users u WHERE u.organization_id = o.id) AS user_count
  FROM organizations o
`;

router.get("/organizations", requireRole("super_admin", "admin", "org_admin"), async (req, res) => {
  if (isOrgAdmin(req.user) && !isSuperAdmin(req.user)) {
    const rows = await query(`${ORG_LIST_SQL} WHERE o.id=$1`, [req.user.organization_id]);
    return res.json(rows.rows);
  }
  res.json((await query(`${ORG_LIST_SQL} ORDER BY o.name`)).rows);
});

router.get("/organizations/:id", requireRole("super_admin", "admin", "org_admin"), async (req, res) => {
  const id = Number(req.params.id);
  if (isOrgAdmin(req.user) && !isSuperAdmin(req.user) && id !== Number(req.user.organization_id)) {
    return res.status(403).json({ message: "You can only view your organization." });
  }
  const row = (await query(`${ORG_LIST_SQL} WHERE o.id=$1`, [id])).rows[0];
  if (!row) return res.status(404).json({ message: "Organization not found" });
  const sites = (await query(`SELECT * FROM sites WHERE organization_id=$1 ORDER BY name`, [id])).rows;
  res.json({ ...row, sites });
});

router.post("/organizations", requireRole("super_admin", "admin"), async (req, res) => {
  const {
    organization_name,
    name,
    organization_code,
    code,
    logo_url,
    primary_color,
    secondary_color,
    background_color,
    text_color,
    app_name,
    address,
    phone,
    email,
    admin_name,
    admin_email,
    admin_password,
    site_name,
    site_code,
  } = req.body || {};
  const orgName = String(organization_name || name || "").trim();
  const orgCode = String(organization_code || code || "").trim().toUpperCase();
  if (!orgName || !orgCode) {
    return res.status(400).json({ message: "Organization name and code are required." });
  }
  try {
    const row = (
      await query(
        `INSERT INTO organizations
          (code, name, logo_url, primary_color, secondary_color, background_color, text_color, app_name, address, phone, email)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          orgCode,
          orgName,
          logo_url || null,
          primary_color || "#0c553c",
          secondary_color || "#2fa87a",
          background_color || "#f4f6f5",
          text_color || "#143028",
          app_name || orgName,
          address || null,
          phone || null,
          email || null,
        ]
      )
    ).rows[0];
    audit(req, { action: "create_organization", entity: "organization", entityId: row.id, details: orgCode });
    let admin = null;
    let site = null;
    const siteName = String(site_name || "").trim();
    if (siteName) {
      const siteCode = String(site_code || siteName)
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_|_$/g, "") || "MAIN";
      site = (
        await query(
          `INSERT INTO sites (organization_id, code, name, address) VALUES ($1,$2,$3,$4) RETURNING *`,
          [row.id, siteCode, siteName, address || null]
        )
      ).rows[0];
    }
    if (admin_email && admin_password) {
      const hash = await bcrypt.hash(admin_password, 10);
      const roleRow = (await query(`SELECT id FROM roles WHERE code='org_admin'`)).rows[0];
      admin = (
        await query(
          `INSERT INTO users (organization_id, site_id, restaurant_id, role_id, name, username, email, password_hash, role)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'org_admin')
           RETURNING id, name, email, role, organization_id`,
          [
            row.id,
            site?.id || null,
            site?.id || null,
            roleRow?.id || null,
            String(admin_name || "Organization Admin").trim(),
            String(admin_email).trim().toLowerCase(),
            String(admin_email).trim().toLowerCase(),
            hash,
          ]
        )
      ).rows[0];
    }
    res.status(201).json({ ...row, site, admin });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "That organization code already exists." });
    throw err;
  }
});

router.patch("/organizations/:id", requireRole("super_admin", "admin", "org_admin"), async (req, res) => {
  const id = Number(req.params.id);
  if (isOrgAdmin(req.user) && !isSuperAdmin(req.user) && id !== Number(req.user.organization_id)) {
    return res.status(403).json({ message: "You can only update your organization." });
  }
  const b = req.body || {};
  const nextCode =
    isSuperAdmin(req.user) && (b.organization_code || b.code)
      ? String(b.organization_code || b.code)
          .trim()
          .toUpperCase()
      : null;
  try {
    const result = await query(
      `UPDATE organizations SET
         code=COALESCE($1,code),
         name=COALESCE($2,name),
         logo_url=CASE WHEN $3::boolean THEN $4 ELSE logo_url END,
         favicon_url=COALESCE($5,favicon_url),
         primary_color=COALESCE($6,primary_color),
         secondary_color=COALESCE($7,secondary_color),
         background_color=COALESCE($8,background_color),
         text_color=COALESCE($9,text_color),
         app_name=COALESCE($10,app_name),
         address=COALESCE($11,address),
         phone=COALESCE($12,phone),
         email=COALESCE($13,email),
         is_active=COALESCE($14,is_active),
         updated_at=NOW()
       WHERE id=$15 RETURNING *`,
      [
        nextCode,
        b.organization_name || b.name || null,
        Object.prototype.hasOwnProperty.call(b, "logo_url"),
        b.logo_url ? String(b.logo_url).trim() : null,
        b.favicon_url ?? null,
        b.primary_color || null,
        b.secondary_color || null,
        b.background_color || null,
        b.text_color || null,
        b.app_name || null,
        b.address || null,
        b.phone || null,
        b.email || null,
        typeof b.is_active === "boolean" ? b.is_active : null,
        id,
      ]
    );
    if (!result.rows[0]) return res.status(404).json({ message: "Organization not found" });
    audit(req, { action: "update_organization", entity: "organization", entityId: id });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "That organization code already exists." });
    throw err;
  }
});

router.get("/organizations/:id/sites", requireRole("super_admin", "admin", "org_admin"), async (req, res) => {
  const id = Number(req.params.id);
  if (isOrgAdmin(req.user) && !isSuperAdmin(req.user) && id !== Number(req.user.organization_id)) {
    return res.status(403).json({ message: "You can only view sites in your organization." });
  }
  res.json((await query(`SELECT * FROM sites WHERE organization_id=$1 ORDER BY name`, [id])).rows);
});

router.get("/sites", requireRole("super_admin", "admin", "org_admin", "manager"), async (req, res) => {
  if (isSuperAdmin(req.user)) {
    return res.json(
      (
        await query(
          `SELECT s.*, o.name AS organization_name, o.code AS organization_code
           FROM sites s JOIN organizations o ON o.id = s.organization_id
           ORDER BY o.name, s.name`
        )
      ).rows
    );
  }
  if (isOrgAdmin(req.user)) {
    return res.json(
      (await query(`SELECT * FROM sites WHERE organization_id=$1 ORDER BY name`, [req.user.organization_id])).rows
    );
  }
  const siteId = rid(req);
  res.json((await query(`SELECT * FROM sites WHERE id=$1`, [siteId])).rows);
});

router.post("/sites", requireRole("super_admin", "admin", "org_admin"), async (req, res) => {
  const { site_name, name, site_code, code, address, phone, email, organization_id } = req.body || {};
  let orgId = Number(organization_id || oid(req) || req.user.organization_id);
  if (isOrgAdmin(req.user) && !isSuperAdmin(req.user)) orgId = Number(req.user.organization_id);
  if (!orgId) return res.status(400).json({ message: "organization_id is required" });
  const siteName = String(site_name || name || "").trim();
  const siteCode = String(site_code || code || "").trim().toUpperCase().replace(/\s+/g, "_");
  if (!siteName || !siteCode) return res.status(400).json({ message: "Site name and code are required." });
  try {
    const row = (
      await query(
        `INSERT INTO sites (organization_id, code, name, address, phone, email)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [orgId, siteCode, siteName, address || null, phone || null, email || null]
      )
    ).rows[0];
    audit(req, { action: "create_site", entity: "site", entityId: row.id, restaurantId: row.id, details: siteCode });
    res.status(201).json(row);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "That site code already exists in this organization." });
    throw err;
  }
});

router.patch("/sites/:id", requireRole("super_admin", "admin", "org_admin"), async (req, res) => {
  const current = (await query(`SELECT * FROM sites WHERE id=$1`, [req.params.id])).rows[0];
  if (!current) return res.status(404).json({ message: "Site not found" });
  if (isOrgAdmin(req.user) && !isSuperAdmin(req.user) && Number(current.organization_id) !== Number(req.user.organization_id)) {
    return res.status(403).json({ message: "You can only update sites in your organization." });
  }
  const b = req.body || {};
  const result = await query(
    `UPDATE sites SET
       name=COALESCE($1,name),
       address=COALESCE($2,address),
       phone=COALESCE($3,phone),
       email=COALESCE($4,email),
       is_active=COALESCE($5,is_active),
       updated_at=NOW()
     WHERE id=$6 RETURNING *`,
    [b.site_name || b.name || null, b.address || null, b.phone || null, b.email || null, typeof b.is_active === "boolean" ? b.is_active : null, req.params.id]
  );
  res.json(result.rows[0]);
});

router.delete("/sites/:id", requireRole("super_admin", "admin", "org_admin"), async (req, res) => {
  const current = (await query(`SELECT * FROM sites WHERE id=$1`, [req.params.id])).rows[0];
  if (!current) return res.status(404).json({ message: "Site not found" });
  const tdcpId = await tdcpOrganizationId();
  if (!canDeleteTdcpSite(req.user, current, tdcpId)) {
    return res.status(403).json({ message: "Only the TDCP admin can delete a TDCP site." });
  }
  await removeSite(current.id);
  audit(req, {
    action: "delete_site",
    entity: "site",
    entityId: current.id,
    restaurantId: null,
    restaurantName: current.name,
    details: current.code,
  });
  res.json({ ok: true });
});

export default router;
export { orgScopeSql };
