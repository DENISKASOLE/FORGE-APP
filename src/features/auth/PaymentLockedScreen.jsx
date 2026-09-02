import { BRAND } from "../../theme/tokens.js";
import { Card } from "../../components/ui/Card.jsx";

export function PaymentLockedScreen({ overdueDays }) {
  return (
    <div style={{ minHeight: "100vh", background: BRAND.bg, color: BRAND.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
        <div style={{ fontFamily: BRAND.display, color: BRAND.text, fontSize: 30, fontWeight: 500, letterSpacing: "0.06em" }}>FORGE</div>
        <Card style={{ marginTop: 26, padding: 26 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: BRAND.card2, display: "grid", placeItems: "center", margin: "0 auto 18px" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" stroke={BRAND.dim} strokeWidth="2" /><path d="M8 11V7a4 4 0 018 0v4" stroke={BRAND.dim} strokeWidth="2" strokeLinecap="round" /></svg>
          </div>
          <div style={{ fontFamily: BRAND.display, fontSize: 20, fontWeight: 500, letterSpacing: "-0.01em", color: BRAND.text, marginBottom: 10 }}>Access paused</div>
          <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 14, fontWeight: 400, lineHeight: 1.6, marginBottom: 20 }}>
            Your payment is {overdueDays} days overdue, so your account has been paused. Reach out to your coach to sort out payment and get back in.
          </div>
          <div style={{ background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusControl, padding: 12 }}>
            <div style={{ fontFamily: BRAND.sans, color: BRAND.dim, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em" }}>Contact</div>
            <div style={{ fontFamily: BRAND.sans, color: BRAND.text, fontSize: 14, fontWeight: 500, marginTop: 4 }}>Denis &middot; +971 567 088 638</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
