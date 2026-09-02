import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";
import { showToast } from "../../components/ui/Toast.jsx";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { NavIcon } from "../../components/ui/NavIcon.jsx";
import { InjuryBanner } from "../../components/ui/InjuryBanner.jsx";
import { isoDate, currentStreakWeeks } from "../../lib/dateUtils.js";
import { useIsMobile } from "../../lib/browser.js";
import { paymentStatus, daysSince, daysUntil, paymentLockout } from "../../lib/clientData.js";
import { CheckInsTab } from "../checkin/CheckInsTab.jsx";
import { MessagesTab } from "../messages/MessagesTab.jsx";
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
    ["messages", "Messages"], ["profile", "Profile"],
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
    {tab === "messages" && <MessagesTab client={client} updateClient={updateClient} isCoach={isCoach} />}
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
  const parentHub = ["payments", "profile"].includes(tab) ? "me_hub" : null;
  const parentHubLabel = "Me";
  const unreadMessages = (client.messages || []).filter((m) => m.from === "coach" && !m.read).length;
  const trainCards = [
    { key: "program", icon: "program", color: BRAND.gold, title: "Program", sub: client.program?.name ? `${client.program.name} · Week ${client.program.weeks?.[0]?.weekNum || 1}` : "No program yet" },
    { key: "progress", icon: "progress", color: BRAND.blue, title: "Progress", sub: "See your trends and personal bests" },
    { key: "photos", icon: "photo", color: BRAND.dim, title: "Photos", sub: client.transformPhotos?.length ? `${client.transformPhotos.length} photo${client.transformPhotos.length === 1 ? "" : "s"} saved` : "No photos yet" },
  ];
  const meCards = [
    ...(isCoach ? [] : [{ key: "whatsapp", icon: "me", color: BRAND.green, title: "Message your coach", sub: "Opens WhatsApp" }]),
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
  const mealGoal = 4;
  const mealPct = Math.min(100, Math.round((loggedCount / mealGoal) * 100));
  const lastCheckIn = client.checkIns?.[client.checkIns.length - 1];
  const checkinDue = !lastCheckIn || daysSince(lastCheckIn.date) >= 7;
  const isOnlinePaying = client.clientType === "Online" && client.paymentDueDate && !client.paymentPaid;
  const daysToPayment = isOnlinePaying ? daysUntil(client.paymentDueDate) : null;
  const showPaymentBanner = isOnlinePaying && daysToPayment != null && daysToPayment <= 5;
  const lockout = isOnlinePaying ? paymentLockout(client) : null;
  const streakWeeks = currentStreakWeeks((client.checkIns || []).map((c) => c.date));
  const firstName = (client.name || "").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning," : hour < 18 ? "Good afternoon," : "Good evening,";
  return <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10, maxWidth: "100%", overflowX: "hidden", position: "relative" }}>
    <div style={{ position: "absolute", top: -60, left: -40, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(242,133,61,0.06) 0%, transparent 65%)", pointerEvents: "none", zIndex: 0 }} />
    <InstallPrompt color={client.color} />
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 2px 2px", position: "relative", zIndex: 1 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: BRAND.sans, fontSize: 12, fontWeight: 400, color: BRAND.muted }}>{greeting}</div>
        <div style={{ fontFamily: BRAND.display, fontSize: isMobile ? 24 : 28, fontWeight: 800, letterSpacing: "-0.4px", color: BRAND.text, marginTop: 2 }}>{firstName}.</div>
        {streakWeeks >= 2 && (
          <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(242,133,61,0.12)", border: "1px solid rgba(242,133,61,0.22)", borderRadius: 100, padding: "4px 11px" }}>
            <span style={{ fontSize: 11 }}>🔥</span>
            <span style={{ fontFamily: BRAND.sans, fontSize: 10, fontWeight: 600, color: BRAND.gold }}>{streakWeeks}-week streak</span>
          </div>
        )}
      </div>
      <ClientAvatar client={client} size={isMobile ? 46 : 54} />
    </div>

    {goTo && showPaymentBanner && (
      <div onClick={() => goTo("payments")} style={{ cursor: "pointer", background: daysToPayment < 0 ? "linear-gradient(135deg,#1f0e0c 0%,#2e1210 100%)" : "linear-gradient(135deg,#1f1208 0%,#2e1a08 100%)", border: `1.5px solid ${daysToPayment < 0 ? "rgba(220,80,70,0.5)" : "rgba(242,133,61,0.45)"}`, borderRadius: 20, padding: 16, position: "relative", overflow: "hidden", boxShadow: daysToPayment < 0 ? "0 0 32px rgba(220,80,70,0.12)" : "0 0 32px rgba(242,133,61,0.1)", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: daysToPayment < 0 ? "rgba(220,80,70,0.15)" : "rgba(242,133,61,0.15)", border: `1px solid ${daysToPayment < 0 ? "rgba(220,80,70,0.3)" : "rgba(242,133,61,0.3)"}`, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <NavIcon name="card" size={16} color={daysToPayment < 0 ? BRAND.red : BRAND.gold} />
            </div>
            <div>
              <div style={{ fontFamily: BRAND.sans, fontWeight: 700, fontSize: 13, color: BRAND.text }}>
                {daysToPayment < 0 ? `Payment ${lockout.overdueDays} day${lockout.overdueDays === 1 ? "" : "s"} overdue` : daysToPayment === 0 ? "Payment due today" : `Payment due in ${daysToPayment} day${daysToPayment === 1 ? "" : "s"}`}
              </div>
              <div style={{ fontFamily: BRAND.sans, fontWeight: 400, fontSize: 10, color: BRAND.muted, marginTop: 2 }}>
                {daysToPayment < 0 ? `Pay now to avoid losing access${lockout.daysUntilLockout != null ? ` — ${lockout.daysUntilLockout} day${lockout.daysUntilLockout === 1 ? "" : "s"} left` : ""}` : "Pay now to avoid any inconvenience"}
              </div>
            </div>
          </div>
          {daysToPayment < 0 && <div style={{ background: BRAND.red, borderRadius: 100, padding: "3px 9px", fontFamily: BRAND.sans, fontWeight: 700, fontSize: 9, color: "#fff", whiteSpace: "nowrap" }}>Overdue</div>}
        </div>
        <button style={{ width: "100%", background: daysToPayment < 0 ? BRAND.red : BRAND.gold, border: "none", borderRadius: 12, padding: 12, fontFamily: BRAND.sans, fontWeight: 700, fontSize: 13, color: "#fff", cursor: "pointer", boxShadow: daysToPayment < 0 ? "0 4px 18px rgba(220,80,70,0.3)" : "0 4px 18px rgba(242,133,61,0.3)" }}>Pay Now →</button>
      </div>
    )}

    {goTo && checkinDue ? (
      <div onClick={() => goTo("checkins")} style={{ cursor: "pointer", background: "linear-gradient(135deg,#1f1208 0%,#2e1a08 100%)", border: "1.5px solid rgba(242,133,61,0.45)", borderRadius: 20, padding: 16, position: "relative", overflow: "hidden", boxShadow: "0 0 32px rgba(242,133,61,0.1)", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(242,133,61,0.15)", border: "1px solid rgba(242,133,61,0.3)", display: "grid", placeItems: "center", flexShrink: 0 }}><NavIcon name="check" size={16} color={BRAND.gold} /></div>
            <div>
              <div style={{ fontFamily: BRAND.sans, fontWeight: 700, fontSize: 13, color: BRAND.text }}>Weekly Check-in Due</div>
              <div style={{ fontFamily: BRAND.sans, fontWeight: 400, fontSize: 10, color: BRAND.muted, marginTop: 2 }}>Your coach is waiting for your update</div>
            </div>
          </div>
          <div style={{ background: BRAND.gold, borderRadius: 100, padding: "3px 9px", fontFamily: BRAND.sans, fontWeight: 700, fontSize: 9, color: "#fff", whiteSpace: "nowrap" }}>Required</div>
        </div>
        <div style={{ fontFamily: BRAND.sans, fontSize: 11, color: BRAND.muted, lineHeight: 1.5, marginBottom: 12 }}>Your coach needs your update before the next session is loaded. Takes about 2 minutes.</div>
        <button style={{ width: "100%", background: BRAND.gold, border: "none", borderRadius: 12, padding: 12, fontFamily: BRAND.sans, fontWeight: 700, fontSize: 13, color: "#fff", cursor: "pointer", boxShadow: "0 4px 18px rgba(242,133,61,0.3)" }}>Start Check-in →</button>
      </div>
    ) : goTo && (
      <div style={{ background: BRAND.greenBg, border: "1px solid rgba(102,199,155,0.15)", borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, zIndex: 1 }}>
        <NavIcon name="check" size={16} color={BRAND.green} />
        <span style={{ fontFamily: BRAND.sans, fontWeight: 500, fontSize: 11, color: BRAND.green }}>Check-in submitted — you're all caught up ✓</span>
      </div>
    )}

    {goTo && !client.intake?.completedAt && (
      <Card onClick={() => goTo("intake")} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderColor: BRAND.blue, zIndex: 1 }}>
        <div><div style={{ color: BRAND.blue, fontWeight: 500, fontSize: 12, letterSpacing: "0.02em" }}>Complete your intake</div><div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 400, marginTop: 3 }}>A few questions so your coach can tailor your plan</div></div>
        <div style={{ color: BRAND.blue, fontWeight: 500, fontSize: 13, whiteSpace: "nowrap" }}>Start &rarr;</div>
      </Card>
    )}

    <div style={{ background: "linear-gradient(135deg,#2a1508,#3d1e08 60%,#241505)", border: "1px solid rgba(242,133,61,0.22)", borderRadius: 18, padding: 16, position: "relative", overflow: "hidden", zIndex: 1 }}>
      <div style={{ fontFamily: BRAND.sans, fontSize: 9, fontWeight: 600, color: BRAND.gold, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 7 }}>Today's Workout</div>
      {w ? (
        <>
          <div style={{ fontFamily: BRAND.display, fontSize: 20, fontWeight: 800, letterSpacing: "-0.3px", color: BRAND.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{todaysWorkout}</div>
          <div style={{ display: "flex", gap: 16, marginTop: 10, marginBottom: 13 }}>
            <div><div style={{ fontFamily: BRAND.sans, fontWeight: 700, fontSize: 14, color: BRAND.text }}>{exs.length || "–"}</div><div style={{ fontFamily: BRAND.sans, fontWeight: 400, fontSize: 9, color: BRAND.muted, marginTop: 2 }}>exercises</div></div>
            <div style={{ width: 1, background: BRAND.line }} />
            <div><div style={{ fontFamily: BRAND.sans, fontWeight: 700, fontSize: 14, color: BRAND.text }}>{chips.length ? "4×8" : "–"}</div><div style={{ fontFamily: BRAND.sans, fontWeight: 400, fontSize: 9, color: BRAND.muted, marginTop: 2 }}>avg sets</div></div>
            <div style={{ width: 1, background: BRAND.line }} />
            <div><div style={{ fontFamily: BRAND.sans, fontWeight: 700, fontSize: 14, color: BRAND.text }}>{estMin ? `~${estMin}m` : "–"}</div><div style={{ fontFamily: BRAND.sans, fontWeight: 400, fontSize: 9, color: BRAND.muted, marginTop: 2 }}>est.</div></div>
          </div>
          {goTo && <button onClick={() => goTo("program")} style={{ width: "100%", background: BRAND.gold, border: "none", borderRadius: 12, padding: 12, fontFamily: BRAND.sans, fontWeight: 700, fontSize: 13, color: "#fff", cursor: "pointer", boxShadow: "0 4px 18px rgba(242,133,61,0.3)" }}>Start Workout →</button>}
        </>
      ) : (
        <div style={{ display: "grid", justifyItems: "center", gap: 10, padding: "12px 10px 4px" }}>
          <NavIcon name="train" size={26} color={BRAND.dim} />
          <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 12, fontWeight: 400, lineHeight: 1.6, textAlign: "center" }}>No workout assigned yet — your coach will add one</div>
        </div>
      )}
    </div>

    {goTo && (
      <div onClick={() => goTo("nutrition")} style={{ cursor: "pointer", background: BRAND.card, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 16, padding: 13, zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontFamily: BRAND.sans, fontWeight: 600, fontSize: 12, color: BRAND.text }}>Nutrition today · {nutritionPhaseLabel}</div>
          <span style={{ fontFamily: BRAND.sans, fontWeight: 500, fontSize: 10, color: BRAND.gold }}>Log →</span>
        </div>
        {nutrition.phase === "baseline" || nutrition.phase === "adjustment" ? (
          <>
            <div style={{ height: 5, background: BRAND.lineSoft, borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${mealPct}%`, background: `linear-gradient(90deg, ${BRAND.accentDeep}, ${BRAND.gold})`, borderRadius: 3 }} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontFamily: BRAND.sans, fontSize: 9, color: BRAND.muted }}>{loggedCount} of {mealGoal} meals logged</span>
            </div>
          </>
        ) : (
          <div style={{ fontFamily: BRAND.sans, fontSize: 12, color: BRAND.muted }}>View your report</div>
        )}
      </div>
    )}

    <HomeLearnStrip client={client} goTo={goTo} />
  </div>;
}
