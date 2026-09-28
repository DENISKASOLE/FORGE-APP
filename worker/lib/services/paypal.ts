// PayPal Orders API client for /api/pay. Ported from the v1 `forge-paypal`
// Edge Function (token cache, create, capture). PAYPAL_ENV "live" uses the
// live API; anything else is sandbox.
export interface PayPalConfig {
  env?: string;
  clientId?: string;
  secret?: string;
}

export function paypalBase(cfg: PayPalConfig) {
  return (cfg.env || "sandbox") === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

// Module scope, as in v1, keyed by API base so sandbox/live never mix.
let cachedToken: { base: string; token: string; exp: number } | null = null;

export function resetPayPalTokenCache() {
  cachedToken = null;
}

async function getToken(cfg: PayPalConfig): Promise<string> {
  const base = paypalBase(cfg);
  if (cachedToken && cachedToken.base === base && cachedToken.exp > Date.now() + 30000) return cachedToken.token;
  if (!cfg.clientId || !cfg.secret) throw new Error("Missing PAYPAL_CLIENT_ID / PAYPAL_SECRET");
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(`${cfg.clientId}:${cfg.secret}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data: any = await res.json().catch(() => ({}));
  if (!data.access_token) {
    console.error("PayPal token error", res.status, data?.error);
    throw new Error("PayPal token error");
  }
  cachedToken = { base, token: data.access_token, exp: Date.now() + (data.expires_in || 3000) * 1000 };
  return cachedToken.token;
}

async function paypalFetch(cfg: PayPalConfig, path: string, init: RequestInit = {}): Promise<{ status: number; data: any }> {
  const token = await getToken(cfg);
  const res = await fetch(`${paypalBase(cfg)}${path}`, {
    ...init,
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

export async function createOrder(cfg: PayPalConfig, amount: string, currency: string, description: string) {
  return paypalFetch(cfg, "/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{ amount: { currency_code: currency, value: amount }, description }],
    }),
  });
}

export async function captureOrder(cfg: PayPalConfig, orderId: string) {
  return paypalFetch(cfg, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST" });
}

export async function getOrder(cfg: PayPalConfig, orderId: string) {
  return paypalFetch(cfg, `/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
}

export function isAlreadyCaptured(data: any): boolean {
  return Array.isArray(data?.details) && data.details.some((d: any) => d?.issue === "ORDER_ALREADY_CAPTURED");
}

// The fields v1's capture response exposed, read from a capture (or order) body.
export function summariseCapture(data: any) {
  const cap = data?.purchase_units?.[0]?.payments?.captures?.[0];
  return {
    status: String(data?.status || "UNKNOWN"),
    id: data?.id as string | undefined,
    amount: String(cap?.amount?.value || ""),
    currency: String(cap?.amount?.currency_code || ""),
    captureStatus: String(cap?.status || ""),
    payerEmail: String(data?.payer?.email_address || ""),
  };
}
