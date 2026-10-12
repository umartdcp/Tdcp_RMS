import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import api from "../api";
import BrandLogo from "../components/BrandLogo";
import ServexMark from "../components/ServexMark";
import { useAuth } from "../context/AuthContext";
import { applyBrandTheme } from "../lib/brandTheme";
import { homePath } from "../modules/roles";

export default function OrgPortal() {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    applyBrandTheme(null);
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .get("/auth/portals")
      .then((res) => {
        if (alive) setOrgs(res.data.organizations || []);
      })
      .catch(() => {
        if (alive) setError("The organization list could not be loaded.");
      });
    return () => {
      alive = false;
    };
  }, []);

  if (user) return <Navigate to={homePath(user)} replace />;

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <div className="min-h-dvh bg-[#f3f6f8] px-4 py-10 text-[#16324a]">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold tracking-[0.18em] text-[#0e4a34]">RESTAURANT MANAGEMENT</p>
        <h1 className="mt-2 text-3xl font-extrabold">Choose your organization</h1>
        <p className="mt-2 text-sm text-slate-500">Each organization has its own sign-in link. Open that link to use only that restaurant.</p>

        {error ? <p className="mt-6 text-sm text-rose-600">{error}</p> : null}

        <div className="mt-6 grid gap-3">
          {orgs.map((org) => (
            <Link
              key={org.code}
              to={org.link}
              className="flex items-center gap-4 rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-slate-100 transition hover:ring-[#16845c]"
            >
              <BrandLogo size={56} organization={org} />
              <span className="min-w-0 flex-1">
                <span className="block font-extrabold">{org.app_name || org.name}</span>
                <span className="mt-0.5 block truncate text-sm text-slate-500">{`${origin}${org.link}`}</span>
              </span>
              <span className="text-xs font-bold tracking-wide text-[#0e4a34]">{org.code}</span>
            </Link>
          ))}
          <Link
            to="/login/servex"
            className="flex items-center gap-4 rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-slate-100 transition hover:ring-[#ff7a1a]"
          >
            <ServexMark size={36} />
            <span className="min-w-0 flex-1">
              <span className="block font-extrabold">Platform admin</span>
              <span className="mt-0.5 block truncate text-sm text-slate-500">{`${origin}/login/servex`}</span>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
