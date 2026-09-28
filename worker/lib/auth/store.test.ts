import { beforeEach, describe, expect, it } from "vitest";
import { createTestD1, type TestD1 } from "./testD1";
import {
  TOKEN_TTL_MS,
  consumeAuthToken,
  createAuthToken,
  createSession,
  createUser,
  deleteOtherSessions,
  deleteSession,
  findSession,
  findUserByEmail,
  revokeTokens,
  touchSession,
} from "./store";
import { SESSION_REFRESH_MS, SESSION_TTL_MS } from "./cookies";
import { sha256Hex } from "./crypto";

const PW = { hash: "h", salt: "s", iterations: 10_000 };
let t: TestD1;

beforeEach(() => {
  t = createTestD1();
});

async function user(email = "a@example.com") {
  return createUser(t.d1, { email, password: PW, metadata: { name: "A" } });
}

describe("users", () => {
  it("stores email lowercased and looks it up case-insensitively", async () => {
    const u = await user("Mixed@Example.COM");
    expect(u.email).toBe("mixed@example.com");
    expect(u.password_iterations).toBe(10_000);
    expect((await findUserByEmail(t.d1, "  MIXED@example.com "))?.id).toBe(u.id);
  });
  it("enforces unique emails regardless of case", async () => {
    await user("dup@example.com");
    t.raw.exec("INSERT INTO users (id, email) VALUES ('x', 'other@example.com')");
    expect(() => t.raw.exec("INSERT INTO users (id, email) VALUES ('y', 'DUP@example.com')")).toThrow(/UNIQUE/);
  });
});

describe("auth tokens", () => {
  it("are stored hashed and can be consumed exactly once", async () => {
    const u = await user();
    const token = await createAuthToken(t.d1, { userId: u.id, kind: "recovery" });
    const stored = t.raw.prepare("SELECT token_hash FROM auth_tokens").get();
    expect(stored.token_hash).toBe(await sha256Hex(token));
    expect(stored.token_hash).not.toContain(token);

    const first = await consumeAuthToken(t.d1, token);
    expect(first).toMatchObject({ user_id: u.id, kind: "recovery" });
    expect(await consumeAuthToken(t.d1, token)).toBeNull();
  });

  it("expire after their kind's TTL", async () => {
    const u = await user();
    const now = Date.now();
    const token = await createAuthToken(t.d1, { userId: u.id, kind: "recovery" }, now);
    expect(await consumeAuthToken(t.d1, token, now + TOKEN_TTL_MS.recovery + 1)).toBeNull();
    const verify = await createAuthToken(t.d1, { userId: u.id, kind: "verify" }, now);
    expect(await consumeAuthToken(t.d1, verify, now + TOKEN_TTL_MS.verify - 1000)).not.toBeNull();
  });

  it("honour a custom TTL (7-day cutover setup links)", async () => {
    const u = await user();
    const now = Date.now();
    const week = 7 * 24 * 3600 * 1000;
    const token = await createAuthToken(t.d1, { userId: u.id, kind: "setup", ttlMs: week }, now);
    expect(await consumeAuthToken(t.d1, token, now + week - 1000)).not.toBeNull();
  });

  it("can be revoked by kind", async () => {
    const u = await user();
    const rec = await createAuthToken(t.d1, { userId: u.id, kind: "recovery" });
    const ver = await createAuthToken(t.d1, { userId: u.id, kind: "verify" });
    await revokeTokens(t.d1, u.id, ["recovery", "setup"]);
    expect(await consumeAuthToken(t.d1, rec)).toBeNull();
    expect(await consumeAuthToken(t.d1, ver)).not.toBeNull();
  });

  it("reject unknown kinds at the schema level", async () => {
    const u = await user();
    expect(() =>
      t.raw.prepare("INSERT INTO auth_tokens (token_hash, user_id, kind, expires_at) VALUES ('h', ?, 'magic', 'x')").run(u.id),
    ).toThrow(/CHECK/);
  });
});

describe("sessions", () => {
  it("store only the token hash and resolve the user", async () => {
    const u = await user();
    const { token, expiresAt } = await createSession(t.d1, u.id);
    const row = t.raw.prepare("SELECT token_hash FROM sessions").get();
    expect(row.token_hash).toBe(await sha256Hex(token));
    const found = await findSession(t.d1, token);
    expect(found?.user.id).toBe(u.id);
    expect(found?.user.created_at).toBe(u.created_at);
    expect(found?.session.expires_at).toBe(expiresAt);
  });

  it("expire after 30 days", async () => {
    const u = await user();
    const now = Date.now();
    const { token } = await createSession(t.d1, u.id, now);
    expect(await findSession(t.d1, token, now + SESSION_TTL_MS - 1000)).not.toBeNull();
    expect(await findSession(t.d1, token, now + SESSION_TTL_MS + 1)).toBeNull();
  });

  it("slide at most once a day", async () => {
    const u = await user();
    const now = Date.now();
    const { token } = await createSession(t.d1, u.id, now);
    const found = (await findSession(t.d1, token, now))!;
    expect(await touchSession(t.d1, found.session, SESSION_REFRESH_MS, now + 1000)).toBeNull();
    const later = now + SESSION_REFRESH_MS + 1;
    const extended = await touchSession(t.d1, found.session, SESSION_REFRESH_MS, later);
    expect(Date.parse(extended!)).toBe(later + SESSION_TTL_MS);
    expect((await findSession(t.d1, token, now + SESSION_TTL_MS + 1000))?.user.id).toBe(u.id);
  });

  it("are deleted on logout, on password change (others) and with the user", async () => {
    const u = await user();
    const a = await createSession(t.d1, u.id);
    const b = await createSession(t.d1, u.id);
    const c = await createSession(t.d1, u.id);
    await deleteSession(t.d1, a.token);
    expect(await findSession(t.d1, a.token)).toBeNull();
    await deleteOtherSessions(t.d1, u.id, b.token);
    expect(await findSession(t.d1, b.token)).not.toBeNull();
    expect(await findSession(t.d1, c.token)).toBeNull();
    t.raw.prepare("DELETE FROM users WHERE id = ?").run(u.id);
    expect(t.raw.prepare("SELECT count(*) AS n FROM sessions").get().n).toBe(0);
  });
});
