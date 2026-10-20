import { useState } from "react";
import { ArrowRight, BarChart3, ChartColumnIncreasing, Cloud, Eye, EyeOff, Lock, Mail, Shield, ShieldCheck, Utensils, Zap } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import ServexMark from "./ServexMark";
import TdcpMark from "./TdcpMark";

const KITCHEN_FEATURES = [
  { icon: Utensils, title: "Fast & Easy", text: "Process orders in seconds", color: "#FF7A1A" },
  { icon: BarChart3, title: "Real-time", text: "Track sales & performance", color: "#3B82F6" },
  { icon: Cloud, title: "Cloud Powered", text: "Access anywhere, anytime", color: "#22C55E" },
  { icon: ShieldCheck, title: "Secure", text: "Your data is protected.", color: "#8B5CF6" },
];

const TDCP_FEATURES = [
  { icon: Utensils, title: "Resort POS", text: "Take orders at every site", color: "#16845c" },
  { icon: BarChart3, title: "Live sales", text: "See today's performance", color: "#0e4a34" },
  { icon: Cloud, title: "Works offline", text: "Syncs when you are online", color: "#1aa6a6" },
  { icon: ShieldCheck, title: "TDCP only", text: "Your resort data stays yours", color: "#0c553c" },
];

const KITCHEN_FOOTER = [
  { icon: Shield, label: "Better Control" },
  { icon: Zap, label: "Higher Efficiency" },
  { icon: ChartColumnIncreasing, label: "Greater Profits" },
];

const TDCP_FOOTER = [
  { icon: Shield, label: "Explore Punjab" },
  { icon: Utensils, label: "Dine with TDCP" },
  { icon: ChartColumnIncreasing, label: "Support Tourism" },
];

