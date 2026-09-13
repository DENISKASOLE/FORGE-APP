import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";
import { showToast } from "../../components/ui/Toast.jsx";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { NavIcon } from "../../components/ui/NavIcon.jsx";
import { InjuryBanner } from "../../components/ui/InjuryBanner.jsx";
import { isoDate, currentStreakWeeks, isCheckInDue } from "../../lib/dateUtils.js";
import { useIsMobile } from "../../lib/browser.js";
import { paymentStatus, daysUntil, paymentLockout } from "../../lib/clientData.js";
import { currentProgramWeek, workoutForDay, exerciseCountOf } from "../../lib/programModel.js";
import { sessionForWorkout, parseSeconds } from "../../lib/trainingLogs.js";
import { CheckInsTab } from "../checkin/CheckInsTab.jsx";
import { MessagesTab } from "../messages/MessagesTab.jsx";
import { ClientAIChat } from "../coach/ClientAIChat.jsx";
import { ScheduleTab, InviteTab } from "../scheduling/ScheduleTab.jsx";
import { PackagesTab } from "../scheduling/PackagesTab.jsx";
import { PaymentsTab } from "../payments/PaymentsTab.jsx";
import { LearnTab, HomeLearnStrip } from "../learn/LearnTab.jsx";
import { ProfileTab } from "../profile/ProfileTab.jsx";
import { IntakeForm } from "../profile/IntakeForm.jsx";
import { ProgressHub, ProgressTab } from "../progress/ProgressTab.jsx";
import { TransformPhotos } from "../progress/TransformPhotos.jsx";
import { ProgramTab } from "../train/TrainScreens.jsx";
import { NutritionFlow } from "../nutrition/NutritionFlow.jsx";
import { ScreeningGate } from "../screening/ScreeningGate.jsx";
import { ClientBottomNav, HubScreen, ClientAvatar, ClientSettingsModal } from "./ClientShellUI.jsx";

