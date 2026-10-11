import bcrypt from "bcryptjs";
import { Router } from "express";
import { query } from "../db.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { ALL_ROLES, STAFF_ROLES, canCreateRole, isMainAdmin, isOrgAdmin, isResortManager, isSuperAdmin } from "./roles.js";
import { audit } from "./audit.js";
import { attachTenant, rid } from "../tenant.js";

const router = Router();
router.use(authRequired);
router.use(attachTenant);

const USER_COLS = `u.id, u.organization_id, u.site_id, u.restaurant_id, u.name, u.email, u.username, u.role, u.created_at,
  s.name AS restaurant_name, s.address AS restaurant_location, o.name AS organization_name, o.code AS organization_code`;

router.get("/users", requireRole("admin", "super_admin", "org_admin", "manager"), async (req, res) => {
  const join = `FROM users u
    LEFT JOIN sites s ON s.id = COALESCE(u.site_id, u.restaurant_id)
    LEFT JOIN organizations o ON o.id = COALESCE(u.organization_id, s.organization_id)`;

  if (isSuperAdmin(req.user)) {
    const orgId = Number(req.query.organization_id || 0);
    if (orgId) {
      const rows = await query(
        `SELECT ${USER_COLS} ${join} WHERE u.organization_id=$1 AND u.role <> 'super_admin' ORDER BY u.id`,
        [orgId]
      );
      return res.json(rows.rows);
    }
    const rows = await query(
      `SELECT ${USER_COLS} ${join} WHERE u.role <> 'super_admin' ORDER BY o.name, u.id`
    );
    return res.json(rows.rows);
  }
  if (isOrgAdmin(req.user)) {
    const rows = await query(
      `SELECT ${USER_COLS} ${join} WHERE u.organization_id=$1 AND u.role <> 'super_admin' ORDER BY u.id`,
      [req.user.organization_id]
    );
    return res.json(rows.rows);
  }

  const rows = await query(
    `SELECT ${USER_COLS} ${join}
     WHERE COALESCE(u.site_id, u.restaurant_id)=$1 AND u.role IN ('order_taker','cashier','kitchen','staff')
     ORDER BY u.id`,
    [req.user.site_id || req.user.restaurant_id]
  );
  res.json(rows.rows);
});

router.post("/users", requireRole("admin", "super_admin", "org_admin", "manager"), async (req, res) => {
  const { name, email, password, role, username } = req.body;
  const nextRole = ALL_ROLES.includes(role) ? role : isMainAdmin(req.user) ? "manager" : "cashier";
  if (nextRole === "super_admin" && !isSuperAdmin(req.user)) {
    return res.status(403).json({ message: "You cannot create a super admin." });
  }
  if (!canCreateRole(req.user, nextRole)) {
    return res.status(403).json({ message: "You cannot create a user with that role." });
  }

  let siteId = rid(req);
  let orgId = req.user.organization_id || null;
  if (isSuperAdmin(req.user)) {
    siteId = Number(req.body.site_id || req.body.restaurant_id || siteId) || null;
    orgId = Number(req.body.organization_id || orgId) || null;
  } else if (isOrgAdmin(req.user)) {
    orgId = req.user.organization_id;
    siteId = Number(req.body.site_id || req.body.restaurant_id || siteId) || null;
    if (siteId) {
      const site = (await query(`SELECT organization_id FROM sites WHERE id=$1`, [siteId])).rows[0];
      if (!site || Number(site.organization_id) !== Number(orgId)) {
        return res.status(403).json({ message: "That site is not in your organization." });
      }
    }
  } else {
    siteId = req.user.site_id || req.user.restaurant_id;
    orgId = req.user.organization_id;
  }
  if (isSuperAdmin(req.user) && nextRole !== "super_admin" && !orgId) {
    return res.status(400).json({ message: "Select an organization for this user." });
  }
  if (nextRole !== "super_admin" && nextRole !== "org_admin" && !siteId) {
    return res.status(400).json({ message: "Select a site for this user." });
  }
  if (siteId && !orgId) {
    const site = (await query(`SELECT organization_id FROM sites WHERE id=$1`, [siteId])).rows[0];
    orgId = site?.organization_id || null;
  }

  try {
    const hash = await bcrypt.hash(password || "staff123", 10);
    const roleRow = (await query(`SELECT id FROM roles WHERE code=$1`, [nextRole])).rows[0];
    const result = await query(
      `INSERT INTO users (organization_id, site_id, restaurant_id, role_id, name, username, email, password_hash, role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, organization_id, site_id, restaurant_id, name, email, username, role, created_at`,
      [orgId, siteId, siteId, roleRow?.id || null, name, username || email, email, hash, nextRole]
    );
    audit(req, {
      action: "create_user",
      entity: "user",
      entityId: result.rows[0].id,
      restaurantId: siteId,
      details: `${name} (${nextRole}) ${email}`,
    });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "That email is already in use." });
    throw err;
  }
});

