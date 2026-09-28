// Transactional email through Resend's HTTPS API (Workers Email Sending is
// not on the free plan). Without RESEND_API_KEY the link is logged instead,
// so local dev works without a mail provider.
import type { Env } from "../env";
import { CUTOVER_SETUP_TTL_MS, TOKEN_TTL_MS, createAuthToken, type TokenKind } from "./store";
import {
  emailChangeTemplate,
  recoveryTemplate,
  setupTemplate,
  verifyTemplate,
  type EmailContent,
} from "./templates";

const RESEND_URL = "https://api.resend.com/emails";

export interface EmailUser {
  id: string;
  email: string;
  user_metadata?: any;
}

/** Emailed links land on the app root; App.jsx picks up `?code=`. */
export function buildAuthLink(base: string, token: string, type: string): string {
  const url = new URL(base);
  url.searchParams.set("code", token);
  url.searchParams.set("type", type);
  return url.toString();
}

export async function sendEmail(env: Env, to: string, content: EmailContent, devLink: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    // Never put live tokens into production logs; locally, the link is the whole point.
    const shown = env.APP_ENV === "production" ? "(link hidden in production)" : devLink;
    console.warn(`[auth] RESEND_API_KEY not set; email "${content.subject}" to ${to} not sent. Link: ${shown}`);
    return;
  }
  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.RESEND_FROM, to: [to], subject: content.subject, html: content.html, text: content.text }),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`Resend responded ${res.status}: ${detail}`);
  }
}

function name(user: EmailUser): unknown {
  return user.user_metadata?.name;
}

async function issue(env: Env, user: EmailUser, kind: TokenKind, extra: { newEmail?: string; ttlMs?: number } = {}) {
  return createAuthToken(env.DB, { userId: user.id, kind, newEmail: extra.newEmail, ttlMs: extra.ttlMs });
}

export async function sendVerifyEmail(env: Env, user: EmailUser, origin: string): Promise<void> {
  const link = buildAuthLink(`${origin}/`, await issue(env, user, "verify"), "signup");
  await sendEmail(env, user.email, verifyTemplate(link, name(user)), link);
}

export async function sendRecoveryEmail(env: Env, user: EmailUser, base: string): Promise<void> {
  const link = buildAuthLink(base, await issue(env, user, "recovery"), "recovery");
  await sendEmail(env, user.email, recoveryTemplate(link, name(user)), link);
}

export async function sendEmailChangeEmail(env: Env, user: EmailUser, newEmail: string, origin: string): Promise<void> {
  const link = buildAuthLink(`${origin}/`, await issue(env, user, "email_change", { newEmail }), "email_change");
  await sendEmail(env, newEmail, emailChangeTemplate(link, newEmail, name(user)), link);
}

async function sendSetup(env: Env, user: EmailUser, base: string, ttlMs: number, expiry: string) {
  const link = buildAuthLink(base, await issue(env, user, "setup", { ttlMs }), "setup");
  await sendEmail(env, user.email, setupTemplate(link, expiry, name(user)), link);
}

/** Self-service "set your password" for a migrated user who asked for a reset or tried to sign up. */
export function sendSelfServiceSetupEmail(env: Env, user: EmailUser, base: string): Promise<void> {
  return sendSetup(env, user, base, TOKEN_TTL_MS.setup, "This link expires in 1 hour and can only be used once.");
}

/**
 * Cutover: creates a 7-day 'setup' token for a migrated (password-less) user
 * and emails the "Forge has moved, set your password" message. Called by the
 * migrate agent. `origin` is the app origin, e.g. https://app.example.com.
 */
export async function sendPasswordSetupEmail(
  env: Env,
  user: { id: string; email: string; user_metadata?: any },
  origin: string,
): Promise<void> {
  const base = `${new URL(origin).origin}/`;
  await sendSetup(env, user, base, CUTOVER_SETUP_TTL_MS, "This link expires in 7 days and can only be used once. If it expires, use \"Forgot password?\" on the sign-in screen.");
}
