import jwt from "jsonwebtoken";
import { bindRequestDatabase } from "../db.js";

const secret = () => process.env.JWT_SECRET || "tdcp-rms-dev-secret-change-me";

function normalizeRole(role) {
  if (role === "admin") return "super_admin";
  return role;
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }
  try {
    const payload = jwt.verify(token, secret());
    req.user = {
      ...payload,
      role: normalizeRole(payload.role),
      site_id: payload.site_id ?? payload.restaurant_id ?? null,
      restaurant_id: payload.restaurant_id ?? payload.site_id ?? null,
    };
    bindRequestDatabase(req)
      .then((enter) => enter(() => next()))
      .catch(next);
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.user?.role;
    const allowed = new Set(roles.flatMap((r) => (r === "admin" ? ["admin", "super_admin"] : [r])));
    if (allowed.has("super_admin")) allowed.add("admin");
    if (!role || !allowed.has(role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}
