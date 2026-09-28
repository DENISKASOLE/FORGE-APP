// Route group /api/food - see docs/cloudflare/CONTRACTS.md for ownership.
// Port of the v1 `forge-fatsecret` Edge Function. GET ?action=... or
// POST { action, ... } -> { data: <exactly what v1 returned> }.
import { Hono, type Context } from "hono";
import type { AppContext } from "../lib/env";
import { HttpError, fail } from "../lib/http";
import { requireUser } from "../lib/session";
import { handleFoodAction } from "../lib/services/fatsecret";
import { SMALL_MAX_BODY_BYTES, currentUser, enforceLimit, readJsonBody } from "../lib/services/request";

const app = new Hono<AppContext>();

app.use("*", requireUser);

async function handle(c: Context<AppContext>) {
  const user = currentUser(c);
  await enforceLimit(c.env.API_LIMITER, user, "Too many requests - please slow down and try again in a minute.");
  const url = new URL(c.req.url);
  const body = c.req.method === "POST" ? await readJsonBody(c, SMALL_MAX_BODY_BYTES) : {};
  const p = (k: string) => {
    const v = url.searchParams.get(k) || body[k] || "";
    return typeof v === "string" || typeof v === "number" ? String(v) : "";
  };
  try {
    const data = await handleFoodAction({ clientId: c.env.FATSECRET_CLIENT_ID, clientSecret: c.env.FATSECRET_CLIENT_SECRET }, p);
    return c.json({ data });
  } catch (e: any) {
    if (e instanceof HttpError) throw e;
    console.error("forge-fatsecret failed", e?.message);
    return fail(c, 500, String(e?.message || e), "food_error");
  }
}

app.get("/", handle);
app.post("/", handle);

export default app;
