// Route group /api/ai - see docs/cloudflare/CONTRACTS.md for ownership.
// Port of the v1 `forge-ai` Supabase Edge Function. POST { action, ...input }
// -> { data: <exactly what v1 returned> } | { error: { message, code } }.
import { Hono } from "hono";
import type { AppContext } from "../lib/env";
import { HttpError, fail } from "../lib/http";
import { requireUser } from "../lib/session";
import { AI_ACTIONS, isAiAction } from "../lib/services/ai/actions";
import { DEFAULT_GEMINI_MODEL } from "../lib/services/ai/gemini";
import { AI_MAX_BODY_BYTES, currentUser, enforceLimit, readJsonBody } from "../lib/services/request";

export const AI_RATE_LIMIT_MESSAGE = "The AI coach is getting a lot of requests right now — try again in a minute.";

const app = new Hono<AppContext>();

app.use("*", requireUser);

app.post("/", async (c) => {
  const user = currentUser(c);
  await enforceLimit(c.env.AI_LIMITER, user, AI_RATE_LIMIT_MESSAGE);

  const body = await readJsonBody(c, AI_MAX_BODY_BYTES);
  const action = body.action;
  if (!isAiAction(action)) return fail(c, 400, `Unknown action: ${String(action)}`, "unknown_action");

  const cfg = { apiKey: c.env.GEMINI_API_KEY, model: c.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL };
  try {
    const data = await AI_ACTIONS[action](cfg, body);
    return c.json({ data });
  } catch (e: any) {
    if (e instanceof HttpError) throw e;
    // Same as v1: the message is surfaced (src/lib/ai.js maps quota errors
    // to a friendly line). Prompt inputs are never echoed back.
    console.error("forge-ai action failed", action, e?.message);
    return fail(c, 500, String(e?.message || e), "ai_error");
  }
});

export default app;
