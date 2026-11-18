import { useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate, useParams, useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient.js";
import { BRAND } from "./theme/tokens.js";
import { ToastHost } from "./components/ui/Toast.jsx";
import { ConfirmHost } from "./components/ui/ConfirmDialog.jsx";
import { saveForgeCache, readForgeCache, flushSyncQueue } from "./lib/cache.js";
import { useSyncStatus, pendingClientSections, pendingClientPatch } from "./lib/sync.js";
import { SyncPill } from "./components/ui/SyncPill.jsx";
import { DENIS_EMAIL } from "./lib/constants.js";
import { ensureMobileViewport, useIsMobile } from "./lib/browser.js";
import { mapClient, paymentLockout } from "./lib/clientData.js";
import { AccountNotActiveScreen } from "./features/auth/AccountNotActiveScreen.jsx";
import { PaymentLockedScreen } from "./features/auth/PaymentLockedScreen.jsx";
import { ResetPasswordScreen } from "./features/auth/ResetPasswordScreen.jsx";
import { LoginScreen } from "./features/auth/LoginScreen.jsx";
import { CoachDashboard } from "./features/coach/CoachDashboard.jsx";
import { ClientView } from "./features/client-shell/ClientView.jsx";
/*
  FORGE V6.7 - Tablet Coach UI + Client Program Label Polish
  ------------------------------------------------
  What this version includes:
  - One clean login screen: "Welcome back"
  - Seamless trainer account creation
  - Forgot password via Supabase Auth
  - Coach dashboard: each trainer sees only their own clients
  - Denis keeps existing unassigned clients if logged in with kendenisdubai@gmail.com
  - Invite-based client access: coach creates profile first, client claims it with invite code
  - Client portal: food log, workout log, progress photos, profile view
  - Program builder restored to previous week/day style, with AI builder and recap
  - Program day has small X button to delete whole day
  - Trials split into Consultation and Fitness Assessment
  - Calendar has editable visible time slots and auto-scheduled recurring clients
  - AED currency and simple number time labels
  - Dead Hang added to exercise library and progress tracking
  - Fast resume from local cache instead of showing Forge loading every time
  - Offline-first client/program/nutrition/session saves with pending sync queue
  - Program session view shows Personal Best, Recent, and New entry area for each exercise
  - Metric Data returned to each program day: kcal, max HR, average HR
  - Client tabs are round pill tabs for a cleaner mobile feel
  - Program Templates: Men's Fat Loss, Female Fat Loss, Muscle Gain, Upper Lower, PPL
  - Use Template button applies a reusable program to any client, then you can edit it
  - V6.1: true phone-first client portal across Home, Nutrition, Program, Progress, Photos, Profile
  - V6.1: tablet-friendly coach dashboard with cleaner cards and compact layout
  - V6.1: fixed mobile viewport so the app does not render as a wide desktop page on phones
  - V6.5: smart custom food macro estimator for combined meals like chapati + chicken curry + rice
  - V6.5: spreadsheet-style calendar zoom slider with Fit Week view
*/
export default function App() {
  const isMobile = useIsMobile(520);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trainer, setTrainer] = useState(null);
  const [clients, setClients] = useState([]);
  const [clientPortal, setClientPortal] = useState(null);
  // Only flips true once we have positive confirmation this session belongs
  // to a coach (a trusted cached coach snapshot, or a completed loadCoach()
  // call) - the coach dashboard must never be the default/fallback view
  // while role is still being determined, only something explicitly earned.
  const [isCoachConfirmed, setIsCoachConfirmed] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [accountNotActive, setAccountNotActive] = useState(false);
  const sync = useSyncStatus();
  const syncStatus = sync.offline ? "offline" : sync.syncing || sync.pending ? "syncing" : "online";
  const recoveryModeRef = useRef(false);
  // Background refresh bookkeeping (see refreshFromServer below).
  const userRef = useRef(null);
  const refreshingRef = useRef(null);
  const lastRefreshRef = useRef(0);
  useEffect(() => {
    ensureMobileViewport();
    // Back online, or the app brought back to the front: push anything saved
    // offline, then quietly pull fresh data. The screen never blanks out -
    // new data just replaces what's shown when it arrives.
    const goOnline = () => { if (userRef.current) refreshFromServer(userRef.current); };
    const onVisible = () => {
      if (document.visibilityState === "visible" && userRef.current && Date.now() - lastRefreshRef.current > 60000) refreshFromServer(userRef.current);
    };
    window.addEventListener("online", goOnline);
    document.addEventListener("visibilitychange", onVisible);
    // Supabase's password-reset email can arrive as a PKCE "?code=" link (needs an explicit
    // exchange) or the older "#access_token=...&type=recovery" hash link. The "?code=" link
    // doesn't always carry a "type=recovery" param alongside it, so we treat the presence of
    // a bare "code" on the root landing page as a recovery link - this app has no other flow
    // that would legitimately land a stray code param here.
    const url = new URL(window.location.href);
    const hasRecoveryCode = !!url.searchParams.get("code");
    const hasRecoveryHash = window.location.hash.includes("type=recovery");
    if (hasRecoveryCode) {
      recoveryModeRef.current = true;
      setRecoveryMode(true);
      supabase.auth.exchangeCodeForSession(url.searchParams.get("code")).then(({ data }) => { if (data?.session) setSession(data.session); setLoading(false); });
    } else if (hasRecoveryHash) {
      recoveryModeRef.current = true;
      setRecoveryMode(true);
    } else {
      // Open straight from the login saved on this phone - no network wait.
      // Offline with an expired token, Supabase keeps retrying the refresh
      // (the app used to sit on the Forge logo); the token renews by itself
      // once there's signal, and a login that is truly revoked still signs
      // out through the SIGNED_OUT event below.
      const stored = storedSession();
      if (stored) { setSession(stored); boot(stored.user); }
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) { setSession(data.session); if (!stored) boot(data.session.user); }
        else if (!stored) setLoading(false);
      });
    }
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (_event === "PASSWORD_RECOVERY") { recoveryModeRef.current = true; setRecoveryMode(true); setLoading(false); return; }
      if (_event === "TOKEN_REFRESHED" || _event === "USER_UPDATED") return; // session stayed the same, just the token renewed - don't reload data mid-session
      if (recoveryModeRef.current) return; // don't auto-boot into the dashboard while someone is mid-way through setting a new password - use the ref, not the state, since this callback is created once and would otherwise see a permanently stale value
      if (sess) { if (userRef.current?.id === sess.user.id) return; boot(sess.user); }
      // Only a real sign-out clears the app. A failed token refresh while
      // offline also reports "no session" and must not log anyone out.
      else if (_event === "SIGNED_OUT") { userRef.current = null; setLoading(false); setTrainer(null); setClients([]); setClientPortal(null); setIsCoachConfirmed(false); }
    });
    return () => { window.removeEventListener("online", goOnline); document.removeEventListener("visibilitychange", onVisible); sub.subscription.unsubscribe(); };
  }, []);
  async function boot(user) {
    userRef.current = user;
    const cached = await readForgeCache(user.id);
    if (cached) {
      setTrainer(cached.trainer || null);
      setClients(cached.clients || []);
      setClientPortal(cached.clientPortal || null);
      // A cache is only ever saved after loadRole() has already resolved this
      // user's role once (see loadRole/loadCoach below) - so a cached
      // snapshot with a trainer and no clientPortal is a trustworthy signal
      // this is a coach, safe to show immediately. Absent that, stay
      // unconfirmed until the fresh loadRole() call below settles it -
      // never assume coach just because clientPortal happens to be empty.
      setIsCoachConfirmed(!!cached.trainer && !cached.clientPortal);
      setLoading(false);
    } else {
      setLoading(true);
    }
    await refreshFromServer(user);
    setLoading(false);
  }
  // Push pending saves, then fetch fresh data, merging anything still
  // waiting to upload on top so local work is never reverted. Runs at most
  // once at a time; failures (offline, weak signal) leave the on-device data
  // on screen and are retried on the next trigger.
  function refreshFromServer(user) {
    if (refreshingRef.current) return refreshingRef.current;
    refreshingRef.current = (async () => {
      try {
        await flushSyncQueue();
        await ensureTrainer(user).catch(() => {});
        await loadRole(user);
        lastRefreshRef.current = Date.now();
      } catch (error) {
        console.warn("Forge: background refresh failed (offline or weak signal)", error?.message || error);
      } finally {
        refreshingRef.current = null;
      }
    })();
    return refreshingRef.current;
  }
  async function ensureTrainer(user) {
    const email = user.email || "";
    if (email.toLowerCase() !== DENIS_EMAIL) return; // never auto-create a trainer row for anyone but the real coach - this is what a random login should NOT be able to grant itself
    const { data: existing } = await supabase.from("trainers").select("id").eq("id", user.id).maybeSingle();
    if (!existing) {
      const name = user.user_metadata?.name || email.split("@")[0] || "Coach";
      await supabase.from("trainers").insert({ id: user.id, email, name, role: "Coach" });
    } else {
      await supabase.from("trainers").update({ email }).eq("id", user.id);
    }
  }
  async function loadRole(user) {
    // Any failed request means "couldn't reach the server", never "this
    // account doesn't exist" - throwing keeps the on-device data on screen
    // instead of signing someone out on a bad signal.
    const first = await supabase.from("clients").select("*").eq("client_user_id", user.id).maybeSingle();
    if (first.error) throw first.error;
    let clientMatch = first.data;
    if (!clientMatch) {
      // Self-heal: an invite claim can silently fail to link client_user_id
      // if it ran before this session was actually authenticated (email
      // confirmation required, claim attempted right after signUp() before
      // the confirmation link was clicked - see the 20260901090000
      // migration). A real login always has an active session, so retry the
      // claim here by the account's own verified email every time no client
      // row is found yet, before concluding the account really is inactive.
      const { data: healed, error: healErr } = await supabase.rpc("claim_invite_by_email");
      if (healErr && !healErr.code) throw healErr; // network, not "no invite"
      if (healed?.length) {
        const retry = await supabase.from("clients").select("*").eq("client_user_id", user.id).maybeSingle();
        if (retry.error) throw retry.error;
        clientMatch = retry.data;
      }
    }
    if (clientMatch) {
      const { data: rows, error: rowsErr } = await supabase.from("client_data").select("*").eq("client_id", clientMatch.id);
      if (rowsErr) throw rowsErr;
      const mappedClient = mapClient(withPendingRow(clientMatch), withPendingSections(clientMatch.id, rows || []));
      setClientPortal(mappedClient);
      saveForgeCache(user.id, { trainer: null, clients: [], clientPortal: mappedClient });
      setClients([]);
      setIsCoachConfirmed(false);
      return;
    }
    const { data: trainerMatch, error: trainerErr } = await supabase.from("trainers").select("id").eq("id", user.id).maybeSingle();
    if (trainerErr) throw trainerErr;
    const isKnownCoach = !!trainerMatch || (user.email || "").toLowerCase() === DENIS_EMAIL;
    if (!isKnownCoach) {
      // Not an existing trainer, not the bootstrap coach email, and no client profile found (deleted, or never existed) - never fall through to the coach dashboard.
      await supabase.auth.signOut();
      setSession(null); setTrainer(null); setClients([]); setClientPortal(null);
      setIsCoachConfirmed(false);
      setAccountNotActive(true);
      setLoading(false);
      return;
    }
    await loadCoach(user);
  }
  async function loadCoach(user = session?.user) {
    if (!user) return;
    // Reaching this function at all - whether just now confirmed by loadRole()
    // above, or a plain refresh from an already-rendered coach dashboard -
    // means the role is settled as coach, so it's safe to render CoachRoutes.
    setIsCoachConfirmed(true);
    const { data: trainerRow, error: trainerRowErr } = await supabase.from("trainers").select("*").eq("id", user.id).maybeSingle();
    if (trainerRowErr) throw trainerRowErr;
    setTrainer(trainerRow || { id: user.id, name: user.email?.split("@")[0], email: user.email });
    if ((user.email || "").toLowerCase() === DENIS_EMAIL) {
      await supabase.from("clients").update({ trainer_id: user.id }).is("trainer_id", null);
    }
    const { data: clientRows, error } = await supabase.from("clients").select("*").eq("trainer_id", user.id).order("created_at", { ascending: false });
    if (error) throw error;
    const ids = (clientRows || []).map((c) => c.id);
    let dataRows = [];
    if (ids.length) {
      // Photos are fetched lazily per-client when their Photos tab is opened (see TransformPhotos) -
      // excluding them here is what keeps a 16-client sync fast instead of downloading every photo up front.
      const { data, error: dataErr } = await supabase.from("client_data").select("*").in("client_id", ids).neq("section", "transformPhotos");
      if (dataErr) throw dataErr;
      dataRows = data || [];
    }
    // Edits still waiting to upload are newer than what we just fetched -
    // lay them over the server data, section by section, so the coach's
    // other updates still come through and local work is never reverted.
    const mapped = (clientRows || []).map((r, i) => mapClient(withPendingRow(r), withPendingSections(r.id, dataRows), i));
    setClients(mapped);
    saveForgeCache(user.id, { trainer: trainerRow || { id: user.id, name: user.email?.split("@")[0], email: user.email }, clients: mapped, clientPortal: null });
  }
  function updateClient(updated) {
    const userId = session?.user?.id;
    setClients((prev) => {
      const next = prev.map((c) => c.id === updated.id ? updated : c);
      if (userId) saveForgeCache(userId, { trainer, clients: next, clientPortal: null });
      return next;
    });
    setClientPortal((p) => {
      const nextPortal = p?.id === updated.id ? updated : p;
      if (userId && nextPortal) saveForgeCache(userId, { trainer: null, clients: [], clientPortal: nextPortal });
      return nextPortal;
    });
  }
  const bootScreen = <div className="cinematic-bg" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><div style={{ textAlign: "center" }}><div style={{ fontFamily: BRAND.display, color: BRAND.gold, fontSize: isMobile ? 40 : 54, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1 }}>Forge</div></div></div>;
  return <>
    {accountNotActive ? <AccountNotActiveScreen onBackToLogin={() => setAccountNotActive(false)} />
    : recoveryMode ? <ResetPasswordScreen onDone={() => { recoveryModeRef.current = false; setRecoveryMode(false); }} />
    : loading ? bootScreen
    : !session ? <LoginScreen onReady={() => supabase.auth.getSession().then(({ data }) => data.session && boot(data.session.user))} />
    : clientPortal && paymentLockout(clientPortal).locked ? (
      <PaymentLockedScreen client={clientPortal} updateClient={updateClient} overdueDays={paymentLockout(clientPortal).overdueDays} />
    ) : clientPortal ? (
      <Routes>
        <Route path="/" element={<ClientPortalRoute clientPortal={clientPortal} updateClient={updateClient} refresh={() => boot(session.user)} />} />
        <Route path="/:tab" element={<ClientPortalRoute clientPortal={clientPortal} updateClient={updateClient} refresh={() => boot(session.user)} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    ) : isCoachConfirmed ? (
      <Routes>
        <Route path="/coach" element={<CoachDashboardRoute user={session.user} trainer={trainer} setTrainer={setTrainer} clients={clients} setClients={setClients} refresh={() => loadCoach(session.user)} syncStatus={syncStatus} />} />
        <Route path="/coach/:tab" element={<CoachDashboardRoute user={session.user} trainer={trainer} setTrainer={setTrainer} clients={clients} setClients={setClients} refresh={() => loadCoach(session.user)} syncStatus={syncStatus} />} />
        <Route path="/coach/clients/:clientId" element={<CoachClientRoute clients={clients} updateClient={updateClient} refresh={() => loadCoach(session.user)} />} />
        <Route path="/coach/clients/:clientId/:tab" element={<CoachClientRoute clients={clients} updateClient={updateClient} refresh={() => loadCoach(session.user)} />} />
        <Route path="*" element={<Navigate to="/coach" replace />} />
      </Routes>
    ) : (
      // Role not yet positively confirmed either way (mid loadRole() fetch,
      // no cache to fast-resume from) - never default to the coach dashboard
      // just because clientPortal happens to be empty at this instant.
      bootScreen
    )}
    {session && !loading && <SyncPill />}
    <ToastHost />
    <ConfirmHost />
  </>;
}

