import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { query } from "../db.js";
import { writeAudit } from "../modules/audit.js";
import { isSuperAdmin } from "../modules/roles.js";
import { withSafeLogo, organizationLogoUrl } from "../orgBranding.js";

const router = Router();
const secret = () => process.env.JWT_SECRET || "tdcp-rms-dev-secret-change-me";

const USER_SQL = `
  SELECT u.*,
         r.code AS role_code,
         s.id AS site_pk,
         s.code AS site_code,
         s.name AS site_name,
         s.is_active AS site_active,
         o.id AS org_pk,
         o.code AS organization_code,
         o.name AS organization_name,
         o.logo_url,
         o.favicon_url,
         o.primary_color,
         o.secondary_color,
         o.background_color,
         o.text_color,
         o.app_name,
         o.is_active AS organization_active
  FROM users u
  LEFT JOIN roles r ON r.id = u.role_id
  LEFT JOIN sites s ON s.id = COALESCE(u.site_id, u.restaurant_id)
  LEFT JOIN organizations o ON o.id = COALESCE(u.organization_id, s.organization_id)
`;

async function permissionsFor(roleId, roleCode) {
  if (!roleId && !roleCode) return [];
  if (roleId) {
    const rows = await query(
      `SELECT p.code FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id=$1 ORDER BY p.code`,
      [roleId]
    );
    if (rows.rows.length) return rows.rows.map((r) => r.code);
  }
  const rows = await query(
    `SELECT p.code FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     JOIN roles r ON r.id = rp.role_id
     WHERE r.code=$1 ORDER BY p.code`,
    [roleCode]
  );
  return rows.rows.map((r) => r.code);
}

function orgPayload(user) {
  if (!user.org_pk && user.role !== "super_admin" && user.role !== "admin") return null;
  if (!user.org_pk) return null;
  return {
    organization_id: user.org_pk,
    code: user.organization_code,
    name: user.organization_name,
    logo_url: organizationLogoUrl({ code: user.organization_code, logo_url: user.logo_url }),
    favicon_url: user.favicon_url,
    primary_color: user.primary_color,
    secondary_color: user.secondary_color,
    background_color: user.background_color,
    text_color: user.text_color,
    app_name: user.app_name,
  };
}

function sitePayload(user) {
  if (!user.site_pk) return null;
  return {
    site_id: user.site_pk,
    code: user.site_code,
    name: user.site_name,
    organization_id: user.org_pk,
  };
}

function publicUser(user) {
  const role = user.role === "admin" ? "super_admin" : user.role;
  return {
    user_id: user.id,
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    role,
    organization_id: user.org_pk || user.organization_id || null,
    site_id: user.site_pk || user.site_id || user.restaurant_id || null,
    restaurant_id: user.site_pk || user.site_id || user.restaurant_id || null,
    restaurant_name: user.site_name || null,
  };
}

async function sessionBody(user) {
  const role = user.role === "admin" ? "super_admin" : user.role;
  const permissions = await permissionsFor(user.role_id, role);
  return {
    user: publicUser(user),
    organization: orgPayload(user),
    site: sitePayload(user),
    permissions,
  };
}

router.get("/portals", async (_req, res) => {
  const rows = await query(
    `SELECT code, name, app_name, logo_url, primary_color, secondary_color
     FROM organizations WHERE is_active=1 ORDER BY name`
  );
  res.json({
    organizations: rows.rows.map((row) => ({
      ...withSafeLogo(row),
      link: `/login/${String(row.code).toLowerCase()}`,
    })),
  });
});

