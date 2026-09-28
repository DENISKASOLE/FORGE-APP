// Input validation, rate limiting and small request helpers for /api/auth.
import type { Context } from "hono";
import type { AppContext } from "../env";
import { HttpError } from "../http";
import { normalizeEmail } from "./store";

export const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 256;
const MAX_EMAIL_LENGTH = 254;
const MAX_METADATA_BYTES = 4096;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requireEmail(value: unknown): string {
  if (typeof value !== "string") throw new HttpError(400, "Please enter your email address.", "validation_failed");
  const email = normalizeEmail(value);
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) {
    throw new HttpError(400, "Please enter a valid email address.", "validation_failed");
  }
  return email;
}

export function requireNewPassword(value: unknown): string {
  if (typeof value !== "string" || value.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(422, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, "weak_password");
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    throw new HttpError(422, `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`, "weak_password");
  }
  return value;
}

export function readMetadata(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Profile data must be an object.", "validation_failed");
  }
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_METADATA_BYTES) {
    throw new HttpError(400, "Profile data is too large.", "validation_failed");
  }
  return value as Record<string, unknown>;
}

export function clientIp(c: Context<AppContext>): string {
  return c.req.header("CF-Connecting-IP") || "unknown";
}

/** AUTH_LIMITER keyed by IP and (when given) lowercased email. 429 when either is exhausted. */
export async function rateLimit(c: Context<AppContext>, ...extraKeys: (string | null | undefined)[]): Promise<void> {
  const limiter = c.env.AUTH_LIMITER;
  if (!limiter) return; // unit tests / misconfigured local env
  const keys = [`ip:${clientIp(c)}`, ...extraKeys.filter((k): k is string => !!k)];
  const results = await Promise.all(keys.map((key) => limiter.limit({ key })));
  if (results.some((r) => !r.success)) {
    throw new HttpError(429, "Too many attempts. Please wait a minute and try again.", "rate_limited");
  }
}

export function emailKey(email: string | null | undefined): string | null {
  return email ? `email:${normalizeEmail(email)}` : null;
}

export function requestOrigin(c: Context<AppContext>): string {
  return new URL(c.req.url).origin;
}

/** Only same-origin redirect targets are honoured; anything else falls back to the app root. */
export function safeRedirectBase(redirectTo: unknown, origin: string): string {
  if (typeof redirectTo === "string" && redirectTo) {
    try {
      const url = new URL(redirectTo);
      if (url.origin === origin) return `${url.origin}${url.pathname}`;
    } catch {
      /* not a URL: ignore */
    }
  }
  return `${origin}/`;
}

/** Runs email sending after the response so its latency can't reveal whether an account exists. */
export function inBackground(c: Context<AppContext>, label: string, task: () => Promise<void>): void {
  const run = task().catch((err) => console.error(`[auth] ${label} failed`, err));
  try {
    c.executionCtx.waitUntil(run);
  } catch {
    /* no ExecutionContext (tests): the promise still runs */
  }
}
