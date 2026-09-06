// flat=true opts a Card out of the blurred glass treatment - for rows in
// a scrolling list that could genuinely grow long (backdrop-filter per
// row is a real GPU cost; see DECISIONS.md "performance" section). It
// keeps the same translucent tint/border/radius language via the plain
// --card/--card-soft tokens, just without the blur.
export function Card({ children, style = {}, onClick, soft = false, flat = false }) {
  const className = flat ? undefined : (soft ? "glass-soft" : "glass");
  const flatStyle = flat ? { background: soft ? "var(--card-soft)" : "var(--card)", border: "var(--hairline) solid var(--line)", borderRadius: "var(--radius-card)" } : {};
  return <div onClick={onClick} className={className} style={{ width: "100%", minWidth: 0, boxSizing: "border-box", padding: 18, ...flatStyle, ...style }}>{children}</div>;
}