router.get("/branding/:code", async (req, res) => {
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

router.post("/login", async (req, res) => {
  const { email, password, organization_code, portal } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  const result = await query(`${USER_SQL} WHERE lower(u.email)=lower($1) OR lower(COALESCE(u.username,''))=lower($1)`, [
    email,
  ]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }
  if (user.is_active === false) {
    return res.status(403).json({ message: "This account is disabled." });
  }
  const role = user.role === "admin" ? "super_admin" : user.role;
  if (String(process.env.TDCP_ONLY || "") === "1") {
    const orgCode = String(user.organization_code || "").toUpperCase();
    if (role === "super_admin" || orgCode !== "TDCP") {
      return res.status(403).json({ message: "This site is for TDCP accounts only." });
    }
  }
  const portalKind = String(portal || "").toLowerCase();
  const orgCode = String(organization_code || "").trim();
  const servexPortal = portalKind === "servex" || orgCode.toUpperCase() === "SERVEX";
  if (portalKind !== "auto") {
    if (servexPortal) {
      if (role !== "super_admin") {
        return res.status(403).json({ message: "This login is for ServeX Super Admins only. Use your restaurant login." });
      }
    } else if (orgCode || portalKind === "org") {
      if (role === "super_admin") {
        return res.status(403).json({ message: "Super Admins must sign in at /login/servex" });
      }
      if (orgCode && String(user.organization_code || "").toUpperCase() !== orgCode.toUpperCase()) {
        return res.status(403).json({ message: "This account does not belong to that organization." });
      }
    }
  }
  if (role !== "super_admin") {
    if (user.organization_active === false) {
      return res.status(403).json({ message: "This organization is not active." });
    }
    if (user.site_pk && user.site_active === false) {
      return res.status(403).json({ message: "This site is not active yet. Ask your organization admin to activate it." });
    }
  }

  const siteId = user.site_pk || user.site_id || user.restaurant_id || null;
  const orgId = user.org_pk || user.organization_id || null;
  const token = jwt.sign(
    {
      id: user.id,
      role,
      organization_id: orgId,
      site_id: siteId,
      restaurant_id: siteId,
      name: user.name,
    },
    secret(),
    { expiresIn: "12h" }
  );
  const session = await sessionBody(user);
  await writeAudit({
    action: "login",
    entity: "user",
    entityId: user.id,
    restaurantId: siteId,
    restaurantName: user.site_name || user.organization_name || "Platform",
    actor: { id: user.id, name: user.name, role },
    details: user.email,
  });
  res.json({
    success: true,
    token,
    ...session,
  });
});

router.get("/me", async (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Authentication required" });
  try {
    const payload = jwt.verify(token, secret());
    const result = await query(`${USER_SQL} WHERE u.id=$1`, [payload.id]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ message: "Invalid token" });
    res.json(await sessionBody(user));
  } catch (err) {
    if (err?.name === "JsonWebTokenError" || err?.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Invalid token" });
    }
    console.error(err);
    res.status(500).json({ message: "Could not load your session." });
  }
});

router.patch("/profile", async (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Authentication required" });
  let payload;
  try {
    payload = jwt.verify(token, secret());
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
  const { name, email, current_password, new_password } = req.body || {};
  const current = await query(`SELECT * FROM users WHERE id=$1`, [payload.id]);
  const user = current.rows[0];
  if (!user) return res.status(404).json({ message: "User not found" });

  if (new_password) {
    if (!current_password) {
      return res.status(400).json({ message: "Current password is required to set a new one." });
    }
    const ok = await bcrypt.compare(current_password, user.password_hash);
    if (!ok) return res.status(400).json({ message: "Current password is incorrect." });
    if (String(new_password).length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters." });
    }
  }

  const nextName = name?.trim() || user.name;
  const nextEmail = email?.trim() || user.email;
  let hash = user.password_hash;
  if (new_password) hash = await bcrypt.hash(new_password, 10);

  try {
    await query(`UPDATE users SET name=$1, email=$2, password_hash=$3, updated_at=NOW() WHERE id=$4`, [
      nextName,
      nextEmail,
      hash,
      user.id,
    ]);
    const result = await query(`${USER_SQL} WHERE u.id=$1`, [user.id]);
    res.json(await sessionBody(result.rows[0]));
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "That email is already in use." });
    throw err;
  }
});

export default router;
export { isSuperAdmin };
