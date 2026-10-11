import { useEffect, useMemo, useRef, useState } from "react";
import {
  Armchair,
  CakeSlice,
  ChefHat,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Coffee,
  Crown,
  CupSoda,
  Flame,
  Home,
  LayoutGrid,
  Leaf,
  Minus,
  Plus,
  Search,
  SlidersHorizontal,
  Soup,
  StickyNote,
  Trash2,
  Trees,
  Umbrella,
  Users,
  Utensils,
  UtensilsCrossed,
  Wheat,
  X,
} from "lucide-react";
import api from "../api";
import { formatPKR } from "../lib/format";
import { DEFAULT_MENU_PHOTOS } from "../lib/menuPhotos";
import { withTax } from "../lib/tax";

const CAT_ICONS = {
  All: LayoutGrid,
  Breakfast: Coffee,
  Lunch: Utensils,
  Dinner: UtensilsCrossed,
  Soups: Soup,
  Soup: Soup,
  "Salad Bar": Leaf,
  Salad: Leaf,
  BBQ: Flame,
  Rice: Wheat,
  Snacks: Utensils,
  Beverages: CupSoda,
  Drinks: CupSoda,
  Desserts: CakeSlice,
  Dessert: CakeSlice,
};

const BADGES = {
  "Beef Pulao": "Popular",
  "Chicken Biryani": "Popular",
  "Chicken Corn Soup": "Popular",
  "Chicken Karahi": "Popular",
};

function photoFor(item) {
  return item?.image_url || DEFAULT_MENU_PHOTOS[item?.name] || "";
}

function itemMark(item) {
  const n = String(item?.name || "").trim();
  return n ? n.charAt(0).toUpperCase() : "M";
}

const TABLE_SECTIONS = ["Main Hall", "Outdoor", "VIP Area"];
const TABLE_LOOK = {
  "Main Hall": { HeaderIcon: Home, RowIcon: Armchair },
  Outdoor: { HeaderIcon: Trees, RowIcon: Umbrella },
  "VIP Area": { HeaderIcon: Crown, RowIcon: Crown },
};

function padTable(label) {
  const n = Number(label);
  return Number.isFinite(n) ? String(n).padStart(2, "0") : label;
}

function tableTitle(table) {
  return `${padTable(table.label)} · ${table.section} (${table.seats})`;
}

