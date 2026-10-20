const APEX = new Set(["kitcheniq.cloud", "www.kitcheniq.cloud", "kitchiq.cloud", "www.kitchiq.cloud"]);

export function isTdcpDesktop() {
  if (typeof window === "undefined") return false;
  if (window.tdcpDesktop?.tdcpOnly) return true;
  return typeof navigator !== "undefined" && /Electron/i.test(navigator.userAgent || "");
}

export function hostPortal() {
  if (typeof window === "undefined") return null;
  if (isTdcpDesktop()) return "tdcp";
  const host = window.location.hostname.toLowerCase();
  if (host === "tdcp.kitcheniq.cloud" || host === "tdcp.kitchiq.cloud") return "tdcp";
  if (APEX.has(host)) return "servex";
  return null;
}

export function portalOrigin(portal) {
  if (portal === "tdcp") return "https://tdcp.kitcheniq.cloud";
  if (portal === "servex") return "https://kitcheniq.cloud";
  return "";
}