router.patch("/users/:id", requireRole("admin", "super_admin", "org_admin", "manager"), async (req, res) => {
  const { name, email, password, role, restaurant_id, site_id } = req.body;
  const current = await query(`SELECT * FROM users WHERE id=$1`, [req.params.id]);
  const user = current.rows[0];
  if (!user) return res.status(404).json({ message: "User not found" });

  if (isResortManager(req.user) && !isOrgAdmin(req.user) && !isSuperAdmin(req.user)) {
    if (Number(user.site_id || user.restaurant_id) !== Number(req.user.site_id || req.user.restaurant_id) || !STAFF_ROLES.includes(user.role)) {
      return res.status(403).json({ message: "You can only update staff at your site." });
    }
  }
  if (isOrgAdmin(req.user) && !isSuperAdmin(req.user) && Number(user.organization_id) !== Number(req.user.organization_id)) {
    return res.status(403).json({ message: "You can only update users in your organization." });
  }

  let nextRole = user.role;
  if (role && role !== user.role) {
    if (!canCreateRole(req.user, role)) {
      return res.status(403).json({ message: "You cannot assign that role." });
    }
    nextRole = role;
  }

  let nextSite = user.site_id || user.restaurant_id;
  if ((isMainAdmin(req.user) || isOrgAdmin(req.user)) && (site_id || restaurant_id)) {
    nextSite = Number(site_id || restaurant_id);
    if (isOrgAdmin(req.user) && !isSuperAdmin(req.user)) {
      const site = (await query(`SELECT organization_id FROM sites WHERE id=$1`, [nextSite])).rows[0];
      if (!site || Number(site.organization_id) !== Number(req.user.organization_id)) {
        return res.status(403).json({ message: "That site is not in your organization." });
      }
    }
  }

  let hash = user.password_hash;
  if (password) hash = await bcrypt.hash(password, 10);
  try {
    const result = await query(
      `UPDATE users SET name=COALESCE($1,name), email=COALESCE($2,email), role=$3, password_hash=$4,
              site_id=$5, restaurant_id=$5, updated_at=NOW()
       WHERE id=$6
       RETURNING id, organization_id, site_id, restaurant_id, name, email, username, role, created_at`,
      [name, email, nextRole, hash, nextSite, req.params.id]
    );
    audit(req, {
      action: "update_user",
      entity: "user",
      entityId: result.rows[0].id,
      restaurantId: nextSite,
      details: `${result.rows[0].name} (${result.rows[0].role})`,
    });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "That email is already in use." });
    throw err;
  }
});

router.delete("/users/:id", requireRole("admin", "super_admin", "org_admin", "manager"), async (req, res) => {
  if (Number(req.params.id) === Number(req.user.id)) {
    return res.status(400).json({ message: "You cannot delete your own account." });
  }
  const current = await query(`SELECT * FROM users WHERE id=$1`, [req.params.id]);
  const user = current.rows[0];
  if (!user) return res.status(404).json({ message: "User not found" });

  if (isResortManager(req.user) && !isOrgAdmin(req.user) && !isSuperAdmin(req.user)) {
    if (Number(user.site_id || user.restaurant_id) !== Number(req.user.site_id || req.user.restaurant_id) || !STAFF_ROLES.includes(user.role)) {
      return res.status(403).json({ message: "You can only delete staff at your site." });
    }
  }
  if (isOrgAdmin(req.user) && !isSuperAdmin(req.user) && Number(user.organization_id) !== Number(req.user.organization_id)) {
    return res.status(403).json({ message: "You can only delete users in your organization." });
  }

  await query(`DELETE FROM users WHERE id=$1`, [req.params.id]);
  audit(req, {
    action: "delete_user",
    entity: "user",
    entityId: Number(req.params.id),
    restaurantId: user.site_id || user.restaurant_id,
    details: `${user.name} (${user.role})`,
  });
  res.json({ ok: true });
});

export default router;
