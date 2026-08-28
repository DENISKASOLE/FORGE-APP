import { BRAND } from "../../theme/tokens.js";

export function Card({ children, style = {}, onClick }) {
  return <div onClick={onClick} style={{ width: "100%", minWidth: 0, boxSizing: "border-box", background: BRAND.card, border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: 18, ...style }}>{children}</div>;
}
