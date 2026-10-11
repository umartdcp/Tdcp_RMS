import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Building2,
  CalendarDays,
  Check,
  Cloud,
  LogOut,
  Mail,
  Moon,
  Pencil,
  Shield,
  Sun,
  User,
  UtensilsCrossed,
} from "lucide-react";
import api from "../api";
import { isEmail, isPersonName, lettersOnly, textNameOnly } from "../lib/fields";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { isSuperAdmin } from "../modules/roles";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "appearance", label: "Appearance", icon: Sun },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "restaurant", label: "Restaurant", icon: UtensilsCrossed },
  { id: "hq", label: "HQ sync", icon: Cloud },
];

const NOTIFY_DEFAULT = {
  pending: true,
  confirmed: true,
  cancelled: true,
  orders: true,
  kitchen: true,
  email: false,
};

const ROLE_LABEL = {
  admin: "Administrator",
  manager: "Manager",
  cashier: "Cashier",
  kitchen: "Kitchen",
};

const fieldClass =
  "w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-tdcp-400 focus:ring-4 focus:ring-tdcp-100";

function initialOf(name) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

function loadNotify() {
  try {
    return { ...NOTIFY_DEFAULT, ...JSON.parse(localStorage.getItem("tdcp_notify_prefs") || "{}") };
  } catch {
    return { ...NOTIFY_DEFAULT };
  }
}

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout, applyUser, activeRestaurant, refreshRestaurants } = useAuth();
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState("profile");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [notify, setNotify] = useState(loadNotify);
  const [hq, setHq] = useState(null);
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    current_password: "",
    new_password: "",
    confirm_password: "",
    restaurant_name: "",
    restaurant_location: "",
  });

  const restaurantName = activeRestaurant?.name || user?.restaurant_name || "—";

  useEffect(() => {
    setForm((f) => ({
      ...f,
      name: user?.name || "",
      email: user?.email || "",
      restaurant_name: activeRestaurant?.name || user?.restaurant_name || "",
      restaurant_location: activeRestaurant?.location || "",
    }));
  }, [user, activeRestaurant]);

  useEffect(() => {
    if (tab !== "hq") return;
    api.get("/sync/status").then((res) => setHq(res.data)).catch(() => setHq(null));
  }, [tab]);

  const inputStyle = {
    background: "var(--pos-input)",
    color: "var(--app-text)",
    borderColor: "var(--surface-border)",
  };

  const cardStyle = {
    background: "var(--surface)",
    borderColor: "var(--surface-border)",
    color: "var(--app-text)",
  };

  async function saveAll() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!isPersonName(form.name)) {
        setError("Name can only contain letters.");
        setBusy(false);
        return;
      }
      if (!isEmail(form.email)) {
        setError("Enter a valid email address.");
        setBusy(false);
        return;
      }
      if (form.new_password && form.new_password !== form.confirm_password) {
        setError("New password and confirmation do not match.");
        setBusy(false);
        return;
      }
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
      };
      if (form.new_password) {
        payload.current_password = form.current_password;
        payload.new_password = form.new_password;
      }
      const { data } = await api.patch("/auth/profile", payload);
      applyUser({
        ...user,
        ...data.user,
        restaurant_name:
          user?.role === "admin" && form.restaurant_name.trim()
            ? form.restaurant_name.trim()
            : data.user.restaurant_name,
      });
      localStorage.setItem("tdcp_notify_prefs", JSON.stringify(notify));
      window.dispatchEvent(new Event("tdcp-notify-prefs"));

      if (user?.role === "admin" && activeRestaurant?.id) {
        const name = form.restaurant_name.trim();
        const location = form.restaurant_location.trim();
        if (
          name &&
          (name !== activeRestaurant.name || location !== (activeRestaurant.location || ""))
        ) {
          await api.patch(`/restaurants/${activeRestaurant.id}`, { name, location });
          await refreshRestaurants?.();
        }
      }

      setForm((f) => ({ ...f, current_password: "", new_password: "", confirm_password: "" }));
      setEditing(false);
      setMessage("Settings saved.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not save settings.");
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    logout();
    navigate("/login");
  }

  const roleLabel = ROLE_LABEL[user?.role] || user?.role || "Staff";

  const infoCards = useMemo(
    () => [
      { icon: Mail, label: "Email", value: user?.email || "—" },
      { icon: Building2, label: "Restaurant", value: restaurantName },
      { icon: Shield, label: "Role", value: roleLabel },
      { icon: CalendarDays, label: "Signed in as", value: user?.name || "—" },
    ],
    [user, restaurantName, roleLabel]
  );

  return (
    <section className="overflow-hidden rounded-3xl border shadow-sm lg:grid lg:grid-cols-[220px_1fr]" style={cardStyle}>
      <aside className="border-b p-3 lg:border-b-0 lg:border-r" style={{ borderColor: "var(--surface-border)" }}>
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          {(isSuperAdmin(user) ? TABS.filter((item) => item.id !== "restaurant" && item.id !== "hq") : TABS).map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex min-h-11 shrink-0 items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-semibold ${
                  active ? "bg-tdcp-50 text-tdcp-800" : ""
                }`}
                style={active ? undefined : { color: "var(--app-muted)" }}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="p-4 sm:p-6">
        <div className="mb-5">
          <h2 className="text-xl font-extrabold">Settings</h2>
          <p className="mt-0.5 text-sm" style={{ color: "var(--app-muted)" }}>
            Manage your restaurant profile, appearance, and session details.
          </p>
        </div>

        {tab === "profile" ? (
          <div className="rounded-3xl border p-4 sm:p-5" style={{ borderColor: "var(--surface-border)" }}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold">
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-tdcp-50 text-tdcp-700">
                  <User size={16} />
                </span>
                Profile Information
              </div>
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold text-tdcp-700"
                style={{ borderColor: "var(--surface-border)" }}
              >
                <Pencil size={13} />
                {editing ? "Cancel" : "Edit Profile"}
              </button>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-tdcp-800 text-2xl font-bold text-white">
                {initialOf(user?.name)}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-extrabold">{user?.name}</p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-tdcp-50 px-2 py-0.5 text-[11px] font-semibold text-tdcp-700">
                    <Shield size={11} />
                    {roleLabel}
                  </span>
                </div>
                <p className="text-sm" style={{ color: "var(--app-muted)" }}>
                  {restaurantName}
                </p>
              </div>
            </div>

            {editing ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                  Full name
                  <input
                    className={`${fieldClass} mt-1`}
                    style={inputStyle}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: lettersOnly(e.target.value) })}
                  />
                </label>
                <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                  Email
                  <input
                    type="email"
                    className={`${fieldClass} mt-1`}
                    style={inputStyle}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </label>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {infoCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.label} className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--surface-border)" }}>
                      <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--app-muted)" }}>
                        <Icon size={13} className="text-tdcp-600" />
                        {card.label}
                      </p>
                      <p className="mt-1 font-semibold">{card.value}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {tab === "appearance" ? (
          <Panel title="Appearance" hint="Choose your preferred theme">
            <div className="inline-flex rounded-full border bg-tdcp-50 p-1" style={{ borderColor: "var(--surface-border)" }}>
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ${
                  theme === "light" ? "bg-white text-tdcp-800 shadow-sm" : ""
                }`}
                style={theme === "light" ? undefined : { color: "var(--app-muted)" }}
              >
                <Sun size={15} />
                Light
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ${
                  theme === "dark" ? "bg-white text-tdcp-800 shadow-sm" : ""
                }`}
                style={theme === "dark" ? undefined : { color: "var(--app-muted)" }}
              >
                <Moon size={15} />
                Dark
              </button>
            </div>
          </Panel>
        ) : null}

        {tab === "notifications" ? (
          <Panel title="Notifications" hint="Choose which alerts you want while working in RMS.">
            <div className="space-y-3">
              <ToggleRow
                label="Pending orders"
                hint="New and in-kitchen tickets waiting to be prepared"
                checked={notify.pending !== false}
                onChange={(v) => setNotify({ ...notify, pending: v, kitchen: v })}
              />
              <ToggleRow
                label="Confirmed orders"
                hint="Orders marked ready, completed, or paid"
                checked={notify.confirmed !== false}
                onChange={(v) => setNotify({ ...notify, confirmed: v, orders: v })}
              />
              <ToggleRow
                label="Cancelled orders"
                hint="Tickets the kitchen or cashier cancelled"
                checked={notify.cancelled !== false}
                onChange={(v) => setNotify({ ...notify, cancelled: v })}
              />
              <ToggleRow
                label="Email summaries"
                hint="Daily sales summary to your inbox"
                checked={notify.email}
                onChange={(v) => setNotify({ ...notify, email: v })}
              />
            </div>
          </Panel>
        ) : null}

        {tab === "security" ? (
          <Panel title="Security" hint="Update your password. Leave blank to keep the current one.">
            <div className="grid max-w-md gap-3">
              <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                Current password
                <input
                  type="password"
                  className={`${fieldClass} mt-1`}
                  style={inputStyle}
                  value={form.current_password}
                  onChange={(e) => setForm({ ...form, current_password: e.target.value })}
                />
              </label>
              <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                New password
                <input
                  type="password"
                  className={`${fieldClass} mt-1`}
                  style={inputStyle}
                  value={form.new_password}
                  onChange={(e) => setForm({ ...form, new_password: e.target.value })}
                />
              </label>
              <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                Confirm new password
                <input
                  type="password"
                  className={`${fieldClass} mt-1`}
                  style={inputStyle}
                  value={form.confirm_password}
                  onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                />
              </label>
            </div>
          </Panel>
        ) : null}

        {tab === "restaurant" ? (
          <Panel title="Restaurant" hint="Details for the currently selected resort restaurant.">
            {user?.role === "admin" ? (
              <div className="grid max-w-md gap-3">
                <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                  Restaurant name
                  <input
                    className={`${fieldClass} mt-1`}
                    style={inputStyle}
                    value={form.restaurant_name}
                    onChange={(e) => setForm({ ...form, restaurant_name: textNameOnly(e.target.value) })}
                  />
                </label>
                <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                  Location
                  <input
                    className={`${fieldClass} mt-1`}
                    style={inputStyle}
                    value={form.restaurant_location}
                    onChange={(e) => setForm({ ...form, restaurant_location: textNameOnly(e.target.value) })}
                  />
                </label>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Info label="Restaurant" value={restaurantName} />
                <Info label="Location" value={activeRestaurant?.location || "—"} />
              </div>
            )}
          </Panel>
        ) : null}

        {tab === "hq" ? (
          <Panel
            title="HQ sync"
            hint="Orders save on this PC first. When internet is on, they copy to the admin dashboard."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Status" value={hq?.enabled ? "Ready" : "Not configured"} />
              <Info label="This restaurant" value={hq?.restaurant || "—"} />
              <Info label="HQ address" value={hq?.hq || "—"} />
              <Info
                label="Last success"
                value={hq?.lastOk ? new Date(hq.lastOk).toLocaleString() : "Not yet"}
              />
            </div>
            {hq?.lastError ? <p className="mt-3 text-sm text-amber-700">{hq.lastError}</p> : null}
            <button
              type="button"
              disabled={busy || !hq?.enabled}
              onClick={async () => {
                setBusy(true);
                setError("");
                setMessage("");
                try {
                  const res = await api.post("/sync/now");
                  setHq(res.data);
                  setMessage(res.data.lastError ? "Saved locally. HQ not reached." : "Synced to HQ.");
                  if (res.data.lastError) setError(res.data.lastError);
                } catch (err) {
                  setError(err.response?.data?.message || "Sync failed");
                } finally {
                  setBusy(false);
                }
              }}
              className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-tdcp-200 px-4 py-2 text-sm font-semibold text-tdcp-900 disabled:opacity-60"
            >
              Sync now
            </button>
          </Panel>
        ) : null}

        {tab === "profile" ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border px-4 py-3" style={{ borderColor: "var(--surface-border)" }}>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-tdcp-50 text-tdcp-700">
                  <Sun size={16} />
                </span>
                <div>
                  <p className="font-semibold">Appearance</p>
                  <p className="text-xs" style={{ color: "var(--app-muted)" }}>
                    Choose your preferred theme
                  </p>
                </div>
              </div>
              <div className="inline-flex rounded-full border bg-tdcp-50 p-1" style={{ borderColor: "var(--surface-border)" }}>
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    theme === "light" ? "bg-white text-tdcp-800 shadow-sm" : ""
                  }`}
                  style={theme === "light" ? undefined : { color: "var(--app-muted)" }}
                >
                  <Sun size={13} />
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    theme === "dark" ? "bg-white text-tdcp-800 shadow-sm" : ""
                  }`}
                  style={theme === "dark" ? undefined : { color: "var(--app-muted)" }}
                >
                  <Moon size={13} />
                  Dark
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border px-4 py-3" style={{ borderColor: "var(--surface-border)" }}>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-tdcp-50 text-tdcp-700">
                  <Shield size={16} />
                </span>
                <div>
                  <p className="font-semibold">Active Session</p>
                  <p className="text-xs" style={{ color: "var(--app-muted)" }}>
                    You are currently signed in to the system
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Active Now
              </span>
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-rose-500">{error}</p> : null}
        {message ? (
          <p className="mt-4 flex items-center gap-1.5 text-sm font-medium text-tdcp-700">
            <Check size={15} />
            {message}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={signOut} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-50">
            <LogOut size={15} />
            Logout
          </button>
          <button
            type="button"
            onClick={saveAll}
            disabled={busy}
            className="inline-flex min-h-10 items-center rounded-xl bg-tdcp-200 px-4 py-2 text-sm font-semibold text-tdcp-900 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </section>
  );
}

function Panel({ title, hint, children }) {
  return (
    <div className="rounded-3xl border p-4 sm:p-5" style={{ borderColor: "var(--surface-border)" }}>
      <h3 className="font-semibold">{title}</h3>
      <p className="mb-4 mt-0.5 text-sm" style={{ color: "var(--app-muted)" }}>
        {hint}
      </p>
      {children}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--surface-border)" }}>
      <p className="text-xs" style={{ color: "var(--app-muted)" }}>
        {label}
      </p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: "var(--surface-border)" }}>
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="text-xs" style={{ color: "var(--app-muted)" }}>
          {hint}
        </span>
      </span>
      <input
        type="checkbox"
        className="h-4 w-4 accent-tdcp-700"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
