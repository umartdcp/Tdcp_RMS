import bcrypt from "bcryptjs";
import { Router } from "express";
import Stripe from "stripe";
import { query } from "../db.js";
import { scheduleSync } from "../hqSync.js";
import { saveDataUrl } from "../uploads.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { isOrgAdmin, isSuperAdmin } from "../modules/roles.js";
import { canDeleteTdcpSite, removeSite, tdcpOrganizationId } from "../modules/siteDelete.js";
import { attachTenant, oid, rid } from "../tenant.js";
import { withTax } from "../tax.js";
import { audit } from "../modules/audit.js";
import { printReceiptOnWindows } from "../modules/printReceipt.js";

const router = Router();
router.use(authRequired);
router.use(attachTenant);

async function findSiteTable(req, id) {
  const siteId = rid(req);
  if (!siteId || !id) return null;
  const found = await query(
    `SELECT * FROM dining_tables WHERE id=$1 AND (restaurant_id=$2 OR site_id=$2)`,
    [id, siteId]
  );
  return found.rows[0] || null;
}

router.get("/tables", async (req, res) => {
  const siteId = rid(req);
  if (!siteId) return res.json([]);
  const result = await query(
    `SELECT * FROM dining_tables
     WHERE restaurant_id=$1 OR site_id=$1
     ORDER BY section, label`,
    [siteId]
  );
  res.json(result.rows.filter((row) => Number(row.id) > 0));
});

router.post("/tables", async (req, res) => {
  const restaurantId = rid(req);
  if (!restaurantId) return res.status(400).json({ message: "Select a site first." });
  const section = String(req.body.section || "").trim();
  if (!section) return res.status(400).json({ message: "Area name is required." });
  const seats = Math.max(1, Math.min(20, Number(req.body.seats || 4)));
  const count = Math.max(1, Math.min(40, Number(req.body.count || 1)));
  const existing = await query(`SELECT label FROM dining_tables WHERE restaurant_id=$1`, [restaurantId]);
  const used = new Set(existing.rows.map((r) => String(r.label)));
  let nextNum = 1;
  const created = [];
  for (let i = 0; i < count; i += 1) {
    let label = String(req.body.label || "").trim();
    if (!label || count > 1 || i > 0) {
      while (used.has(String(nextNum).padStart(2, "0")) || used.has(String(nextNum))) nextNum += 1;
      label = String(nextNum).padStart(2, "0");
      used.add(label);
      nextNum += 1;
    } else if (used.has(label)) {
      return res.status(400).json({ message: `Table ${label} already exists in this restaurant.` });
    } else {
      used.add(label);
    }
    const row = await query(
      `INSERT INTO dining_tables (organization_id, site_id, restaurant_id, label, section, seats, status)
       VALUES ($1,$2,$2,$3,$4,$5,'available') RETURNING *`,
      [oid(req), restaurantId, label, section, seats]
    );
    created.push(row.rows[0]);
  }
  res.status(201).json(count === 1 ? created[0] : { items: created, count: created.length });
});

router.patch("/tables/:id", async (req, res) => {
  const { status, label, section, seats } = req.body || {};
  const currentRow = await findSiteTable(req, req.params.id);
  if (!currentRow) return res.status(404).json({ message: "Table not found" });
  const nextSeats = seats === "" || seats == null ? null : Number(seats);
  if (nextSeats != null && (!Number.isFinite(nextSeats) || nextSeats < 1)) {
    return res.status(400).json({ message: "Seats must be a number." });
  }
  const result = await query(
    `UPDATE dining_tables SET
       status=COALESCE($1,status),
       label=COALESCE($2,label),
       section=COALESCE($3,section),
       seats=COALESCE($4,seats)
     WHERE id=$5 RETURNING *`,
    [
      status || null,
      label != null ? String(label).trim() : null,
      section != null ? String(section).trim() : null,
      nextSeats,
      currentRow.id,
    ]
  );
  res.json(result.rows[0]);
});

router.delete("/tables/:id", async (req, res) => {
  const current = await findSiteTable(req, req.params.id);
  if (!current) return res.status(404).json({ message: "Table not found" });
  if (current.status === "occupied") {
    return res.status(400).json({ message: "Free this table before deleting it." });
  }
  await query(`UPDATE orders SET table_id=NULL WHERE table_id=$1`, [current.id]);
  await query(`DELETE FROM dining_tables WHERE id=$1`, [current.id]);
  res.json({ ok: true });
});

router.post("/print/receipt", async (req, res) => {
  const order = req.body?.order;
  if (!order?.order_no) return res.status(400).json({ message: "Order is required." });
  try {
    const result = await printReceiptOnWindows(order, {
      restaurantName: req.body?.restaurantName || req.user?.restaurant_name,
      organizationName: req.body?.organizationName,
      cashierName: req.body?.cashierName || req.user?.name,
      copy: req.body?.copy === "customer" ? "customer" : "restaurant",
    });
    audit(req, {
      action: "print_receipt",
      entity: "order",
      entityId: order.id,
      details: `#${order.order_no} ${req.body?.copy || "restaurant"} -> ${result.printer}`,
    });
    res.json({
      ok: true,
      printer: result.printer,
      copy: req.body?.copy === "customer" ? "customer" : "restaurant",
      message: `Printed ${req.body?.copy === "customer" ? "customer" : "restaurant"} copy on ${result.printer}`,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message || "Could not print to the POS printer.",
      code: err.code || "PRINT_FAILED",
    });
  }
});

