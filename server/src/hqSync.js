import { Router } from "express";
import { query } from "./db.js";
import { authRequired } from "./middleware/auth.js";
import { readUpload, saveDataUrl } from "./uploads.js";

const status = {
  lastOk: null,
  lastError: null,
  lastTry: null,
};

let debounce = null;

function configured() {
  return Boolean(String(process.env.SYNC_URL || "").trim() && String(process.env.SYNC_SECRET || "").trim());
}

function hqUrl() {
  return String(process.env.SYNC_URL || "").replace(/\/$/, "");
}

async function rows(sql, params = []) {
  return (await query(sql, params)).rows;
}

async function orderItemsFor(orderIds) {
  const ids = [...new Set(orderIds.map((id) => Number(id)).filter((id) => id > 0))];
  if (!ids.length) return [];
  const marks = ids.map((_, index) => `$${index + 1}`).join(", ");
  return rows(`SELECT * FROM order_items WHERE order_id IN (${marks})`, ids);
}

function attachMenuImages(menu) {
  for (const item of menu || []) {
    const file = readUpload(item.image_url);
    if (!file || file.length > 2 * 1024 * 1024) continue;
    const ext = String(item.image_url).split(".").pop().toLowerCase();
    const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    item.image_base64 = `data:${mime};base64,${file.toString("base64")}`;
  }
}

async function resolvedImage(item, prefix) {
  if (item?.image_base64) {
    try {
      return saveDataUrl(prefix, item.image_base64);
    } catch {
      /* keep a normal URL when the file cannot be stored */
    }
  }
  const url = String(item?.image_url || "");
  return url && !url.startsWith("data:") ? url : null;
}

async function collectSite(rid, email) {
  const restaurant = (await rows(`SELECT * FROM restaurants WHERE id=$1`, [rid]))[0];
  if (!restaurant) return null;
  const manager =
    email ||
    (await rows(`SELECT email FROM users WHERE restaurant_id=$1 AND role <> 'admin' ORDER BY id LIMIT 1`, [rid]))[0]
      ?.email ||
    null;
  const orders = await rows(`SELECT * FROM orders WHERE restaurant_id=$1 OR site_id=$1 ORDER BY id`, [rid]);
  return {
    manager_email: manager,
    restaurant,
    tables: await rows(`SELECT * FROM dining_tables WHERE restaurant_id=$1 OR site_id=$1`, [rid]),
    categories: await rows(
      `SELECT * FROM menu_categories WHERE restaurant_id=$1 OR site_id=$1 ORDER BY sort_order, id`,
      [rid]
    ),
    menu: await rows(`SELECT * FROM menu_items WHERE restaurant_id=$1 OR site_id=$1`, [rid]),
    customers: await rows(`SELECT * FROM customers WHERE restaurant_id=$1 OR site_id=$1`, [rid]),
    users: await rows(
      `SELECT name, email, role FROM users WHERE (restaurant_id=$1 OR site_id=$1) AND role <> 'admin'`,
      [rid]
    ),
    orders,
    order_items: await orderItemsFor(orders.map((order) => order.id)),
  };
}

async function collectPayloads() {
  const email = String(process.env.SYNC_RESTAURANT_EMAIL || "").trim();
  if (email) {
    const user = (await rows(`SELECT restaurant_id FROM users WHERE lower(email)=lower($1)`, [email]))[0];
    if (!user?.restaurant_id) throw new Error("SYNC_RESTAURANT_EMAIL ka restaurant nahi mila");
    const payload = await collectSite(user.restaurant_id, email);
    return payload ? [payload] : [];
  }
  const sites = await rows(
    `SELECT s.id
     FROM sites s
     JOIN organizations o ON o.id = s.organization_id
     WHERE s.is_active = 1 AND upper(o.code) = 'TDCP'
     ORDER BY s.id`
  );
  const payloads = [];
  for (const site of sites) {
    const payload = await collectSite(site.id, null);
    if (payload) payloads.push(payload);
  }
  return payloads;
}

async function findId(sql, params) {
  const row = (await rows(sql, params))[0];
  return row?.id || null;
}

