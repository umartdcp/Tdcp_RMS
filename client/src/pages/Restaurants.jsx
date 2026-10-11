import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  LayoutGrid,
  List,
  MapPin,
  Pencil,
  Plus,
  Power,
  Trash2,
  ShoppingBag,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import api from "../api";
import { textNameOnly } from "../lib/fields";
import { formatPKR } from "../lib/format";
import { useAuth } from "../context/AuthContext";

function isHiddenResort(r) {
  const name = String(r?.name || "").toLowerCase();
  return name.includes("murree restaurant") || name.includes("bakhshuwali");
}

function isActive(status) {
  return !status || status === "open" || status === "active";
}

export default function Restaurants() {
  const { user, organization, setActiveRestaurant, refreshRestaurants } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [view, setView] = useState("grid");
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", location: "", image_url: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const { data } = await api.get("/dashboard/overview");
      setRows((data.restaurants || []).filter((r) => !isHiddenResort(r)));
    } catch {
      const list = (await api.get("/restaurants")).data;
      setRows((list || []).filter((r) => !isHiddenResort(r)));
    }
  }

  useEffect(() => {
    load();
  }, []);

  function canDelete(r) {
    const orgCode = String(r.organization_code || organization?.code || "").toUpperCase();
    const tdcpAdmin =
      user?.role === "org_admin" || user?.role === "super_admin" || user?.role === "admin";
    return orgCode === "TDCP" && tdcpAdmin;
  }

  async function deleteSite(r) {
    if (!canDelete(r) || busyId) return;
    const ok = window.confirm(`Delete ${r.name}? Orders, menu, and tables at this site will be removed.`);
    if (!ok) return;
    setBusyId(r.id);
    setError("");
    try {
      await api.delete(`/restaurants/${r.id}`);
      await load();
      await refreshRestaurants?.();
    } catch (err) {
      setError(err.response?.data?.message || "Could not delete this site.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleStatus(r) {
    if (user?.role !== "admin" && user?.role !== "super_admin" && user?.role !== "org_admin") return;
    setBusyId(r.id);
    try {
      const next = isActive(r.status) ? "closed" : "open";
      await api.patch(`/restaurants/${r.id}`, { status: next });
      await load();
      await refreshRestaurants?.();
    } finally {
      setBusyId(null);
    }
  }

  function openResort(r) {
    setActiveRestaurant(r.id);
    navigate("/");
  }

  function openAdd() {
    setError("");
    setAdding(true);
    setForm({ name: "TDCP Chewra Restaurant", location: "Chewra", image_url: "" });
  }

  async function saveNew(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await api.post("/restaurants", {
        name: form.name.trim(),
        location: form.location.trim(),
        image_url: form.image_url.trim() || undefined,
      });
      setAdding(false);
      await load();
      await refreshRestaurants?.();
    } catch (err) {
      setError(err.response?.data?.message || "Could not add this restaurant.");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(r) {
    setError("");
    setEditing(r);
    setForm({ name: r.name || "", location: r.location || "", image_url: r.image_url || "" });
  }

  async function saveDetails(e) {
    e.preventDefault();
    if (!editing || saving) return;
    setSaving(true);
    setError("");
    try {
      const payload = { name: form.name.trim(), location: form.location.trim() };
      if (form.image_url?.trim() && form.image_url.trim() !== editing.image_url) {
        payload.image_url = form.image_url.trim();
      }
      await api.patch(`/restaurants/${editing.id}`, payload);
      setEditing(null);
      await load();
      await refreshRestaurants?.();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save resort details.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(file) {
    if (!editing || !file || saving) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const image_base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data } = await api.post(`/restaurants/${editing.id}/image`, { image_base64 });
      setForm((f) => ({ ...f, image_url: data.image_url }));
      setEditing((prev) => ({ ...prev, ...data }));
      await load();
      await refreshRestaurants?.();
    } catch (err) {
      setError(err.response?.data?.message || "Could not upload this photo.");
    } finally {
      setSaving(false);
    }
  }

  const locations = useMemo(() => [...new Set(rows.map((r) => r.location).filter(Boolean))], [rows]);

  const visible = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "active") return rows.filter((r) => isActive(r.status));
    return rows.filter((r) => r.location === filter);
  }, [rows, filter]);

  const totals = useMemo(
    () => ({
      count: rows.length,
      sales: rows.reduce((s, r) => s + Number(r.today_sales || 0), 0),
      orders: rows.reduce((s, r) => s + Number(r.today_orders || 0), 0),
      users: rows.reduce((s, r) => s + Number(r.user_count || 0), 0),
    }),
    [rows]
  );

  return (
    <div className="space-y-4">
      <section
        className="rounded-3xl border p-4 shadow-sm sm:p-6"
        style={{ background: "var(--surface)", borderColor: "var(--surface-border)", color: "var(--app-text)" }}
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-tdcp-50 text-tdcp-700">
              <Building2 size={22} />
            </span>
            <div>
              <h2 className="text-xl font-extrabold leading-tight">Multi-Restaurant Overview</h2>
              <p className="mt-0.5 text-sm" style={{ color: "var(--app-muted)" }}>
                Each TDCP resort has its own restaurant — separate menu, orders, and staff. Activate a resort, then open it to work there.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex rounded-xl border p-1"
              style={{ borderColor: "var(--surface-border)" }}
              role="group"
              aria-label="View mode"
            >
              <button
                type="button"
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
                className={`grid h-9 w-9 place-items-center rounded-lg ${
                  view === "grid" ? "bg-tdcp-50 text-tdcp-800" : "text-tdcp-500"
                }`}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                type="button"
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
                className={`grid h-9 w-9 place-items-center rounded-lg ${
                  view === "list" ? "bg-tdcp-50 text-tdcp-800" : "text-tdcp-500"
                }`}
              >
                <List size={16} />
              </button>
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-xl border bg-tdcp-50 px-3 py-2 text-sm font-semibold text-tdcp-800 outline-none"
              style={{ borderColor: "var(--surface-border)" }}
            >
              <option value="all">All Restaurants</option>
              <option value="active">Active</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
            {error ? <p className="mb-3 text-sm font-medium text-rose-500">{error}</p> : null}
            {user?.role === "admin" || user?.role === "super_admin" || user?.role === "org_admin" ? (
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex items-center gap-1.5 rounded-xl bg-tdcp-800 px-4 py-2 text-sm font-semibold text-white"
              >
                <Plus size={16} />
                Add restaurant
              </button>
            ) : null}
          </div>
        </div>

        <div className={view === "grid" ? "grid gap-4 lg:grid-cols-2" : "grid gap-4"}>
          {visible.map((r) => (
            <RestaurantCard
              key={r.id}
              restaurant={r}
              compact={view === "list"}
              canToggle={user?.role === "admin" || user?.role === "super_admin" || user?.role === "org_admin"}
              canDelete={canDelete(r)}
              busy={busyId === r.id}
              onToggle={() => toggleStatus(r)}
              onEdit={() => openEdit(r)}
              onDelete={() => deleteSite(r)}
              onOpen={() => openResort(r)}
            />
          ))}
        </div>

        <div
          className="mt-5 grid grid-cols-2 gap-3 rounded-2xl border px-3 py-4 sm:grid-cols-4"
          style={{ borderColor: "var(--surface-border)" }}
        >
          <FootStat icon={Building2} value={totals.count} label="Total Restaurants" />
          <FootStat icon={TrendingUp} value={formatPKR(totals.sales)} label="Total Sales Today" />
          <FootStat icon={ShoppingBag} value={totals.orders} label="Total Orders Today" />
          <FootStat icon={Users} value={totals.users} label="Active Users" />
        </div>
      </section>

      {adding ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={saveNew}
            className="w-full max-w-lg rounded-2xl p-6 shadow-xl"
            style={{ background: "var(--surface)", color: "var(--app-text)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Add restaurant</h3>
              <button type="button" onClick={() => setAdding(false)} className="rounded-lg p-1 hover:bg-tdcp-50" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-3">
              <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                Restaurant name
                <input
                  required
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: "var(--surface-border)", background: "var(--pos-input)", color: "var(--app-text)" }}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: textNameOnly(e.target.value) })}
                />
              </label>
              <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                Location
                <input
                  required
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: "var(--surface-border)", background: "var(--pos-input)", color: "var(--app-text)" }}
                  placeholder="City or area"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: textNameOnly(e.target.value) })}
                />
              </label>
              <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                Photo URL (optional)
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: "var(--surface-border)", background: "var(--pos-input)", color: "var(--app-text)" }}
                  placeholder="https://…"
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                />
              </label>
              {error ? <p className="text-sm font-medium text-rose-500">{error}</p> : null}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border py-2.5 text-sm font-semibold"
                style={{ borderColor: "var(--surface-border)" }}
                onClick={() => setAdding(false)}
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-tdcp-800 py-2.5 text-sm font-semibold text-white">
                {saving ? "Adding…" : "Add restaurant"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={saveDetails}
            className="w-full max-w-lg rounded-2xl p-6 shadow-xl"
            style={{ background: "var(--surface)", color: "var(--app-text)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Edit resort</h3>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg p-1 hover:bg-tdcp-50" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div
              className="mb-4 h-40 overflow-hidden rounded-2xl bg-cover bg-center"
              style={{
                backgroundImage: form.image_url ? `url(${form.image_url})` : "none",
                backgroundColor: "#d5efe3",
              }}
            />
            <div className="grid gap-3">
              <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                Resort name
                <input
                  required
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: "var(--surface-border)", background: "var(--pos-input)", color: "var(--app-text)" }}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: textNameOnly(e.target.value) })}
                />
              </label>
              <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                Location
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: "var(--surface-border)", background: "var(--pos-input)", color: "var(--app-text)" }}
                  placeholder="City or area"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: textNameOnly(e.target.value) })}
                />
              </label>
              <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                Photo URL (optional)
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: "var(--surface-border)", background: "var(--pos-input)", color: "var(--app-text)" }}
                  placeholder="https://…"
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                />
              </label>
              <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                Or upload a photo
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 block w-full text-sm"
                  onChange={(e) => uploadPhoto(e.target.files?.[0])}
                />
              </label>
              {error ? <p className="text-sm font-medium text-rose-500">{error}</p> : null}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border py-2.5 text-sm font-semibold"
                style={{ borderColor: "var(--surface-border)" }}
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-tdcp-800 py-2.5 text-sm font-semibold text-white">
                {saving ? "Saving…" : "Save details"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function RestaurantCard({ restaurant: r, compact, canToggle, canDelete, busy, onToggle, onEdit, onDelete, onOpen }) {
  const active = isActive(r.status);
  return (
    <article
      className={`overflow-hidden rounded-3xl border ${compact ? "sm:flex" : "flex flex-col sm:flex-row"}`}
      style={{ background: "var(--surface)", borderColor: "var(--surface-border)" }}
    >
      <div className={`relative ${compact ? "sm:w-56" : "sm:w-[46%]"} h-44 shrink-0 sm:h-auto min-h-[176px]`}>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: r.image_url ? `url(${r.image_url})` : "none",
            backgroundColor: "#d5efe3",
          }}
        />
        <span
          className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            active ? "bg-white/90 text-emerald-700" : "bg-white/90 text-rose-600"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${active ? "bg-emerald-500" : "bg-rose-500"}`} />
          {active ? "Active" : "Closed"}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-tdcp-50 text-tdcp-700">
            <Building2 size={16} />
          </span>
          <div>
            <h3 className="text-base font-extrabold leading-snug">{r.name}</h3>
            <p className="mt-1 flex items-center gap-1 text-xs" style={{ color: "var(--app-muted)" }}>
              <MapPin size={12} className="text-tdcp-500" />
              {r.location || "—"}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border px-3 py-2.5" style={{ borderColor: "var(--surface-border)" }}>
            <p className="flex items-center gap-1 text-[11px]" style={{ color: "var(--app-muted)" }}>
              <TrendingUp size={12} className="text-tdcp-500" />
              Today&apos;s Sales
            </p>
            <p className="mt-0.5 font-extrabold text-tdcp-800">{formatPKR(r.today_sales || 0)}</p>
          </div>
          <div className="rounded-2xl border px-3 py-2.5" style={{ borderColor: "var(--surface-border)" }}>
            <p className="flex items-center gap-1 text-[11px]" style={{ color: "var(--app-muted)" }}>
              <ShoppingBag size={12} className="text-tdcp-500" />
              Orders
            </p>
            <p className="mt-0.5 font-extrabold text-tdcp-800">{r.today_orders || 0}</p>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
          {canToggle ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold text-tdcp-700"
                style={{ borderColor: "var(--surface-border)" }}
              >
                <Pencil size={14} />
                Edit details
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onToggle}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${
                  active ? "border text-rose-600" : "bg-tdcp-800 text-white"
                }`}
                style={active ? { borderColor: "var(--surface-border)" } : undefined}
              >
                <Power size={14} />
                {busy ? "Saving…" : active ? "Deactivate" : "Activate"}
              </button>
              {canDelete ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onDelete}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              ) : null}
            </div>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-tdcp-700"
          >
            Open this resort
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}

function FootStat({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-3 px-2">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-tdcp-50 text-tdcp-600">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-extrabold leading-tight">{value}</p>
        <p className="text-[11px]" style={{ color: "var(--app-muted)" }}>
          {label}
        </p>
      </div>
    </div>
  );
}
