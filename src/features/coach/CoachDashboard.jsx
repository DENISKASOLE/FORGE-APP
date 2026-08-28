import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field, inputStyle, textareaStyle } from "../../components/ui/Field.jsx";
import { Mini } from "../../components/ui/Mini.jsx";
import { NavIcon } from "../../components/ui/NavIcon.jsx";
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
import { buildProgramDays } from "../../lib/programModel.js";
import { overallAdherence, recentPBsAcrossHistory } from "../progress/ProgressTab.jsx";
import { ExerciseLibraryScreen, ProgramBuilder } from "../train/TrainScreens.jsx";
import { CoachContentScreen } from "../learn/LearnTab.jsx";
import { INTAKE_FORM } from "../profile/IntakeForm.jsx";
import { ClientCard } from "../client-shell/ClientShellUI.jsx";
import { Calendar } from "./Calendar.jsx";
import { Trials } from "./Trials.jsx";
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
          <div><div style={{ fontSize: 24, fontWeight: 900 }}>Add New Client</div><div style={{ color: BRAND.muted }}>Create the profile first. Invite the client later.</div></div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 8 }}>CLIENT TYPE</div>
          <div style={{ display: "flex", gap: 8 }}>{CLIENT_TYPES.map((t) => <button key={t} onClick={() => setProfile("clientType", t)} style={{ border: `1px solid ${form.profile.clientType === t ? BRAND.gold : BRAND.line}`, background: form.profile.clientType === t ? BRAND.gold : BRAND.card2, color: form.profile.clientType === t ? "#000" : BRAND.text, borderRadius: 999, padding: "8px 16px", fontWeight: 900, cursor: "pointer" }}>{t}</button>)}</div>
          <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 6 }}>{form.profile.clientType === "Online" ? "Online clients get Check-ins and Payments instead of Schedule and Packages." : "1:1 clients keep the in-person Schedule and Packages tabs."}</div>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
          <div style={{ width: 72, height: 72, borderRadius: 22, background: form.color, overflow: "hidden", display: "grid", placeItems: "center", color: "#000", fontWeight: 1000 }}>{photoPreview ? <img src={photoPreview} alt="client" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(form.name)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>CLIENT PHOTO</div>
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
          {showColorPicker && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>{CLIENT_COLORS.map((c) => <button key={c} onClick={() => setForm({ ...form, color: c, profile: { ...form.profile, color: c } })} style={{ width: 34, height: 34, borderRadius: 12, border: form.color === c ? `3px solid ${BRAND.text}` : `1px solid ${BRAND.line}`, background: c, cursor: "pointer" }} />)}</div>}
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: BRAND.muted, fontWeight: 900, marginBottom: 8 }}>GOALS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{GOAL_OPTIONS.map((g) => <button key={g} onClick={() => toggleGoal(g)} style={{ border: `1px solid ${form.profile.goals.includes(g) ? BRAND.gold : BRAND.line}`, background: form.profile.goals.includes(g) ? BRAND.gold : BRAND.card2, color: form.profile.goals.includes(g) ? "#000" : BRAND.text, borderRadius: 20, padding: "7px 11px", fontWeight: 800 }}>{String(g).toUpperCase()}</button>)}</div>
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
    const blob = await compressImage(file);
    const previousPhoto = form.photo;
    const path = await uploadTrainerPhoto(user.id, "profile", blob);
    set("photo", path);
    if (isStoragePath(previousPhoto)) await deleteClientPhoto(previousPhoto);
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
            <div style={{ fontSize: 26, fontWeight: 1000 }}>Coach Settings</div>
            <div style={{ color: BRAND.muted }}>Edit your profile shown inside Forge.</div>
          </div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
          <div style={{ width: 84, height: 84, borderRadius: 24, background: BRAND.card2, border: `1px solid ${BRAND.line}`, overflow: "hidden", display: "grid", placeItems: "center", color: BRAND.gold, fontWeight: 1000 }}>
            {photoUrl ? <img src={photoUrl} alt="Coach" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(form.name)}
          </div>
          <label style={{ flex: 1 }}>
            <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>PROFILE PHOTO</div>
            <input type="file" accept="image/*" onChange={(e) => pickPhoto(e.target.files?.[0])} style={inputStyle()} />
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          <Field label="Coach name" value={form.name} onChange={(v) => set("name", v)} />
          <Field label="Email" value={form.email} onChange={(v) => set("email", v)} />
          <Field label="Phone number" value={form.phone} onChange={(v) => set("phone", v)} />
        </div>
        {message && <div style={{ color: BRAND.green, fontWeight: 900, marginTop: 12 }}>{message}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <Button disabled={saving} onClick={save} style={{ flex: 1 }}>{saving ? "Saving..." : "Save Settings"}</Button>
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

    if (c.paymentDueDate && !c.paymentPaid) {
      const d = daysUntil(c.paymentDueDate);
      if (d < 0) items.push({ id: `pay_over_${c.id}`, type: "payment", severity: 0, client: c, text: `${c.name}'s payment is overdue by ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"}` });
      else if (d <= 2) items.push({ id: `pay_2_${c.id}`, type: "payment", severity: 1, client: c, text: `${c.name}'s payment is due ${d === 0 ? "today" : `in ${d} day${d === 1 ? "" : "s"}`}` });
      else if (d <= 5) items.push({ id: `pay_5_${c.id}`, type: "payment", severity: 2, client: c, text: `${c.name}'s payment is due in ${d} days` });
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
export function NotificationsTab({ notifications, selectClient }) {
  if (notifications.length === 0) return <Card><div style={{ color: BRAND.muted }}>You're all caught up. No notifications right now.</div></Card>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {notifications.map((n) => (
        <Card key={n.id} onClick={() => selectClient(n.client)} style={{ cursor: "pointer", padding: 14, border: `1px solid ${n.severity === 0 ? BRAND.red : n.severity === 1 ? BRAND.red : n.severity === 2 ? BRAND.gold : BRAND.line}` }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ fontSize: 20 }}>{NOTIF_ICONS[n.type]}</div>
            <div style={{ fontWeight: 800 }}>{n.text}</div>
          </div>
        </Card>
      ))}
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
    <div style={{ fontSize: 26, fontWeight: 900 }}>Payments</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
      <Mini label="Overdue" value={String(overdue)} color={overdue ? BRAND.red : BRAND.text} />
      <Mini label="Due soon" value={String(dueSoon)} color={dueSoon ? BRAND.gold : BRAND.text} />
      <Mini label="Paid" value={String(paid)} color={BRAND.green} />
    </div>
    <Card>
      <div style={{ fontSize: 16, fontWeight: 1000, marginBottom: 4 }}>By client</div>
      {sorted.length === 0 && <div style={{ color: BRAND.muted }}>No payment dates set yet. Add a due date on a client to track it here.</div>}
      {sorted.map((c) => { const st = paymentStatus(c); return <div key={c.id} onClick={() => selectClient(c)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${BRAND.line}`, paddingTop: 10, marginTop: 10, cursor: "pointer" }}>
        <div><div style={{ fontWeight: 900 }}>{c.name}</div><div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 700 }}>{c.paymentDueDate}</div></div>
        <div style={{ color: st.color, fontWeight: 900, fontSize: 13, textAlign: "right" }}>{st.label}</div>
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
    <div><div style={{ fontSize: 26, fontWeight: 900 }}>Broadcast</div><div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginTop: 3 }}>Send one message to every client. Each one receives it in their Messages.</div></div>
    {sentCount != null && <Card style={{ borderColor: BRAND.green }}><div style={{ color: BRAND.green, fontWeight: 900 }}>Sent to {sentCount} client{sentCount === 1 ? "" : "s"}.</div></Card>}
    <Card style={{ display: "grid", gap: 10 }}>
      <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Write your message to all clients..." style={inputStyle({ minHeight: 130, resize: "vertical" })} />
      <Button onClick={sendAll} disabled={sending || !clients.length} style={{ width: "100%" }}>{sending ? "Sending..." : `Send to all ${clients.length} client${clients.length === 1 ? "" : "s"}`}</Button>
    </Card>
  </div>;
}
export function CoachIntakeFormsScreen({ user, onBack }) {
  return <div style={{ display: "grid", gap: 14 }}>
    <Button variant="ghost" onClick={onBack} style={{ padding: "8px 14px", justifySelf: "start" }}>‹ Back</Button>
    <div><div style={{ fontSize: 26, fontWeight: 900 }}>Intake Form</div><div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginTop: 3 }}>The application every new client completes in-app. Their answers land on their Profile.</div></div>
    {INTAKE_FORM.map((s) => <Card key={s.name}>
      <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.6 }}>{s.name}</div>
      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>{s.fields.map((f) => <div key={f.id} style={{ borderTop: `1px solid ${BRAND.line}`, paddingTop: 8 }}><div style={{ fontWeight: 800, fontSize: 14 }}>{f.q}{f.req ? "" : "  (optional)"}</div>{f.options && <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 600, marginTop: 3 }}>{f.options.join("  ·  ")}</div>}{f.type === "rating" && <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 600, marginTop: 3 }}>Rating 1 to 5</div>}</div>)}</div>
    </Card>)}
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
  const Row = ({ k, title, desc }) => <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderTop: `1px solid ${BRAND.line}`, paddingTop: 12, marginTop: 12 }}>
    <div><div style={{ fontWeight: 900, fontSize: 14 }}>{title}</div><div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 600, marginTop: 2 }}>{desc}</div></div>
    <button onClick={() => persist({ ...rules, [k]: !rules[k] })} style={{ width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", background: rules[k] ? BRAND.green : BRAND.card2, position: "relative", flexShrink: 0 }}><span style={{ position: "absolute", top: 3, left: rules[k] ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s" }} /></button>
  </div>;
  return <div style={{ display: "grid", gap: 14 }}>
    <Button variant="ghost" onClick={onBack} style={{ padding: "8px 14px", justifySelf: "start" }}>‹ Back</Button>
    <div><div style={{ fontSize: 26, fontWeight: 900 }}>Automations</div><div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginTop: 3 }}>Rules that keep clients on track in the background.</div></div>
    <Card style={{ paddingTop: 4 }}>
      <Row k="staleWorkout" title="Inactivity nudge" desc={`Remind clients who have not logged a workout in ${rules.staleWorkoutDays} days`} />
      <Row k="checkinReminder" title="Weekly check-in reminder" desc="Nudge clients whose weekly check-in is due" />
      <Row k="paymentReminder" title="Payment reminder" desc="Remind clients before a payment is due" />
      <Row k="welcomeMessage" title="Welcome message" desc="Auto-message new clients when they join" />
    </Card>
    <Card style={{ borderColor: `${BRAND.gold}44` }}><div style={{ color: BRAND.gold, fontWeight: 900, fontSize: 13 }}>Heads up</div><div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 600, marginTop: 4, lineHeight: 1.5 }}>These rules are saved, but sending on a schedule needs a small Supabase scheduled function (cron), since the app cannot run timers while it is closed. Ask me to add it when you want automations to actually fire.</div></Card>
  </div>;
}

export function CoachToolsTab({ onOpen }) {
  const isMobile = useIsMobile(520);
  const TOOLS = [
    { key: "templates", name: "Programs", meta: "Templates & builder", color: BRAND.purple },
    { key: "exercise_library", name: "Exercise Library", meta: "Custom moves & video", color: BRAND.orange },
    { key: "calendar", name: "Calendar", meta: "Sessions & bookings", color: BRAND.cyan },
    { key: "analytics", name: "Analytics", meta: "Adherence & trends", color: BRAND.green },
    { key: "trials", name: "Trials", meta: "Consults & assessments", color: BRAND.red },
    { key: "content", name: "Content", meta: "Forge Academy articles", color: BRAND.blue },
    { key: "payments", name: "Payments", meta: "Plans & invoices", color: BRAND.green },
    { key: "forms", name: "Intake Forms", meta: "Onboarding & health", color: BRAND.cyan },
    { key: "broadcast", name: "Broadcast", meta: "Message every client", color: BRAND.purple },
    { key: "automations", name: "Automations", meta: "Reminders & nudges", color: BRAND.orange },
  ];
  return <div style={{ display: "grid", gap: 14 }}>
    <div><div style={{ fontSize: 26, fontWeight: 900 }}>Tools</div><div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginTop: 3 }}>Everything you run your coaching with</div></div>
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(auto-fit,minmax(150px,1fr))", gap: isMobile ? 12 : 14 }}>
      {TOOLS.map((t) => <button key={t.key} onClick={() => onOpen(t.key)} style={{ textAlign: "left", cursor: "pointer", background: BRAND.card, border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: 14 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${t.color}22`, display: "grid", placeItems: "center", marginBottom: 10 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: t.color, display: "block" }} /></div>
        <div style={{ fontSize: 13, fontWeight: 1000 }}>{t.name}</div>
        <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 700, marginTop: 3 }}>{t.meta}</div>
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
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 90, background: BRAND.panel, borderTop: `1px solid ${BRAND.line}`, display: "flex", justifyContent: "space-around", paddingTop: 10, paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
      {COACH_NAV.map((item) => {
        const active = tab === item.key;
        const color = active ? BRAND.gold : BRAND.dim;
        return (
          <button key={item.key} onClick={() => setTab(item.key)} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flex: 1, minWidth: 0, position: "relative", padding: 0 }}>
            <div style={{ width: 42, height: 28, borderRadius: 999, background: active ? `${BRAND.gold}22` : "transparent", display: "grid", placeItems: "center" }}>
              {item.icon === "gear" || item.icon === "home" ? <NavIcon name={item.icon} color={color} /> : <CoachIcon name={item.icon} size={21} color={color} />}
              {item.key === "alerts" && unread > 0 && <div style={{ position: "absolute", top: -2, right: 10, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: BRAND.red, color: "#fff", fontSize: 9, fontWeight: 900, display: "grid", placeItems: "center", border: `2px solid ${BRAND.panel}` }}>{unread > 9 ? "9+" : unread}</div>}
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color }}>{item.label}</div>
          </button>
        );
      })}
    </div>
  );
}
export function CoachTile({ icon, name, meta, count, quiet, wide, isTablet, color = BRAND.gold, onClick }) {
  return (
    <button onClick={onClick} style={{
      gridColumn: wide ? "1 / -1" : "auto",
      background: BRAND.card, border: `1px solid ${BRAND.line}`, borderRadius: isTablet ? 26 : 22,
      padding: isTablet ? 24 : 18, minHeight: wide ? (isTablet ? 110 : 96) : (isTablet ? 172 : 136), cursor: "pointer", position: "relative",
      display: "flex", flexDirection: wide ? "row" : "column", alignItems: wide ? "center" : "flex-start",
      justifyContent: wide ? "flex-start" : "space-between", gap: wide ? 16 : 0, textAlign: "left", minWidth: 0,
    }}>
      {count != null && !wide && (
        <div style={{ position: "absolute", top: isTablet ? 20 : 16, right: isTablet ? 20 : 16, minWidth: isTablet ? 26 : 22, height: isTablet ? 26 : 22, padding: "0 7px", borderRadius: 999, background: quiet ? "transparent" : color, border: quiet ? `1px solid ${BRAND.line}` : "none", color: quiet ? BRAND.dim : "#000", fontSize: isTablet ? 13 : 11, fontWeight: 1000, display: "grid", placeItems: "center" }}>{count}</div>
      )}
      <div style={{ width: isTablet ? 66 : 52, height: isTablet ? 66 : 52, borderRadius: isTablet ? 20 : 16, background: `${color}22`, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <CoachIcon name={icon} size={isTablet ? 32 : 26} color={color} />
      </div>
      <div style={{ flex: wide ? 1 : "none", width: wide ? "auto" : "100%", minWidth: 0, marginTop: wide ? 0 : "auto" }}>
        <div style={{ fontWeight: 900, fontSize: 15, color: BRAND.text, textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
        <div style={{ color, fontSize: 12, fontWeight: 700, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</div>
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
        <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.9 }}>
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </div>
        <div style={{ fontSize: isMobile ? 26 : 30, fontWeight: 900, letterSpacing: -0.4, marginTop: 4 }}>{greeting}, {name}</div>
        <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginTop: 3 }}>
          {todaysSessions ?? "..."} session{todaysSessions === 1 ? "" : "s"} scheduled today{flagged > 0 ? ` · ${flagged} need attention` : ""}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        <Mini label="Active" value={String(clients.length)} color={BRAND.gold} />
        <Mini label="Adherence" value={adherence != null ? `${adherence}%` : "-"} color={BRAND.green} />
        <Mini label="Alerts" value={String(notifications.length)} color={notifications.length > 0 ? BRAND.red : BRAND.text} />
      </div>
      {agenda && (agenda.sessions.length > 0 || agenda.checkInsDue.length > 0 || agenda.paymentsDue.length > 0) && (
        <Card style={{ padding: 16 }}>
          <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 10 }}>Today</div>
          {agenda.sessions.map((s) => {
            const client = clients.find((c) => c.id === s.clientId);
            return (
              <div key={s.id} onClick={() => client && selectClient?.(client)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${BRAND.line}`, cursor: client ? "pointer" : "default" }}>
                <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 900, width: 58, flexShrink: 0 }}>{timeLabel(s.time)}</div>
                <div style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</div>
                {s.hasInjury && <span title={s.injuryNote} style={{ color: BRAND.red, fontSize: 12, fontWeight: 900, flexShrink: 0 }}>⚠</span>}
              </div>
            );
          })}
          {agenda.checkInsDue.length > 0 && (
            <div onClick={onOpenClients} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: agenda.paymentsDue.length > 0 ? `1px solid ${BRAND.line}` : "none", cursor: "pointer" }}>
              <span style={{ color: BRAND.muted, fontSize: 12, fontWeight: 700 }}>Check-ins due</span>
              <span style={{ color: BRAND.orange, fontWeight: 900, fontSize: 12 }}>{agenda.checkInsDue.length}</span>
            </div>
          )}
          {agenda.paymentsDue.length > 0 && (
            <div onClick={onOpenClients} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", cursor: "pointer" }}>
              <span style={{ color: BRAND.muted, fontSize: 12, fontWeight: 700 }}>Payments due</span>
              <span style={{ color: BRAND.red, fontWeight: 900, fontSize: 12 }}>{agenda.paymentsDue.length}</span>
            </div>
          )}
        </Card>
      )}
      <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.7, marginTop: 4 }}>Go to</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: isTablet ? 18 : 12 }}>
        <CoachTile isTablet={isTablet} icon="clients" name="Clients" meta={`${clients.length} active${flagged ? ` · ${flagged} flagged` : ""}`} count={clients.length} color={BRAND.gold} onClick={onOpenClients} />
        <CoachTile isTablet={isTablet} icon="templates" name="Templates" meta={`${templatesCount} program${templatesCount === 1 ? "" : "s"} saved`} count={templatesCount} quiet color={BRAND.purple} onClick={() => onTile("templates")} />
        <CoachTile isTablet={isTablet} icon="calendar" name="Calendar" meta={`${todaysSessions ?? "..."} session${todaysSessions === 1 ? "" : "s"} today`} count={todaysSessions || null} color={BRAND.cyan} onClick={() => onTile("calendar")} />
        <CoachTile isTablet={isTablet} icon="analytics" name="Analytics" meta="Client activity trends" color={BRAND.green} onClick={() => onTile("analytics")} />
        <CoachTile isTablet={isTablet} icon="exlib" name="Exercise Library" meta={customExerciseCount ? `${customExerciseCount} custom exercise${customExerciseCount === 1 ? "" : "s"}` : "Add your own with video"} color={BRAND.orange} onClick={() => onTile("exercise_library")} />
        <CoachTile isTablet={isTablet} icon="trials" name="Trials" meta={trialsCount ? `${trialsCount} saved · consultations & assessments` : "Consultations & fitness assessments"} count={trialsCount || null} color={BRAND.red} onClick={() => onTile("trials")} />
      </div>
    </div>
  );
}
export function CoachTemplates({ user, clients, onBack }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null);
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
  if (editingTemplate) {
    return <ProgramBuilder
      client={{ id: null, trainer_id: user.id, name: editingTemplate.name, goal: editingTemplate.goal }}
      program={editingTemplate.program}
      onClose={() => setEditingTemplate(null)}
      onSave={saveEditedTemplate}
    />;
  }
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Button variant="ghost" onClick={onBack} style={{ justifySelf: "start", padding: "8px 14px" }}>‹ Back</Button>
      <div>
        <div style={{ fontSize: 26, fontWeight: 900 }}>Templates</div>
        <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginTop: 3 }}>{templates.length} saved program{templates.length === 1 ? "" : "s"}</div>
      </div>
      {loading && <Card><div style={{ color: BRAND.muted }}>Loading...</div></Card>}
      {!loading && templates.length === 0 && (
        <Card>
          <div style={{ color: BRAND.text, fontWeight: 800, marginBottom: 6 }}>No templates yet</div>
          <div style={{ color: BRAND.muted, fontSize: 13, lineHeight: 1.55 }}>
            Open a client, build a program, then hit <b style={{ color: BRAND.gold }}>Save as Template</b> in the builder. It'll show up here and you can load it into any client.
          </div>
        </Card>
      )}
      {templates.map((t) => {
        const usedBy = clients.filter((c) => c.program?.templateId === t.id).length;
        return (
          <Card key={t.id} style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{t.name}</div>
                <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 600, marginTop: 3 }}>
                  {[t.goal, `${t.weeks} week${t.weeks === 1 ? "" : "s"}`, t.savedAt ? `saved ${String(t.savedAt).slice(0, 10)}` : null].filter(Boolean).join(" · ")}
                  {usedBy > 0 ? ` · used by ${usedBy}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="dark" onClick={() => setEditingTemplate(t)} style={{ fontSize: 12, padding: "8px 14px" }}>Edit</Button>
                <Button variant="red" onClick={() => remove(t)} style={{ fontSize: 12, padding: "8px 14px" }}>Delete</Button>
              </div>
            </div>
          </Card>
        );
      })}
      <Card style={{ background: BRAND.card2 }}>
        <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 600, lineHeight: 1.55 }}>
          To use a template: open a client → Program → Edit Program → <b style={{ color: BRAND.gold }}>Load from template</b>.
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
        <div style={{ fontSize: 26, fontWeight: 900 }}>Analytics</div>
        <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginTop: 3 }}>Client activity, last 8 weeks</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        <Mini label="Sessions" value={String(total)} />
        <Mini label="Avg adherence" value={adherence != null ? `${adherence}%` : "-"} color={BRAND.green} />
        <Mini label="Going cold" value={String(cold.length)} color={cold.length > 0 ? BRAND.red : BRAND.text} />
        <Mini label="PBs this month" value={String(pbsThisMonth)} color={BRAND.cyan} />
        <Mini label="Payments overdue" value={String(overduePayments)} color={overduePayments > 0 ? BRAND.red : BRAND.text} />
      </div>
      <div>
        <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8 }}>Sessions completed per week</div>
        <Card style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 110 }}>
            {weeks.map((w, i) => {
              const isLast = i === weeks.length - 1;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 4 }}>
                  <div style={{ color: isLast ? BRAND.gold : BRAND.dim, fontSize: 10, fontWeight: 900 }}>{w.count}</div>
                  <div style={{ width: "100%", height: `${Math.max(3, (w.count / maxWeek) * 70)}%`, background: isLast ? BRAND.gold : BRAND.card2, borderRadius: "4px 4px 0 0" }} />
                  <div style={{ color: BRAND.dim, fontSize: 9, fontWeight: 800 }}>{isLast ? "Now" : `-${weeks.length - 1 - i}`}</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
      <div>
        <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8 }}>Adherence by client · lowest first</div>
        <Card style={{ padding: 16 }}>
          {rows.length === 0 && <div style={{ color: BRAND.muted, fontSize: 13 }}>No clients yet.</div>}
          {rows.map(({ client, adherence: a, last }, i) => {
            const pct = a.total ? a.pct : 0;
            const days = last ? daysSince(last) : null;
            const warn = pct < 70 || (days !== null && days >= 7);
            return (
              <div key={client.id} onClick={() => selectClient(client)} style={{ padding: "10px 0", borderTop: i === 0 ? "none" : `1px solid ${BRAND.card2}`, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: 13 }}>{client.name}</span>
                  <span style={{ color: warn ? BRAND.red : BRAND.muted, fontSize: 12, fontWeight: 800 }}>
                    {a.total ? `${pct}%` : "No program"}{days !== null ? ` · ${days}d ago` : ""}
                  </span>
                </div>
                <div style={{ height: 4, background: BRAND.card2, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: warn ? BRAND.red : BRAND.gold }} />
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
export function CoachSettingsTab({ user, trainer, onEditProfile, clientsCount, syncStatus, onOpenTool }) {
  const [busy, setBusy] = useState(false);
  const trainerPhotoUrl = usePhotoUrl(trainer?.photo);
  async function logout() { setBusy(true); await supabase.auth.signOut(); }
  const Section = ({ t }) => <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.7, marginTop: 10, marginBottom: 2 }}>{t}</div>;
  const Row = ({ k, v, onClick, last }) => <div onClick={onClick} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "13px 0", borderBottom: last ? "none" : `1px solid ${BRAND.line}`, cursor: onClick ? "pointer" : "default" }}><span style={{ fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{k}</span><span style={{ color: BRAND.muted, fontWeight: 900, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, textAlign: "right" }}>{v}</span></div>;
  const syncLabel = syncStatus === "offline" ? "Offline" : syncStatus === "syncing" ? "Syncing" : "Synced";
  return <div style={{ display: "grid", gap: 12 }}>
    <div><div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 1000, letterSpacing: 1.5, textTransform: "uppercase" }}>Coach</div><div style={{ fontSize: 26, fontWeight: 900 }}>Settings</div></div>
    <Card onClick={onEditProfile} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 54, height: 54, borderRadius: "50%", background: BRAND.card2, border: `1px solid ${BRAND.line}`, overflow: "hidden", display: "grid", placeItems: "center", color: BRAND.gold, fontWeight: 1000, flexShrink: 0 }}>{trainerPhotoUrl ? <img src={trainerPhotoUrl} alt="Coach" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(trainer?.name || user.email)}</div>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 900, fontSize: 17 }}>{trainer?.name || user.email?.split("@")[0]}</div><div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 600, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div><div style={{ color: BRAND.gold, fontSize: 12, fontWeight: 800, marginTop: 4 }}>Edit profile ›</div></div>
    </Card>
    <Section t="Brand" />
    <Card style={{ padding: "4px 16px" }}>
      <Row k="Business name" v={`${trainer?.name || "Set"} ›`} onClick={onEditProfile} />
      <Row k="Coach photo / logo" v={trainer?.photo ? "Set ›" : "Add ›"} onClick={onEditProfile} last />
    </Card>
    <Section t="Notifications" />
    <Card style={{ padding: "4px 16px" }}>
      <Row k="Automations & reminders" v="Open ›" onClick={() => onOpenTool?.("automations")} last />
    </Card>
    <Section t="Payments" />
    <Card style={{ padding: "4px 16px" }}>
      <Row k="Provider" v="PayPal" />
      <Row k="Client payments" v="Open ›" onClick={() => onOpenTool?.("payments")} last />
    </Card>
    <Section t="Account" />
    <Card style={{ padding: "4px 16px" }}>
      <Row k="Active clients" v={String(clientsCount)} />
      <Row k="Sync" v={syncLabel} last />
    </Card>
    <Button variant="red" disabled={busy} onClick={logout} style={{ width: "100%", marginTop: 6 }}>{busy ? "Logging out..." : "Log Out"}</Button>
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
    if (form.photoFile) {
      const blob = await compressImage(form.photoFile);
      const path = await uploadClientPhoto(data.id, "profile", blob);
      profile = { ...profile, photo: path };
    }
    await upsertSection(data.id, "profile", profile);
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
  if (screen === "templates") body = <CoachTemplates user={user} clients={clients} onBack={goHome} />;
  else if (screen === "calendar") body = <><Button variant="ghost" onClick={goHome} style={{ padding: "8px 14px", marginBottom: 12 }}>‹ Back</Button><Calendar clients={clients} refresh={refresh} user={user} /></>;
  else if (screen === "analytics") body = <CoachAnalytics clients={clients} selectClient={selectClient} onBack={goHome} />;
  else if (screen === "trials") body = <><Button variant="ghost" onClick={goHome} style={{ padding: "8px 14px", marginBottom: 12 }}>‹ Back</Button><Trials user={user} onConvert={convertTrialToClient} /></>;
  else if (screen === "exercise_library") body = <ExerciseLibraryScreen trainerId={user.id} onBack={goHome} />;
  else if (screen === "content") body = <CoachContentScreen user={user} onBack={goHome} />;
  else if (screen === "payments") body = <CoachPaymentsScreen clients={clients} selectClient={selectClient} onBack={goHome} />;
  else if (screen === "forms") body = <CoachIntakeFormsScreen user={user} onBack={goHome} />;
  else if (screen === "broadcast") body = <CoachBroadcastScreen clients={clients} refresh={refresh} onBack={goHome} />;
  else if (screen === "automations") body = <CoachAutomationsScreen user={user} onBack={goHome} />;
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
        <div style={{ fontSize: 26, fontWeight: 900 }}>Clients</div>
        <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginTop: 3 }}>{filtered.length} {clientTypeFilter === "1:1" ? "in-person" : "online"}</div>
      </div>
      <div style={{ display: "flex", gap: 8, background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 999, padding: 4 }}>
        <button onClick={() => setClientTypeFilter("1:1")} style={{ flex: 1, padding: "10px 0", borderRadius: 999, border: "none", background: clientTypeFilter === "1:1" ? BRAND.gold : "transparent", color: clientTypeFilter === "1:1" ? "#000" : BRAND.muted, fontWeight: 900, fontSize: 13, cursor: "pointer" }}>In-Person</button>
        <button onClick={() => setClientTypeFilter("Online")} style={{ flex: 1, padding: "10px 0", borderRadius: 999, border: "none", background: clientTypeFilter === "Online" ? BRAND.gold : "transparent", color: clientTypeFilter === "Online" ? "#000" : BRAND.muted, fontWeight: 900, fontSize: 13, cursor: "pointer" }}>Online</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto auto", gap: 10 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients..." style={inputStyle()} />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={inputStyle({ width: "auto" })}>
          <option value="recent">Sort: Recent</option>
          <option value="name">Sort: Name</option>
          <option value="adherence">Sort: Adherence</option>
        </select>
        <Button onClick={() => setShowAdd(true)}>+ Add New Client</Button>
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
        <div style={{ fontSize: 26, fontWeight: 900 }}>Alerts</div>
        <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginTop: 3 }}>{notifications.length ? `${notifications.length} need${notifications.length === 1 ? "s" : ""} a look` : "All caught up"}</div>
      </div>
      <NotificationsTab notifications={notifications} selectClient={selectClient} />
    </div>
  );
  else body = <CoachSettingsTab user={user} trainer={trainer} onEditProfile={() => setShowSettings(true)} clientsCount={clients.length} syncStatus={syncStatus} onOpenTool={(k) => { setToolOrigin("settings"); setScreen(k); }} />;
  return (
    <div style={{ minHeight: "100vh", background: BRAND.bg, color: BRAND.text, paddingBottom: 96 }}>
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(7,7,7,.93)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${BRAND.line}`, padding: isMobile ? "10px 12px" : "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: isMobile ? 38 : 44, height: isMobile ? 38 : 44, borderRadius: "50%", background: BRAND.card2, border: `1px solid ${BRAND.line}`, overflow: "hidden", display: "grid", placeItems: "center", color: BRAND.gold, fontWeight: 1000 }}>
            {trainerPhotoUrl ? <img src={trainerPhotoUrl} alt="Coach" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(trainer?.name || user.email)}
          </div>
          <div>
            <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 1000, color: BRAND.gold, lineHeight: 1 }}>FORGE</div>
            <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900 }}>COACH {trainer?.name || user.email?.split("@")[0]}</div>
          </div>
        </div>
        <span style={{ color: syncStatus === "offline" ? BRAND.red : syncStatus === "syncing" ? BRAND.gold : BRAND.green, fontSize: 12, fontWeight: 1000 }}>
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
  return <Card onClick={onClick} style={{ cursor: onClick ? "pointer" : "default", borderColor: onClick ? `${color}55` : BRAND.line, minHeight: compact ? 92 : 128, padding: compact ? 12 : 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <div><div style={{ color: BRAND.muted, fontSize: compact ? 11 : 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6 }}>{title}</div><div style={{ fontSize: compact ? 24 : 30, fontWeight: 800, color, lineHeight: 1.05, letterSpacing: -0.5 }}>{value}</div></div>
      <div style={{ fontSize: compact ? 20 : 26, opacity: 0.85 }}>{icon}</div>
    </div>
    <div style={{ marginTop: 8, color: BRAND.dim, fontSize: 11, fontWeight: 500 }}>{onClick ? "Tap to open" : ""}</div>
  </Card>;
}
