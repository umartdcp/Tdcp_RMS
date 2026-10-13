import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import ScenicLogin from "../components/ScenicLogin";
import { applyBrandTheme } from "../lib/brandTheme";
import { canAccessPath, homePath } from "../modules/roles";
import { consumeReturnPath } from "../lib/platform";

export default function Login({ code }) {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const { orgCode: paramCode } = useParams();
  const orgCode = code || paramCode;
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
      const back = consumeReturnPath("");
      navigate(back && canAccessPath(signedIn, back) ? back : homePath(signedIn));
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

  if (user) {
    const back = consumeReturnPath("");
    return <Navigate to={back && canAccessPath(user, back) ? back : homePath(user)} replace />;
  }
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
