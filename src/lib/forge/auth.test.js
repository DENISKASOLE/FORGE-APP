import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_CACHE_KEY, _resetAuthState, auth, consumeLinkFromUrl } from "./auth.js";

const USER = { id: "u1", email: "a@example.com", email_verified: true, user_metadata: { name: "A" } };
const future = () => Math.floor(Date.now() / 1000) + 3600;
const SESSION = () => ({ user: USER, expires_at: future(), expires_in: 3600, token_type: "cookie" });

let routes;
let calls;

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  _resetAuthState();
  routes = {};
  calls = [];
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("fetch", async (path, init = {}) => {
    const key = `${init.method || "GET"} ${path}`;
    calls.push({ key, body: init.body ? JSON.parse(init.body) : undefined, init });
    const handler = routes[key];
    if (!handler) throw new TypeError("Failed to fetch");
    return handler(init);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("getSession / getUser", () => {
  it("returns the server session in supabase shape and caches it", async () => {
    const s = SESSION();
    routes["GET /api/auth/session"] = () => json(200, { data: { session: s } });
    const res = await auth.getSession();
    expect(res).toEqual({ data: { session: s }, error: null });
    expect(JSON.parse(localStorage.getItem(SESSION_CACHE_KEY))).toEqual(s);
    expect(calls[0].init.credentials).toBe("same-origin");
    expect(await auth.getUser()).toEqual({ data: { user: USER }, error: null });
  });

  it("returns session: null and clears the cache when signed out", async () => {
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(SESSION()));
    routes["GET /api/auth/session"] = () => json(200, { data: { session: null } });
    expect(await auth.getSession()).toEqual({ data: { session: null }, error: null });
    expect(localStorage.getItem(SESSION_CACHE_KEY)).toBeNull();
  });

  it("falls back to the cached session when offline, flagging the network error", async () => {
    const s = SESSION();
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(s));
    const res = await auth.getSession(); // no route: fetch rejects like a dropped connection
    expect(res.data.session).toEqual(s);
    expect(res.error.code).toBe("network");
    expect(localStorage.getItem(SESSION_CACHE_KEY)).not.toBeNull(); // not signed out
  });

  it("ignores an expired cached session when offline", async () => {
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({ ...SESSION(), expires_at: 1 }));
    expect((await auth.getSession()).data.session).toBeNull();
  });

  it("falls back to the cache on a server error too", async () => {
    const s = SESSION();
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(s));
    routes["GET /api/auth/session"] = () => json(500, { error: { message: "boom", code: "internal" } });
    const res = await auth.getSession();
    expect(res.data.session).toEqual(s);
    expect(res.error.code).toBe("internal");
  });
});

describe("onAuthStateChange", () => {
  it("returns a supabase-style subscription and fires INITIAL_SESSION", async () => {
    const s = SESSION();
    routes["GET /api/auth/session"] = () => json(200, { data: { session: s } });
    const events = [];
    const { data } = auth.onAuthStateChange((event, session) => events.push([event, session]));
    expect(typeof data.subscription.unsubscribe).toBe("function");
    await flush();
    await flush();
    expect(events).toEqual([["INITIAL_SESSION", s]]);
  });

  it("stops delivering events after unsubscribe", async () => {
    routes["GET /api/auth/session"] = () => json(200, { data: { session: null } });
    routes["POST /api/auth/logout"] = () => json(200, { data: {} });
    const events = [];
    const { data } = auth.onAuthStateChange((event) => events.push(event));
    await flush();
    await flush();
    data.subscription.unsubscribe();
    await auth.signOut();
    expect(events).toEqual(["INITIAL_SESSION"]);
  });
});

