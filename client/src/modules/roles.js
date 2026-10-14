export const ROLES = {
  super_admin: "super_admin",
  admin: "admin",
  org_admin: "org_admin",
  manager: "manager",
  order_taker: "order_taker",
  cashier: "cashier",
  kitchen: "kitchen",
  staff: "staff",
};

export const STAFF_ROLES = [ROLES.order_taker, ROLES.cashier, ROLES.kitchen];

export const ROLE_LABELS = {
  super_admin: "Super Admin",
  admin: "Super Admin",
  org_admin: "Organization Admin",
  manager: "Site Manager",
  order_taker: "Order Taker",
  cashier: "Cashier",
  kitchen: "Chef",
  staff: "Staff",
};

export const PAGE_ROLES = {
  "/": ["org_admin", "manager"],
  "/pos": ["manager", "order_taker", "cashier"],
  "/tables": ["manager", "order_taker"],
  "/orders": ["manager", "order_taker", "cashier"],
  "/menu": ["manager", "order_taker"],
  "/kds": ["manager", "kitchen"],
  "/customers": ["org_admin", "manager"],
  "/reports": ["super_admin", "admin", "org_admin", "manager"],
  "/audit-logs": ["org_admin", "manager"],
  "/users": ["super_admin", "admin", "org_admin", "manager"],
  "/restaurants": ["super_admin", "admin", "org_admin"],
  "/organizations": ["super_admin", "admin"],
  "/settings": ["super_admin", "admin", "org_admin"],
  "/pay": ["manager", "cashier", "order_taker"],
};

export function isSuperAdmin(user) {
  return user?.role === ROLES.super_admin || user?.role === ROLES.admin;
}

export function isMainAdmin(user) {
  return isSuperAdmin(user);
}

export function isOrgAdmin(user) {
  return user?.role === ROLES.org_admin;
}

export function isResortManager(user) {
  return user?.role === ROLES.manager;
}

export function isStaff(user) {
  return STAFF_ROLES.includes(user?.role);
}

export function canManageUsers(user) {
  return isMainAdmin(user) || isOrgAdmin(user) || isResortManager(user);
}

export function canSwitchSites(user) {
  return isSuperAdmin(user) || isOrgAdmin(user);
}

export function creatableRoles(actor) {
  if (isSuperAdmin(actor)) {
    return [
      { id: ROLES.org_admin, label: ROLE_LABELS.org_admin },
      { id: ROLES.manager, label: ROLE_LABELS.manager },
      ...STAFF_ROLES.map((id) => ({ id, label: ROLE_LABELS[id] })),
    ];
  }
  if (isOrgAdmin(actor)) {
    return [{ id: ROLES.manager, label: ROLE_LABELS.manager }, ...STAFF_ROLES.map((id) => ({ id, label: ROLE_LABELS[id] }))];
  }
  if (isResortManager(actor)) {
    return STAFF_ROLES.map((id) => ({ id, label: ROLE_LABELS[id] }));
  }
  return [];
}

export function defaultCreateRole(actor) {
  if (isSuperAdmin(actor)) return ROLES.org_admin;
  if (isOrgAdmin(actor)) return ROLES.manager;
  return ROLES.order_taker;
}

export function homePath(user) {
  const role = user?.role;
  if (role === ROLES.super_admin || role === ROLES.admin) return "/";
  if (role === ROLES.kitchen) return "/kds";
  if (role === ROLES.order_taker) return "/pos";
  if (role === ROLES.cashier) return "/orders";
  return "/";
}

export function canAccessPath(user, pathname) {
  const path = String(pathname || "/");
  if (path.startsWith("/organizations")) return isSuperAdmin(user);
  if (path.startsWith("/pay")) return PAGE_ROLES["/pay"].includes(user?.role);
  const match = Object.keys(PAGE_ROLES)
    .filter((key) => key !== "/")
    .sort((a, b) => b.length - a.length)
    .find((key) => path === key || path.startsWith(`${key}/`));
  const roles = PAGE_ROLES[match || "/"];
  return roles.includes(user?.role);
}
