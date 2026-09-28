import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createD1, fakeEnv, jsonRequest, jsonResponse, mount, sessionStub } from "./helpers";

vi.mock("../../worker/lib/session", () => sessionStub);

const { default: payRoute } = await import("../../worker/routes/pay");
const { resetPayPalTokenCache } = await import("../../worker/lib/services/paypal");

const app = mount("/api/pay", payRoute);
const COACH = "coach-1";
const CLIENT_USER = "client-user-1";
const STRANGER = "stranger-1";

// Fake PayPal: order create returns ORDER-1; capture/get replies are set per test.
function paypal(opts: { capture?: unknown; captureStatus?: number; order?: unknown } = {}) {
  return vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    expect(url.hostname).toBe("api-m.sandbox.paypal.com");
    if (url.pathname === "/v1/oauth2/token") return jsonResponse({ access_token: "pp-token", expires_in: 3000 });
    if (url.pathname === "/v2/checkout/orders" && init?.method === "POST") return jsonResponse({ id: "ORDER-1", status: "CREATED" }, 201);
    if (url.pathname.endsWith("/capture")) return jsonResponse(opts.capture ?? {}, opts.captureStatus ?? 201);
    if (url.pathname.startsWith("/v2/checkout/orders/")) return jsonResponse(opts.order ?? {});
    return jsonResponse({}, 404);
  });
}

const completed = (value = "120.00", currency = "USD", id = "ORDER-1") => ({
  id, status: "COMPLETED", payer: { email_address: "payer@example.com" },
  purchase_units: [{ payments: { captures: [{ status: "COMPLETED", amount: { value, currency_code: currency } }] } }],
});

let db: ReturnType<typeof createD1>;
let env: any;
let fetchMock: ReturnType<typeof paypal>;
const post = (body: unknown, user: string | null) => app.request("/api/pay", jsonRequest(body, user ?? undefined), env);
const usePayPal = (opts: Parameters<typeof paypal>[0] = {}) => {
  fetchMock = paypal(opts);
  vi.stubGlobal("fetch", fetchMock);
};
const createOrder = (user = CLIENT_USER, amount: unknown = "120") =>
  post({ action: "create", clientId: "client-1", amount, currency: "USD", description: "Coaching - Sam" }, user);
const row = () => db.raw.prepare("SELECT * FROM payments WHERE order_id = 'ORDER-1'").get() as any;

beforeEach(() => {
  resetPayPalTokenCache();
  db = createD1(["0001_core.sql", "0005_payments.sql"]);
  db.raw.exec(`
    INSERT INTO trainers (id, email) VALUES ('${COACH}', 'coach@example.com');
    INSERT INTO clients (id, trainer_id, client_user_id, name) VALUES ('client-1', '${COACH}', '${CLIENT_USER}', 'Sam');
    INSERT INTO clients (id, trainer_id, client_user_id, name) VALUES ('client-2', '${COACH}', 'other-client-user', 'Alex');
  `);
  env = fakeEnv({ DB: db.d1 });
  usePayPal();
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/pay create", () => {
  it("requires a session", async () => {
    expect((await createOrder(null as any)).status).toBe(401);
  });

  it("lets the client create an order and records it as CREATED", async () => {
    const res = await createOrder();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: "ORDER-1" } });
    expect(row()).toMatchObject({ client_id: "client-1", payer_user_id: CLIENT_USER, amount: "120.00", currency: "USD", status: "CREATED", description: "Coaching - Sam" });
    const createCall = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith("/v2/checkout/orders") && i?.method === "POST");
    expect(JSON.parse(String(createCall![1]!.body)).purchase_units[0].amount).toEqual({ currency_code: "USD", value: "120.00" });
  });

  it("lets the coach create an order for their client", async () => {
    expect((await createOrder(COACH)).status).toBe(200);
  });

  it("rejects someone who is neither the client nor the coach", async () => {
    const res = await createOrder(STRANGER);
    expect(res.status).toBe(403);
    expect(row()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a client paying for another client", async () => {
    const res = await post({ action: "create", clientId: "client-2", amount: "10" }, CLIENT_USER);
    expect(res.status).toBe(403);
  });

  it("validates clientId and amount", async () => {
    expect((await post({ action: "create", amount: "10" }, CLIENT_USER)).status).toBe(400);
    expect((await post({ action: "create", clientId: "nope", amount: "10" }, CLIENT_USER)).status).toBe(404);
    for (const amount of ["0", "-5", "abc", "", "10001", "Infinity"]) {
      expect((await createOrder(CLIENT_USER, amount)).status, amount).toBe(400);
    }
  });
});

