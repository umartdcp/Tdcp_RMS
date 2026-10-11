import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Building2,
  CalendarDays,
  ChartColumn,
  ChefHat,
  CircleCheck,
  Clock,
  CreditCard,
  Users,
} from "lucide-react";
import api from "../api";
import { formatPKR, pctLabel } from "../lib/format";
import { menuPhoto } from "../lib/menuPhotos";
import { useTheme } from "../context/ThemeContext";
import { useNotifications } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import { canAccessPath, isMainAdmin, isOrgAdmin } from "../modules/roles";
import { isTdcpOrg } from "../lib/orgBranding";
import ResortOverviewTable from "../modules/hq/ResortOverviewTable";
import { KitchenHero, KitchenStats } from "../components/KitchenBoard";
import TdcpHqDashboard from "../components/TdcpHqDashboard";

const PAY_COLORS = {
  Cash: "#0c553c",
  Card: "#2fa87a",
  POS: "#aadfca",
  Other: "#6fc7a6",
};

const cardStyle = {
  background: "var(--surface)",
  borderColor: "var(--surface-border)",
  color: "var(--app-text)",
};

function fillHours(rows) {
  const map = Object.fromEntries((rows || []).map((r) => [r.hour, Number(r.sales) || 0]));
  const out = [];
  for (let h = 10; h <= 22; h += 1) {
    const hour = `${String(h).padStart(2, "0")}:00`;
    out.push({ hour, sales: map[hour] ?? 0 });
  }
  return out.some((r) => r.sales) ? out : rows?.length ? rows : out;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [salesRange, setSalesRange] = useState("today");
  const [payRange, setPayRange] = useState("month");
  const { isDark } = useTheme();
  const notify = useNotifications();
  const { user, organization, activeRestaurantId } = useAuth();
  const tickFill = isDark ? "#aadfca" : "#64748b";

  useEffect(() => {
    if (isOrgAdmin(user) && isTdcpOrg(organization)) return undefined;
    let alive = true;
    function load() {
      api.get("/dashboard").then((res) => {
        if (alive) setData(res.data);
      });
    }
    load();
    const timer = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [activeRestaurantId, user, organization]);

  const todaySeries = useMemo(() => fillHours(data?.salesSeries), [data]);
  const chartSeries = salesRange === "week" ? data?.weekSeries || [] : todaySeries;
  const payRows = payRange === "month" ? data?.paymentMethodsMonth || data?.paymentMethods : data?.paymentMethods;
  const payTotal = (payRows || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  const topPay = [...(payRows || [])].sort((a, b) => Number(b.amount) - Number(a.amount))[0];
  const highs = (chartSeries || []).map((r) => Number(r.sales) || 0);
  const highest = highs.length ? Math.max(...highs) : 0;
  const positive = highs.filter((n) => n > 0);
  const lowest = positive.length ? Math.min(...positive) : 0;

  if (isOrgAdmin(user) && isTdcpOrg(organization)) {
    return <TdcpHqDashboard />;
  }

  const kpis = data?.kpis || {};
  const paid = Number(kpis.todayOrders) || 0;
  const pending = Number(notify?.counts?.pending ?? kpis.pendingKitchen) || 0;
  const closed = paid + pending;
  const serviceRate = closed ? Math.round((paid / closed) * 100) : 0;

  return (
    <div className="space-y-4">
      <KitchenHero badgeValue={pending} badgeLabel="TICKETS" />
      <KitchenStats
        items={[
          { label: "TODAY", value: paid, icon: Clock, tone: "blue" },
          { label: "IN THE KITCHEN", value: pending, icon: ChefHat, tone: "orange" },
          { label: "THIS WEEK", value: formatPKR(kpis.weekSales || 0), icon: CircleCheck, tone: "green" },
          { label: "Service rate", ring: serviceRate, detail: `${paid} of ${closed} tickets paid` },
        ]}
      />
      {isMainAdmin(user) || isOrgAdmin(user) ? <ResortOverviewTable /> : null}

      {!data ? (
        <div className="p-4 text-sm" style={{ color: "var(--app-muted)" }}>
          Loading kitchen numbers…
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-3xl border p-5 shadow-sm" style={cardStyle}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Sales Overview</h3>
            <select
              value={salesRange}
              onChange={(e) => setSalesRange(e.target.value)}
              className="rounded-full border bg-tdcp-50 px-3 py-1 text-xs font-medium text-tdcp-800 outline-none"
              style={{ borderColor: "var(--surface-border)" }}
            >
              <option value="today">Today</option>
              <option value="week">This week</option>
            </select>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16845c" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#16845c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: tickFill }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: tickFill }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
                />
                <Tooltip formatter={(v) => formatPKR(v)} />
                <Area type="monotone" dataKey="sales" stroke="#0f6b4a" fill="url(#salesFill)" strokeWidth={2.5} dot={{ r: 3, fill: "#0f6b4a" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-6 border-t pt-3 text-sm" style={{ borderColor: "var(--surface-border)" }}>
            <div>
              <p className="text-xs" style={{ color: "var(--app-muted)" }}>
                Total Sales
              </p>
              <p className="font-bold">{formatPKR(salesRange === "week" ? kpis.weekSales : kpis.todaySales)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--app-muted)" }}>
                Highest
              </p>
              <p className="font-bold text-tdcp-600">{formatPKR(highest)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--app-muted)" }}>
                Lowest
              </p>
              <p className="font-bold text-rose-500">{formatPKR(lowest)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border p-5 shadow-sm" style={cardStyle}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Top Selling Items</h3>
            {canAccessPath(user, "/menu") ? (
              <Link to="/menu" className="text-xs font-medium text-tdcp-600 hover:underline">
                View All
              </Link>
            ) : null}
          </div>
          <div className="space-y-3">
            {(data?.topItems || []).map((item, i) => (
              <div key={item.name} className="flex items-center gap-3">
                <span className="w-4 text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                  {i + 1}
                </span>
                <img src={menuPhoto(item)} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-tdcp-50" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
                <span className="text-xs" style={{ color: "var(--app-muted)" }}>
                  {item.sold} Orders
                </span>
              </div>
            ))}
            {!data?.topItems?.length ? (
              <p className="text-sm" style={{ color: "var(--app-muted)" }}>
                No sales yet today.
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border p-5 shadow-sm" style={cardStyle}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">Sales by Payment Method</h3>
            <select
              value={payRange}
              onChange={(e) => setPayRange(e.target.value)}
              className="rounded-full border bg-tdcp-50 px-3 py-1 text-xs font-medium text-tdcp-800 outline-none"
              style={{ borderColor: "var(--surface-border)" }}
            >
              <option value="month">This Month</option>
              <option value="today">Today</option>
            </select>
          </div>
          <div className="relative h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={payRows?.length ? payRows : [{ method: "None", amount: 1 }]}
                  dataKey="amount"
                  nameKey="method"
                  innerRadius={54}
                  outerRadius={74}
                  paddingAngle={2}
                  stroke="none"
                >
                  {(payRows?.length ? payRows : [{ method: "None" }]).map((m) => (
                    <Cell key={m.method} fill={PAY_COLORS[m.method] || PAY_COLORS.Other} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatPKR(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="text-[11px]" style={{ color: "var(--app-muted)" }}>
                  Total Sales
                </p>
                <p className="text-sm font-bold">{formatPKR(payTotal)}</p>
              </div>
            </div>
          </div>
          <div className="space-y-2 text-xs">
            {[...(payRows || [])]
              .sort((a, b) => ["Cash", "Card", "POS"].indexOf(a.method) - ["Cash", "Card", "POS"].indexOf(b.method))
              .map((m) => {
              const pct = payTotal ? ((m.amount / payTotal) * 100).toFixed(1) : "0.0";
              return (
                <div key={m.method} className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: PAY_COLORS[m.method] || PAY_COLORS.Other }} />
                    {m.method}
                  </span>
                  <span className="font-medium">{formatPKR(m.amount)}</span>
                  <span className="w-12 text-right" style={{ color: "var(--app-muted)" }}>
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
          {topPay ? (
            <div className="mt-3 flex items-start gap-2 rounded-2xl px-3 py-2.5 text-xs text-tdcp-800" style={{ background: "color-mix(in srgb, #2fa87a 18%, var(--surface))" }}>
              <CreditCard size={14} className="mt-0.5 shrink-0" />
              <span>
                <strong className="capitalize">{topPay.method}</strong> payments are the highest
                {payTotal ? ` · ${((topPay.amount / payTotal) * 100).toFixed(1)}% of total sales` : ""}.
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Mini
          icon={ChartColumn}
          label="Week Revenue (MTD)"
          value={formatPKR(kpis.weekSales)}
          sub={pctLabel(kpis.weekChange).replace("yesterday", "last week")}
          up={kpis.weekChange >= 0}
        />
        <Mini
          icon={CalendarDays}
          label="Month Revenue (MTD)"
          value={formatPKR(kpis.monthSales)}
          sub={pctLabel(kpis.monthChange).replace("yesterday", "last month")}
          up={kpis.monthChange >= 0}
        />
        <Mini icon={Users} label="Active Today" value={`${kpis.activeStaff} / ${kpis.staffCapacity}`} sub="Staff on duty" />
        <Mini icon={Building2} label="Restaurant" value={data?.restaurant?.name || "TDCP"} sub={data?.restaurant?.location} />
      </div>
    </div>
  );
}

function Mini({ icon: Icon, label, value, sub, up }) {
  return (
    <div className="flex items-center gap-4 rounded-3xl border p-5 shadow-sm" style={cardStyle}>
      <span className="dash-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-tdcp-50 text-tdcp-600">
        <Icon size={22} />
      </span>
      <div className="min-w-0">
        <p className="text-sm" style={{ color: "var(--app-muted)" }}>
          {label}
        </p>
        <p className="mt-1 truncate text-lg font-extrabold">{value}</p>
        <p className={`mt-0.5 text-xs font-medium ${up === false ? "text-rose-500" : "text-emerald-600"}`}>{sub}</p>
      </div>
    </div>
  );
}
