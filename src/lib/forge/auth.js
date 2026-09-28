// supabase-js-shaped `auth` for Forge v2, backed by /api/auth on the Worker.
// The session token itself lives in an HttpOnly cookie; this module only
// keeps the session *payload* ({ user, expires_at, ... }) in memory and in
// localStorage so the app can boot offline exactly as it did on Supabase.
import { api } from "./http.js";

export const SESSION_CACHE_KEY = "forge_auth_session";
const SESSION_FETCH_TIMEOUT_MS = 6000;
const RECOVERY_TYPES = new Set(["recovery", "setup"]);
// Link types the shim consumes itself on page load (App.jsx treats every
// bare `?code=` as a password reset, which is right only for recovery/setup).
const SILENT_LINK_TYPES = new Set(["signup", "email_change"]);

let current = null; // last known session payload, or null
let verified = false; // true once `current` came from the server during this page load
let loading = null; // in-flight /session fetch
let exchangeInFlight = null; // in-flight code exchange (getSession waits for it)
let lastExchangeError = null;
let generation = 0; // bumped on every sign-in/out/exchange so stale /session replies are dropped
const listeners = new Map();
let nextListenerId = 1;

// ---- local cache ----------------------------------------------------------

function storage() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function isExpired(session) {
  return !session?.expires_at || session.expires_at * 1000 <= Date.now();
}

function readCachedSession() {
  try {
    const raw = storage()?.getItem(SESSION_CACHE_KEY);
    const session = raw ? JSON.parse(raw) : null;
    return session?.user && !isExpired(session) ? session : null;
  } catch {
    return null;
  }
}

function writeCachedSession(session) {
  try {
    if (session) storage()?.setItem(SESSION_CACHE_KEY, JSON.stringify(session));
    else storage()?.removeItem(SESSION_CACHE_KEY);
  } catch {
    /* storage full or blocked: memory copy still works */
  }
}

function setSession(session, fromServer = true) {
  generation += 1;
  current = session || null;
  verified = fromServer;
  writeCachedSession(current);
}

function emit(event, session) {
  for (const cb of [...listeners.values()]) {
    try {
      cb(event, session);
    } catch (e) {
      console.error("Forge auth listener failed", e);
    }
  }
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(
      () => resolve({ data: null, error: { message: "Network error - check your connection.", code: "network" } }),
      ms,
    );
  });
  return Promise.race([promise.finally(() => clearTimeout(timer)), timeout]);
}

// ---- session loading -------------------------------------------------------

async function fetchSession() {
  if (exchangeInFlight) await exchangeInFlight;
  if (verified && current && !isExpired(current)) return { session: current, error: null };
  const startedAt = generation;
  const { data, error } = await withTimeout(api("/api/auth/session"), SESSION_FETCH_TIMEOUT_MS);
  // A sign-in/out or link exchange finished while we waited: it is newer truth.
  if (startedAt !== generation) return { session: current, error: null };
  if (error) {
    // Offline, timed out or a server hiccup: keep the last known session
    // (never sign the user out because the network is down) and flag it.
    const fallback = current || readCachedSession();
    current = fallback;
    verified = false;
    return { session: fallback, error };
  }
  const session = data?.session ?? null;
  const wasSignedIn = !!current;
  setSession(session);
  if (wasSignedIn && !session) emit("SIGNED_OUT", null); // revoked or expired server-side
  return { session, error: null };
}

function ensureLoaded() {
  if (!loading) loading = fetchSession().finally(() => { loading = null; });
  return loading;
}

// ---- supabase-js surface ---------------------------------------------------

async function getSession() {
  const { session, error } = await ensureLoaded();
  return { data: { session }, error };
}

async function getUser() {
  const { session, error } = await ensureLoaded();
  return { data: { user: session?.user ?? null }, error };
}

