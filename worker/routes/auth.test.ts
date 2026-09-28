import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../index";
import { createTestD1, type TestD1 } from "../lib/auth/testD1";
import { sendPasswordSetupEmail } from "../lib/auth/email";
import type { Env } from "../lib/env";

const ORIGIN = "http://localhost";

interface SentEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

let db: TestD1;
let env: Env;
let sent: SentEmail[];
let pending: Promise<unknown>[];
let allowRate: boolean;

const ctx = {
  waitUntil: (p: Promise<unknown>) => void pending.push(p),
  passThroughOnException: () => {},
  props: {},
} as unknown as ExecutionContext;

beforeEach(() => {
  db = createTestD1();
  sent = [];
  pending = [];
  allowRate = true;
  env = {
    DB: db.d1,
    AUTH_LIMITER: { limit: async () => ({ success: allowRate }) },
    APP_ENV: "test",
    RESEND_API_KEY: "re_test",
    RESEND_FROM: "Forge <no-reply@example.com>",
    PBKDF2_ITERATIONS: "10000",
  } as unknown as Env;
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (!String(url).startsWith("https://api.resend.com/")) throw new Error(`unexpected fetch ${url}`);
    const body = JSON.parse(String(init.body));
    sent.push({ to: body.to[0], subject: body.subject, text: body.text, html: body.html });
    return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function call(method: string, path: string, opts: { body?: unknown; cookie?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { Origin: ORIGIN, ...opts.headers };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.cookie) headers.Cookie = opts.cookie;
  const res = await app.request(
    `${ORIGIN}/api/auth${path}`,
    { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) },
    env,
    ctx,
  );
  await Promise.all(pending.splice(0));
  const setCookie = res.headers.get("Set-Cookie") || "";
  const match = /forge_session=([^;]*)/.exec(setCookie);
  return { status: res.status, json: (await res.json()) as any, setCookie, cookie: match ? `forge_session=${match[1]}` : "" };
}

function lastLink(to?: string): URL {
  const mail = [...sent].reverse().find((m) => !to || m.to === to);
  if (!mail) throw new Error("no email sent");
  const href = /(https?:\/\/\S+[?&]code=\S+)/.exec(mail.text)?.[1];
  if (!href) throw new Error("no link in email");
  return new URL(href);
}

function insertMigratedUser(id = "11111111-1111-4111-8111-111111111111", email = "old@example.com") {
  db.raw.prepare("INSERT INTO users (id, email, user_metadata) VALUES (?, ?, ?)").run(id, email, '{"name":"Old"}');
  return { id, email };
}

async function signUpAndVerify(email = "new@example.com", password = "password123") {
  await call("POST", "/signup", { body: { email, password, data: { name: "New", role: "client" } } });
  const code = lastLink(email).searchParams.get("code");
  return call("POST", "/exchange", { body: { code } });
}

describe("sign-up and email verification", () => {
  it("creates an unverified user, emails a verify link and returns session: null", async () => {
    const r = await call("POST", "/signup", { body: { email: "New@Example.com", password: "password123", data: { name: "New", role: "client" } } });
    expect(r.status).toBe(200);
    expect(r.json.data.session).toBeNull();
    expect(r.json.data.user).toMatchObject({ email: "new@example.com", email_verified: false, user_metadata: { name: "New", role: "client" } });
    expect(r.setCookie).toBe("");
    const link = lastLink("new@example.com");
    expect(link.origin).toBe(ORIGIN);
    expect(link.pathname).toBe("/");
    expect(link.searchParams.get("type")).toBe("signup");
    const row = db.raw.prepare("SELECT * FROM users").get();
    expect(row.password_iterations).toBe(10000);
    expect(row.email_verified_at).toBeNull();
  });

  it("rejects short passwords and bad emails", async () => {
    expect((await call("POST", "/signup", { body: { email: "a@b.co", password: "short" } })).json.error.code).toBe("weak_password");
    expect((await call("POST", "/signup", { body: { email: "nope", password: "password123" } })).status).toBe(400);
  });

  it("blocks login until the email is verified, then the verify link signs in", async () => {
    await call("POST", "/signup", { body: { email: "new@example.com", password: "password123" } });
    const blocked = await call("POST", "/login", { body: { email: "new@example.com", password: "password123" } });
    expect(blocked.status).toBe(400);
    expect(blocked.json.error.code).toBe("email_not_confirmed");
    expect(blocked.json.error.message).not.toMatch(/sent|created|connected/); // LoginScreen colours those green

    const code = lastLink().searchParams.get("code");
    const ex = await call("POST", "/exchange", { body: { code } });
    expect(ex.status).toBe(200);
    expect(ex.json.data.type).toBe("verify");
    expect(ex.json.data.user.email_verified).toBe(true);
    expect(ex.cookie).toMatch(/^forge_session=/);

    const login = await call("POST", "/login", { body: { email: "NEW@example.com", password: "password123" } });
    expect(login.status).toBe(200);
    expect(login.json.data.session.user.email).toBe("new@example.com");
    expect(login.json.data.session.expires_at).toBeGreaterThan(Date.now() / 1000 + 29 * 86400);
    expect(login.setCookie).toMatch(/HttpOnly; Secure; SameSite=Lax/);
  });

  it("does not reveal an existing account on sign-up", async () => {
    await signUpAndVerify("taken@example.com");
    const before = sent.length;
    const r = await call("POST", "/signup", { body: { email: "taken@example.com", password: "different123" } });
    expect(r.status).toBe(200);
    expect(r.json.data.session).toBeNull();
    expect(r.json.data.user.email).toBe("taken@example.com");
    const realId = db.raw.prepare("SELECT id FROM users").get().id;
    expect(r.json.data.user.id).not.toBe(realId);
    expect(sent.length).toBe(before); // verified user with a password: nothing to send
    expect(db.raw.prepare("SELECT count(*) AS n FROM users").get().n).toBe(1);
  });

  it("sends a setup email when a migrated (password-less) user signs up", async () => {
    const u = insertMigratedUser();
    const r = await call("POST", "/signup", { body: { email: u.email, password: "password123" } });
    expect(r.status).toBe(200);
    expect(r.json.data.user.id).not.toBe(u.id);
    expect(lastLink(u.email).searchParams.get("type")).toBe("setup");
    expect(db.raw.prepare("SELECT password_hash FROM users").get().password_hash).toBeNull();
  });
});

describe("login, session, logout", () => {
  it("uses one generic error for unknown email, wrong password and migrated users", async () => {
    await signUpAndVerify("real@example.com");
    insertMigratedUser();
    const unknown = await call("POST", "/login", { body: { email: "ghost@example.com", password: "password123" } });
    const wrong = await call("POST", "/login", { body: { email: "real@example.com", password: "wrongpass1" } });
    const migrated = await call("POST", "/login", { body: { email: "old@example.com", password: "password123" } });
    for (const r of [unknown, wrong, migrated]) {
      expect(r.status).toBe(400);
      expect(r.json.error.code).toBe("invalid_credentials");
      expect(r.json.error.message).toMatch(/Forgot password/);
    }
    expect(unknown.json.error.message).toBe(migrated.json.error.message);
  });

  it("resolves the session from the cookie or a Bearer token, and logout revokes it", async () => {
    await signUpAndVerify("s@example.com");
    const login = await call("POST", "/login", { body: { email: "s@example.com", password: "password123" } });
    const cookie = login.cookie;
    const token = cookie.split("=")[1];

    const viaCookie = await call("GET", "/session", { cookie });
    expect(viaCookie.json.data.session.user.email).toBe("s@example.com");
    const viaBearer = await call("GET", "/session", { headers: { Authorization: `Bearer ${token}` } });
    expect(viaBearer.json.data.session.user.email).toBe("s@example.com");

    const out = await call("POST", "/logout", { cookie });
    expect(out.setCookie).toMatch(/Max-Age=0/);
    expect((await call("GET", "/session", { cookie })).json.data.session).toBeNull();
  });

  it("returns session: null without a cookie", async () => {
    expect((await call("GET", "/session")).json).toEqual({ data: { session: null } });
  });

  it("rate limits with 429", async () => {
    allowRate = false;
    const r = await call("POST", "/login", { body: { email: "a@example.com", password: "password123" } });
    expect(r.status).toBe(429);
    expect(r.json.error.code).toBe("rate_limited");
  });

  it("keys the limiter by IP and lowercased email", async () => {
    const keys: string[] = [];
    env = { ...env, AUTH_LIMITER: { limit: async ({ key }: { key: string }) => (keys.push(key), { success: true }) } } as unknown as Env;
    await call("POST", "/recover", { body: { email: "Mixed@Example.com" }, headers: { "CF-Connecting-IP": "203.0.113.9" } });
    expect(keys).toEqual(["ip:203.0.113.9", "email:mixed@example.com"]);
  });

  it("rejects cross-origin POSTs (CSRF guard)", async () => {
    const r = await call("POST", "/login", { body: {}, headers: { Origin: "https://evil.example" } });
    expect(r.status).toBe(403);
  });
});

describe("password recovery and migrated-user setup", () => {
  it("always succeeds and never emails unknown addresses", async () => {
    const r = await call("POST", "/recover", { body: { email: "ghost@example.com", redirectTo: `${ORIGIN}/` } });
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ data: {} });
    expect(sent).toHaveLength(0);
  });

  it("recovery link -> exchange (type recovery) -> set password -> old sessions revoked, link single-use", async () => {
    await signUpAndVerify("r@example.com");
    const other = await call("POST", "/login", { body: { email: "r@example.com", password: "password123" } });

    await call("POST", "/recover", { body: { email: "r@example.com", redirectTo: "https://forgeappbydenis.vercel.app/" } });
    const link = lastLink("r@example.com");
    expect(link.origin).toBe(ORIGIN); // foreign redirectTo ignored
    expect(link.searchParams.get("type")).toBe("recovery");
    const code = link.searchParams.get("code");

    const ex = await call("POST", "/exchange", { body: { code } });
    expect(ex.json.data.type).toBe("recovery");
    const upd = await call("PUT", "/user", { cookie: ex.cookie, body: { password: "brandnew123" } });
    expect(upd.status).toBe(200);
    expect(upd.json.data.user.email).toBe("r@example.com");

    expect((await call("POST", "/exchange", { body: { code } })).json.error.code).toBe("invalid_code");
    expect((await call("GET", "/session", { cookie: other.cookie })).json.data.session).toBeNull();
    expect((await call("GET", "/session", { cookie: ex.cookie })).json.data.session).not.toBeNull();
    expect((await call("POST", "/login", { body: { email: "r@example.com", password: "password123" } })).status).toBe(400);
    expect((await call("POST", "/login", { body: { email: "r@example.com", password: "brandnew123" } })).status).toBe(200);
  });

  it("honours a same-origin redirectTo path", async () => {
    await signUpAndVerify("p@example.com");
    await call("POST", "/recover", { body: { email: "p@example.com", redirectTo: `${ORIGIN}/reset?x=1` } });
    const link = lastLink("p@example.com");
    expect(link.pathname).toBe("/reset");
    expect(link.searchParams.get("x")).toBeNull();
  });

  it("migrated user: recover sends a setup link; exchange returns type setup and verifies email", async () => {
    const u = insertMigratedUser();
    await call("POST", "/recover", { body: { email: "OLD@example.com" } });
    const link = lastLink(u.email);
    expect(link.searchParams.get("type")).toBe("setup");
    const ex = await call("POST", "/exchange", { body: { code: link.searchParams.get("code") } });
    expect(ex.json.data).toMatchObject({ type: "setup", user: { id: u.id, email_verified: true } });
    await call("PUT", "/user", { cookie: ex.cookie, body: { password: "firstpass1" } });
    const login = await call("POST", "/login", { body: { email: u.email, password: "firstpass1" } });
    expect(login.status).toBe(200);
    expect(login.json.data.user.id).toBe(u.id);
  });

  it("sendPasswordSetupEmail issues a 7-day setup link", async () => {
    const u = insertMigratedUser();
    await sendPasswordSetupEmail(env, { id: u.id, email: u.email, user_metadata: { name: "Old" } }, "https://app.example.com/some/path");
    const mail = sent[0];
    expect(mail.subject).toMatch(/Forge has moved/);
    expect(mail.text).toContain("Hi Old,");
    const link = lastLink(u.email);
    expect(link.origin).toBe("https://app.example.com");
    expect(link.searchParams.get("type")).toBe("setup");
    const row = db.raw.prepare("SELECT kind, created_at, expires_at FROM auth_tokens").get();
    expect(row.kind).toBe("setup");
    expect(Date.parse(row.expires_at) - Date.parse(row.created_at)).toBe(7 * 24 * 3600 * 1000);
  });

  it("logs instead of throwing when RESEND_API_KEY is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const u = insertMigratedUser();
    await sendPasswordSetupEmail({ ...env, RESEND_API_KEY: undefined }, u, ORIGIN);
    expect(warn.mock.calls[0][0]).toContain("code=");
    expect(sent).toHaveLength(0);
    warn.mockRestore();
  });

  it("rejects garbage and unknown codes", async () => {
    expect((await call("POST", "/exchange", { body: { code: "x" } })).json.error.code).toBe("invalid_code");
    expect((await call("POST", "/exchange", { body: { code: "a".repeat(43) } })).json.error.code).toBe("invalid_code");
  });
});

