import { query } from "./db.js";
import { isOrgAdmin, isSuperAdmin } from "./modules/roles.js";

export function requestedSiteId(req) {
  return Number(req.query.site_id || req.query.restaurant_id || req.body?.site_id || req.body?.restaurant_id || 0);
}

export async function attachTenant(req, res, next) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Authentication required" });

    if (String(req.query.hq || "") === "1" && isOrgAdmin(user) && !isSuperAdmin(user)) {
      req.tenant = { organizationId: user.organization_id || null, siteId: null };
      return next();
    }

    if (user.role === "super_admin" && !requestedSiteId(req) && !user.site_id) {
      req.tenant = { organizationId: user.organization_id || null, siteId: null };
      return next();
    }

    let siteId = user.site_id || null;
    const requested = requestedSiteId(req);
    if (requested && (isSuperAdmin(user) || isOrgAdmin(user))) {
      siteId = requested;
    }

    if (!siteId) {
      req.tenant = { organizationId: user.organization_id || null, siteId: null };
      return next();
    }

    const found = await query(
      `SELECT s.id, s.organization_id, s.code, s.name, s.is_active,
              o.code AS organization_code, o.name AS organization_name
       FROM sites s
       JOIN organizations o ON o.id = s.organization_id
       WHERE s.id=$1`,
      [siteId]
    );
    const site = found.rows[0];
    if (!site) return res.status(404).json({ message: "Site not found" });
    if (isOrgAdmin(user) && Number(site.organization_id) !== Number(user.organization_id)) {
      return res.status(403).json({ message: "That site is not in your organization." });
    }
    if (!isSuperAdmin(user) && !isOrgAdmin(user) && Number(site.id) !== Number(user.site_id)) {
      return res.status(403).json({ message: "You cannot switch to another site." });
    }

    req.tenant = {
      organizationId: Number(site.organization_id),
      siteId: Number(site.id),
      site,
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function oid(req) {
  return req.tenant?.organizationId ?? req.user?.organization_id ?? null;
}

export function rid(req) {
  if (req.tenant && Object.prototype.hasOwnProperty.call(req.tenant, "siteId")) {
    return req.tenant.siteId ?? null;
  }
  return req.user?.site_id ?? null;
}

export function requireSite(req, res, next) {
  if (!rid(req)) {
    return res.status(400).json({ message: "Select a site first." });
  }
  next();
}
