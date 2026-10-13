import axios from "axios";
import {
  canQueue,
  isOfflineFailure,
  queueRequest,
  readCache,
  rememberGet,
  setReplaySender,
} from "./offlineSync";
import { guestLoginPath } from "./lib/platform";

const api = axios.create({
  baseURL: "/api",
  timeout: 20000,
});

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

api.interceptors.request.use((config) => {
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
    return config;
  }
  const explicitSite = Object.prototype.hasOwnProperty.call(config.params || {}, "restaurant_id");
  if (active && !explicitSite && !skipResortScope(config.url || "")) {
    config.params = { ...params, restaurant_id: active, site_id: active };
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
