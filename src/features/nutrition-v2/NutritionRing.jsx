import { NT } from "./nutritionV2Theme.js";

// A big single progress ring (kcal, or an adherence %) - replaces the old
// row of 4 equal-sized rings, which gave calories and fat the same visual
// weight even though calories is what a client actually scans for first.
export function Ring({ value, max = 1, size = 96, stroke = 10, color, trackColor, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor || NT.card2} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color || NT.accent} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${pct * c} ${c}`} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>{children}</div>
    </div>
  );
}
// label + dot + slim bar + value, used for both macro-attainment rows and
// the hero card's protein/carbs/fat summary underneath the kcal ring.
export function MacroBarRow({ label, color, pct, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 3, background: color, flexShrink: 0 }} />
      <span style={{ width: 56, flexShrink: 0, fontSize: 12.5, color: NT.text, fontFamily: NT.sans }}>{label}</span>
      <div style={{ flex: 1, height: 7, borderRadius: 999, background: NT.card2, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 999, background: color, width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
      <span style={{ width: 72, flexShrink: 0, textAlign: "right", fontSize: 12, color: NT.dim, fontFamily: NT.sans }}>{value}</span>
    </div>
  );
}
