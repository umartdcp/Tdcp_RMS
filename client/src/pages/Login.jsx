import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import ScenicLogin from "../components/ScenicLogin";
import { applyBrandTheme } from "../lib/brandTheme";
import { homePath } from "../modules/roles";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const { orgCode } = useParams();
  const [email, setEmail] = useState(() => localStorage.getItem("servex_email") || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [org, setOrg] = useState(null);

  useEffect(() => {
    const code = (orgCode || "").toLowerCase();
    if (!code || code === "servex") return;
    api
      .get(`/auth/branding/${code}`)
      .then((res) => {
        setOrg(res.data.organization);
        applyBrandTheme(res.data.organization);
      })
      .catch(() => setOrg(null));
  }, [orgCode]);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const signedIn = await login(email, password, org?.code || orgCode, "org");
      navigate(homePath(signedIn));
    } catch (err) {
      setError(
        err.response?.data?.message ||
          (err.request && !err.response
            ? "Cannot reach the API. Start the server with npm run dev from the project root."
            : "Unable to sign in")
      );
    } finally {
      setBusy(false);
    }
  }

  if (user) return <Navigate to={homePath(user)} replace />;
  if (String(orgCode || "").toLowerCase() === "servex") return <Navigate to="/login/servex" replace />;

  const name = org?.app_name || org?.name || "your restaurant";

  return (
    <ScenicLogin
      title="Welcome Back"
      subtitle={`Sign in to ${name}`}
      brandHeading={name}
      brandLine={org?.name || "Restaurant login"}
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
