// Route group /api/admin - see docs/cloudflare/CONTRACTS.md for ownership.
// Cutover route: copies v1 (Supabase) into D1/R2 in small resumable steps,
// driven by scripts/cutover.mjs. Runbook: docs/cloudflare/CUTOVER.md.
// Disabled (404) unless MIGRATION_ENABLED === "true".
import { Hono } from "hono";
import type { AppContext } from "../lib/env";
import { HttpError } from "../lib/http";
import { Budget } from "../lib/migrate/budget";
import { migrationGuard } from "../lib/migrate/guard";
import { RESET_CONFIRM, resetAppData } from "../lib/migrate/reset";
import { STEPS, runStep } from "../lib/migrate/steps";
import type { StepInput } from "../lib/migrate/types";

const MAX_BODY_CHARS = 256 * 1024;

const app = new Hono<AppContext>();

app.use("*", migrationGuard);

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (!text.trim()) return {};
  if (text.length > MAX_BODY_CHARS) throw new HttpError(413, "Request body too large", "too_large");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON body", "bad_json");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Body must be a JSON object", "bad_body");
  }
  return body as Record<string, unknown>;
}

function parseInput(body: Record<string, unknown>): StepInput {
  const { cursor, pageSize, force } = body;
  if (cursor != null && typeof cursor !== "string") throw new HttpError(400, "cursor must be a string or null", "bad_cursor");
  if (pageSize != null && (!Number.isInteger(pageSize) || (pageSize as number) < 1)) {
    throw new HttpError(400, "pageSize must be a positive integer", "bad_page_size");
  }
  if (force != null && typeof force !== "boolean") throw new HttpError(400, "force must be a boolean", "bad_force");
  return { cursor: (cursor as string | null | undefined) ?? null, pageSize: pageSize as number | undefined, force: force === true };
}

app.get("/migrate", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT key, value, updated_at FROM migration_log WHERE key NOT LIKE 'email:%' ORDER BY key",
  ).all();
  return c.json({ data: { steps: STEPS, log: results ?? [] } });
});

app.post("/migrate/reset-app-data", async (c) => {
  const body = await readBody(c.req.raw);
  if (body.confirm !== RESET_CONFIRM) {
    throw new HttpError(400, `Send {"confirm":"${RESET_CONFIRM}"} to wipe the migrated app tables`, "confirm_required");
  }
  const result = await resetAppData(c.env.DB, new Budget());
  return c.json({ data: result });
});

app.post("/migrate/:step", async (c) => {
  const input = parseInput(await readBody(c.req.raw));
  const origin = new URL(c.req.url).origin;
  const result = await runStep(c.env, origin, c.req.param("step"), input);
  return c.json({ data: result });
});

export default app;
