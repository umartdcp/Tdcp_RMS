import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext(null);

export function loadNotifyPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem("tdcp_notify_prefs") || "{}");
    return {
      pending: p.pending !== false && p.kitchen !== false,
      confirmed: p.confirmed !== false && p.orders !== false,
      cancelled: p.cancelled !== false,
    };
  } catch {
    return { pending: true, confirmed: true, cancelled: true };
  }
}

function loadRead() {
  try {
    return JSON.parse(localStorage.getItem("tdcp_notif_read") || "{}");
  } catch {
    return {};
  }
}

export function notificationStamp(n) {
  return `${n.kind}:${n.id}:${n.updated_at || n.created_at}`;
}

export function NotificationProvider({ children }) {
  const { user, activeRestaurant } = useAuth();
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, confirmed: 0, cancelled: 0 });
  const [read, setRead] = useState(loadRead);
  const [prefs, setPrefs] = useState(loadNotifyPrefs);
  const [toasts, setToasts] = useState([]);
  const [openTab, setOpenTab] = useState(null);
  const seenRef = useRef(null);

  const refreshPrefs = useCallback(() => setPrefs(loadNotifyPrefs()), []);

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      setCounts({ pending: 0, confirmed: 0, cancelled: 0 });
      return;
    }
    try {
      const { data } = await api.get("/notifications");
      const list = data.items || [];
      const nextPrefs = loadNotifyPrefs();
      if (seenRef.current) {
        const fresh = list.filter((n) => nextPrefs[n.kind] && !seenRef.current.has(notificationStamp(n)));
        if (fresh.length) {
          setToasts((prev) => [...fresh.slice(0, 4).map((n) => ({ ...n, toastId: notificationStamp(n) })), ...prev].slice(0, 6));
        }
        for (const n of list) seenRef.current.add(notificationStamp(n));
      } else {
        seenRef.current = new Set(list.map(notificationStamp));
      }
      setItems(list);
      setCounts(data.counts || { pending: 0, confirmed: 0, cancelled: 0 });
    } catch {
      /* keep last list */
    }
  }, [user, activeRestaurant?.id]);

  useEffect(() => {
    seenRef.current = null;
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    function onRefresh() {
      load();
    }
    function onPrefs() {
      refreshPrefs();
    }
    window.addEventListener("tdcp-notify-refresh", onRefresh);
    window.addEventListener("storage", onPrefs);
    window.addEventListener("tdcp-notify-prefs", onPrefs);
    return () => {
      window.removeEventListener("tdcp-notify-refresh", onRefresh);
      window.removeEventListener("storage", onPrefs);
      window.removeEventListener("tdcp-notify-prefs", onPrefs);
    };
  }, [load, refreshPrefs]);

  const markRead = useCallback((stamps) => {
    setRead((prev) => {
      const next = { ...prev };
      for (const s of stamps) next[s] = true;
      localStorage.setItem("tdcp_notif_read", JSON.stringify(next));
      return next;
    });
  }, []);

  const dismissToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
  }, []);

  const value = useMemo(
    () => ({
      items,
      counts,
      read,
      prefs,
      toasts,
      openTab,
      setOpenTab,
      load,
      markRead,
      dismissToast,
      refreshPrefs,
    }),
    [items, counts, read, prefs, toasts, openTab, load, markRead, dismissToast, refreshPrefs]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationContext);
}
