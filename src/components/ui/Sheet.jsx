import { T } from "../../theme/tokens.js";

export function Sheet({ title, onClose, children, maxWidth = 520 }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 1000,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass"
        style={{
          width: "100%", maxWidth, maxHeight: "88vh", overflow: "auto",
          borderBottom: "none",
          borderRadius: "24px 24px 0 0", padding: "10px 18px 24px",
          // Overrides .glass's translucent fill. A sheet is a form, not a
          // floating card - the page showing through it was making every
          // label and placeholder compete with whatever was behind it.
          background: "var(--sheet)",
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 999, background: T.line, margin: "4px auto 14px" }} />
        {title && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontFamily: "var(--display)", fontSize: 18, fontWeight: 700, color: T.accent }}>{title}</div>
            <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: T.muted, fontSize: 15, fontWeight: 500, cursor: "pointer", padding: 4 }}>X</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
