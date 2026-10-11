export const SERVEX = {
  code: "SERVEX",
  name: "KitchenIQ.cloud",
  app_name: "KitchenIQ.cloud",
  tagline: "Smart Kitchens. Smarter Decisions.",
  motto: "Better Control · Higher Efficiency · Greater Profits",
  footer: "Better Control | Higher Efficiency | Greater Profits",
  primary_color: "#0c2340",
  secondary_color: "#ff7a1a",
  background_color: "#f4f7fb",
  text_color: "#1b2a4a",
  logo_url: "/kitcheniq-mark.svg",
  version: "v1.0.0",
};

export function isServexUser(user) {
  return user?.role === "super_admin" || user?.role === "admin";
}

export function guestLoginPath() {
  return "/login";
}

export function loginPathForSession(user, organization) {
  if (isServexUser(user) || !organization?.code) return "/login/servex";
  return `/login/${String(organization.code).toLowerCase()}`;
}
