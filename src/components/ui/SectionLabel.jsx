import { T } from "../../theme/tokens.js";

export function SectionLabel({ children, color = T.dim, style = {} }) {
  return (
    <div style={{ fontFamily: "var(--sans)", color, fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", ...style }}>
      {children}
    </div>
  );
}
