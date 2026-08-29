import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";

export function AccountNotActiveScreen({ onBackToLogin }) {
  return (
    <div style={{ minHeight: "100vh", background: BRAND.bg, color: BRAND.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
        <div style={{ fontFamily: BRAND.display, color: BRAND.text, fontSize: 30, fontWeight: 500, letterSpacing: "0.06em" }}>FORGE</div>
        <Card style={{ marginTop: 26, padding: 26 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: BRAND.card2, display: "grid", placeItems: "center", margin: "0 auto 18px" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={BRAND.dim} strokeWidth="2" /><path d="M4 21C4 16.5 7.5 14 12 14C16.5 14 20 16.5 20 21" stroke={BRAND.dim} strokeWidth="2" strokeLinecap="round" /><line x1="4" y1="4" x2="20" y2="20" stroke={BRAND.dim} strokeWidth="2" /></svg>
          </div>
          <div style={{ fontFamily: BRAND.display, fontSize: 20, fontWeight: 500, letterSpacing: "-0.01em", color: BRAND.text, marginBottom: 10 }}>This account is no longer active</div>
          <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 14, fontWeight: 400, lineHeight: 1.6, marginBottom: 20 }}>We couldn't find an active client profile for this login. If you think this is a mistake, reach out to your coach directly.</div>
          <div style={{ background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusControl, padding: 12, marginBottom: 22 }}>
            <div style={{ fontFamily: BRAND.sans, color: BRAND.dim, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em" }}>Contact</div>
            <div style={{ fontFamily: BRAND.sans, color: BRAND.text, fontSize: 14, fontWeight: 500, marginTop: 4 }}>Denis &middot; +971 567 088 638</div>
          </div>
          <Button onClick={onBackToLogin} style={{ width: "100%" }}>Back to login</Button>
        </Card>
      </div>
    </div>
  );
}
