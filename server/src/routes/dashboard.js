import { Router } from "express";
import { query } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { isOrgAdmin, isSuperAdmin } from "../modules/roles.js";
import { attachTenant, rid } from "../tenant.js";

const router = Router();
router.use(authRequired);
router.use(attachTenant);

function emptyDashboard() {
  return {
      restaurant: null,
      kpis: {
        todaySales: 0,
        todayOrders: 0,
        avgTicket: 0,
        pendingKitchen: 0,
        salesChange: 0,
        ordersChange: 0,
        ticketChange: 0,
        weekSales: 0,
        weekChange: 0,
        monthSales: 0,
        monthChange: 0,
        activeStaff: 0,
        staffCapacity: 60,
      },
      salesSeries: [],
      weekSeries: [],
      topItems: [],
      paymentMethods: [],
      paymentMethodsMonth: [],
      coverage: { sites: 0, active: 0 },
    };
}

router.get("/", async (req, res) => {
  const pinned = rid(req);
  const hq = String(req.query.hq || "") === "1" && isOrgAdmin(req.user) && !isSuperAdmin(req.user);
  let siteId = pinned;
  if (!siteId || hq) {
    const orgId = req.user.organization_id;
    if (!orgId || !(isOrgAdmin(req.user) || isSuperAdmin(req.user))) {
      return res.json(emptyDashboard());
    }
    const found = await query(`SELECT id FROM sites WHERE organization_id=$1`, [orgId]);
    const ids = found.rows.map((row) => Number(row.id)).filter((id) => id > 0);
    siteId = ids.length ? ids : [-1];
  }
  const today = await query(
    `SELECT COALESCE(SUM(total),0)::float AS sales, COUNT(*)::int AS orders,
            COALESCE(AVG(total),0)::float AS avg_ticket
     FROM orders
     WHERE restaurant_id = ANY($1::int[]) AND payment_status='paid' AND created_at::date = CURRENT_DATE`,
    [siteId]
  );
  const yesterday = await query(
    `SELECT COALESCE(SUM(total),0)::float AS sales, COUNT(*)::int AS orders
     FROM orders
     WHERE restaurant_id = ANY($1::int[]) AND payment_status='paid' AND created_at::date = CURRENT_DATE - 1`,
    [siteId]
  );
  const pending = await query(
    `SELECT COUNT(*)::int AS c FROM orders WHERE restaurant_id = ANY($1::int[]) AND status IN ('new','preparing')`,
    [siteId]
  );
  const week = await query(
    `SELECT COALESCE(SUM(total),0)::float AS sales FROM orders
     WHERE restaurant_id = ANY($1::int[]) AND payment_status='paid' AND created_at >= NOW() - INTERVAL '7 days'`,
    [siteId]
  );
  const lastWeek = await query(
    `SELECT COALESCE(SUM(total),0)::float AS sales FROM orders
     WHERE restaurant_id = ANY($1::int[]) AND payment_status='paid'
       AND created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days'`,
    [siteId]
  );
  const month = await query(
    `SELECT COALESCE(SUM(total),0)::float AS sales FROM orders
     WHERE restaurant_id = ANY($1::int[]) AND payment_status='paid' AND created_at >= date_trunc('month', NOW())`,
    [siteId]
  );
  const lastMonth = await query(
    `SELECT COALESCE(SUM(total),0)::float AS sales FROM orders
     WHERE restaurant_id = ANY($1::int[]) AND payment_status='paid'
       AND created_at >= date_trunc('month', NOW()) - INTERVAL '1 month'
       AND created_at < date_trunc('month', NOW())`,
    [siteId]
  );
  const salesSeries = await query(
    `SELECT to_char(created_at, 'HH24:00') AS hour, COALESCE(SUM(total),0)::float AS sales
     FROM orders
     WHERE restaurant_id = ANY($1::int[]) AND payment_status='paid' AND created_at::date = CURRENT_DATE
     GROUP BY DATE_FORMAT(created_at, '%H:00') ORDER BY DATE_FORMAT(created_at, '%H:00')`,
    [siteId]
  );
  const weekSeries = await query(
    `SELECT to_char(date_trunc('day', created_at), 'Mon DD') AS hour,
            date_trunc('day', created_at) AS day,
            COALESCE(SUM(total),0)::float AS sales
     FROM orders
     WHERE restaurant_id = ANY($1::int[]) AND payment_status='paid' AND created_at >= NOW() - INTERVAL '7 days'
     GROUP BY date_trunc('day', created_at), to_char(date_trunc('day', created_at), 'Mon DD')
     ORDER BY date_trunc('day', created_at)`,
    [siteId]
  );
  const topItems = await query(
    `SELECT oi.name, SUM(oi.qty)::int AS sold,
            MAX(m.emoji) AS emoji, MAX(m.image_url) AS image_url
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN menu_items m ON m.name = oi.name AND m.restaurant_id = o.restaurant_id
     WHERE o.restaurant_id = ANY($1::int[]) AND o.created_at::date = CURRENT_DATE
     GROUP BY oi.name ORDER BY sold DESC LIMIT 5`,
    [siteId]
  );
  const methodsToday = await query(
    `SELECT COALESCE(payment_method,'Other') AS method, COUNT(*)::int AS count, COALESCE(SUM(total),0)::float AS amount
     FROM orders
     WHERE restaurant_id = ANY($1::int[]) AND payment_status='paid' AND created_at::date = CURRENT_DATE
     GROUP BY COALESCE(payment_method,'Other')`,
    [siteId]
  );
  const methodsMonth = await query(
    `SELECT COALESCE(payment_method,'Other') AS method, COUNT(*)::int AS count, COALESCE(SUM(total),0)::float AS amount
     FROM orders
     WHERE restaurant_id = ANY($1::int[]) AND payment_status='paid' AND created_at >= date_trunc('month', NOW())
     GROUP BY COALESCE(payment_method,'Other')`,
    [siteId]
  );
  const staff = await query(
    `SELECT COUNT(*)::int AS c FROM users WHERE restaurant_id = ANY($1::int[]) OR site_id = ANY($1::int[])`,
    [siteId]
  );
  const restaurant = Array.isArray(siteId)
    ? { rows: [null] }
    : await query(`SELECT * FROM restaurants WHERE id=$1`, [siteId]);
  const orgId = req.user.organization_id;
  const sites = orgId
    ? await query(
        `SELECT COUNT(*)::int AS total,
                COALESCE(SUM(CASE WHEN is_active THEN 1 ELSE 0 END),0)::int AS active
         FROM sites WHERE organization_id=$1`,
        [orgId]
      )
    : { rows: [{ total: Array.isArray(siteId) ? siteId.length : 1, active: 1 }] };
  const todayRow = today.rows[0];
  const yRow = yesterday.rows[0];
  const pct = (now, prev) => (prev ? ((now - prev) / prev) * 100 : 0);

  res.json({
    restaurant: restaurant.rows[0],
    kpis: {
      todaySales: todayRow.sales,
      todayOrders: todayRow.orders,
      avgTicket: todayRow.avg_ticket,
      pendingKitchen: pending.rows[0].c,
      salesChange: pct(todayRow.sales, yRow.sales),
      ordersChange: pct(todayRow.orders, yRow.orders),
      ticketChange: 0,
      weekSales: week.rows[0].sales,
      weekChange: pct(week.rows[0].sales, lastWeek.rows[0].sales),
      monthSales: month.rows[0].sales,
      monthChange: pct(month.rows[0].sales, lastMonth.rows[0].sales),
      activeStaff: staff.rows[0].c,
      staffCapacity: 60,
    },
    salesSeries: salesSeries.rows,
    weekSeries: weekSeries.rows.map(({ hour, sales }) => ({ hour, sales })),
    topItems: topItems.rows,
    paymentMethods: methodsToday.rows,
    paymentMethodsMonth: methodsMonth.rows,
    coverage: {
      sites: Number(sites.rows[0]?.total) || 0,
      active: Number(sites.rows[0]?.active) || 0,
    },
  });
});

