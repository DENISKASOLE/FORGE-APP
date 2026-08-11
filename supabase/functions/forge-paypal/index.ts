// Supabase Edge Function: forge-paypal
// Server-side proxy for PayPal Orders API. Holds the PayPal secret so it never
// touches the browser. The app calls this to create and capture payments.
//
// Required secrets (supabase secrets set ...):
//   PAYPAL_CLIENT_ID     (from developer.paypal.com REST app)
//   PAYPAL_SECRET        (the secret for that app)
//   PAYPAL_ENV           "sandbox" (test) or "live" (real money). Defaults to sandbox.
//
// Actions (POST JSON body):
//   { action: "create",  amount: "120.00", currency: "USD", description: "Coaching - March" }
//        -> { id }                (PayPal order id; hand this to the PayPal buttons)
//   { action: "capture", orderId: "..." }
//        -> { status, id, amount, currency, payerEmail }   (status "COMPLETED" == paid)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function base() {
  return (Deno.env.get("PAYPAL_ENV") || "sandbox") === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

let cachedToken: { token: string; exp: number } | null = null;
async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 30000) return cachedToken.token;
  const id = Deno.env.get("PAYPAL_CLIENT_ID");
  const secret = Deno.env.get("PAYPAL_SECRET");
  if (!id || !secret) throw new Error("Missing PAYPAL_CLIENT_ID / PAYPAL_SECRET");
  const res = await fetch(`${base()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(`${id}:${secret}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("PayPal token error: " + JSON.stringify(data));
  cachedToken = { token: data.access_token, exp: Date.now() + (data.expires_in || 3000) * 1000 };
  return cachedToken.token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (obj: any, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "create";
    const token = await getToken();

    if (action === "create") {
      const amount = String(body.amount || "").trim();
      const currency = (body.currency || "USD").toUpperCase();
      if (!amount || Number(amount) <= 0) return json({ error: "invalid amount" }, 400);
      const res = await fetch(`${base()}/v2/checkout/orders`, {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            amount: { currency_code: currency, value: Number(amount).toFixed(2) },
            description: (body.description || "Coaching payment").slice(0, 120),
          }],
        }),
      });
      const data = await res.json();
      if (!data.id) return json({ error: "create failed", detail: data }, 400);
      return json({ id: data.id });
    }

    if (action === "capture") {
      const orderId = body.orderId;
      if (!orderId) return json({ error: "missing orderId" }, 400);
      const res = await fetch(`${base()}/v2/checkout/orders/${orderId}/capture`, {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
      });
      const data = await res.json();
      const cap = data?.purchase_units?.[0]?.payments?.captures?.[0];
      return json({
        status: data.status || "UNKNOWN",
        id: data.id,
        amount: cap?.amount?.value || "",
        currency: cap?.amount?.currency_code || "",
        payerEmail: data?.payer?.email_address || "",
        raw: data.status,
      });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