router.get("/menu", async (req, res) => {
  const restaurantId = rid(req);
  const categories = await query(
    `SELECT * FROM menu_categories WHERE restaurant_id=$1 OR site_id=$1 ORDER BY sort_order, name`,
    [restaurantId]
  );
  const items = await query(
    `SELECT mi.*, mc.name AS category_name
     FROM menu_items mi LEFT JOIN menu_categories mc ON mc.id = mi.category_id
     WHERE mi.restaurant_id=$1 OR mi.site_id=$1
     ORDER BY mi.name`,
    [restaurantId]
  );
  res.json({ categories: categories.rows, items: items.rows });
});

router.post("/menu/categories", async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ message: "Category name is required." });
  const restaurantId = rid(req);
  const exists = await query(
    `SELECT id FROM menu_categories WHERE lower(name)=lower($1) AND restaurant_id=$2`,
    [name, restaurantId]
  );
  if (exists.rows[0]) return res.status(400).json({ message: "This category already exists." });
  const order = await query(
    `SELECT COALESCE(MAX(sort_order), 0)::int AS n FROM menu_categories WHERE restaurant_id=$1`,
    [restaurantId]
  );
  const result = await query(
    `INSERT INTO menu_categories (organization_id, site_id, restaurant_id, name, sort_order)
     VALUES ($1,$2,$2,$3,$4) RETURNING *`,
    [oid(req), restaurantId, name, (order.rows[0]?.n || 0) + 1]
  );
  audit(req, { action: "create_category", entity: "menu_category", entityId: result.rows[0].id, details: name });
  res.status(201).json(result.rows[0]);
});

router.patch("/menu/categories/:id", async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ message: "Category name is required." });
  const current = await query(`SELECT id FROM menu_categories WHERE id=$1`, [req.params.id]);
  if (!current.rows[0]) return res.status(404).json({ message: "Category not found" });
  const exists = await query(
    `SELECT id FROM menu_categories WHERE lower(name)=lower($1) AND id<>$2 AND restaurant_id=$3`,
    [name, req.params.id, rid(req)]
  );
  if (exists.rows[0]) return res.status(400).json({ message: "This category already exists." });
  const result = await query(`UPDATE menu_categories SET name=$1 WHERE id=$2 RETURNING *`, [name, req.params.id]);
  audit(req, { action: "update_category", entity: "menu_category", entityId: Number(req.params.id), details: name });
  res.json(result.rows[0]);
});

router.delete("/menu/categories/:id", async (req, res) => {
  const current = await query(`SELECT id FROM menu_categories WHERE id=$1`, [req.params.id]);
  if (!current.rows[0]) return res.status(404).json({ message: "Category not found" });
  await query(`UPDATE menu_items SET category_id=NULL WHERE category_id=$1`, [req.params.id]);
  await query(`DELETE FROM menu_categories WHERE id=$1`, [req.params.id]);
  audit(req, { action: "delete_category", entity: "menu_category", entityId: Number(req.params.id) });
  res.json({ ok: true });
});