describe("PUT /user", () => {
  it("requires a session", async () => {
    expect((await call("PUT", "/user", { body: { data: { name: "x" } } })).status).toBe(401);
  });

  it("merges metadata and changes email only after the new address confirms", async () => {
    const { cookie } = await signUpAndVerify("me@example.com");
    const meta = await call("PUT", "/user", { cookie, body: { data: { phone: "123" } } });
    expect(meta.json.data.user.user_metadata).toEqual({ name: "New", role: "client", phone: "123" });

    const change = await call("PUT", "/user", { cookie, body: { email: "Me2@example.com" } });
    expect(change.json.data.user.email).toBe("me@example.com");
    expect(change.json.data.user.new_email).toBe("me2@example.com");
    const link = lastLink("me2@example.com");
    expect(link.searchParams.get("type")).toBe("email_change");

    const ex = await call("POST", "/exchange", { body: { code: link.searchParams.get("code") } });
    expect(ex.json.data).toMatchObject({ type: "email_change", user: { email: "me2@example.com" } });
    expect((await call("POST", "/login", { body: { email: "me2@example.com", password: "password123" } })).status).toBe(200);
  });

  it("does not email a new address that belongs to someone else", async () => {
    await signUpAndVerify("owner@example.com");
    const { cookie } = await signUpAndVerify("me@example.com");
    const before = sent.length;
    const r = await call("PUT", "/user", { cookie, body: { email: "owner@example.com" } });
    expect(r.status).toBe(200);
    expect(sent.length).toBe(before);
  });
});
