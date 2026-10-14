import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ExternalLink,
  Building2,
  MapPin,
  Pencil,
  Plus,
  Power,
  Trash2,
  ShoppingBag,
  TrendingUp,
  Utensils,
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
    window.addEventListener("tdcp-data-synced", load);
    return () => window.removeEventListener("tdcp-data-synced", load);
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
      const preview = data.image_url || image_base64;
      setForm((f) => ({ ...f, image_url: preview }));
      setEditing((prev) => ({ ...prev, ...data, image_url: preview }));
      setRows((prev) => prev.map((row) => (row.id === editing.id ? { ...row, ...data, image_url: preview } : row)));
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

        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((r) => (
            <RestaurantCard
              key={r.id}
              restaurant={r}
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
            <div className="mb-4 h-40 overflow-hidden rounded-2xl bg-[#d5efe3]">
              {form.image_url ? (
                <img
                  src={form.image_url}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="grid h-full place-items-center text-sm text-slate-500">Photo preview</div>
              )}
            </div>
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

function RestaurantCard({ restaurant: r, canToggle, canDelete, busy, onToggle, onEdit, onDelete, onOpen }) {
  const active = isActive(r.status);
  const outline = "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold";
  return (
    <article className="flex flex-col gap-4 rounded-[28px] border border-[#e6eef2] bg-white p-4 shadow-sm sm:flex-row">
      <div className="relative h-52 w-full shrink-0 overflow-hidden rounded-2xl bg-[#d5efe3] sm:h-auto sm:w-60">
        {r.image_url ? <img src={r.image_url} alt="" className="h-full w-full object-cover" /> : null}
        <span
          className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold tracking-wide ${
            active ? "text-emerald-600" : "text-rose-500"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${active ? "bg-emerald-500" : "bg-rose-500"}`} />
          {active ? "ACTIVE" : "CLOSED"}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e7f6ee] text-[#16845c]">
            <Utensils size={18} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-extrabold text-[#16324a]">{r.name}</h3>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
              <MapPin size={13} className="text-[#16845c]" />
              {r.location || "—"}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#f4fbf7] px-3 py-3">
            <p className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
              <TrendingUp size={12} className="text-[#16845c]" />
              Today&apos;s Sales
            </p>
            <p className="mt-1 text-xl font-extrabold text-[#16324a]">{formatPKR(r.today_sales || 0)}</p>
          </div>
          <div className="rounded-2xl bg-[#f4fbf7] px-3 py-3">
            <p className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
              <ShoppingBag size={12} className="text-[#16845c]" />
              Orders
            </p>
            <p className="mt-1 text-xl font-extrabold text-[#16324a]">{r.today_orders || 0}</p>
          </div>
        </div>

        {canToggle ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={onEdit} className={`${outline} border-[#b7e7cf] text-[#16845c]`}>
              <Pencil size={14} />
              Edit details
            </button>
            <button type="button" disabled={busy} onClick={onToggle} className={`${outline} border-rose-200 text-rose-500 disabled:opacity-60`}>
              <Power size={14} />
              {busy ? "Saving…" : active ? "Deactivate" : "Activate"}
            </button>
            {canDelete ? (
              <button type="button" disabled={busy} onClick={onDelete} className={`${outline} border-rose-200 text-rose-500 disabled:opacity-60`}>
                <Trash2 size={14} />
                Delete
              </button>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={onOpen}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0e4a34] px-4 py-3 text-sm font-semibold text-white"
        >
          <ExternalLink size={15} />
          Open this resort
          <ArrowRight size={15} className="ml-auto" />
        </button>
      </div>
    </article>
  );
}
