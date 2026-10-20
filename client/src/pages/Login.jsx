import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import ScenicLogin from "../components/ScenicLogin";
import { applyBrandTheme, TDCP_BRAND } from "../lib/brandTheme";
import { canAccessPath, homePath } from "../modules/roles";
import { consumeReturnPath } from "../lib/platform";

export default function Login({ code }) {
  const { login, logout, user } = useAuth();
  const navigate = useNavigate();
  const { orgCode: paramCode } = useParams();
  const desktopTdcp = Boolean(window.tdcpDesktop?.tdcpOnly) || /Electron/i.test(navigator.userAgent || "");
  const orgCode = desktopTdcp ? "tdcp" : code || paramCode;
  const tdcpLogin = desktopTdcp || String(orgCode || "").toLowerCase() === "tdcp";
  const [email, setEmail] = useState(() => localStorage.getItem("servex_email") || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [org, setOrg] = useState(null);

  useEffect(() => {
    const code = (orgCode || "").toLowerCase();
    if (tdcpLogin) {
      setOrg(TDCP_BRAND);
      applyBrandTheme(TDCP_BRAND);
    }
    if (!code || code === "servex") return;
    api
      .get(`/auth/branding/${code}`)
      .then((res) => {
        const next = tdcpLogin ? { ...TDCP_BRAND, ...res.data.organization, ...TDCP_BRAND } : res.data.organization;
        setOrg(next);
        applyBrandTheme(next);
      })
      .catch(() => {
        if (!tdcpLogin) setOrg(null);
      });
  }, [orgCode, tdcpLogin]);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const signedIn = await login(email, password, desktopTdcp ? "tdcp" : org?.code || orgCode, "org");
      if (desktopTdcp && (signedIn?.role === "super_admin" || signedIn?.role === "admin")) {
        logout();
        setError("This app is for TDCP accounts only.");
        return;
      }
      const back = consumeReturnPath("");
      navigate(back && canAccessPath(signedIn, back) ? back : homePath(signedIn));
    } catch (err) {
      setError(
        err.response?.data?.message ||
          (err.request && !err.response
            ? desktopTdcp
              ? "You are offline. Sign in when the connection is back. Orders already saved on this device will sync to the admin dashboard."
              : "Cannot reach the API. Start the server with npm run dev from the project root."
            : "Unable to sign in")
      );
    } finally {
      setBusy(false);
    }
  }

  if (user) {
    const back = consumeReturnPath("");
    return <Navigate to={back && canAccessPath(user, back) ? back : homePath(user)} replace />;
  }
  if (String(orgCode || "").toLowerCase() === "servex") return <Navigate to="/login/servex" replace />;

  const name = tdcpLogin ? "TDCP Restaurant Management System" : org?.app_name || org?.name || "your restaurant";

  return (
    <ScenicLogin
      variant={tdcpLogin ? "tdcp" : "kitchen"}
      title="Welcome Back"
      subtitle={tdcpLogin ? "Sign in to your TDCP resort account" : `Sign in to ${name}`}
      email={email}
      password={password}
      onEmail={setEmail}
      onPassword={setPassword}
      onSubmit={onSubmit}
      busy={busy}
      error={error}
      emailPlaceholder="Enter your restaurant email"
    />
  );
}
