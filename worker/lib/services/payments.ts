// Server-side payment recording (sow.md Phase 2, step 6). The `payments`
// table (migrations/0005_payments.sql) is the source of truth for whether a
// client paid: a row is created with the order, and only a verified PayPal
// capture (status COMPLETED, amount + currency equal to the recorded ones)
// moves it to COMPLETED. Capturing twice returns the stored result.
import type { AuthUser } from "../env";
import { HttpError, newId } from "../http";
import {
  captureOrder, createOrder, getOrder, isAlreadyCaptured, summariseCapture, type PayPalConfig,
} from "./paypal";

export const MAX_PAYMENT_AMOUNT = 10000;
const ORDER_ID_RE = /^[A-Za-z0-9-]{1,64}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const MAX_RAW_CHARS = 8000;

export interface PaymentRow {
  id: string;
  order_id: string;
  client_id: string;
  payer_user_id: string;
  amount: string;
  currency: string;
  status: string;
  description: string | null;
  payer_email: string | null;
  created_at: string;
  raw: string | null;
}

// ---------- access ----------

// The caller may act for a client when they ARE that client
// (clients.client_user_id) or are its coach (clients.trainer_id).
export async function assertClientAccess(db: D1Database, user: AuthUser, clientId: unknown): Promise<string> {
  if (typeof clientId !== "string" || !clientId || clientId.length > 128) {
    throw new HttpError(400, "missing clientId", "bad_request");
  }
  const row = await db
    .prepare("SELECT id, trainer_id, client_user_id FROM clients WHERE id = ?")
    .bind(clientId)
    .first<{ id: string; trainer_id: string | null; client_user_id: string | null }>();
  if (!row) throw new HttpError(404, "Client not found", "not_found");
  if (row.client_user_id !== user.id && row.trainer_id !== user.id) {
    throw new HttpError(403, "You can't make payments for this client", "forbidden");
  }
  return row.id;
}

// ---------- validation ----------

export function normaliseAmount(raw: unknown): string {
  const text = String(raw ?? "").trim();
  const value = Number(text);
  if (!text || !Number.isFinite(value) || value <= 0) throw new HttpError(400, "invalid amount", "bad_request");
  if (value > MAX_PAYMENT_AMOUNT) throw new HttpError(400, "amount too large", "bad_request");
  return value.toFixed(2);
}

function normaliseCurrency(raw: unknown): string {
  const currency = String(raw || "USD").toUpperCase();
  if (!CURRENCY_RE.test(currency)) throw new HttpError(400, "invalid currency", "bad_request");
  return currency;
}

const sameAmount = (a: string, b: string) => Number.isFinite(Number(a)) && Number(a).toFixed(2) === Number(b).toFixed(2);

// ---------- create ----------

export async function createPayment(db: D1Database, cfg: PayPalConfig, user: AuthUser, body: Record<string, any>) {
  const clientId = await assertClientAccess(db, user, body.clientId);
  const amount = normaliseAmount(body.amount);
  const currency = normaliseCurrency(body.currency);
  const description = String(body.description || "Coaching payment").slice(0, 120);

  const { data } = await createOrder(cfg, amount, currency, description);
  if (!data?.id || typeof data.id !== "string") {
    console.error("PayPal create failed", data?.name, data?.message);
    throw new HttpError(400, "create failed", "paypal_create_failed");
  }
  await db
    .prepare(
      "INSERT INTO payments (id, order_id, client_id, payer_user_id, amount, currency, status, description, raw) VALUES (?, ?, ?, ?, ?, ?, 'CREATED', ?, ?)"
    )
    .bind(newId(), data.id, clientId, user.id, amount, currency, description, JSON.stringify({ status: data.status || "CREATED" }))
    .run();
  return { id: data.id };
}

// ---------- capture ----------

function captureResult(row: Pick<PaymentRow, "order_id" | "amount" | "currency" | "payer_email">) {
  // Same shape v1 returned; `raw` was the PayPal status string there too.
  return { status: "COMPLETED", id: row.order_id, amount: row.amount, currency: row.currency, payerEmail: row.payer_email || "", raw: "COMPLETED" };
}

async function findPayment(db: D1Database, orderId: string) {
  return db.prepare("SELECT * FROM payments WHERE order_id = ?").bind(orderId).first<PaymentRow>();
}

export async function capturePayment(db: D1Database, cfg: PayPalConfig, user: AuthUser, body: Record<string, any>) {
  const orderId = body.orderId;
  if (typeof orderId !== "string" || !ORDER_ID_RE.test(orderId)) throw new HttpError(400, "missing orderId", "bad_request");
  const row = await findPayment(db, orderId);
  if (!row) throw new HttpError(404, "Unknown order", "not_found");
  await assertClientAccess(db, user, row.client_id);
  if (body.clientId !== undefined && body.clientId !== row.client_id) {
    throw new HttpError(400, "This order belongs to a different client", "client_mismatch");
  }
  if (row.status === "COMPLETED") return captureResult(row);

  let { data } = await captureOrder(cfg, orderId);
  // Already captured at PayPal (a retry after a lost response, or two tabs
  // racing): the stored row may have been completed meanwhile; otherwise
  // read the order back and verify it the same way.
  if (isAlreadyCaptured(data)) {
    const fresh = await findPayment(db, orderId);
    if (fresh?.status === "COMPLETED") return captureResult(fresh);
    ({ data } = await getOrder(cfg, orderId));
  }

  const cap = summariseCapture(data);
  if (cap.status !== "COMPLETED") {
    // Not paid (e.g. PAYER_ACTION_REQUIRED, declined). Same response shape
    // as v1 so the UI's `status !== "COMPLETED"` check still applies; the
    // row stays CREATED so the payer can retry.
    return { status: cap.status, id: cap.id, amount: cap.amount, currency: cap.currency, payerEmail: cap.payerEmail, raw: cap.status };
  }
  const raw = JSON.stringify(data).slice(0, MAX_RAW_CHARS);
  const matches = cap.id === orderId && cap.currency === row.currency && sameAmount(cap.amount, row.amount)
    && (!cap.captureStatus || cap.captureStatus === "COMPLETED");
  if (!matches) {
    await db.prepare("UPDATE payments SET status = 'MISMATCH', raw = ? WHERE order_id = ? AND status != 'COMPLETED'").bind(raw, orderId).run();
    console.error("PayPal capture mismatch", orderId, cap.amount, cap.currency, row.amount, row.currency);
    throw new HttpError(409, "The captured payment doesn't match this order. Please contact your coach.", "amount_mismatch");
  }
  await db
    .prepare("UPDATE payments SET status = 'COMPLETED', payer_email = ?, raw = ? WHERE order_id = ? AND status != 'COMPLETED'")
    .bind(cap.payerEmail, raw, orderId)
    .run();
  return captureResult({ order_id: orderId, amount: row.amount, currency: row.currency, payer_email: cap.payerEmail });
}

// ---------- history ----------

export async function paymentHistory(db: D1Database, user: AuthUser, clientId: unknown) {
  const id = await assertClientAccess(db, user, clientId);
  const { results } = await db
    .prepare(
      "SELECT id, order_id, client_id, amount, currency, status, description, payer_email, created_at FROM payments WHERE client_id = ? ORDER BY created_at DESC LIMIT 100"
    )
    .bind(id)
    .all();
  return results;
}
