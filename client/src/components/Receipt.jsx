import BrandLogo from "./BrandLogo";
import { formatPKR } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import { isTdcpOrg, organizationDisplayName } from "../lib/orgBranding";

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

function Row({ label, value, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right ${strong ? "font-bold text-[#042016]" : "font-medium"}`}>{value}</span>
    </div>
  );
}

export default function Receipt({
  order,
  restaurantName = "",
  copy = "customer",
  cashierName,
}) {
  const { organization } = useAuth() || {};
  if (!order) return null;
  const isRestaurant = copy === "restaurant";
  const pay = order.payment_method || "Cash";
  const orgName = organizationDisplayName(organization);
  const siteName = restaurantName || organization?.app_name || "Restaurant";

  return (
    <article data-receipt-copy={copy} className="receipt-slip h-auto w-full bg-white px-5 py-4 text-[#042016] print:px-1 print:py-1">
      <header className="flex flex-col items-center text-center">
        <BrandLogo size={52} className="print:h-10 print:w-10" />
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {orgName}
        </p>
        <h2 className="mt-1 text-base font-extrabold leading-snug">{siteName}</h2>
        <p
          className={`mt-2 rounded-full px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wide ${
            isRestaurant ? "bg-tdcp-800 text-white" : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {isRestaurant ? "Restaurant receipt" : "Customer receipt"}
        </p>
        <p className="mt-1 text-sm font-semibold uppercase text-emerald-700">
          Paid · {pay}
        </p>
      </header>

      <div className="mt-4 space-y-1.5 border-y border-dashed border-slate-300 py-3 text-[13px]">
        <Row label="Order" value={`#${order.order_no}`} strong />
        <Row label="Table" value={order.table_label || "—"} />
        <Row label="Date" value={formatWhen(order.updated_at || order.created_at)} />
        <Row label="Payment" value={pay} />
        {isRestaurant && cashierName ? <Row label="Collected by" value={cashierName} /> : null}
      </div>

      <ul className="mt-3 space-y-1.5 text-[13px]">
        {(order.items || []).map((item) => (
          <li key={item.id || `${item.name}-${item.qty}`} className="flex justify-between gap-3">
            <span>
              {item.qty} × {item.name}
            </span>
            <span className="shrink-0 font-medium">{formatPKR(Number(item.price) * Number(item.qty))}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 space-y-1.5 border-t border-slate-200 pt-3 text-[13px]">
        <div className="flex items-baseline justify-between gap-4 text-base">
          <span className="font-bold">Total</span>
          <span className="font-extrabold">{formatPKR(order.total)}</span>
        </div>
      </div>

      <p className="mt-3 text-center text-xs leading-relaxed text-slate-500 print:mt-2">
        {isRestaurant
          ? "Keep this copy at the resort for accounts."
          : isTdcpOrg(organization)
            ? "Thank you for dining with TDCP. Discover the Punjab."
            : "Thank you for dining with us."}
      </p>
    </article>
  );
}
