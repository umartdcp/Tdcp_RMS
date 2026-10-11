import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ScenicLogin from "../components/ScenicLogin";
import { applyBrandTheme } from "../lib/brandTheme";
import { SERVEX } from "../lib/platform";
import { homePath } from "../modules/roles";

export default function SuperAdminLogin() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(() => localStorage.getItem("servex_email") || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    applyBrandTheme(SERVEX);
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const signedIn = await login(email, password, undefined, "auto");
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

  return (
    <ScenicLogin
      title="Welcome Back"
      subtitle="Sign in to your KitchenIQ.cloud account"
      email={email}
      password={password}
      onEmail={setEmail}
      onPassword={setPassword}
      onSubmit={onSubmit}
      busy={busy}
      error={error}
    />
  );
}
