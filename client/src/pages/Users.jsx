import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ClipboardList,
  Filter,
  Pencil,
  Plus,
  Search,
  Shield,
  Store,
  Trash2,
  Users,
  X,
} from "lucide-react";
import api from "../api";
import { FieldError, isEmail, isPersonName, lettersOnly } from "../lib/fields";
import { useAuth } from "../context/AuthContext";
import {
  ROLE_LABELS,
  creatableRoles,
  defaultCreateRole,
  isMainAdmin,
  isOrgAdmin,
} from "../modules/roles";

const PAGE_SIZE = 10;

const COLUMNS = [
  { key: "name", label: "User" },
  { key: "email", label: "Email" },
  { key: "role", label: "Role" },
  { key: "resort", label: "Site" },
  { key: "status", label: "Status" },
  { key: "action", label: "Actions" },
];

const ROLE_META = {
  super_admin: {
    label: ROLE_LABELS.super_admin,
    icon: Shield,
    chip: "bg-slate-900 text-white",
    avatar: "bg-slate-800 text-white",
  },
  org_admin: {
    label: ROLE_LABELS.org_admin,
    icon: Shield,
    chip: "bg-emerald-50 text-tdcp-700",
    avatar: "bg-tdcp-800 text-white",
  },
  admin: {
    label: ROLE_LABELS.admin,
    icon: Shield,
    chip: "bg-emerald-50 text-tdcp-700",
    avatar: "bg-tdcp-800 text-white",
  },
  manager: {
    label: ROLE_LABELS.manager,
    icon: Briefcase,
    chip: "bg-sky-50 text-sky-700",
    avatar: "bg-tdcp-100 text-tdcp-800",
  },
  order_taker: {
    label: ROLE_LABELS.order_taker,
    icon: ClipboardList,
    chip: "bg-teal-50 text-teal-800",
    avatar: "bg-teal-100 text-teal-800",
  },
  cashier: {
    label: ROLE_LABELS.cashier,
    icon: Store,
    chip: "bg-violet-50 text-violet-700",
    avatar: "bg-amber-100 text-amber-800",
  },
  kitchen: {
    label: ROLE_LABELS.kitchen,
    icon: ChefHat,
    chip: "bg-amber-50 text-amber-700",
    avatar: "bg-orange-100 text-orange-700",
  },
};

const fieldClass =
  "w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-tdcp-400 focus:ring-4 focus:ring-tdcp-100";

function initialOf(name) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

