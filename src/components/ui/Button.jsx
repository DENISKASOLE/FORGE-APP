import { BRAND } from "../../theme/tokens.js";

export function Button({ children, onClick, variant = "gold", type = "button", disabled = false, style = {} }) {
  const bg = variant === "ghost" ? "transparent" : variant === "red" ? BRAND.red : variant === "dark" ? BRAND.card2 : "var(--emberGradient)";
  const color = variant === "ghost" ? BRAND.text : "#fff";
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={{ background: bg, color, border: variant === "ghost" || variant === "dark" ? `1px solid ${BRAND.line}` : "none", borderRadius: 14, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, transition: "opacity .15s", minWidth: 0, maxWidth: "100%", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", ...style }}>
      {children}
    </button>
  );
}
