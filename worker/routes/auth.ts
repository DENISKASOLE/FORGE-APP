// Route group /api/auth - self-hosted email+password auth on D1 (sow.md
// Phase 5). Response envelope: { data } / { error: { message, code } }.
import { Hono, type Context } from "hono";
import type { AppContext } from "../lib/env";
import { HttpError, readJson } from "../lib/http";
import { forgetSession, requireUser, resolveSession } from "../lib/session";
import { clearSessionCookie, readSessionToken, sessionCookie } from "../lib/auth/cookies";
import { dummyVerify, hashPassword, isWellFormedToken, resolveIterations, verifyPassword } from "../lib/auth/crypto";
import {
  consumeAuthToken,
  createSession,
  createUser,
  deleteOtherSessions,
  deleteSession,
  findUserByEmail,
  findUserById,
  markEmailVerified,
  normalizeEmail,
  parseMetadata,
  revokeTokens,
  setPassword,
  storedHash,
  toPublicUser,
  updateUserFields,
  type UserRow,
} from "../lib/auth/store";
import {
  sendEmailChangeEmail,
  sendRecoveryEmail,
  sendSelfServiceSetupEmail,
  sendVerifyEmail,
} from "../lib/auth/email";
import {
  emailKey,
  inBackground,
  rateLimit,
  readMetadata,
  requestOrigin,
  requireEmail,
  requireNewPassword,
  safeRedirectBase,
} from "../lib/auth/guards";

const app = new Hono<AppContext>();

// One message for unknown email, wrong password and migrated (password-less)
// accounts, so a failed login never reveals whether an account exists.
const INVALID_LOGIN =
  'Invalid email or password. If you used Forge before the move, tap "Forgot password?" or use the link we emailed you to set a new password.';
const EMAIL_NOT_CONFIRMED =
  "Please confirm your email first. Check your inbox for the confirmation link (we just emailed you a fresh one).";
const INVALID_LINK = "This link is invalid or has expired. Request a new one from the sign-in screen.";

type Ctx = Context<AppContext>;

function iterations(c: Ctx): number {
  return resolveIterations(c.env.PBKDF2_ITERATIONS);
}

function sessionPayload(user: UserRow, expiresAtIso: string) {
  const expiresAt = Math.floor(Date.parse(expiresAtIso) / 1000);
  return {
    user: toPublicUser(user),
    expires_at: expiresAt,
    expires_in: Math.max(0, expiresAt - Math.floor(Date.now() / 1000)),
    token_type: "cookie",
  };
}

async function startSession(c: Ctx, user: UserRow) {
  const { token, expiresAt } = await createSession(c.env.DB, user.id);
  c.header("Set-Cookie", sessionCookie(token), { append: true });
  c.header("Cache-Control", "no-store");
  forgetSession(c);
  return { token, session: sessionPayload(user, expiresAt) };
}

/** A believable stand-in user returned when sign-up hits an existing email. */
function decoyUser(email: string, metadata: Record<string, unknown>) {
  const now = new Date().toISOString();
  return toPublicUser({
    id: crypto.randomUUID(),
    email,
    password_hash: null,
    password_salt: null,
    password_iterations: null,
    email_verified_at: null,
    user_metadata: JSON.stringify(metadata),
    created_at: now,
    updated_at: now,
  });
}

function isUniqueViolation(err: unknown): boolean {
  return /UNIQUE constraint failed/i.test(String((err as Error)?.message ?? err));
}

// ---- sign up ----------------------------------------------------------------

app.post("/signup", async (c) => {
  const body = await readJson<{ email?: unknown; password?: unknown; data?: unknown }>(c);
  const email = requireEmail(body.email);
  await rateLimit(c, emailKey(email));
  const password = requireNewPassword(body.password);
  const metadata = readMetadata(body.data);
  const origin = requestOrigin(c);

  let existing = await findUserByEmail(c.env.DB, email);
  if (!existing) {
    try {
      const user = await createUser(c.env.DB, { email, password: await hashPassword(password, iterations(c)), metadata });
      inBackground(c, "verify email", () => sendVerifyEmail(c.env, { ...user, user_metadata: metadata }, origin));
      return c.json({ data: { user: toPublicUser(user), session: null } });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      existing = await findUserByEmail(c.env.DB, email); // lost a race with a concurrent sign-up
      if (!existing) throw err;
    }
  } else {
    await dummyVerify(password, iterations(c)); // same CPU cost as the new-user path
  }

  const known = existing;
  const knownMeta = parseMetadata(known.user_metadata);
  if (!known.password_hash) {
    inBackground(c, "setup email", () => sendSelfServiceSetupEmail(c.env, { ...known, user_metadata: knownMeta }, `${origin}/`));
  } else if (!known.email_verified_at) {
    inBackground(c, "verify email", () => sendVerifyEmail(c.env, { ...known, user_metadata: knownMeta }, origin));
  }
  return c.json({ data: { user: decoyUser(email, metadata), session: null } });
});

// ---- sign in / out ------------------------------------------------------------