router.post("/menu", async (req, res) => {
  if (!rid(req)) return res.status(400).json({ message: "Select a site first." });
  const { name, price, category_id, emoji, image_url } = req.body;
  const result = await query(
    `INSERT INTO menu_items (organization_id, site_id, restaurant_id, category_id, name, price, emoji, image_url)
     VALUES ($1,$2,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [oid(req), rid(req), category_id || null, name, price, emoji || "", image_url || null]
  );
  audit(req, { action: "create_menu_item", entity: "menu_item", entityId: result.rows[0].id, details: `${name} @ ${price}` });
  scheduleSync();
  res.status(201).json(result.rows[0]);
});

router.patch("/menu/:id", async (req, res) => {
  const { name, price, is_available, category_id, image_url } = req.body;
  const result = await query(
    `UPDATE menu_items SET
       name=COALESCE($1,name),
       price=COALESCE($2,price),
       is_available=COALESCE($3,is_available),
       category_id=COALESCE($4,category_id),
       image_url=COALESCE($5,image_url)
     WHERE id=$6 AND (restaurant_id=$7 OR site_id=$7) RETURNING *`,
    [name, price, is_available, category_id, image_url, req.params.id, rid(req)]
  );
  if (result.rows[0]) {
    audit(req, { action: "update_menu_item", entity: "menu_item", entityId: result.rows[0].id, details: result.rows[0].name });
    scheduleSync();
  }
  res.json(result.rows[0]);
});

router.post("/menu/:id/image", async (req, res) => {
  const current = await query(`SELECT id FROM menu_items WHERE id=$1 AND (restaurant_id=$2 OR site_id=$2)`, [
    req.params.id,
    rid(req),
  ]);
  if (!current.rows[0]) return res.status(404).json({ message: "Item not found" });
  let image_url;
  try {
    image_url = saveDataUrl(`menu-${req.params.id}`, req.body?.image_base64);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    throw err;
  }
  const result = await query(`UPDATE menu_items SET image_url=$1 WHERE id=$2 RETURNING *`, [image_url, current.rows[0].id]);
  scheduleSync();
  res.json(result.rows[0]);
});

router.delete("/menu/:id", async (req, res) => {
  const restaurantId = rid(req);
  const current = await query(`SELECT id FROM menu_items WHERE id=$1 AND (restaurant_id=$2 OR site_id=$2)`, [
    req.params.id,
    restaurantId,
  ]);
  if (!current.rows[0]) return res.status(404).json({ message: "Item not found" });
  await query(`UPDATE order_items SET menu_item_id=NULL WHERE menu_item_id=$1`, [req.params.id]);
  await query(`DELETE FROM menu_items WHERE id=$1 AND (restaurant_id=$2 OR site_id=$2)`, [req.params.id, restaurantId]);
  audit(req, { action: "delete_menu_item", entity: "menu_item", entityId: Number(req.params.id) });
  scheduleSync();
  res.json({ ok: true });
});

async function orderItemRows(orderIds) {
  const ids = [...new Set((orderIds || []).map((id) => Number(id)).filter((id) => id > 0))];
  if (!ids.length) return [];
  const marks = ids.map((_, index) => `$${index + 1}`).join(", ");
  return (await query(`SELECT * FROM order_items WHERE order_id IN (${marks})`, ids)).rows;
}

function menuItemId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get("/orders", async (req, res) => {
  if (!rid(req)) return res.json([]);
  const status = req.query.status;
  const params = [rid(req)];
  let sql = `SELECT o.*, t.label AS table_label
             FROM orders o LEFT JOIN dining_tables t ON t.id = o.table_id
             WHERE (o.restaurant_id=$1 OR o.site_id=$1)`;
  if (status) {
    params.push(status);
    sql += ` AND o.status=$${params.length}`;
  }
  sql += " ORDER BY o.created_at DESC LIMIT 200";
  const orders = await query(sql, params);
  const items = await orderItemRows(orders.rows.map((o) => o.id));
  res.json(
    orders.rows.map((o) => ({
      ...o,
      items: items.filter((i) => Number(i.order_id) === Number(o.id)),
    }))
  );
});

router.get("/orders/:id", async (req, res) => {
  const found = await query(
    `SELECT o.*, t.label AS table_label
     FROM orders o
     LEFT JOIN dining_tables t ON t.id = o.table_id
     WHERE o.id=$1 AND (o.restaurant_id=$2 OR o.site_id=$2)`,
    [req.params.id, rid(req)]
  );
  const order = found.rows[0];
  if (!order) return res.status(404).json({ message: "Order not found" });
  const items = await query(`SELECT * FROM order_items WHERE order_id=$1`, [order.id]);
  res.json({ ...order, items: items.rows });
});

router.get("/notifications", async (req, res) => {
  if (!rid(req)) return res.json({ items: [], counts: { pending: 0, confirmed: 0, cancelled: 0 } });
  const result = await query(
    `SELECT o.id, o.order_no, o.status, o.payment_status, o.total, o.created_at, o.updated_at,
            t.label AS table_label
     FROM orders o
     LEFT JOIN dining_tables t ON t.id = o.table_id
     WHERE (o.restaurant_id=$1 OR o.site_id=$1)
       AND o.created_at >= NOW() - INTERVAL '3 days'
     ORDER BY o.updated_at DESC
     LIMIT 50`,
    [rid(req)]
  );
  const items = result.rows.map((o) => {
    let kind = "pending";
    if (o.status === "cancelled" || o.status === "canceled") kind = "cancelled";
    else if (o.status === "ready" || o.status === "completed" || o.payment_status === "paid") kind = "confirmed";
    else kind = "pending";
    return { ...o, kind };
  });
  res.json({
    items,
    counts: {
      pending: items.filter((i) => i.kind === "pending").length,
      confirmed: items.filter((i) => i.kind === "confirmed").length,
      cancelled: items.filter((i) => i.kind === "cancelled").length,
    },
  });
});

router.post("/orders", async (req, res) => {
  const restaurantId = rid(req);
  if (!restaurantId) return res.status(400).json({ message: "Select a site first." });
  const { table_id, items = [], note, status = "new", client_ref: clientRef = null } = req.body;
  if (clientRef) {
    const existing = await query(
      `SELECT * FROM orders WHERE client_ref=$1 AND restaurant_id=$2`,
      [clientRef, restaurantId]
    );
    if (existing.rows[0]) {
      const existingItems = await query(`SELECT * FROM order_items WHERE order_id=$1`, [existing.rows[0].id]);
      return res.json({ ...existing.rows[0], items: existingItems.rows });
    }
  }
  const count = await query(`SELECT COUNT(*)::int AS c FROM orders WHERE restaurant_id=$1`, [restaurantId]);
  const orderNo = String(1000 + count.rows[0].c + 1);
  let subtotal = 0;
  const created = await query(
    `INSERT INTO orders (organization_id, site_id, restaurant_id, table_id, order_no, status, note, subtotal, tax, total, created_by, client_ref)
     VALUES ($1,$2,$2,$3,$4,$5,$6,0,0,0,$7,$8) RETURNING *`,
    [oid(req), restaurantId, table_id || null, orderNo, status, note || null, req.user.id, clientRef || null]
  );
  const orderId = created.rows[0].id;
  for (const item of items) {
    const price = Number(item.price);
    const qty = Number(item.qty || 1);
    subtotal += price * qty;
    const line = [oid(req), restaurantId, orderId, menuItemId(item.menu_item_id), item.name, qty, price];
    try {
      await query(
        `INSERT INTO order_items (organization_id, site_id, order_id, menu_item_id, name, qty, price)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        line
      );
    } catch (err) {
      const missingMenu = err?.errno === 1452 || err?.code === "ER_NO_REFERENCED_ROW_2";
      if (!missingMenu || line[3] == null) throw err;
      line[3] = null;
      await query(
        `INSERT INTO order_items (organization_id, site_id, order_id, menu_item_id, name, qty, price)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        line
      );
    }
  }
  const billed = withTax(subtotal);
  const updated = await query(`UPDATE orders SET subtotal=$1, tax=$2, total=$3 WHERE id=$4 RETURNING *`, [
    billed.subtotal,
    billed.tax,
    billed.total,
    orderId,
  ]);
  if (table_id) {
    await query(`UPDATE dining_tables SET status='occupied' WHERE id=$1`, [table_id]);
  }
  const lineItems = await query(`SELECT * FROM order_items WHERE order_id=$1`, [orderId]);
  scheduleSync();
  audit(req, {
    action: "create_order",
    entity: "order",
    entityId: orderId,
    restaurantId,
    details: `Order ${orderNo} total ${billed.total}`,
  });
  res.status(201).json({ ...updated.rows[0], items: lineItems.rows });
});

router.patch("/orders/:id", async (req, res) => {
  const siteId = rid(req);
  const { status, payment_method, payment_status, note } = req.body || {};
  if (!siteId) return res.status(400).json({ message: "Select a site first." });
  const owned = await query(
    `SELECT * FROM orders WHERE id=$1 AND (restaurant_id=$2 OR site_id=$2)`,
    [req.params.id, siteId]
  );
  if (!owned.rows[0]) return res.status(404).json({ message: "Order not found" });
  const orderId = owned.rows[0].id;
  const nextStatus = status ? String(status).toLowerCase() : null;
  const method = payment_status === "paid" ? "Cash" : payment_method ?? null;
  await query(
    `UPDATE orders SET
       status=COALESCE($1,status),
       payment_method=COALESCE($2,payment_method),
       payment_status=COALESCE($3,payment_status),
       note=COALESCE($4,note),
       updated_at=NOW()
     WHERE id=$5`,
    [nextStatus, method, payment_status ?? null, note ?? null, orderId]
  );
  const result = await query(`SELECT * FROM orders WHERE id=$1`, [orderId]);
  const order = result.rows[0];
  if (order && payment_status === "paid" && order.table_id) {
    await query(`UPDATE dining_tables SET status='cleaning' WHERE id=$1`, [order.table_id]);
  }
  if (order && (nextStatus === "cancelled" || nextStatus === "canceled") && order.table_id) {
    await query(`UPDATE dining_tables SET status='available' WHERE id=$1 AND status='occupied'`, [order.table_id]);
  }
  const items = await query(`SELECT * FROM order_items WHERE order_id=$1`, [req.params.id]);
  scheduleSync();
  if (order) {
    audit(req, {
      action: payment_status === "paid" ? "collect_payment" : "update_order",
      entity: "order",
      entityId: order.id,
      restaurantId: order.restaurant_id,
      details: `Order ${order.order_no} status=${order.status} payment=${order.payment_status}`,
    });
  }
  res.json({ ...order, items: items.rows });
});

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

async function paidOrderPayload(order) {
  const items = await query(`SELECT * FROM order_items WHERE order_id=$1`, [order.id]);
  const table = order.table_id
    ? await query(`SELECT label FROM dining_tables WHERE id=$1`, [order.table_id])
    : { rows: [] };
  return { ...order, items: items.rows, table_label: table.rows[0]?.label || null };
}

async function markOrderPaid(order, paymentMethod, extraNote) {
  const note = extraNote ? [order.note, extraNote].filter(Boolean).join(" · ") : order.note;
  const result = await query(
    `UPDATE orders SET
       payment_method=$1,
       payment_status='paid',
       status='completed',
       note=$2,
       updated_at=NOW()
     WHERE id=$3 RETURNING *`,
    ["Cash", note || null, order.id]
  );
  const paid = result.rows[0];
  if (paid?.table_id) {
    await query(`UPDATE dining_tables SET status='cleaning' WHERE id=$1`, [paid.table_id]);
  }
  scheduleSync();
  return paidOrderPayload(paid);
}

router.get("/payments/stripe/config", (_req, res) => {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || "";
  const secret = process.env.STRIPE_SECRET_KEY || "";
  res.json({
    configured: Boolean(publishableKey && secret),
    publishableKey,
    currency: (process.env.STRIPE_CURRENCY || "pkr").toLowerCase(),
  });
});

router.post("/payments/stripe/intent", async (req, res) => {
  try {
    const stripe = getStripe();
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || "";
    if (!stripe || !publishableKey) {
      return res.status(503).json({ message: "Stripe is not configured. Add STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY in server/.env." });
    }
    const orderId = Number(req.body.order_id);
    const found = await query(`SELECT * FROM orders WHERE id=$1 AND restaurant_id=$2`, [orderId, rid(req)]);
    const order = found.rows[0];
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.payment_status === "paid") return res.status(400).json({ message: "This order is already paid" });
    if (order.status === "cancelled" || order.status === "canceled") {
      return res.status(400).json({ message: "Cancelled orders cannot be charged" });
    }
    const raw = req.body.amount != null ? Number(req.body.amount) : Number(order.total || 0);
    const amount = Math.round(raw * 100);
    if (!Number.isFinite(amount) || amount < 50) {
      return res.status(400).json({ message: "Order total is too small for a card charge" });
    }
    const currency = (process.env.STRIPE_CURRENCY || "pkr").toLowerCase();
    const intent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method_types: ["card"],
      metadata: {
        order_id: String(order.id),
        order_no: String(order.order_no),
        restaurant_id: String(order.restaurant_id),
      },
      description: `TDCP RMS order #${order.order_no}`,
    });
    res.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id, amount, currency });
  } catch (err) {
    res.status(400).json({ message: err.message || "Could not start Stripe payment" });
  }
});

