const DB_NAME = "kitcheniq-sync";
const DB_VERSION = 1;

const state = {
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  pending: 0,
  syncing: false,
  lastSync: null,
  lastError: "",
};

const listeners = new Set();
let replay = null;
let flushing = false;
let started = false;
let dbPromise = null;

function publish(patch = {}) {
  Object.assign(state, patch);
  const snapshot = getSyncStatus();
  listeners.forEach((fn) => fn(snapshot));
}

export function getSyncStatus() {
  return { ...state };
}

export function subscribeSync(fn) {
  listeners.add(fn);
  fn(getSyncStatus());
  return () => listeners.delete(fn);
}

export function setReplaySender(fn) {
  replay = fn;
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("cache")) db.createObjectStore("cache");
      if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "id", autoIncrement: true });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function withStore(name, mode, fn) {
  const db = await openDb();
  const tx = db.transaction(name, mode);
  const result = await fn(tx.objectStore(name));
  await txDone(tx);
  return result;
}

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function cacheKey(config) {
  const url = String(config.url || "");
  const params = config.params || {};
  const query = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return `GET ${url}${query ? `?${query}` : ""}`;
}

export async function rememberGet(config, data) {
  try {
    await withStore("cache", "readwrite", (store) => request(store.put(data, cacheKey(config))));
  } catch {
    /* cache is best-effort */
  }
}

export async function readCache(config) {
  try {
    return await withStore("cache", "readonly", (store) => request(store.get(cacheKey(config))));
  } catch {
    return undefined;
  }
}

function collectionPath(url) {
  const path = String(url || "").split("?")[0];
  const parts = path.split("/").filter(Boolean);
  if (!parts.length) return path;
  if (parts[0] === "menu") return "/menu";
  return `/${parts[0]}`;
}

function applyToCached(data, method, url, preview) {
  const id = String(preview?.id || String(url).split("/").filter(Boolean).pop() || "");
  if (Array.isArray(data)) {
    if (method === "delete") return data.filter((row) => String(row?.id) !== id);
    if (method === "post") return [preview, ...data];
    return data.map((row) => (row && String(row.id) === id ? { ...row, ...preview } : row));
  }
  if (data && Array.isArray(data.items)) {
    return { ...data, items: applyToCached(data.items, method, url, preview) };
  }
  if (data && Array.isArray(data.rows)) {
    return { ...data, rows: applyToCached(data.rows, method, url, preview) };
  }
  return data;
}

async function mergeCaches(url, method, preview) {
  const root = collectionPath(url);
  const db = await openDb();
  const tx = db.transaction("cache", "readwrite");
  const store = tx.objectStore("cache");
  const keys = await request(store.getAllKeys());
  keys.forEach((key) => {
    const text = String(key);
    const path = text.replace(/^GET\s+/, "").split("?")[0];
    if (path !== root && !path.startsWith(`${root}/`)) return;
    const getReq = store.get(key);
    getReq.onsuccess = () => {
      store.put(applyToCached(getReq.result, method, url, preview), key);
    };
  });
  await txDone(tx);
}

function orderPreview(data, localId) {
  const items = Array.isArray(data?.items) ? data.items : [];
  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1), 0);
  return {
    id: localId,
    order_no: `OFF-${String(Date.now()).slice(-4)}`,
    status: data?.status || "new",
    note: data?.note || null,
    table_id: data?.table_id || null,
    subtotal,
    tax: 0,
    total: subtotal,
    payment_status: "unpaid",
    items,
    offline: true,
    created_at: new Date().toISOString(),
  };
}

function previewBody(method, url, data, localId) {
  const path = String(url || "").split("?")[0];
  if (method === "post" && path === "/orders") return orderPreview(data, localId);
  if (method === "post") return { ...(data || {}), id: localId, offline: true };
  if (method === "patch" || method === "put") return { ...(data || {}), offline: true };
  return { ok: true, offline: true };
}

async function pendingCount() {
  const rows = await withStore("outbox", "readonly", (store) => request(store.getAll()));
  return rows.length;
}

async function refreshPending() {
  try {
    publish({ pending: await pendingCount() });
  } catch {
    /* indexedDB unavailable */
  }
}

