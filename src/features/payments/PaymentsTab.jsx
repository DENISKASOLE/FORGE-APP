import { useEffect, useRef, useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field } from "../../components/ui/Field.jsx";
import { useIsMobile } from "../../lib/browser.js";
import { isoDate } from "../../lib/dateUtils.js";
import { paymentStatus, upsertSection } from "../../lib/clientData.js";
import { markBuddyPairPaid } from "../coach/BuddyPairs.jsx";

const PAYPAL_CLIENT_ID = "BAAZplCHKuyy27Zt231EShn67OIL9PM4OxNA_3m53HMV06ZrFkwT0YJFYOMA2XcMaqAIAH3_beCDJporPI"; // live

async function createPayPalOrder(amount, description) {
  const { data, error } = await supabase.functions.invoke("forge-paypal", { body: { action: "create", amount: String(amount), currency: "USD", description } });
  if (error || !data || !data.id) throw new Error("create failed");
  return data.id;
}
async function capturePayPalOrder(orderId) {
  const { data, error } = await supabase.functions.invoke("forge-paypal", { body: { action: "capture", orderId } });
  if (error || !data || data.status !== "COMPLETED") throw new Error("capture failed");
  return data;
}

// Apple Pay only ever renders when PayPal's own eligibility check passes -
// which requires Safari/an Apple device with a card in Wallet AND the
// site's domain registered + verified for Apple Pay in the PayPal
// business account (Account Settings > Website payments > Apple Pay). Not
// visible on Android/Chrome or an unverified domain by design, not a bug.
function ApplePayButton({ client, amount, onPaid, onError }) {
  const [eligible, setEligible] = useState(false);
  const [paying, setPaying] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!window.paypal?.Applepay || !window.ApplePaySession?.canMakePayments?.()) return;
        const applepay = window.paypal.Applepay();
        const cfg = await applepay.config();
        if (!cancelled && cfg?.isEligible) setEligible(cfg);
      } catch { /* Apple Pay just stays hidden if the eligibility check itself fails */ }
    })();
    return () => { cancelled = true; };
  }, []);
  async function pay() {
    const applepay = window.paypal.Applepay();
    const session = new window.ApplePaySession(4, {
      countryCode: eligible.countryCode,
      currencyCode: eligible.currencyCode || "USD",
      merchantCapabilities: eligible.merchantCapabilities,
      supportedNetworks: eligible.supportedNetworks,
      requiredBillingContactFields: ["postalAddress", "name"],
      total: { label: "Forge Performance coaching", amount: String(amount), type: "final" },
    });
    session.onvalidatemerchant = async (event) => {
      try {
        const { merchantSession } = await applepay.validateMerchant({ validationUrl: event.validationURL });
        session.completeMerchantValidation(merchantSession);
      } catch {
        session.abort();
        onError?.();
      }
    };
    session.onpaymentauthorized = async (event) => {
      setPaying(true);
      try {
        const orderId = await createPayPalOrder(amount, `Coaching - ${client.name}`);
        const confirmed = await applepay.confirmOrder({ orderId, token: event.payment.token, billingContact: event.payment.billingContact });
        if (!confirmed?.approveApplePayPayment) throw new Error("not approved");
        const captured = await capturePayPalOrder(orderId);
        session.completePayment(window.ApplePaySession.STATUS_SUCCESS);
        onPaid(captured);
      } catch {
        session.completePayment(window.ApplePaySession.STATUS_FAILURE);
        onError?.();
      } finally {
        setPaying(false);
      }
    };
    session.begin();
  }
  if (!eligible) return null;
  return (
    <button
      onClick={pay}
      disabled={paying}
      aria-label="Pay with Apple Pay"
      className="forge-apple-pay-button"
      style={{ marginTop: 8, cursor: paying ? "not-allowed" : "pointer", opacity: paying ? 0.6 : 1 }}
    />
  );
}

