export const ROLES = {
  super_admin: "super_admin",
  org_admin: "org_admin",
  manager: "manager",
  order_taker: "order_taker",
  cashier: "cashier",
  kitchen: "kitchen",
};

export const STAFF_ROLES = [ROLES.order_taker, ROLES.cashier, ROLES.kitchen];
export const ALL_ROLES = [ROLES.super_admin, ROLES.org_admin, ROLES.manager, ...STAFF_ROLES];

export function isSuperAdmin(user) {
  return user?.role === ROLES.super_admin || user?.role === "admin";
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

export function canCreateRole(actor, role) {
  if (isSuperAdmin(actor)) return [ROLES.org_admin, ROLES.manager, ...STAFF_ROLES].includes(role);
  if (isOrgAdmin(actor)) return [ROLES.manager, ...STAFF_ROLES].includes(role);
  if (isResortManager(actor)) return STAFF_ROLES.includes(role);
  return false;
}

export function publicUser(row) {
  if (!row) return row;
  const { password_hash, ...rest } = row;
  return rest;
}
