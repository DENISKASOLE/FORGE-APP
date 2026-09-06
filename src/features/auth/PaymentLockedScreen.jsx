import { useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Card } from "../../components/ui/Card.jsx";
import { PayPalCheckout, markClientPaidAfterCheckout } from "../payments/PaymentsTab.jsx";

export function PaymentLockedScreen({ client, updateClient, overdueDays }) {
  const [paid, setPaid] = useState(false);
  async function onPaid() {
    await markClientPaidAfterCheckout(client, updateClient);
    setPaid(true);
    // The app opens automatically: updateClient() above flips clientPortal's
    // paymentPaid/paymentDueDate, so App.jsx's lockout check re-evaluates to
    // false on its next render - no reload or extra navigation needed.
  }
  return (
    <div className="cinematic-bg" style={{ minHeight: "100vh", color: BRAND.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
        <div style={{ fontFamily: BRAND.display, color: BRAND.text, fontSize: 30, fontWeight: 500, letterSpacing: "0.06em" }}>FORGE</div>
        <Card style={{ marginTop: 26, padding: 26 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: BRAND.card2, display: "grid", placeItems: "center", margin: "0 auto 18px" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" stroke={BRAND.dim} strokeWidth="2" /><path d="M8 11V7a4 4 0 018 0v4" stroke={BRAND.dim} strokeWidth="2" strokeLinecap="round" /></svg>
          </div>
          <div style={{ fontFamily: BRAND.display, fontSize: 20, fontWeight: 500, letterSpacing: "-0.01em", color: BRAND.text, marginBottom: 10 }}>Access paused</div>
          <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 14, fontWeight: 400, lineHeight: 1.6, marginBottom: 22 }}>
            Your payment is {overdueDays} days overdue, so your account has been paused. Pay now to get back in right away, or reach out to your coach.
          </div>

          {paid ? (
            <div style={{ background: BRAND.greenBg, border: `1px solid ${BRAND.green}`, borderRadius: BRAND.radiusControl, padding: 14, textAlign: "center" }}>
              <div style={{ fontFamily: BRAND.sans, color: BRAND.green, fontWeight: 500, fontSize: 15 }}>Payment received</div>
              <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 12, marginTop: 4 }}>Opening your account...</div>
            </div>
          ) : client.price ? (
            <div style={{ textAlign: "left", marginBottom: 22 }}>
              <div style={{ fontFamily: BRAND.sans, color: BRAND.dim, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10, textAlign: "center" }}>Pay ${client.price} to unlock</div>
              <PayPalCheckout client={client} amount={client.price} onPaid={onPaid} />
            </div>
          ) : (
            <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 13, marginBottom: 22 }}>Your coach hasn't set a price yet - contact them below to pay.</div>
          )}

          <div className="glass-soft" style={{ padding: 12 }}>
            <div style={{ fontFamily: BRAND.sans, color: BRAND.dim, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em" }}>Contact</div>
            <div style={{ fontFamily: BRAND.sans, color: BRAND.text, fontSize: 14, fontWeight: 500, marginTop: 4 }}>Denis &middot; +971 567 088 638</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
