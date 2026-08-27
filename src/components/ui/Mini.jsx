import { BRAND } from "../../theme/tokens.js";

export function Mini({ label, value, color }) {
  return <div style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: 10, minWidth: 0, overflow: "hidden" }}><div style={{ color: BRAND.dim, fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div><div style={{ color: color || BRAND.text, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div></div>;
}
