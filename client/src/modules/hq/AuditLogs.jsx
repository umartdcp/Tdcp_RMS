import { useEffect, useMemo, useState } from "react";
import { Filter, ScrollText, Search } from "lucide-react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { isMainAdmin, ROLE_LABELS } from "../roles";

const ACTION_LABELS = {
  login: "Signed in",
  create_order: "Order created",
  update_order: "Order updated",
  collect_payment: "Payment collected",
  create_user: "User created",
  hq_account: "HQ account",
  create_menu_item: "Menu item added",
  update_menu_item: "Menu item updated",
  delete_menu_item: "Menu item deleted",
  create_category: "Category added",
  update_category: "Category updated",
  delete_category: "Category deleted",
  create_customer: "Customer added",
  create_restaurant: "Resort added",
  update_restaurant: "Resort updated",
};

function formatWhen(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AuditLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [resorts, setResorts] = useState([]);
  const [resort, setResort] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(nextResort = resort) {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (isMainAdmin(user) && nextResort) params.resort = nextResort;
      const { data } = await api.get("/audit-logs", { params });
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
      setResorts(Array.isArray(data?.resorts) ? data.resorts : []);
    } catch (err) {
      setLogs([]);
      setError(err.response?.data?.message || "Could not load audit logs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("");
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((row) =>
      `${row.restaurant_name} ${row.user_name} ${row.action} ${row.entity} ${row.details || ""}`
        .toLowerCase()
        .includes(term)
    );
  }, [logs, q]);

  const inputStyle = {
    background: "var(--pos-input)",
    color: "var(--app-text)",
    borderColor: "var(--surface-border)",
  };

  return (
    <section
      className="rounded-3xl border p-4 shadow-sm sm:p-6"
      style={{ background: "var(--surface)", borderColor: "var(--surface-border)", color: "var(--app-text)" }}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-tdcp-50 text-tdcp-700">
            <ScrollText size={22} />
          </span>
          <div>
            <h2 className="text-xl font-extrabold leading-tight">Audit logs</h2>
            <p className="mt-0.5 max-w-xl text-sm" style={{ color: "var(--app-muted)" }}>
              Every change is stored against the resort name, so HQ can see which restaurant did what.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tdcp-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search action, user, or details..."
            className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm outline-none"
            style={inputStyle}
          />
        </div>
        {isMainAdmin(user) ? (
          <select
            value={resort}
            onChange={(e) => {
              setResort(e.target.value);
              load(e.target.value);
            }}
            className="rounded-xl border px-3 py-2.5 text-sm"
            style={inputStyle}
          >
            <option value="">All resorts</option>
            {resorts.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          onClick={() => load(resort)}
          className="inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold"
          style={{ borderColor: "var(--surface-border)" }}
        >
          <Filter size={15} />
          Refresh
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="text-xs font-semibold text-tdcp-800">
              {["When", "Resort", "User", "Action", "Details"].map((label, i, arr) => (
                <th
                  key={label}
                  className={`bg-tdcp-50 py-3 px-3 ${i === 0 ? "rounded-l-2xl" : ""} ${
                    i === arr.length - 1 ? "rounded-r-2xl" : ""
                  }`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm" style={{ color: "var(--app-muted)" }}>
                  Loading audit logs…
                </td>
              </tr>
            ) : filtered.length ? (
              filtered.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0" style={{ borderColor: "var(--surface-border)" }}>
                  <td className="whitespace-nowrap px-3 py-3.5 font-medium">{formatWhen(row.created_at)}</td>
                  <td className="px-3 py-3.5 font-semibold">{row.restaurant_name}</td>
                  <td className="px-3 py-3.5">
                    <p className="font-medium">{row.user_name || "—"}</p>
                    <p className="text-[11px]" style={{ color: "var(--app-muted)" }}>
                      {ROLE_LABELS[row.user_role] || row.user_role || ""}
                    </p>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className="rounded-full bg-tdcp-50 px-2.5 py-1 text-xs font-semibold text-tdcp-800">
                      {ACTION_LABELS[row.action] || row.action}
                    </span>
                    {row.entity ? (
                      <span className="ml-2 text-xs" style={{ color: "var(--app-muted)" }}>
                        {row.entity}
                        {row.entity_id ? ` #${row.entity_id}` : ""}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3.5 text-xs" style={{ color: "var(--app-muted)" }}>
                    {row.details || "—"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm" style={{ color: "var(--app-muted)" }}>
                  No audit logs yet. New orders, menu, and user changes will appear here by resort name.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