router.post("/payments/stripe/complete", async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) return res.status(503).json({ message: "Stripe is not configured" });
    const orderId = Number(req.body.order_id);
    const paymentIntentId = String(req.body.payment_intent_id || "");
    if (!paymentIntentId) return res.status(400).json({ message: "Missing payment intent" });
    const found = await query(`SELECT * FROM orders WHERE id=$1 AND restaurant_id=$2`, [orderId, rid(req)]);
    const order = found.rows[0];
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.payment_status === "paid") return res.json(await paidOrderPayload(order));
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== "succeeded") {
      return res.status(400).json({ message: `Card payment is ${intent.status}, not succeeded` });
    }
    if (String(intent.metadata?.order_id) !== String(order.id)) {
      return res.status(400).json({ message: "Stripe payment does not match this order" });
    }
    const paid = await markOrderPaid(order, "Card", `Stripe ${intent.id}`);
    res.json(paid);
  } catch (err) {
    res.status(400).json({ message: err.message || "Could not complete Stripe payment" });
  }
});

function personNameOk(value) {
  return /^[A-Za-z\u0600-\u06FF]+(?:[ '\-.][A-Za-z\u0600-\u06FF]+)*$/.test(String(value || "").trim());
}

function phoneOk(value) {
  return /^03\d{9}$/.test(String(value || "").replace(/\D/g, ""));
}

function cnicOk(value) {
  return /^\d{13}$/.test(String(value || "").replace(/\D/g, ""));
}

router.get("/customers", async (req, res) => {
  res.json(
    (
      await query(
        `SELECT * FROM customers WHERE restaurant_id=$1 ORDER BY visits DESC, name`,
        [rid(req)]
      )
    ).rows
  );
});
router.post("/customers", async (req, res) => {
  const { name, phone, cnic, visits, last_visit } = req.body || {};
  const trimmed = String(name || "").trim();
  if (!trimmed) return res.status(400).json({ message: "Customer name is required." });
  if (!personNameOk(trimmed)) return res.status(400).json({ message: "Name can only contain letters." });
  if (!phoneOk(phone)) return res.status(400).json({ message: "Phone must be 11 digits starting with 03." });
  if (!cnicOk(cnic)) return res.status(400).json({ message: "CNIC must be 13 digits." });
  const result = await query(
    `INSERT INTO customers (organization_id, site_id, restaurant_id, name, phone, cnic, visits, last_visit)
     VALUES ($1,$2,$2,$3,$4,$5,COALESCE($6,0),$7) RETURNING *`,
    [oid(req), rid(req), trimmed, phone || null, cnic || null, visits === "" || visits == null ? 0 : Number(visits), last_visit || null]
  );
  audit(req, { action: "create_customer", entity: "customer", entityId: result.rows[0].id, details: trimmed });
  res.status(201).json(result.rows[0]);
});
router.patch("/customers/:id", async (req, res) => {
  const { name, phone, cnic, visits, last_visit } = req.body || {};
  if (name != null && name.trim() && !personNameOk(name)) {
    return res.status(400).json({ message: "Name can only contain letters." });
  }
  if (phone != null && phone !== "" && !phoneOk(phone)) {
    return res.status(400).json({ message: "Phone must be 11 digits starting with 03." });
  }
  if (cnic != null && cnic !== "" && !cnicOk(cnic)) {
    return res.status(400).json({ message: "CNIC must be 13 digits." });
  }
  const result = await query(
    `UPDATE customers SET
       name=COALESCE($1,name),
       phone=COALESCE($2,phone),
       cnic=COALESCE($3,cnic),
       visits=COALESCE($4,visits),
       last_visit=COALESCE($5::timestamptz, last_visit)
     WHERE id=$6 AND restaurant_id=$7 RETURNING *`,
    [
      name?.trim() || null,
      phone ?? null,
      cnic ?? null,
      visits === "" || visits == null ? null : Number(visits),
      last_visit || null,
      req.params.id,
      rid(req),
    ]
  );
  if (!result.rows[0]) return res.status(404).json({ message: "Customer not found" });
  res.json(result.rows[0]);
});
router.delete("/customers/:id", async (req, res) => {
  const restaurantId = rid(req);
  const current = await query(`SELECT id FROM customers WHERE id=$1 AND restaurant_id=$2`, [
    req.params.id,
    restaurantId,
  ]);
  if (!current.rows[0]) return res.status(404).json({ message: "Customer not found" });
  await query(`UPDATE orders SET customer_id=NULL WHERE customer_id=$1`, [req.params.id]);
  await query(`DELETE FROM customers WHERE id=$1 AND restaurant_id=$2`, [req.params.id, restaurantId]);
  res.json({ ok: true });
});

function reportDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "";
}

function reportRange(query) {
  let from = reportDate(query.from);
  let to = reportDate(query.to);
  if (!from || !to) return { from: "", to: "" };
  if (from > to) [from, to] = [to, from];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const max = new Date(start);
  max.setDate(max.getDate() + 120);
  if (end > max) {
    const month = String(max.getMonth() + 1).padStart(2, "0");
    const day = String(max.getDate()).padStart(2, "0");
    to = `${max.getFullYear()}-${month}-${day}`;
  }
  return { from, to };
}

const EMPTY_CATS = ["Food", "Beverages", "Desserts", "Others"].map((name) => ({ name, amount: 0 }));

function emptyReport() {
  return {
    summary: { revenue: 0, orders: 0, avg_ticket: 0, customers: 0, revenueChange: 0, ordersChange: 0, ticketChange: 0, customersChange: 0 },
    periods: { week: 0, weekChange: 0, month: 0, monthChange: 0, year: 0, yearChange: 0 },
    trend: { 7: [], 14: [], 30: [], range: null },
    categories: { week: EMPTY_CATS, month: EMPTY_CATS, year: EMPTY_CATS, range: null },
  };
}

async function reportRestaurantIds(req) {
  const one = rid(req);
  if (one) return [Number(one)];
  if (isSuperAdmin(req.user)) {
    const rows = await query(`SELECT id FROM sites ORDER BY id`);
    return rows.rows.map((row) => Number(row.id));
  }
  const orgId = oid(req);
  if (!orgId) return [];
  const rows = await query(`SELECT id FROM sites WHERE organization_id=$1 ORDER BY id`, [orgId]);
  return rows.rows.map((row) => Number(row.id));
}

router.get("/reports", async (req, res) => {
  const ids = await reportRestaurantIds(req);
  if (!ids.length) return res.json(emptyReport());
  const { from, to } = reportRange(req.query);
  const restaurantId = ids;
  const pct = (now, prev) => (prev ? ((now - prev) / prev) * 100 : now ? 100 : 0);

  const today = await query(
    `SELECT COALESCE(SUM(total),0)::float AS revenue,
            COUNT(*) FILTER (WHERE payment_status='paid')::int AS orders,
            COALESCE(AVG(total) FILTER (WHERE payment_status='paid'),0)::float AS avg_ticket,
            COUNT(DISTINCT customer_id)::int AS customers
     FROM orders
     WHERE restaurant_id = ANY($1::int[]) AND payment_status='paid' AND created_at::date = CURRENT_DATE`,
    [restaurantId]
  );
  const yesterday = await query(
    `SELECT COALESCE(SUM(total),0)::float AS revenue,
            COUNT(*) FILTER (WHERE payment_status='paid')::int AS orders,
            COALESCE(AVG(total) FILTER (WHERE payment_status='paid'),0)::float AS avg_ticket,
            COUNT(DISTINCT customer_id)::int AS customers
     FROM orders
     WHERE restaurant_id = ANY($1::int[]) AND payment_status='paid' AND created_at::date = CURRENT_DATE - 1`,
    [restaurantId]
  );

  const week = await query(
    `SELECT COALESCE(SUM(total),0)::float AS sales FROM orders
     WHERE restaurant_id = ANY($1::int[]) AND payment_status='paid' AND created_at >= date_trunc('week', NOW())`,
    [restaurantId]
  );
  const lastWeek = await query(
    `SELECT COALESCE(SUM(total),0)::float AS sales FROM orders
     WHERE restaurant_id = ANY($1::int[]) AND payment_status='paid'
       AND created_at >= date_trunc('week', NOW()) - INTERVAL '1 week'
       AND created_at < date_trunc('week', NOW())`,
    [restaurantId]
  );
  const month = await query(
    `SELECT COALESCE(SUM(total),0)::float AS sales FROM orders
     WHERE restaurant_id = ANY($1::int[]) AND payment_status='paid' AND created_at >= date_trunc('month', NOW())`,
    [restaurantId]
  );
  const lastMonth = await query(
    `SELECT COALESCE(SUM(total),0)::float AS sales FROM orders
     WHERE restaurant_id = ANY($1::int[]) AND payment_status='paid'
       AND created_at >= date_trunc('month', NOW()) - INTERVAL '1 month'
       AND created_at < date_trunc('month', NOW())`,
    [restaurantId]
  );
  const year = await query(
    `SELECT COALESCE(SUM(total),0)::float AS sales FROM orders
     WHERE restaurant_id = ANY($1::int[]) AND payment_status='paid' AND created_at >= date_trunc('year', NOW())`,
    [restaurantId]
  );
  const lastYear = await query(
    `SELECT COALESCE(SUM(total),0)::float AS sales FROM orders
     WHERE restaurant_id = ANY($1::int[]) AND payment_status='paid'
       AND created_at >= date_trunc('year', NOW()) - INTERVAL '1 year'
       AND created_at < date_trunc('year', NOW())`,
    [restaurantId]
  );

  async function trendDays(days, ranged = false) {
    const result = await query(
      `SELECT to_char(d::date, 'Mon DD') AS day,
              d::date::text AS date,
              COALESCE(SUM(o.total),0)::float AS sales
       FROM generate_series(CURRENT_DATE - ($2::int - 1), CURRENT_DATE, interval '1 day') d
       LEFT JOIN orders o
         ON o.created_at::date = d::date
        AND o.restaurant_id = ANY($1::int[])
        AND o.payment_status = 'paid'
       GROUP BY d
       ORDER BY d`,
      ranged && from && to ? [restaurantId, days, from, to] : [restaurantId, days]
    );
    return result.rows;
  }

  async function categorySales(intervalSql, extra = []) {
    const result = await query(
      `SELECT bucket AS name, COALESCE(SUM(amount),0)::float AS amount
       FROM (
         SELECT CASE
                  WHEN mc.name ILIKE 'beverage%' THEN 'Beverages'
                  WHEN mc.name ILIKE 'dessert%' THEN 'Desserts'
                  WHEN mc.name IS NULL OR mc.name ILIKE 'all' OR mc.name ILIKE 'other%' THEN 'Others'
                  ELSE 'Food'
                END AS bucket,
                oi.qty * oi.price AS amount
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
         LEFT JOIN menu_categories mc ON mc.id = mi.category_id
         WHERE o.restaurant_id = ANY($1::int[]) AND o.payment_status='paid' AND ${intervalSql}
       ) x
       GROUP BY bucket`,
      [restaurantId, ...extra]
    );
    const order = ["Food", "Beverages", "Desserts", "Others"];
    const map = Object.fromEntries(result.rows.map((r) => [r.name, Number(r.amount) || 0]));
    return order.map((name) => ({ name, amount: map[name] || 0 }));
  }

  const t = today.rows[0];
  const y = yesterday.rows[0];
  const [trend7, trend14, trend30, trendRange, catWeek, catMonth, catYear, catRangeRows] = await Promise.all([
    trendDays(7),
    trendDays(14),
    trendDays(30),
    from && to ? trendDays(7, true) : Promise.resolve(null),
    categorySales("o.created_at >= date_trunc('week', NOW())"),
    categorySales("o.created_at >= date_trunc('month', NOW())"),
    categorySales("o.created_at >= date_trunc('year', NOW())"),
    from && to
      ? categorySales("o.created_at::date >= $2 AND o.created_at::date <= $3", [from, to])
      : Promise.resolve(null),
  ]);

  res.json({
    summary: {
      revenue: t.revenue,
      orders: t.orders,
      avg_ticket: t.avg_ticket,
      customers: t.customers,
      revenueChange: pct(t.revenue, y.revenue),
      ordersChange: pct(t.orders, y.orders),
      ticketChange: pct(t.avg_ticket, y.avg_ticket),
      customersChange: pct(t.customers, y.customers),
    },
    periods: {
      week: week.rows[0].sales,
      weekChange: pct(week.rows[0].sales, lastWeek.rows[0].sales),
      month: month.rows[0].sales,
      monthChange: pct(month.rows[0].sales, lastMonth.rows[0].sales),
      year: year.rows[0].sales,
      yearChange: pct(year.rows[0].sales, lastYear.rows[0].sales),
    },
    trend: { 7: trend7, 14: trend14, 30: trend30, range: trendRange },
    categories: { week: catWeek, month: catMonth, year: catYear, range: catRangeRows },
  });
});

async function restaurantView(id) {
  return (await query(`SELECT * FROM restaurants WHERE id=$1`, [id])).rows[0];
}

function canManageSites(user) {
  return isSuperAdmin(user) || isOrgAdmin(user);
}

router.get("/restaurants", requireRole("admin", "super_admin", "org_admin"), async (req, res) => {
  if (isOrgAdmin(req.user) && !isSuperAdmin(req.user)) {
    return res.json(
      (
        await query(`SELECT * FROM restaurants WHERE organization_id=$1 ORDER BY id`, [
          req.user.organization_id,
        ])
      ).rows
    );
  }
  res.json((await query(`SELECT * FROM restaurants ORDER BY id`)).rows);
});

router.post("/restaurants", requireRole("admin", "super_admin", "org_admin"), async (req, res) => {
  if (!canManageSites(req.user)) return res.status(403).json({ message: "Insufficient permissions" });
  const name = String(req.body.name || "").trim();
  const location = String(req.body.location || "").trim();
  if (!name) return res.status(400).json({ message: "Restaurant name is required." });
  let orgId = Number(req.body.organization_id || req.user.organization_id);
  if (isOrgAdmin(req.user) && !isSuperAdmin(req.user)) orgId = Number(req.user.organization_id);
  if (!orgId) return res.status(400).json({ message: "Select an organization for this site." });
  const code = String(req.body.site_code || name)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  const existing = await query(`SELECT id FROM sites WHERE organization_id=$1 AND upper(code)=$2`, [orgId, code]);
  if (existing.rows[0]) return res.status(409).json({ message: "That site already exists." });
  const created = await query(
    `INSERT INTO sites (organization_id, code, name, address, image_url) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [orgId, code, name, location || null, req.body.image_url || null]
  );
  const row = await restaurantView(created.rows[0].id);
  audit(req, {
    action: "create_resort",
    entity: "restaurant",
    entityId: row.id,
    restaurantId: row.id,
    restaurantName: row.name,
    details: location,
  });
  res.status(201).json(row);
});

router.patch("/restaurants/:id", requireRole("admin", "super_admin", "org_admin"), async (req, res) => {
  const current = (await query(`SELECT * FROM sites WHERE id=$1`, [req.params.id])).rows[0];
  if (!current) return res.status(404).json({ message: "Restaurant not found" });
  if (isOrgAdmin(req.user) && !isSuperAdmin(req.user) && Number(current.organization_id) !== Number(req.user.organization_id)) {
    return res.status(403).json({ message: "That site is not in your organization." });
  }
  const { name, location, status, image_url } = req.body || {};
  const nextActive = status === "open" ? true : status === "closed" ? false : null;
  await query(
    `UPDATE sites SET
       name=COALESCE($1,name),
       address=COALESCE($2,address),
       is_active=COALESCE($3,is_active),
       image_url=CASE WHEN $5::boolean THEN $6 ELSE image_url END,
       updated_at=NOW()
     WHERE id=$4`,
    [
      name || null,
      location || null,
      nextActive,
      req.params.id,
      Object.prototype.hasOwnProperty.call(req.body || {}, "image_url"),
      image_url ? String(image_url).trim() : null,
    ]
  );
  const row = await restaurantView(req.params.id);
  audit(req, {
    action: status === "closed" ? "resort_closed" : status === "open" ? "resort_open" : "update_resort",
    entity: "restaurant",
    entityId: row.id,
    restaurantId: row.id,
    restaurantName: row.name,
    details: row.status,
  });
  res.json(row);
});

router.post("/restaurants/:id/image", requireRole("admin", "super_admin", "org_admin"), async (req, res) => {
  const site = (await query(`SELECT * FROM sites WHERE id=$1`, [req.params.id])).rows[0];
  if (!site) return res.status(404).json({ message: "Restaurant not found" });
  if (isOrgAdmin(req.user) && !isSuperAdmin(req.user) && Number(site.organization_id) !== Number(req.user.organization_id)) {
    return res.status(403).json({ message: "That site is not in your organization." });
  }
  let image_url;
  try {
    image_url = saveDataUrl(`resort-${req.params.id}`, req.body?.image_base64);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    throw err;
  }
  await query(`UPDATE sites SET image_url=$1, updated_at=NOW() WHERE id=$2`, [image_url, req.params.id]);
  const row = await restaurantView(req.params.id);
  if (!row) return res.status(404).json({ message: "Restaurant not found" });
  res.json(row);
});

router.delete("/restaurants/:id", requireRole("admin", "super_admin", "org_admin"), async (req, res) => {
  const current = (await query(`SELECT * FROM sites WHERE id=$1`, [req.params.id])).rows[0];
  if (!current) return res.status(404).json({ message: "Restaurant not found" });
  const tdcpId = await tdcpOrganizationId();
  if (!canDeleteTdcpSite(req.user, current, tdcpId)) {
    return res.status(403).json({ message: "Only the TDCP admin can delete a TDCP site." });
  }
  await removeSite(current.id);
  audit(req, {
    action: "delete_site",
    entity: "site",
    entityId: current.id,
    restaurantId: null,
    restaurantName: current.name,
    details: current.code,
  });
  res.json({ ok: true });
});

export default router;
