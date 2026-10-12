import { useEffect, useMemo, useState } from "react";
import {
  Armchair,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Trees,
  Users,
  Wrench,
  X,
} from "lucide-react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { digitsOnly, FieldError, isTextName, textNameOnly } from "../lib/fields";

const PAGE_SIZE = 5;
const SECTION_ORDER = ["Main Hall", "Outdoor", "VIP Area"];

const sectionMeta = {
  "Main Hall": { icon: Armchair },
  Outdoor: { icon: Trees },
  "VIP Area": { icon: Sparkles },
};

const statusMeta = {
  available: {
    label: "Available",
    icon: CheckCircle2,
    accent: "#10b981",
    bg: "#ecfdf5",
    border: "#6ee7b7",
  },
  occupied: {
    label: "Occupied",
    icon: Users,
    accent: "#f43f5e",
    bg: "#fff1f2",
    border: "#fda4af",
  },
  reserved: {
    label: "Reserved",
    icon: CalendarDays,
    accent: "#f59e0b",
    bg: "#fffbeb",
    border: "#fcd34d",
  },
  cleaning: {
    label: "Cleaning",
    icon: Sparkles,
    accent: "#3b82f6",
    bg: "#eff6ff",
    border: "#93c5fd",
  },
  maintenance: {
    label: "Maintenance",
    icon: Wrench,
    accent: "#64748b",
    bg: "#f8fafc",
    border: "#cbd5e1",
  },
};

const legend = ["available", "occupied", "reserved", "cleaning", "maintenance"];

const fieldClass =
  "w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-tdcp-400 focus:ring-4 focus:ring-tdcp-100";

function tableNumber(label) {
  const n = Number(label);
  if (Number.isFinite(n)) return String(n).padStart(2, "0");
  return label;
}

function TableCard({ table, onCycle, onEdit, onDelete }) {
  const meta = statusMeta[table.status] || statusMeta.available;
  const Icon = meta.icon;
  return (
    <div
      className="relative flex min-h-[132px] flex-col items-center justify-center rounded-2xl px-3 py-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        borderTopWidth: 4,
        borderBottomWidth: 4,
        borderTopColor: meta.accent,
        borderBottomColor: meta.accent,
        color: "#0f172a",
      }}
    >
      <div className="absolute right-2 top-2 flex gap-1">
        <button
          type="button"
          className="grid h-7 w-7 place-items-center rounded-lg bg-white/80 text-tdcp-700"
          aria-label={`Edit table ${table.label}`}
          onClick={() => onEdit(table)}
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          className="grid h-7 w-7 place-items-center rounded-lg bg-white/80 text-rose-500"
          aria-label={`Delete table ${table.label}`}
          onClick={() => onDelete(table)}
        >
          <Trash2 size={13} />
        </button>
      </div>
      <button type="button" onClick={() => onCycle(table)} title="Tap to change status" className="mt-4">
        <span className="block text-2xl font-extrabold tracking-tight" style={{ color: "#0f172a" }}>
          {tableNumber(table.label)}
        </span>
        <span className="mt-1.5 flex items-center justify-center gap-1 text-xs font-medium" style={{ color: meta.accent }}>
          <Icon size={13} />
          {meta.label}
        </span>
        <span className="mt-2 block text-[11px] text-slate-500">{table.seats} Seats</span>
      </button>
    </div>
  );
}

