import { BRAND } from "../../theme/tokens.js";

export function Card({ children, style = {}, onClick, soft = false }) {
  return <div onClick={onClick} style={{ width: "100%", minWidth: 0, boxSizing: "border-box", background: soft ? BRAND.panel : BRAND.card, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusCard, padding: 18, ...style }}>{children}</div>;
}
