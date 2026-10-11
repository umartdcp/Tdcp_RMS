import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Download,
  FileSpreadsheet,
  PieChart as PieIcon,
  SlidersHorizontal,
  TrendingUp,
} from "lucide-react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { buildReportModel, downloadReportPdf, downloadReportXlsx } from "../lib/exportReport";
import { canSwitchSites } from "../modules/roles";

const CAT_COLORS = {
  Food: "#0c553c",
  Beverages: "#2fa87a",
  Desserts: "#6fc7a6",
  Others: "#d5efe3",
};

const cardStyle = {
  background: "var(--surface)",
  borderColor: "var(--surface-border)",
  color: "var(--app-text)",
};

function money(value) {
  return `PKR ${Number(value || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
}

function axisMoney(value) {
  const n = Number(value || 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

function pctText(value, suffix) {
  const n = Number(value) || 0;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}% ${suffix}`;
}

function Trend({ value, suffix }) {
  const n = Number(value) || 0;
  const up = n >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <p className={`mt-1 flex items-center gap-0.5 text-xs font-medium ${up ? "text-emerald-600" : "text-rose-500"}`}>
      <Icon size={14} />
      {pctText(n, suffix)}
    </p>
  );
}

export default function Reports() {
  const { user, activeRestaurant, organization, restaurants } = useAuth();
  const [data, setData] = useState(null);
  const [trendRange, setTrendRange] = useState("7");
  const [catRange, setCatRange] = useState("month");
  const [exporting, setExporting] = useState("");
  const [resort, setResort] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const pickResort = canSwitchSites(user);

  useEffect(() => {
    const params = {};
    if (pickResort && resort === "all") params.all_restaurants = 1;
    else if (pickResort && resort) params.restaurant_id = resort;
    if (from && to) {
      params.from = from;
      params.to = to;
    }
    api.get("/reports", { params }).then((res) => setData(res.data));
  }, [activeRestaurant?.id, pickResort, resort, from, to]);

  const ranged = Boolean(from && to && data?.trend?.range);
  const trend = useMemo(() => (ranged ? data.trend.range : data?.trend?.[trendRange] || []), [data, trendRange, ranged]);
  const cats = useMemo(
    () => (ranged && data?.categories?.range ? data.categories.range : data?.categories?.[catRange] || []),
    [data, catRange, ranged]
  );
  const catTotal = cats.reduce((s, r) => s + Number(r.amount || 0), 0);
  const catCount = cats.filter((r) => Number(r.amount) > 0).length || cats.length;
  const generatedAt = useMemo(() => {
    const d = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [data]);

  const reportModel = useMemo(() => {
    if (!data) return null;
    return buildReportModel(data, {
      trendRange,
      catRange,
      restaurant:
        pickResort && resort === "all"
          ? "All resorts"
          : restaurants.find((row) => String(row.id) === String(resort))?.name ||
            activeRestaurant?.name ||
            user?.restaurant_name ||
            organization?.name ||
            "Restaurant",
      organization,
      generatedAt,
    });
  }, [data, trendRange, catRange, activeRestaurant, user, organization, generatedAt, pickResort, resort, restaurants]);

  async function exportFile(kind) {
    if (!reportModel || exporting) return;
    setExporting(kind);
    try {
      if (kind === "pdf") await downloadReportPdf(reportModel);
      else downloadReportXlsx(reportModel);
    } finally {
      setExporting("");
    }
  }

  const p = data?.periods || {};
  const orgCode = organization?.code || "TDCP";
  const resortName = activeRestaurant?.name || user?.restaurant_name || "This resort";

  return (
    <div className="space-y-4">
      <header>
        <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.18em] text-[#a6843d]">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-[#16382c] text-white">
            <BarChart3 size={14} />
          </span>
          KITCHEN · {orgCode}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#1b2a4a]">Reports</h1>
        <p className="mt-1 text-sm text-slate-500">Paid, pending and cancelled orders across every resort.</p>
      </header>

      <section className="flex flex-wrap items-end gap-3 rounded-2xl bg-white px-4 py-4 shadow-sm sm:gap-4 sm:px-5">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-slate-400">
          <SlidersHorizontal size={14} />
          FILTERS
        </div>
        <label className="min-w-[180px] flex-1">
          <span className="mb-1 block text-[10px] font-bold tracking-[0.16em] text-slate-400">RESORT</span>
          <select
            value={pickResort ? resort : String(activeRestaurant?.id || "")}
            onChange={(e) => setResort(e.target.value)}
            disabled={!pickResort}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#1b2a4a] outline-none"
          >
            {pickResort ? <option value="all">All resorts</option> : null}
            {(restaurants.length ? restaurants : activeRestaurant ? [activeRestaurant] : []).map((row) => (
              <option key={row.id} value={String(row.id)}>
                {row.name}
              </option>
            ))}
            {!pickResort && !restaurants.length && !activeRestaurant ? <option value="">{resortName}</option> : null}
          </select>
        </label>
        <label className="min-w-[150px]">
          <span className="mb-1 block text-[10px] font-bold tracking-[0.16em] text-slate-400">FROM</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#1b2a4a] outline-none"
          />
        </label>
        <label className="min-w-[150px]">
          <span className="mb-1 block text-[10px] font-bold tracking-[0.16em] text-slate-400">TO</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#1b2a4a] outline-none"
          />
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => exportFile("xlsx")}
            disabled={!data || !!exporting}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-60"
          >
            <FileSpreadsheet size={16} />
            {exporting === "xlsx" ? "Preparing…" : "Excel"}
          </button>
          <button
            type="button"
            onClick={() => exportFile("pdf")}
            disabled={!data || !!exporting}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#5f6b76] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Download size={16} />
            {exporting === "pdf" ? "Preparing…" : "Download PDF"}
          </button>
        </div>
      </section>

      {!data ? (
        <div className="p-4 text-sm text-slate-500">Loading report…</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-3xl border p-5 shadow-sm" style={cardStyle}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <TrendingUp size={16} className="text-tdcp-600" />
              Daily sales trend
            </h3>
            <select
              value={ranged ? "range" : trendRange}
              onChange={(e) => setTrendRange(e.target.value)}
              disabled={ranged}
              className="rounded-full border bg-tdcp-50 px-3 py-1 text-xs font-medium text-tdcp-800 outline-none disabled:opacity-70"
              style={{ borderColor: "var(--surface-border)" }}
            >
              {ranged ? <option value="range">Selected dates</option> : null}
              <option value="7">Last 7 Days</option>
              <option value="14">Last 14 Days</option>
              <option value="30">Last 30 Days</option>
            </select>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="reportSalesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16845c" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#16845c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e2efe8" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={axisMoney}
                  width={36}
                />
                <Tooltip content={<SalesTooltip />} />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#16845c"
                  strokeWidth={2.5}
                  fill="url(#reportSalesFill)"
                  dot={{ r: 4, fill: "#16845c", stroke: "#fff", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "#0c553c", stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <PeriodStat icon={TrendingUp} label="This week" value={money(p.week)} change={p.weekChange} suffix="vs last week" />
            <PeriodStat icon={CalendarDays} label="This month" value={money(p.month)} change={p.monthChange} suffix="vs last month" />
            <PeriodStat icon={BarChart3} label="This year" value={money(p.year)} change={p.yearChange} suffix="vs last year" />
          </div>
        </section>

        <section className="rounded-3xl border p-5 shadow-sm" style={cardStyle}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <PieIcon size={16} className="text-tdcp-600" />
              Category mix
            </h3>
            <select
              value={catRange}
              onChange={(e) => setCatRange(e.target.value)}
              className="rounded-full border bg-tdcp-50 px-3 py-1 text-xs font-medium text-tdcp-800 outline-none"
              style={{ borderColor: "var(--surface-border)" }}
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
          </div>
          <div className="grid items-center gap-4 md:grid-cols-2">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={cats} dataKey="amount" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={2} stroke="none">
                    {cats.map((row) => (
                      <Cell key={row.name} fill={CAT_COLORS[row.name] || "#aadfca"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => money(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-3 text-sm">
              {cats.map((row) => {
                const share = catTotal ? Math.round((Number(row.amount) / catTotal) * 100) : 0;
                return (
                  <li key={row.name} className="flex items-start justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ background: CAT_COLORS[row.name] }} />
                      <span>
                        <span className="block font-semibold">{row.name}</span>
                        <span className="text-xs" style={{ color: "var(--app-muted)" }}>
                          {money(row.amount)}
                        </span>
                      </span>
                    </span>
                    <span className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                      {share}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4" style={{ borderColor: "var(--surface-border)" }}>
            <div>
              <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--app-muted)" }}>
                <PieIcon size={13} /> Category sales
              </p>
              <p className="mt-1 text-lg font-extrabold">{money(catTotal)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--app-muted)" }}>
                Categories counted
              </p>
              <p className="mt-1 text-lg font-extrabold">{catCount}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-3xl border p-5 shadow-sm" style={cardStyle}>
          <h3 className="mb-3 font-semibold">Daily sales register</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs" style={{ color: "var(--app-muted)" }}>
                  <th className="rounded-l-xl bg-tdcp-50 px-3 py-2.5">Date</th>
                  <th className="rounded-r-xl bg-tdcp-50 px-3 py-2.5 text-right">Paid sales</th>
                </tr>
              </thead>
              <tbody>
                {trend.map((row) => (
                  <tr key={row.date || row.day} className="border-b last:border-b-0" style={{ borderColor: "var(--surface-border)" }}>
                    <td className="px-3 py-2.5 font-medium">{row.day}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-tdcp-800">{money(row.sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border p-5 shadow-sm" style={cardStyle}>
          <h3 className="mb-3 font-semibold">Category breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs" style={{ color: "var(--app-muted)" }}>
                  <th className="rounded-l-xl bg-tdcp-50 px-3 py-2.5">Category</th>
                  <th className="bg-tdcp-50 px-3 py-2.5 text-right">Amount</th>
                  <th className="rounded-r-xl bg-tdcp-50 px-3 py-2.5 text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {cats.map((row) => {
                  const share = catTotal ? Math.round((Number(row.amount) / catTotal) * 100) : 0;
                  return (
                    <tr key={row.name} className="border-b last:border-b-0" style={{ borderColor: "var(--surface-border)" }}>
                      <td className="px-3 py-2.5 font-medium">{row.name}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-tdcp-800">{money(row.amount)}</td>
                      <td className="px-3 py-2.5 text-right" style={{ color: "var(--app-muted)" }}>
                        {share}%
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td className="px-3 py-2.5 font-bold">Total</td>
                  <td className="px-3 py-2.5 text-right font-extrabold text-tdcp-800">{money(catTotal)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function PeriodStat({ icon: Icon, label, value, change, suffix }) {
  return (
    <div className="rounded-2xl bg-tdcp-50/70 px-3 py-3">
      <p className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--app-muted)" }}>
        <Icon size={13} className="text-tdcp-600" />
        {label}
      </p>
      <p className="mt-1 text-sm font-extrabold">{value}</p>
      <Trend value={change} suffix={suffix} />
    </div>
  );
}

function SalesTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const date = row.date
    ? new Date(`${row.date}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : row.day;
  return (
    <div className="rounded-xl border bg-white px-3 py-2 text-xs shadow-md" style={{ borderColor: "var(--surface-border)" }}>
      <p className="font-semibold">{date}</p>
      <p style={{ color: "var(--app-muted)" }}>Sales: {money(row.sales)}</p>
    </div>
  );
}