function SectionBlock({ section, rows, onCycle, onFloorPlan, onAddTable, onEdit, onDelete }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const visible = rows.slice(start, start + PAGE_SIZE);
  const MetaIcon = sectionMeta[section]?.icon || Armchair;

  useEffect(() => {
    if (page > pages - 1) setPage(0);
  }, [page, pages]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MetaIcon size={16} className="text-tdcp-600" />
          <h3 className="font-semibold" style={{ color: "var(--app-text)" }}>
            {section}
          </h3>
          <span className="text-sm" style={{ color: "var(--app-muted)" }}>
            | {rows.length} Tables
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAddTable(section)}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-tdcp-700"
            style={{ borderColor: "var(--surface-border)", background: "var(--surface)" }}
          >
            <Plus size={14} />
            Add table
          </button>
          <button
            type="button"
            onClick={() => onFloorPlan(section, rows)}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: "var(--surface-border)", color: "var(--app-muted)", background: "var(--surface)" }}
          >
            <LayoutGrid size={14} />
            View Floor Plan
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {page > 0 ? (
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
            style={{ borderColor: "var(--surface-border)", color: "var(--app-muted)" }}
            aria-label={`Previous ${section} tables`}
          >
            <ChevronLeft size={18} />
          </button>
        ) : null}
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {visible.map((table) => (
            <TableCard key={table.id} table={table} onCycle={onCycle} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
        {pages > 1 ? (
          <button
            type="button"
            onClick={() => setPage((p) => (p + 1) % pages)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
            style={{ borderColor: "var(--surface-border)", color: "var(--app-muted)" }}
            aria-label={`More ${section} tables`}
          >
            <ChevronRight size={18} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

const EMPTY_ADD = { section: "", count: "4", seats: "4", label: "" };

export default function Tables() {
  const { user, activeRestaurant } = useAuth();
  const restaurantName = activeRestaurant?.name || user?.restaurant_name || "this restaurant";
  const [tables, setTables] = useState([]);
  const [floor, setFloor] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_ADD);
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const { data } = await api.get("/tables");
    const siteId = Number(activeRestaurant?.id || user?.site_id || user?.restaurant_id || 0);
    setTables(
      (Array.isArray(data) ? data : []).filter((row) => {
        if (!Number(row?.id)) return false;
        if (!siteId) return true;
        const restaurantId = Number(row.restaurant_id || 0);
        const rowSite = Number(row.site_id || 0);
        return restaurantId === siteId || rowSite === siteId;
      })
    );
  }

  useEffect(() => {
    load();
  }, [activeRestaurant?.id, user?.restaurant_id]);

  const sections = useMemo(() => {
    const map = {};
    tables.forEach((t) => {
      map[t.section] = map[t.section] || [];
      map[t.section].push(t);
    });
    const keys = Object.keys(map).sort((a, b) => {
      const ia = SECTION_ORDER.indexOf(a);
      const ib = SECTION_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return keys.map((key) => [key, map[key]]);
  }, [tables]);

  const counts = useMemo(() => {
    const c = { total: tables.length, available: 0, occupied: 0, reserved: 0, cleaning: 0, maintenance: 0 };
    tables.forEach((t) => {
      if (c[t.status] != null) c[t.status] += 1;
    });
    return c;
  }, [tables]);

  async function cycle(table) {
    const order = ["available", "occupied", "reserved", "cleaning", "maintenance"];
    const next = order[(order.indexOf(table.status) + 1) % order.length];
    try {
      await api.patch(`/tables/${table.id}`, { status: next });
      await load();
    } catch (err) {
      const missing = err.response?.status === 404 || /not found/i.test(err.response?.data?.message || "");
      if (missing) {
        setTables((prev) => prev.filter((row) => row.id !== table.id));
        return;
      }
      window.alert(err.response?.data?.message || "Could not update this table.");
    }
  }

  function openAddArea() {
    setError("");
    setFieldErrors({});
    setForm({ ...EMPTY_ADD, section: "" });
    setModal("area");
  }

  function openAddTable(section) {
    setError("");
    setFieldErrors({});
    setForm({ ...EMPTY_ADD, section, count: "1", seats: "4", label: "" });
    setModal("table");
  }

  function openEdit(table) {
    setError("");
    setFieldErrors({});
    setForm({
      id: table.id,
      section: table.section,
      seats: String(table.seats || 4),
      label: table.label,
      count: "1",
    });
    setModal("edit");
  }

  async function removeTable(table) {
    if (!window.confirm(`Remove table ${table.label} from ${restaurantName}?`)) return;
    try {
      await api.delete(`/tables/${table.id}`);
      load();
    } catch (err) {
      const missing = err.response?.status === 404 || /not found/i.test(err.response?.data?.message || "");
      if (missing) {
        setTables((prev) => prev.filter((row) => row.id !== table.id));
        return;
      }
      window.alert(err.response?.data?.message || "Could not delete this table.");
    }
  }

  function validate() {
    const next = {};
    if (!form.section.trim()) next.section = "Area name is required.";
    else if (!isTextName(form.section)) next.section = "Area name can only contain letters.";
    if (modal !== "edit") {
      const count = Number(form.count);
      if (!count || count < 1) next.count = "Enter how many tables to add.";
    }
    const seats = Number(form.seats);
    if (!seats || seats < 1) next.seats = "Seats must be a number.";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save(e) {
    e.preventDefault();
    if (busy || !validate()) return;
    setBusy(true);
    setError("");
    try {
      if (modal === "edit") {
        await api.patch(`/tables/${form.id}`, {
          label: form.label.trim(),
          section: form.section.trim(),
          seats: Number(form.seats),
        });
      } else {
        await api.post("/tables", {
          section: form.section.trim(),
          seats: Number(form.seats),
          count: Number(form.count || 1),
          label: form.label.trim() || undefined,
        });
      }
      setModal(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save tables.");
    } finally {
      setBusy(false);
    }
  }

  const footer = [
    { key: "total", label: "Total Tables", value: counts.total, icon: LayoutGrid, color: "#0f6b4a" },
    { key: "available", label: "Available", value: counts.available, icon: CheckCircle2, color: "#10b981" },
    { key: "occupied", label: "Occupied", value: counts.occupied, icon: Users, color: "#f43f5e" },
    { key: "reserved", label: "Reserved", value: counts.reserved, icon: CalendarDays, color: "#f59e0b" },
    { key: "cleaning", label: "Cleaning", value: counts.cleaning, icon: Sparkles, color: "#3b82f6" },
    { key: "maintenance", label: "Maintenance", value: counts.maintenance, icon: Wrench, color: "#64748b" },
  ];

  const inputStyle = {
    background: "var(--pos-input)",
    color: "var(--app-text)",
    borderColor: "var(--surface-border)",
  };

  return (
    <div className="rounded-3xl border p-6 shadow-sm" style={{ background: "var(--surface)", borderColor: "var(--surface-border)" }}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold" style={{ color: "var(--app-text)" }}>
            <CalendarDays size={20} className="text-tdcp-500" />
            Table Management
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--app-muted)" }}>
            Layout for <span className="font-semibold text-tdcp-700">{restaurantName}</span> — add areas and tables to match this resort’s space.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium" style={{ color: "var(--app-muted)" }}>
            {legend.map((key) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: statusMeta[key].accent }} />
                {statusMeta[key].label}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={openAddArea}
            className="inline-flex items-center gap-1.5 rounded-xl bg-tdcp-800 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus size={16} />
            Add area
          </button>
        </div>
      </div>

      {sections.length ? (
        <div className="space-y-8">
          {sections.map(([section, rows]) => (
            <SectionBlock
              key={section}
              section={section}
              rows={rows}
              onCycle={cycle}
              onAddTable={openAddTable}
              onEdit={openEdit}
              onDelete={removeTable}
              onFloorPlan={(name, list) => setFloor({ name, list })}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed px-6 py-16 text-center" style={{ borderColor: "var(--surface-border)" }}>
          <p className="font-semibold" style={{ color: "var(--app-text)" }}>
            No tables set up for {restaurantName}
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--app-muted)" }}>
            Add an area (Main Hall, Terrace, Lawn) and the number of tables that fit this restaurant.
          </p>
          <button
            type="button"
            onClick={openAddArea}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-tdcp-800 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus size={16} />
            Add area
          </button>
        </div>
      )}

      <div
        className="mt-8 grid grid-cols-2 gap-3 rounded-2xl px-4 py-4 sm:grid-cols-3 xl:grid-cols-6"
        style={{ background: "var(--app-bg)" }}
      >
        {footer.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.key} className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: `${item.color}18`, color: item.color }}
              >
                <Icon size={16} />
              </span>
              <div>
                <p className="text-lg font-bold leading-none" style={{ color: item.color }}>
                  {item.value}
                </p>
                <p className="mt-1 text-[11px]" style={{ color: "var(--app-muted)" }}>
                  {item.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {floor ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setFloor(null)}>
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-3xl p-6 shadow-xl"
            style={{ background: "var(--surface)", color: "var(--app-text)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">{floor.name} floor plan</h3>
                <p className="text-sm" style={{ color: "var(--app-muted)" }}>
                  {floor.list.length} tables · tap a table to change status
                </p>
              </div>
              <button type="button" onClick={() => setFloor(null)} className="rounded-full p-2 hover:bg-black/5" aria-label="Close floor plan">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {floor.list.map((table) => (
                <TableCard
                  key={table.id}
                  table={tables.find((t) => t.id === table.id) || table}
                  onCycle={cycle}
                  onEdit={openEdit}
                  onDelete={removeTable}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={save}
            className="w-full max-w-md rounded-2xl p-6 shadow-xl"
            style={{ background: "var(--surface)", color: "var(--app-text)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {modal === "edit" ? "Edit table" : modal === "area" ? `Add area · ${restaurantName}` : `Add table · ${form.section}`}
              </h3>
              <button type="button" onClick={() => setModal(null)} className="rounded-lg p-1 hover:bg-tdcp-50" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-3">
              <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                Area name
                <input
                  required
                  className={`${fieldClass} mt-1`}
                  style={inputStyle}
                  placeholder="Main Hall, Terrace, Lawn…"
                  value={form.section}
                  onChange={(e) => setForm({ ...form, section: textNameOnly(e.target.value) })}
                />
                <FieldError message={fieldErrors.section} />
              </label>
              {modal === "edit" ? (
                <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                  Table number
                  <input
                    required
                    inputMode="numeric"
                    maxLength={4}
                    className={`${fieldClass} mt-1`}
                    style={inputStyle}
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: digitsOnly(e.target.value, 4) })}
                  />
                </label>
              ) : null}
              {modal !== "edit" ? (
                <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                  How many tables
                  <input
                    required
                    inputMode="numeric"
                    className={`${fieldClass} mt-1`}
                    style={inputStyle}
                    value={form.count}
                    onChange={(e) => setForm({ ...form, count: digitsOnly(e.target.value, 2) })}
                  />
                  <FieldError message={fieldErrors.count} />
                </label>
              ) : null}
              <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                Seats per table
                <input
                  required
                  inputMode="numeric"
                  className={`${fieldClass} mt-1`}
                  style={inputStyle}
                  value={form.seats}
                  onChange={(e) => setForm({ ...form, seats: digitsOnly(e.target.value, 2) })}
                />
                <FieldError message={fieldErrors.seats} />
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
                {busy ? "Saving…" : modal === "edit" ? "Save table" : "Save layout"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
