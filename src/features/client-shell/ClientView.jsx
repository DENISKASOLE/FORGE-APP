import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";
import { showToast } from "../../components/ui/Toast.jsx";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { NavIcon } from "../../components/ui/NavIcon.jsx";
import { InjuryBanner } from "../../components/ui/InjuryBanner.jsx";
import { useIsMobile } from "../../lib/browser.js";
import { paymentStatus } from "../../lib/clientData.js";
import { CheckInsTab } from "../checkin/CheckInsTab.jsx";
import { MessagesTab } from "../messages/MessagesTab.jsx";
import { CoachNotesTab } from "../messages/CoachNotesTab.jsx";
import { ClientAIChat } from "../coach/ClientAIChat.jsx";
import { ScheduleTab, InviteTab } from "../scheduling/ScheduleTab.jsx";
import { PackagesTab } from "../scheduling/PackagesTab.jsx";
import { PaymentsTab } from "../payments/PaymentsTab.jsx";
import { LearnTab } from "../learn/LearnTab.jsx";
import { ProfileTab } from "../profile/ProfileTab.jsx";
import { IntakeForm } from "../profile/IntakeForm.jsx";
import { ProgressHub, ProgressTab } from "../progress/ProgressTab.jsx";
import { TransformPhotos } from "../progress/TransformPhotos.jsx";
import { ProgramTab } from "../train/TrainScreens.jsx";
import { NutritionFlow } from "../nutrition/NutritionFlow.jsx";
import { ClientBottomNav, HubScreen, ClientAvatar, ClientSettingsModal, MeAvatarButton } from "./ClientShellUI.jsx";
import { QuickLogMenu } from "../quicklog/QuickLogMenu.jsx";
import { HomeDaily } from "../home/HomeDaily.jsx";
import { useEdgeSwipeBack, useTabScrollMemory } from "../../lib/gestures.js";
import { CoachSidebarShell } from "../coach/CoachSidebarShell.jsx";
import { inkOn } from "../../lib/colorUtils.js";

// `tab`/`setTab` are optionally controlled: pass them (e.g. from a router
// route) to drive navigation externally, or omit them to fall back to
// this component's own internal state - unchanged from how it always
// worked before routes existed.
const MAIN_TABS = ["home", "program", "train_hub", "nutrition", "progress_hub"];

