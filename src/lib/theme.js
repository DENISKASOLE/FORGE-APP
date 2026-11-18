import { useEffect, useState } from "react";

const THEME_KEY = "forge_theme";

const THEME_VERSION_KEY = "forge_theme_v";

// Light is the default for every user (Nov 18 2026). Anyone on an older
// stored value is moved to light once; after that, a dark choice made in
// Settings is kept.
export function getStoredTheme() {
  if (typeof localStorage === "undefined") return "light";
  try {
    if (localStorage.getItem(THEME_VERSION_KEY) !== "2") {
      localStorage.setItem(THEME_KEY, "light");
      localStorage.setItem(THEME_VERSION_KEY, "2");
    }
  } catch { /* private mode: fall through to light */ }
  return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
}

export function applyTheme(theme) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
    // Keep the status bar / browser chrome the same colour as the page.
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", theme === "light" ? "#F5F2EC" : "#0A0A0A");
  }
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
