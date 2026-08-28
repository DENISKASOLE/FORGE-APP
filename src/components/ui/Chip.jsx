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
        color: selected ? "var(--btn-ink)" : T.muted,
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