export function PayPalCheckout({ client, amount, onPaid }) {
  const ref = useRef(null);
  const [status, setStatus] = useState("loading");
  const [err, setErr] = useState("");
  useEffect(() => {
    let cancelled = false;
    function render() {
      if (cancelled || !ref.current || !window.paypal) return;
      ref.current.innerHTML = "";
      try {
        window.paypal.Buttons({
          style: { layout: "vertical", color: "black", shape: "pill", label: "pay" },
          createOrder: () => createPayPalOrder(amount, `Coaching - ${client.name}`),
          onApprove: async (d) => {
            setStatus("paying");
            try {
              const data = await capturePayPalOrder(d.orderID);
              setStatus("done");
              onPaid?.(data);
            } catch {
              setErr("Payment did not complete. Try again.");
              setStatus("ready");
            }
          },
          onError: () => { setErr("Payment error. Please try again."); setStatus("ready"); },
        }).render(ref.current);
        setStatus("ready");
      } catch (e) { setErr("Could not load checkout."); setStatus("error"); }
    }
    if (window.paypal) { render(); return () => { cancelled = true; }; }
    const id = "paypal-sdk";
    let script = document.getElementById(id);
    if (!script) {
      script = document.createElement("script");
      script.id = id;
      script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD&components=buttons,applepay&enable-funding=card`;
      script.onload = render;
      script.onerror = () => { if (!cancelled) { setErr("Could not load PayPal."); setStatus("error"); } };
      document.body.appendChild(script);
    } else { script.addEventListener("load", render); render(); }
    return () => { cancelled = true; };
  }, [amount]);
  if (status === "done") {
    return (
      <div style={{ background: BRAND.greenBg, border: `1px solid ${BRAND.green}`, borderRadius: BRAND.radiusControl, padding: 14, textAlign: "center" }}>
        <div style={{ fontFamily: BRAND.sans, color: BRAND.green, fontWeight: 500, fontSize: 16 }}>Payment received</div>
        <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 12, marginTop: 4 }}>Thanks, you are all set.</div>
      </div>
    );
  }
  return (
    <div>
      {status === "loading" && <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 13, marginBottom: 8 }}>Loading secure checkout...</div>}
      {status === "paying" && <div style={{ fontFamily: BRAND.sans, color: BRAND.text, fontWeight: 500, fontSize: 13, marginBottom: 8 }}>Confirming payment...</div>}
      <div ref={ref} />
      {status === "ready" && <ApplePayButton client={client} amount={amount} onPaid={(data) => { setStatus("done"); onPaid?.(data); }} onError={() => setErr("Apple Pay payment did not complete. Try again.")} />}
      {err && <div style={{ fontFamily: BRAND.sans, color: BRAND.yellow, fontSize: 12, marginTop: 8 }}>{err}</div>}
    </div>
  );
}

// Shared by PaymentsTab's own checkout and PaymentLockedScreen's - same
// "just paid" outcome (mark paid, push the due date forward a month, fan
// out to a buddy partner if any) regardless of which screen the payment
// happened on.
export async function markClientPaidAfterCheckout(client, updateClient) {
  const next = new Date(); next.setDate(next.getDate() + 30);
  const patch = { paymentPaid: true, paymentDueDate: isoDate(next), lastPaidAt: new Date().toISOString() };
  await upsertSection(client.id, "profile", { ...client.profile, ...patch });
  updateClient({ ...client, ...patch, profile: { ...client.profile, ...patch } });
  await markBuddyPairPaid(client.id);
}

export function PaymentsTab({ client, updateClient, isCoach }) {
  const isMobile = useIsMobile(520);
  const [dueDate, setDueDate] = useState(client.paymentDueDate || "");
  const [price, setPrice] = useState(client.price || "");
  const [saving, setSaving] = useState(false);
  const status = paymentStatus(client);
  async function persist(next) {
    await upsertSection(client.id, "profile", { ...client.profile, ...next });
    updateClient({ ...client, ...next, profile: { ...client.profile, ...next } });
  }
  async function saveDueDate() { setSaving(true); await persist({ paymentDueDate: dueDate, paymentPaid: false }); setSaving(false); }
  async function markPaid() { await persist({ paymentPaid: true }); await markBuddyPairPaid(client.id); }
  async function renew30() { const next = new Date(); next.setDate(next.getDate() + 30); const nextDate = isoDate(next); setDueDate(nextDate); await persist({ paymentDueDate: nextDate, paymentPaid: false }); }
  async function savePrice() { setSaving(true); await persist({ price }); setSaving(false); }
  async function onPaid() { await markClientPaidAfterCheckout(client, updateClient); }
  return (
    <Card style={{ padding: isMobile ? 12 : 16 }}>
      <div style={{ fontFamily: BRAND.display, fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em", color: BRAND.text, marginBottom: 12 }}>Payments</div>
      <div style={{ background: BRAND.card2, border: `1px solid ${status.color}`, borderRadius: BRAND.radiusCard, padding: 14, marginBottom: 16 }}>
        <div style={{ fontFamily: BRAND.sans, color: status.color, fontWeight: 500, fontSize: 16 }}>{status.label}</div>
        {client.price && <div style={{ fontFamily: BRAND.sans, color: BRAND.text, fontSize: 15, fontWeight: 500, marginTop: 4 }}>${client.price} / month</div>}
        {client.paymentDueDate && <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 13, marginTop: 4 }}>Due date: {client.paymentDueDate}</div>}
      </div>
      {!isCoach && client.price && !client.paymentPaid && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontFamily: BRAND.sans, fontSize: 13, fontWeight: 500, marginBottom: 8, color: BRAND.muted }}>Pay ${client.price} — PayPal, card, Apple Pay or Google Pay</div>
          <PayPalCheckout client={client} amount={client.price} onPaid={onPaid} />
        </div>
      )}
      {!isCoach && !client.price && <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 13 }}>Your coach has not set a price yet.</div>}
      {!isCoach && client.paymentPaid && <div style={{ fontFamily: BRAND.sans, color: BRAND.green, fontWeight: 500, fontSize: 14 }}>You are paid up. Thank you.</div>}
      {isCoach && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 8, marginBottom: 12 }}>
            <Field label="Monthly price (USD)" value={price} onChange={setPrice} type="number" />
            <Button onClick={savePrice} disabled={saving} style={{ alignSelf: "end" }}>Set Price</Button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 8, marginBottom: 12 }}>
            <Field label="Payment due date" value={dueDate} onChange={setDueDate} type="date" />
            <Button onClick={saveDueDate} disabled={saving} style={{ alignSelf: "end" }}>{saving ? "Saving..." : "Set Due Date"}</Button>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button variant="dark" onClick={markPaid}>Mark as Paid</Button>
            <Button variant="dark" onClick={renew30}>Mark Paid & Renew 30 Days</Button>
          </div>
          <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 12, lineHeight: 1.6, marginTop: 12 }}>Set a monthly price so the client can pay in-app. Reminders go out 5 and 2 days before, and if overdue.</div>
        </>
      )}
    </Card>
  );
}