router.get("/overview", async (req, res) => {
  if (!isSuperAdmin(req.user) && !isOrgAdmin(req.user)) {
    return res.status(403).json({ message: "Admin only" });
  }
  const params = [];
  let sql = `SELECT * FROM restaurants WHERE 1=1`;
  if (isOrgAdmin(req.user) && !isSuperAdmin(req.user)) {
    params.push(req.user.organization_id);
    sql += ` AND organization_id=$1`;
  }
  sql += " ORDER BY id";
  const restaurants = await query(sql, params);
  const stats = [];
  for (const r of restaurants.rows) {
    const row = await query(
      `SELECT COALESCE(SUM(total),0)::float AS sales, COUNT(*)::int AS orders
       FROM orders WHERE restaurant_id = ANY($1::int[]) AND payment_status='paid' AND created_at::date = CURRENT_DATE`,
      [r.id]
    );
    const month = await query(
      `SELECT COALESCE(SUM(total),0)::float AS sales
       FROM orders WHERE restaurant_id = ANY($1::int[]) AND payment_status='paid' AND created_at >= date_trunc('month', NOW())`,
      [r.id]
    );
    const staff = await query(`SELECT COUNT(*)::int AS c FROM users WHERE restaurant_id = ANY($1::int[]) OR site_id=$1`, [r.id]);
    stats.push({
      ...r,
      today_sales: row.rows[0].sales,
      today_orders: row.rows[0].orders,
      month_sales: month.rows[0].sales,
      user_count: staff.rows[0].c,
    });
  }
  res.json({ restaurants: stats });
});

export default router;
