export function formatPKR(value) {
  const n = Number(value || 0);
  if (n >= 1_000_000) return `PKR ${(n / 1_000_000).toFixed(1)}M`;
  const cents = Math.round(n * 100) % 100;
  return `PKR ${n.toLocaleString("en-PK", {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export function pctLabel(value) {
  const n = Number(value || 0);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}% vs yesterday`;
}

export function statusTone(status) {
  const map = {
    available: "bg-emerald-100 text-emerald-800",
    occupied: "bg-rose-100 text-rose-800",
    reserved: "bg-amber-100 text-amber-800",
    cleaning: "bg-sky-100 text-sky-800",
    maintenance: "bg-slate-200 text-slate-700",
    new: "bg-emerald-50 border-emerald-200",
    preparing: "bg-amber-50 border-amber-200",
    ready: "bg-lime-50 border-lime-200",
    completed: "bg-slate-50 border-slate-200",
    in_stock: "bg-emerald-100 text-emerald-800",
    low: "bg-amber-100 text-amber-800",
    reorder: "bg-rose-100 text-rose-800",
    out: "bg-slate-200 text-slate-700",
  };
  return map[status] || "bg-slate-100 text-slate-700";
}
