import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircleDot,
  Clock,
  CreditCard,
  FileText,
  Nfc,
  Receipt as ReceiptIcon,
  ShoppingBag,
  Wallet,
  XCircle,
} from "lucide-react";
import api from "../api";
import { formatPKR } from "../lib/format";
import Receipt from "../components/Receipt";
import CollectPaymentModal from "../components/CollectPaymentModal";
import { printReceipts } from "../lib/printReceipt";
import { useAuth } from "../context/AuthContext";

const PAGE_SIZE = 10;

const DATE_FILTERS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "Last 7 days" },
  { id: "all", label: "All time" },
];

const COLUMNS = [
  { key: "order_no", label: "Order" },
  { key: "table", label: "Table" },
  { key: "kitchen", label: "Kitchen" },
  { key: "payment", label: "Payment" },
  { key: "total", label: "Total" },
  { key: "time", label: "Time" },
  { key: "action", label: "Action" },
];

function startOfDay(offset = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

function inRange(iso, filter) {
  const t = new Date(iso).getTime();
  if (filter === "all") return true;
  if (filter === "today") return t >= startOfDay(0).getTime();
  if (filter === "yesterday") return t >= startOfDay(-1).getTime() && t < startOfDay(0).getTime();
  if (filter === "week") return t >= startOfDay(-6).getTime();
  return true;
}

function tableCode(label) {
  if (!label) return "—";
  const first = String(label).split(/[·•]/)[0].trim();
  const n = Number(first);
  if (Number.isFinite(n)) return String(n).padStart(2, "0");
  return first;
}

function formatTime(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function kitchenOf(status) {
  if (status === "cancelled" || status === "canceled") {
    return { label: "Cancelled", tone: "cancel" };
  }
  if (status === "ready" || status === "completed") {
    return { label: "Completed", tone: "done" };
  }
  return { label: "Preparing", tone: "prep" };
}

function PayIcon({ method, size = 13 }) {
  if (method === "Card" || method === "Stripe") return <CreditCard size={size} />;
  if (method === "POS") return <Nfc size={size} />;
  return <Banknote size={size} />;
}

function KpiCard({ icon: Icon, iconClass, label, value }) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border px-4 py-3.5"
      style={{ background: "var(--surface)", borderColor: "var(--surface-border)" }}
    >
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${iconClass}`}>
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium" style={{ color: "var(--app-muted)" }}>
          {label}
        </p>
        <p className="truncate text-lg font-extrabold leading-tight">{value}</p>
      </div>
    </div>
  );
}

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [paying, setPaying] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [printCopy, setPrintCopy] = useState("restaurant");
  const [printing, setPrinting] = useState(false);
  const [range, setRange] = useState("today");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: "time", dir: "desc" });

  function openReceipt(order) {
    setReceipt(order);
    setPrintCopy("restaurant");
  }

  async function printCurrentCopy() {
    if (!receipt || printing) return;
    setPrinting(true);
    const result = await printReceipts({
      order: receipt,
      restaurantName: user?.restaurant_name,
      cashierName: user?.name,
      copy: printCopy,
    });
    setPrinting(false);
    if (result?.ok && printCopy === "restaurant") setPrintCopy("customer");
  }

  async function load() {
    const { data } = await api.get("/orders");
    setOrders(data);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onMsg(e) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== "tdcp-order-paid" || !e.data.order) return;
      setPaying(null);
      openReceipt(e.data.order);
      load();
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [range]);

  const filtered = useMemo(() => orders.filter((o) => inRange(o.created_at, range)), [orders, range]);

  const stats = useMemo(() => {
    const preparing = filtered.filter((o) => o.status === "new" || o.status === "preparing").length;
    const completed = filtered.filter((o) => o.status === "ready" || o.status === "completed").length;
    const unpaid = filtered.filter((o) => o.payment_status !== "paid").length;
    const revenue = filtered
      .filter((o) => o.payment_status === "paid")
      .reduce((s, o) => s + Number(o.total || 0), 0);
    return { total: filtered.length, preparing, completed, unpaid, revenue };
  }, [filtered]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const { key, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let av;
      let bv;
      if (key === "order_no") {
        av = Number(a.order_no);
        bv = Number(b.order_no);
      } else if (key === "table") {
        av = tableCode(a.table_label);
        bv = tableCode(b.table_label);
      } else if (key === "kitchen") {
        av = kitchenOf(a.status).label;
        bv = kitchenOf(b.status).label;
      } else if (key === "payment") {
        av = `${a.payment_status}${a.payment_method || ""}`;
        bv = `${b.payment_status}${b.payment_method || ""}`;
      } else if (key === "total") {
        av = Number(a.total);
        bv = Number(b.total);
      } else {
        av = new Date(a.created_at).getTime();
        bv = new Date(b.created_at).getTime();
      }
      if (av < bv) return -1 * mul;
      if (av > bv) return 1 * mul;
      return 0;
    });
    return list;
  }, [filtered, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const slice = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = sorted.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(safePage * PAGE_SIZE, sorted.length);

  function toggleSort(key) {
    if (key === "action") return;
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  async function cancelOrder(order) {
    if (!window.confirm(`Cancel order #${order.order_no}?`)) return;
    await api.patch(`/orders/${order.id}`, { status: "cancelled" });
    load();
  }

  return (
    <div className="space-y-4">
      <section
        className="rounded-3xl border p-4 shadow-sm sm:p-6 print:hidden"
        style={{ background: "var(--surface)", borderColor: "var(--surface-border)", color: "var(--app-text)" }}
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-tdcp-50 text-tdcp-700">
              <ShoppingBag size={22} />
            </span>
            <div>
              <h2 className="text-xl font-extrabold leading-tight">Orders</h2>
              <p className="mt-0.5 max-w-xl text-sm" style={{ color: "var(--app-muted)" }}>
                Send food from POS to KDS.
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center">
            <CalendarDays size={15} className="pointer-events-none absolute left-3 text-tdcp-600" />
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="appearance-none rounded-full border bg-tdcp-50 py-2 pl-9 pr-9 text-sm font-semibold text-tdcp-800 outline-none"
              style={{ borderColor: "var(--surface-border)" }}
            >
              {DATE_FILTERS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 text-tdcp-600" />
          </label>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
          <KpiCard icon={FileText} iconClass="bg-tdcp-50 text-tdcp-600" label="Total Orders" value={stats.total} />
          <KpiCard icon={Clock} iconClass="bg-amber-50 text-amber-500" label="Preparing" value={stats.preparing} />
          <KpiCard
            icon={CheckCircle2}
            iconClass="bg-emerald-50 text-emerald-600"
            label="Completed"
            value={stats.completed}
          />
          <KpiCard icon={CreditCard} iconClass="bg-rose-50 text-rose-500" label="Unpaid" value={stats.unpaid} />
          <KpiCard
            icon={Wallet}
            iconClass="bg-tdcp-50 text-tdcp-600"
            label="Total Revenue"
            value={formatPKR(stats.revenue)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                {COLUMNS.map((col, i) => {
                  const isAction = col.key === "action";
                  return (
                    <th
                      key={col.key}
                      className={`bg-tdcp-50 py-3 ${
                        i === 0
                          ? "rounded-l-2xl pl-3 pr-1"
                          : isAction
                            ? "w-px whitespace-nowrap rounded-r-2xl px-3 text-left"
                            : "px-1"
                      }`}
                    >
                      {isAction ? (
                        <span className="inline-flex min-h-9 items-center">Action</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleSort(col.key)}
                          className="inline-flex items-center gap-1"
                        >
                          {col.label}
                          <ChevronsUpDown size={12} className="opacity-40" />
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {slice.length ? (
                slice.map((o) => {
                  const kitchen = kitchenOf(o.status);
                  const paid = o.payment_status === "paid";
                  const canPay = ["ready", "completed"].includes(o.status);
                  const rowDot = paid ? "paid" : o.status === "new" || o.status === "preparing" ? "open" : "due";
                  return (
                    <tr key={o.id} className="border-b last:border-b-0" style={{ borderColor: "var(--surface-border)" }}>
                      <td className="py-3.5 pl-3">
                        <div className="flex items-center gap-2.5">
                          {rowDot === "paid" ? (
                            <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
                          ) : (
                            <CircleDot
                              size={14}
                              className={`shrink-0 ${rowDot === "open" ? "text-amber-400" : "text-rose-500"}`}
                            />
                          )}
                          <span className="font-bold">#{o.order_no}</span>
                          {o.status === "new" ? (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-600">
                              New
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="font-medium">{tableCode(o.table_label)}</td>
                      <td>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            kitchen.tone === "done"
                              ? "bg-emerald-50 text-emerald-700"
                              : kitchen.tone === "cancel"
                                ? "bg-rose-50 text-rose-600"
                                : "bg-amber-50 text-amber-600"
                          }`}
                        >
                          {kitchen.tone === "done" ? (
                            <CheckCircle2 size={13} />
                          ) : kitchen.tone === "cancel" ? (
                            <XCircle size={13} />
                          ) : (
                            <Clock size={13} />
                          )}
                          {kitchen.label}
                        </span>
                      </td>
                      <td>
                        {paid ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            <PayIcon method={o.payment_method} />
                            Paid · Cash
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-500">
                            Unpaid
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap font-semibold">{formatPKR(o.total)}</td>
                      <td className="whitespace-nowrap text-xs" style={{ color: "var(--app-muted)" }}>
                        {formatTime(o.created_at)}
                      </td>
                      <td className="w-px whitespace-nowrap px-3 py-3.5 text-left">
                        {o.status === "cancelled" ? (
                          <span className="text-xs font-semibold text-rose-500">Cancelled</span>
                        ) : paid ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold text-tdcp-700"
                            style={{ borderColor: "var(--surface-border)" }}
                            onClick={() => openReceipt(o)}
                          >
                            <ReceiptIcon size={14} />
                            View receipt
                          </button>
                        ) : (
                          <div className="flex flex-wrap items-center justify-start gap-1.5">
                            <button
                              type="button"
                              className="inline-flex rounded-xl bg-tdcp-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                              disabled={!canPay}
                              title={canPay ? "Collect payment" : "Wait until kitchen marks this order ready"}
                              onClick={() => setPaying(o)}
                            >
                              Collect payment
                            </button>
                            <button
                              type="button"
                              className="inline-flex rounded-xl border px-3 py-2 text-xs font-semibold text-rose-500"
                              style={{ borderColor: "var(--surface-border)" }}
                              onClick={() => cancelOrder(o)}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={COLUMNS.length} className="py-12 text-center text-sm" style={{ color: "var(--app-muted)" }}>
                    No orders in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs" style={{ color: "var(--app-muted)" }}>
            Showing {from} to {to} of {sorted.length} orders
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous page"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="grid h-8 w-8 place-items-center rounded-lg border disabled:opacity-40"
              style={{ borderColor: "var(--surface-border)" }}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="grid h-8 min-w-8 place-items-center rounded-lg bg-tdcp-800 px-2 text-sm font-bold text-white">
              {safePage}
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={safePage >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="grid h-8 w-8 place-items-center rounded-lg border disabled:opacity-40"
              style={{ borderColor: "var(--surface-border)" }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {paying ? (
        <CollectPaymentModal
          order={paying}
          tableLabel={tableCode(paying.table_label)}
          onClose={() => setPaying(null)}
          onPaid={async (data) => {
            setPaying(null);
            openReceipt(data);
            await load();
          }}
        />
      ) : null}

      {receipt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden">
          <div className="flex max-h-[90vh] w-full max-w-[400px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div id="tdcp-receipt" className="min-h-0 flex-1 overflow-y-auto bg-white">
              <Receipt
                order={receipt}
                restaurantName={user?.restaurant_name}
                copy={printCopy}
                cashierName={user?.name}
              />
            </div>
            <div className="flex shrink-0 gap-2 border-t border-slate-200 bg-white p-3">
              <button
                type="button"
                className="flex-1 rounded-xl border py-2 text-sm font-semibold"
                onClick={() => {
                  setReceipt(null);
                  setPrintCopy("restaurant");
                }}
              >
                Close
              </button>
              <button
                type="button"
                disabled={printing}
                className="flex-1 rounded-xl border border-tdcp-200 py-2 text-sm font-semibold text-tdcp-800 disabled:opacity-60"
                onClick={printCurrentCopy}
              >
                {printing
                  ? "Printing…"
                  : printCopy === "restaurant"
                    ? "Print restaurant copy"
                    : "Print customer copy"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
