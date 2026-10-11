import { useState } from "react";
import { Banknote, ShieldCheck, X } from "lucide-react";
import api from "../api";
import { formatPKR } from "../lib/format";

export default function CollectPaymentModal({ order, tableLabel, onClose, onPaid }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setError("");
    setBusy(true);
    try {
      const { data } = await api.patch(`/orders/${order.id}`, {
        payment_method: "Cash",
        payment_status: "paid",
        status: "completed",
      });
      onPaid(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 print:hidden">
      <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl sm:p-8" style={{ color: "var(--app-text)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-tdcp-50 text-tdcp-700">
              <Banknote size={22} />
            </span>
            <div className="min-w-0">
              <h3 className="text-2xl font-extrabold tracking-tight text-tdcp-900">
                Collect cash
                <span className="font-extrabold text-tdcp-700"> · #{order.order_no}</span>
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                Table {tableLabel}
                <span className="mx-2 text-slate-300">|</span>
                Total <span className="font-bold text-tdcp-900">{formatPKR(order.total)}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-400 hover:bg-slate-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-tdcp-800 bg-tdcp-800 px-4 py-3.5 text-white">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15">
            <Banknote size={18} />
          </span>
          <div>
            <p className="text-sm font-bold">Cash only</p>
            <p className="text-xs text-white/70">Card and POS payments are not available.</p>
          </div>
        </div>

        {error ? <p className="mt-3 text-sm font-medium text-rose-600">{error}</p> : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-tdcp-900"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={confirm}
            className="inline-flex items-center justify-center gap-3 rounded-2xl bg-tdcp-800 py-3.5 text-sm font-bold text-white disabled:opacity-50"
          >
            <ShieldCheck size={18} />
            {busy ? "Saving…" : "Confirm cash received"}
          </button>
        </div>

        <p className="mt-4 text-center text-sm text-tdcp-800">Please collect the exact amount from the customer.</p>
      </div>
    </div>
  );
}