export function canQueue(config) {
  if (config?.__replay) return false;
  const method = String(config?.method || "get").toLowerCase();
  if (method === "get" || method === "head" || method === "options") return false;
  const url = String(config?.url || "");
  if (url.includes("/auth/")) return false;
  if (url.includes("/payments/stripe")) return false;
  if (url.includes("/print")) return false;
  if (typeof FormData !== "undefined" && config.data instanceof FormData) return false;
  return true;
}

export function isOfflineFailure(err) {
  if (!err?.response) return true;
  const status = err.response.status;
  if (status === 502 || status === 504) return true;
  return status === 503 && (err.response.data?.code === "DB_OFFLINE" || !err.response.data?.code);
}

export async function queueRequest(config) {
  const method = String(config.method || "post").toLowerCase();
  const url = String(config.url || "");
  const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = url.split("?")[0];
  let data = config.data;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      /* keep the original body */
    }
  }
  if (data && typeof data === "object" && !(typeof FormData !== "undefined" && data instanceof FormData) && !Array.isArray(data)) {
    data = { ...data };
    if (method === "post" && path === "/orders") data.client_ref = localId;
  }
  const preview = previewBody(method, url, data, localId);
  await withStore("outbox", "readwrite", (store) =>
    request(
      store.add({
        method,
        url,
        data,
        params: config.params || {},
        localId,
        createdAt: Date.now(),
      })
    )
  );
  try {
    await mergeCaches(url, method, preview);
  } catch {
    /* lists refresh after sync */
  }
  publish({ pending: await pendingCount(), online: false, lastError: "" });
  if (url.includes("/orders")) window.dispatchEvent(new Event("tdcp-notify-refresh"));
  return { data: preview, status: 202, statusText: "Queued", headers: {}, config };
}

async function loadIdMap() {
  try {
    return (await withStore("meta", "readonly", (store) => request(store.get("idmap")))) || {};
  } catch {
    return {};
  }
}

async function saveIdMap(map) {
  await withStore("meta", "readwrite", (store) => request(store.put(map, "idmap")));
}

function rewriteUrl(url, map) {
  return String(url).replace(/local-\d+-[a-z0-9]+/g, (id) => (map[id] != null ? String(map[id]) : id));
}

async function probe() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    publish({ online: false });
    return false;
  }
  try {
    const res = await fetch("/api/health", { cache: "no-store", signal: AbortSignal.timeout(4000) });
    const body = await res.json();
    const up = res.ok && body.db === "up";
    publish({ online: up });
    return up;
  } catch {
    publish({ online: false });
    return false;
  }
}

export async function flushOutbox() {
  if (flushing || !replay) return;
  const up = await probe();
  if (!up) return;
  flushing = true;
  publish({ syncing: true, lastError: "" });
  try {
    const map = await loadIdMap();
    const items = await withStore("outbox", "readonly", (store) => request(store.getAll()));
    items.sort((a, b) => a.id - b.id);
    for (const item of items) {
      const url = rewriteUrl(item.url, map);
      if (/local-\d+/.test(url)) {
        publish({ lastError: "A saved change is waiting for an earlier order to sync." });
        break;
      }
      try {
        const res = await replay({ ...item, url });
        if (item.localId && res?.data?.id != null) {
          map[item.localId] = res.data.id;
          await saveIdMap(map);
        }
        await withStore("outbox", "readwrite", (store) => request(store.delete(item.id)));
      } catch (err) {
        if (isOfflineFailure(err)) {
          publish({ online: false, lastError: "Connection dropped while syncing. Saved changes are still on this device." });
          break;
        }
        await withStore("outbox", "readwrite", (store) => request(store.delete(item.id)));
        publish({ lastError: err.response?.data?.message || "One saved change was rejected by the server." });
      }
    }
    const pending = await pendingCount();
    publish({
      pending,
      online: true,
      lastSync: pending === 0 ? Date.now() : state.lastSync,
    });
    if (pending === 0) window.dispatchEvent(new Event("tdcp-data-synced"));
    window.dispatchEvent(new Event("tdcp-notify-refresh"));
  } finally {
    flushing = false;
    publish({ syncing: false });
  }
}

export function startOfflineSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  refreshPending();
  window.addEventListener("online", () => {
    publish({ online: true });
    flushOutbox();
  });
  window.addEventListener("offline", () => publish({ online: false }));
  probe().then((up) => {
    if (up) flushOutbox();
  });
  window.setInterval(() => {
    probe().then((up) => {
      if (up && state.pending > 0) flushOutbox();
    });
  }, 8000);
}
