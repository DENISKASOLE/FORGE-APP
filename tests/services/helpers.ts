// Test harness for the service routes: a Hono app with the same error
// handling as worker/index.ts, a fake env, a stubbed session (see the
// vi.mock in each test file) and a D1-like adapter over node:sqlite.
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { Hono } from "hono";
import { vi } from "vitest";
import type { AppContext, AuthUser } from "../../worker/lib/env";
import { HttpError, fail } from "../../worker/lib/http";

export const TEST_USER_HEADER = "x-test-user";

// Drop-in for worker/lib/session.ts: the caller is whoever the test names
// in the x-test-user header; no header means no session.
export const sessionStub = {
  async loadUser(c: any): Promise<AuthUser | null> {
    const id = c.req.header(TEST_USER_HEADER);
    return id ? { id, email: `${id}@example.com`, email_verified: true, user_metadata: {} } : null;
  },
  async requireUser(c: any, next: () => Promise<void>) {
    const user = await sessionStub.loadUser(c);
    if (!user) return fail(c, 401, "Not signed in", "unauthorized");
    c.set("user", user);
    await next();
  },
};

export function mount(path: string, route: Hono<AppContext>) {
  const app = new Hono<AppContext>();
  app.route(path, route);
  app.notFound((c) => fail(c, 404, "Not found", "not_found"));
  app.onError((err, c) => {
    if (err instanceof HttpError) return fail(c, err.status, err.message, err.code);
    return fail(c, 500, "Something went wrong. Please try again.", "internal");
  });
  return app;
}

export function limiter(success = true) {
  return { limit: vi.fn(async () => ({ success })) };
}

export function fakeEnv(overrides: Record<string, unknown> = {}) {
  return {
    AI_LIMITER: limiter(),
    API_LIMITER: limiter(),
    AUTH_LIMITER: limiter(),
    GEMINI_API_KEY: "test-gemini-key",
    GEMINI_MODEL: "gemini-test",
    FATSECRET_CLIENT_ID: "fs-id",
    FATSECRET_CLIENT_SECRET: "fs-secret",
    PAYPAL_ENV: "sandbox",
    PAYPAL_CLIENT_ID: "pp-id",
    PAYPAL_SECRET: "pp-secret",
    ...overrides,
  } as any;
}

export function jsonRequest(body: unknown, user?: string, extraHeaders: Record<string, string> = {}): RequestInit {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...extraHeaders };
  if (user) headers[TEST_USER_HEADER] = user;
  return { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) };
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Minimal D1Database over node:sqlite with migrations applied.
export function createD1(migrations: string[]) {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of migrations) db.exec(readFileSync(new URL(`../../migrations/${file}`, import.meta.url), "utf8"));
  const prepare = (sql: string) => {
    const stmt = db.prepare(sql);
    const bound = (args: any[]) => ({
      bind: (...next: any[]) => bound(next),
      first: async () => (stmt.get(...args) as any) ?? null,
      all: async () => ({ results: stmt.all(...args), success: true, meta: {} }),
      run: async () => {
        const r = stmt.run(...args);
        return { success: true, meta: { changes: Number(r.changes) } };
      },
    });
    return bound([]);
  };
  return { d1: { prepare } as unknown as D1Database, raw: db };
}
