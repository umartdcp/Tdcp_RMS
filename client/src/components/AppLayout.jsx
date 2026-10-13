import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  ShoppingCart,
  Grid3x3,
  ClipboardList,
  ChefHat,
  UtensilsCrossed,
  UserRound,
  ChartColumn,
  Shield,
  ScrollText,
  Settings,
  LogOut,
  Building2,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Home,
  Users,
  MapPin,
  Banknote,
  Clock,
  CalendarDays,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { isSuperAdmin, ROLE_LABELS } from "../modules/roles";
import BrandLogo from "./BrandLogo";
import ServexMark from "./ServexMark";
import ThemeToggle from "./ThemeToggle";
import NotificationBell, { NotificationToasts } from "./NotificationBell";
import { loginPathForSession, rememberPath } from "../lib/platform";
import { isTdcpOrg } from "../lib/orgBranding";

const superLinks = [
  { to: "/", label: "Dashboard", icon: Home, end: true },
  { to: "/users", label: "Users", icon: Users },
  { to: "/restaurants", label: "Sites", icon: MapPin },
  { to: "/reports", label: "Revenue", icon: Banknote },
  { to: "/reports", label: "Reports", icon: ChartColumn },
  { to: "/settings", label: "Settings", icon: Settings },
];

const links = [
  { to: "/organizations", label: "Organizations", icon: Building2, roles: ["super_admin", "admin"] },
  { to: "/", label: "Dashboard", icon: Home, roles: ["org_admin", "manager"] },
  { to: "/pos", label: "POS", icon: ShoppingCart, roles: ["org_admin", "manager", "order_taker", "cashier"] },
  { to: "/tables", label: "Tables", icon: Grid3x3, roles: ["org_admin", "manager", "order_taker"] },
  { to: "/orders", label: "Orders", icon: ClipboardList, roles: ["org_admin", "manager", "order_taker", "cashier"] },
  { to: "/menu", label: "Menu", icon: UtensilsCrossed, roles: ["org_admin", "manager", "order_taker"] },
  { to: "/kds", label: "Kitchen (KDS)", icon: ChefHat, roles: ["org_admin", "manager", "kitchen"] },
  { to: "/customers", label: "Customers", icon: UserRound, roles: ["org_admin", "manager"] },
  { to: "/reports", label: "Reports", icon: ChartColumn, roles: ["org_admin", "manager"] },
  { to: "/audit-logs", label: "Audit Logs", icon: ScrollText, roles: ["org_admin", "manager"] },
  { to: "/users", label: "Users & Roles", icon: Shield, roles: ["org_admin", "manager"] },
  { to: "/restaurants", label: "Sites", icon: MapPin, roles: ["org_admin"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["org_admin"] },
];

function crumbsFor(pathname) {
  const map = [
    ["/organizations/", ["Kitchen", "Organization"]],
    ["/menu/categories", ["Kitchen", "Menu"]],
    ["/organizations", ["Kitchen", "Organizations"]],
    ["/restaurants", ["Kitchen", "Sites"]],
    ["/reports", ["Kitchen", "Reports"]],
    ["/audit-logs", ["Kitchen", "Audit"]],
    ["/users", ["Kitchen", "Team"]],
    ["/settings", ["Kitchen", "Settings"]],
    ["/orders", ["Kitchen", "Orders"]],
    ["/tables", ["Kitchen", "Tables"]],
    ["/menu", ["Kitchen", "Menu"]],
    ["/kds", ["Kitchen", "Pass"]],
    ["/customers", ["Kitchen", "Guests"]],
    ["/pos", ["Kitchen", "POS"]],
    ["/", ["Kitchen", "Dashboard"]],
  ];
  const hit = map.find(([path]) => (path === "/" ? pathname === "/" : pathname.startsWith(path)));
  return hit ? hit[1] : ["Kitchen", "Dashboard"];
}

function Logo() {
  const { user, organization } = useAuth();
  if (isSuperAdmin(user)) {
    return (
      <div className="px-1">
        <ServexMark size={36} inverted className="text-white" />
      </div>
    );
  }
  const brand = organization;
  return (
    <div className="relative px-1">
      <BrandLogo size={88} organization={brand} />
      <div className="mt-3">
        <p className="text-xl font-extrabold leading-none tracking-tight text-white">
          {brand?.code || "RMS"}
        </p>
        <p className="mt-1 text-sm font-medium leading-snug text-white/85">
          {brand?.app_name || "Restaurant Management System"}
        </p>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const { user, logout, activeRestaurant, organization } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [menuDrop, setMenuDrop] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const isPos = location.pathname === "/pos";
  const tdcp = isTdcpOrg(organization) && !isSuperAdmin(user);
  const initials = (user?.name || "A")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
    if (!location.pathname.startsWith("/menu")) setMenuDrop(false);
    rememberPath(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const crumbs = crumbsFor(location.pathname);
  const clockLabel = `${now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} • ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}`;

  const sidebar = (
    <>
      <div className="relative shrink-0 overflow-hidden px-5 pb-3 pt-5">
        {tdcp ? null : (
          <>
            <span className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-white/5" />
            <span className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-bl-[80px] bg-white/5" />
          </>
        )}
        <Logo />
      </div>
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-hidden px-3 pb-1">
        {(isSuperAdmin(user) ? superLinks : links.filter((link) => !link.roles || link.roles.includes(user?.role)))
          .map(({ to, label, icon: Icon, end }) => {
            if (to === "/menu") {
              const menuActive = location.pathname === "/menu" || location.pathname.startsWith("/menu/");
              return (
                <div key={to}>
                  <button
                    type="button"
                    onClick={() => setMenuDrop((v) => !v)}
                    className={`group flex min-h-9 w-full items-center gap-3 rounded-2xl px-3 py-1.5 text-sm font-semibold text-white transition ${
                      menuDrop
                        ? "border border-white/45 bg-transparent"
                        : menuActive
                          ? "text-white shadow-sm"
                          : "text-white/80 hover:bg-white/10"
                    }`}
                    style={!menuDrop && menuActive ? { background: "var(--sidebar-active)" } : undefined}
                  >
                    <Icon size={18} strokeWidth={1.8} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-left">{label}</span>
                    <ChevronDown size={16} className={`shrink-0 transition ${menuDrop ? "rotate-180" : ""}`} />
                  </button>
                  {menuDrop ? (
                    <div className="space-y-0.5 py-1 pl-11">
                      <NavLink
                        to="/menu/categories"
                        className={({ isActive }) =>
                          `flex min-h-8 items-center text-sm font-medium ${isActive ? "text-white" : "text-white/90 hover:text-white"}`
                        }
                      >
                        Add category
                      </NavLink>
                      <NavLink
                        to="/menu"
                        end
                        className={({ isActive }) =>
                          `flex min-h-8 items-center text-sm font-medium ${isActive ? "text-white" : "text-white/90 hover:text-white"}`
                        }
                      >
                        Add Menu
                      </NavLink>
                    </div>
                  ) : null}
                </div>
              );
            }
            return (
            <NavLink
              key={label}
              to={to}
              end={end || to === "/"}
              className={({ isActive }) =>
                `group flex min-h-9 items-center gap-3 px-3 py-1.5 text-sm font-semibold transition ${
                  isActive ? "rounded-full text-white shadow-sm" : "rounded-xl text-white/75 hover:bg-white/10 hover:text-white"
                }`
              }
              style={({ isActive }) => (isActive ? { background: "var(--sidebar-active)" } : undefined)}
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} strokeWidth={1.8} className="shrink-0 opacity-95" />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {isActive ? <ChevronRight size={16} className="shrink-0 opacity-80" /> : null}
                </>
              )}
            </NavLink>
            );
          })}
      </nav>
      {tdcp ? (
        <div className="relative mt-auto shrink-0 overflow-hidden px-4 pb-3 pt-1">
          <svg className="mx-auto h-14 w-full text-[#1f7a52]" viewBox="0 0 240 110" fill="currentColor" aria-hidden="true">
            <path d="M0 92 28 58l18 16 22-34 16 20 20-28 24 30 18-16 26 28 28-22 40 40H0Z" opacity="0.55" />
            <path d="M18 96c8-18 14-22 18-22 6 10 10 14 16 14 8-16 16-30 22-30 4 8 10 16 16 16 6-12 12-20 18-20 8 14 14 22 22 22 6-8 12-10 16-8v28H18Z" />
            <path d="M36 78 40 70l4 8M70 64l4-10 4 10M150 70l4-8 4 8" fill="#0e4a34" />
          </svg>
          <p className="relative -mt-2 text-center text-[11px] font-semibold tracking-wide text-white/80">
            Explore <span className="px-1 text-white/35">|</span> Dine <span className="px-1 text-white/35">|</span> Support Tourism
          </p>
        </div>
      ) : (
        <div className="relative mt-auto h-40 overflow-hidden">
          <svg className="absolute bottom-10 left-6 h-24 w-28 text-white/25" viewBox="0 0 120 90" fill="none" aria-hidden="true">
            <path d="M18 58c0-10 8-16 16-16 2-8 9-14 18-14 10 0 18 8 19 16 8 1 14 8 14 16 0 9-8 16-17 16H28c-8 0-14-6-14-14 0-1 .2-2 .4-4Z" stroke="currentColor" strokeWidth="2" />
            <path d="M48 46v10M58 42v16M68 46v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-[#ff7a1a]" />
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-dvh overflow-hidden" style={{ background: "var(--app-bg)" }}>
      {menuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside className="app-sidebar hidden h-full w-[260px] shrink-0 flex-col overflow-hidden text-white lg:flex" style={{ background: "var(--sidebar-bg)", color: "var(--sidebar-text)" }}>
        {sidebar}
      </aside>

      <aside
        className={`app-sidebar fixed inset-y-0 left-0 z-50 flex h-dvh w-[280px] flex-col overflow-hidden text-white shadow-2xl transition-transform lg:hidden ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "var(--sidebar-bg)", color: "var(--sidebar-text)" }}
      >
        <button
          type="button"
          className="absolute right-3 top-3 rounded-lg p-2 text-white/80"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
        {sidebar}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header
          className={
            isPos
              ? "flex items-center justify-between gap-3 border-b px-5 py-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:px-6"
              : "flex items-center justify-between gap-3 border-b px-4 py-3 lg:px-8 lg:py-3.5"
          }
          style={{ background: "var(--header-bg)", borderColor: "var(--header-border)", color: "var(--app-text)" }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${tdcp ? "" : "lg:hidden"}`}
              style={{ borderColor: "var(--header-border)" }}
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            {isPos ? (
              <div className="flex min-w-0 items-center gap-2.5">
                <BrandLogo size={40} className="ring-1 ring-tdcp-100" />
                <div className="min-w-0">
                  <p className="text-sm font-extrabold leading-none" style={{ color: "var(--app-text)" }}>{organization?.code || "RMS"}</p>
                  <p className="mt-0.5 truncate text-xs" style={{ color: "var(--app-muted)" }}>
                    {activeRestaurant?.name || user?.restaurant_name || "Restaurant"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-2 text-sm text-slate-400">
                <span>{crumbs[0]}</span>
                <ChevronRight size={14} />
                <span className="truncate font-semibold text-[#16324a]">{crumbs[1]}</span>
              </div>
            )}
          </div>
          {isPos ? (
            <p className="hidden justify-self-center text-center text-sm font-medium tracking-wide text-tdcp-700/80 lg:block">
              Good Food · Great Views · Better Moments
            </p>
          ) : null}
          <div className={`flex shrink-0 items-center gap-2 sm:gap-3 ${isPos ? "justify-self-end" : ""}`}>
            {!isPos ? (
              <p className="hidden items-center gap-1.5 text-sm text-slate-500 lg:flex">
                {tdcp ? <CalendarDays size={14} /> : <Clock size={14} />}
                {clockLabel}
              </p>
            ) : null}
            {!isPos && !tdcp ? <ThemeToggle /> : null}
            <NotificationBell />
            <div className="relative">
              <button type="button" className="flex items-center gap-2" onClick={() => setAccountOpen((v) => !v)}>
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: tdcp ? "#16845c" : "#0c2340" }}
                >
                  {initials.slice(0, 1)}
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-semibold leading-tight">{user?.name}</p>
                  <p className="text-xs text-slate-400">{ROLE_LABELS[user?.role] || user?.role}</p>
                </div>
                <ChevronDown size={14} className={`hidden text-slate-400 sm:block ${accountOpen ? "rotate-180" : ""}`} />
              </button>
              {accountOpen ? (
                <div className="absolute right-0 z-40 mt-2 w-44 overflow-hidden rounded-xl bg-white py-1 text-sm shadow-xl ring-1 ring-slate-100">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-rose-600 hover:bg-slate-50"
                    onClick={() => {
                      const path = loginPathForSession(user, organization);
                      logout();
                      navigate(path);
                    }}
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className={`min-h-0 flex-1 overflow-auto ${isPos ? "" : "p-4 lg:p-6"}`} style={{ background: isPos ? "var(--pos-bg)" : "transparent", color: "var(--app-text)" }}>
          <Outlet />
        </main>
        <NotificationToasts />
      </div>
    </div>
  );
}
