import { BRAND } from "../../theme/tokens.js";

export function inputStyle(extra = {}) {
  return { width: "100%", minWidth: 0, boxSizing: "border-box", background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, color: BRAND.text, borderRadius: BRAND.radiusControl, padding: "11px 12px", outline: "none", fontSize: 16, fontFamily: BRAND.sans, ...extra };
}

export const textareaStyle = (extra = {}) => ({
  width: "100%",
  minHeight: 90,
  background: BRAND.card2,
  border: `${BRAND.hairline} solid ${BRAND.line}`,
  borderRadius: BRAND.radiusControl,
  color: BRAND.text,
  padding: "12px",
  resize: "vertical",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: BRAND.sans,
  fontSize: 16,
  ...extra,
});

export function Field({ label, value, onChange, type = "text", placeholder = "", textarea = false }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontFamily: BRAND.sans, fontSize: 11, color: BRAND.muted, fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.14em" }}>{label}</div>
      {textarea ? (
        <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle({ minHeight: 85, resize: "vertical" })} />
      ) : (
        <input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle()} />
      )}
    </label>
  );
}
