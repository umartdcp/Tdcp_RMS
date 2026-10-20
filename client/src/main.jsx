import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { startOfflineSync } from "./offlineSync";
import { warmWorkingSet } from "./api";
import { applyBrandTheme, TDCP_BRAND } from "./lib/brandTheme";

const desktopApp =
  typeof window !== "undefined" &&
  (window.tdcpDesktop?.tdcpOnly || /Electron/i.test(navigator.userAgent || ""));

if (desktopApp) {
  applyBrandTheme(TDCP_BRAND);
}

startOfflineSync();

function refreshLocalCopy() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  warmWorkingSet();
}

window.addEventListener("online", refreshLocalCopy);
window.setInterval(refreshLocalCopy, 20000);
refreshLocalCopy();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if (import.meta.env.PROD && "serviceWorker" in navigator && !desktopApp) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