export function ClientView({ client, updateClient, back, refresh, isCoach = true, tab: tabProp, setTab: setTabProp }) {
  const [tabState, setTabState] = useState(isCoach ? "profile" : "home");
  const tab = tabProp !== undefined ? tabProp : tabState;
  const setTab = setTabProp || setTabState;
  const [showSettings, setShowSettings] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [quickView, setQuickView] = useState(null);
  // Native navigation feel (client side): swipe from the left edge to go
  // back from a sub-screen, and each tab remembers where you scrolled to.
  const backTarget = isCoach ? null : ["payments", "profile", "ai_coach"].includes(tab) ? "me_hub" : tab === "me_hub" ? "home" : null;
  const swipeRef = useEdgeSwipeBack(() => backTarget && setTab(backTarget), !!backTarget);
  useTabScrollMemory(tab, MAIN_TABS);
  const isMobile = useIsMobile(520);
  // Matches CoachSidebarShell's own breakpoint exactly (DESKTOP_SIDEBAR_MIN).
  const isDesktop = !useIsMobile(1180);
  const isOnline = client.clientType === "Online";
  const tabs = isCoach ? [
    ["profile", "Profile"], ["program", "Program"], ["nutrition", "Nutrition"], ["progress", "Progress"], ["photos", "Photos"],
    isOnline ? ["checkins", "Check-ins"] : ["schedule", "Schedule"],
    isOnline ? ["payments", "Payments"] : ["packages", "Packages"],
    ["notes", "Notes"], ["invite", "Invite"],
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
    {tab === "home" && !isCoach && <InstallPrompt color={client.color} />}
    {tab === "home" && <HomeDaily client={client} updateClient={updateClient} goTo={!isCoach ? setTab : undefined} unread={(client.messages || []).filter((m) => m.from === "coach" && !m.read).length} openLog={!isCoach ? setQuickView : undefined} />}
    {tab === "profile" && <ProfileTab client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "program" && <ProgramTab client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "nutrition" && <NutritionFlow client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "progress" && <ProgressTab client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "progress_hub" && <ProgressHub client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "photos" && <TransformPhotos client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "schedule" && <ScheduleTab client={client} updateClient={updateClient} />}
    {tab === "packages" && <PackagesTab client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "checkins" && <CheckInsTab client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "learn" && <LearnTab client={client} />}
    {tab === "intake" && <IntakeForm client={client} updateClient={updateClient} goTo={setTab} />}
    {tab === "payments" && <PaymentsTab client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "invite" && <InviteTab client={client} updateClient={updateClient} />}
    {tab === "notes" && isCoach && <CoachNotesTab client={client} updateClient={updateClient} />}
    {tab === "messages" && <MessagesTab client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "ai_coach" && !isCoach && <ClientAIChat client={client} updateClient={updateClient} />}
  </>;

  // ---- COACH: horizontal tab bar below 1180px, persistent sidebar at
  // real desktop width (CoachSidebarShell - DECISIONS.md "Coach desktop
  // web layout") ----
  if (isCoach) {
    return (
      <CoachSidebarShell>
      <div data-app="coach" style={{ minHeight: "100vh", width: "100%", maxWidth: "100%", overflowX: "hidden", background: BRAND.bg, color: BRAND.text, fontFamily: BRAND.sans }}>
        <header style={{ borderBottom: `${BRAND.hairline} solid ${BRAND.line}`, padding: isMobile ? "8px 10px" : 14, display: "flex", gap: 9, alignItems: "center", position: "sticky", top: 0, background: "color-mix(in srgb, var(--page) 96%, transparent)", backdropFilter: "blur(16px)", zIndex: 80, maxWidth: "100%", overflow: "hidden" }}>
          <Button variant="ghost" onClick={back} style={{ padding: isMobile ? "8px 10px" : undefined }}>Back</Button>
          <ClientAvatar client={client} size={isMobile ? 44 : 56} />
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontFamily: BRAND.display, fontSize: isMobile ? 19 : 23, fontWeight: 500, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client.name}</div><div style={{ color: client.color, fontWeight: 500, fontSize: 12 }}>{client.goals?.join(" + ") || client.goal}</div></div>
          <Button variant="red" onClick={delClient} style={{ padding: isMobile ? "8px 10px" : undefined }}>Delete</Button>
        </header>
        <InjuryBanner client={client} />
        <main style={{ width: "100%", maxWidth: isMobile ? 430 : isDesktop ? 1180 : 960, margin: "0 auto", padding: isMobile ? "6px 8px 12px" : 16, boxSizing: "border-box", overflowX: "hidden" }}>
          <div style={{
            display: "flex",
            gap: isMobile ? 6 : 8,
            flexWrap: isDesktop ? "wrap" : "nowrap",
            overflowX: isDesktop ? "visible" : "auto",
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
              color: tab === k ? inkOn(client.color) : BRAND.text,
              fontSize: isMobile ? 11 : 14,
              fontWeight: 500,
              whiteSpace: "nowrap",
              flex: "0 0 auto",
            }}>{l}</button>)}
          </div>
          {content}
        </main>
      </div>
      </CoachSidebarShell>
    );
  }

  // ---- CLIENT: bottom nav (Home / Nutrition / Train / Me) with hub screens, full-bleed content, no top bar ----
  // "Me" is reached from the photo top-right (Nov 2026), so Me itself goes
  // back to Home and its sub-screens go back to Me.
  const parentHub = ["payments", "profile", "ai_coach"].includes(tab) ? "me_hub" : tab === "me_hub" ? "home" : null;
  const parentHubLabel = tab === "me_hub" ? "Home" : "Me";
  const unreadMessages = (client.messages || []).filter((m) => m.from === "coach" && !m.read).length;
  // Photo top-right on every main screen except Home (which has its own in
  // the greeting) and the Me screens themselves.
  const showTopAvatar = tab !== "home" && !["me_hub", "payments", "profile", "ai_coach"].includes(tab);

  const trainCards = [
    { key: "program", icon: "program", color: BRAND.gold, title: "Program", sub: client.program ? `${client.program.goal || "Training"} · Week ${client.program.weeks?.[0]?.weekNum || 1}` : "No program yet" },
    { key: "progress", icon: "progress", color: BRAND.blue, title: "Progress", sub: "See your trends and personal bests" },
    { key: "photos", icon: "photo", color: BRAND.dim, title: "Photos", sub: client.transformPhotos?.length ? `${client.transformPhotos.length} photo${client.transformPhotos.length === 1 ? "" : "s"} saved` : "No photos yet" },
  ];
  const meCards = [
    ...(isCoach ? [] : [{ key: "whatsapp", icon: "msg", color: BRAND.green, title: "Message your coach", sub: "Opens WhatsApp" }]),
    ...(isCoach ? [] : [{ key: "ai_coach", icon: "msg", color: BRAND.blue, title: "AI Coach", sub: "Chat with your AI coach" }]),
    { key: "profile", icon: "me", color: BRAND.violet, title: "Profile", sub: "Your details & settings" },
    { key: "payments", icon: "card", color: BRAND.yellow, title: "Payments", sub: paymentStatus(client).label },
    { key: "settings", icon: "gear", color: BRAND.dim, title: "Settings", sub: "Change password & log out" },
  ];
  function handleMeOpen(key) { if (key === "settings") setShowSettings(true); else if (key === "whatsapp") window.open("https://wa.me/971567088638", "_blank"); else setTab(key); }
  return (
    <div data-app="client" style={{ minHeight: "100vh", width: "100%", maxWidth: "100%", overflowX: "hidden", background: BRAND.bg, color: BRAND.text, fontFamily: BRAND.sans, paddingBottom: 120 }}>
      <main style={{ width: "100%", maxWidth: isMobile ? 430 : 760, margin: "0 auto", padding: isMobile ? "14px 10px 0" : "18px 16px 0", boxSizing: "border-box", overflowX: "hidden" }}>
        {parentHub && (
          <button onClick={() => setTab(parentHub)} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: BRAND.muted, fontWeight: 500, fontSize: 13, padding: "10px 4px", margin: "-10px 0 4px -4px", minHeight: 44 }}>
            <NavIcon name="back" size={15} /> Back to {parentHubLabel}
          </button>
        )}
        {showTopAvatar && (
          <div className="me-top-row" style={{ display: "flex", justifyContent: "flex-end", padding: "0 2px 8px" }}>
            <MeAvatarButton client={client} unread={unreadMessages} onClick={() => setTab("me_hub")} size={38} />
          </div>
        )}
        {/* Each tab change replays a short entrance; screens opened from a
            hub (Me > Profile, Train > Photos...) slide in like a pushed page. */}
        <div key={tab} ref={swipeRef} className={parentHub || ["checkins", "messages", "photos", "progress", "learn", "intake", "measurements"].includes(tab) ? "fx-push" : "fx-screen"}>
        {tab === "train_hub" && <HubScreen title="Train" subtitle="Program, progress, and photos" cards={trainCards} onOpen={setTab} />}
        {tab === "me_hub" && <HubScreen title="Me" subtitle="Your coach, payments, and account" cards={meCards} onOpen={handleMeOpen} header={(
          <div className="glass" style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, marginBottom: 12 }}>
            <ClientAvatar client={client} size={56} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: BRAND.display, fontSize: 19, fontWeight: 600 }}>{client.name}</div>
              <div style={{ color: BRAND.muted, fontSize: 13 }}>{[client.goals?.join(" + ") || client.goal, client.clientType === "Online" ? "Online client" : client.clientType ? "In-person client" : ""].filter(Boolean).join(" · ")}</div>
            </div>
          </div>
        )} />}
        {tab !== "train_hub" && tab !== "me_hub" && content}
        </div>
      </main>
      {showSettings && <ClientSettingsModal client={client} onClose={() => setShowSettings(false)} />}
      <QuickLogMenu client={client} updateClient={updateClient} open={plusOpen} onClose={() => setPlusOpen(false)} view={quickView} setView={setQuickView} />
      <ClientBottomNav tab={tab} setTab={(t) => { setPlusOpen(false); setTab(t); }} plusOpen={plusOpen} onPlus={() => setPlusOpen((o) => !o)} />
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
