export function Card({ children, style = {}, onClick, soft = false }) {
  return <div onClick={onClick} className={soft ? "glass-soft" : "glass"} style={{ width: "100%", minWidth: 0, boxSizing: "border-box", padding: 18, ...style }}>{children}</div>;
}
