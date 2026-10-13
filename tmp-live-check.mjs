const base = "https://kitcheniq.cloud";

async function login(email) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "admin123", organization_code: "tdcp" }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function auth(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

const session = await login("admin@tdcp.gov.pk");
console.log("login", session.status, session.data?.user?.role, "site", session.data?.user?.site_id, "org", session.data?.user?.organization_id);
if (!session.data?.token) {
  console.log("login-message", session.data?.message || "none");
  process.exit(0);
}
const token = session.data.token;
const me = await fetch(`${base}/api/auth/me`, { headers: auth(token) });
const meBody = await me.json().catch(() => ({}));
console.log("me", me.status, meBody?.user?.role, "site", meBody?.user?.site_id, "siteName", meBody?.site?.name || "");

const restaurants = await fetch(`${base}/api/restaurants`, { headers: auth(token) });
const sites = await restaurants.json().catch(() => []);
console.log(
  "sites",
  restaurants.status,
  Array.isArray(sites) ? sites.map((s) => ({ id: s.id, name: s.name, image: s.image_url || "" })) : sites?.message
);
if (Array.isArray(sites)) {
  for (const site of sites.filter((s) => s.image_url)) {
    const img = await fetch(site.image_url.startsWith("http") ? site.image_url : `${base}${site.image_url}`);
    console.log("image-fetch", site.id, img.status, img.headers.get("content-type"), site.image_url);
  }
}
const usersAll = await fetch(`${base}/api/users`, { headers: auth(token) });
const userRows = await usersAll.json().catch(() => []);
console.log(
  "user-roles",
  usersAll.status,
  Array.isArray(userRows) ? userRows.map((u) => ({ role: u.role, site: u.site_id || u.restaurant_id })) : userRows?.message
);
const manager = Array.isArray(userRows) ? userRows.find((u) => u.role === "manager") : null;
if (manager?.email) {
  const managerLogin = await login(manager.email);
  console.log("manager-login", managerLogin.status, managerLogin.data?.user?.role, "site", managerLogin.data?.user?.site_id, managerLogin.data?.message || "");
  if (managerLogin.data?.token) {
    const mToken = managerLogin.data.token;
    const mMe = await fetch(`${base}/api/auth/me`, { headers: auth(mToken) });
    const mBody = await mMe.json().catch(() => ({}));
    console.log("manager-me", mMe.status, mBody?.user?.role, mBody?.site?.name || "", mBody?.message || "");
    const mTables = await fetch(`${base}/api/tables`, { headers: auth(mToken) });
    const mRows = await mTables.json().catch(() => []);
    console.log("manager-tables", mTables.status, Array.isArray(mRows) ? mRows.length : mRows?.message);
    const mOrders = await fetch(`${base}/api/orders`, { headers: auth(mToken) });
    const mOrderRows = await mOrders.json().catch(() => []);
    console.log("manager-orders", mOrders.status, Array.isArray(mOrderRows) ? mOrderRows.length : mOrderRows?.message);
  }
}

const siteId = Array.isArray(sites) ? sites.find((s) => /taunsa/i.test(s.name || ""))?.id || sites[0]?.id : null;
console.log("using-site", siteId);
if (!siteId) process.exit(0);

const tablesRes = await fetch(`${base}/api/tables?site_id=${siteId}&restaurant_id=${siteId}`, { headers: auth(token) });
const tables = await tablesRes.json().catch(() => []);
console.log("tables", tablesRes.status, Array.isArray(tables) ? tables.length : tables?.message);
if (Array.isArray(tables) && tables[0]) {
  const sample = tables[0];
  console.log("sample-table", { id: sample.id, label: sample.label, site_id: sample.site_id, restaurant_id: sample.restaurant_id, status: sample.status });
}

const createdRes = await fetch(`${base}/api/tables?site_id=${siteId}&restaurant_id=${siteId}`, {
  method: "POST",
  headers: auth(token),
  body: JSON.stringify({ section: "Main Hall", seats: 4, count: 1, label: "ZZ" }),
});
const created = await createdRes.json().catch(() => ({}));
console.log("create", createdRes.status, created.id || created.message, created.label || "");

if (created.id) {
  const patched = await fetch(`${base}/api/tables/${created.id}?site_id=${siteId}&restaurant_id=${siteId}`, {
    method: "PATCH",
    headers: auth(token),
    body: JSON.stringify({ seats: 6, label: "ZZ", section: "Outdoor" }),
  });
  const patchBody = await patched.json().catch(() => ({}));
  console.log("patch", patched.status, patchBody.section || patchBody.message, patchBody.seats || "");
  const removed = await fetch(`${base}/api/tables/${created.id}?site_id=${siteId}&restaurant_id=${siteId}`, {
    method: "DELETE",
    headers: auth(token),
  });
  const removeBody = await removed.json().catch(() => ({}));
  console.log("delete", removed.status, removeBody.ok || removeBody.message);
}

if (Array.isArray(tables) && tables[0]) {
  const ghost = await fetch(`${base}/api/tables/${tables[0].id}?site_id=${siteId}&restaurant_id=${siteId}`, {
    method: "PATCH",
    headers: auth(token),
    body: JSON.stringify({ seats: tables[0].seats }),
  });
  const ghostBody = await ghost.json().catch(() => ({}));
  console.log("existing-patch", ghost.status, ghostBody.message || ghostBody.label || "ok");
}

const ordersRes = await fetch(`${base}/api/orders?site_id=${siteId}&restaurant_id=${siteId}`, { headers: auth(token) });
const orders = await ordersRes.json().catch(() => []);
const open = Array.isArray(orders)
  ? orders.filter((o) => ["new", "preparing", "ready"].includes(String(o.status || "").toLowerCase()) && o.payment_status !== "paid")
  : [];
console.log("orders", ordersRes.status, Array.isArray(orders) ? orders.length : orders?.message, "open", open.length);
if (open[0]) {
  const current = String(open[0].status).toLowerCase();
  const next = current === "new" ? "preparing" : current === "preparing" ? "ready" : "preparing";
  const moved = await fetch(`${base}/api/orders/${open[0].id}?site_id=${siteId}&restaurant_id=${siteId}`, {
    method: "PATCH",
    headers: auth(token),
    body: JSON.stringify({ status: next }),
  });
  const movedBody = await moved.json().catch(() => ({}));
  console.log("kds-advance", moved.status, "from", current, "to", movedBody.status || movedBody.message);
  if (moved.ok) {
    await fetch(`${base}/api/orders/${open[0].id}?site_id=${siteId}&restaurant_id=${siteId}`, {
      method: "PATCH",
      headers: auth(token),
      body: JSON.stringify({ status: current }),
    });
    console.log("kds-reverted", current);
  }
}

const usersRes = await fetch(`${base}/api/users?site_id=${siteId}&restaurant_id=${siteId}`, { headers: auth(token) });
const users = await usersRes.json().catch(() => []);
console.log("users", usersRes.status, Array.isArray(users) ? users.length : users?.message);