describe("POST /api/pay capture", () => {
  it("captures, verifies and marks the payment COMPLETED", async () => {
    await createOrder();
    usePayPal({ capture: completed() });
    const res = await post({ action: "capture", clientId: "client-1", orderId: "ORDER-1" }, CLIENT_USER);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { status: "COMPLETED", id: "ORDER-1", amount: "120.00", currency: "USD", payerEmail: "payer@example.com", raw: "COMPLETED" } });
    expect(row()).toMatchObject({ status: "COMPLETED", payer_email: "payer@example.com" });
  });

  it("is idempotent: a second capture returns the stored result without calling PayPal", async () => {
    await createOrder();
    usePayPal({ capture: completed() });
    await post({ action: "capture", orderId: "ORDER-1" }, CLIENT_USER);
    usePayPal();
    const res = await post({ action: "capture", orderId: "ORDER-1" }, CLIENT_USER);
    expect((await res.json()).data).toMatchObject({ status: "COMPLETED", amount: "120.00", payerEmail: "payer@example.com" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("recovers when PayPal says the order was already captured", async () => {
    await createOrder();
    usePayPal({ capture: { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_ALREADY_CAPTURED" }] }, captureStatus: 422, order: completed() });
    const res = await post({ action: "capture", orderId: "ORDER-1" }, CLIENT_USER);
    expect((await res.json()).data.status).toBe("COMPLETED");
    expect(row().status).toBe("COMPLETED");
  });

  it("refuses an amount mismatch and never marks it paid", async () => {
    await createOrder();
    usePayPal({ capture: completed("1.00") });
    const res = await post({ action: "capture", orderId: "ORDER-1" }, CLIENT_USER);
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("amount_mismatch");
    expect(row().status).toBe("MISMATCH");
  });

  it("refuses a currency mismatch", async () => {
    await createOrder();
    usePayPal({ capture: completed("120.00", "EUR") });
    expect((await post({ action: "capture", orderId: "ORDER-1" }, CLIENT_USER)).status).toBe(409);
  });

  it("returns a non-COMPLETED status unchanged and leaves the order retryable", async () => {
    await createOrder();
    usePayPal({ capture: { id: "ORDER-1", status: "PAYER_ACTION_REQUIRED" } });
    const res = await post({ action: "capture", orderId: "ORDER-1" }, CLIENT_USER);
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe("PAYER_ACTION_REQUIRED");
    expect(row().status).toBe("CREATED");
  });

  it("rejects orders it didn't create, other callers and mismatched clients", async () => {
    expect((await post({ action: "capture", orderId: "ORDER-X" }, CLIENT_USER)).status).toBe(404);
    expect((await post({ action: "capture", orderId: "../../v1" }, CLIENT_USER)).status).toBe(400);
    await createOrder();
    usePayPal({ capture: completed() });
    expect((await post({ action: "capture", orderId: "ORDER-1" }, STRANGER)).status).toBe(403);
    expect((await post({ action: "capture", orderId: "ORDER-1", clientId: "client-2" }, COACH)).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unknown actions", async () => {
    expect((await post({ action: "refund" }, CLIENT_USER)).status).toBe(400);
  });
});

describe("GET /api/pay/history", () => {
  const history = (user: string, clientId = "client-1") =>
    app.request(`/api/pay/history?clientId=${clientId}`, { headers: { "x-test-user": user } }, env);

  it("shows the client and their coach the recorded payments", async () => {
    await createOrder();
    for (const user of [CLIENT_USER, COACH]) {
      const { data } = await (await history(user)).json();
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({ order_id: "ORDER-1", status: "CREATED", amount: "120.00" });
      expect(data[0].raw).toBeUndefined();
    }
  });

  it("hides payments from anyone else", async () => {
    expect((await history(STRANGER)).status).toBe(403);
    expect((await history(CLIENT_USER, "client-2")).status).toBe(403);
  });
});
