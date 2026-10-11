import { useEffect, useMemo, useState } from "react";
import { ChartColumn } from "lucide-react";
import api from "../../api";
import { formatPKR } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";

function isHiddenResort(r) {
  const name = String(r?.name || "").toLowerCase();
  return name.includes("murree restaurant") || name.includes("bakhshuwali");
}

export default function ResortOverviewTable() {
  const { setActiveRestaurant } = useAuth();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api
      .get("/dashboard/overview")
      .then(({ data }) => setRows((data.restaurants || []).filter((r) => !isHiddenResort(r))))
      .catch(() => setRows([]));
  }, []);

  const totals = useMemo(
    () => ({
      sales: rows.reduce((s, r) => s + Number(r.today_sales || 0), 0),
      orders: rows.reduce((s, r) => s + Number(r.today_orders || 0), 0),
      month: rows.reduce((s, r) => s + Number(r.month_sales || 0), 0),
    }),
    [rows]
  );

  return (
    <section
      className="rounded-3xl border p-4 shadow-sm sm:p-6"
      style={{ background: "var(--surface)", borderColor: "var(--surface-border)", color: "var(--app-text)" }}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#0e4a34] text-white">
            <ChartColumn size={20} />
          </span>
          <div>
            <h2 className="text-xl font-extrabold leading-tight">Main Admin — all resorts</h2>
            <p className="mt-0.5 text-sm" style={{ color: "var(--app-muted)" }}>
              HQ view of every TDCP restaurant. Open a row to work in that resort.
            </p>
          </div>
        </div>
        <p className="text-sm font-semibold text-tdcp-800">
          {formatPKR(totals.sales)} today • {totals.orders} orders • {formatPKR(totals.month)} this month
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="text-xs font-bold text-[#0e4a34]">
              {["Resort", "Location", "Today sales", "Today orders", "Month sales", "Staff"].map((label, i, arr) => (
                <th
                  key={label}
                  className={`bg-tdcp-50 py-3 ${i === 0 ? "rounded-l-2xl pl-3" : ""} ${
                    i === arr.length - 1 ? "rounded-r-2xl pr-3" : ""
                  } px-3`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="cursor-pointer border-b last:border-b-0 hover:bg-tdcp-50/60"
                style={{ borderColor: "var(--surface-border)" }}
                onClick={() => setActiveRestaurant(r.id)}
              >
                <td className="py-3.5 pl-3 font-bold">
                  <span className="flex items-center gap-2.5">
                    <img src="/tdcp-logo.png?v=3" alt="" className="h-8 w-8 rounded-full bg-white object-contain ring-1 ring-tdcp-100" />
                    {r.name}
                  </span>
                </td>
                <td className="px-3" style={{ color: "var(--app-muted)" }}>
                  {r.location || "—"}
                </td>
                <td className="px-3 font-semibold">{formatPKR(r.today_sales || 0)}</td>
                <td className="px-3">{r.today_orders || 0}</td>
                <td className="px-3">{formatPKR(r.month_sales || 0)}</td>
                <td className="px-3 pr-3">{r.user_count || 0}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm" style={{ color: "var(--app-muted)" }}>
                  No resorts to show.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
