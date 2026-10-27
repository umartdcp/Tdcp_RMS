import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CakeSlice,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Flame,
  GlassWater,
  ImagePlus,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Utensils,
  UtensilsCrossed,
  X,
} from "lucide-react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { canAccessPath } from "../modules/roles";
import { decimalOnly, textNameOnly } from "../lib/fields";
import { formatPKR } from "../lib/format";
import { menuPhoto } from "../lib/menuPhotos";

const PAGE_SIZE = 16;
const CART_KEY = "tdcp_pending_cart";
const HERO_IMG = "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=900&q=80";

const CHIP_ICONS = {
  All: LayoutGrid,
  Breakfast: Coffee,
  Lunch: Utensils,
  Dinner: UtensilsCrossed,
  Beverages: GlassWater,
  Desserts: CakeSlice,
  BBQ: Flame,
};

const PRICE_RANGES = [
  { id: "all", label: "Price Range" },
  { id: "0-200", label: "Under PKR 200", min: 0, max: 199 },
  { id: "200-500", label: "PKR 200 – 500", min: 200, max: 500 },
  { id: "500-1000", label: "PKR 500 – 1,000", min: 500, max: 1000 },
  { id: "1000+", label: "PKR 1,000+", min: 1000, max: Infinity },
];

const EMPTY = { name: "", price: "", category_id: "", image_url: "", image_base64: "" };

const fieldClass =
  "w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-tdcp-400 focus:ring-4 focus:ring-tdcp-100";

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function pushCart(item) {
  const raw = JSON.parse(sessionStorage.getItem(CART_KEY) || "[]");
  const found = raw.find((p) => p.menu_item_id === item.id);
  if (found) found.qty += 1;
  else {
    raw.push({
      menu_item_id: item.id,
      name: item.name,
      price: Number(item.price),
      qty: 1,
    });
  }
  sessionStorage.setItem(CART_KEY, JSON.stringify(raw));
  return raw.reduce((s, l) => s + l.qty, 0);
}

