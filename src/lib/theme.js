import { useEffect, useState } from "react";

const THEME_KEY = "forge_theme";

export function getStoredTheme() {
  if (typeof localStorage === "undefined") return "dark";
  const saved = localStorage.getItem(THEME_KEY);
  return saved === "light" || saved === "dark" ? saved : "dark";
}

export function applyTheme(theme) {
  if (typeof document !== "undefined") document.documentElement.setAttribute("data-theme", theme);
  if (typeof localStorage !== "undefined") localStorage.setItem(THEME_KEY, theme);
}

// The <head> inline script in index.html already sets data-theme before
// first paint (avoiding a flash); this hook just lets components read and
// toggle it afterward, staying in sync with what's on <html>.
export function useTheme() {
  const [theme, setThemeState] = useState(getStoredTheme);
  useEffect(() => { applyTheme(theme); }, [theme]);
  function toggleTheme() { setThemeState((t) => (t === "dark" ? "light" : "dark")); }
  return { theme, setTheme: setThemeState, toggleTheme };
}
