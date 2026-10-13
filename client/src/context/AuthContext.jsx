import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../api";
import { applyBrandTheme, clearBrandTheme } from "../lib/brandTheme";
import { SERVEX } from "../lib/platform";
import { canSwitchSites } from "../modules/roles";

const AuthContext = createContext(null);
const ACTIVE_KEY = "tdcp_active_restaurant";

function persistSession(data) {
  if (data?.token) localStorage.setItem("tdcp_token", data.token);
  const user = data?.user || null;
  if (user) localStorage.setItem("tdcp_user", JSON.stringify(user));
  if (data?.organization) localStorage.setItem("rms_organization", JSON.stringify(data.organization));
  else if (data && "organization" in data) localStorage.removeItem("rms_organization");
  if (data?.site) localStorage.setItem("rms_site", JSON.stringify(data.site));
  else if (data && "site" in data) localStorage.removeItem("rms_site");
  if (data?.permissions) localStorage.setItem("rms_permissions", JSON.stringify(data.permissions));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("tdcp_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [organization, setOrganization] = useState(() => {
    const raw = localStorage.getItem("rms_organization");
    return raw ? JSON.parse(raw) : null;
  });
  const [site, setSite] = useState(() => {
    const raw = localStorage.getItem("rms_site");
    return raw ? JSON.parse(raw) : null;
  });
  const [permissions, setPermissions] = useState(() => {
    const raw = localStorage.getItem("rms_permissions");
    return raw ? JSON.parse(raw) : [];
  });
  const [loading, setLoading] = useState(true);
  const [restaurants, setRestaurants] = useState([]);
  const [activeRestaurantId, setActiveRestaurantId] = useState(() => localStorage.getItem(ACTIVE_KEY) || "");

  function applySession(data) {
    if (data.user) setUser(data.user);
    if (data.organization !== undefined) {
      setOrganization(data.organization);
      if (data.organization) localStorage.setItem("rms_organization", JSON.stringify(data.organization));
      else localStorage.removeItem("rms_organization");
    }
    if (data.site !== undefined) {
      setSite(data.site);
      if (data.site) localStorage.setItem("rms_site", JSON.stringify(data.site));
      else localStorage.removeItem("rms_site");
    }
    if (data.permissions) {
      setPermissions(data.permissions);
      localStorage.setItem("rms_permissions", JSON.stringify(data.permissions));
    }
    const role = data.user?.role || user?.role;
    if (role === "super_admin" || role === "admin") applyBrandTheme(SERVEX);
    else applyBrandTheme(data.organization !== undefined ? data.organization : organization);
  }

  useEffect(() => {
    if (user?.role === "super_admin" || user?.role === "admin") applyBrandTheme(SERVEX);
    else applyBrandTheme(organization);
  }, [organization, user?.role]);

  useEffect(() => {
    const token = localStorage.getItem("tdcp_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => {
        persistSession(res.data);
        applySession(res.data);
      })
      .catch((err) => {
        if (err?.response?.status !== 401) return;
        setUser(null);
        setOrganization(null);
        setSite(null);
        localStorage.removeItem("tdcp_token");
        localStorage.removeItem("tdcp_user");
        localStorage.removeItem("rms_organization");
        localStorage.removeItem("rms_site");
      })
      .finally(() => setLoading(false));
  }, []);

  async function loadRestaurants() {
    if (!user || !canSwitchSites(user)) {
      setRestaurants([]);
      return;
    }
    try {
      const { data } = await api.get("/restaurants");
      setRestaurants(data || []);
    } catch {
      setRestaurants([]);
    }
  }

  useEffect(() => {
    loadRestaurants();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (!canSwitchSites(user)) {
      const id = String(user.site_id || user.restaurant_id || "");
      setActiveRestaurantId(id);
      if (id) localStorage.setItem(ACTIVE_KEY, id);
      return;
    }
    if (!restaurants.length) return;
    const saved = String(activeRestaurantId || localStorage.getItem(ACTIVE_KEY) || "");
    if (saved && restaurants.some((r) => String(r.id) === saved)) {
      if (saved !== String(activeRestaurantId)) setActiveRestaurantId(saved);
      return;
    }
    if (saved) return;
    const next = String(user.restaurant_id || user.site_id || restaurants[0].id);
    setActiveRestaurantId(next);
    localStorage.setItem(ACTIVE_KEY, next);
  }, [user, restaurants]);

  const activeRestaurant =
    restaurants.find((r) => String(r.id) === String(activeRestaurantId)) ||
    restaurants.find((r) => String(r.id) === String(user?.site_id || user?.restaurant_id)) ||
    null;

  const value = useMemo(
    () => ({
      user,
      organization,
      site,
      permissions,
      loading,
      restaurants,
      refreshRestaurants: loadRestaurants,
      activeRestaurant,
      activeRestaurantId: activeRestaurant?.id || user?.site_id || user?.restaurant_id || "",
      setActiveRestaurant: (id) => {
        const next = id ? String(id) : "";
        setActiveRestaurantId(next);
        if (next) {
          localStorage.setItem(ACTIVE_KEY, next);
          localStorage.setItem("tdcp_site_pinned", "1");
        } else {
          localStorage.removeItem(ACTIVE_KEY);
          localStorage.removeItem("tdcp_site_pinned");
        }
        const match = restaurants.find((r) => String(r.id) === next);
        if (match) {
          setSite({
            site_id: match.id,
            code: match.site_code,
            name: match.name,
            organization_id: match.organization_id,
          });
        }
      },
      login: async (email, password, organizationCode, portal) => {
        const { data } = await api.post("/auth/login", {
          email,
          password,
          organization_code: organizationCode || undefined,
          portal: portal || undefined,
        });
        persistSession(data);
        applySession(data);
        if (!canSwitchSites(data.user)) {
          const id = String(data.user.site_id || data.user.restaurant_id || "");
          localStorage.setItem(ACTIVE_KEY, id);
          localStorage.setItem("tdcp_site_pinned", "1");
          setActiveRestaurantId(id);
        }
        return data.user;
      },
      logout: () => {
        localStorage.removeItem("tdcp_token");
        localStorage.removeItem("tdcp_user");
        localStorage.removeItem("rms_organization");
        localStorage.removeItem("rms_site");
        localStorage.removeItem("rms_permissions");
        localStorage.removeItem(ACTIVE_KEY);
        localStorage.removeItem("tdcp_site_pinned");
        setActiveRestaurantId("");
        setUser(null);
        setOrganization(null);
        setSite(null);
        setPermissions([]);
        clearBrandTheme();
      },
      applyUser: (next) => {
        if (next?.user) {
          applySession(next);
          localStorage.setItem("tdcp_user", JSON.stringify(next.user));
          return;
        }
        setUser(next);
        localStorage.setItem("tdcp_user", JSON.stringify(next));
      },
    }),
    [user, organization, site, permissions, loading, restaurants, activeRestaurant]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