export default function UsersPage({ organizationId, sites: sitesProp, organization }) {
  const { user: me, restaurants, activeRestaurant, activeRestaurantId } = useAuth();
  const lockedSite = !isMainAdmin(me);
  const siteChoices = (sitesProp && sitesProp.length ? sitesProp : restaurants).filter(
    (s) => !organizationId || Number(s.organization_id) === Number(organizationId) || !s.organization_id
  );
  const roleOptions = creatableRoles(me);
  const emptyForm = () => ({
    name: "",
    email: "",
    password: "",
    role: defaultCreateRole(me),
    restaurant_id: String(activeRestaurantId || me?.site_id || me?.restaurant_id || siteChoices[0]?.id || ""),
  });
  const [users, setUsers] = useState([]);
  const [draft, setDraft] = useState({ q: "", role: "all" });
  const [applied, setApplied] = useState({ q: "", role: "all" });
  const [sort, setSort] = useState({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const params = {};
    if (organizationId) params.organization_id = organizationId;
    const siteId = activeRestaurantId || me?.site_id || me?.restaurant_id;
    if (!organizationId && siteId) params.site_id = siteId;
    const rows = (await api.get("/users", { params })).data || [];
    setUsers(
      siteId && !organizationId
        ? rows.filter((u) => String(u.site_id || u.restaurant_id) === String(siteId))
        : rows
    );
  }

  useEffect(() => {
    load();
  }, [organizationId, activeRestaurantId, me?.site_id, me?.restaurant_id]);

  const stats = useMemo(
    () => ({
      total: users.length,
      admin: users.filter((u) => u.role === "admin").length,
      manager: users.filter((u) => u.role === "manager").length,
      staff: users.filter((u) => ["order_taker", "cashier", "kitchen"].includes(u.role)).length,
      cashier: users.filter((u) => u.role === "cashier").length,
      kitchen: users.filter((u) => u.role === "kitchen").length,
      order_taker: users.filter((u) => u.role === "order_taker").length,
    }),
    [users]
  );

  const filtered = useMemo(() => {
    const q = applied.q.trim().toLowerCase();
    return users.filter((u) => {
      if (applied.role !== "all" && u.role !== applied.role) return false;
      if (q && !`${u.name} ${u.email}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [users, applied]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const { key, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      const pick = (row) => (key === "status" ? "active" : key === "resort" ? row.restaurant_name : row[key]);
      const av = String(pick(a) || "").toLowerCase();
      const bv = String(pick(b) || "").toLowerCase();
      if (av < bv) return -1 * mul;
      if (av > bv) return 1 * mul;
      return 0;
    });
    return list;
  }, [filtered, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const slice = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = sorted.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(safePage * PAGE_SIZE, sorted.length);

  const inputStyle = {
    background: "var(--pos-input)",
    color: "var(--app-text)",
    borderColor: "var(--surface-border)",
  };

  function toggleSort(key) {
    if (key === "action") return;
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function openAdd() {
    setError("");
    setFieldErrors({});
    setForm(emptyForm());
    setModal("add");
  }

  function openEdit(u) {
    setError("");
    setFieldErrors({});
    setForm({
      id: u.id,
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      organization_id: u.organization_id ? String(u.organization_id) : "",
      restaurant_id: String(u.site_id || u.restaurant_id || ""),
    });
    setModal("edit");
  }

  async function save(e) {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = "Name is required.";
    else if (!isPersonName(form.name)) next.name = "Name can only contain letters.";
    if (!isEmail(form.email)) next.email = "Enter a valid email address.";
    if (modal === "add" && (!form.password || form.password.length < 6)) {
      next.password = "Password must be at least 6 characters.";
    }
    if (modal === "edit" && form.password && form.password.length < 6) {
      next.password = "Password must be at least 6 characters.";
    }
    const needsSite = form.role !== "org_admin" && form.role !== "super_admin";
    const lockedId = Number(activeRestaurantId || me?.site_id || me?.restaurant_id || 0);
    if (needsSite && !(lockedSite ? lockedId : form.restaurant_id)) {
      next.restaurant_id = "Open this site before adding staff.";
    }
    setFieldErrors(next);
    if (Object.keys(next).length || busy) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
      };
      if (form.password) payload.password = form.password;
      if (organizationId) payload.organization_id = Number(organizationId);
      const chosenSite = lockedSite ? lockedId : Number(form.restaurant_id || 0);
      if (form.role !== "org_admin" && form.role !== "super_admin" && chosenSite) {
        payload.restaurant_id = chosenSite;
        payload.site_id = chosenSite;
      }
      if (modal === "edit") await api.patch(`/users/${form.id}`, payload);
      else await api.post("/users", payload);
      setModal(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save this user.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(u) {
    if (me?.id === u.id) return;
    if (!window.confirm(`Delete ${u.name}? They will no longer be able to sign in.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      await load();
    } catch (err) {
      window.alert(err.response?.data?.message || "Could not delete this user.");
    }
  }

  return (
    <div className="space-y-4">
      <section
        className="rounded-3xl border p-4 shadow-sm sm:p-6"
        style={{ background: "var(--surface)", borderColor: "var(--surface-border)", color: "var(--app-text)" }}
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-tdcp-50 text-tdcp-700">
              <Users size={22} />
            </span>
            <div>
              <h2 className="text-xl font-extrabold leading-tight">
                {organization ? `${organization.name} users & roles` : "Users & Roles"}
              </h2>
              <p className="mt-0.5 max-w-xl text-sm" style={{ color: "var(--app-muted)" }}>
                {organization || isMainAdmin(me)
                  ? "Create organization admins, site managers, and staff for this tenant only."
                  : isOrgAdmin(me)
                    ? "Manage users for your organization and its sites."
                    : "Create Order Takers, Cashiers, and Chefs for this site."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-tdcp-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
          >
            <Plus size={16} />
            {organization || isMainAdmin(me) || isOrgAdmin(me) ? "Add user" : "Add Staff"}
          </button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
          <Kpi icon={Users} label="Total Users" value={stats.total} hint={isMainAdmin(me) ? "All accounts" : "Staff at this resort"} />
          {isMainAdmin(me) ? (
            <>
              <Kpi icon={Shield} label="Main Admins" value={stats.admin} hint="HQ access" />
              <Kpi icon={Briefcase} label="Resort Admins" value={stats.manager} hint="Full resort access" />
              <Kpi icon={Store} label="Resort Staff" value={stats.staff} hint="Order taker, cashier, chef" />
              <Kpi icon={ChefHat} label="Chefs" value={stats.kitchen} hint="Kitchen only" />
            </>
          ) : (
            <>
              <Kpi icon={ClipboardList} label="Order Takers" value={stats.order_taker} hint="POS, tables, orders, menu" />
              <Kpi icon={Store} label="Cashiers" value={stats.cashier} hint="POS and payments" />
              <Kpi icon={ChefHat} label="Chefs" value={stats.kitchen} hint="Kitchen only" />
            </>
          )}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tdcp-400" />
            <input
              value={draft.q}
              onChange={(e) => setDraft({ ...draft, q: e.target.value })}
              placeholder="Search by name or email..."
              className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm outline-none"
              style={inputStyle}
            />
          </div>
          <select
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            className="rounded-xl border px-3 py-2.5 text-sm"
            style={inputStyle}
          >
            <option value="all">All Roles</option>
            {(isMainAdmin(me) ? Object.keys(ROLE_META).map((id) => ({ id, label: ROLE_LABELS[id] })) : roleOptions).map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setApplied(draft);
              setPage(1);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold"
            style={{ borderColor: "var(--surface-border)" }}
          >
            <Filter size={15} />
            Filter
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                {COLUMNS.map((col, i) => {
                  const isAction = col.key === "action";
                  return (
                    <th
                      key={col.key}
                      className={`bg-tdcp-50 py-3 ${
                        i === 0
                          ? "rounded-l-2xl pl-3 pr-1"
                          : isAction
                            ? "w-px whitespace-nowrap rounded-r-2xl px-3 text-center"
                            : "px-1"
                      }`}
                    >
                      {isAction ? (
                        <span className="inline-flex h-9 w-[5rem] items-center justify-center">Actions</span>
                      ) : (
                        <button type="button" onClick={() => toggleSort(col.key)} className="inline-flex items-center gap-1">
                          {col.label}
                          <ChevronsUpDown size={12} className="opacity-40" />
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {slice.length ? (
                slice.map((u) => {
                  const meta = ROLE_META[u.role] || ROLE_META.cashier;
                  const RoleIcon = meta.icon;
                  const isMe = me?.id === u.id;
                  return (
                    <tr key={u.id} className="border-b last:border-b-0" style={{ borderColor: "var(--surface-border)" }}>
                      <td className="py-3.5 pl-3">
                        <div className="flex items-center gap-3">
                          <span className={`grid h-10 w-10 place-items-center rounded-full text-sm font-bold ${meta.avatar}`}>
                            {initialOf(u.name)}
                          </span>
                          <div>
                            <p className="font-bold leading-tight">{u.name}</p>
                            {isMe ? (
                              <p className="text-[11px] font-medium text-tdcp-600">You</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td style={{ color: "var(--app-muted)" }}>{u.email}</td>
                      <td>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.chip}`}>
                          <RoleIcon size={13} />
                          {meta.label}
                        </span>
                      </td>
                      <td style={{ color: "var(--app-muted)" }}>{u.restaurant_name || u.organization_name || "—"}</td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      </td>
                      <td className="w-px whitespace-nowrap px-3 py-3.5">
                        <div className="flex w-[5rem] items-center justify-center gap-1">
                          <button
                            type="button"
                            aria-label={`Edit ${u.name}`}
                            onClick={() => openEdit(u)}
                            className="grid h-9 w-9 place-items-center rounded-xl border text-tdcp-600 hover:bg-tdcp-50"
                            style={{ borderColor: "var(--surface-border)" }}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${u.name}`}
                            disabled={isMe}
                            onClick={() => remove(u)}
                            className="grid h-9 w-9 place-items-center rounded-xl border text-rose-400 hover:bg-rose-50 disabled:opacity-40"
                            style={{ borderColor: "var(--surface-border)" }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={COLUMNS.length} className="py-12 text-center text-sm" style={{ color: "var(--app-muted)" }}>
                    No users match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs" style={{ color: "var(--app-muted)" }}>
            Showing {from} to {to} of {sorted.length} users
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous page"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="grid h-8 w-8 place-items-center rounded-lg border disabled:opacity-40"
              style={{ borderColor: "var(--surface-border)" }}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="grid h-8 min-w-8 place-items-center rounded-lg bg-tdcp-800 px-2 text-sm font-bold text-white">
              {safePage}
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={safePage >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="grid h-8 w-8 place-items-center rounded-lg border disabled:opacity-40"
              style={{ borderColor: "var(--surface-border)" }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {modal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={save}
            className="w-full max-w-md rounded-2xl p-6 shadow-xl"
            style={{ background: "var(--surface)", color: "var(--app-text)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {modal === "edit" ? "Edit user" : "Add user"}
              </h3>
              <button type="button" onClick={() => setModal(null)} className="rounded-lg p-1 hover:bg-tdcp-50" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-3">
              <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                Full name
                <input
                  required
                  className={`${fieldClass} mt-1`}
                  style={inputStyle}
                  placeholder="e.g. Amina Khan"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: lettersOnly(e.target.value) })}
                />
                <FieldError message={fieldErrors.name} />
              </label>
              <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                Email
                <input
                  required
                  type="email"
                  className={`${fieldClass} mt-1`}
                  style={inputStyle}
                  placeholder="name@tdcp.gov.pk"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value.replace(/\s/g, "") })}
                />
                <FieldError message={fieldErrors.email} />
              </label>
              <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                {modal === "edit" ? "Password (leave blank to keep)" : "Password"}
                <input
                  type="password"
                  required={modal === "add"}
                  className={`${fieldClass} mt-1`}
                  style={inputStyle}
                  placeholder={modal === "edit" ? "••••••••" : "Set a sign-in password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <FieldError message={fieldErrors.password} />
              </label>
              <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                Role
                <select
                  className={`${fieldClass} mt-1`}
                  style={inputStyle}
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  {(roleOptions.some((r) => r.id === form.role)
                    ? roleOptions
                    : [{ id: form.role, label: ROLE_LABELS[form.role] || form.role }, ...roleOptions]
                  ).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              {form.role !== "org_admin" && form.role !== "super_admin" ? (
                lockedSite ? (
                  <div>
                    <p className="rounded-xl bg-tdcp-50 px-3 py-2 text-sm font-semibold text-tdcp-800">
                      Site: {activeRestaurant?.name || me?.restaurant_name || "this site"}
                    </p>
                    <FieldError message={fieldErrors.restaurant_id} />
                  </div>
                ) : (
                  <label className="text-xs font-semibold" style={{ color: "var(--app-muted)" }}>
                    Site
                    <select
                      required
                      className={`${fieldClass} mt-1`}
                      style={inputStyle}
                      value={form.restaurant_id}
                      onChange={(e) => setForm({ ...form, restaurant_id: e.target.value })}
                    >
                      <option value="">Select site</option>
                      {siteChoices.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <FieldError message={fieldErrors.restaurant_id} />
                  </label>
                )
              ) : null}
              {error ? <p className="text-sm font-medium text-rose-500">{error}</p> : null}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border py-2.5 text-sm font-semibold"
                style={{ borderColor: "var(--surface-border)" }}
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-tdcp-800 py-2.5 text-sm font-semibold text-white">
                {busy ? "Saving…" : modal === "edit" ? "Save changes" : "Create user"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint }) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border px-4 py-3.5"
      style={{ background: "var(--surface)", borderColor: "var(--surface-border)" }}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-tdcp-50 text-tdcp-600">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium" style={{ color: "var(--app-muted)" }}>
          {label}
        </p>
        <p className="text-lg font-extrabold leading-tight">{value}</p>
        <p className="truncate text-[11px]" style={{ color: "var(--app-muted)" }}>
          {hint}
        </p>
      </div>
    </div>
  );
}
