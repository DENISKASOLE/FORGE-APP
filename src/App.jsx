import { useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate, useParams, useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient.js";
import { BRAND, GLOBAL_TEXT_CSS } from "./theme/tokens.js";
import { ToastHost } from "./components/ui/Toast.jsx";
import { ConfirmHost } from "./components/ui/ConfirmDialog.jsx";
import { FORGE_SYNC_QUEUE_KEY, readJson, saveForgeCache, readForgeCache, flushSyncQueue } from "./lib/cache.js";
import { DENIS_EMAIL } from "./lib/constants.js";
import { ensureMobileViewport, useIsMobile } from "./lib/browser.js";
import { mapClient } from "./lib/clientData.js";
import { AccountNotActiveScreen } from "./features/auth/AccountNotActiveScreen.jsx";
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
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [accountNotActive, setAccountNotActive] = useState(false);
  const [syncStatus, setSyncStatus] = useState(typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline");
  const recoveryModeRef = useRef(false);
  useEffect(() => {
    ensureMobileViewport();
    const goOnline = async () => { setSyncStatus("syncing"); await flushSyncQueue(); setSyncStatus("online"); };
    const goOffline = () => setSyncStatus("offline");
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const retryTimer = setInterval(async () => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        const queued = readJson(FORGE_SYNC_QUEUE_KEY, []);
        if (queued.length) await flushSyncQueue();
      }
    }, 20000);
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
      supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (data.session) boot(data.session.user); else setLoading(false); });
    }
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (_event === "PASSWORD_RECOVERY") { recoveryModeRef.current = true; setRecoveryMode(true); setLoading(false); return; }
      if (_event === "TOKEN_REFRESHED" || _event === "USER_UPDATED") return; // session stayed the same, just the token renewed - don't reload data mid-session
      if (recoveryModeRef.current) return; // don't auto-boot into the dashboard while someone is mid-way through setting a new password - use the ref, not the state, since this callback is created once and would otherwise see a permanently stale value
      if (sess) boot(sess.user);
      else { setLoading(false); setTrainer(null); setClients([]); setClientPortal(null); }
    });
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); clearInterval(retryTimer); sub.subscription.unsubscribe(); };
  }, []);
  async function boot(user) {
    const cached = readForgeCache(user.id);
    if (cached) {
      setTrainer(cached.trainer || null);
      setClients(cached.clients || []);
      setClientPortal(cached.clientPortal || null);
      setLoading(false);
    } else {
      setLoading(true);
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSyncStatus("offline");
      setLoading(false);
      return;
    }
    setSyncStatus("syncing");
    await flushSyncQueue();
    await ensureTrainer(user);
    await loadRole(user);
    setSyncStatus("online");
    setLoading(false);
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
    const { data: clientMatch } = await supabase.from("clients").select("*").eq("client_user_id", user.id).maybeSingle();
    if (clientMatch) {
      const { data: rows } = await supabase.from("client_data").select("*").eq("client_id", clientMatch.id);
      const mappedClient = mapClient(clientMatch, rows || []);
      const hasPendingEdits = readJson(FORGE_SYNC_QUEUE_KEY, []).some((item) => item.clientId === clientMatch.id);
      setClientPortal((prev) => {
        const next = hasPendingEdits && prev?.id === mappedClient.id ? prev : mappedClient;
        saveForgeCache(user.id, { trainer: null, clients: [], clientPortal: next });
        return next;
      });
      setClients([]);
      return;
    }
    const { data: trainerMatch } = await supabase.from("trainers").select("id").eq("id", user.id).maybeSingle();
    const isKnownCoach = !!trainerMatch || (user.email || "").toLowerCase() === DENIS_EMAIL;
    if (!isKnownCoach) {
      // Not an existing trainer, not the bootstrap coach email, and no client profile found (deleted, or never existed) - never fall through to the coach dashboard.
      await supabase.auth.signOut();
      setSession(null); setTrainer(null); setClients([]); setClientPortal(null);
      setAccountNotActive(true);
      setLoading(false);
      return;
    }
    await loadCoach(user);
  }
  async function loadCoach(user = session?.user) {
    if (!user) return;
    const { data: trainerRow } = await supabase.from("trainers").select("*").eq("id", user.id).maybeSingle();
    setTrainer(trainerRow || { id: user.id, name: user.email?.split("@")[0], email: user.email });
    if ((user.email || "").toLowerCase() === DENIS_EMAIL) {
      await supabase.from("clients").update({ trainer_id: user.id }).is("trainer_id", null);
    }
    const { data: clientRows, error } = await supabase.from("clients").select("*").eq("trainer_id", user.id).order("created_at", { ascending: false });
    if (error) { console.error(error); return; }
    const ids = (clientRows || []).map((c) => c.id);
    let dataRows = [];
    if (ids.length) {
      // Photos are fetched lazily per-client when their Photos tab is opened (see TransformPhotos) -
      // excluding them here is what keeps a 16-client sync fast instead of downloading every photo up front.
      const { data } = await supabase.from("client_data").select("*").in("client_id", ids).neq("section", "transformPhotos");
      dataRows = data || [];
    }
    const mapped = (clientRows || []).map((r, i) => mapClient(r, dataRows, i));
    const pendingIds = new Set(readJson(FORGE_SYNC_QUEUE_KEY, []).map((item) => item.clientId).filter(Boolean));
    setClients((prev) => {
      const prevById = new Map(prev.map((c) => [c.id, c]));
      // A client with edits still waiting to sync is newer than what we just fetched - keep the local version so we never silently revert unsaved work.
      return mapped.map((c) => (pendingIds.has(c.id) && prevById.has(c.id) ? prevById.get(c.id) : c));
    });
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
  return <>
    <style>{GLOBAL_TEXT_CSS}</style>
    <ToastHost />
    <ConfirmHost />
    {accountNotActive ? <AccountNotActiveScreen onBackToLogin={() => setAccountNotActive(false)} />
    : recoveryMode ? <ResetPasswordScreen onDone={() => { recoveryModeRef.current = false; setRecoveryMode(false); }} />
    : loading ? <div style={{ minHeight: "100vh", background: BRAND.bg, display: "grid", placeItems: "center" }}><div style={{ textAlign: "center" }}><div style={{ color: BRAND.gold, fontSize: isMobile ? 40 : 54, fontWeight: 900, letterSpacing: 1, lineHeight: 1 }}>FORGE</div></div></div>
    : !session ? <LoginScreen onReady={() => supabase.auth.getSession().then(({ data }) => data.session && boot(data.session.user))} />
    : clientPortal ? (
      <Routes>
        <Route path="/" element={<ClientPortalRoute clientPortal={clientPortal} updateClient={updateClient} refresh={() => boot(session.user)} />} />
        <Route path="/:tab" element={<ClientPortalRoute clientPortal={clientPortal} updateClient={updateClient} refresh={() => boot(session.user)} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    ) : (
      <Routes>
        <Route path="/coach" element={<CoachDashboardRoute user={session.user} trainer={trainer} setTrainer={setTrainer} clients={clients} setClients={setClients} refresh={() => loadCoach(session.user)} syncStatus={syncStatus} />} />
        <Route path="/coach/:tab" element={<CoachDashboardRoute user={session.user} trainer={trainer} setTrainer={setTrainer} clients={clients} setClients={setClients} refresh={() => loadCoach(session.user)} syncStatus={syncStatus} />} />
        <Route path="/coach/clients/:clientId" element={<CoachClientRoute clients={clients} updateClient={updateClient} refresh={() => loadCoach(session.user)} />} />
        <Route path="/coach/clients/:clientId/:tab" element={<CoachClientRoute clients={clients} updateClient={updateClient} refresh={() => loadCoach(session.user)} />} />
        <Route path="*" element={<Navigate to="/coach" replace />} />
      </Routes>
    )}
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
