import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";

const columns = [
  { key: "new", title: "New Orders", tone: "border-emerald-200 bg-emerald-50/60" },
  { key: "preparing", title: "Preparing", tone: "border-amber-200 bg-amber-50/60" },
  { key: "ready", title: "Ready", tone: "border-lime-200 bg-lime-50/70" },
];

const nextStatus = { new: "preparing", preparing: "ready" };
const actionLabel = { new: "Accept", preparing: "Mark Ready" };

export default function KDS() {
  const { activeRestaurantId } = useAuth();
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const saving = useRef(false);

  async function load() {
    if (saving.current) return;
    try {
      const { data } = await api.get("/orders");
      setOrders(
        (data || []).filter((o) => {
          const status = String(o.status || "").toLowerCase();
          return ["new", "preparing", "ready"].includes(status) && o.payment_status !== "paid";
        })
      );
    } catch {
      /* keep the kitchen tickets already saved on this device */
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    window.addEventListener("tdcp-data-synced", load);
    return () => {
      clearInterval(t);
      window.removeEventListener("tdcp-data-synced", load);
    };
  }, [activeRestaurantId]);

  const grouped = useMemo(() => {
    const g = { new: [], preparing: [], ready: [] };
    orders.forEach((o) => {
      const status = String(o.status || "").toLowerCase();
      if (g[status]) g[status].push(o);
    });
    return g;
  }, [orders]);

  async function advance(order) {
    const current = String(order.status || "").toLowerCase();
    const status = nextStatus[current];
    if (!status) return;
    saving.current = true;
    setError("");
    setOrders((prev) => prev.map((row) => (row.id === order.id ? { ...row, status } : row)));
    try {
      await api.patch(`/orders/${order.id}`, { status });
    } catch (err) {
      setError(err.response?.data?.message || "Could not accept this order.");
    } finally {
      saving.current = false;
      await load();
    }
  }

  async function cancel(order) {
    if (!window.confirm(`Cancel order #${order.order_no}?`)) return;
    try {
      await api.patch(`/orders/${order.id}`, { status: "cancelled" });
      await load();
    } catch (err) {
      window.alert(err.response?.data?.message || "Could not cancel this order.");
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Kitchen Display System (KDS)</h2>
      </div>
      {error ? <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{error}</p> : null}
      <div className="grid gap-4 xl:grid-cols-3">
        {columns.map((col) => (
          <div key={col.key} className={`rounded-2xl border p-3 ${col.tone}`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">{col.title}</h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs">{grouped[col.key].length}</span>
            </div>
            <div className="space-y-3">
              {grouped[col.key].map((order) => (
                <article key={order.id} className="rounded-xl border border-white/80 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold">#{order.order_no}</span>
                    <span className="text-slate-500">Table {order.table_label || "--"}</span>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {(order.items || []).map((item) => (
                      <li key={item.id}>
                        {item.qty} × {item.name}
                      </li>
                    ))}
                  </ul>
                  {order.note ? <p className="mt-2 text-xs text-rose-600">Note: {order.note}</p> : null}
                  {nextStatus[String(order.status || "").toLowerCase()] ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => cancel(order)}
                        className="rounded-lg border py-1.5 text-sm font-semibold text-rose-500"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => advance(order)}
                        className="rounded-lg bg-tdcp-700 py-1.5 text-sm font-semibold text-white"
                      >
                        {actionLabel[String(order.status || "").toLowerCase()]}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-3 text-center text-xs font-semibold text-emerald-700">Ready for payment on Orders</p>
                  )}
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
