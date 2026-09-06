import { BRAND } from "../../theme/tokens.js";

export function Mini({ label, value, color }) {
  return (
    <div className="glass-soft" style={{ padding: 10, minWidth: 0, overflow: "hidden" }}>
      <div style={{ fontFamily: BRAND.sans, color: BRAND.dim, fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <div style={{ fontFamily: BRAND.display, color: color || BRAND.text, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
    </div>
  );
}
