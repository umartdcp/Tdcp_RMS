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

const RETURN_KEY = "tdcp_return_path";

export function guestLoginPath() {
  return "/login";
}

export function rememberPath(pathname) {
  const path = String(pathname || "");
  if (!path || path.startsWith("/login")) return;
  try {
    sessionStorage.setItem(RETURN_KEY, path);
  } catch {
    /* ignore */
  }
}

export function consumeReturnPath(fallback) {
  let saved = "";
  try {
    saved = sessionStorage.getItem(RETURN_KEY) || "";
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    saved = "";
  }
  if (saved && !saved.startsWith("/login")) return saved;
  return fallback;
}

export function loginPathForSession(user, organization) {
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host === "tdcp.kitcheniq.cloud" || host === "tdcp.kitchiq.cloud" || host === "kitcheniq.cloud" || host === "www.kitcheniq.cloud" || host === "kitchiq.cloud" || host === "www.kitchiq.cloud") {
      return "/login";
    }
  }
  if (isServexUser(user) || !organization?.code) return "/login/servex";
  return `/login/${String(organization.code).toLowerCase()}`;
}
