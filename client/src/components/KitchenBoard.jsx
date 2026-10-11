import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const TONES = {
  blue: { icon: "bg-blue-50 text-blue-500", wave: "#93c5fd" },
  orange: { icon: "bg-orange-50 text-[#ff7a1a]", wave: "#fdba74" },
  green: { icon: "bg-emerald-50 text-emerald-500", wave: "#86efac" },
};

function Wave({ color }) {
  return (
    <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full" viewBox="0 0 240 70" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 40 C40 20 70 55 110 36 C150 16 180 48 240 28 L240 70 L0 70 Z" fill={color} opacity="0.35" />
      <path d="M0 52 C50 34 90 62 140 46 C180 34 210 54 240 42 L240 70 L0 70 Z" fill={color} opacity="0.22" />
    </svg>
  );
}

export function useKitchenClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function dayPart(date) {
  const hour = date.getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export function kitchenFirstName(user) {
  const full = String(user?.name || "").trim();
  const first = full.split(/\s+/).filter(Boolean)[0] || "";
  if (first && !/^platform$/i.test(first)) return first;
  const username = String(user?.username || "").trim();
  if (!username) return first || "Chef";
  return username.charAt(0).toUpperCase() + username.slice(1);
}

function RateRing({ percent }) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const filled = (value / 100) * circumference;
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" aria-hidden="true">
      <circle cx="34" cy="34" r={radius} stroke="#e7f4ee" strokeWidth="7" fill="none" />
      <circle
        cx="34"
        cy="34"
        r={radius}
        stroke="#16845c"
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference - filled}`}
        transform="rotate(-90 34 34)"
      />
      <text x="34" y="38" textAnchor="middle" fontSize="13" fontWeight="800" fill="#16324a">
        {Math.round(value)}%
      </text>
    </svg>
  );
}

export function KitchenHero({
  eyebrow = "KITCHEN",
  subtitle = "Here's today's kitchen lineup.",
  badgeValue = 0,
  badgeLabel = "TICKETS",
  badgeIcon: BadgeIcon = MapPin,
}) {
  const { user } = useAuth();
  const now = useKitchenClock();
  const name = kitchenFirstName(user);

  return (
    <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-white via-[#fff8f3] to-[#fff1e6] px-6 py-6 shadow-sm sm:px-8">
      <span className="pointer-events-none absolute -bottom-10 -right-6 h-28 w-40 rounded-full bg-[#ff7a1a]" />
      <span className="pointer-events-none absolute -right-8 top-6 h-16 w-16 rounded-full bg-[#ffb27a]/70" />
      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div>
          <p className="text-[11px] font-bold tracking-[0.22em] text-[#ff7a1a]">{eyebrow}</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#1b2a4a] sm:text-4xl">
            Good {dayPart(now)}, <span className="text-[#ff7a1a]">{name}</span>
          </h2>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="relative min-w-[132px] rounded-2xl bg-white/90 px-6 py-4 text-center shadow-sm">
          <BadgeIcon size={16} className="mx-auto text-slate-400" />
          <p className="mt-1 text-4xl font-extrabold leading-none text-[#1b2a4a]">{badgeValue}</p>
          <p className="mt-1 text-[11px] font-bold tracking-[0.18em] text-slate-400">{badgeLabel}</p>
        </div>
      </div>
    </section>
  );
}

export function KitchenStats({ items }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const tone = TONES[item.tone] || TONES[item.gold ? "orange" : "blue"];
        if (item.ring) {
          return (
            <div key={item.label} className="flex items-center gap-4 rounded-[22px] bg-white px-4 py-4 shadow-sm">
              <RateRing percent={item.ring} />
              <div>
                <p className="text-sm font-bold text-[#1b2a4a]">{item.label}</p>
                <p className="mt-1 text-xs text-slate-400">{item.detail}</p>
              </div>
            </div>
          );
        }
        return (
          <div key={item.label} className="relative overflow-hidden rounded-[22px] bg-white px-4 py-4 shadow-sm">
            <Wave color={tone.wave} />
            <div className="relative flex items-center gap-3">
              {item.icon ? (
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${tone.icon}`}>
                  <item.icon size={16} />
                </span>
              ) : null}
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-[0.16em] text-slate-400">{item.label}</p>
                <p className="mt-0.5 truncate text-2xl font-extrabold tracking-tight text-[#1b2a4a]">{item.value}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
