import { T } from "../../theme/tokens.js";

function clampPct(value, target) {
  const v = Number(value) || 0;
  const t = Number(target) || 0;
  if (!t) return 0;
  return Math.max(0, Math.min(100, Math.round((v / t) * 100)));
}

export function MacroBar({ label, value, target, unit = "g", color = T.good }) {
  const pct = clampPct(value, target);
  return (
    <div>
      <div style={{ fontFamily: "var(--sans)", display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 500, marginBottom: 5 }}>
        <span style={{ color: T.dim, textTransform: "uppercase", letterSpacing: "0.14em" }}>{label}</span>
        <span style={{ color: T.muted }}>{Math.round(value) || 0}/{target || "-"}{unit}</span>
      </div>
      <div style={{ height: 4, borderRadius: 999, background: T.lineSoft, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}
