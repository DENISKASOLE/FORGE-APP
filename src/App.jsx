import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { BRAND, GLOBAL_TEXT_CSS } from "./theme/tokens.js";
import { Button } from "./components/ui/Button.jsx";
import { Card } from "./components/ui/Card.jsx";
import { Field, inputStyle, textareaStyle } from "./components/ui/Field.jsx";
import { modalBackdrop } from "./components/ui/modal.js";
import { NavIcon } from "./components/ui/NavIcon.jsx";
import { CoachIcon } from "./components/ui/CoachIcon.jsx";
import { uid } from "./lib/uid.js";
import { DAYS, startOfWeek, addDays, isoDate, weekKey, weekRangeLabel, weekDays } from "./lib/dateUtils.js";
import { FORGE_SYNC_QUEUE_KEY, readJson, writeJson, saveForgeCache, readForgeCache, enqueueSync, flushSyncQueue, updateClientRow } from "./lib/cache.js";
import { DENIS_EMAIL, DEFAULT_TIME_SLOTS, RPE_OPTIONS, PHOTO_TYPES, WATER_LITERS, SLEEP_HOURS, MEASUREMENT_FIELDS, TIMED_EXERCISES, GOAL_OPTIONS, CLIENT_TYPES, DEFAULT_CHECKIN_QUESTIONS, CLIENT_COLORS, LIFT_FIELDS, DEFAULT_INTAKE_QUESTIONS } from "./lib/constants.js";
import { isTimedExercise, readFileAsDataUrl, ensureMobileViewport, useIsMobile, normalizeSlotLabel, timeKey, normalizeSlots } from "./lib/browser.js";
import { ageFromBirthday, daysUntil, nextBirthdayDaysAway, daysSince, initials, getClientColor, normalizeGoals, normalizeInjuries, timeLabel, moneyAED, paymentStatus, makeInviteCode, emptyProfile, mapClient, upsertSection, upsertTrainerData, loadTrainerTemplates, safeSelect } from "./lib/clientData.js";
import { buildPdfDoc, downloadBlob, sharePdfBlob, safeFilename } from "./lib/pdf.js";
import { AccountNotActiveScreen } from "./features/auth/AccountNotActiveScreen.jsx";
import { ResetPasswordScreen } from "./features/auth/ResetPasswordScreen.jsx";
import { LoginScreen } from "./features/auth/LoginScreen.jsx";
import { CheckInsTab } from "./features/checkin/CheckInsTab.jsx";
import { Mini } from "./components/ui/Mini.jsx";
import { MessagesTab } from "./features/messages/MessagesTab.jsx";
import { ScheduleTab, InviteTab } from "./features/scheduling/ScheduleTab.jsx";
import { PackagesTab } from "./features/scheduling/PackagesTab.jsx";
import { PaymentsTab } from "./features/payments/PaymentsTab.jsx";
import { CoachContentScreen, LearnTab, HomeLearnStrip } from "./features/learn/LearnTab.jsx";
import { ProfileTab } from "./features/profile/ProfileTab.jsx";
import { IntakeForm, INTAKE_FORM } from "./features/profile/IntakeForm.jsx";
import { fmtLoad, fmtSetTarget, fmtExerciseSummary, blockTitle, exerciseTag, parseSeconds, fmtClock, emptyTrainingLogs, startSession, sessionForWorkout, upsertSessionInLogs, setScoreV2, fmtLoggedSet, suggestProgression, lastSessionSetsFor, exerciseHistoryV2, sessionStatsV2, detectSessionPBs } from "./lib/trainingLogs.js";
import { ProgressHub, ProgressTab, clampPercent, overallAdherence, recentPBsAcrossHistory } from "./features/progress/ProgressTab.jsx";
import { TransformPhotos } from "./features/progress/TransformPhotos.jsx";
import { getVideoThumb, DEFAULT_EXERCISE_VIDEOS } from "./lib/exerciseVideos.js";
import { VideoPlayerModal } from "./components/ui/VideoPlayerModal.jsx";
import { ExerciseLibraryScreen, ProgramBuilder, ProgramTab } from "./features/train/TrainScreens.jsx";
import { buildProgramDays } from "./lib/programModel.js";
import { InjuryBanner } from "./components/ui/InjuryBanner.jsx";
import { ClientWorkoutLog } from "./features/scheduling/ClientWorkoutLog.jsx";
import { Calendar } from "./features/coach/Calendar.jsx";
import { Trials } from "./features/coach/Trials.jsx";
import { countTodaysCalendarSessions } from "./features/coach/coachHelpers.js";
import { NutritionFlow } from "./features/nutrition/NutritionFlow.jsx";
import { ScreeningGate } from "./features/screening/ScreeningGate.jsx";
import { ScheduledView, ClientCard, CLIENT_BOTTOM_NAV, ClientBottomNav, HubScreen, ClientAvatar, ClientSettingsModal } from "./features/client-shell/ClientShellUI.jsx";
import { CoachDashboard } from "./features/coach/CoachDashboard.jsx";
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
function ClientView({ client, updateClient, back, refresh, isCoach = true }) {
  const [tab, setTab] = useState(isCoach ? "profile" : "home");
  const [showSettings, setShowSettings] = useState(false);
  const isMobile = useIsMobile(520);
  const isOnline = client.clientType === "Online";
  const tabs = isCoach ? [
    ["profile", "Profile"], ["program", "Program"], ["nutrition", "Nutrition"], ["progress", "Progress"], ["photos", "Photos"],
    isOnline ? ["checkins", "Check-ins"] : ["schedule", "Schedule"],
    isOnline ? ["payments", "Payments"] : ["packages", "Packages"],
    ["messages", "Messages"], ["invite", "Invite"],
  ] : [
    ["home", "Home"], ["nutrition", "Nutrition"], ["program", "Program"], ["progress", "Progress"], ["photos", "Photos"],
    ...(isOnline ? [["checkins", "Check-ins"], ["payments", "Payments"]] : []),
    ["messages", "Messages"], ["profile", "Profile"],
  ];
  async function delClient() {
    if (!confirm(`Delete ${client.name}? This cannot be undone.`)) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) { alert("You're offline. Deleting a client needs an internet connection - please try again once you're back online."); return; }
    await supabase.from("client_data").delete().eq("client_id", client.id);
    await supabase.from("clients").delete().eq("id", client.id);
    back(); refresh();
  }
  // ---- content block shared by both coach (tab bar) and client (bottom nav) ----
  const content = <>
    {tab === "home" && <ClientHome client={client} goTo={!isCoach ? setTab : undefined} />}
    {tab === "profile" && <ProfileTab client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "program" && (isCoach
      ? <ProgramTab client={client} updateClient={updateClient} isCoach={isCoach} />
      : <ScreeningGate client={client}><ProgramTab client={client} updateClient={updateClient} isCoach={isCoach} /></ScreeningGate>)}
    {tab === "nutrition" && <NutritionFlow client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "progress" && <ProgressTab client={client} />}
    {tab === "progress_hub" && <ProgressHub client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "photos" && <TransformPhotos client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "schedule" && <ScheduleTab client={client} updateClient={updateClient} />}
    {tab === "packages" && <PackagesTab client={client} updateClient={updateClient} />}
    {tab === "checkins" && <CheckInsTab client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "learn" && <LearnTab client={client} />}
    {tab === "intake" && <IntakeForm client={client} updateClient={updateClient} goTo={setTab} />}
    {tab === "payments" && <PaymentsTab client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "invite" && <InviteTab client={client} updateClient={updateClient} />}
    {tab === "workouts" && <ClientWorkoutLog client={client} updateClient={updateClient} />}
  </>;

  // ---- COACH: unchanged horizontal tab bar, full tablet layout ----
  if (isCoach) {
    return (
      <div style={{ minHeight: "100vh", width: "100%", maxWidth: "100vw", overflowX: "hidden", background: BRAND.bg, color: BRAND.text }}>
        <header style={{ borderBottom: `1px solid ${BRAND.line}`, padding: isMobile ? "8px 10px" : 14, display: "flex", gap: 9, alignItems: "center", position: "sticky", top: 0, background: "rgba(7,7,7,.96)", backdropFilter: "blur(16px)", zIndex: 80, maxWidth: "100vw", overflow: "hidden" }}>
          <Button variant="ghost" onClick={back} style={{ padding: isMobile ? "8px 10px" : undefined }}>Back</Button>
          <ClientAvatar client={client} size={isMobile ? 44 : 56} />
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: isMobile ? 20 : 25, fontWeight: 1000, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client.name}</div><div style={{ color: client.color, fontWeight: 1000, fontSize: 12 }}>{client.goals?.join(" + ") || client.goal}</div></div>
          <Button variant="red" onClick={delClient} style={{ padding: isMobile ? "8px 10px" : undefined }}>Delete</Button>
        </header>
        <InjuryBanner client={client} />
        <main style={{ width: "100%", maxWidth: isMobile ? 430 : 960, margin: "0 auto", padding: isMobile ? "6px 8px 12px" : 16, boxSizing: "border-box", overflowX: "hidden" }}>
          <div style={{
            display: "flex",
            gap: isMobile ? 6 : 8,
            overflowX: "auto",
            marginBottom: isMobile ? 8 : 14,
            padding: isMobile ? "2px 0 6px" : "0 0 6px",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
          }}>
            {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{
              minWidth: isMobile ? 64 : 96,
              height: isMobile ? 34 : 48,
              borderRadius: 999,
              border: `1px solid ${tab === k ? client.color : BRAND.line}`,
              background: tab === k ? client.color : BRAND.card2,
              color: tab === k ? "#000" : BRAND.text,
              fontSize: isMobile ? 11 : 14,
              fontWeight: 1000,
              whiteSpace: "nowrap",
              cursor: "pointer",
              flex: "0 0 auto",
              boxShadow: "none",
            }}>{l}</button>)}
          </div>
          {content}
        </main>
      </div>
    );
  }

  // ---- CLIENT: bottom nav (Home / Nutrition / Train / Me) with hub screens, full-bleed content, no top bar ----
  const parentHub = ["payments", "profile"].includes(tab) ? "me_hub" : null;
  const parentHubLabel = "Me";
  const unreadMessages = (client.messages || []).filter((m) => m.from === "coach" && !m.read).length;
  const trainCards = [
    { key: "program", icon: "program", color: BRAND.gold, title: "Program", sub: client.program?.name ? `${client.program.name} · Week ${client.program.weeks?.[0]?.weekNum || 1}` : "No program yet" },
    { key: "progress", icon: "progress", color: BRAND.cyan, title: "Progress", sub: "See your trends and personal bests" },
    { key: "photos", icon: "photo", color: BRAND.purple, title: "Photos", sub: client.transformPhotos?.length ? `${client.transformPhotos.length} photo${client.transformPhotos.length === 1 ? "" : "s"} saved` : "No photos yet" },
  ];
  const meCards = [
    ...(isCoach ? [] : [{ key: "whatsapp", icon: "me", color: BRAND.green, title: "Message your coach", sub: "Opens WhatsApp" }]),
    { key: "profile", icon: "gear", color: BRAND.purple, title: "Profile", sub: "Your details & settings" },
    { key: "payments", icon: "card", color: BRAND.green, title: "Payments", sub: paymentStatus(client).label },
    { key: "settings", icon: "gear", color: BRAND.dim, title: "Settings", sub: "Change password & log out" },
  ];
  function handleMeOpen(key) { if (key === "settings") setShowSettings(true); else if (key === "whatsapp") window.open("https://wa.me/971567088638", "_blank"); else setTab(key); }
  return (
    <div style={{ minHeight: "100vh", width: "100%", maxWidth: "100vw", overflowX: "hidden", background: BRAND.bg, color: BRAND.text, paddingBottom: 90 }}>
      <main style={{ width: "100%", maxWidth: isMobile ? 430 : 760, margin: "0 auto", padding: isMobile ? "14px 10px 0" : "18px 16px 0", boxSizing: "border-box", overflowX: "hidden" }}>
        {parentHub && (
          <button onClick={() => setTab(parentHub)} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: BRAND.muted, fontWeight: 800, fontSize: 13, padding: "10px 4px", margin: "-10px 0 4px -4px", minHeight: 44 }}>
            <NavIcon name="back" size={15} /> Back to {parentHubLabel}
          </button>
        )}
        {tab === "train_hub" && <HubScreen title="Train" subtitle="Program, progress, and photos" cards={trainCards} onOpen={setTab} />}
        {tab === "me_hub" && <HubScreen title="Me" subtitle="Your coach, payments, and account" cards={meCards} onOpen={handleMeOpen} />}
        {tab !== "train_hub" && tab !== "me_hub" && content}
      </main>
      {showSettings && <ClientSettingsModal client={client} onClose={() => setShowSettings(false)} />}
      <ClientBottomNav tab={tab} setTab={setTab} unreadMessages={unreadMessages} />
    </div>
  );
}
function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}
function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator?.standalone === true;
}
function InstallPrompt({ color = BRAND.gold }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(() => (typeof localStorage !== "undefined" ? localStorage.getItem("forge_install_dismissed") === "1" : false));
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  useEffect(() => {
    function onPrompt(e) { e.preventDefault(); setDeferredPrompt(e); }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  if (isStandalone() || dismissed) return null;
  if (!deferredPrompt && !isIOS()) return null; // Android/Chrome that hasn't fired the prompt yet, or an unsupported desktop browser - nothing useful to offer
  function dismiss() { setDismissed(true); localStorage.setItem("forge_install_dismissed", "1"); }
  async function install() {
    if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; setDeferredPrompt(null); dismiss(); }
    else setShowIOSHelp(true);
  }
  return (
    <Card style={{ padding: 14, background: `${color}14`, border: `1px solid ${color}55`, marginBottom: 4 }}>
      {!showIOSHelp ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 22 }}>&#128241;</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: BRAND.text, fontWeight: 800, fontSize: 14 }}>Add Forge to your Home Screen</div>
            <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 600, marginTop: 2 }}>One tap, and you'll never need the link again.</div>
          </div>
          <button onClick={dismiss} style={{ background: "transparent", border: "none", color: BRAND.dim, fontWeight: 900, fontSize: 16, cursor: "pointer", padding: 4 }}>&times;</button>
        </div>
      ) : (
        <div>
          <div style={{ color: BRAND.text, fontWeight: 800, fontSize: 14, marginBottom: 6 }}>Add to Home Screen</div>
          <div style={{ color: BRAND.muted, fontSize: 12.5, fontWeight: 600, lineHeight: 1.5 }}>Tap the Share button <span style={{ color, fontWeight: 900 }}>&#9633;&#8593;</span> at the bottom of Safari, then choose "Add to Home Screen".</div>
        </div>
      )}
      {!showIOSHelp && <Button onClick={install} style={{ width: "100%", marginTop: 12 }}>Add to Home Screen</Button>}
    </Card>
  );
}
function ClientHome({ client, goTo }) {
  const isMobile = useIsMobile(520);
  const todaysWorkout = client.program?.weeks?.[0]?.workouts?.[0]?.name || "Workout not assigned";
  const w = client.program?.weeks?.[0]?.workouts?.[0];
  const exs = (w?.blocks?.flatMap((b) => b.entries || b.exercises || []) || w?.exercises || []);
  const chips = exs.slice(0, 3).map((e) => { const nm = e.substitutedName || e.name || e.exercise || ""; const sn = e.sets?.length; const rp = e.sets?.[0]?.targetReps || e.sets?.[0]?.reps || e.reps; return sn && rp ? `${nm} ${sn}×${rp}` : nm; }).filter(Boolean);
  const estMin = w ? Math.max(20, (exs.length || 4) * 12) : null;
  const nutrition = client.nutrition;
  const todaysLog = nutrition.food_log[isoDate()];
  const loggedCount = todaysLog ? ["breakfast", "lunch", "dinner"].filter((s) => todaysLog[s]).length + (todaysLog.snacks?.length ? 1 : 0) : 0;
  const nutritionPhaseLabel = { baseline: "Baseline week", report: "Report ready", adjustment: "Adjustment week", maintenance: "Maintenance" }[nutrition.phase] || "";
  return <div style={{ display: "grid", gap: 11, maxWidth: "100%", overflowX: "hidden" }}>
    <InstallPrompt color={client.color} />
    <Card style={{ padding: isMobile ? 16 : 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, alignItems: "center" }}>
        <ClientAvatar client={client} size={isMobile ? 50 : 68} />
        <div style={{ minWidth: 0 }}>
          <div style={{ color: BRAND.gold, fontSize: 10, fontWeight: 1000, letterSpacing: 1.4, textTransform: "uppercase" }}>The Forge Method</div>
          <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 1000, lineHeight: 1.05, textTransform: "uppercase", marginTop: 5 }}>Welcome back,<br />{client.name}</div>
          <div style={{ color: BRAND.muted, fontWeight: 800, marginTop: 7, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client.goals?.join(" + ") || client.goal || ""}</div>
        </div>
      </div>
    </Card>
    {goTo && !client.intake?.completedAt && <Card onClick={() => goTo("intake")} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderColor: BRAND.cyan }}><div><div style={{ color: BRAND.cyan, fontWeight: 1000, fontSize: 12, letterSpacing: 0.5 }}>COMPLETE YOUR INTAKE</div><div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginTop: 3 }}>A few questions so your coach can tailor your plan</div></div><div style={{ color: BRAND.cyan, fontWeight: 1000, fontSize: 13, whiteSpace: "nowrap" }}>Start &rarr;</div></Card>}
    {goTo && <Card onClick={() => goTo("nutrition")} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderColor: `${BRAND.green}55` }}><div><div style={{ color: BRAND.green, fontWeight: 1000, fontSize: 12, letterSpacing: 0.5 }}>NUTRITION · {nutritionPhaseLabel.toUpperCase()}</div><div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginTop: 3 }}>{nutrition.phase === "baseline" || nutrition.phase === "adjustment" ? `${loggedCount} of 4 logged today` : "View your report"}</div></div><div style={{ color: BRAND.green, fontWeight: 1000, fontSize: 13, whiteSpace: "nowrap" }}>Open &rarr;</div></Card>}
    {goTo && <Card onClick={() => goTo("checkins")} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderColor: `${BRAND.gold}55` }}><div><div style={{ color: BRAND.gold, fontWeight: 1000, fontSize: 12, letterSpacing: 0.5 }}>WEEKLY CHECK-IN</div><div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginTop: 3 }}>Log your week for your coach</div></div><div style={{ color: BRAND.gold, fontWeight: 1000, fontSize: 13, whiteSpace: "nowrap" }}>Start &rarr;</div></Card>}
    <div>
      <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 1000, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>Today's session</div>
      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 1000, textTransform: "uppercase", lineHeight: 1.1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{todaysWorkout}</div>
          {estMin && <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", letterSpacing: 1, flexShrink: 0 }}>~{estMin} MIN</div>}
        </div>
        {chips.length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>{chips.map((c, i) => <div key={i} style={{ padding: "8px 13px", borderRadius: 999, border: `1px solid ${BRAND.line}`, background: BRAND.card2, fontSize: 12, fontWeight: 800, color: BRAND.muted, whiteSpace: "nowrap", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>{c}</div>)}</div>}
        {goTo && <button onClick={() => goTo("program")} style={{ width: "100%", marginTop: 16, padding: "16px 0", borderRadius: 14, border: "none", background: "#fff", color: "#000", fontWeight: 1000, fontSize: 14, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}>Start session →</button>}
      </Card>
    </div>
    <HomeLearnStrip client={client} goTo={goTo} />
  </div>;
}

export default function App() {
  const isMobile = useIsMobile(520);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trainer, setTrainer] = useState(null);
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(null);
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
      setSelected(null); setClients([]);
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
    setSelected(updated);
    setClientPortal((p) => {
      const nextPortal = p?.id === updated.id ? updated : p;
      if (userId && nextPortal) saveForgeCache(userId, { trainer: null, clients: [], clientPortal: nextPortal });
      return nextPortal;
    });
  }
  return <>
    <style>{GLOBAL_TEXT_CSS}</style>
    {accountNotActive ? <AccountNotActiveScreen onBackToLogin={() => setAccountNotActive(false)} />
    : recoveryMode ? <ResetPasswordScreen onDone={() => { recoveryModeRef.current = false; setRecoveryMode(false); }} />
    : loading ? <div style={{ minHeight: "100vh", background: BRAND.bg, display: "grid", placeItems: "center" }}><div style={{ textAlign: "center" }}><div style={{ color: BRAND.gold, fontSize: isMobile ? 40 : 54, fontWeight: 900, letterSpacing: 1, lineHeight: 1 }}>FORGE</div></div></div>
    : !session ? <LoginScreen onReady={() => supabase.auth.getSession().then(({ data }) => data.session && boot(data.session.user))} />
    : clientPortal ? <ClientView client={clientPortal} updateClient={updateClient} isCoach={false} refresh={() => boot(session.user)} />
    : selected ? <ClientView client={selected} updateClient={updateClient} back={() => setSelected(null)} refresh={() => loadCoach(session.user)} isCoach />
    : <CoachDashboard user={session.user} trainer={trainer} setTrainer={setTrainer} clients={clients} setClients={setClients} selectClient={setSelected} refresh={() => loadCoach(session.user)} syncStatus={syncStatus} />}
  </>;
}
