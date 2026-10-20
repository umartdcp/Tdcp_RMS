import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Crown,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Search,
  TrendingUp,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import api from "../api";
import {
  FieldError,
  decimalOnly,
  formatPkCnic,
  formatPkPhone,
  isPersonName,
  isPkCnic,
  isPkPhone,
  lettersOnly,
} from "../lib/fields";

const PAGE_SIZE = 10;
const EMPTY = { name: "", phone: "", cnic: "", visits: "0", last_visit: "" };

const COLUMNS = [
  { key: "name", label: "Customer" },
  { key: "phone", label: "Phone" },
  { key: "cnic", label: "CNIC" },
  { key: "visits", label: "Total Visits" },
  { key: "last_visit", label: "Last Visit" },
  { key: "action", label: "Actions" },
];

const AVATARS = [
  "bg-emerald-100 text-tdcp-700",
  "bg-amber-100 text-amber-800",
  "bg-indigo-100 text-indigo-700",
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
];

const fieldClass =
  "w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-tdcp-400 focus:ring-4 focus:ring-tdcp-100";

function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function avatarClass(name) {
  const s = String(name || "");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h + s.charCodeAt(i)) % AVATARS.length;
  return AVATARS[h];
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function toDatetimeLocal(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatWhen(value) {
  if (!value) return { date: "—", time: "" };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { date: String(value), time: "" };
  return {
    date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  };
}

export default function Customers() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ name: "", phone: "" });
  const [sort, setSort] = useState({ key: "visits", dir: "desc" });
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await api.get("/customers");
      if (Array.isArray(res?.data)) setRows(res.data);
    } catch {
      /* keep the customers already saved on this device */
    }
  }

  useEffect(() => {
    load();
    window.addEventListener("tdcp-data-synced", load);
    return () => window.removeEventListener("tdcp-data-synced", load);
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const thisStart = startOfMonth(now);
    const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonth = rows.filter((r) => r.created_at && new Date(r.created_at) >= thisStart).length;
    const lastMonth = rows.filter((r) => {
      if (!r.created_at) return false;
      const d = new Date(r.created_at);
      return d >= lastStart && d < thisStart;
    }).length;
    const pct = lastMonth === 0 ? (thisMonth ? 100 : 0) : Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
    const top = [...rows].sort((a, b) => Number(b.visits) - Number(a.visits) || String(a.name).localeCompare(b.name))[0];
    return {
      total: rows.length,
      visits: rows.reduce((s, r) => s + Number(r.visits || 0), 0),
      thisMonth,
      pct,
      top,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const name = filters.name.trim().toLowerCase();
    const phone = filters.phone.trim().toLowerCase();
    return rows.filter((r) => {
      if (name && !String(r.name || "").toLowerCase().includes(name)) return false;
      if (phone && !String(r.phone || "").toLowerCase().includes(phone)) return false;
      return true;
    });
  }, [rows, filters]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const mul = sort.dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sort.key === "visits") return (Number(a.visits) - Number(b.visits)) * mul;
      if (sort.key === "last_visit") {
        const av = a.last_visit ? new Date(a.last_visit).getTime() : 0;
        const bv = b.last_visit ? new Date(b.last_visit).getTime() : 0;
        return (av - bv) * mul;
      }
      const av = String(a[sort.key] || "").toLowerCase();
      const bv = String(b[sort.key] || "").toLowerCase();
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
  const topId = stats.top?.id;

  const inputStyle = {
    background: "var(--pos-input)",
    color: "var(--app-text)",
    borderColor: "var(--surface-border)",
  };

  function toggleSort(key) {
    if (key === "action") return;
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function openAdd() {
    setError("");
    setFieldErrors({});
    setForm(EMPTY);
    setModal("add");
  }

  function openEdit(row) {
    setError("");
    setFieldErrors({});
    setForm({
      id: row.id,
      name: row.name || "",
      phone: formatPkPhone(row.phone || ""),
      cnic: formatPkCnic(row.cnic || ""),
      visits: String(row.visits ?? 0),
      last_visit: toDatetimeLocal(row.last_visit),
    });
    setModal("edit");
  }

  function validateForm() {
    const next = {};
    if (!form.name.trim()) next.name = "Name is required.";
    else if (!isPersonName(form.name)) next.name = "Name can only contain letters.";
    if (!isPkPhone(form.phone)) next.phone = "Phone must be 11 digits, starting with 03.";
    if (!isPkCnic(form.cnic)) next.cnic = "CNIC must be 13 digits (XXXXX-XXXXXXX-X).";
    if (form.visits === "" || Number(form.visits) < 0 || /[a-zA-Z]/.test(form.visits)) {
      next.visits = "Visits must be a number.";
    }
    setFieldErrors(next);
    return !Object.keys(next).length;
  }

  async function save(e) {
    e.preventDefault();
    if (busy || !validateForm()) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        phone: formatPkPhone(form.phone),
        cnic: formatPkCnic(form.cnic),
        visits: Number(form.visits || 0),
        last_visit: form.last_visit ? new Date(form.last_visit).toISOString() : undefined,
      };
      if (modal === "edit") await api.patch(`/customers/${form.id}`, payload);
      else await api.post("/customers", payload);
      setModal(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save this customer.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row) {
    if (!window.confirm(`Delete ${row.name}?`)) return;
    await api.delete(`/customers/${row.id}`);
    load();
  }

  const pctLabel =
    stats.pct === 0 ? "Same as last month" : `${stats.pct > 0 ? "+" : ""}${stats.pct}% vs last month`;

  return (
    <div className="space-y-4">
      <section
        className="rounded-3xl border p-4 shadow-sm sm:p-6"
        style={{ background: "var(--surface)", borderColor: "var(--surface-border)", color: "var(--app-text)" }}
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-tdcp-50 text-tdcp-700">
              <Users size={22} />
            </span>
            <div>
              <h2 className="text-xl font-extrabold leading-tight">Customers</h2>
              <p className="mt-0.5 text-sm" style={{ color: "var(--app-muted)" }}>
                Manage and view all your restaurant customers.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-tdcp-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
          >
            <Plus size={16} />
            Add New Customer
          </button>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Users size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tdcp-400" />
            <input
              value={filters.name}
              onChange={(e) => {
                setFilters({ ...filters, name: lettersOnly(e.target.value) });
                setPage(1);
              }}
              placeholder="Search by name..."
              className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm outline-none"
              style={inputStyle}
            />
          </div>
          <div className="relative min-w-[180px] flex-1">
            <Phone size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tdcp-400" />
            <input
              value={filters.phone}
              onChange={(e) => {
                setFilters({ ...filters, phone: formatPkPhone(e.target.value) });
                setPage(1);
              }}
              inputMode="numeric"
              maxLength={12}
              placeholder="03XX-XXXXXXX"
              className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm outline-none"
              style={inputStyle}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setFilters({ name: "", phone: "" });
              setPage(1);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-semibold"
            style={{ borderColor: "var(--surface-border)", color: "var(--app-muted)" }}
          >
            <RotateCcw size={15} />
            Reset
          </button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Kpi icon={Users} label="Total Customers" value={stats.total} hint="All time" />
          <Kpi icon={TrendingUp} label="Total Visits" value={stats.visits} hint="All time" />
          <Kpi icon={UserPlus} label="New This Month" value={stats.thisMonth} hint={pctLabel} />
          <Kpi
            icon={Crown}
            label="Top Customer"
            value={stats.top?.name || "—"}
            hint={stats.top ? `${stats.top.visits} visits` : "No customers yet"}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
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
                            ? "w-px whitespace-nowrap rounded-r-2xl px-3 text-center"
                            : "px-1"
                      }`}
                    >
                      {isAction ? (
                        <span className="inline-flex h-9 w-[5rem] items-center justify-center">Actions</span>
                      ) : (
                        <button type="button" onClick={() => toggleSort(col.key)} className="inline-flex items-center gap-1">
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
                slice.map((row) => {
                  const when = formatWhen(row.last_visit);
                  const isTop = row.id === topId && Number(row.visits) > 0;
                  return (
                    <tr key={row.id} className="border-b last:border-b-0" style={{ borderColor: "var(--surface-border)" }}>
                      <td className="py-3.5 pl-3">
                        <div className="flex items-center gap-3">
                          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold ${avatarClass(row.name)}`}>
                            {initials(row.name)}
                          </span>
                          <div>
                            <p className="font-bold leading-tight">{row.name}</p>
                            {isTop ? (
                              <span className="mt-1 inline-flex rounded-full bg-tdcp-50 px-2 py-0.5 text-[11px] font-semibold text-tdcp-700">
                                Top Customer
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--app-muted)" }}>
                          <Phone size={14} className="text-tdcp-500" />
                          {row.phone || "—"}
                        </span>
                      </td>
                      <td className="font-medium tracking-wide">{row.cnic || "—"}</td>
                      <td>
                        <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-tdcp-50 px-2.5 py-1 text-xs font-bold text-tdcp-700">
                          {Number(row.visits || 0)}
                        </span>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-2 text-xs" style={{ color: "var(--app-muted)" }}>
                          <CalendarDays size={14} className="text-tdcp-500" />
                          <span>
                            <span className="block font-semibold" style={{ color: "var(--app-text)" }}>
                              {when.date}
                            </span>
                            <span>{when.time}</span>
                          </span>
                        </span>
                      </td>
                      <td className="w-px whitespace-nowrap px-3 py-3.5">
                        <div className="flex w-[5rem] items-center justify-center gap-1">
                          <button
                            type="button"
                            aria-label={`Edit ${row.name}`}
                            onClick={() => openEdit(row)}
                            className="grid h-9 w-9 place-items-center rounded-xl border text-tdcp-600 hover:bg-tdcp-50"
                            style={{ borderColor: "var(--surface-border)" }}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${row.name}`}
                            onClick={() => remove(row)}
                            className="grid h-9 w-9 place-items-center rounded-xl border text-rose-400 hover:bg-rose-50"
                            style={{ borderColor: "var(--surface-border)" }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={COLUMNS.length} className="py-12 text-center text-sm" style={{ color: "var(--app-muted)" }}>
                    No customers match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs" style={{ color: "var(--app-muted)" }}>
            Showing {from} to {to} of {sorted.length} customers
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

      {modal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={save}
            className="w-full max-w-md rounded-2xl p-6 shadow-xl"
            style={{ background: "var(--surface)", color: "var(--app-text)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{modal === "edit" ? "Edit customer" : "Add New Customer"}</h3>
              <button type="button" onClick={() => setModal(null)} className="rounded-lg p-1 hover:bg-tdcp-50" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-3">
              <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                Full name
                <input
                  required
                  className={`${fieldClass} mt-1`}
                  style={inputStyle}
                  placeholder="e.g. Ahmed Khan"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: lettersOnly(e.target.value) })}
                />
                <FieldError message={fieldErrors.name} />
              </label>
              <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                Phone (11 digits)
                <input
                  required
                  inputMode="numeric"
                  maxLength={12}
                  className={`${fieldClass} mt-1`}
                  style={inputStyle}
                  placeholder="0300-1234567"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: formatPkPhone(e.target.value) })}
                />
                <FieldError message={fieldErrors.phone} />
              </label>
              <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                CNIC (13 digits)
                <input
                  required
                  inputMode="numeric"
                  maxLength={15}
                  className={`${fieldClass} mt-1`}
                  style={inputStyle}
                  placeholder="35202-1234567-1"
                  value={form.cnic}
                  onChange={(e) => setForm({ ...form, cnic: formatPkCnic(e.target.value) })}
                />
                <FieldError message={fieldErrors.cnic} />
              </label>
              <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                Total visits
                <input
                  inputMode="numeric"
                  className={`${fieldClass} mt-1`}
                  style={inputStyle}
                  value={form.visits}
                  onChange={(e) => setForm({ ...form, visits: decimalOnly(e.target.value).replace(/\./g, "") })}
                />
                <FieldError message={fieldErrors.visits} />
              </label>
              <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                Last visit
                <input
                  type="datetime-local"
                  className={`${fieldClass} mt-1`}
                  style={inputStyle}
                  value={form.last_visit}
                  onChange={(e) => setForm({ ...form, last_visit: e.target.value })}
                />
              </label>
              {error ? <p className="text-sm text-rose-500">{error}</p> : null}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border py-2.5 text-sm font-semibold"
                style={{ borderColor: "var(--surface-border)" }}
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-tdcp-800 py-2.5 text-sm font-semibold text-white">
                {busy ? "Saving…" : modal === "edit" ? "Save changes" : "Add customer"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-tdcp-100 bg-tdcp-50/70 px-4 py-3.5" style={{ color: "var(--app-text)" }}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-tdcp-600 shadow-sm">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-xs" style={{ color: "var(--app-muted)" }}>
          {label}
        </p>
        <p className="truncate text-lg font-extrabold leading-tight">{value}</p>
        <p className="text-xs" style={{ color: "var(--app-muted)" }}>
          {hint}
        </p>
      </div>
    </div>
  );
}