function onAuthStateChange(callback) {
  const id = nextListenerId++;
  listeners.set(id, callback);
  // Like supabase-js: every new subscriber gets INITIAL_SESSION asynchronously.
  ensureLoaded().then(({ session }) => {
    if (listeners.get(id) === callback) {
      try {
        callback("INITIAL_SESSION", session);
      } catch (e) {
        console.error("Forge auth listener failed", e);
      }
    }
  });
  return { data: { subscription: { id, callback, unsubscribe: () => listeners.delete(id) } } };
}

async function signUp({ email, password, options } = {}) {
  const { data, error } = await api("/api/auth/signup", {
    method: "POST",
    body: { email, password, data: options?.data ?? {} },
  });
  if (error) return { data: { user: null, session: null }, error };
  return { data: { user: data?.user ?? null, session: null }, error: null };
}

async function signInWithPassword({ email, password } = {}) {
  const { data, error } = await api("/api/auth/login", { method: "POST", body: { email, password } });
  if (error) return { data: { user: null, session: null }, error };
  setSession(data.session);
  emit("SIGNED_IN", current);
  return { data: { user: data.user, session: data.session }, error: null };
}

async function signOut() {
  const { error } = await api("/api/auth/logout", { method: "POST", body: {} });
  // Sign out locally even if the request failed (offline): the app must not
  // keep showing a signed-in UI after the user asked to leave.
  setSession(null);
  emit("SIGNED_OUT", null);
  return { error: error ?? null };
}

async function resetPasswordForEmail(email, { redirectTo } = {}) {
  const { error } = await api("/api/auth/recover", { method: "POST", body: { email, redirectTo } });
  return { data: error ? null : {}, error: error ?? null };
}

async function updateUser(attributes = {}) {
  const { data, error } = await api("/api/auth/user", { method: "PUT", body: attributes });
  if (error) {
    // Arrived from an expired/used reset link: say so rather than "Not signed in".
    if (error.status === 401 && lastExchangeError) return { data: { user: null }, error: lastExchangeError };
    return { data: { user: null }, error };
  }
  if (current) setSession({ ...current, user: data.user });
  emit("USER_UPDATED", current);
  return { data: { user: data.user }, error: null };
}

function exchangeCodeForSession(code) {
  const run = (async () => {
    const { data, error } = await api("/api/auth/exchange", { method: "POST", body: { code } });
    if (error) {
      lastExchangeError = error;
      return { data: { session: null, user: null }, error };
    }
    lastExchangeError = null;
    setSession(data.session);
    emit(RECOVERY_TYPES.has(data.type) ? "PASSWORD_RECOVERY" : "SIGNED_IN", current);
    return { data: { session: data.session, user: data.user, redirectType: data.type }, error: null };
  })();
  exchangeInFlight = run.finally(() => { exchangeInFlight = null; });
  return run;
}

/**
 * Email-verification and email-change links (`/?code=..&type=signup|email_change`)
 * are consumed here on page load and stripped from the URL before App.jsx
 * looks at it, so they sign the user in instead of opening the reset screen.
 */
export function consumeLinkFromUrl(win = typeof window === "undefined" ? null : window) {
  if (!win?.location?.href) return null;
  const url = new URL(win.location.href);
  const code = url.searchParams.get("code");
  if (!code || !SILENT_LINK_TYPES.has(url.searchParams.get("type"))) return null;
  url.searchParams.delete("code");
  url.searchParams.delete("type");
  try {
    win.history?.replaceState(win.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* ignore */
  }
  return exchangeCodeForSession(code);
}

/** Test helper: forget all in-memory state. */
export function _resetAuthState() {
  current = null;
  verified = false;
  loading = null;
  exchangeInFlight = null;
  lastExchangeError = null;
  generation = 0;
  listeners.clear();
}

export const auth = {
  getSession,
  getUser,
  onAuthStateChange,
  signUp,
  signInWithPassword,
  signOut,
  resetPasswordForEmail,
  updateUser,
  exchangeCodeForSession,
};

consumeLinkFromUrl();
