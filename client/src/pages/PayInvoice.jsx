import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CalendarDays,
  CircleHelp,
  CreditCard,
  FileText,
  Lock,
  MapPin,
  User,
} from "lucide-react";
import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import api from "../api";
import { digitsOnly, lettersOnly } from "../lib/fields";
import BrandLogo from "../components/BrandLogo";

let stripePromise = null;
let stripePk = "";

function stripeFromKey(pk) {
  if (!pk) return null;
  if (!stripePromise || stripePk !== pk) {
    stripePk = pk;
    stripePromise = loadStripe(pk);
  }
  return stripePromise;
}

function money(value) {
  const n = Number(value || 0);
  return `PKR ${n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const fieldWrap =
  "flex items-center gap-2 rounded-xl border-2 border-tdcp-700/70 bg-white px-3 py-2.5 focus-within:border-tdcp-700 focus-within:ring-2 focus-within:ring-tdcp-100";

const stripeStyle = {
  style: {
    base: {
      fontSize: "15px",
      color: "#073226",
      fontFamily: "Plus Jakarta Sans, system-ui, sans-serif",
      "::placeholder": { color: "#9ca3af" },
    },
    invalid: { color: "#e11d48" },
  },
};

function CardBrands() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex h-8 min-w-[52px] items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-extrabold italic tracking-wide text-[#1a1f71]">
        VISA
      </span>
      <span className="inline-flex h-8 min-w-[52px] items-center justify-center rounded-lg border border-slate-200 bg-white px-1.5">
        <span className="relative h-5 w-8">
          <span className="absolute left-0 top-0.5 h-4 w-4 rounded-full bg-[#eb001b]" />
          <span className="absolute right-0 top-0.5 h-4 w-4 rounded-full bg-[#f79e1b]" />
        </span>
      </span>
      <span className="inline-flex h-8 min-w-[52px] items-center justify-center rounded-lg border border-slate-200 bg-[#006fcf] px-2 text-[9px] font-extrabold tracking-wider text-white">
        AMEX
      </span>
      <span className="inline-flex h-8 min-w-[64px] items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
        <span className="px-1.5 text-[9px] font-extrabold tracking-wide text-slate-700">DISCOVER</span>
        <span className="h-full w-3 bg-orange-400" />
      </span>
    </div>
  );
}

function PayForm({ order, amount, clientSecret, onPaid }) {
  const stripe = useStripe();
  const elements = useElements();
  const [name, setName] = useState("");
  const [zip, setZip] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cvcHint, setCvcHint] = useState(false);

  async function pay(e) {
    e.preventDefault();
    setError("");
    if (!stripe || !elements) return;
    if (!name.trim()) {
      setError("Enter the name on the card.");
      return;
    }
    const card = elements.getElement(CardNumberElement);
    if (!card) {
      setError("Enter the card number.");
      return;
    }
    setBusy(true);
    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card,
          billing_details: {
            name: name.trim(),
            address: zip.trim() ? { postal_code: zip.trim() } : undefined,
          },
        },
      });
      if (stripeError) throw new Error(stripeError.message);
      if (paymentIntent?.status !== "succeeded") throw new Error("Card payment did not complete");
      const { data } = await api.post("/payments/stripe/complete", {
        order_id: order.id,
        payment_intent_id: paymentIntent.id,
      });
      try {
        window.opener?.postMessage({ type: "tdcp-order-paid", order: data }, window.location.origin);
      } catch {
        /* ignore */
      }
      onPaid(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-5 space-y-4" onSubmit={pay}>
      <label className="block text-sm font-semibold text-tdcp-900">
        Name on card
        <span className={`${fieldWrap} mt-1.5`}>
          <input
            value={name}
            onChange={(e) => setName(lettersOnly(e.target.value))}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            autoComplete="cc-name"
          />
          <User size={16} className="shrink-0 text-tdcp-700" />
        </span>
      </label>

      <label className="block text-sm font-semibold text-tdcp-900">
        Card number
        <span className={`${fieldWrap} mt-1.5`}>
          <CreditCard size={16} className="shrink-0 text-tdcp-700" />
          <span className="min-w-0 flex-1">
            <CardNumberElement options={{ ...stripeStyle, placeholder: "1234 1234 1234 1234" }} />
          </span>
        </span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-tdcp-900">
          Expiry date
          <span className={`${fieldWrap} mt-1.5`}>
            <CalendarDays size={16} className="shrink-0 text-tdcp-700" />
            <span className="min-w-0 flex-1">
              <CardExpiryElement options={{ ...stripeStyle, placeholder: "MM / YY" }} />
            </span>
          </span>
        </label>
        <label className="relative block text-sm font-semibold text-tdcp-900">
          Security code
          <span className={`${fieldWrap} mt-1.5`}>
            <Lock size={16} className="shrink-0 text-tdcp-700" />
            <span className="min-w-0 flex-1">
              <CardCvcElement options={{ ...stripeStyle, placeholder: "123" }} />
            </span>
            <button
              type="button"
              className="shrink-0 text-tdcp-700"
              aria-label="What is the security code?"
              onClick={() => setCvcHint((v) => !v)}
            >
              <CircleHelp size={16} />
            </button>
          </span>
          {cvcHint ? (
            <span className="absolute right-0 z-10 mt-1 w-52 rounded-xl border bg-white p-2 text-xs font-normal text-slate-600 shadow-lg">
              3 digits on the back of the card. American Express uses 4 digits on the front.
            </span>
          ) : null}
        </label>
      </div>

      <label className="block text-sm font-semibold text-tdcp-900">
        ZIP / Postal code
        <span className={`${fieldWrap} mt-1.5`}>
          <MapPin size={16} className="shrink-0 text-tdcp-700" />
          <input
            value={zip}
            onChange={(e) => setZip(digitsOnly(e.target.value, 10))}
            inputMode="numeric"
            maxLength={10}
            placeholder="12345"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            autoComplete="postal-code"
          />
        </span>
      </label>

      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

      <button
        type="submit"
        disabled={busy || !stripe}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-tdcp-800 py-3.5 text-sm font-bold text-white disabled:opacity-50"
      >
        <Lock size={16} />
        {busy ? "Processing…" : `Pay ${money(amount)}`}
      </button>
    </form>
  );
}

export default function PayInvoice() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [stripeCfg, setStripeCfg] = useState(null);
  const [clientSecret, setClientSecret] = useState("");
  const [amount, setAmount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [paid, setPaid] = useState(null);
  const [intentError, setIntentError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get(`/orders/${orderId}`), api.get("/payments/stripe/config")])
      .then(([orderRes, cfgRes]) => {
        if (cancelled) return;
        const o = orderRes.data;
        setOrder(o);
        setStripeCfg(cfgRes.data);
        setAmount(Number(o.total || 0));
        setDraft(String(Number(o.total || 0)));
        if (o.payment_status === "paid") setPaid(o);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.response?.data?.message || "Invoice not found");
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    if (!order || paid || editing || !(Number(amount) > 0)) return undefined;
    let cancelled = false;
    setIntentError("");
    setClientSecret("");
    api
      .post("/payments/stripe/intent", { order_id: order.id, amount })
      .then((res) => {
        if (!cancelled) setClientSecret(res.data.clientSecret);
      })
      .catch((err) => {
        if (!cancelled) setIntentError(err.response?.data?.message || "Could not start Stripe payment");
      });
    return () => {
      cancelled = true;
    };
  }, [order, amount, paid, editing]);

  const stripe = useMemo(() => stripeFromKey(stripeCfg?.publishableKey), [stripeCfg?.publishableKey]);

  function saveAmount() {
    const next = Number(draft);
    if (!Number.isFinite(next) || next <= 0) return;
    setAmount(next);
    setEditing(false);
  }

  if (loadError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-white p-6 text-center">
        <div>
          <p className="font-semibold text-rose-600">{loadError}</p>
          <Link to="/orders" className="mt-3 inline-block text-sm font-semibold text-tdcp-700">
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="grid min-h-dvh place-items-center bg-white text-sm text-tdcp-700">Preparing invoice…</div>
    );
  }

  return (
    <div className="min-h-dvh bg-white px-4 py-8">
      <div className="mx-auto w-full max-w-[400px]">
        <div className="mb-5 flex justify-center">
          <BrandLogo size={56} />
        </div>
        <div className="mb-4 flex justify-center">
          <span className="grid h-12 w-12 place-items-center rounded-full border-[3px] border-tdcp-700 text-tdcp-700">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.6">
              <path d="M5 12.5 9.5 17 19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>

        <div className="rounded-[28px] border border-tdcp-50 bg-[#eef8f3] p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-tdcp-700">
              <FileText size={22} />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold text-tdcp-800">Pay Invoice</h1>
              <p className="text-xs font-medium text-tdcp-600">Order #{order.order_no}</p>
            </div>
          </div>

          {paid ? (
            <div className="mt-6 rounded-2xl bg-white p-5 text-center">
              <p className="text-lg font-extrabold text-tdcp-800">Payment received</p>
              <p className="mt-1 text-sm text-slate-500">{money(paid.total)} charged by card</p>
              <button
                type="button"
                className="mt-4 w-full rounded-xl bg-tdcp-800 py-3 text-sm font-bold text-white"
                onClick={() => {
                  if (window.opener) window.close();
                  else navigate("/orders");
                }}
              >
                {window.opener ? "Close" : "Back to Orders"}
              </button>
            </div>
          ) : (
            <>
              <div className="mt-5">
                <CardBrands />
              </div>

              <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#dcefe6] px-4 py-3">
                <div>
                  <p className="text-sm text-tdcp-700">Payment amount</p>
                  {editing ? (
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="mt-1 w-32 rounded-lg border border-tdcp-200 bg-white px-2 py-1 text-xl font-extrabold text-tdcp-900 outline-none"
                    />
                  ) : (
                    <p className="text-2xl font-extrabold text-tdcp-900">{money(amount)}</p>
                  )}
                </div>
                <button
                  type="button"
                  className="rounded-xl border border-tdcp-200 bg-white px-4 py-2 text-sm font-semibold text-tdcp-800"
                  onClick={() => {
                    if (editing) saveAmount();
                    else {
                      setDraft(String(amount));
                      setEditing(true);
                    }
                  }}
                >
                  {editing ? "Save" : "Edit"}
                </button>
              </div>

              {intentError ? (
                <p className="mt-4 text-sm font-medium text-rose-600">{intentError}</p>
              ) : !clientSecret || !stripe ? (
                <p className="mt-4 text-sm text-tdcp-700">Preparing secure card form…</p>
              ) : (
                <Elements stripe={stripe} options={{ clientSecret, appearance: { theme: "stripe" } }}>
                  <PayForm order={order} amount={amount} clientSecret={clientSecret} onPaid={setPaid} />
                </Elements>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
