import { useEffect, useState } from "react";
import {
  CakeSlice,
  Coffee,
  CupSoda,
  Flame,
  Home,
  LayoutGrid,
  Pencil,
  Plus,
  Salad,
  Soup,
  Tag,
  Trash2,
  Utensils,
  UtensilsCrossed,
  Wheat,
} from "lucide-react";
import api from "../api";
import { FieldError, isTextName, textNameOnly } from "../lib/fields";
import { useAuth } from "../context/AuthContext";

const HERO_IMG =
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1400&q=80";

const CAT_META = {
  breakfast: { Icon: Coffee, chip: "bg-emerald-100 text-emerald-700" },
  bbq: { Icon: Flame, chip: "bg-rose-100 text-rose-600" },
  lunch: { Icon: Utensils, chip: "bg-orange-100 text-orange-600" },
  dinner: { Icon: UtensilsCrossed, chip: "bg-violet-100 text-violet-600" },
  soups: { Icon: Soup, chip: "bg-cyan-100 text-cyan-700" },
  soup: { Icon: Soup, chip: "bg-cyan-100 text-cyan-700" },
  "salad bar": { Icon: Salad, chip: "bg-lime-100 text-lime-700" },
  salad: { Icon: Salad, chip: "bg-lime-100 text-lime-700" },
  rice: { Icon: Wheat, chip: "bg-amber-100 text-amber-700" },
  snacks: { Icon: Tag, chip: "bg-fuchsia-100 text-fuchsia-600" },
  beverages: { Icon: CupSoda, chip: "bg-blue-100 text-blue-600" },
  drinks: { Icon: CupSoda, chip: "bg-blue-100 text-blue-600" },
  desserts: { Icon: CakeSlice, chip: "bg-purple-100 text-purple-600" },
  dessert: { Icon: CakeSlice, chip: "bg-purple-100 text-purple-600" },
  deserts: { Icon: Home, chip: "bg-pink-100 text-pink-600" },
};

const FALLBACK_CHIPS = [
  "bg-emerald-100 text-emerald-700",
  "bg-rose-100 text-rose-600",
  "bg-orange-100 text-orange-600",
  "bg-violet-100 text-violet-600",
  "bg-cyan-100 text-cyan-700",
  "bg-lime-100 text-lime-700",
  "bg-amber-100 text-amber-700",
  "bg-fuchsia-100 text-fuchsia-600",
  "bg-blue-100 text-blue-600",
  "bg-purple-100 text-purple-600",
];

function categoryStyle(name, index) {
  const key = String(name || "").trim().toLowerCase();
  if (CAT_META[key]) return CAT_META[key];
  return { Icon: Tag, chip: FALLBACK_CHIPS[index % FALLBACK_CHIPS.length] };
}

export default function MenuCategories() {
  const { user, activeRestaurant } = useAuth();
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const { data } = await api.get("/menu");
      setCategories((data?.categories || []).filter((c) => c.name && c.name !== "All"));
    } catch {
      /* keep the categories already saved on this device */
    }
  }

  useEffect(() => {
    load();
    window.addEventListener("tdcp-data-synced", load);
    return () => window.removeEventListener("tdcp-data-synced", load);
  }, [activeRestaurant?.id, user?.restaurant_id]);

  function resetForm() {
    setName("");
    setEditing(null);
    setError("");
  }

  async function save(e) {
    e.preventDefault();
    const value = name.trim();
    if (!isTextName(value)) {
      setError("Category name can only contain letters.");
      return;
    }
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (editing) {
        await api.patch(`/menu/categories/${editing.id}`, { name: value });
      } else {
        await api.post("/menu/categories", { name: value });
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save this category.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(row) {
    setEditing(row);
    setName(row.name);
    setError("");
  }

  async function remove(row) {
    if (!window.confirm(`Remove category “${row.name}”? Dishes in it stay on the menu.`)) return;
    await api.delete(`/menu/categories/${row.id}`);
    if (editing?.id === row.id) resetForm();
    load();
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-sm">
        <div className="relative overflow-hidden bg-gradient-to-r from-[#e7f6ee] via-white to-transparent px-5 py-5 sm:px-7">
          <img
            src={HERO_IMG}
            alt=""
            className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[46%] object-cover object-[center_35%] md:block"
          />
          <div className="pointer-events-none absolute inset-y-0 right-[28%] hidden w-36 bg-gradient-to-r from-white to-transparent md:block" />
          <div className="relative flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-tdcp-800 text-white shadow-md">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 18h16" strokeLinecap="round" />
                <path d="M6 18c0-5 2.5-9 6-9s6 4 6 9" strokeLinecap="round" />
                <circle cx="12" cy="7" r="1.2" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-tdcp-800">Add Category</h2>
              <p className="mt-0.5 max-w-xl text-sm text-slate-500">
                This list is the same for every TDCP resort. Add once, and it appears on POS and Add Menu everywhere.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={save} className="flex flex-wrap items-end gap-3 px-5 py-4 sm:px-7">
          <label className="min-w-[240px] flex-1 text-sm font-semibold text-tdcp-800">
            Category Name
            <span className="relative mt-1.5 block">
              <Tag size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-medium text-tdcp-900 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-tdcp-400 focus:ring-4 focus:ring-tdcp-100"
                placeholder="e.g. Breakfast, BBQ, Desserts..."
                value={name}
                onChange={(e) => {
                  setName(textNameOnly(e.target.value));
                  setError("");
                }}
              />
            </span>
            <FieldError message={error} />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="mb-0.5 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-tdcp-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
          >
            <Plus size={16} />
            {busy ? "Saving…" : editing ? "Update Category" : "Save Category"}
          </button>
          {editing ? (
            <button
              type="button"
              onClick={resetForm}
              className="mb-0.5 text-sm font-semibold text-slate-500 hover:text-tdcp-800"
            >
              Cancel edit
            </button>
          ) : null}
        </form>
      </section>

      <section
        className="overflow-hidden rounded-[28px] border bg-white shadow-sm"
        style={{ borderColor: "var(--surface-border)" }}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2 text-tdcp-800">
            <LayoutGrid size={18} />
            <h3 className="text-lg font-extrabold">Main Menu</h3>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-tdcp-700">
            {categories.length} {categories.length === 1 ? "Category" : "Categories"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-xs font-semibold text-slate-400">
                <th className="w-16 px-6 py-2 font-semibold">#</th>
                <th className="px-3 py-2 font-semibold">Category Name</th>
                <th className="w-28 px-6 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.length ? (
                categories.map((row, i) => {
                  const { Icon, chip } = categoryStyle(row.name, i);
                  return (
                    <tr key={row.id} className={i % 2 === 0 ? "bg-[#f3faf6]" : "bg-white"}>
                      <td className="px-6 py-3.5 text-slate-500">{i + 1}</td>
                      <td className="px-3 py-3.5">
                        <span className="inline-flex items-center gap-3 font-semibold text-tdcp-900">
                          <span className={`grid h-8 w-8 place-items-center rounded-full ${chip}`}>
                            <Icon size={15} />
                          </span>
                          {row.name}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            aria-label={`Edit ${row.name}`}
                            onClick={() => startEdit(row)}
                            className="grid h-8 w-8 place-items-center rounded-full bg-emerald-50 text-tdcp-700 hover:bg-emerald-100"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${row.name}`}
                            onClick={() => remove(row)}
                            className="grid h-8 w-8 place-items-center rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-sm text-slate-400">
                    No categories yet. Add one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
