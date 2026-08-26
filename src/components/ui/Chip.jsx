import { T } from "../../theme/tokens.js";

export function Chip({ children, selected = false, onClick, color = T.gold, style = {} }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${selected ? color : T.line}`,
        background: selected ? color : T.card2,
        color: selected ? "#000" : T.muted,
        borderRadius: 999,
        padding: "8px 14px",
        fontSize: 11,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: 0.4,
        whiteSpace: "nowrap",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
