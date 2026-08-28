import { BRAND } from "../../theme/tokens.js";

export function Button({ children, onClick, variant = "gold", type = "button", disabled = false, style = {} }) {
  const bg = variant === "ghost" ? "transparent" : variant === "red" ? BRAND.card2 : variant === "dark" ? BRAND.card2 : BRAND.btnBg;
  const color = variant === "ghost" ? BRAND.text : variant === "red" ? BRAND.yellow : variant === "dark" ? BRAND.text : BRAND.btnInk;
  const bordered = variant === "ghost" || variant === "dark" || variant === "red";
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={{ fontFamily: BRAND.sans, background: bg, color, border: bordered ? `${BRAND.hairline} solid ${BRAND.line}` : "none", borderRadius: BRAND.radiusControl, padding: "14px 18px", fontWeight: 500, fontSize: 14, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, minWidth: 0, maxWidth: "100%", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", ...style }}>
      {children}
    </button>
  );
}
