// Shared request helpers for the service routes (/api/ai, /api/food, /api/pay).
import type { Context } from "hono";
import type { AppContext, AuthUser } from "../env";
import { HttpError } from "../http";

// body_analysis_extract sends a base64 PDF: the client caps files at 10 MB,
// which is ~13.4 MB once base64-encoded, plus the JSON wrapper.
export const AI_MAX_BODY_BYTES = 15 * 1024 * 1024;
export const SMALL_MAX_BODY_BYTES = 64 * 1024;

// Reads a JSON object body, rejecting anything over `maxBytes` (413) before
// and after reading (Content-Length can be absent or wrong).
export async function readJsonBody(c: Context<AppContext>, maxBytes: number): Promise<Record<string, any>> {
  const declared = Number(c.req.header("Content-Length") || 0);
  if (declared > maxBytes) throw new HttpError(413, "That request is too large.", "payload_too_large");
  let text: string;
  try {
    text = await c.req.text();
  } catch {
    throw new HttpError(400, "Couldn't read the request body.", "bad_body");
  }
  if (text.length > maxBytes) throw new HttpError(413, "That request is too large.", "payload_too_large");
  if (!text.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON body", "bad_json");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new HttpError(400, "Request body must be a JSON object.", "bad_json");
  }
  return parsed as Record<string, any>;
}

// Per-user rate limit via a Workers Rate Limiting binding.
export async function enforceLimit(limiter: RateLimit, user: AuthUser, message: string): Promise<void> {
  const { success } = await limiter.limit({ key: user.id });
  if (!success) throw new HttpError(429, message, "rate_limited");
}

export function currentUser(c: Context<AppContext>): AuthUser {
  const user = c.get("user");
  if (!user) throw new HttpError(401, "Not signed in", "unauthorized");
  return user;
}
