import { BRAND } from "../../theme/tokens.js";

export function Mini({ label, value, color }) {
  return (
    <div style={{ background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusControl, padding: 10, minWidth: 0, overflow: "hidden" }}>
      <div style={{ fontFamily: BRAND.sans, color: BRAND.dim, fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <div style={{ fontFamily: BRAND.display, color: color || BRAND.text, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
    </div>
  );
}
