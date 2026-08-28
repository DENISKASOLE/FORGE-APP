import { useTheme } from "../../lib/theme.js";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div style={{ display: "flex", gap: 4, background: "var(--chip)", border: "var(--hairline) solid var(--line)", borderRadius: 999, padding: 3 }}>
      {["dark", "light"].map((t) => (
        <button
          key={t}
          onClick={() => setTheme(t)}
          style={{
            flex: 1,
            padding: "8px 14px",
            borderRadius: 999,
            border: "none",
            background: theme === t ? "var(--btn-bg)" : "transparent",
            color: theme === t ? "var(--btn-ink)" : "var(--ink-2)",
            fontFamily: "var(--sans)",
            fontWeight: 500,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {t === "dark" ? "Dark" : "Light"}
        </button>
      ))}
    </div>
  );
}
