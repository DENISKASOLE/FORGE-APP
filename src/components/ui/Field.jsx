import { BRAND } from "../../theme/tokens.js";

export function inputStyle(extra = {}) {
  return { width: "100%", minWidth: 0, boxSizing: "border-box", background: BRAND.card2, border: `1px solid ${BRAND.line}`, color: BRAND.text, borderRadius: 12, padding: "11px 12px", outline: "none", fontSize: 16, ...extra };
}

export const textareaStyle = (extra = {}) => ({
  width: "100%",
  minHeight: 90,
  background: BRAND.card2,
  border: `1px solid ${BRAND.line}`,
  borderRadius: 12,
  color: BRAND.text,
  padding: "12px",
  resize: "vertical",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  fontSize: 16,
  ...extra,
});

export function Field({ label, value, onChange, type = "text", placeholder = "", textarea = false }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 11, color: BRAND.muted, fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 }}>{label}</div>
      {textarea ? (
        <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle({ minHeight: 85, resize: "vertical" })} />
      ) : (
        <input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle()} />
      )}
    </label>
  );
}
