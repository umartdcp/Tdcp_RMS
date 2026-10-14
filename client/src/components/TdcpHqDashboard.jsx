import { useEffect, useMemo, useState } from "react";
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
import { ChartColumn, ChefHat, CircleCheck, CreditCard, MapPin, Utensils } from "lucide-react";
import api from "../api";
import { formatPKR } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import ResortOverviewTable from "../modules/hq/ResortOverviewTable";

const PAY_META = [
  { key: "Cash", color: "#1aa6a6" },
  { key: "Card", color: "#3dce7a" },
  { key: "Online", color: "#f5b942" },
  { key: "Others", color: "#c5ced6" },
];

function dayPart(date) {
  const hour = date.getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function fillHours(rows) {
  const map = Object.fromEntries((rows || []).map((r) => [r.hour, Number(r.sales) || 0]));
  const out = [];
  for (let h = 10; h <= 22; h += 1) {
    const hour = `${String(h).padStart(2, "0")}:00`;
    out.push({ hour, sales: map[hour] ?? 0 });
  }
  return out;
}

function payBucket(method) {
  const name = String(method || "").toLowerCase();
  if (name === "cash") return "Cash";
  if (name === "card") return "Card";
  if (name === "pos" || name === "online" || name === "upi") return "Online";
  return "Others";
}

function RateRing({ percent }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.max(0, Math.min(100, percent)) / 100) * circumference;
  return (
    <svg width="78" height="78" viewBox="0 0 78 78" aria-hidden="true">
      <circle cx="39" cy="39" r={radius} fill="none" stroke="#e6f4ec" strokeWidth="8" />
      <circle
        cx="39"
        cy="39"
        r={radius}
        fill="none"
        stroke="#0e4a34"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference - filled}`}
        transform="rotate(-90 39 39)"
      />
      <text x="39" y="44" textAnchor="middle" fontSize="14" fontWeight="800" fill="#16324a">
        {Math.round(percent)}%
      </text>
    </svg>
  );
}

function StatCard({ icon: Icon, label, value, detail, faint: Faint }) {
  return (
    <div className="relative overflow-hidden rounded-[22px] bg-white px-4 py-4 shadow-sm">
      {Faint ? <Faint size={54} className="pointer-events-none absolute -right-1 bottom-1 text-[#d7efe4]" /> : null}
      <div className="relative flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#e7f7ee] text-[#16845c]">
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[0.16em] text-slate-400">{label}</p>
          <p className="truncate text-2xl font-extrabold tracking-tight text-[#16324a]">{value}</p>
          {detail ? <p className="text-xs font-medium text-slate-400">{detail}</p> : null}
        </div>
      </div>
    </div>
  );
}

export default function TdcpHqDashboard({ hq = true }) {
  const { organization, site, activeRestaurant, user } = useAuth();
  const [data, setData] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [salesRange, setSalesRange] = useState("today");
  const [payRange, setPayRange] = useState("month");
  const siteName = activeRestaurant?.name || site?.name || user?.restaurant_name || user?.site_name;
  const orgName = hq ? organization?.code || "TDCP" : siteName || organization?.code || "TDCP";

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;
    function load() {
      api.get("/dashboard", { params: hq ? { hq: 1 } : {} }).then((res) => {
        if (alive) setData(res.data);
      });
    }
    load();
    const timer = setInterval(load, 15000);
    window.addEventListener("tdcp-data-synced", load);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("tdcp-data-synced", load);
    };
  }, [hq]);

  const todaySeries = useMemo(() => fillHours(data?.salesSeries), [data]);
  const chartSeries = salesRange === "week" ? data?.weekSeries || [] : todaySeries;
  const rawPay = payRange === "month" ? data?.paymentMethodsMonth || data?.paymentMethods : data?.paymentMethods;
  const payRows = PAY_META.map((meta) => ({
    ...meta,
    amount: (rawPay || [])
      .filter((row) => payBucket(row.method) === meta.key)
      .reduce((sum, row) => sum + Number(row.amount || 0), 0),
  }));
  const payTotal = payRows.reduce((sum, row) => sum + row.amount, 0);
  const highs = (chartSeries || []).map((row) => Number(row.sales) || 0);
  const highest = highs.length ? Math.max(...highs) : 0;
  const positive = highs.filter((n) => n > 0);
  const lowest = positive.length ? Math.min(...positive) : 0;
  const kpis = data?.kpis || {};
  const sites = Number(data?.coverage?.sites) || 0;
  const active = Number(data?.coverage?.active) || 0;
  const serviceRate = hq
    ? sites
      ? Math.round((active / sites) * 100)
      : 0
    : Number(kpis.todayOrders) + Number(kpis.pendingKitchen)
      ? Math.round((Number(kpis.todayOrders) / (Number(kpis.todayOrders) + Number(kpis.pendingKitchen))) * 100)
      : 0;
  const salesTotal = salesRange === "week" ? kpis.weekSales : kpis.todaySales;
  const pill =
    "rounded-full border border-[#d7efe4] bg-[#e7f7ee] px-3 py-1 text-xs font-semibold text-[#0e4a34] outline-none";

  return (
    <div className="space-y-4">
      <section
        className="relative overflow-hidden rounded-[28px] bg-[#0e4a34] bg-cover bg-center px-6 py-7 text-white shadow-sm sm:px-8"
        style={{ backgroundImage: "linear-gradient(90deg, rgba(8,32,24,0.45), rgba(8,32,24,0.08)), url(/tdcp-hero.jpg?v=2)" }}
      >
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-[11px] font-bold tracking-[0.18em] text-white/80">TDCP RESTAURANT MANAGEMENT SYSTEM</p>
            <h2 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Good {dayPart(now)},
              <br />
              <span className="text-[#7dffb2]">{orgName}</span>
            </h2>
            <p className="mt-2 text-sm text-white/85">
              {hq ? "Here's today's kitchen lineup across all your sites." : "Here's today's kitchen lineup for this site."}
            </p>
          </div>
          <div className="relative min-w-[148px] rounded-2xl bg-white px-6 py-4 text-center text-[#16324a] shadow-sm">
            <MapPin size={16} className="mx-auto text-[#16845c]" />
            <p className="mt-1 text-4xl font-extrabold leading-none">{sites}</p>
            <p className="mt-1 text-[11px] font-bold tracking-[0.18em] text-slate-400">SITES</p>
            <span className="pointer-events-none absolute -bottom-3 -right-3 text-[#d7efe4]">
              <svg width="54" height="36" viewBox="0 0 54 36" fill="none" aria-hidden="true">
                <path d="M2 30 16 14l8 8 10-14 18 22" stroke="#7dffb2" strokeWidth="2" />
                <path d="M8 30h40" stroke="#16845c" strokeWidth="2" />
              </svg>
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Utensils} label="TODAY" value={kpis.todayOrders || 0} detail="Orders" faint={Utensils} />
        <StatCard icon={ChefHat} label="IN THE KITCHEN" value={kpis.pendingKitchen || 0} detail="Preparing" faint={ChefHat} />
        <StatCard icon={CircleCheck} label="THIS WEEK" value={formatPKR(kpis.weekSales || 0)} detail="Sales" faint={ChartColumn} />
        <div className="flex items-center gap-4 rounded-[22px] bg-white px-4 py-4 shadow-sm">
          <RateRing percent={serviceRate} />
          <div>
            <p className="text-sm font-bold text-[#16324a]">Service rate</p>
            <p className="mt-1 text-xs text-slate-400">
              {hq ? `${active} of ${sites} Organizations` : "Paid tickets today"}
            </p>
          </div>
        </div>
      </div>

      {hq ? <ResortOverviewTable /> : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-[22px] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-[#16324a]">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e7f7ee] text-[#16845c]">
                <ChartColumn size={15} />
              </span>
              Sales Overview
            </h3>
            <select value={salesRange} onChange={(e) => setSalesRange(e.target.value)} className={pill}>
              <option value="today">Today</option>
              <option value="week">This week</option>
            </select>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                  allowDecimals={false}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
                />
                <Tooltip formatter={(v) => formatPKR(v)} />
                <Area type="monotone" dataKey="sales" stroke="#16845c" fill="#e7f7ee" strokeWidth={2.5} dot={{ r: 3, fill: "#16845c" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3 text-sm">
            <div>
              <p className="text-xs text-slate-400">Total Sales</p>
              <p className="font-bold text-[#16324a]">{formatPKR(salesTotal || 0)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Highest</p>
              <p className="font-bold text-[#16845c]">{formatPKR(highest)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Lowest</p>
              <p className="font-bold text-rose-500">{formatPKR(lowest)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[22px] bg-white p-5 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 font-bold text-[#16324a]">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e7f7ee] text-[#16845c]">
              <Utensils size={15} />
            </span>
            Top Selling Items
          </h3>
          {(data?.topItems || []).length ? (
            <div className="space-y-3">
              {data.topItems.map((item, i) => (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="w-4 text-xs font-semibold text-slate-400">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#16324a]">{item.name}</span>
                  <span className="text-xs text-slate-400">{item.sold} Orders</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid h-52 place-items-center text-center">
              <div>
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#f3f6f8] text-slate-300">
                  <ChefHat size={28} />
                </span>
                <p className="mt-3 text-sm text-slate-400">No sales yet today.</p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[22px] bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-[#16324a]">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e7f7ee] text-[#16845c]">
                <CreditCard size={15} />
              </span>
              Sales by Payment Method
            </h3>
            <select value={payRange} onChange={(e) => setPayRange(e.target.value)} className={pill}>
              <option value="month">This Month</option>
              <option value="today">Today</option>
            </select>
          </div>
          <div className="relative h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={payTotal ? payRows.filter((row) => row.amount > 0) : [{ key: "None", amount: 1, color: "#0e4a34" }]}
                  dataKey="amount"
                  nameKey="key"
                  innerRadius={54}
                  outerRadius={74}
                  stroke="none"
                >
                  {(payTotal ? payRows.filter((row) => row.amount > 0) : [{ key: "None", color: "#0e4a34" }]).map((row) => (
                    <Cell key={row.key} fill={row.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatPKR(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="text-[11px] text-slate-400">Total Sales</p>
                <p className="text-sm font-extrabold text-[#16324a]">{formatPKR(payTotal)}</p>
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
            {payRows.map((row) => (
              <span key={row.key} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: row.color }} />
                {row.key} {payTotal ? `${((row.amount / payTotal) * 100).toFixed(0)}%` : "0%"}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
