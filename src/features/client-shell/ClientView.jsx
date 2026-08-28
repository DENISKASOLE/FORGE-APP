import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";
import { showToast } from "../../components/ui/Toast.jsx";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { NavIcon } from "../../components/ui/NavIcon.jsx";
import { InjuryBanner } from "../../components/ui/InjuryBanner.jsx";
import { isoDate } from "../../lib/dateUtils.js";
import { useIsMobile } from "../../lib/browser.js";
import { paymentStatus } from "../../lib/clientData.js";
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
      <div data-app="coach" style={{ minHeight: "100vh", width: "100%", maxWidth: "100vw", overflowX: "hidden", background: BRAND.bg, color: BRAND.text }}>
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
    <div data-app="client" style={{ minHeight: "100vh", width: "100%", maxWidth: "100vw", overflowX: "hidden", background: BRAND.bg, color: BRAND.text, paddingBottom: 90 }}>
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
    <Card style={{ padding: 14, borderLeft: `3px solid ${color}`, marginBottom: 4 }}>
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
        {w ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 1000, textTransform: "uppercase", lineHeight: 1.1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{todaysWorkout}</div>
              {estMin && <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", letterSpacing: 1, flexShrink: 0 }}>~{estMin} MIN</div>}
            </div>
            {chips.length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>{chips.map((c, i) => <div key={i} style={{ padding: "8px 13px", borderRadius: 999, border: `1px solid ${BRAND.line}`, background: BRAND.card2, fontSize: 12, fontWeight: 800, color: BRAND.muted, whiteSpace: "nowrap", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>{c}</div>)}</div>}
            {goTo && <button onClick={() => goTo("program")} style={{ width: "100%", marginTop: 16, padding: "16px 0", borderRadius: 14, border: "none", background: "#fff", color: "#000", fontWeight: 1000, fontSize: 14, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}>Start session →</button>}
          </>
        ) : (
          <div style={{ display: "grid", justifyItems: "center", gap: 10, padding: "18px 10px" }}>
            <NavIcon name="train" size={28} color={BRAND.dim} />
            <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 700, lineHeight: 1.4, textAlign: "center" }}>No workout assigned yet &mdash; your coach will add one</div>
          </div>
        )}
      </Card>
    </div>
    <HomeLearnStrip client={client} goTo={goTo} />
  </div>;
}
