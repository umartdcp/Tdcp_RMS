import axios from "axios";
import {
  canQueue,
  getSyncStatus,
  isOfflineFailure,
  queueRequest,
  readCache,
  rememberGet,
  setReplaySender,
} from "./offlineSync";
import { guestLoginPath } from "./lib/platform";

export function apiBase() {
  const desktop = typeof window !== "undefined" ? window.tdcpDesktop?.apiBase : "";
  if (desktop) return desktop;
  if (typeof navigator !== "undefined" && /Electron/i.test(navigator.userAgent || "")) {
    return "https://kitcheniq.cloud/api";
  }
  return "/api";
}

const api = axios.create({
  baseURL: apiBase(),
  timeout: 12000,
});

const WARM_PATHS = ["/menu", "/orders", "/tables", "/customers", "/restaurants", "/notifications", "/dashboard"];
let warming = false;

export async function warmWorkingSet() {
  if (warming || typeof window === "undefined") return;
  if (!localStorage.getItem("tdcp_token")) return;
  if (navigator.onLine === false || getSyncStatus().online === false) return;
  warming = true;
  try {
    await Promise.all(WARM_PATHS.map((url) => api.get(url, { __warm: true }).catch(() => null)));
    await api.get("/dashboard", { params: { hq: 1 }, __warm: true }).catch(() => null);
  } finally {
    warming = false;
  }
}

setReplaySender((item) =>
  api.request({
    method: item.method,
    url: item.url,
    data: item.data,
    params: item.params,
    __replay: true,
  })
);

const SKIP_RESORT_SCOPE = ["/auth", "/restaurants", "/organizations", "/sites", "/dashboard/overview", "/audit-logs", "/platform"];

function skipResortScope(url = "") {
  const path = String(url).split("?")[0];
  return SKIP_RESORT_SCOPE.some((p) => path.includes(p));
}

api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem("tdcp_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  let storedUser = {};
  try {
    storedUser = JSON.parse(localStorage.getItem("tdcp_user") || "{}") || {};
  } catch {
    storedUser = {};
  }
  const role = storedUser.role || "";
  const ownSite = storedUser.site_id || storedUser.restaurant_id || "";
  const active = ["manager", "order_taker", "cashier", "kitchen", "staff"].includes(role)
    ? ownSite || localStorage.getItem("tdcp_active_restaurant")
    : localStorage.getItem("tdcp_active_restaurant") || ownSite;
  const params = { ...(config.params || {}) };
  if (params.all_restaurants || params.hq) {
    const hq = params.hq;
    delete params.all_restaurants;
    delete params.restaurant_id;
    delete params.site_id;
    config.params = hq ? { ...params, hq: 1 } : params;
  } else {
    const explicitSite =
      Object.prototype.hasOwnProperty.call(params, "restaurant_id") ||
      Object.prototype.hasOwnProperty.call(params, "site_id");
    if (active && !explicitSite && !skipResortScope(config.url || "")) {
      config.params = { ...params, restaurant_id: active, site_id: active };
    }
  }
  const method = String(config.method || "get").toLowerCase();
  const offline = typeof navigator !== "undefined" && (navigator.onLine === false || getSyncStatus().online === false);
  if (method === "get" && !config.__replay && !config.__warm && offline) {
    const cached = await readCache(config);
    if (cached !== undefined) {
      config.adapter = () =>
        Promise.resolve({
          data: cached,
          status: 200,
          statusText: "Cached",
          headers: {},
          config,
        });
    } else {
      config.timeout = 2500;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => {
    const url = String(res.config?.url || "");
    const method = (res.config?.method || "").toLowerCase();
    if (method === "get" && res.data != null) rememberGet(res.config, res.data);
    if (
      (url.includes("/orders") && (method === "post" || method === "patch")) ||
      url.includes("/payments/stripe/complete")
    ) {
      window.dispatchEvent(new Event("tdcp-notify-refresh"));
    }
    return res;
  },
  async (err) => {
    const config = err.config || {};
    const method = String(config.method || "get").toLowerCase();
    if (!config.__replay && isOfflineFailure(err) && method === "get") {
      const cached = await readCache(config);
      if (cached !== undefined) {
        return { data: cached, status: 200, statusText: "Cached", headers: {}, config };
      }
    }
    if (!config.__replay && isOfflineFailure(err) && canQueue(config)) {
      return queueRequest(config);
    }
    const failedAuth = String(config.url || "").includes("/auth/me") || String(config.url || "").includes("/auth/login");
    if (err.response?.status === 401 && failedAuth && !String(window.location.pathname).includes("/login")) {
      try {
        sessionStorage.setItem("tdcp_return_path", window.location.pathname);
      } catch {
        /* ignore */
      }
      localStorage.removeItem("tdcp_token");
      localStorage.removeItem("tdcp_user");
      window.location.href = guestLoginPath();
    }
    return Promise.reject(err);
  }
);

export default api;
