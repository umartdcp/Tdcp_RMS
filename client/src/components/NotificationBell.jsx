import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { notificationStamp, useNotifications } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import { canAccessPath, homePath } from "../modules/roles";

const TABS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "confirmed", label: "Confirmed" },
  { id: "cancelled", label: "Cancelled" },
];

const KIND_META = {
  pending: {
    label: "Pending",
    Icon: Clock3,
    className: "bg-amber-50 text-amber-700",
    toastClass: "border-amber-200 bg-amber-50 text-amber-900",
    title: (n) => `Order #${n.order_no} is pending in the kitchen`,
  },
  confirmed: {
    label: "Confirmed",
    Icon: CheckCircle2,
    className: "bg-emerald-50 text-tdcp-700",
    toastClass: "border-emerald-200 bg-emerald-50 text-emerald-900",
    title: (n) =>
      n.payment_status === "paid"
        ? `Order #${n.order_no} is confirmed and paid`
        : `Order #${n.order_no} is confirmed / ready`,
  },
  cancelled: {
    label: "Cancelled",
    Icon: XCircle,
    className: "bg-rose-50 text-rose-600",
    toastClass: "border-rose-200 bg-rose-50 text-rose-900",
    title: (n) => `Order #${n.order_no} was cancelled`,
  },
};

function timeAgo(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function openOrdersOrHome(navigate, user) {
  navigate(canAccessPath(user, "/orders") ? "/orders" : homePath(user));
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const boxRef = useRef(null);
  const {
    items,
    counts,
    read,
    prefs,
    openTab,
    setOpenTab,
    markRead,
  } = useNotifications() || {};

  const open = openTab != null;
  const tab = openTab || "all";

  useEffect(() => {
    function onDoc(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpenTab?.(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [setOpenTab]);

  const visible = useMemo(
    () =>
      (items || []).filter((n) => {
        if (!KIND_META[n.kind] || !prefs?.[n.kind]) return false;
        if (tab !== "all" && n.kind !== tab) return false;
        return true;
      }),
    [items, tab, prefs]
  );

  const unread = (items || []).filter((n) => KIND_META[n.kind] && prefs?.[n.kind] && !read?.[notificationStamp(n)]).length;

  function markAllRead() {
    markRead(visible.map(notificationStamp));
  }

  function openItem(n) {
    markRead([notificationStamp(n)]);
    setOpenTab(null);
    openOrdersOrHome(navigate, user);
  }

  return (
    <div className="relative flex items-center" ref={boxRef}>
      <button
        type="button"
        className="relative rounded-full p-2 hover:bg-black/5"
        style={{ color: "var(--app-muted)" }}
        aria-label="Notifications"
        onClick={() => setOpenTab(open ? null : "all")}
      >
        <Bell size={18} />
        {unread ? (
          <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border shadow-xl top-full"
          style={{ background: "var(--surface)", borderColor: "var(--surface-border)", color: "var(--app-text)" }}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-bold">Notifications</p>
              <p className="text-xs" style={{ color: "var(--app-muted)" }}>
                Pending, confirmed, and cancelled orders
              </p>
            </div>
            {unread ? (
              <button type="button" className="text-xs font-semibold text-tdcp-700" onClick={markAllRead}>
                Mark read
              </button>
            ) : null}
          </div>
          <div className="flex gap-1 px-3 pb-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setOpenTab(t.id)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  tab === t.id ? "bg-tdcp-800 text-white" : "bg-tdcp-50 text-tdcp-700"
                }`}
              >
                {t.label}
                {t.id !== "all" && counts?.[t.id] ? ` ${counts[t.id]}` : ""}
              </button>
            ))}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {visible.length ? (
              visible.map((n) => {
                const meta = KIND_META[n.kind];
                const Icon = meta.Icon;
                const unseen = !read?.[notificationStamp(n)];
                return (
                  <button
                    key={notificationStamp(n)}
                    type="button"
                    onClick={() => openItem(n)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-tdcp-50/80"
                    style={unseen ? { background: "rgba(238,248,243,0.7)" } : undefined}
                  >
                    <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${meta.className}`}>
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold leading-snug">{meta.title(n)}</span>
                      <span className="mt-0.5 block text-xs" style={{ color: "var(--app-muted)" }}>
                        Table {n.table_label || "—"} · {meta.label} · {timeAgo(n.updated_at || n.created_at)}
                      </span>
                    </span>
                    {unseen ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-tdcp-500" /> : null}
                  </button>
                );
              })
            ) : (
              <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--app-muted)" }}>
                No {tab === "all" ? "" : `${tab} `}notifications right now.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function NotificationToasts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const ctx = useNotifications();
  const toasts = ctx?.toasts || [];
  const prefs = ctx?.prefs;
  const dismissToast = ctx?.dismissToast;
  const markRead = ctx?.markRead;

  useEffect(() => {
    if (!toasts.length || !dismissToast) return undefined;
    const timers = toasts.map((t) => setTimeout(() => dismissToast(t.toastId), 6000));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismissToast]);

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(100vw-2rem,22rem)] flex-col gap-2">
      {toasts.map((n) => {
        const meta = KIND_META[n.kind];
        if (!meta || prefs?.[n.kind] === false) return null;
        const Icon = meta.Icon;
        return (
          <button
            key={n.toastId}
            type="button"
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-left shadow-lg ${meta.toastClass}`}
            onClick={() => {
              markRead?.([notificationStamp(n)]);
              dismissToast?.(n.toastId);
              openOrdersOrHome(navigate, user);
            }}
          >
            <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${meta.className}`}>
              <Icon size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{meta.label}</span>
              <span className="mt-0.5 block text-xs leading-snug">{meta.title(n)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
