import { createContext, useContext, useLayoutEffect, useMemo, useState } from "react";
import { applyBrandTheme } from "../lib/brandTheme";
import { SERVEX } from "../lib/platform";

const ThemeContext = createContext(null);

function storedBrand() {
  try {
    const user = JSON.parse(localStorage.getItem("tdcp_user") || "null");
    if (user?.role === "super_admin" || user?.role === "admin") return SERVEX;
    const raw = localStorage.getItem("rms_organization");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("tdcp_theme") || "light");

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("tdcp_theme", theme);
    applyBrandTheme(storedBrand());
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "dark",
      setTheme: (next) => setTheme(next === "dark" ? "dark" : "light"),
      toggleTheme: () => setTheme((t) => (t === "light" ? "dark" : "light")),
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
