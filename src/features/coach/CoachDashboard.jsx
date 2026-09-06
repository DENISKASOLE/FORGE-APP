import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field, inputStyle, textareaStyle } from "../../components/ui/Field.jsx";
import { Mini } from "../../components/ui/Mini.jsx";
import { NavIcon } from "../../components/ui/NavIcon.jsx";
import { ThemeToggle } from "../../components/ui/ThemeToggle.jsx";
import { CoachIcon } from "../../components/ui/CoachIcon.jsx";
import { modalBackdrop } from "../../components/ui/modal.js";
import { useIsMobile } from "../../lib/browser.js";
import { compressImage } from "../../lib/compressImage.js";
import { uploadClientPhoto, uploadTrainerPhoto, deleteClientPhoto, usePhotoUrl, isStoragePath } from "../../lib/storage.js";
import { uid } from "../../lib/uid.js";
import { isoDate, startOfWeek, addDays } from "../../lib/dateUtils.js";
import {
  ageFromBirthday, daysUntil, daysSince, nextBirthdayDaysAway, initials, getClientColor,
  emptyProfile, paymentStatus, makeInviteCode, upsertSection, upsertTrainerData, loadTrainerTemplates,
} from "../../lib/clientData.js";
import { GOAL_OPTIONS, CLIENT_TYPES, CLIENT_COLORS } from "../../lib/constants.js";
import { showToast } from "../../components/ui/Toast.jsx";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { MEAL_SLOTS } from "../../lib/nutrition.js";
import { buildProgramDays, cloneWithNewIds } from "../../lib/programModel.js";
import { overallAdherence, recentPBsAcrossHistory } from "../progress/ProgressTab.jsx";
import { ExerciseLibraryScreen, ProgramBuilder } from "../train/TrainScreens.jsx";
import { CoachContentScreen } from "../learn/LearnTab.jsx";
import { INTAKE_FORM } from "../profile/IntakeForm.jsx";
import { ClientCard } from "../client-shell/ClientShellUI.jsx";
import { Calendar } from "./Calendar.jsx";
import { Trials } from "./Trials.jsx";
import { BuddyPairsScreen } from "./BuddyPairs.jsx";
import { PackageDesigner } from "./PackageDesigner.jsx";
import { loadTodaysAgenda } from "./coachHelpers.js";
import { timeLabel } from "../../lib/clientData.js";

async function loadExerciseLibraryData(trainerId) {
  if (!trainerId) return [];
  const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", trainerId).eq("section", "custom_exercise_library").maybeSingle();
  return Array.isArray(data?.data?.items) ? data.data.items : [];
}

