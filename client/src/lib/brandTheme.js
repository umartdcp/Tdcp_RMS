import { isTdcpOrg, organizationLogoUrl } from "./orgBranding";

export function mix(hex, ratio, toward = "#ffffff") {
  const parse = (h) => {
    const v = String(h || "").replace("#", "");
    const n = v.length === 3 ? v.split("").map((c) => c + c).join("") : v;
    return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) || 0);
  };
  const a = parse(hex);
  const b = parse(toward);
  const c = a.map((n, i) => Math.round(n + (b[i] - n) * ratio));
  return `#${c.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function currentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export const TDCP_BRAND = {
  code: "TDCP",
  name: "Tourism Development Corporation of Punjab",
  app_name: "TDCP Restaurant Management System",
  logo_url: "/tdcp-logo.png",
  primary_color: "#0c553c",
  secondary_color: "#16845c",
  background_color: "#f3f6f8",
  text_color: "#16324a",
};

function desktopTdcp() {
  if (typeof window === "undefined") return false;
  if (window.tdcpDesktop?.tdcpOnly) return true;
  return typeof navigator !== "undefined" && /Electron/i.test(navigator.userAgent || "");
}

export function applyBrandTheme(org) {
  const root = document.documentElement;
  const dark = currentTheme() === "dark";
  const tdcp = isTdcpOrg(org) || desktopTdcp();
  const primary = tdcp ? TDCP_BRAND.primary_color : org?.primary_color || "#0c553c";
  const secondary = tdcp ? TDCP_BRAND.secondary_color : org?.secondary_color || "#2fa87a";
  const lightText = tdcp ? TDCP_BRAND.text_color : org?.text_color || "#143028";
  const tokens = {
    "--color-tdcp-50": mix(primary, 0.92),
    "--color-tdcp-100": mix(primary, 0.82),
    "--color-tdcp-200": mix(primary, 0.65),
    "--color-tdcp-300": mix(primary, 0.4, secondary),
    "--color-tdcp-400": secondary,
    "--color-tdcp-500": mix(primary, 0.15, secondary),
    "--color-tdcp-600": mix(primary, 0.08),
    "--color-tdcp-700": primary,
    "--color-tdcp-800": mix(primary, 0.2, "#000000"),
    "--color-tdcp-900": mix(primary, 0.4, "#000000"),
    "--color-tdcp-950": mix(primary, 0.55, "#000000"),
    "--brand-primary": primary,
    "--brand-secondary": secondary,
    "--sidebar-bg": tdcp ? "#0e4a34" : "#0c2340",
    "--sidebar-active": tdcp ? "#3dce7a" : "#ff7a1a",
    "--sidebar-text": "#ffffff",
    "--sidebar-muted": "rgba(255,255,255,0.78)",
    "--app-bg": dark ? "#0b1220" : tdcp ? "#f3f6f8" : "#f4f7fb",
    "--app-text": dark ? "#ffffff" : tdcp ? "#16324a" : "#1b2a4a",
    "--app-muted": dark ? "rgba(255,255,255,0.72)" : mix(lightText, 0.35, "#6b7280"),
    "--header-bg": dark ? mix(primary, 0.7, "#000000") : "#ffffff",
    "--header-border": dark ? mix(primary, 0.45, "#000000") : "#e6ebe8",
    "--surface": dark ? mix(primary, 0.62, "#000000") : "#ffffff",
    "--surface-border": dark ? mix(primary, 0.4, "#000000") : "#e6ebe8",
  };
  Object.entries(tokens).forEach(([key, value]) => root.style.setProperty(key, value));
  let favicon = organizationLogoUrl(org);
  if (!favicon && org && !isTdcpOrg(org)) {
    const letter = String(org.name || org.app_name || "R").charAt(0).toUpperCase();
    favicon = `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="${primary}"/><text x="32" y="42" text-anchor="middle" font-size="32" font-family="Arial" fill="#fff">${letter}</text></svg>`
    )}`;
  }
  if (!favicon) favicon = tdcp ? "/tdcp-logo.png?v=4" : "/favicon.svg";
  if (favicon) {
    let link = document.querySelector("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = favicon;
  }
  document.title = tdcp ? TDCP_BRAND.app_name : org?.app_name || "TDCP Restaurant Management System";
}

export function clearBrandTheme() {
  applyBrandTheme(null);
}