app.post("/login", async (c) => {
  const body = await readJson<{ email?: unknown; password?: unknown }>(c);
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";
  await rateLimit(c, emailKey(email));
  if (!email || !password || password.length > 256) throw new HttpError(400, INVALID_LOGIN, "invalid_credentials");

  const user = await findUserByEmail(c.env.DB, email);
  const stored = user ? storedHash(user) : null;
  const ok = stored ? await verifyPassword(password, stored) : await dummyVerify(password, iterations(c));
  if (!user || !ok) throw new HttpError(400, INVALID_LOGIN, "invalid_credentials");

  if (!user.email_verified_at) {
    inBackground(c, "verify email", () =>
      sendVerifyEmail(c.env, { ...user, user_metadata: parseMetadata(user.user_metadata) }, requestOrigin(c)),
    );
    throw new HttpError(400, EMAIL_NOT_CONFIRMED, "email_not_confirmed");
  }

  const { session } = await startSession(c, user);
  return c.json({ data: { user: session.user, session } });
});

app.post("/logout", async (c) => {
  const token = readSessionToken(c.req.raw.headers);
  if (token) await deleteSession(c.env.DB, token);
  forgetSession(c);
  c.header("Set-Cookie", clearSessionCookie(), { append: true });
  return c.json({ data: {} });
});

app.get("/session", async (c) => {
  c.header("Cache-Control", "no-store");
  const found = await resolveSession(c);
  if (!found) return c.json({ data: { session: null } });
  return c.json({ data: { session: sessionPayload(found.user, found.session.expires_at) } });
});

// ---- emailed links ------------------------------------------------------------

async function applyToken(c: Ctx, kind: string, user: UserRow, newEmail: string | null): Promise<UserRow> {
  if (kind !== "email_change") {
    const verified = await markEmailVerified(c.env.DB, user); // opening the link proves inbox access
    if (kind === "recovery" || kind === "setup") await revokeTokens(c.env.DB, user.id, ["recovery", "setup"]);
    return verified;
  }
  const target = newEmail ? normalizeEmail(newEmail) : "";
  const taken = target ? await findUserByEmail(c.env.DB, target) : null;
  if (!target || (taken && taken.id !== user.id)) {
    throw new HttpError(409, "This email change can't be completed. Please try again from your profile.", "email_change_failed");
  }
  try {
    const updated = await updateUserFields(c.env.DB, user.id, { email: target, email_verified_at: new Date().toISOString() });
    return updated ?? user;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, "This email change can't be completed. Please try again from your profile.", "email_change_failed");
    }
    throw err;
  }
}

app.post("/exchange", async (c) => {
  await rateLimit(c);
  const { code } = await readJson<{ code?: unknown }>(c);
  if (!isWellFormedToken(code)) throw new HttpError(400, INVALID_LINK, "invalid_code");
  const token = await consumeAuthToken(c.env.DB, code);
  const owner = token ? await findUserById(c.env.DB, token.user_id) : null;
  if (!token || !owner) throw new HttpError(400, INVALID_LINK, "invalid_code");

  const user = await applyToken(c, token.kind, owner, token.new_email);
  const { session } = await startSession(c, user);
  return c.json({ data: { session, user: session.user, type: token.kind } });
});

app.post("/recover", async (c) => {
  const body = await readJson<{ email?: unknown; redirectTo?: unknown }>(c);
  const email = requireEmail(body.email);
  await rateLimit(c, emailKey(email));
  const user = await findUserByEmail(c.env.DB, email);
  if (user) {
    const base = safeRedirectBase(body.redirectTo, requestOrigin(c));
    const target = { ...user, user_metadata: parseMetadata(user.user_metadata) };
    inBackground(c, "recovery email", () =>
      user.password_hash ? sendRecoveryEmail(c.env, target, base) : sendSelfServiceSetupEmail(c.env, target, base),
    );
  }
  return c.json({ data: {} });
});

// ---- account changes ----------------------------------------------------------

app.put("/user", requireUser, async (c) => {
  const found = await resolveSession(c);
  if (!found) throw new HttpError(401, "Not signed in", "unauthorized");
  await rateLimit(c, `user:${found.user.id}`);
  const body = await readJson<{ password?: unknown; email?: unknown; data?: unknown }>(c);
  if (body.password === undefined && body.email === undefined && body.data === undefined) {
    throw new HttpError(400, "Nothing to update.", "validation_failed");
  }

  let user = found.user;
  if (body.data !== undefined) {
    const merged = { ...parseMetadata(user.user_metadata), ...readMetadata(body.data) };
    user = (await updateUserFields(c.env.DB, user.id, { user_metadata: JSON.stringify(merged) })) ?? user;
  }

  let newEmail: string | undefined;
  if (body.email !== undefined) {
    const email = requireEmail(body.email);
    if (email !== normalizeEmail(user.email)) {
      newEmail = email;
      const taken = await findUserByEmail(c.env.DB, email);
      // Same response either way; a taken address simply gets no link.
      if (!taken) {
        const target = { ...user, user_metadata: parseMetadata(user.user_metadata) };
        inBackground(c, "email change", () => sendEmailChangeEmail(c.env, target, email, requestOrigin(c)));
      }
    }
  }

  if (body.password !== undefined) {
    const password = requireNewPassword(body.password);
    user = (await setPassword(c.env.DB, user.id, await hashPassword(password, iterations(c)))) ?? user;
    await deleteOtherSessions(c.env.DB, user.id, found.token);
    await revokeTokens(c.env.DB, user.id, ["recovery", "setup"]);
  }

  return c.json({ data: { user: { ...toPublicUser(user), ...(newEmail ? { new_email: newEmail } : {}) } } });
});

export default app;