export default function MenuPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileRef = useRef(null);
  const [data, setData] = useState({ categories: [], items: [] });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [priceRange, setPriceRange] = useState("all");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  async function load() {
    try {
      const res = await api.get("/menu", { __fresh: true });
      if (res?.data?.items) setData(res.data);
    } catch {
      /* keep the menu already saved on this device */
    }
  }

  useEffect(() => {
    load();
    window.addEventListener("tdcp-data-synced", load);
    return () => window.removeEventListener("tdcp-data-synced", load);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(id);
  }, [toast]);

  const categories = useMemo(() => {
    const list = data.categories || [];
    const named = list.filter((c) => c.name && c.name !== "All");
    return [{ id: "all", name: "All" }, ...named];
  }, [data.categories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const range = PRICE_RANGES.find((r) => r.id === priceRange);
    return (data.items || []).filter((item) => {
      if (category !== "All" && item.category_name !== category) return false;
      if (q && !String(item.name).toLowerCase().includes(q)) return false;
      if (range && range.id !== "all") {
        const p = Number(item.price);
        if (p < range.min || p > range.max) return false;
      }
      return true;
    });
  }, [data.items, search, category, priceRange]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(safePage * PAGE_SIZE, filtered.length);

  const inputStyle = {
    background: "var(--pos-input)",
    color: "var(--app-text)",
    borderColor: "var(--surface-border)",
  };

  function openAdd() {
    setError("");
    setForm(EMPTY);
    setModal("add");
  }

  function openEdit(item) {
    setError("");
    setMenuOpen(null);
    setForm({
      id: item.id,
      name: item.name || "",
      price: String(item.price ?? ""),
      category_id: item.category_id ? String(item.category_id) : "",
      image_url: item.image_url || "",
      image_base64: "",
    });
    setModal("edit");
  }

  async function pickImage(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB.");
      return;
    }
    const image_base64 = await readFile(file);
    setForm((f) => ({ ...f, image_base64, image_url: image_base64 }));
  }

  async function save(e) {
    e.preventDefault();
    if (!form.name.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        price: Number(form.price),
        category_id: form.category_id ? Number(form.category_id) : null,
      };
      if (form.image_url && !String(form.image_url).startsWith("data:")) {
        payload.image_url = form.image_url;
      }
      let saved;
      let imageWarning = "";
      if (modal === "edit") {
        saved = (await api.patch(`/menu/${form.id}`, payload)).data;
        if (form.image_base64) {
          try {
            saved = (await api.post(`/menu/${form.id}/image`, { image_base64: form.image_base64 }, { timeout: 60000 })).data;
          } catch (err) {
            imageWarning = err.response?.data?.message || "Item saved, but the photo could not be stored.";
          }
        }
      } else {
        saved = (await api.post("/menu", { ...payload, image_url: payload.image_url || null })).data;
        if (form.image_base64 && saved?.id) {
          try {
            saved = (await api.post(`/menu/${saved.id}/image`, { image_base64: form.image_base64 }, { timeout: 60000 })).data;
          } catch (err) {
            imageWarning = err.response?.data?.message || "Item saved, but the photo could not be stored.";
          }
        }
      }
      const savedId = saved?.id || form.id;
      setModal(null);
      setCategory("All");
      setSearch("");
      const res = await api.get("/menu", { __fresh: true });
      if (res?.data?.items) {
        setData(res.data);
        const index = res.data.items.findIndex((item) => String(item.id) === String(savedId));
        setPage(index >= 0 ? Math.floor(index / PAGE_SIZE) + 1 : 1);
      }
      window.dispatchEvent(new Event("tdcp-menu-changed"));
      setToast(imageWarning || (modal === "edit" ? "Menu item updated" : "Menu item added"));
    } catch (err) {
      setError(err.response?.data?.message || "Could not save this item.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(item) {
    setMenuOpen(null);
    await api.patch(`/menu/${item.id}`, { is_available: !item.is_available });
    window.dispatchEvent(new Event("tdcp-menu-changed"));
    load();
  }

  async function remove(item) {
    if (!window.confirm(`Remove ${item.name} from the menu?`)) return;
    setMenuOpen(null);
    await api.delete(`/menu/${item.id}`);
    window.dispatchEvent(new Event("tdcp-menu-changed"));
    load();
  }

  function addToCart(item) {
    if (!item.is_available) {
      setToast(`${item.name} is not available`);
      return;
    }
    const qty = pushCart(item);
    setToast(`${item.name} added to cart · ${qty} item${qty === 1 ? "" : "s"}`);
  }

  const preview = form.image_url || (modal === "edit" ? menuPhoto(form) : "");

  return (
    <div className="space-y-4">
      <section
        className="relative overflow-hidden rounded-3xl px-5 py-6 text-tdcp-950 sm:px-8 sm:py-8"
        style={{
          background:
            "linear-gradient(100deg, rgba(232,247,239,0.97) 0%, rgba(232,247,239,0.88) 42%, rgba(232,247,239,0.35) 100%)",
        }}
      >
        <img
          src={HERO_IMG}
          alt=""
          className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[42%] object-cover md:block"
        />
        <div className="pointer-events-none absolute inset-y-0 right-[28%] hidden w-40 bg-gradient-to-r from-[#e8f7ef] to-transparent md:block" />
        <p className="relative text-[11px] font-bold uppercase tracking-[0.2em] text-tdcp-600">Our menu</p>
        <h2 className="relative mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">Delicious Food, Great Moments</h2>
        <p className="relative mt-1 max-w-xl text-sm" style={{ color: "var(--app-muted)" }}>
          Explore our menu and enjoy the best flavors at TDCP restaurants.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tdcp-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search item..."
            className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm outline-none"
            style={inputStyle}
          />
        </div>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="min-w-[140px] rounded-xl border px-3 py-2.5 text-sm"
          style={inputStyle}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name === "All" ? "Category" : c.name}
            </option>
          ))}
        </select>
        <select
          value={priceRange}
          onChange={(e) => {
            setPriceRange(e.target.value);
            setPage(1);
          }}
          className="min-w-[150px] rounded-xl border px-3 py-2.5 text-sm"
          style={inputStyle}
        >
          {PRICE_RANGES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-tdcp-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
        >
          <Plus size={16} />
          Add Item
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((c) => {
          const Icon = CHIP_ICONS[c.name] || LayoutGrid;
          const active = category === c.name;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCategory(c.name);
                setPage(1);
              }}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold ${
                active ? "bg-tdcp-800 text-white" : "border bg-white text-tdcp-800"
              }`}
              style={active ? undefined : { borderColor: "var(--surface-border)", color: "var(--app-text)" }}
            >
              <Icon size={14} />
              {c.name}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {slice.map((item) => (
          <article
            key={item.id}
            className="overflow-hidden rounded-3xl border bg-white shadow-sm"
            style={{ borderColor: "var(--surface-border)", background: "var(--surface)", color: "var(--app-text)" }}
          >
            <div className="relative h-40">
              <img src={menuPhoto(item)} alt="" className="h-full w-full object-cover" />
              <span
                className={`absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  item.is_available ? "bg-white/90 text-tdcp-700" : "bg-slate-800/80 text-white"
                }`}
              >
                {item.is_available ? "Available" : "Hidden"}
              </span>
              <div className="absolute left-2 top-2">
                <button
                  type="button"
                  aria-label={`More actions for ${item.name}`}
                  onClick={() => setMenuOpen(menuOpen === item.id ? null : item.id)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-tdcp-800"
                >
                  <MoreHorizontal size={16} />
                </button>
                {menuOpen === item.id ? (
                  <div
                    className="absolute left-0 top-9 z-10 w-36 overflow-hidden rounded-xl border bg-white py-1 text-sm shadow-lg"
                    style={{ borderColor: "var(--surface-border)", background: "var(--surface)" }}
                  >
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 hover:bg-tdcp-50" onClick={() => openEdit(item)}>
                      <Pencil size={14} /> Edit
                    </button>
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 hover:bg-tdcp-50" onClick={() => toggle(item)}>
                      {item.is_available ? "Hide item" : "Make available"}
                    </button>
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-rose-500 hover:bg-rose-50" onClick={() => remove(item)}>
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold leading-tight">{item.name}</p>
              </div>
              <p className="mt-1 text-lg font-extrabold text-tdcp-800">{formatPKR(item.price)}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs" style={{ color: "var(--app-muted)" }}>
                  {item.category_name || "Menu"}
                </span>
                {canAccessPath(user, "/pos") ? (
                  <button
                    type="button"
                    onClick={() => addToCart(item)}
                    disabled={!item.is_available}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-tdcp-800 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    <ShoppingCart size={13} />
                    Add to Cart
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>

      {!slice.length ? (
        <p className="py-10 text-center text-sm" style={{ color: "var(--app-muted)" }}>
          No menu items match these filters.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs" style={{ color: "var(--app-muted)" }}>
          Showing {from} to {to} of {filtered.length} items
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

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-tdcp-900 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          {toast}
          {canAccessPath(user, "/pos") ? (
            <button type="button" className="rounded-lg bg-white/15 px-2 py-1 text-xs" onClick={() => navigate("/pos")}>
              Open POS
            </button>
          ) : null}
        </div>
      ) : null}

      {modal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(null)}>
          <form
            onSubmit={save}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl p-6 shadow-xl"
            style={{ background: "var(--surface)", color: "var(--app-text)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{modal === "edit" ? "Edit item" : "Add Item"}</h3>
              <button type="button" onClick={() => setModal(null)} className="rounded-lg p-1 hover:bg-tdcp-50" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-tdcp-50">
                  {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={20} className="text-tdcp-500" />}
                </span>
                <div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="rounded-xl border px-3 py-2 text-xs font-semibold"
                    style={{ borderColor: "var(--surface-border)" }}
                  >
                    Upload photo
                  </button>
                </div>
              </div>
              <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                Item name
                <input
                  required
                  className={`${fieldClass} mt-1`}
                  style={inputStyle}
                  placeholder="e.g. Chicken Karahi"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: textNameOnly(e.target.value) })}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                  Price (PKR)
                  <input
                    required
                    inputMode="decimal"
                    className={`${fieldClass} mt-1`}
                    style={inputStyle}
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: decimalOnly(e.target.value) })}
                  />
                </label>
                <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                  Category
                  <select
                    className={`${fieldClass} mt-1`}
                    style={inputStyle}
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  >
                    <option value="">Select</option>
                    {categories
                      .filter((c) => c.name !== "All")
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                Image URL (optional)
                <input
                  className={`${fieldClass} mt-1`}
                  style={inputStyle}
                  placeholder="https://…"
                  value={form.image_base64 ? "" : form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value, image_base64: "" })}
                />
              </label>
              {error ? <p className="text-sm text-rose-500">{error}</p> : null}
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" className="flex-1 rounded-xl border py-2.5 text-sm font-semibold" style={{ borderColor: "var(--surface-border)" }} onClick={() => setModal(null)}>
                Cancel
              </button>
              <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-tdcp-800 py-2.5 text-sm font-semibold text-white">
                {busy ? "Saving…" : modal === "edit" ? "Save changes" : "Add item"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