function TablePicker({ tables, value, onChange, compact }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const box = useRef(null);
  const selected = tables.find((t) => String(t.id) === String(value));
  const { RowIcon: SelectedIcon } = TABLE_LOOK[selected?.section] || { RowIcon: Armchair };

  useEffect(() => {
    function close(e) {
      if (box.current && !box.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = {};
    tables.forEach((t) => {
      const hay = `${padTable(t.label)} ${t.label} ${t.section} ${t.seats} ${tableTitle(t)}`.toLowerCase();
      if (q && !hay.includes(q)) return;
      (map[t.section] ||= []).push(t);
    });
    return Object.keys(map)
      .sort((a, b) => {
        const ia = TABLE_SECTIONS.indexOf(a);
        const ib = TABLE_SECTIONS.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })
      .map((section) => [section, map[section]]);
  }, [tables, query]);

  const label = selected ? `Table ${padTable(selected.label)} · ${selected.section}` : "Select a table";

  return (
    <div ref={box} className={compact ? "relative" : ""}>
      {compact ? null : (
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-tdcp-700">Table</p>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          compact
            ? "flex max-w-full items-center gap-1 truncate text-left text-xs text-white/80"
            : "flex w-full items-center gap-3 rounded-2xl border-2 border-tdcp-700 px-3 py-2.5 text-left"
        }
        style={compact ? undefined : { background: "var(--pos-input)", color: "var(--pos-text)" }}
      >
        {compact ? null : (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-tdcp-50 text-tdcp-700">
            <SelectedIcon size={16} />
          </span>
        )}
        <span className={`min-w-0 flex-1 truncate ${compact ? "font-medium" : "text-sm font-semibold"}`}>
          {label}
        </span>
        <ChevronDown size={compact ? 14 : 18} className={`shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div
          className={`${compact ? "absolute left-0 top-7 z-30 w-[260px]" : "mt-2"} overflow-hidden rounded-2xl border bg-white text-tdcp-900 shadow-lg`}
        >
          <div className="p-3">
            <label className="flex items-center gap-2 rounded-full border border-tdcp-200 px-3 py-2">
              <Search size={15} className="text-tdcp-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search table..."
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
          </div>
          <div className="max-h-[240px] overflow-y-auto px-2 pb-2">
            {grouped.length ? (
              grouped.map(([section, rows], index) => (
                <div key={section} className={index ? "mt-2 border-t border-tdcp-100 pt-2" : ""}>
                  <p className="mb-1 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-tdcp-700">{section}</p>
                  {rows.map((table) => {
                    const active = String(table.id) === String(value);
                    return (
                      <button
                        type="button"
                        key={table.id}
                        onClick={() => {
                          onChange(String(table.id));
                          setOpen(false);
                          setQuery("");
                        }}
                        className={`mb-1 flex w-full items-center rounded-xl px-3 py-2 text-left text-sm ${
                          active ? "bg-tdcp-800 text-white" : "hover:bg-tdcp-50"
                        }`}
                      >
                        Table {padTable(table.label)} · {table.section}
                      </button>
                    );
                  })}
                </div>
              ))
            ) : (
              <p className="px-3 py-6 text-center text-sm text-slate-500">No tables available.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CartThumb({ line, menuItems, broken, onBroken }) {
  const source = menuItems.find((i) => i.id === line.menu_item_id) || line;
  const photo = broken.includes(source.id || line.menu_item_id) ? "" : photoFor(source);
  if (photo) {
    return (
      <img
        src={photo}
        alt=""
        className="h-12 w-12 shrink-0 rounded-xl object-cover"
        onError={() =>
          onBroken((prev) =>
            prev.includes(source.id || line.menu_item_id) ? prev : [...prev, source.id || line.menu_item_id]
          )
        }
      />
    );
  }
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-tdcp-50 text-lg font-bold text-tdcp-800">
      {itemMark(line)}
    </span>
  );
}

function MenuCard({ item, broken, onBroken, onAdd }) {
  const badge = BADGES[item.name];
  const photo = broken.includes(item.id) ? "" : photoFor(item);

  return (
    <article className="overflow-hidden rounded-3xl bg-white shadow-sm">
      <div className="relative h-36 sm:h-40">
        {photo ? (
          <img
            src={photo}
            alt=""
            className="h-full w-full object-cover"
            onError={() => onBroken((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]))}
          />
        ) : (
          <div className="grid h-full place-items-center bg-tdcp-50 text-4xl font-bold text-tdcp-800">{itemMark(item)}</div>
        )}
        {badge ? (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-bold text-rose-500 shadow-sm">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 px-3.5 py-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-tdcp-900">{item.name}</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-500">{formatPKR(item.price)}</p>
        </div>
        <button
          type="button"
          aria-label={`Add ${item.name}`}
          onClick={() => onAdd(item)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-tdcp-800 text-white"
        >
          <Plus size={16} />
        </button>
      </div>
    </article>
  );
}

export default function POS() {
  const [menu, setMenu] = useState({ categories: [], items: [] });
  const [tables, setTables] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [tableId, setTableId] = useState("");
  const [guest, setGuest] = useState(2);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [brokenPhotos, setBrokenPhotos] = useState([]);

  useEffect(() => {
    Promise.all([api.get("/menu"), api.get("/tables")])
      .then(([m, t]) => {
        setMenu(m.data);
        setTables(t.data);
        if (t.data[0]) setTableId(String(t.data[0].id));
        try {
          const pending = JSON.parse(sessionStorage.getItem("tdcp_pending_cart") || "[]");
          if (Array.isArray(pending) && pending.length) {
            setCart((prev) => {
              const next = [...prev];
              for (const line of pending) {
                const found = next.find((p) => p.menu_item_id === line.menu_item_id);
                if (found) found.qty += Number(line.qty || 1);
                else next.push({ ...line, qty: Number(line.qty || 1), price: Number(line.price) });
              }
              return next;
            });
            sessionStorage.removeItem("tdcp_pending_cart");
            setMessage({ tone: "success", text: "Items from the menu were added to this ticket." });
          }
        } catch {
          /* ignore */
        }
      })
      .catch(() => setMessage({ tone: "error", text: "Could not load the menu. Please refresh." }))
      .finally(() => setLoaded(true));
  }, []);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menu.items.filter(
      (i) =>
        (category === "All" || i.category_name === category) &&
        (!q || i.name.toLowerCase().includes(q))
    );
  }, [menu, category, search]);

  const counts = useMemo(() => {
    const map = { All: menu.items.length };
    for (const i of menu.items) map[i.category_name] = (map[i.category_name] || 0) + 1;
    return map;
  }, [menu]);

  const categories = useMemo(() => {
    const rest = menu.categories || [];
    if (rest.some((c) => c.name === "All")) return rest;
    return [{ id: "all", name: "All" }, ...rest];
  }, [menu]);

  const total = withTax(cart.reduce((s, i) => s + i.price * i.qty, 0)).total;

  function add(item) {
    setCart((prev) => {
      const found = prev.find((p) => p.menu_item_id === item.id);
      if (found)
        return prev.map((p) => (p.menu_item_id === item.id ? { ...p, qty: p.qty + 1 } : p));
      return [
        ...prev,
        {
          menu_item_id: item.id,
          name: item.name,
          price: Number(item.price),
          image_url: item.image_url,
          qty: 1,
        },
      ];
    });
  }

  function changeQty(id, delta) {
    setCart((prev) =>
      prev
        .map((p) => (p.menu_item_id === id ? { ...p, qty: p.qty + delta } : p))
        .filter((p) => p.qty > 0)
    );
  }

  function removeLine(id) {
    setCart((prev) => prev.filter((p) => p.menu_item_id !== id));
  }

  function resetOrder() {
    if (cart.length && !window.confirm("Clear this ticket and start a new order?")) return;
    setCart([]);
    setNote("");
    setGuest(2);
    setCategory("All");
    setSearch("");
    setMessage(null);
    if (tables[0]) setTableId(String(tables[0].id));
  }

  async function proceedToKds() {
    if (!cart.length || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const { data } = await api.post("/orders", {
        table_id: Number(tableId) || null,
        items: cart,
        note,
        status: "new",
      });
      setCart([]);
      setNote("");
      setMessage({
        tone: "success",
        text: data.offline
          ? `Order #${data.order_no} is saved on this device and will sync to the database when the connection is back.`
          : `Order #${data.order_no} sent to the kitchen (KDS).`,
      });
    } catch (err) {
      setMessage({
        tone: "error",
        text: err.response?.data?.message || "Could not send this order to KDS.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full px-5 py-4 lg:px-6 lg:py-5" style={{ color: "var(--pos-text)" }}>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="min-w-[220px]">
              <h2 className="text-3xl font-extrabold leading-none tracking-tight text-tdcp-800">Menu</h2>
              <p className="mt-1.5 text-sm text-slate-500">Select a category and add items to your order</p>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-[300px]">
              <div className="relative min-w-0 flex-1">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search dishes..."
                  className="h-11 w-full rounded-full border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none placeholder:text-slate-400 focus:border-tdcp-400 focus:ring-4 focus:ring-tdcp-100"
                />
              </div>
              <button
                type="button"
                aria-label="Filters"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-tdcp-700"
              >
                <SlidersHorizontal size={16} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 rounded-[28px] bg-white p-3 shadow-sm">
            {categories.map((c) => {
              const active = category === c.name;
              const n = c.name === "All" ? menu.items.length : counts[c.name] || 0;
              const Icon = CAT_ICONS[c.name] || Utensils;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.name)}
                  className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                    active ? "bg-tdcp-800 text-white shadow-sm" : "bg-[#f3faf6] text-tdcp-700 hover:bg-tdcp-50"
                  }`}
                >
                  <Icon size={15} />
                  {c.name}
                  <span className={`text-xs font-bold ${active ? "text-white/80" : "text-tdcp-500"}`}>{n}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-tdcp-800">
              {category === "All" ? "All Items" : category}
            </h3>
            <span className="text-sm text-slate-400">{items.length} items</span>
          </div>

          {!loaded ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-52 animate-pulse rounded-3xl bg-white" />
              ))}
            </div>
          ) : items.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => (
                <MenuCard
                  key={item.id}
                  item={item}
                  broken={brokenPhotos}
                  onBroken={setBrokenPhotos}
                  onAdd={add}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
              No dishes match your search.
            </div>
          )}
        </section>

        <aside className="overflow-hidden rounded-[28px] bg-white shadow-sm xl:sticky xl:top-2">
          <div className="flex items-center justify-between gap-3 bg-tdcp-800 px-5 py-4 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
                <ClipboardList size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold">Current Order</p>
                <div className="mt-0.5">
                  <TablePicker tables={tables} value={tableId} onChange={setTableId} compact />
                </div>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold">
              <Users size={12} />
              {guest || 0} Guests
            </span>
          </div>

          <div className="space-y-4 p-5">
            {message ? (
              <div
                className={`flex items-start gap-2 rounded-2xl px-3.5 py-3 text-sm ${
                  message.tone === "error" ? "bg-rose-50 text-rose-700" : "bg-tdcp-50 text-tdcp-800"
                }`}
              >
                {message.tone === "error" ? (
                  <CircleAlert size={16} className="mt-0.5 shrink-0" />
                ) : (
                  <CircleCheck size={16} className="mt-0.5 shrink-0" />
                )}
                <p className="flex-1 font-medium">{message.text}</p>
                <button type="button" onClick={() => setMessage(null)} className="opacity-60">
                  <X size={14} />
                </button>
              </div>
            ) : null}

            {cart.length ? (
              <ul className="max-h-[32vh] space-y-4 overflow-y-auto pr-1">
                {cart.map((line) => (
                  <li key={line.menu_item_id} className="flex items-center gap-3">
                    <CartThumb line={line} menuItems={menu.items} broken={brokenPhotos} onBroken={setBrokenPhotos} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-tdcp-900">{line.name}</p>
                      <div className="mt-1 flex items-center gap-2 text-slate-400">
                        <button
                          type="button"
                          onClick={() => changeQty(line.menu_item_id, -1)}
                          className="grid h-6 w-6 place-items-center rounded-full hover:bg-slate-100"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="min-w-4 text-center text-sm font-bold text-tdcp-800">{line.qty}</span>
                        <button
                          type="button"
                          onClick={() => changeQty(line.menu_item_id, 1)}
                          className="grid h-6 w-6 place-items-center rounded-full hover:bg-slate-100"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-tdcp-800">{formatPKR(line.price * line.qty)}</p>
                    <button
                      type="button"
                      onClick={() => removeLine(line.menu_item_id)}
                      className="text-rose-400 hover:text-rose-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl bg-[#f3faf6] px-4 py-8 text-center text-sm text-slate-500">
                Tap a dish to start this order.
              </p>
            )}

            <label className="block text-sm font-semibold text-tdcp-800">
              <span className="mb-1.5 flex items-center gap-2">
                <Users size={15} /> Guests
              </span>
              <select
                value={guest}
                onChange={(e) => setGuest(Number(e.target.value))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-semibold text-tdcp-800">
              <span className="mb-1.5 flex items-center gap-2">
                <StickyNote size={15} /> Kitchen Note
              </span>
              <textarea
                className="w-full resize-none rounded-2xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none placeholder:text-slate-400"
                rows="2"
                maxLength={200}
                placeholder="e.g. less spicy, serve naan first..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>

            <div className="space-y-2 border-t border-slate-100 pt-3 text-sm">
              <div className="flex items-center justify-between rounded-2xl bg-[#eef8f3] px-4 py-3">
                <span className="font-bold text-tdcp-800">Total Payable</span>
                <span className="text-lg font-extrabold text-tdcp-800">{formatPKR(total)}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={!cart.length || busy}
              onClick={proceedToKds}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-tdcp-700 via-tdcp-500 to-tdcp-400 py-3.5 font-bold text-white shadow-lg shadow-tdcp-600/25 transition hover:shadow-xl hover:shadow-tdcp-600/30 disabled:cursor-not-allowed disabled:from-slate-300 disabled:via-slate-300 disabled:to-slate-300 disabled:shadow-none"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
              />
              <ChefHat size={18} className="relative" />
              <span className="relative">
                {busy ? "Sending to kitchen…" : "Proceed to KDS"}
              </span>
            </button>
            <button
              type="button"
              onClick={resetOrder}
              disabled={!cart.length && !note}
              className="flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-rose-400 disabled:opacity-30"
            >
              <Trash2 size={15} />
              Clear Ticket
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
