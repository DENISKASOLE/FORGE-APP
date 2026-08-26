import { T } from "../../theme/tokens.js";

export function SectionLabel({ children, color = T.gold, style = {} }) {
  return (
    <div style={{ color, fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", ...style }}>
      {children}
    </div>
  );
}