// `tab`/`setTab` are optionally controlled: pass them (e.g. from a router
// route) to drive navigation externally, or omit them to fall back to
// this component's own internal state - unchanged from how it always
// worked before routes existed.
export function ClientView({ client, updateClient, back, refresh, isCoach = true, tab: tabProp, setTab: setTabProp }) {
  const [tabState, setTabState] = useState(isCoach ? "profile" : "home");
  const tab = tabProp !== undefined ? tabProp : tabState;
  const setTab = setTabProp || setTabState;
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
    ["messages", "Messages"], ["ai_coach", "AI Coach"], ["profile", "Profile"],
  ];
  async function delClient() {
    const ok = await confirmDialog(`Delete ${client.name}? This cannot be undone.`, { danger: true, confirmLabel: "Delete" });
    if (!ok) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) { showToast("You're offline. Deleting a client needs an internet connection - please try again once you're back online.", "warn"); return; }
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
    {tab === "progress" && <ProgressTab client={client} isCoach={isCoach} />}
    {tab === "progress_hub" && <ProgressHub client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "photos" && <TransformPhotos client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "schedule" && <ScheduleTab client={client} updateClient={updateClient} />}
    {tab === "packages" && <PackagesTab client={client} updateClient={updateClient} />}
    {tab === "checkins" && <CheckInsTab client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "learn" && <LearnTab client={client} />}
    {tab === "intake" && <IntakeForm client={client} updateClient={updateClient} goTo={setTab} />}
    {tab === "payments" && <PaymentsTab client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "invite" && <InviteTab client={client} updateClient={updateClient} />}
    {tab === "messages" && <MessagesTab client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "ai_coach" && !isCoach && <ClientAIChat client={client} updateClient={updateClient} />}
  </>;

  // ---- COACH: unchanged horizontal tab bar, full tablet layout ----
  if (isCoach) {
    return (
      <div data-app="coach" style={{ minHeight: "100vh", width: "100%", maxWidth: "100%", overflowX: "hidden", background: BRAND.bg, color: BRAND.text, fontFamily: BRAND.sans }}>
        <header style={{ borderBottom: `${BRAND.hairline} solid ${BRAND.line}`, padding: isMobile ? "8px 10px" : 14, display: "flex", gap: 9, alignItems: "center", position: "sticky", top: 0, background: "color-mix(in srgb, var(--page) 96%, transparent)", backdropFilter: "blur(16px)", zIndex: 80, maxWidth: "100%", overflow: "hidden" }}>
          <Button variant="ghost" onClick={back} style={{ padding: isMobile ? "8px 10px" : undefined }}>Back</Button>
          <ClientAvatar client={client} size={isMobile ? 44 : 56} />
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontFamily: BRAND.display, fontSize: isMobile ? 19 : 23, fontWeight: 500, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client.name}</div><div style={{ color: client.color, fontWeight: 500, fontSize: 12 }}>{client.goals?.join(" + ") || client.goal}</div></div>
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
              border: `${BRAND.hairline} solid ${tab === k ? client.color : BRAND.line}`,
              background: tab === k ? client.color : BRAND.card2,
              color: tab === k ? "#000" : BRAND.text,
              fontSize: isMobile ? 11 : 14,
              fontWeight: 500,
              whiteSpace: "nowrap",
              flex: "0 0 auto",
            }}>{l}</button>)}
          </div>
          {content}
        </main>
      </div>
    );
  }

  // ---- CLIENT: bottom nav (Home / Nutrition / Train / Me) with hub screens, full-bleed content, no top bar ----
  const parentHub = ["payments", "profile", "progress_hub"].includes(tab) ? "me_hub" : null;
  const parentHubLabel = "Me";
  const unreadMessages = (client.messages || []).filter((m) => m.from === "coach" && !m.read).length;
  const trainCards = [
    { key: "program", icon: "program", color: BRAND.gold, title: "Program", sub: client.program ? `${client.program.goal || "Training"} · Week ${client.program.weeks?.[0]?.weekNum || 1}` : "No program yet" },
    { key: "progress", icon: "progress", color: BRAND.blue, title: "Progress", sub: "See your trends and personal bests" },
    { key: "photos", icon: "photo", color: BRAND.dim, title: "Photos", sub: client.transformPhotos?.length ? `${client.transformPhotos.length} photo${client.transformPhotos.length === 1 ? "" : "s"} saved` : "No photos yet" },
  ];
  const meCards = [
    ...(isCoach ? [] : [{ key: "whatsapp", icon: "me", color: BRAND.green, title: "Message your coach", sub: "Opens WhatsApp" }]),
    { key: "progress_hub", icon: "progress", color: BRAND.blue, title: "Progress", sub: "Trends, photos & check-ins" },
    { key: "profile", icon: "gear", color: BRAND.dim, title: "Profile", sub: "Your details & settings" },
    { key: "payments", icon: "card", color: BRAND.green, title: "Payments", sub: paymentStatus(client).label },
    { key: "settings", icon: "gear", color: BRAND.dim, title: "Settings", sub: "Change password & log out" },
  ];
  function handleMeOpen(key) { if (key === "settings") setShowSettings(true); else if (key === "whatsapp") window.open("https://wa.me/971567088638", "_blank"); else setTab(key); }
  return (
    <div data-app="client" style={{ minHeight: "100vh", width: "100%", maxWidth: "100%", overflowX: "hidden", background: BRAND.bg, color: BRAND.text, fontFamily: BRAND.sans, paddingBottom: 90 }}>
      <main style={{ width: "100%", maxWidth: isMobile ? 430 : 760, margin: "0 auto", padding: isMobile ? "14px 10px 0" : "18px 16px 0", boxSizing: "border-box", overflowX: "hidden" }}>
        {parentHub && (
          <button onClick={() => setTab(parentHub)} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: BRAND.muted, fontWeight: 500, fontSize: 13, padding: "10px 4px", margin: "-10px 0 4px -4px", minHeight: 44 }}>
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
    <Card style={{ padding: 14, borderLeft: `3px solid ${color}`, marginBottom: 4 }}>
      {!showIOSHelp ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 22 }}>&#128241;</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: BRAND.text, fontWeight: 500, fontSize: 14 }}>Add Forge to your home screen</div>
            <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 400, marginTop: 2 }}>One tap, and you'll never need the link again.</div>
          </div>
          <button onClick={dismiss} style={{ background: "transparent", border: "none", color: BRAND.dim, fontWeight: 500, fontSize: 16, cursor: "pointer", padding: 4 }}>&times;</button>
        </div>
      ) : (
        <div>
          <div style={{ color: BRAND.text, fontWeight: 500, fontSize: 14, marginBottom: 6 }}>Add to home screen</div>
          <div style={{ color: BRAND.muted, fontSize: 12.5, fontWeight: 400, lineHeight: 1.6 }}>Tap the Share button <span style={{ color, fontWeight: 500 }}>&#9633;&#8593;</span> at the bottom of Safari, then choose "Add to Home Screen".</div>
        </div>
      )}
      {!showIOSHelp && <Button onClick={install} style={{ width: "100%", marginTop: 12 }}>Add to home screen</Button>}
    </Card>
  );
}
// Home-screen-specific accent palette: exact values from the approved
// redesign mockup, used for the momentum rings and nutrition color system.
// Deliberately not run through the app-wide BRAND accent tokens (which are
// close but not identical) - these four hex values are THE spec here, and
// their meaning (Train/Fuel/Streak/Dinner) is specific to this screen. Base
// surfaces (card bg/text/muted) still use BRAND tokens so Home stays
// theme-aware (light/dark) and visually consistent with the rest of the
// app, per "reuse the app's existing dark styling." See DECISIONS.md.
const HOME_ACCENT = { green: "#5FBE86", orange: "#E0913E", blue: "#5B8FD6", violet: "#9B7BE0" };
const HOME_TRACK = "#242427";

function capitalizeFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function MomentumRing({ centerText, pct, color, label, size = 58, stroke = 6 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * Math.max(0, Math.min(1, pct));
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 6, minWidth: 0 }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} stroke={HOME_TRACK} strokeWidth={stroke} fill="none" />
          <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${dash} ${c - dash}`} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <span style={{ fontFamily: BRAND.display, fontWeight: 700, fontSize: 14, color: BRAND.text }}>{centerText}</span>
        </div>
      </div>
      <div style={{ fontFamily: BRAND.sans, fontSize: 10, fontWeight: 400, color: BRAND.muted, textAlign: "center", whiteSpace: "nowrap" }}>{label}</div>
    </div>
  );
}

function ClientHome({ client, goTo }) {
  const todayISO = isoDate();
  const jsDow = new Date().getDay();
  const dow = jsDow === 0 ? 7 : jsDow; // program model is Mon(1)-Sun(7); Date#getDay() is Sun(0)-Sat(6)
  const program = client.program;
  const weekNum = currentProgramWeek(program);
  const week = program?.weeks?.find((wk) => wk.weekNum === weekNum) || null;
  const workout = week ? workoutForDay(week, dow) : null;
  const exCount = exerciseCountOf(workout);
  const allSets = (workout?.blocks || []).flatMap((b) => b.exercises || []).flatMap((e) => e.sets || []);
  const avgSets = exCount ? Math.round(allSets.length / exCount) : 0;
  const repCounts = {};
  allSets.forEach((s) => { if (s.targetReps) repCounts[s.targetReps] = (repCounts[s.targetReps] || 0) + 1; });
  const avgReps = Object.entries(repCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const estMin = Math.round((workout?.blocks || []).reduce((total, b) => total + (b.exercises || []).reduce((sub, ex) => {
    const sets = ex.sets?.length || 0;
    const restSec = parseSeconds(ex.rest || "") || 60; // ~1min working time/set + this exercise's rest, defaulting to 60s when unset
    return sub + sets * 1 + (sets * restSec) / 60;
  }, 0), 0));

  // This week's training ring: completed / scheduled non-rest days so far this week.
  const weekWorkoutDays = week ? Array.from({ length: 7 }, (_, i) => workoutForDay(week, i + 1)).filter(Boolean) : [];
  const trainingLogs = client.trainingLogs;
  const trainDone = week ? weekWorkoutDays.filter((wo) => sessionForWorkout(trainingLogs, week.id, wo.id)?.status === "completed").length : 0;
  const trainTotal = weekWorkoutDays.length;

  // Training streak: consecutive weeks with at least one completed session.
  const completedSessionDates = (trainingLogs?.sessions || []).filter((s) => s.status === "completed").map((s) => s.date);
  const trainStreak = currentStreakWeeks(completedSessionDates);
  const streakRingTotal = Math.max(trainStreak + 1, 4); // always render "near-full", per spec

  const nutrition = client.nutrition;
  const todaysLog = nutrition.food_log[todayISO];
  const mealFlags = [!!todaysLog?.breakfast, !!todaysLog?.lunch, !!todaysLog?.dinner, !!todaysLog?.snacks?.length];
  const loggedCount = mealFlags.filter(Boolean).length;
  const mealGoal = 4;

  const checkinSubmissions = client.checkIns || [];
  const checkinDue = isCheckInDue(checkinSubmissions);
  const isOnlinePaying = client.clientType === "Online" && client.paymentDueDate && !client.paymentPaid;
  const daysToPayment = isOnlinePaying ? daysUntil(client.paymentDueDate) : null;
  const showPaymentBanner = isOnlinePaying && daysToPayment != null && daysToPayment <= 5;
  const lockout = isOnlinePaying ? paymentLockout(client) : null;

  const coachMessages = (client.messages || []).filter((m) => m.from === "coach").sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const latestCoachMsg = coachMessages[coachMessages.length - 1] || null;

  const firstName = capitalizeFirst((client.name || "").split(" ")[0]);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning," : hour < 18 ? "Good afternoon," : "Good evening,";

  return <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10, maxWidth: "100%", overflowX: "hidden", position: "relative" }}>
    <InstallPrompt color={client.color} />

    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 2px 2px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: BRAND.sans, fontSize: 14, fontWeight: 400, color: BRAND.muted }}>{greeting}</div>
        <div style={{ fontFamily: BRAND.display, fontSize: 26, fontWeight: 700, letterSpacing: "-0.4px", color: BRAND.text, marginTop: 2 }}>{firstName}.</div>
      </div>
      <ClientAvatar client={client} size={42} />
    </div>

    {goTo && showPaymentBanner && (
      <div onClick={() => goTo("payments")} className="glass" style={{ cursor: "pointer", background: daysToPayment < 0 ? "var(--hero-gradient-danger)" : "var(--hero-gradient-warm)", border: `1.5px solid ${daysToPayment < 0 ? "rgba(220,80,70,0.5)" : "color-mix(in srgb, var(--accent) 35%, transparent)"}`, borderRadius: 20, padding: 16, position: "relative", overflow: "hidden", boxShadow: daysToPayment < 0 ? "0 0 32px rgba(220,80,70,0.12)" : "0 0 32px color-mix(in srgb, var(--accent) 8%, transparent)", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: daysToPayment < 0 ? "rgba(220,80,70,0.15)" : HOME_TRACK, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <NavIcon name="card" size={15} color={daysToPayment < 0 ? BRAND.red : BRAND.text} />
            </div>
            <div>
              <div style={{ fontFamily: BRAND.sans, fontWeight: 600, fontSize: 13, color: BRAND.text }}>
                {daysToPayment < 0 ? `Payment ${lockout.overdueDays} day${lockout.overdueDays === 1 ? "" : "s"} overdue` : daysToPayment === 0 ? "Payment due today" : `Payment due in ${daysToPayment} day${daysToPayment === 1 ? "" : "s"}`}
              </div>
              <div style={{ fontFamily: BRAND.sans, fontWeight: 400, fontSize: 10, color: BRAND.muted, marginTop: 2 }}>
                {daysToPayment < 0 ? `Pay now to avoid losing access${lockout.daysUntilLockout != null ? ` — ${lockout.daysUntilLockout} day${lockout.daysUntilLockout === 1 ? "" : "s"} left` : ""}` : "Pay now to avoid any inconvenience"}
              </div>
            </div>
          </div>
          {daysToPayment < 0 && <div style={{ background: BRAND.red, borderRadius: 100, padding: "3px 9px", fontFamily: BRAND.sans, fontWeight: 600, fontSize: 9, color: "#fff", whiteSpace: "nowrap" }}>Overdue</div>}
        </div>
        <button style={{ width: "100%", background: BRAND.btnBg, border: "none", borderRadius: 12, padding: 12, fontFamily: BRAND.sans, fontWeight: 600, fontSize: 13, color: BRAND.btnInk, cursor: "pointer" }}>Pay Now →</button>
      </div>
    )}

    {goTo && checkinDue && (
      <div onClick={() => goTo("checkins")} className="glass" style={{ cursor: "pointer", background: "var(--hero-gradient-warm)", border: "1.5px solid color-mix(in srgb, var(--accent) 35%, transparent)", borderRadius: 20, padding: 16, position: "relative", overflow: "hidden", boxShadow: "0 0 32px color-mix(in srgb, var(--accent) 8%, transparent)", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: HOME_TRACK, display: "grid", placeItems: "center", flexShrink: 0 }}><NavIcon name="check" size={15} color={BRAND.text} /></div>
            <div>
              <div style={{ fontFamily: BRAND.sans, fontWeight: 600, fontSize: 13, color: BRAND.text }}>Weekly Check-in Due</div>
              <div style={{ fontFamily: BRAND.sans, fontWeight: 400, fontSize: 10, color: BRAND.muted, marginTop: 2 }}>Your coach is waiting for your update</div>
            </div>
          </div>
          <div style={{ background: BRAND.btnBg, borderRadius: 100, padding: "3px 9px", fontFamily: BRAND.sans, fontWeight: 600, fontSize: 9, color: BRAND.btnInk, whiteSpace: "nowrap" }}>Required</div>
        </div>
        <button style={{ width: "100%", background: BRAND.btnBg, border: "none", borderRadius: 12, padding: 12, fontFamily: BRAND.sans, fontWeight: 600, fontSize: 13, color: BRAND.btnInk, cursor: "pointer" }}>Start Check-in →</button>
      </div>
    )}

    {goTo && !client.intake?.completedAt && (
      <Card onClick={() => goTo("intake")} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", padding: 14, borderColor: BRAND.blue }}>
        <div><div style={{ color: BRAND.blue, fontWeight: 500, fontSize: 12, letterSpacing: "0.02em" }}>Complete your intake</div><div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 400, marginTop: 3 }}>A few questions so your coach can tailor your plan</div></div>
        <div style={{ color: BRAND.blue, fontWeight: 500, fontSize: 13, whiteSpace: "nowrap" }}>Start &rarr;</div>
      </Card>
    )}

    <div style={{ background: BRAND.card, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 16, padding: 14, display: "flex", justifyContent: "space-around", gap: 8 }}>
      <MomentumRing centerText={`${trainDone}/${trainTotal || 4}`} pct={trainTotal ? trainDone / trainTotal : 0} color={HOME_ACCENT.green} label={"Train · week"} />
      <MomentumRing centerText={`${loggedCount}/${mealGoal}`} pct={loggedCount / mealGoal} color={HOME_ACCENT.orange} label={"Fuel · today"} />
      <MomentumRing centerText={`${trainStreak}`} pct={trainStreak ? trainStreak / streakRingTotal : 0} color={HOME_ACCENT.blue} label={"Streak · weeks"} />
    </div>

    <div className="glass glass-glow" style={{ background: "var(--hero-gradient)", border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)", borderRadius: 18, padding: 16, position: "relative", overflow: "hidden", zIndex: 1 }}>
      <div style={{ fontFamily: BRAND.sans, fontSize: 9, fontWeight: 600, color: BRAND.gold, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 7 }}>Today's Workout</div>
      {workout ? (
        <>
          <div style={{ fontFamily: BRAND.display, fontSize: 23, fontWeight: 700, letterSpacing: "-0.3px", textTransform: "uppercase", color: BRAND.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{workout.name}</div>
          <div style={{ display: "flex", gap: 16, marginTop: 10, marginBottom: 13 }}>
            <div><div style={{ fontFamily: BRAND.sans, fontWeight: 700, fontSize: 14, color: BRAND.text }}>{exCount || "–"}</div><div style={{ fontFamily: BRAND.sans, fontWeight: 400, fontSize: 9, color: BRAND.muted, marginTop: 2 }}>exercises</div></div>
            <div style={{ width: 1, background: HOME_TRACK }} />
            <div><div style={{ fontFamily: BRAND.sans, fontWeight: 700, fontSize: 14, color: BRAND.text }}>{avgSets && avgReps ? `${avgSets}×${avgReps}` : "–"}</div><div style={{ fontFamily: BRAND.sans, fontWeight: 400, fontSize: 9, color: BRAND.muted, marginTop: 2 }}>avg sets</div></div>
            <div style={{ width: 1, background: HOME_TRACK }} />
            <div><div style={{ fontFamily: BRAND.sans, fontWeight: 700, fontSize: 14, color: BRAND.text }}>{estMin ? `~${estMin}m` : "–"}</div><div style={{ fontFamily: BRAND.sans, fontWeight: 400, fontSize: 9, color: BRAND.muted, marginTop: 2 }}>est.</div></div>
          </div>
          {goTo && <button onClick={() => goTo("program")} style={{ width: "100%", background: BRAND.btnBg, border: "none", borderRadius: 12, padding: 12, fontFamily: BRAND.sans, fontWeight: 600, fontSize: 14, color: BRAND.btnInk, cursor: "pointer" }}>Start Workout →</button>}
        </>
      ) : (
        <div style={{ display: "grid", justifyItems: "center", gap: 8, padding: "10px 10px 2px" }}>
          <NavIcon name="train" size={22} color={BRAND.dim} />
          <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 12, fontWeight: 400, lineHeight: 1.6, textAlign: "center" }}>{program ? "Rest day — nothing scheduled today" : "No program yet — your coach will add one"}</div>
        </div>
      )}
    </div>

    {goTo && latestCoachMsg && (
      <div onClick={() => goTo("messages")} className="glass" style={{ cursor: "pointer", padding: 14, display: "flex", alignItems: "center", gap: 12, zIndex: 1 }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: HOME_TRACK, display: "grid", placeItems: "center", flexShrink: 0 }}><NavIcon name="msg" size={17} color={BRAND.blue} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: BRAND.sans, fontWeight: 600, fontSize: 13, color: BRAND.text }}>From your coach</div>
          <div style={{ fontFamily: BRAND.sans, fontSize: 12, color: BRAND.muted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{latestCoachMsg.text}</div>
        </div>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: BRAND.btnBg, color: BRAND.btnInk, display: "grid", placeItems: "center", flexShrink: 0, fontSize: 13 }}>▶</div>
      </div>
    )}

    {goTo && (
      <div onClick={() => goTo("nutrition")} style={{ cursor: "pointer", background: BRAND.card, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 16, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontFamily: BRAND.sans, fontWeight: 600, fontSize: 13, color: BRAND.text }}>Nutrition today</div>
          <span style={{ fontFamily: BRAND.sans, fontWeight: 600, fontSize: 11, color: HOME_ACCENT.orange }}>Log →</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {mealFlags.map((filled, i) => <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: filled ? HOME_ACCENT.orange : HOME_TRACK }} />)}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
          {[["Breakfast", HOME_ACCENT.orange], ["Lunch", HOME_ACCENT.blue], ["Dinner", HOME_ACCENT.violet], ["Snacks", HOME_ACCENT.green]].map(([label, color]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, color, boxShadow: "0 0 7px currentColor" }} />
              <span style={{ fontFamily: BRAND.sans, fontSize: 10, fontWeight: 400, color: BRAND.muted }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    )}

    <HomeLearnStrip client={client} goTo={goTo} />
  </div>;
}
