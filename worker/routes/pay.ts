// Route group /api/pay - see docs/cloudflare/CONTRACTS.md for ownership.
// Port of the v1 `forge-paypal` Edge Function plus server-side payment
// recording (worker/lib/services/payments.ts):
//   POST /api/pay { action: "create", clientId, amount, currency?, description? } -> { data: { id } }
//   POST /api/pay { action: "capture", orderId, clientId? } -> { data: { status, id, amount, currency, payerEmail, raw } }
//   GET  /api/pay/history?clientId=... -> { data: [payment rows] }
import { Hono } from "hono";
import type { AppContext, Env } from "../lib/env";
import { HttpError, fail } from "../lib/http";
import { requireUser } from "../lib/session";
import { capturePayment, createPayment, paymentHistory } from "../lib/services/payments";
import { SMALL_MAX_BODY_BYTES, currentUser, enforceLimit, readJsonBody } from "../lib/services/request";

const RATE_MESSAGE = "Too many payment requests - please wait a minute and try again.";
const payPalConfig = (env: Env) => ({ env: env.PAYPAL_ENV, clientId: env.PAYPAL_CLIENT_ID, secret: env.PAYPAL_SECRET });

const app = new Hono<AppContext>();

app.use("*", requireUser);

app.get("/history", async (c) => {
  const user = currentUser(c);
  const data = await paymentHistory(c.env.DB, user, c.req.query("clientId"));
  return c.json({ data });
});

app.post("/", async (c) => {
  const user = currentUser(c);
  await enforceLimit(c.env.API_LIMITER, user, RATE_MESSAGE);
  const body = await readJsonBody(c, SMALL_MAX_BODY_BYTES);
  const action = body.action || "create";
  try {
    if (action === "create") return c.json({ data: await createPayment(c.env.DB, payPalConfig(c.env), user, body) });
    if (action === "capture") return c.json({ data: await capturePayment(c.env.DB, payPalConfig(c.env), user, body) });
    return fail(c, 400, "unknown action", "unknown_action");
  } catch (e: any) {
    if (e instanceof HttpError) throw e;
    console.error("forge-paypal failed", action, e?.message);
    return fail(c, 500, "Payment service error - please try again.", "paypal_error");
  }
});

export default app;
