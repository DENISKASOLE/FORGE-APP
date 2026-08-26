import { BRAND } from "../../theme/tokens.js";

export function InjuryBanner({ client }) {
  const text = (client.profile?.injuries || "").trim();
  if (!text || /^none\b/i.test(text) || /^no\b/i.test(text) || /^n\/a$/i.test(text)) return null;
  return (
    <div style={{ background: `${BRAND.red}18`, borderBottom: `1px solid ${BRAND.red}55`, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 26, height: 26, borderRadius: "50%", background: BRAND.red, color: "#000", fontWeight: 1000, fontSize: 14, display: "grid", placeItems: "center", flexShrink: 0 }}>!</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: BRAND.red, fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5 }}>Injury / Pain on file</div>
        <div style={{ color: BRAND.text, fontWeight: 700, fontSize: 13, lineHeight: 1.35 }}>{text}</div>
      </div>
    </div>
  );
}