export default function ScenicLogin({
  title = "Welcome Back",
  subtitle = "Sign in to your KitchenIQ.cloud account",
  email,
  password,
  onEmail,
  onPassword,
  onSubmit,
  busy,
  error,
  submitLabel = "Sign In",
  emailPlaceholder = "admin@restaurant.com",
  variant = "kitchen",
  children,
}) {
  const tdcp = variant === "tdcp";
  const accent = tdcp ? "#16845c" : "#FF7A1A";
  const ink = tdcp ? "#16324a" : "#1B2A4A";
  const deep = tdcp ? "#0e4a34" : "#0E1A30";
  const features = tdcp ? TDCP_FEATURES : KITCHEN_FEATURES;
  const footer = tdcp ? TDCP_FOOTER : KITCHEN_FOOTER;
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(() => localStorage.getItem("servex_remember") !== "0");
  const [hint, setHint] = useState("");

  function submit(e) {
    e.preventDefault();
    if (remember) {
      localStorage.setItem("servex_remember", "1");
      localStorage.setItem("servex_email", email);
    } else {
      localStorage.setItem("servex_remember", "0");
      localStorage.removeItem("servex_email");
    }
    onSubmit(e);
  }

  return (
    <div className={`login-canvas relative min-h-screen overflow-x-hidden text-[#1B2A4A] ${tdcp ? "login-tdcp bg-[#f3f6f8]" : "bg-[#f6f8fb]"}`} style={{ color: ink }}>
      {tdcp ? (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 520px at 88% 18%, rgba(61,206,122,0.28), transparent 60%), linear-gradient(115deg, #f7fbf8 0%, #e7f4ec 46%, #d5efe3 100%)",
          }}
        />
      ) : (
        <div
          className="absolute inset-0 bg-cover bg-no-repeat"
          style={{ backgroundImage: "url(/kitcheniq-hero.jpg)", backgroundPosition: "center 42%" }}
        />
      )}
      {tdcp ? null : (
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, #ffffff 0%, rgba(255,255,255,0.96) 30%, rgba(255,255,255,0.62) 48%, rgba(255,255,255,0.18) 66%, rgba(255,255,255,0) 82%)",
          }}
        />
      )}
      <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-64 rounded-full blur-3xl" style={{ background: `${accent}1f` }} />

      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col px-4 pt-5 sm:px-8 sm:pt-6 lg:px-10">
          <header className="flex items-start justify-between gap-3">
            {tdcp ? <TdcpMark size={84} className="rounded-full" /> : <ServexMark size={54} caption />}
            <div className="flex items-center gap-3 pt-2">
              <p className="login-muted hidden items-center gap-2.5 text-sm text-slate-500 sm:flex">
                <span className="h-0.5 w-5 rounded-full" style={{ background: accent }} />
                {tdcp ? "Explore · Dine · Support Tourism" : "Smart Kitchens. Smarter Decisions."}
              </p>
              <ThemeToggle tone="soft" />
            </div>
          </header>

          <div className="grid flex-1 items-start gap-8 py-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-end lg:py-4">
            <div className="hidden max-w-xl lg:block lg:self-center lg:pb-16">
              <div className="login-muted flex items-center gap-3 text-[11px] font-semibold tracking-[0.22em] text-slate-400">
                <span className="h-0.5 w-7 rounded-full" style={{ background: accent }} />
                {tdcp ? "TDCP RESTAURANT MANAGEMENT" : "RESTAURANT MANAGEMENT SYSTEM"}
              </div>
              <h2 className="login-navy mt-4 text-[42px] font-extrabold leading-[1.08] tracking-tight xl:text-[50px]" style={{ color: ink }}>
                {tdcp ? "Resort dining," : "Smarter Kitchen"}
                <span className="login-navy block">{tdcp ? "managed for" : "Management,"}</span>
                <span className="login-accent mt-1 block" style={{ color: accent }}>
                  {tdcp ? "every TDCP site." : "All in One Place."}
                </span>
              </h2>
              <p className="login-muted mt-5 max-w-lg text-[15px] leading-relaxed text-slate-500">
                {tdcp ? (
                  <>
                    Orders, tables, menu and staff stay on this device when the network is down, then sync to the{" "}
                    <span className="login-accent font-semibold" style={{ color: accent }}>
                      TDCP admin dashboard
                    </span>{" "}
                    as soon as you are back online.
                  </>
                ) : (
                  <>
                    Manage your orders, tables, menu, inventory, staff and more — all with the power of{" "}
                    <span className="login-orange font-semibold text-[#FF7A1A]">KitchenIQ.cloud</span>.
                  </>
                )}
              </p>
              <div className="mt-7 grid max-w-[540px] grid-cols-4 gap-3">
                {features.map(({ icon: Icon, title: featureTitle, text, color }) => (
                  <div key={featureTitle} className="rounded-2xl bg-white px-2 py-4 text-center shadow-[0_10px_28px_rgba(16,32,56,0.08)]">
                    <Icon size={22} strokeWidth={1.8} className="mx-auto" style={{ color }} />
                    <p className="login-navy mt-3 text-[13px] font-bold leading-tight" style={{ color: ink }}>
                      {featureTitle}
                    </p>
                    <p className="login-muted mt-1 text-[11px] leading-snug text-slate-500">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <form
              onSubmit={submit}
              className="relative z-20 w-full rounded-[26px] bg-white px-6 py-7 shadow-[0_24px_70px_rgba(14,74,52,0.12)] sm:px-8 lg:-mb-8"
            >
              {tdcp ? <TdcpMark size={76} className="rounded-full" /> : <ServexMark size={46} />}
              <h1 className="login-navy mt-5 text-[30px] font-extrabold tracking-tight" style={{ color: ink }}>
                {title}
              </h1>
              <p className="login-muted mt-1 text-sm text-slate-500">{subtitle}</p>
              {children}

              <label className="login-navy mt-6 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Mail size={15} className="text-slate-400" /> Email Address
              </label>
              <div
                className={`mt-1.5 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 focus-within:ring-2 ${
                  tdcp ? "focus-within:border-[#16845c] focus-within:ring-[#16845c]/15" : "focus-within:border-[#FF7A1A] focus-within:ring-[#FF7A1A]/15"
                }`}
              >
                <Mail size={16} className="text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  style={{ color: ink }}
                  value={email}
                  onChange={(e) => onEmail(e.target.value)}
                  placeholder={emailPlaceholder}
                  autoComplete="username"
                />
              </div>

              <label className="login-navy mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Lock size={15} className="text-slate-400" /> Password
              </label>
              <div
                className={`mt-1.5 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 focus-within:ring-2 ${
                  tdcp ? "focus-within:border-[#16845c] focus-within:ring-[#16845c]/15" : "focus-within:border-[#FF7A1A] focus-within:ring-[#FF7A1A]/15"
                }`}
              >
                <Lock size={16} className="text-slate-400" />
                <input
                  type={showPass ? "text" : "password"}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  style={{ color: ink }}
                  value={password}
                  onChange={(e) => onPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button type="button" className="text-slate-400" onClick={() => setShowPass((v) => !v)} aria-label="Toggle password">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm">
                <label className="login-muted flex cursor-pointer items-center gap-2 text-slate-600">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded"
                    style={{ accentColor: accent }}
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  className="login-accent font-semibold"
                  style={{ color: accent }}
                  onClick={() =>
                    setHint(
                      tdcp
                        ? "Ask your TDCP administrator to reset your password."
                        : "Ask your KitchenIQ administrator to reset your password."
                    )
                  }
                >
                  Forgot password?
                </button>
              </div>

              {error || hint ? <p className="mt-3 text-sm text-rose-600">{error || hint}</p> : null}

              <button
                type="submit"
                disabled={busy}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold text-white disabled:opacity-60"
                style={{
                  background: tdcp ? "linear-gradient(90deg, #1f8a5b, #0e4a34)" : "linear-gradient(90deg, #FF9A3C, #FF6A00)",
                  boxShadow: tdcp ? "0 10px 22px rgba(14,74,52,0.28)" : "0 10px 22px rgba(255,122,26,0.35)",
                }}
              >
                <span className="text-white">{busy ? "Signing in..." : submitLabel}</span>
                {!busy ? <ArrowRight size={16} className="text-white" /> : null}
              </button>

              <p className="login-muted mt-4 text-center text-xs text-slate-400">or</p>
              <p className="login-muted mt-1 text-center text-xs text-slate-500">
                {tdcp ? (
                  <>
                    Tourism Development Corporation of <span className="login-accent font-bold" style={{ color: accent }}>Punjab</span>
                  </>
                ) : (
                  <>
                    Powered by <span className="login-orange font-bold text-[#FF7A1A]">KitchenIQ.cloud</span>
                  </>
                )}
              </p>
            </form>
          </div>
        </div>

        <footer className="relative z-10 overflow-hidden" style={{ background: deep }}>
          <div className="login-on-navy relative z-10 grid grid-cols-3 gap-x-2 px-3 py-3.5 text-[11px] font-medium leading-tight text-white sm:flex sm:flex-wrap sm:items-center sm:gap-x-8 sm:px-10 sm:py-4 sm:text-sm">
            {footer.map(({ icon: Icon, label }) => (
              <span key={label} className="login-on-navy inline-flex items-center gap-2 text-white">
                <Icon size={16} strokeWidth={2} style={{ color: tdcp ? "#7dffb2" : "#FF7A1A" }} />
                {label}
              </span>
            ))}
          </div>
          <svg className="pointer-events-none absolute -bottom-3 -right-2 h-24 w-40" style={{ color: tdcp ? "#3dce7a" : "#FF7A1A" }} viewBox="0 0 160 100" fill="currentColor" aria-hidden>
            <path d="M160 100H62c18-24 36-58 72-82 10-8 18-12 26-14v96Z" />
          </svg>
        </footer>
      </div>
    </div>
  );
}