describe("sign in / up / out", () => {
  it("signInWithPassword returns { user, session } and emits SIGNED_IN", async () => {
    const s = SESSION();
    routes["POST /api/auth/login"] = () => json(200, { data: { user: USER, session: s } });
    const events = [];
    auth.onAuthStateChange((e) => events.push(e));
    const res = await auth.signInWithPassword({ email: "a@example.com", password: "password123" });
    expect(res).toEqual({ data: { user: USER, session: s }, error: null });
    expect(calls.at(-1).body).toEqual({ email: "a@example.com", password: "password123" });
    expect(events).toContain("SIGNED_IN");
    await flush();
    const before = calls.length;
    expect((await auth.getSession()).data.session).toEqual(s); // no extra /session fetch needed
    expect(calls.length).toBe(before);
  });

  it("a slow /session reply that lands after sign-in does not undo it", async () => {
    const s = SESSION();
    let release;
    routes["GET /api/auth/session"] = () => new Promise((r) => { release = () => r(json(200, { data: { session: null } })); });
    routes["POST /api/auth/login"] = () => json(200, { data: { user: USER, session: s } });
    const events = [];
    auth.onAuthStateChange((e) => events.push(e));
    const pending = auth.getSession();
    await auth.signInWithPassword({ email: "a@example.com", password: "password123" });
    release();
    await pending;
    expect((await auth.getSession()).data.session).toEqual(s);
    expect(events).not.toContain("SIGNED_OUT");
  });

  it("signInWithPassword surfaces the server error message", async () => {
    routes["POST /api/auth/login"] = () => json(400, { error: { message: "Invalid email or password.", code: "invalid_credentials" } });
    const res = await auth.signInWithPassword({ email: "a@example.com", password: "x" });
    expect(res.data).toEqual({ user: null, session: null });
    expect(res.error).toMatchObject({ message: "Invalid email or password.", code: "invalid_credentials", status: 400 });
  });

  it("signUp forwards options.data and returns session: null", async () => {
    routes["POST /api/auth/signup"] = () => json(200, { data: { user: USER, session: null } });
    const res = await auth.signUp({ email: "a@example.com", password: "password123", options: { data: { name: "A", role: "client" } } });
    expect(res).toEqual({ data: { user: USER, session: null }, error: null });
    expect(calls[0].body).toEqual({ email: "a@example.com", password: "password123", data: { name: "A", role: "client" } });
  });

  it("signOut clears the cache and emits SIGNED_OUT even when offline", async () => {
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(SESSION()));
    const events = [];
    auth.onAuthStateChange((e, s) => events.push([e, s]));
    const res = await auth.signOut();
    expect(res.error.code).toBe("network");
    expect(localStorage.getItem(SESSION_CACHE_KEY)).toBeNull();
    expect(events).toContainEqual(["SIGNED_OUT", null]);
  });

  it("resetPasswordForEmail posts email + redirectTo and returns { data, error }", async () => {
    routes["POST /api/auth/recover"] = () => json(200, { data: {} });
    const res = await auth.resetPasswordForEmail("a@example.com", { redirectTo: "https://x.example/" });
    expect(res).toEqual({ data: {}, error: null });
    expect(calls[0].body).toEqual({ email: "a@example.com", redirectTo: "https://x.example/" });
  });
});

describe("links and account updates", () => {
  it("exchangeCodeForSession for a recovery/setup link emits PASSWORD_RECOVERY", async () => {
    const s = SESSION();
    routes["POST /api/auth/exchange"] = () => json(200, { data: { session: s, user: USER, type: "setup" } });
    const events = [];
    auth.onAuthStateChange((e) => events.push(e));
    const res = await auth.exchangeCodeForSession("code123");
    expect(res).toEqual({ data: { session: s, user: USER, redirectType: "setup" }, error: null });
    expect(events).toContain("PASSWORD_RECOVERY");
    expect(events).not.toContain("SIGNED_IN");
  });

  it("getSession waits for an in-flight exchange instead of racing it", async () => {
    const s = SESSION();
    routes["POST /api/auth/exchange"] = () => json(200, { data: { session: s, user: USER, type: "recovery" } });
    routes["GET /api/auth/session"] = () => json(200, { data: { session: null } });
    const exchange = auth.exchangeCodeForSession("code123");
    const got = await auth.getSession();
    await exchange;
    expect(got.data.session).toEqual(s);
  });

  it("updateUser returns { user } and emits USER_UPDATED", async () => {
    routes["POST /api/auth/login"] = () => json(200, { data: { user: USER, session: SESSION() } });
    await auth.signInWithPassword({ email: "a@example.com", password: "password123" });
    const updated = { ...USER, user_metadata: { name: "B" } };
    routes["PUT /api/auth/user"] = () => json(200, { data: { user: updated } });
    const events = [];
    auth.onAuthStateChange((e) => events.push(e));
    const res = await auth.updateUser({ data: { name: "B" } });
    expect(res).toEqual({ data: { user: updated }, error: null });
    expect(events).toContain("USER_UPDATED");
    expect(JSON.parse(localStorage.getItem(SESSION_CACHE_KEY)).user.user_metadata.name).toBe("B");
  });

  it("updateUser after a failed link exchange explains the link expired", async () => {
    routes["POST /api/auth/exchange"] = () => json(400, { error: { message: "This link is invalid or has expired.", code: "invalid_code" } });
    routes["PUT /api/auth/user"] = () => json(401, { error: { message: "Not signed in", code: "unauthorized" } });
    const ex = await auth.exchangeCodeForSession("bad");
    expect(ex.data).toEqual({ session: null, user: null });
    const res = await auth.updateUser({ password: "password123" });
    expect(res.error.message).toMatch(/expired/);
  });

  it("consumeLinkFromUrl handles verify/email-change links and leaves recovery links to App.jsx", async () => {
    routes["POST /api/auth/exchange"] = () => json(200, { data: { session: SESSION(), user: USER, type: "verify" } });
    const replaceState = vi.fn();
    const win = (href) => ({ location: { href }, history: { state: null, replaceState } });

    expect(consumeLinkFromUrl(win("https://app.example/?code=abc&type=recovery"))).toBeNull();
    expect(consumeLinkFromUrl(win("https://app.example/?code=abc"))).toBeNull();
    expect(consumeLinkFromUrl(win("https://app.example/"))).toBeNull();

    const pending = consumeLinkFromUrl(win("https://app.example/?code=abc&type=signup&keep=1"));
    expect(replaceState).toHaveBeenCalledWith(null, "", "/?keep=1");
    expect((await pending).data.session.user).toEqual(USER);
    expect(calls.at(-1).body).toEqual({ code: "abc" });
    expect((await auth.getSession()).data.session.user).toEqual(USER);
  });
});