export async function applyHqPayload(data) {
  const r = data.restaurant;
  if (!r?.name) throw new Error("Restaurant missing");

  let rid = await findId(`SELECT id FROM restaurants WHERE lower(name)=lower($1)`, [r.name]);
  if (!rid && data.manager_email) {
    rid = (
      await rows(`SELECT restaurant_id AS id FROM users WHERE lower(email)=lower($1)`, [data.manager_email])
    )[0]?.id;
  }
  if (!rid) {
    const org =
      (await rows(`SELECT id FROM organizations WHERE code='TDCP' ORDER BY id LIMIT 1`))[0] ||
      (await rows(`SELECT id FROM organizations ORDER BY id LIMIT 1`))[0];
    if (!org) throw new Error("No organization exists to attach this site");
    const code = String(r.site_code || r.name)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 32);
    rid = (
      await query(
        `INSERT INTO sites (organization_id, code, name, address, is_active)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [org.id, code, r.name, r.location || "", (r.status || "open") !== "closed"]
      )
    ).rows[0].id;
  } else {
    await query(`UPDATE sites SET address=$1, is_active=$2, updated_at=NOW() WHERE id=$3`, [
      r.location || "",
      (r.status || "open") !== "closed",
      rid,
    ]);
  }
  const orgId = (await rows(`SELECT organization_id FROM sites WHERE id=$1`, [rid]))[0].organization_id;

  const tables = {};
  for (const t of data.tables || []) {
    let id = await findId(
      `SELECT id FROM dining_tables WHERE restaurant_id=$1 AND label=$2 AND section=$3`,
      [rid, t.label, t.section]
    );
    if (id) {
      await query(`UPDATE dining_tables SET seats=$1, status=$2 WHERE id=$3`, [t.seats || 4, t.status, id]);
    } else {
      id = (
        await query(
          `INSERT INTO dining_tables (organization_id, site_id, restaurant_id, label, section, seats, status) VALUES ($1,$2,$2,$3,$4,$5,$6) RETURNING id`,
          [orgId, rid, t.label, t.section, t.seats || 4, t.status || "available"]
        )
      ).rows[0].id;
    }
    tables[t.id] = id;
  }

  const categories = {};
  for (const c of data.categories || []) {
    let id = await findId(`SELECT id FROM menu_categories WHERE lower(name)=lower($1)`, [c.name]);
    if (id) {
      await query(`UPDATE menu_categories SET sort_order=$1 WHERE id=$2`, [c.sort_order || 0, id]);
    } else {
      id = (
        await query(`INSERT INTO menu_categories (organization_id, site_id, restaurant_id, name, sort_order) VALUES ($1,$2,$2,$3,$4) RETURNING id`, [
          orgId,
          rid,
          c.name,
          c.sort_order || 0,
        ])
      ).rows[0].id;
    }
    categories[c.id] = id;
  }

  const menu = {};
  for (const m of data.menu || []) {
    let id = await findId(`SELECT id FROM menu_items WHERE restaurant_id=$1 AND lower(name)=lower($2)`, [
      rid,
      m.name,
    ]);
    const cat = m.category_id ? categories[m.category_id] || null : null;
    const imageUrl = await resolvedImage(m, `menu-${rid}`);
    const available = !(m.is_available === false || m.is_available === 0 || m.is_available === "0");
    if (id) {
      await query(
        `UPDATE menu_items SET category_id=$1, price=$2, emoji=$3, image_url=$4, is_available=$5 WHERE id=$6`,
        [cat, m.price, m.emoji, imageUrl, available, id]
      );
    } else {
      id = (
        await query(
          `INSERT INTO menu_items (organization_id, site_id, restaurant_id, category_id, name, price, emoji, image_url, is_available)
           VALUES ($1,$2,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [orgId, rid, cat, m.name, m.price, m.emoji || "", imageUrl, available]
        )
      ).rows[0].id;
    }
    menu[m.id] = id;
  }

  const customers = {};
  for (const c of data.customers || []) {
    let id = c.phone
      ? await findId(`SELECT id FROM customers WHERE restaurant_id=$1 AND phone=$2`, [rid, c.phone])
      : await findId(`SELECT id FROM customers WHERE restaurant_id=$1 AND lower(name)=lower($2)`, [rid, c.name]);
    if (id) {
      await query(
        `UPDATE customers SET name=$1, phone=$2, cnic=$3, visits=$4, last_visit=$5 WHERE id=$6`,
        [c.name, c.phone || null, c.cnic || null, c.visits || 0, c.last_visit || null, id]
      );
    } else {
      id = (
        await query(
          `INSERT INTO customers (organization_id, site_id, restaurant_id, name, phone, cnic, visits, last_visit) VALUES ($1,$2,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [orgId, rid, c.name, c.phone || null, c.cnic || null, c.visits || 0, c.last_visit || null]
        )
      ).rows[0].id;
    }
    customers[c.id] = id;
  }

  for (const u of data.users || []) {
    if (!u.email || u.role === "admin") continue;
    const existing = await findId(`SELECT id FROM users WHERE lower(email)=lower($1)`, [u.email]);
    if (existing) {
      await query(`UPDATE users SET name=$1, role=$2, restaurant_id=$3, site_id=$3, organization_id=$4 WHERE id=$5`, [
        u.name,
        u.role,
        rid,
        orgId,
        existing,
      ]);
    }
  }

  const itemsByOrder = {};
  for (const line of data.order_items || []) {
    (itemsByOrder[line.order_id] ||= []).push(line);
  }

  for (const o of data.orders || []) {
    let id = await findId(`SELECT id FROM orders WHERE restaurant_id=$1 AND order_no=$2`, [rid, String(o.order_no)]);
    const tableId = o.table_id ? tables[o.table_id] || null : null;
    const customerId = o.customer_id ? customers[o.customer_id] || null : null;
    if (id) {
      await query(
        `UPDATE orders SET table_id=$1, customer_id=$2, status=$3, payment_method=$4, payment_status=$5,
           note=$6, subtotal=$7, tax=$8, total=$9, created_at=$10, updated_at=$11 WHERE id=$12`,
        [
          tableId,
          customerId,
          o.status,
          o.payment_method,
          o.payment_status,
          o.note,
          o.subtotal,
          o.tax,
          o.total,
          o.created_at,
          o.updated_at,
          id,
        ]
      );
    } else {
      id = (
        await query(
          `INSERT INTO orders (organization_id, site_id, restaurant_id, table_id, customer_id, order_no, status, payment_method, payment_status,
             note, subtotal, tax, total, created_at, updated_at)
           VALUES ($1,$2,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
          [
            orgId,
            rid,
            tableId,
            customerId,
            String(o.order_no),
            o.status,
            o.payment_method,
            o.payment_status,
            o.note,
            o.subtotal,
            o.tax,
            o.total,
            o.created_at,
            o.updated_at,
          ]
        )
      ).rows[0].id;
    }
    await query(`DELETE FROM order_items WHERE order_id=$1`, [id]);
    for (const line of itemsByOrder[o.id] || []) {
      await query(`INSERT INTO order_items (organization_id, site_id, order_id, menu_item_id, name, qty, price) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [
        orgId,
        rid,
        id,
        line.menu_item_id ? menu[line.menu_item_id] || null : null,
        line.name,
        line.qty,
        line.price,
      ]);
    }
  }
}

export async function pushToHq() {
  status.lastTry = new Date().toISOString();
  if (!configured()) {
    status.lastError = "Set SYNC_URL and SYNC_SECRET so this PC can sync to the admin dashboard.";
    return getStatus();
  }
  try {
    const payloads = await collectPayloads();
    if (!payloads.length) throw new Error("No restaurant data to sync");
    for (const payload of payloads) {
      attachMenuImages(payload.menu);
      const res = await fetch(`${hqUrl()}/api/sync/push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tdcp-sync": process.env.SYNC_SECRET,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || `HQ ${res.status}`);
    }
    status.lastOk = new Date().toISOString();
    status.lastError = null;
  } catch (err) {
    status.lastError = err.message || "HQ reachable nahi (offline)";
  }
  return getStatus();
}

export function scheduleSync() {
  if (!configured()) return;
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    pushToHq().catch(() => {});
  }, 5000);
}

export function getStatus() {
  return {
    enabled: configured(),
    restaurant: process.env.SYNC_RESTAURANT_EMAIL || null,
    hq: process.env.SYNC_URL || null,
    ...status,
  };
}

export function startHqSyncLoop() {
  if (!configured()) return;
  pushToHq().catch(() => {});
  setInterval(() => {
    pushToHq().catch(() => {});
  }, 120000);
}

export const syncRouter = Router();

syncRouter.post("/push", async (req, res) => {
  const key = req.headers["x-tdcp-sync"] || "";
  if (!process.env.SYNC_SECRET || key !== process.env.SYNC_SECRET) {
    return res.status(401).json({ message: "Invalid sync key" });
  }
  try {
    await applyHqPayload(req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Sync failed" });
  }
});

syncRouter.get("/status", authRequired, (_req, res) => {
  res.json(getStatus());
});

syncRouter.post("/now", authRequired, async (_req, res) => {
  res.json(await pushToHq());
});
