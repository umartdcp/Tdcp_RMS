import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, Pencil, Plus, Shield, Trash2, Users } from "lucide-react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import UsersPage from "./Users";
import { organizationLogoUrl } from "../lib/orgBranding";

export default function OrganizationHub() {
  const { orgId } = useParams();
  const { user } = useAuth();
  const [org, setOrg] = useState(null);
  const [sites, setSites] = useState([]);
  const [tab, setTab] = useState("users");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ organization_name: "", organization_code: "", app_name: "", logo_url: "", primary_color: "#0c553c", secondary_color: "#2fa87a" });
  const [siteForm, setSiteForm] = useState({ name: "", code: "", address: "" });

  async function load() {
    const { data } = await api.get(`/organizations/${orgId}`);
    setOrg(data);
    setSites(data.sites || []);
    setEditForm({
      organization_name: data.name || "",
      organization_code: data.code || "",
      app_name: data.app_name || "",
      logo_url: data.logo_url || "",
      primary_color: data.primary_color || "#0c553c",
      secondary_color: data.secondary_color || "#2fa87a",
    });
  }

  useEffect(() => {
    load().catch((err) => setError(err.response?.data?.message || "Could not load organization"));
  }, [orgId]);

  const canDeleteSites =
    String(org?.code || "").toUpperCase() === "TDCP" &&
    (user?.role === "org_admin" || user?.role === "super_admin" || user?.role === "admin");

  async function deleteSite(site) {
    if (!canDeleteSites) return;
    const ok = window.confirm(`Delete ${site.name}? Orders, menu, and tables at this site will be removed.`);
    if (!ok) return;
    setError("");
    try {
      await api.delete(`/sites/${site.id}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not delete this site.");
    }
  }

  async function saveSite(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/sites", {
        organization_id: Number(orgId),
        site_name: siteForm.name,
        site_code: siteForm.code,
        address: siteForm.address,
      });
      setSiteForm({ name: "", code: "", address: "" });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not create site");
    }
  }

  const logo = organizationLogoUrl(org);
  const letter = String(org?.name || org?.code || "O").charAt(0).toUpperCase();

  const tabs = useMemo(
    () => [
      { id: "users", label: "Users & roles", icon: Shield },
      { id: "sites", label: "Sites", icon: MapPin },
    ],
    []
  );

  if (!org && !error) return <p className="text-sm text-slate-500">Loading organization…</p>;

  return (
    <div className="space-y-5">
      <Link to="/organizations" className="inline-flex items-center gap-1 text-sm font-medium text-tdcp-700">
        <ArrowLeft size={16} /> All organizations
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        {logo ? (
          <img src={logo} alt="" className="h-14 w-14 rounded-2xl object-cover" />
        ) : (
          <div className="grid h-14 w-14 place-items-center rounded-2xl text-xl font-extrabold text-white" style={{ background: org?.primary_color || "#0c553c" }}>
            {letter}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-extrabold text-tdcp-900">{org?.name}</h1>
          <p className="text-sm text-slate-500">
            {org?.code} · login at /login/{String(org?.code || "").toLowerCase()} · {org?.user_count || 0} users · {org?.site_count || sites.length} sites
          </p>
        </div>
        <button type="button" className="ml-auto inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold" onClick={() => setEditing((v) => !v)}>
          <Pencil size={14} /> {editing ? "Close" : "Edit organization"}
        </button>
      </div>

      {editing ? (
        <form
          className="grid gap-3 rounded-2xl border p-4 md:grid-cols-2"
          style={{ background: "var(--surface)" }}
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            try {
              await api.patch(`/organizations/${orgId}`, editForm);
              setEditing(false);
              await load();
            } catch (err) {
              setError(err.response?.data?.message || "Could not update organization");
            }
          }}
        >
          {["organization_name", "organization_code", "app_name", "logo_url"].map((key) => (
            <label key={key} className="text-sm font-medium capitalize">
              {key.replaceAll("_", " ")}
              <input className="mt-1 w-full rounded-xl border px-3 py-2" value={editForm[key]} onChange={(e) => setEditForm({ ...editForm, [key]: key === "organization_code" ? e.target.value.toUpperCase() : e.target.value })} />
            </label>
          ))}
          <label className="text-sm font-medium">
            Primary
            <input type="color" className="mt-1 h-10 w-full" value={editForm.primary_color} onChange={(e) => setEditForm({ ...editForm, primary_color: e.target.value })} />
          </label>
          <label className="text-sm font-medium">
            Secondary
            <input type="color" className="mt-1 h-10 w-full" value={editForm.secondary_color} onChange={(e) => setEditForm({ ...editForm, secondary_color: e.target.value })} />
          </label>
          <div className="md:col-span-2">
            <button type="submit" className="rounded-xl bg-[#0b5c45] px-4 py-2 text-sm font-semibold text-white">Save changes</button>
          </div>
        </form>
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
              tab === t.id ? "bg-tdcp-800 text-white" : "border bg-white text-tdcp-800"
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "users" ? <UsersPage organizationId={Number(orgId)} sites={sites} organization={org} /> : null}

      {tab === "sites" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <form onSubmit={saveSite} className="rounded-3xl border p-5" style={{ background: "var(--surface)" }}>
            <h2 className="font-extrabold text-tdcp-800">Add site</h2>
            <label className="mt-3 block text-sm font-medium">
              Site name
              <input required className="mt-1 w-full rounded-xl border px-3 py-2.5" value={siteForm.name} onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })} />
            </label>
            <label className="mt-3 block text-sm font-medium">
              Site code
              <input required className="mt-1 w-full rounded-xl border px-3 py-2.5" value={siteForm.code} onChange={(e) => setSiteForm({ ...siteForm, code: e.target.value.toUpperCase() })} />
            </label>
            <label className="mt-3 block text-sm font-medium">
              Address
              <input className="mt-1 w-full rounded-xl border px-3 py-2.5" value={siteForm.address} onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })} />
            </label>
            <button type="submit" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-tdcp-800 px-4 py-2.5 text-sm font-semibold text-white">
              <Plus size={16} /> Save site
            </button>
          </form>
          <div className="rounded-3xl border p-5" style={{ background: "var(--surface)" }}>
            <h2 className="flex items-center gap-2 font-extrabold text-tdcp-800">
              <Users size={16} /> Sites in this organization
            </h2>
            <div className="mt-3 space-y-2">
              {sites.map((site) => (
                <div key={site.id} className="flex items-center justify-between gap-3 rounded-xl bg-tdcp-50 px-3 py-2 text-sm">
                  <div>
                    <p className="font-semibold">{site.name}</p>
                    <p className="text-xs text-slate-500">{site.code}</p>
                  </div>
                  {canDeleteSites ? (
                    <button
                      type="button"
                      onClick={() => deleteSite(site)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
