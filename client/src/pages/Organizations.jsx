import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Calendar,
  Hourglass,
  Play,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import api from "../api";
import { organizationLogoUrl } from "../lib/orgBranding";
import { KitchenHero, KitchenStats } from "../components/KitchenBoard";

const emptyOrg = {
  organization_name: "",
  organization_code: "",
  app_name: "",
  primary_color: "#0c553c",
  secondary_color: "#2fa87a",
  logo_url: "",
  site_name: "Main Branch",
  site_code: "MAIN",
  admin_name: "",
  admin_email: "",
  admin_password: "admin123",
  address: "",
  phone: "",
  email: "",
};

function orgToForm(org) {
  return {
    organization_name: org.name || "",
    organization_code: org.code || "",
    app_name: org.app_name || "",
    primary_color: org.primary_color || "#0c553c",
    secondary_color: org.secondary_color || "#2fa87a",
    logo_url: org.logo_url || "",
    address: org.address || "",
    phone: org.phone || "",
    email: org.email || "",
    is_active: org.is_active !== false,
  };
}

function OrgFormFields({ form, setForm, mode }) {
  function set(key, value) {
    setForm({ ...form, [key]: value });
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="text-sm font-medium">
        Organization name
        <input required className="mt-1 w-full rounded-xl border px-3 py-2.5" value={form.organization_name} onChange={(e) => set("organization_name", e.target.value)} />
      </label>
      <label className="text-sm font-medium">
        Code
        <input required className="mt-1 w-full rounded-xl border px-3 py-2.5 uppercase" value={form.organization_code} onChange={(e) => set("organization_code", e.target.value.toUpperCase())} />
      </label>
      <label className="text-sm font-medium">
        App name
        <input className="mt-1 w-full rounded-xl border px-3 py-2.5" value={form.app_name} onChange={(e) => set("app_name", e.target.value)} />
      </label>
      <label className="text-sm font-medium">
        Logo URL
        <input className="mt-1 w-full rounded-xl border px-3 py-2.5" value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="Leave empty for letter mark" />
      </label>
      {mode === "create" ? (
        <>
          <label className="text-sm font-medium">
            First site name
            <input className="mt-1 w-full rounded-xl border px-3 py-2.5" value={form.site_name} onChange={(e) => set("site_name", e.target.value)} />
          </label>
          <label className="text-sm font-medium">
            Site code
            <input className="mt-1 w-full rounded-xl border px-3 py-2.5" value={form.site_code} onChange={(e) => set("site_code", e.target.value.toUpperCase())} />
          </label>
          <label className="text-sm font-medium">
            Organization admin name
            <input className="mt-1 w-full rounded-xl border px-3 py-2.5" value={form.admin_name} onChange={(e) => set("admin_name", e.target.value)} />
          </label>
          <label className="text-sm font-medium">
            Admin email
            <input type="email" className="mt-1 w-full rounded-xl border px-3 py-2.5" value={form.admin_email} onChange={(e) => set("admin_email", e.target.value)} />
          </label>
          <label className="text-sm font-medium">
            Admin password
            <input type="password" className="mt-1 w-full rounded-xl border px-3 py-2.5" value={form.admin_password} onChange={(e) => set("admin_password", e.target.value)} />
          </label>
        </>
      ) : (
        <>
          <label className="text-sm font-medium">
            Address
            <input className="mt-1 w-full rounded-xl border px-3 py-2.5" value={form.address || ""} onChange={(e) => set("address", e.target.value)} />
          </label>
          <label className="text-sm font-medium">
            Phone
            <input className="mt-1 w-full rounded-xl border px-3 py-2.5" value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} />
          </label>
          <label className="text-sm font-medium">
            Email
            <input type="email" className="mt-1 w-full rounded-xl border px-3 py-2.5" value={form.email || ""} onChange={(e) => set("email", e.target.value)} />
          </label>
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-medium">
          Primary
          <input type="color" className="mt-1 h-10 w-full" value={form.primary_color} onChange={(e) => set("primary_color", e.target.value)} />
        </label>
        <label className="text-sm font-medium">
          Secondary
          <input type="color" className="mt-1 h-10 w-full" value={form.secondary_color} onChange={(e) => set("secondary_color", e.target.value)} />
        </label>
      </div>
    </div>
  );
}

export default function Organizations() {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [orgForm, setOrgForm] = useState(emptyOrg);

  async function load() {
    const [o, p] = await Promise.all([api.get("/organizations"), api.get("/platform/summary")]);
    setOrgs(o.data || []);
    setSummary(p.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.response?.data?.message || "Could not load organizations"));
  }, []);

  async function saveOrg(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (modal === "create") {
        const created = await api.post("/organizations", orgForm);
        setModal(null);
        setOrgForm(emptyOrg);
        await load();
        navigate(`/organizations/${created.data.id}`);
      } else if (modal?.id) {
        await api.patch(`/organizations/${modal.id}`, {
          organization_name: orgForm.organization_name,
          organization_code: orgForm.organization_code,
          app_name: orgForm.app_name,
          logo_url: orgForm.logo_url,
          primary_color: orgForm.primary_color,
          secondary_color: orgForm.secondary_color,
          address: orgForm.address,
          phone: orgForm.phone,
          email: orgForm.email,
        });
        setModal(null);
        await load();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Could not save organization");
    } finally {
      setBusy(false);
    }
  }

  async function toggleOrg(org) {
    await api.patch(`/organizations/${org.id}`, { is_active: !org.is_active });
    await load();
  }

  const activeOrgs = Number(summary?.active_organizations) || 0;
  const totalOrgs = Number(summary?.organizations) || 0;
  const waiting = Math.max(0, totalOrgs - activeOrgs);
  const activeRate = totalOrgs ? Math.round((activeOrgs / totalOrgs) * 100) : 0;

  return (
    <div className="space-y-6">
      <KitchenHero
        eyebrow="KITCHEN"
        subtitle="Here's today's kitchen lineup across every restaurant."
        badgeValue={summary?.sites || 0}
        badgeLabel="SITES"
      />
      <KitchenStats
        items={[
          { label: "THIS WEEK", value: summary?.orders || 0, icon: Calendar, tone: "blue" },
          { label: "AWAITING", value: waiting, icon: Hourglass, tone: "orange" },
          { label: "ACTIVE", value: activeOrgs, icon: Play, tone: "green" },
          { label: "Active kitchens", ring: activeRate, detail: `${activeOrgs} of ${totalOrgs} organizations` },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#1b2a4a]">
          <span className="h-5 w-1 rounded-full bg-[#ff7a1a]" />
          Restaurants
        </h2>
        <button
          type="button"
          onClick={() => {
            setOrgForm(emptyOrg);
            setModal("create");
            setError("");
          }}
          className="inline-flex items-center gap-2 rounded-full bg-[#ff7a1a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
        >
          <Plus size={16} /> New organization
        </button>
      </div>

      {error && !modal ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {orgs.map((org) => {
          const logo = organizationLogoUrl(org);
          const letter = String(org.name || org.code || "O").charAt(0).toUpperCase();
          const active = org.is_active !== false;
          return (
            <div key={org.id} className="rounded-2xl border bg-white p-5 shadow-sm" style={{ background: "var(--surface)", borderColor: "var(--surface-border)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {logo ? (
                    <img src={logo} alt="" className="h-12 w-12 rounded-2xl object-cover" />
                  ) : (
                    <div className="grid h-12 w-12 place-items-center rounded-2xl text-lg font-extrabold text-white" style={{ background: org.primary_color || "#0b5c45" }}>
                      {letter}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-extrabold text-slate-900">{org.name}</p>
                    <p className="text-xs text-slate-500">
                      {org.code} · {active ? "Active" : "Inactive"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleOrg(org)}
                  className={`rounded-full px-3 py-1 text-[11px] font-bold ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                >
                  {active ? "On" : "Off"}
                </button>
              </div>
              <div className="mt-4 flex gap-4 text-sm text-slate-500">
                <span>{org.site_count || 0} sites</span>
                <span>{org.user_count || 0} users</span>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <Link to={`/organizations/${org.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-[#0b5c45]">
                  Manage users, roles & sites <ArrowRight size={16} />
                </Link>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-slate-600"
                  onClick={() => {
                    setOrgForm(orgToForm(org));
                    setModal(org);
                    setError("");
                  }}
                >
                  <Pencil size={12} /> Edit
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {modal ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4">
          <form onSubmit={saveOrg} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" style={{ background: "var(--surface)", color: "var(--app-text)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold">{modal === "create" ? "Create organization" : "Edit organization"}</h2>
              <button type="button" onClick={() => setModal(null)} className="rounded-lg p-1 text-slate-400">
                <X size={18} />
              </button>
            </div>
            {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
            <div className="mt-4">
              <OrgFormFields form={orgForm} setForm={setOrgForm} mode={modal === "create" ? "create" : "edit"} />
            </div>
            <div className="mt-5 flex gap-2">
              <button type="submit" disabled={busy} className="rounded-xl bg-[#0b5c45] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? "Saving..." : modal === "create" ? "Save organization" : "Save changes"}
              </button>
              <button type="button" onClick={() => setModal(null)} className="rounded-xl border px-4 py-2.5 text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