export function AddClientModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", weight: "", color: CLIENT_COLORS[0], profile: emptyProfile() });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const setProfile = (k, v) => setForm((f) => ({ ...f, profile: { ...f.profile, [k]: v } }));
  const toggleGoal = (g) => setProfile("goals", form.profile.goals.includes(g) ? form.profile.goals.filter((x) => x !== g) : [...form.profile.goals, g]);
  function pickPhoto(file) {
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 780, maxHeight: "92vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div><div style={{ fontFamily: BRAND.display, fontSize: 24, fontWeight: 500, letterSpacing: "-0.01em", color: BRAND.text }}>Add new client</div><div style={{ color: BRAND.muted, fontSize: 14, fontWeight: 400, marginTop: 4 }}>Create the profile first. Invite the client later.</div></div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Client type</div>
          <div style={{ display: "flex", gap: 8 }}>{CLIENT_TYPES.map((t) => <button key={t} onClick={() => setProfile("clientType", t)} style={{ fontFamily: BRAND.sans, border: `${BRAND.hairline} solid ${form.profile.clientType === t ? "transparent" : BRAND.line}`, background: form.profile.clientType === t ? BRAND.btnBg : BRAND.card2, color: form.profile.clientType === t ? BRAND.btnInk : BRAND.text, borderRadius: 999, padding: "8px 16px", fontWeight: 500, fontSize: 13, cursor: "pointer" }}>{t}</button>)}</div>
          <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 400, marginTop: 6 }}>{form.profile.clientType === "Online" ? "Online clients get Check-ins and Payments instead of Schedule and Packages." : "1:1 clients keep the in-person Schedule and Packages tabs."}</div>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: BRAND.display, width: 72, height: 72, borderRadius: BRAND.radiusCard, background: form.color, overflow: "hidden", display: "grid", placeItems: "center", color: "#000", fontWeight: 500 }}>{photoPreview ? <img src={photoPreview} alt="client" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(form.name)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>Client photo</div>
            <input type="file" accept="image/*" onChange={(e) => pickPhoto(e.target.files?.[0])} style={inputStyle()} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
          <Field label="Client name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Field label="Birthday (age is calculated from this)" value={form.profile.birthday} onChange={(v) => setProfile("birthday", v)} type="date" />
          <Field label="Weight kg" value={form.weight} onChange={(v) => setForm({ ...form, weight: v })} type="number" />
          <Field label="Monthly price USD" value={form.profile.price || ""} onChange={(v) => setForm({ ...form, profile: { ...form.profile, price: v } })} type="number" />
        </div>
        <div style={{ marginTop: 14 }}>
          <Button variant="dark" onClick={() => setShowColorPicker((v) => !v)}>{showColorPicker ? "Hide client color" : "Change client color"}</Button>
          {showColorPicker && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>{CLIENT_COLORS.map((c) => <button key={c} onClick={() => setForm({ ...form, color: c, profile: { ...form.profile, color: c } })} style={{ width: 34, height: 34, borderRadius: BRAND.radiusControl, border: form.color === c ? `2px solid ${BRAND.text}` : `${BRAND.hairline} solid ${BRAND.line}`, background: c, cursor: "pointer" }} />)}</div>}
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Goals</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{GOAL_OPTIONS.map((g) => <button key={g} onClick={() => toggleGoal(g)} style={{ fontFamily: BRAND.sans, border: `${BRAND.hairline} solid ${form.profile.goals.includes(g) ? "transparent" : BRAND.line}`, background: form.profile.goals.includes(g) ? BRAND.btnBg : BRAND.card2, color: form.profile.goals.includes(g) ? BRAND.btnInk : BRAND.text, borderRadius: 999, padding: "7px 12px", fontWeight: 500, fontSize: 12 }}>{g}</button>)}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12, marginTop: 14 }}>
          <Field label="Injuries" value={form.profile.injuries} onChange={(v) => setProfile("injuries", v)} textarea />
          <Field label="Medical issues" value={form.profile.medicalIssues} onChange={(v) => setProfile("medicalIssues", v)} textarea />
          <Field label="Barriers" value={form.profile.barriers} onChange={(v) => setProfile("barriers", v)} textarea />
          <Field label="Sleep" value={form.profile.sleep} onChange={(v) => setProfile("sleep", v)} textarea />
          <Field label="NEAT / Daily Activity" value={form.profile.neat} onChange={(v) => setProfile("neat", v)} textarea />
          <Field label="Work Schedule" value={form.profile.workSchedule} onChange={(v) => setProfile("workSchedule", v)} textarea />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <Button onClick={() => onCreate({ ...form, photoFile })} style={{ flex: 1 }}>Create client</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </Card>
    </div>
  );
}
export function CoachSettingsModal({ user, trainer, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: trainer?.name || user?.user_metadata?.name || user?.email?.split("@")[0] || "",
    email: trainer?.email || user?.email || "",
    phone: trainer?.phone || "",
    photo: trainer?.photo || "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const photoUrl = usePhotoUrl(form.photo);
  async function pickPhoto(file) {
    if (!file) return;
    try {
      const blob = await compressImage(file);
      const previousPhoto = form.photo;
      const path = await uploadTrainerPhoto(user.id, "profile", blob);
      set("photo", path);
      if (isStoragePath(previousPhoto)) await deleteClientPhoto(previousPhoto);
    } catch (error) {
      showToast(error.message || "Couldn't upload that photo. Check your connection and try again.", "error");
    }
  }
  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const emailChanged = form.email && form.email !== user.email;
      if (emailChanged) {
        const { error: authErr } = await supabase.auth.updateUser({ email: form.email });
        if (authErr) throw authErr;
      }
      const payload = {
        id: user.id,
        name: form.name || user.email?.split("@")[0] || "Coach",
        email: form.email || user.email || "",
        phone: form.phone || "",
        photo: form.photo || "",
        role: "Coach",
      };
      const { error } = await supabase.from("trainers").upsert(payload, { onConflict: "id" });
      if (error) throw error;
      onSaved?.(payload);
      setMessage(emailChanged ? "Saved. Check your email to confirm the new login email." : "Settings saved.");
    } catch (e) {
      showToast(e.message || "Could not save coach settings", "error");
    }
    setSaving(false);
  }
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 560 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: BRAND.display, fontSize: 24, fontWeight: 500, letterSpacing: "-0.01em" }}>Coach settings</div>
            <div style={{ color: BRAND.muted, fontSize: 14, fontWeight: 400, marginTop: 4 }}>Edit your profile shown inside Forge.</div>
          </div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: BRAND.display, width: 84, height: 84, borderRadius: BRAND.radiusCard, background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, overflow: "hidden", display: "grid", placeItems: "center", color: BRAND.gold, fontWeight: 500 }}>
            {photoUrl ? <img src={photoUrl} alt="Coach" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(form.name)}
          </div>
          <label style={{ flex: 1 }}>
            <div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>Profile photo</div>
            <input type="file" accept="image/*" onChange={(e) => pickPhoto(e.target.files?.[0])} style={inputStyle()} />
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          <Field label="Coach name" value={form.name} onChange={(v) => set("name", v)} />
          <Field label="Email" value={form.email} onChange={(v) => set("email", v)} />
          <Field label="Phone number" value={form.phone} onChange={(v) => set("phone", v)} />
        </div>
        {message && <div style={{ color: BRAND.green, fontWeight: 500, fontSize: 13, marginTop: 12 }}>{message}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <Button disabled={saving} onClick={save} style={{ flex: 1 }}>{saving ? "Saving..." : "Save settings"}</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </Card>
    </div>
  );
}
export function computeNotifications(clients) {
  const items = [];
  clients.forEach((c) => {
    const unreadFromClient = (c.messages || []).filter((m) => m.from === "client" && !m.read).length;
    if (unreadFromClient > 0) items.push({ id: `msg_${c.id}`, type: "message", severity: 2, client: c, text: `${c.name} sent you ${unreadFromClient} message${unreadFromClient === 1 ? "" : "s"}` });

    const bday = nextBirthdayDaysAway(c.profile?.birthday);
    if (bday !== null && bday <= 7) items.push({ id: `bday_${c.id}`, type: "birthday", severity: 3, client: c, text: bday === 0 ? `${c.name}'s birthday is today!` : `${c.name}'s birthday is in ${bday} day${bday === 1 ? "" : "s"}` });

    // Scoped to Online clients: they're the ones on the self-serve pay-in-app
    // + 5-day-grace-then-lockout flow this mirrors (see paymentLockout() in
    // lib/clientData.js). In-person clients are paid in person/cash and never
    // hit that flow, so they don't get these particular pings.
    if (c.clientType === "Online" && c.paymentDueDate && !c.paymentPaid) {
      const d = daysUntil(c.paymentDueDate);
      if (d < 0) {
        const overdueDays = -d;
        if (overdueDays >= 5) items.push({ id: `pay_locked_${c.id}`, type: "payment", severity: 0, client: c, text: `${c.name} is locked out of the app for a missed payment (${overdueDays} days overdue)` });
        else items.push({ id: `pay_over_${c.id}`, type: "payment", severity: 0, client: c, text: `${c.name}'s payment is ${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue — locks out in ${5 - overdueDays} day${5 - overdueDays === 1 ? "" : "s"}` });
      } else if (d === 0) {
        items.push({ id: `pay_due_${c.id}`, type: "payment", severity: 1, client: c, text: `${c.name}'s payment is due today` });
      } else if (d === 3) {
        items.push({ id: `pay_3_${c.id}`, type: "payment", severity: 2, client: c, text: `${c.name}'s payment is due in 3 days` });
      } else if (d === 5) {
        items.push({ id: `pay_5_${c.id}`, type: "payment", severity: 2, client: c, text: `${c.name}'s payment is due in 5 days` });
      }
    }

    const lastFoodDate = Object.entries(c.nutrition?.food_log || {})
      .filter(([, day]) => MEAL_SLOTS.some((slot) => day?.[slot]) || day?.snacks?.length)
      .map(([date]) => date).sort().pop();
    const daysSinceFood = lastFoodDate ? daysSince(lastFoodDate) : (c.joinDate ? daysSince(c.joinDate) : null);
    if (daysSinceFood !== null && daysSinceFood >= 7) items.push({ id: `food_${c.id}`, type: "food", severity: 4, client: c, text: `${c.name} hasn't logged food in ${daysSinceFood} days` });

    if (c.clientType === "Online") {
      const lastSession = (c.trainingLogs?.sessions || []).filter((s) => s.status === "completed").map((s) => s.date).sort().pop();
      const daysSinceExercise = lastSession ? daysSince(lastSession) : (c.joinDate ? daysSince(c.joinDate) : null);
      if (daysSinceExercise !== null && daysSinceExercise >= 7) items.push({ id: `ex_${c.id}`, type: "exercise", severity: 4, client: c, text: `${c.name} hasn't logged a workout in ${daysSinceExercise} days` });
    }
  });
  return items.sort((a, b) => a.severity - b.severity);
}
export const NOTIF_ICONS = { message: "\u{1F4AC}", birthday: "\u{1F382}", payment: "\u{1F4B0}", food: "\u{1F37D}️", exercise: "\u{1F4AA}" };
// severity 0 = overdue/urgent (red), 1-2 = payment reminder (green), 3 =
// celebratory (violet), 4 = food (yellow)/exercise (orange) - each type gets
// its own fixed category color rather than a shared brand accent.
function notifTone(n) {
  if (n.type === "payment" && n.severity === 0) return { fg: BRAND.red, bg: BRAND.redBg, border: "rgba(220,80,70,0.2)" };
  if (n.type === "birthday") return { fg: BRAND.violet, bg: BRAND.violetBg, border: "rgba(183,156,232,0.18)" };
  if (n.type === "payment") return { fg: BRAND.green, bg: BRAND.greenBg, border: "rgba(102,199,155,0.15)" };
  if (n.type === "food") return { fg: BRAND.yellow, bg: BRAND.yellowBg, border: "rgba(240,190,60,0.18)" };
  return { fg: BRAND.orange, bg: BRAND.orangeBg, border: "rgba(255,159,69,0.18)" };
}
export function NotificationsTab({ notifications, selectClient }) {
  const [handled, setHandled] = useState(() => new Set());
  const [filter, setFilter] = useState("all");
  const unhandled = notifications.filter((n) => !handled.has(n.id));
  const shown = filter === "unhandled" ? unhandled : filter === "handled" ? notifications.filter((n) => handled.has(n.id)) : notifications;
  function markHandled(id) { setHandled((s) => new Set(s).add(id)); }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: BRAND.display, fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", color: BRAND.text }}>Alerts</div>
        {unhandled.length > 0 && <div style={{ background: BRAND.redBg, border: "1px solid rgba(220,80,70,0.25)", borderRadius: 20, padding: "4px 10px", fontFamily: BRAND.sans, fontWeight: 700, fontSize: 11, color: BRAND.red }}>{unhandled.length} unhandled</div>}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {[["all", "All"], ["unhandled", "Unhandled"], ["handled", "Handled"]].map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ background: filter === k ? BRAND.gold : BRAND.card, color: filter === k ? "#fff" : BRAND.muted, border: filter === k ? "none" : `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 20, padding: "6px 14px", fontFamily: BRAND.sans, fontWeight: filter === k ? 600 : 500, fontSize: 11, cursor: "pointer" }}>{label}</button>
        ))}
      </div>
      {shown.length === 0 && <Card><div style={{ color: BRAND.muted }}>{filter === "unhandled" ? "You're all caught up. No unhandled alerts." : "Nothing here."}</div></Card>}
      {shown.map((n) => {
        const tone = notifTone(n);
        const isHandled = handled.has(n.id);
        return (
          <div key={n.id} style={{ background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 16, padding: "13px 14px", opacity: isHandled ? 0.55 : 1 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: tone.bg, display: "grid", placeItems: "center", flexShrink: 0, fontSize: 18 }}>{NOTIF_ICONS[n.type]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: BRAND.sans, fontWeight: 600, fontSize: 13, color: BRAND.text }}>{n.client.name}</div>
                <div style={{ fontFamily: BRAND.sans, fontWeight: 400, fontSize: 11, color: BRAND.muted, marginTop: 4, lineHeight: 1.4 }}>{n.text}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 7 }}>
              <button onClick={() => selectClient(n.client)} style={{ flex: 1, background: tone.fg, border: "none", borderRadius: 10, padding: 9, fontFamily: BRAND.sans, fontWeight: 600, fontSize: 11, color: "#fff", cursor: "pointer" }}>Open Client</button>
              {!isHandled && <button onClick={() => markHandled(n.id)} style={{ flex: 1, background: BRAND.card, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 10, padding: 9, fontFamily: BRAND.sans, fontWeight: 500, fontSize: 11, color: BRAND.muted, cursor: "pointer" }}>Mark Handled</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
// ---------- Coach shell: Home · Clients · Alerts · Settings ----------
export function CoachPaymentsScreen({ clients, selectClient, onBack }) {
  const withDue = clients.filter((c) => c.paymentDueDate);
  const rank = (c) => { const s = paymentStatus(c); if (s.color === BRAND.red) return 0; if (s.color === BRAND.gold) return 1; if (s.color === BRAND.green) return 3; return 2; };
  const sorted = [...withDue].sort((a, b) => rank(a) - rank(b));
  const overdue = withDue.filter((c) => !c.paymentPaid && daysUntil(c.paymentDueDate) < 0).length;
  const dueSoon = withDue.filter((c) => !c.paymentPaid && daysUntil(c.paymentDueDate) >= 0 && daysUntil(c.paymentDueDate) <= 5).length;
  const paid = withDue.filter((c) => c.paymentPaid).length;
  return <div style={{ display: "grid", gap: 14 }}>
    <Button variant="ghost" onClick={onBack} style={{ padding: "8px 14px", justifySelf: "start" }}>‹ Back</Button>
    <div style={{ fontFamily: BRAND.display, fontSize: 24, fontWeight: 500, letterSpacing: "-0.01em" }}>Payments</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
      <Mini label="Overdue" value={String(overdue)} color={overdue ? BRAND.yellow : BRAND.text} />
      <Mini label="Due soon" value={String(dueSoon)} color={dueSoon ? BRAND.yellow : BRAND.text} />
      <Mini label="Paid" value={String(paid)} color={BRAND.green} />
    </div>
    <Card>
      <div style={{ fontWeight: 500, fontSize: 16, marginBottom: 4 }}>By client</div>
      {sorted.length === 0 && <div style={{ color: BRAND.muted }}>No payment dates set yet. Add a due date on a client to track it here.</div>}
      {sorted.map((c) => { const st = paymentStatus(c); return <div key={c.id} onClick={() => selectClient(c)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `${BRAND.hairline} solid ${BRAND.lineSoft}`, paddingTop: 10, marginTop: 10, cursor: "pointer" }}>
        <div><div style={{ fontWeight: 500 }}>{c.name}</div><div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 500 }}>{c.paymentDueDate}</div></div>
        <div style={{ color: st.color, fontWeight: 500, fontSize: 13, textAlign: "right" }}>{st.label}</div>
      </div>; })}
    </Card>
  </div>;
}
export function CoachBroadcastScreen({ clients, refresh, onBack }) {
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(null);
  async function sendAll() {
    if (!msg.trim()) return;
    if (!await confirmDialog(`Send this message to all ${clients.length} clients?`, { confirmLabel: "Send" })) return;
    setSending(true);
    const text = msg.trim();
    for (const c of clients) {
      const entry = { id: uid(), from: "coach", text, date: new Date().toISOString(), read: false };
      const list = [...(c.messages || []), entry];
      await upsertSection(c.id, "messages", { list });
    }
    if (refresh) await refresh();
    setSentCount(clients.length); setMsg(""); setSending(false);
  }
  return <div style={{ display: "grid", gap: 14 }}>
    <Button variant="ghost" onClick={onBack} style={{ padding: "8px 14px", justifySelf: "start" }}>‹ Back</Button>
    <div><div style={{ fontFamily: BRAND.display, fontSize: 24, fontWeight: 500, letterSpacing: "-0.01em" }}>Broadcast</div><div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 400, marginTop: 3 }}>Send one message to every client. Each one receives it in their Messages.</div></div>
    {sentCount != null && <Card style={{ borderColor: BRAND.green }}><div style={{ color: BRAND.green, fontWeight: 500 }}>Sent to {sentCount} client{sentCount === 1 ? "" : "s"}.</div></Card>}
    <Card style={{ display: "grid", gap: 10 }}>
      <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Write your message to all clients..." style={inputStyle({ minHeight: 130, resize: "vertical" })} />
      <Button onClick={sendAll} disabled={sending || !clients.length} style={{ width: "100%" }}>{sending ? "Sending..." : `Send to all ${clients.length} client${clients.length === 1 ? "" : "s"}`}</Button>
    </Card>
  </div>;
}
function ClientIntakeAnswers({ client, selectClient }) {
  const [open, setOpen] = useState(false);
  const answers = client.intake?.answers || [];
  const submitted = answers.length > 0;
  return (
    <Card style={{ padding: 14 }}>
      <button onClick={() => submitted && setOpen((v) => !v)} style={{ width: "100%", background: "none", border: "none", padding: 0, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: submitted ? "pointer" : "default", fontFamily: BRAND.sans }}>
        <div style={{ textAlign: "left" }}>
          <div style={{ color: BRAND.text, fontWeight: 500, fontSize: 15 }}>{client.name}</div>
          <div style={{ color: submitted ? BRAND.green : BRAND.dim, fontSize: 12, fontWeight: 500, marginTop: 2 }}>{submitted ? `${answers.length} answer${answers.length === 1 ? "" : "s"}` : "Not submitted yet"}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span onClick={(e) => { e.stopPropagation(); selectClient(client); }} style={{ color: BRAND.gold, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>Open client</span>
          {submitted && <span style={{ color: BRAND.dim, fontSize: 14 }}>{open ? "▾" : "▸"}</span>}
        </div>
      </button>
      {open && submitted && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `${BRAND.hairline} solid ${BRAND.lineSoft}`, display: "grid", gap: 10 }}>
          {answers.map((a, i) => (
            <div key={i}>
              <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 12, fontWeight: 500 }}>{a.question}</div>
              <div style={{ fontFamily: BRAND.sans, fontSize: 13, fontWeight: 500, color: BRAND.text, marginTop: 2 }}>{a.answer || "—"}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
export function CoachIntakeFormsScreen({ user, clients, selectClient, onBack }) {
  const submitted = clients.filter((c) => c.intake?.answers?.length);
  const pending = clients.filter((c) => !c.intake?.answers?.length);
  return <div style={{ display: "grid", gap: 14 }}>
    <Button variant="ghost" onClick={onBack} style={{ padding: "8px 14px", justifySelf: "start" }}>‹ Back</Button>
    <div><div style={{ fontFamily: BRAND.display, fontSize: 24, fontWeight: 500, letterSpacing: "-0.01em" }}>Intake form</div><div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 400, marginTop: 3 }}>The application every new client completes in-app. Tap a client below to see their answers.</div></div>

    {clients.length > 0 && (
      <div>
        <div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8 }}>Client answers ({submitted.length} of {clients.length} submitted)</div>
        <div style={{ display: "grid", gap: 8 }}>
          {[...submitted, ...pending].map((c) => <ClientIntakeAnswers key={c.id} client={c} selectClient={selectClient} />)}
        </div>
      </div>
    )}

    <div>
      <div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8 }}>Form questions</div>
      <div style={{ display: "grid", gap: 10 }}>
        {INTAKE_FORM.map((s) => <Card key={s.name}>
          <div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em" }}>{s.name}</div>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>{s.fields.map((f) => <div key={f.id} style={{ borderTop: `${BRAND.hairline} solid ${BRAND.lineSoft}`, paddingTop: 8 }}><div style={{ fontWeight: 500, fontSize: 14 }}>{f.q}{f.req ? "" : "  (optional)"}</div>{f.options && <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 400, marginTop: 3 }}>{f.options.join("  ·  ")}</div>}{f.type === "rating" && <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 400, marginTop: 3 }}>Rating 1 to 5</div>}</div>)}</div>
        </Card>)}
      </div>
    </div>
  </div>;
}
export function CoachAutomationsScreen({ user, onBack }) {
  const DEFAULTS = { staleWorkout: true, staleWorkoutDays: 3, checkinReminder: true, paymentReminder: true, welcomeMessage: false };
  const [rules, setRules] = useState(null);
  useEffect(() => {
    supabase.from("trainer_data").select("data").eq("trainer_id", user.id).eq("section", "automations").maybeSingle().then(({ data }) => setRules({ ...DEFAULTS, ...(data?.data?.rules || {}) }));
  }, [user.id]);
  async function persist(next) { setRules(next); await upsertTrainerData(user.id, "automations", { rules: next }); }
  if (rules === null) return <div style={{ display: "grid", gap: 14 }}><Button variant="ghost" onClick={onBack} style={{ padding: "8px 14px", justifySelf: "start" }}>‹ Back</Button><Card><div style={{ color: BRAND.muted }}>Loading...</div></Card></div>;
  const Row = ({ k, title, desc }) => <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderTop: `${BRAND.hairline} solid ${BRAND.lineSoft}`, paddingTop: 12, marginTop: 12 }}>
    <div><div style={{ fontWeight: 500, fontSize: 14 }}>{title}</div><div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 400, marginTop: 2 }}>{desc}</div></div>
    <button onClick={() => persist({ ...rules, [k]: !rules[k] })} style={{ width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", background: rules[k] ? BRAND.green : BRAND.card2, position: "relative", flexShrink: 0 }}><span style={{ position: "absolute", top: 3, left: rules[k] ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s" }} /></button>
  </div>;
  return <div style={{ display: "grid", gap: 14 }}>
    <Button variant="ghost" onClick={onBack} style={{ padding: "8px 14px", justifySelf: "start" }}>‹ Back</Button>
    <div><div style={{ fontFamily: BRAND.display, fontSize: 24, fontWeight: 500, letterSpacing: "-0.01em" }}>Automations</div><div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 400, marginTop: 3 }}>Rules that keep clients on track in the background.</div></div>
    <Card style={{ paddingTop: 4 }}>
      <Row k="staleWorkout" title="Inactivity nudge" desc={`Remind clients who have not logged a workout in ${rules.staleWorkoutDays} days`} />
      <Row k="checkinReminder" title="Weekly check-in reminder" desc="Nudge clients whose weekly check-in is due" />
      <Row k="paymentReminder" title="Payment reminder" desc="Remind clients before a payment is due" />
      <Row k="welcomeMessage" title="Welcome message" desc="Auto-message new clients when they join" />
    </Card>
    <Card style={{ borderColor: `color-mix(in srgb, ${BRAND.blue} 40%, transparent)` }}><div style={{ color: BRAND.blue, fontWeight: 500, fontSize: 13 }}>Heads up</div><div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 400, marginTop: 4, lineHeight: 1.5 }}>These rules are saved, but sending on a schedule needs a small Supabase scheduled function (cron), since the app cannot run timers while it is closed. Ask me to add it when you want automations to actually fire.</div></Card>
  </div>;
}

export function CoachToolsTab({ onOpen }) {
  const isMobile = useIsMobile(520);
  const TOOLS = [
    { key: "templates", name: "Programs", meta: "Templates & builder" },
    { key: "exercise_library", name: "Exercise Library", meta: "Custom moves & video" },
    { key: "calendar", name: "Calendar", meta: "Sessions & bookings" },
    { key: "analytics", name: "Analytics", meta: "Adherence & trends" },
    { key: "trials", name: "Trials", meta: "Consults & assessments" },
    { key: "buddypairs", name: "Buddy Pairs", meta: "Two clients, one slot" },
    { key: "content", name: "Content", meta: "Forge Academy articles" },
    { key: "payments", name: "Payments", meta: "Plans & invoices" },
    { key: "packages", name: "Packages", meta: "Design your offers" },
    { key: "forms", name: "Intake Forms", meta: "Onboarding & health" },
    { key: "broadcast", name: "Broadcast", meta: "Message every client" },
    { key: "automations", name: "Automations", meta: "Reminders & nudges" },
  ];
  return <div style={{ display: "grid", gap: 14 }}>
    <div><div style={{ fontFamily: BRAND.display, fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em" }}>Tools</div><div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 400, marginTop: 3 }}>Everything you run your coaching with</div></div>
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(auto-fit,minmax(150px,1fr))", gap: isMobile ? 12 : 14 }}>
      {TOOLS.map((t) => <button key={t.key} onClick={() => onOpen(t.key)} className="glass" style={{ fontFamily: BRAND.sans, textAlign: "left", cursor: "pointer", padding: 14, color: BRAND.text }}>
        <div style={{ width: 34, height: 34, borderRadius: BRAND.radiusControl, background: BRAND.card2, display: "grid", placeItems: "center", marginBottom: 10 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: BRAND.gold, display: "block" }} /></div>
        <div style={{ color: BRAND.text, fontSize: 13, fontWeight: 500 }}>{t.name}</div>
        <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 400, marginTop: 3 }}>{t.meta}</div>
      </button>)}
    </div>
  </div>;
}
export const COACH_NAV = [
  { key: "home", label: "Home", icon: "home" },
  { key: "clients", label: "Clients", icon: "clients" },
  { key: "tools", label: "Tools", icon: "templates" },
  { key: "alerts", label: "Alerts", icon: "bell" },
  { key: "settings", label: "Settings", icon: "gear" },
];
export function CoachBottomNav({ tab, setTab, unread }) {
  return (
    <div className="glass-nav" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 90, display: "flex", justifyContent: "space-around", paddingTop: 10, paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
      {COACH_NAV.map((item) => {
        const active = tab === item.key;
        const color = active ? BRAND.btnInk : BRAND.dim;
        return (
          <button key={item.key} onClick={() => setTab(item.key)} style={{ fontFamily: BRAND.sans, background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flex: 1, minWidth: 0, position: "relative", padding: 0 }}>
            <div className={active ? "glass-pill-active" : undefined} style={{ width: 42, height: 28, borderRadius: 999, display: "grid", placeItems: "center", transition: "box-shadow .2s, background .2s" }}>
              {item.icon === "gear" || item.icon === "home" ? <NavIcon name={item.icon} color={color} /> : <CoachIcon name={item.icon} size={21} color={color} />}
              {item.key === "alerts" && unread > 0 && <div style={{ position: "absolute", top: -2, right: 10, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: BRAND.yellow, color: "#000", fontSize: 9, fontWeight: 500, display: "grid", placeItems: "center", border: `2px solid var(--shell)` }}>{unread > 9 ? "9+" : unread}</div>}
            </div>
            <div style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? BRAND.text : BRAND.dim }}>{item.label}</div>
          </button>
        );
      })}
    </div>
  );
}
export function CoachTile({ icon, name, meta, count, quiet, wide, isTablet, color = BRAND.gold, onClick }) {
  return (
    <button onClick={onClick} className="glass" style={{
      fontFamily: BRAND.sans,
      gridColumn: wide ? "1 / -1" : "auto",
      padding: isTablet ? 24 : 18, minHeight: wide ? (isTablet ? 110 : 96) : (isTablet ? 172 : 136), cursor: "pointer", position: "relative",
      display: "flex", flexDirection: wide ? "row" : "column", alignItems: wide ? "center" : "flex-start",
      justifyContent: wide ? "flex-start" : "space-between", gap: wide ? 16 : 0, textAlign: "left", minWidth: 0,
    }}>
      {count != null && !wide && (
        <div style={{ position: "absolute", top: isTablet ? 20 : 16, right: isTablet ? 20 : 16, minWidth: isTablet ? 26 : 22, height: isTablet ? 26 : 22, padding: "0 7px", borderRadius: 999, background: quiet ? "transparent" : color, border: quiet ? `${BRAND.hairline} solid ${BRAND.line}` : "none", color: quiet ? BRAND.dim : "#000", fontSize: isTablet ? 13 : 11, fontWeight: 500, display: "grid", placeItems: "center" }}>{count}</div>
      )}
      <div style={{ width: isTablet ? 66 : 52, height: isTablet ? 66 : 52, borderRadius: isTablet ? BRAND.radiusCard : BRAND.radiusControl, background: BRAND.card2, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <CoachIcon name={icon} size={isTablet ? 32 : 26} color={color} />
      </div>
      <div style={{ flex: wide ? 1 : "none", width: wide ? "auto" : "100%", minWidth: 0, marginTop: wide ? 0 : "auto" }}>
        <div style={{ fontWeight: 500, fontSize: 15, color: BRAND.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
        <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 400, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</div>
      </div>
      {wide && <NavIcon name="back" size={18} color={BRAND.dim} rotate={180} />}
    </button>
  );
}
export function coachStats(clients) {
  const lastSessionOf = (c) => (c.trainingLogs?.sessions || []).filter((s) => s.status === "completed" && s.date).map((s) => s.date).sort().pop();
  const cold = clients.filter((c) => {
    const last = lastSessionOf(c);
    const d = last ? daysSince(last) : (c.joinDate ? daysSince(c.joinDate) : null);
    return d !== null && d >= 7;
  });
  const scored = clients.map((c) => overallAdherence(c.program, c.trainingLogs)).filter((a) => a.total > 0);
  const adherence = scored.length ? Math.round(scored.reduce((s, a) => s + a.pct, 0) / scored.length) : null;
  const todayISO = isoDate(new Date());
  const sessionsToday = clients.reduce((n, c) => {
    const days = buildProgramDays(c.program, c.trainingLogs);
    return n + days.filter((d) => d.dateISO === todayISO && !d.isRest).length;
  }, 0);
  return { cold, adherence, sessionsToday, lastSessionOf };
}
export function CoachHome({ trainer, user, clients, notifications, templatesCount, trialsCount, onTile, onOpenClients, selectClient }) {
  const isMobile = useIsMobile(520);
  const isTablet = useIsMobile(1180) && !isMobile;
  const { cold, adherence, sessionsToday } = coachStats(clients);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  const name = (trainer?.name || user.email?.split("@")[0] || "Coach").split(" ")[0];
  const flagged = cold.length;
  const [customExerciseCount, setCustomExerciseCount] = useState(0);
  const [agenda, setAgenda] = useState(null);
  const todaysSessions = agenda ? agenda.sessions.length : null;
  useEffect(() => { let active = true; loadTodaysAgenda(clients, user.id).then((a) => { if (active) setAgenda(a); }); return () => { active = false; }; }, [clients, user.id]);
  useEffect(() => { loadExerciseLibraryData(user.id).then((items) => setCustomExerciseCount(items.length)); }, [user.id]);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em" }}>
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </div>
        <div style={{ fontFamily: BRAND.display, fontSize: isMobile ? 26 : 30, fontWeight: 500, letterSpacing: "-0.01em", marginTop: 4 }}>{greeting}, {name}</div>
        <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 400, marginTop: 3 }}>
          {todaysSessions ?? "..."} session{todaysSessions === 1 ? "" : "s"} scheduled today{flagged > 0 ? ` · ${flagged} need attention` : ""}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
        <Mini label="Active" value={String(clients.length)} />
        <Mini label="Adherence" value={adherence != null ? `${adherence}%` : "-"} color={BRAND.green} />
        <Mini label="Alerts" value={String(notifications.length)} color={notifications.length > 0 ? BRAND.yellow : BRAND.text} />
      </div>
      {agenda && (agenda.sessions.length > 0 || agenda.checkInsDue.length > 0 || agenda.paymentsDue.length > 0) && (
        <Card style={{ padding: 16 }}>
          <div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>Today</div>
          {agenda.sessions.map((s) => {
            const client = clients.find((c) => c.id === s.clientId);
            return (
              <div key={s.id} onClick={() => client && selectClient?.(client)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `${BRAND.hairline} solid ${BRAND.lineSoft}`, cursor: client ? "pointer" : "default" }}>
                <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 500, width: 58, flexShrink: 0 }}>{timeLabel(s.time)}</div>
                <div style={{ flex: 1, minWidth: 0, fontWeight: 500, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</div>
                {s.hasInjury && <span title={s.injuryNote} style={{ color: BRAND.yellow, fontSize: 12, fontWeight: 500, flexShrink: 0 }}>⚠</span>}
              </div>
            );
          })}
          {agenda.checkInsDue.length > 0 && (
            <div onClick={onOpenClients} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: agenda.paymentsDue.length > 0 ? `${BRAND.hairline} solid ${BRAND.lineSoft}` : "none", cursor: "pointer" }}>
              <span style={{ color: BRAND.muted, fontSize: 12, fontWeight: 400 }}>Check-ins due</span>
              <span style={{ color: BRAND.yellow, fontWeight: 500, fontSize: 12 }}>{agenda.checkInsDue.length}</span>
            </div>
          )}
          {agenda.paymentsDue.length > 0 && (
            <div onClick={onOpenClients} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", cursor: "pointer" }}>
              <span style={{ color: BRAND.muted, fontSize: 12, fontWeight: 400 }}>Payments due</span>
              <span style={{ color: BRAND.yellow, fontWeight: 500, fontSize: 12 }}>{agenda.paymentsDue.length}</span>
            </div>
          )}
        </Card>
      )}
      <div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", marginTop: 4 }}>Go to</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: isTablet ? 18 : 12 }}>
        <CoachTile isTablet={isTablet} icon="clients" name="Clients" meta={`${clients.length} active${flagged ? ` · ${flagged} flagged` : ""}`} count={clients.length} onClick={onOpenClients} />
        <CoachTile isTablet={isTablet} icon="templates" name="Templates" meta={`${templatesCount} program${templatesCount === 1 ? "" : "s"} saved`} count={templatesCount} quiet onClick={() => onTile("templates")} />
        <CoachTile isTablet={isTablet} icon="calendar" name="Calendar" meta={`${todaysSessions ?? "..."} session${todaysSessions === 1 ? "" : "s"} today`} count={todaysSessions || null} onClick={() => onTile("calendar")} />
        <CoachTile isTablet={isTablet} icon="analytics" name="Analytics" meta="Client activity trends" onClick={() => onTile("analytics")} />
        <CoachTile isTablet={isTablet} icon="exlib" name="Exercise Library" meta={customExerciseCount ? `${customExerciseCount} custom exercise${customExerciseCount === 1 ? "" : "s"}` : "Add your own with video"} onClick={() => onTile("exercise_library")} />
        <CoachTile isTablet={isTablet} icon="trials" name="Trials" meta={trialsCount ? `${trialsCount} saved · consultations & assessments` : "Consultations & fitness assessments"} count={trialsCount || null} onClick={() => onTile("trials")} />
      </div>
    </div>
  );
}
export function CoachTemplates({ user, clients, refresh, onBack }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [assigningTemplate, setAssigningTemplate] = useState(null);
  const [assignClientId, setAssignClientId] = useState("");
  const [assigning, setAssigning] = useState(false);
  useEffect(() => {
    let active = true;
    loadTrainerTemplates(user.id).then((list) => { if (active) { setTemplates(list); setLoading(false); } });
    return () => { active = false; };
  }, [user.id]);
  async function save(next) { setTemplates(next); await upsertTrainerData(user.id, "templates", { templates: next }); }
  async function remove(t) {
    if (!await confirmDialog(`Delete the template "${t.name}"? Programs already assigned to clients are not affected.`, { danger: true, confirmLabel: "Delete" })) return;
    save(templates.filter((x) => x.id !== t.id));
  }
  async function saveEditedTemplate(updatedProgram) {
    const next = templates.map((t) => (t.id === editingTemplate.id ? { ...t, name: updatedProgram.name || t.name, goal: updatedProgram.goal, weeks: updatedProgram.weeks.length, program: updatedProgram } : t));
    await save(next);
    setEditingTemplate(null);
  }
  function startAssign(t) { setAssigningTemplate(t); setAssignClientId(""); }
  async function confirmAssign() {
    const client = clients.find((c) => c.id === assignClientId);
    if (!client) return;
    if (!await confirmDialog(`Assign "${assigningTemplate.name}" to ${client.name}? ${client.program ? "This replaces their current program." : ""} Logged history is never touched.`, { confirmLabel: "Assign" })) return;
    setAssigning(true);
    const nextProgram = { ...cloneWithNewIds(assigningTemplate.program), id: uid(), startDate: isoDate(), templateId: assigningTemplate.id };
    const { error } = await upsertSection(client.id, "program", nextProgram);
    setAssigning(false);
    if (error) { showToast(error.message || "Couldn't assign that template. Check your connection and try again.", "error"); return; }
    showToast(`Assigned "${assigningTemplate.name}" to ${client.name}.`, "success");
    setAssigningTemplate(null);
    await refresh?.();
  }
  if (editingTemplate) {
    return <ProgramBuilder
      client={{ id: null, trainer_id: user.id, name: editingTemplate.name, goal: editingTemplate.goal }}
      program={editingTemplate.program}
      onClose={() => setEditingTemplate(null)}
      onSave={saveEditedTemplate}
    />;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 14 }}>
      <Button variant="ghost" onClick={onBack} style={{ justifySelf: "start", padding: "8px 14px" }}>‹ Back</Button>
      <div>
        <div style={{ fontFamily: BRAND.display, fontSize: 24, fontWeight: 500, letterSpacing: "-0.01em" }}>Templates</div>
        <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 400, marginTop: 3 }}>{templates.length} saved program{templates.length === 1 ? "" : "s"}</div>
      </div>
      {loading && <Card><div style={{ color: BRAND.muted }}>Loading...</div></Card>}
      {!loading && templates.length === 0 && (
        <Card>
          <div style={{ color: BRAND.text, fontWeight: 500, marginBottom: 6 }}>No templates yet</div>
          <div style={{ color: BRAND.muted, fontSize: 13, lineHeight: 1.55 }}>
            Open a client, build a program, then hit <b style={{ color: BRAND.gold, fontWeight: 500 }}>Save as Template</b> in the builder. It'll show up here and you can assign it to any client.
          </div>
        </Card>
      )}
      {templates.map((t) => {
        const usedBy = clients.filter((c) => c.program?.templateId === t.id).length;
        const isAssigning = assigningTemplate?.id === t.id;
        return (
          <Card key={t.id} flat style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 16 }}>{t.name}</div>
                <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 400, marginTop: 3 }}>
                  {[t.goal, `${t.weeks} week${t.weeks === 1 ? "" : "s"}`, t.savedAt ? `saved ${String(t.savedAt).slice(0, 10)}` : null].filter(Boolean).join(" · ")}
                  {usedBy > 0 ? ` · used by ${usedBy}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button onClick={() => (isAssigning ? setAssigningTemplate(null) : startAssign(t))} style={{ fontSize: 12, padding: "8px 14px" }}>{isAssigning ? "Cancel" : "Assign"}</Button>
                <Button variant="dark" onClick={() => setEditingTemplate(t)} style={{ fontSize: 12, padding: "8px 14px" }}>Edit</Button>
                <Button variant="red" onClick={() => remove(t)} style={{ fontSize: 12, padding: "8px 14px" }}>Delete</Button>
              </div>
            </div>
            {isAssigning && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: `${BRAND.hairline} solid ${BRAND.lineSoft}` }}>
                <select value={assignClientId} onChange={(e) => setAssignClientId(e.target.value)} style={inputStyle({ maxWidth: 280, flex: 1 })}>
                  <option value="">Choose a client...</option>
                  {[...clients].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}{c.program ? " (has a program)" : ""}</option>)}
                </select>
                <Button disabled={!assignClientId || assigning} onClick={confirmAssign}>{assigning ? "Assigning..." : "Confirm assign"}</Button>
              </div>
            )}
          </Card>
        );
      })}
      <Card style={{ background: BRAND.card2 }}>
        <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 400, lineHeight: 1.55 }}>
          Hit <b style={{ color: BRAND.gold, fontWeight: 500 }}>Assign</b> above to send a template straight to a client, or open a client → Program → Edit Program → <b style={{ color: BRAND.gold, fontWeight: 500 }}>Load from template</b> to load it into a program you're already editing.
        </div>
      </Card>
    </div>
  );
}
export function CoachAnalytics({ clients, selectClient, onBack }) {
  const isMobile = useIsMobile(520);
  const { cold, adherence, lastSessionOf } = coachStats(clients);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const pbsThisMonth = clients.reduce((n, c) => n + recentPBsAcrossHistory(c.trainingLogs, 20).filter((pb) => pb.date && pb.date.slice(0, 7) === thisMonth).length, 0);
  const overduePayments = clients.filter((c) => c.clientType === "Online" && paymentStatus(c).label?.toLowerCase().includes("overdue")).length;
  // Completed sessions bucketed into the last 8 calendar weeks, across every client.
  const weeks = [];
  const thisMonday = startOfWeek(new Date());
  for (let i = 7; i >= 0; i--) {
    const start = addDays(thisMonday, -i * 7);
    weeks.push({ start, startISO: isoDate(start), endISO: isoDate(addDays(start, 6)), count: 0 });
  }
  clients.forEach((c) => {
    (c.trainingLogs?.sessions || []).forEach((s) => {
      if (s.status !== "completed" || !s.date) return;
      const bucket = weeks.find((w) => s.date >= w.startISO && s.date <= w.endISO);
      if (bucket) bucket.count += 1;
    });
  });
  const maxWeek = Math.max(1, ...weeks.map((w) => w.count));
  const total = weeks.reduce((n, w) => n + w.count, 0);
  const rows = clients
    .map((c) => ({ client: c, adherence: overallAdherence(c.program, c.trainingLogs), last: lastSessionOf(c) }))
    .sort((a, b) => (a.adherence.pct || 0) - (b.adherence.pct || 0));
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Button variant="ghost" onClick={onBack} style={{ justifySelf: "start", padding: "8px 14px" }}>‹ Back</Button>
      <div>
        <div style={{ fontFamily: BRAND.display, fontSize: 24, fontWeight: 500, letterSpacing: "-0.01em" }}>Analytics</div>
        <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 400, marginTop: 3 }}>Client activity, last 8 weeks</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
        <Mini label="Sessions" value={String(total)} />
        <Mini label="Avg adherence" value={adherence != null ? `${adherence}%` : "-"} color={BRAND.green} />
        <Mini label="Going cold" value={String(cold.length)} color={cold.length > 0 ? BRAND.yellow : BRAND.text} />
        <Mini label="PBs this month" value={String(pbsThisMonth)} color={BRAND.blue} />
        <Mini label="Payments overdue" value={String(overduePayments)} color={overduePayments > 0 ? BRAND.yellow : BRAND.text} />
      </div>
      <div>
        <div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8 }}>Sessions completed per week</div>
        <Card style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 110 }}>
            {weeks.map((w, i) => {
              const isLast = i === weeks.length - 1;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 4 }}>
                  <div style={{ color: isLast ? BRAND.text : BRAND.dim, fontSize: 10, fontWeight: 500 }}>{w.count}</div>
                  <div style={{ width: "100%", height: `${Math.max(3, (w.count / maxWeek) * 70)}%`, background: isLast ? BRAND.green : BRAND.lineSoft, borderRadius: "4px 4px 0 0" }} />
                  <div style={{ color: BRAND.dim, fontSize: 9, fontWeight: 400 }}>{isLast ? "Now" : `-${weeks.length - 1 - i}`}</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
      <div>
        <div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8 }}>Adherence by client · lowest first</div>
        <Card style={{ padding: 16 }}>
          {rows.length === 0 && <div style={{ color: BRAND.muted, fontSize: 13 }}>No clients yet.</div>}
          {rows.map(({ client, adherence: a, last }, i) => {
            const pct = a.total ? a.pct : 0;
            const days = last ? daysSince(last) : null;
            const warn = pct < 70 || (days !== null && days >= 7);
            return (
              <div key={client.id} onClick={() => selectClient(client)} style={{ padding: "10px 0", borderTop: i === 0 ? "none" : `${BRAND.hairline} solid ${BRAND.lineSoft}`, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{client.name}</span>
                  <span style={{ color: warn ? BRAND.yellow : BRAND.muted, fontSize: 12, fontWeight: 500 }}>
                    {a.total ? `${pct}%` : "No program"}{days !== null ? ` · ${days}d ago` : ""}
                  </span>
                </div>
                <div style={{ height: 4, background: BRAND.lineSoft, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: warn ? BRAND.yellow : BRAND.green }} />
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
function SettingsGlassSection({ label, children, extra }) {
  return (
    <div>
      {label && <div style={{ fontFamily: BRAND.sans, fontSize: 10, fontWeight: 400, color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span>{extra}
      </div>}
      <div className="glass" style={{ overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}
function CoachSettingsRow({ k, v, onClick, last, danger }) {
  return (
    <div onClick={onClick} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "13px 16px", borderBottom: last ? "none" : `${BRAND.hairline} solid ${BRAND.lineSoft}`, cursor: onClick ? "pointer" : "default" }}>
      <span style={{ fontFamily: BRAND.sans, fontWeight: 500, fontSize: 13, flexShrink: 0, color: danger ? BRAND.red : BRAND.text }}>{k}</span>
      <span style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontWeight: 500, fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, textAlign: "right" }}>{v}</span>
    </div>
  );
}
export function CoachSettingsTab({ user, trainer, onEditProfile, clientsCount, syncStatus, onOpenTool }) {
  const [busy, setBusy] = useState(false);
  const trainerPhotoUrl = usePhotoUrl(trainer?.photo);
  async function logout() { setBusy(true); await supabase.auth.signOut(); }
  const syncLabel = syncStatus === "offline" ? "Offline" : syncStatus === "syncing" ? "Syncing" : "Synced";
  return <div style={{ display: "grid", gap: 14 }}>
    <div style={{ fontFamily: BRAND.display, fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", color: BRAND.text }}>Settings</div>
    <div onClick={onEditProfile} className="glass" style={{ cursor: "pointer", padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ fontFamily: BRAND.display, width: 56, height: 56, borderRadius: "50%", background: `linear-gradient(135deg, ${BRAND.accentDeep}, ${BRAND.gold})`, overflow: "hidden", display: "grid", placeItems: "center", color: BRAND.btnInk, fontWeight: 800, fontSize: 18, flexShrink: 0 }}>{trainerPhotoUrl ? <img src={trainerPhotoUrl} alt="Coach" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(trainer?.name || user.email)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: BRAND.sans, fontWeight: 700, fontSize: 16, color: BRAND.text }}>{trainer?.name || user.email?.split("@")[0]}</div>
        <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 11, fontWeight: 400, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Online Fitness Coach</div>
        <div style={{ fontFamily: BRAND.sans, color: BRAND.gold, fontSize: 10, fontWeight: 400, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>
      </div>
      <div style={{ border: `${BRAND.hairline} solid ${BRAND.lineStrong}`, borderRadius: 10, padding: "7px 12px", fontFamily: BRAND.sans, fontWeight: 500, fontSize: 11, color: BRAND.muted, flexShrink: 0 }}>Edit</div>
    </div>
    <SettingsGlassSection label="Appearance">
      <div style={{ padding: 16 }}>
        <div style={{ fontFamily: BRAND.sans, fontWeight: 600, fontSize: 13, color: BRAND.text, marginBottom: 12 }}>Theme</div>
        <ThemeToggle />
      </div>
    </SettingsGlassSection>
    <SettingsGlassSection label="Brand">
      <CoachSettingsRow k="Business name" v={`${trainer?.name || "Set"} ›`} onClick={onEditProfile} />
      <CoachSettingsRow k="Coach photo / logo" v={trainer?.photo ? "Set ›" : "Add ›"} onClick={onEditProfile} last />
    </SettingsGlassSection>
    <SettingsGlassSection label="Payments">
      <CoachSettingsRow k="Provider" v="PayPal" />
      <CoachSettingsRow k="Client payments" v="Open ›" onClick={() => onOpenTool?.("payments")} last />
    </SettingsGlassSection>
    <SettingsGlassSection label="Notifications">
      <CoachSettingsRow k="Automations & reminders" v="Open ›" onClick={() => onOpenTool?.("automations")} last />
    </SettingsGlassSection>
    <SettingsGlassSection label="Account">
      <CoachSettingsRow k="Active clients" v={String(clientsCount)} />
      <CoachSettingsRow k="Sync" v={syncLabel} last />
    </SettingsGlassSection>
    <button onClick={logout} disabled={busy} style={{ width: "100%", background: BRAND.redBg, border: `${BRAND.hairline} solid rgba(220,80,70,0.18)`, borderRadius: 14, padding: 14, color: BRAND.red, fontFamily: BRAND.sans, fontWeight: 600, fontSize: 13, cursor: busy ? "not-allowed" : "pointer" }}>{busy ? "Logging out..." : "Log Out"}</button>
  </div>;
}

// `tab`/`setTab` and `screen`/`setScreen` are optionally controlled: pass
// them (e.g. from a router route) to drive navigation externally, or omit
// them to fall back to this component's own internal state - unchanged
// from how it always worked before routes existed.
export function CoachDashboard({ user, trainer, setTrainer, clients, setClients, selectClient, refresh, syncStatus = "online", tab: tabProp, setTab: setTabProp, screen: screenProp, setScreen: setScreenProp }) {
  const trainerPhotoUrl = usePhotoUrl(trainer?.photo);
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tabState, setTabState] = useState("home");
  const tab = tabProp !== undefined ? tabProp : tabState;
  const setTab = setTabProp || setTabState;
  const [clientTypeFilter, setClientTypeFilter] = useState("1:1"); // In-Person by default
  const [sortBy, setSortBy] = useState("recent");
  const [screenState, setScreenState] = useState(null); // templates | calendar | analytics | trials
  const screen = screenProp !== undefined ? screenProp : screenState;
  const setScreen = setScreenProp || setScreenState;
  const [toolOrigin, setToolOrigin] = useState("tools");
  const [query, setQuery] = useState("");
  const [templatesCount, setTemplatesCount] = useState(0);
  const [trialsCount, setTrialsCount] = useState(0);
  const isMobile = useIsMobile(520);
  const isTablet = useIsMobile(1180) && !isMobile;
  const filtered = clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) && (c.clientType || "1:1") === clientTypeFilter);
  function adherenceSortValue(c) { const a = overallAdherence(c.program, c.trainingLogs); return a.total > 0 ? a.pct : 101; }
  const sorted = sortBy === "name" ? [...filtered].sort((a, b) => a.name.localeCompare(b.name))
    : sortBy === "adherence" ? [...filtered].sort((a, b) => adherenceSortValue(a) - adherenceSortValue(b))
    : filtered;
  const notifications = computeNotifications(clients);
  // Used by the buddy pair slot view, which mounts two ProgramTab instances
  // (one per member) side by side - each needs its own updateClient so a
  // set logged for one member never touches the other's local state.
  function updateClientLocal(updated) { setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c))); }
  useEffect(() => {
    let active = true;
    loadTrainerTemplates(user.id).then((list) => { if (active) setTemplatesCount(list.length); });
    supabase.from("trainer_data").select("data").eq("trainer_id", user.id).eq("section", "trials").maybeSingle()
      .then(({ data }) => { if (active) setTrialsCount((data?.data?.trials || []).length); });
    return () => { active = false; };
  }, [user.id, screen]);
  async function createClient(form) {
    if (typeof navigator !== "undefined" && !navigator.onLine) { showToast("You're offline. Creating a new client needs an internet connection - please try again once you're back online.", "warn"); return; }
    const color = form.color || getClientColor(uid(), clients.length);
    const invite_code = makeInviteCode();
    const payload = { trainer_id: user.id, name: form.name, email: form.email, phone: form.phone, age: ageFromBirthday(form.profile.birthday) || 0, weight_kg: Number(form.weight || 0), goal: form.profile.goals?.[0] || "General Fitness", color, invite_code, invite_status: "not_sent" };
    const { data, error } = await supabase.from("clients").insert(payload).select("*").single();
    if (error) { showToast(error.message, "error"); return; }
    let profile = form.profile;
    try {
      if (form.photoFile) {
        const blob = await compressImage(form.photoFile);
        const path = await uploadClientPhoto(data.id, "profile", blob);
        profile = { ...profile, photo: path };
      }
      await upsertSection(data.id, "profile", profile);
    } catch (error) {
      showToast(`${form.name} was created, but saving their photo/profile details failed: ${error.message || "please add them from the client's Profile tab."}`, "error");
    }
    setShowAdd(false);
    await refresh();
  }
  async function convertTrialToClient(trial) {
    if (typeof navigator !== "undefined" && !navigator.onLine) { showToast("You're offline. Converting a trial needs an internet connection - please try again once you're back online.", "warn"); return null; }
    const color = getClientColor(uid(), clients.length);
    const invite_code = makeInviteCode();
    const payload = { trainer_id: user.id, name: trial.name, email: trial.email, phone: trial.phone, age: 0, weight_kg: 0, goal: trial.goal ? trial.goal.slice(0, 60) : "General Fitness", color, invite_code, invite_status: "not_sent" };
    const { data, error } = await supabase.from("clients").insert(payload).select("*").single();
    if (error) { showToast(error.message, "error"); return null; }
    const profile = {
      ...emptyProfile(),
      injuries: trial.injuries || "",
      medicalIssues: trial.medicalIssues || "",
      barriers: trial.barriers || "",
      sleep: trial.sleep || "",
      neat: trial.neat || "",
    };
    await upsertSection(data.id, "profile", profile);
    await upsertSection(data.id, "trial", trial);
    await refresh();
    return data.id;
  }
  function goHome() { setScreen(null); setTab(toolOrigin); }
  let body;
  if (screen === "templates") body = <CoachTemplates user={user} clients={clients} refresh={refresh} onBack={goHome} />;
  else if (screen === "calendar") body = <><Button variant="ghost" onClick={goHome} style={{ padding: "8px 14px", marginBottom: 12 }}>‹ Back</Button><Calendar clients={clients} refresh={refresh} user={user} /></>;
  else if (screen === "analytics") body = <CoachAnalytics clients={clients} selectClient={selectClient} onBack={goHome} />;
  else if (screen === "trials") body = <><Button variant="ghost" onClick={goHome} style={{ padding: "8px 14px", marginBottom: 12 }}>‹ Back</Button><Trials user={user} onConvert={convertTrialToClient} /></>;
  else if (screen === "exercise_library") body = <ExerciseLibraryScreen trainerId={user.id} onBack={goHome} />;
  else if (screen === "content") body = <CoachContentScreen user={user} onBack={goHome} />;
  else if (screen === "payments") body = <CoachPaymentsScreen clients={clients} selectClient={selectClient} onBack={goHome} />;
  else if (screen === "forms") body = <CoachIntakeFormsScreen user={user} clients={clients} selectClient={selectClient} onBack={goHome} />;
  else if (screen === "broadcast") body = <CoachBroadcastScreen clients={clients} refresh={refresh} onBack={goHome} />;
  else if (screen === "automations") body = <CoachAutomationsScreen user={user} onBack={goHome} />;
  else if (screen === "buddypairs") body = <BuddyPairsScreen user={user} clients={clients} updateClient={updateClientLocal} onBack={goHome} />;
  else if (screen === "packages") body = <PackageDesigner user={user} clients={clients} updateClient={updateClientLocal} onBack={goHome} />;
  else if (tab === "home") body = (
    <CoachHome
      trainer={trainer} user={user} clients={clients} notifications={notifications}
      templatesCount={templatesCount} trialsCount={trialsCount}
      onTile={(k) => { setToolOrigin("home"); setScreen(k); }} onOpenClients={() => setTab("clients")}
      selectClient={selectClient}
    />
  );
  else if (tab === "clients") body = (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontFamily: BRAND.display, fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em" }}>Clients</div>
        <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 400, marginTop: 3 }}>{filtered.length} {clientTypeFilter === "1:1" ? "in-person" : "online"}</div>
      </div>
      <div style={{ display: "flex", gap: 8, background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 999, padding: 4 }}>
        <button onClick={() => setClientTypeFilter("1:1")} style={{ fontFamily: BRAND.sans, flex: 1, padding: "10px 0", borderRadius: 999, border: "none", background: clientTypeFilter === "1:1" ? BRAND.btnBg : "transparent", color: clientTypeFilter === "1:1" ? BRAND.btnInk : BRAND.muted, fontWeight: 500, fontSize: 13, cursor: "pointer" }}>In-Person</button>
        <button onClick={() => setClientTypeFilter("Online")} style={{ fontFamily: BRAND.sans, flex: 1, padding: "10px 0", borderRadius: 999, border: "none", background: clientTypeFilter === "Online" ? BRAND.btnBg : "transparent", color: clientTypeFilter === "Online" ? BRAND.btnInk : BRAND.muted, fontWeight: 500, fontSize: 13, cursor: "pointer" }}>Online</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto auto", gap: 10 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients..." style={inputStyle()} />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={inputStyle({ width: "auto" })}>
          <option value="recent">Sort: Recent</option>
          <option value="name">Sort: Name</option>
          <option value="adherence">Sort: Adherence</option>
        </select>
        <Button onClick={() => setShowAdd(true)}>+ Add new client</Button>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : isTablet ? "repeat(3,minmax(0,1fr))" : "repeat(auto-fit,minmax(150px,1fr))",
        gap: isMobile ? 12 : isTablet ? 14 : 18,
        alignItems: "start",
      }}>
        {sorted.map((c, i) => <ClientCard key={c.id} client={c} onClick={() => selectClient(c)} index={i} />)}
      </div>
      {filtered.length === 0 && <Card><div style={{ color: BRAND.muted }}>No {clientTypeFilter === "1:1" ? "in-person" : "online"} clients{query ? " match that search" : " yet"}.</div></Card>}
    </div>
  );
  else if (tab === "tools") body = <CoachToolsTab onOpen={(k) => { setToolOrigin("tools"); setScreen(k); }} />;
  else if (tab === "alerts") body = (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontFamily: BRAND.display, fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em" }}>Alerts</div>
        <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 400, marginTop: 3 }}>{notifications.length ? `${notifications.length} need${notifications.length === 1 ? "s" : ""} a look` : "All caught up"}</div>
      </div>
      <NotificationsTab notifications={notifications} selectClient={selectClient} />
    </div>
  );
  else body = <CoachSettingsTab user={user} trainer={trainer} onEditProfile={() => setShowSettings(true)} clientsCount={clients.length} syncStatus={syncStatus} onOpenTool={(k) => { setToolOrigin("settings"); setScreen(k); }} />;
  return (
    <div data-app="coach" style={{ minHeight: "100vh", background: BRAND.bg, color: BRAND.text, fontFamily: BRAND.sans, paddingBottom: 96 }}>
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "color-mix(in srgb, var(--page) 93%, transparent)", backdropFilter: "blur(16px)", borderBottom: `${BRAND.hairline} solid ${BRAND.line}`, padding: isMobile ? "10px 12px" : "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: BRAND.display, width: isMobile ? 38 : 44, height: isMobile ? 38 : 44, borderRadius: "50%", background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, overflow: "hidden", display: "grid", placeItems: "center", color: BRAND.gold, fontWeight: 500 }}>
            {trainerPhotoUrl ? <img src={trainerPhotoUrl} alt="Coach" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(trainer?.name || user.email)}
          </div>
          <div>
            <div style={{ fontFamily: BRAND.display, fontSize: isMobile ? 22 : 26, fontWeight: 500, letterSpacing: "-0.01em", color: BRAND.text, lineHeight: 1 }}>Forge</div>
            <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 500 }}>Coach {trainer?.name || user.email?.split("@")[0]}</div>
          </div>
        </div>
        <span style={{ color: syncStatus === "offline" ? BRAND.yellow : syncStatus === "syncing" ? BRAND.blue : BRAND.green, fontSize: 12, fontWeight: 500 }}>
          {syncStatus === "offline" ? "Offline" : syncStatus === "syncing" ? "Syncing" : "Synced"}
        </span>
      </header>
      <main style={{ width: "100%", maxWidth: isMobile ? 480 : isTablet ? 960 : 1180, margin: "0 auto", padding: isMobile ? 12 : 16, boxSizing: "border-box", overflowX: "hidden" }}>
        {body}
      </main>
      <CoachBottomNav tab={screen ? toolOrigin : tab} setTab={(t) => { setScreen(null); setTab(t); }} unread={notifications.length} />
      {showAdd && <AddClientModal onClose={() => setShowAdd(false)} onCreate={createClient} />}
      {showSettings && <CoachSettingsModal user={user} trainer={trainer} onClose={() => setShowSettings(false)} onSaved={(next) => { setTrainer?.(next); setShowSettings(false); refresh(); }} />}
    </div>
  );
}
export function Kpi({ title, value, icon, color, onClick, compact = false }) {
  return <Card onClick={onClick} style={{ cursor: onClick ? "pointer" : "default", borderColor: onClick ? `color-mix(in srgb, ${color} 45%, transparent)` : BRAND.line, minHeight: compact ? 92 : 128, padding: compact ? 12 : 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <div><div style={{ color: BRAND.dim, fontSize: compact ? 11 : 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em" }}>{title}</div><div style={{ fontFamily: BRAND.display, fontSize: compact ? 24 : 30, fontWeight: 500, color, lineHeight: 1.05, letterSpacing: "-0.01em" }}>{value}</div></div>
      <div style={{ fontSize: compact ? 20 : 26, opacity: 0.85 }}>{icon}</div>
    </div>
    <div style={{ marginTop: 8, color: BRAND.dim, fontSize: 11, fontWeight: 400 }}>{onClick ? "Tap to open" : ""}</div>
  </Card>;
}
