import { BRAND } from "../../theme/tokens.js";

export function InjuryBanner({ client }) {
  const text = (client.profile?.injuries || "").trim();
  if (!text || /^none\b/i.test(text) || /^no\b/i.test(text) || /^n\/a$/i.test(text)) return null;
  return (
    <div style={{ background: BRAND.yellowBg, borderBottom: `1px solid ${BRAND.yellow}`, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 26, height: 26, borderRadius: "50%", background: BRAND.yellow, color: "#000", fontWeight: 500, fontSize: 14, display: "grid", placeItems: "center", flexShrink: 0 }}>!</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: BRAND.sans, color: BRAND.yellow, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em" }}>Injury / pain on file</div>
        <div style={{ fontFamily: BRAND.sans, color: BRAND.text, fontWeight: 400, fontSize: 13, lineHeight: 1.6 }}>{text}</div>
      </div>
    </div>
  );
}