// Thin route adapters: they translate URL params <-> the tab/screen props
// that ClientView and CoachDashboard already accepted before routing
// existed (see the "optionally controlled" comments on those components),
// so neither of those components' own internals needed to change.
function ClientPortalRoute({ clientPortal, updateClient, refresh }) {
  const { tab } = useParams();
  const navigate = useNavigate();
  return <ClientView client={clientPortal} updateClient={updateClient} isCoach={false} refresh={refresh}
    tab={tab || "home"} setTab={(t) => navigate(t === "home" ? "/" : `/${t}`)} />;
}
function CoachDashboardRoute(props) {
  const { tab } = useParams();
  const navigate = useNavigate();
  return <CoachDashboard {...props} tab={tab || "home"} setTab={(t) => navigate(t === "home" ? "/coach" : `/coach/${t}`)}
    selectClient={(c) => navigate(`/coach/clients/${c.id}`)} />;
}
function CoachClientRoute({ clients, updateClient, refresh }) {
  const { clientId, tab } = useParams();
  const navigate = useNavigate();
  const client = clients.find((c) => c.id === clientId);
  if (!client) return <Navigate to="/coach/clients" replace />;
  return <ClientView client={client} updateClient={updateClient} isCoach refresh={refresh}
    back={() => navigate("/coach/clients")}
    tab={tab || "profile"} setTab={(t) => navigate(`/coach/clients/${clientId}/${t}`)} />;
}

// The saved Supabase login, read straight from the phone. Used only when
// Supabase can't confirm it because there's no signal.
function storedSession() {
  try {
    const raw = localStorage.getItem(supabase.auth.storageKey);
    const parsed = raw ? JSON.parse(raw) : null;
    const sess = parsed?.currentSession || parsed;
    return sess?.user?.id && sess.refresh_token ? sess : null;
  } catch {
    return null;
  }
}
function withPendingRow(row) {
  const patch = pendingClientPatch(row.id);
  return patch ? { ...row, ...patch } : row;
}
function withPendingSections(clientId, rows) {
  const pending = pendingClientSections(clientId);
  const extra = Object.entries(pending).map(([section, data]) => ({ client_id: clientId, section, data }));
  return extra.length ? [...rows, ...extra] : rows;
}
