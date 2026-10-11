import { useState } from "react";
import { ArrowRight, BarChart3, ChartColumnIncreasing, Cloud, Eye, EyeOff, Lock, Mail, Shield, ShieldCheck, Utensils, Zap } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import ServexMark from "./ServexMark";

const FEATURES = [
  { icon: Utensils, title: "Fast & Easy", text: "Process orders in seconds", color: "#FF7A1A" },
  { icon: BarChart3, title: "Real-time", text: "Track sales & performance", color: "#3B82F6" },
  { icon: Cloud, title: "Cloud Powered", text: "Access anywhere, anytime", color: "#22C55E" },
  { icon: ShieldCheck, title: "Secure", text: "Your data is protected.", color: "#8B5CF6" },
];

const FOOTER = [
  { icon: Shield, label: "Better Control" },
  { icon: Zap, label: "Higher Efficiency" },
  { icon: ChartColumnIncreasing, label: "Greater Profits" },
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
  children,
}) {
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
    <div className="login-canvas relative min-h-screen overflow-x-hidden bg-[#f6f8fb] text-[#1B2A4A]">
      <div
        className="absolute inset-0 bg-cover bg-no-repeat"
        style={{ backgroundImage: "url(/kitcheniq-hero.jpg)", backgroundPosition: "center 42%" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, #ffffff 0%, rgba(255,255,255,0.96) 30%, rgba(255,255,255,0.62) 48%, rgba(255,255,255,0.18) 66%, rgba(255,255,255,0) 82%)",
        }}
      />
      <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-64 rounded-full bg-[#FF7A1A]/12 blur-3xl" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col px-4 pt-5 sm:px-8 sm:pt-6 lg:px-10">
          <header className="flex items-start justify-between gap-3">
            <ServexMark size={54} caption />
            <div className="flex items-center gap-3 pt-2">
              <p className="login-muted hidden items-center gap-2.5 text-sm text-slate-500 sm:flex">
                <span className="h-0.5 w-5 rounded-full bg-[#FF7A1A]" />
                Smart Kitchens. Smarter Decisions.
              </p>
              <ThemeToggle tone="soft" />
            </div>
          </header>

          <div className="grid flex-1 items-start gap-8 py-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-end lg:py-4">
            <div className="hidden max-w-xl lg:block lg:self-center lg:pb-16">
              <div className="login-muted flex items-center gap-3 text-[11px] font-semibold tracking-[0.22em] text-slate-400">
                <span className="h-0.5 w-7 rounded-full bg-[#FF7A1A]" />
                RESTAURANT MANAGEMENT SYSTEM
              </div>
              <h2 className="login-navy mt-4 text-[42px] font-extrabold leading-[1.08] tracking-tight text-[#1B2A4A] xl:text-[50px]">
                Smarter Kitchen
                <span className="login-navy block">Management,</span>
                <span className="login-orange mt-1 block text-[#FF7A1A]">All in One Place.</span>
              </h2>
              <p className="login-muted mt-5 max-w-lg text-[15px] leading-relaxed text-slate-500">
                Manage your orders, tables, menu, inventory, staff and more — all with the power of{" "}
                <span className="login-orange font-semibold text-[#FF7A1A]">KitchenIQ.cloud</span>.
              </p>
              <div className="mt-7 grid max-w-[540px] grid-cols-4 gap-3">
                {FEATURES.map(({ icon: Icon, title: featureTitle, text, color }) => (
                  <div key={featureTitle} className="rounded-2xl bg-white px-2 py-4 text-center shadow-[0_10px_28px_rgba(16,32,56,0.08)]">
                    <Icon size={22} strokeWidth={1.8} className="mx-auto" style={{ color }} />
                    <p className="login-navy mt-3 text-[13px] font-bold leading-tight text-[#1B2A4A]">{featureTitle}</p>
                    <p className="login-muted mt-1 text-[11px] leading-snug text-slate-500">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <form
              onSubmit={submit}
              className="relative z-20 w-full rounded-[26px] bg-white px-6 py-7 shadow-[0_24px_70px_rgba(16,32,56,0.16)] sm:px-8 lg:-mb-8"
            >
              <ServexMark size={46} />
              <h1 className="login-navy mt-5 text-[30px] font-extrabold tracking-tight text-[#1B2A4A]">{title}</h1>
              <p className="login-muted mt-1 text-sm text-slate-500">{subtitle}</p>
              {children}

              <label className="login-navy mt-6 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Mail size={15} className="text-slate-400" /> Email Address
              </label>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 focus-within:border-[#FF7A1A] focus-within:ring-2 focus-within:ring-[#FF7A1A]/15">
                <Mail size={16} className="text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm text-[#1B2A4A] outline-none placeholder:text-slate-400"
                  value={email}
                  onChange={(e) => onEmail(e.target.value)}
                  placeholder={emailPlaceholder}
                  autoComplete="username"
                />
              </div>

              <label className="login-navy mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Lock size={15} className="text-slate-400" /> Password
              </label>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 focus-within:border-[#FF7A1A] focus-within:ring-2 focus-within:ring-[#FF7A1A]/15">
                <Lock size={16} className="text-slate-400" />
                <input
                  type={showPass ? "text" : "password"}
                  className="w-full bg-transparent text-sm text-[#1B2A4A] outline-none placeholder:text-slate-400"
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
                    className="h-4 w-4 rounded accent-[#FF7A1A]"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  className="login-orange font-semibold text-[#FF7A1A]"
                  onClick={() => setHint("Ask your KitchenIQ administrator to reset your password.")}
                >
                  Forgot password?
                </button>
              </div>

              {error || hint ? <p className="mt-3 text-sm text-rose-600">{error || hint}</p> : null}

              <button
                type="submit"
                disabled={busy}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF9A3C] to-[#FF6A00] py-3.5 text-sm font-bold text-white shadow-[0_10px_22px_rgba(255,122,26,0.35)] hover:from-[#FF8C28] disabled:opacity-60"
              >
                <span className="text-white">{busy ? "Signing in..." : submitLabel}</span>
                {!busy ? <ArrowRight size={16} className="text-white" /> : null}
              </button>

              <p className="login-muted mt-4 text-center text-xs text-slate-400">or</p>
              <p className="login-muted mt-1 text-center text-xs text-slate-500">
                Powered by <span className="login-orange font-bold text-[#FF7A1A]">KitchenIQ.cloud</span>
              </p>
            </form>
          </div>
        </div>

        <footer className="relative z-10 overflow-hidden bg-[#0E1A30]">
          <div className="login-on-navy relative z-10 grid grid-cols-3 gap-x-2 px-3 py-3.5 text-[11px] font-medium leading-tight text-white sm:flex sm:flex-wrap sm:items-center sm:gap-x-8 sm:px-10 sm:py-4 sm:text-sm">
            {FOOTER.map(({ icon: Icon, label }) => (
              <span key={label} className="login-on-navy inline-flex items-center gap-2 text-white">
                <Icon size={16} strokeWidth={2} style={{ color: "#FF7A1A" }} />
                {label}
              </span>
            ))}
          </div>
          <svg className="pointer-events-none absolute -bottom-3 -right-2 h-24 w-40 text-[#FF7A1A]" viewBox="0 0 160 100" fill="currentColor" aria-hidden>
            <path d="M160 100H62c18-24 36-58 72-82 10-8 18-12 26-14v96Z" />
          </svg>
        </footer>
      </div>
    </div>
  );
}
