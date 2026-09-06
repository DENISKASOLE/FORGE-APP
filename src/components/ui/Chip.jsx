import { T } from "../../theme/tokens.js";

export function Chip({ children, selected = false, onClick, style = {} }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: "var(--sans)",
        border: `var(--hairline) solid ${selected ? "transparent" : T.line}`,
        background: selected ? "var(--btn-bg)" : T.card2,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        color: selected ? "var(--btn-ink)" : T.muted,
        boxShadow: selected ? "0 6px 20px rgba(255,255,255,.14)" : "inset 0 1px 0 var(--glass-hi)",
        borderRadius: 999,
        padding: "8px 14px",
        fontSize: 11,
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.14em",
        whiteSpace: "nowrap",
        minWidth: 0,
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
