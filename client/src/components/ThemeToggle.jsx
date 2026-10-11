import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle({ className = "", tone = "brand" }) {
  const { isDark, toggleTheme } = useTheme();
  const soft = tone === "soft";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition hover:opacity-90 ${className}`}
      style={
        soft
          ? {
              background: "#ffffff",
              boxShadow: "inset 0 0 0 1px rgba(27,42,74,0.12), 0 6px 16px rgba(16,32,48,0.06)",
            }
          : isDark
            ? {
                background: "linear-gradient(145deg, #157854 0%, #0c553c 45%, #0a3929 100%)",
                boxShadow: "inset 0 0 0 1px rgba(110, 199, 166, 0.35)",
              }
            : { background: "#0C855D" }
      }
      title={isDark ? "Switch to light" : "Switch to dark"}
      aria-label="Toggle light and dark theme"
    >
      {isDark ? (
        <Sun size={18} className="text-tdcp-100" stroke={soft ? "#1B2A4A" : "#d5efe3"} strokeWidth={2.2} />
      ) : (
        <Moon size={18} stroke={soft ? "#1B2A4A" : "white"} strokeWidth={2.2} />
      )}
    </button>
  );
}
