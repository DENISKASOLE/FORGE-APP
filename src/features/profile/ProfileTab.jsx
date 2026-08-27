import { useEffect, useRef, useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field, inputStyle } from "../../components/ui/Field.jsx";
import { Mini } from "../../components/ui/Mini.jsx";
import { modalBackdrop } from "../../components/ui/modal.js";
import { useIsMobile } from "../../lib/browser.js";
import { GOAL_OPTIONS, CLIENT_COLORS, MEASUREMENT_FIELDS } from "../../lib/constants.js";
import { ageFromBirthday, initials, emptyProfile, upsertSection } from "../../lib/clientData.js";
import { updateClientRow } from "../../lib/cache.js";
import { compressImage } from "../../lib/compressImage.js";
import { uploadClientPhoto, deleteClientPhoto, usePhotoUrl, isStoragePath } from "../../lib/storage.js";
import { SignedAgreementView } from "../agreement/SignedAgreementView.jsx";

function TrialLinkModal({ client, onClose, onLinked }) {
  const [trials, setTrials] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", client.trainer_id).eq("section", "trials").maybeSingle();
      setTrials((data?.data?.trials || []).filter((t) => !t.convertedClientId || t.convertedClientId === client.id));
      setLoading(false);
    })();
  }, [client.trainer_id]);
  async function link(trial) {
    await upsertSection(client.id, "trial", trial);
    onLinked(trial);
  }
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 560, maxHeight: "80vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 1000 }}>Link a Saved Trial</div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        {loading && <div style={{ color: BRAND.muted }}>Loading trials...</div>}
        {!loading && trials.length === 0 && <div style={{ color: BRAND.muted }}>No unlinked trials found. Trials are matched by name — check the Trials tab.</div>}
        {trials.map((t) => (
          <button key={t.id} onClick={() => link(t)} style={{ display: "block", width: "100%", textAlign: "left", background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: 12, marginBottom: 8, cursor: "pointer", color: BRAND.text }}>
            <b>{t.name}</b>
            <div style={{ color: BRAND.muted, fontSize: 12 }}>{t.phone} &middot; {t.email}</div>
          </button>
        ))}
      </Card>
    </div>
  );
}
const MOTIVATION_STYLES = ["", "Encouraging cheerleader", "Direct and tough-love", "Data and numbers focused", "Quiet accountability, no fuss"];
const CELEBRATION_STYLES = ["", "A public shoutout", "A quiet high-five", "A message from you", "Just mark it in session"];

export function ProfileTab({ client, updateClient, isCoach = true }) {
  const isMobile = useIsMobile(520);
  const [profile, setProfile] = useState({ ...emptyProfile(), ...(client.profile || {}) });
  const [name, setName] = useState(client.name || "");
  const [weight, setWeight] = useState(client.weight || "");
  const [saving, setSaving] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTrialLink, setShowTrialLink] = useState(false);
  const [trialData, setTrialData] = useState(client.trialData || null);
  const fileRef = useRef(null);
  const measurements = profile.measurements || {};
  const currentColor = profile.color || client.color || BRAND.cyan;
  const computedAge = ageFromBirthday(profile.birthday);
  const set = (k, v) => setProfile((p) => ({ ...p, [k]: v }));
  const setMeasurement = (k, v) => setProfile((p) => ({ ...p, measurements: { ...(p.measurements || {}), [k]: v } }));
  const toggleGoal = (g) => set("goals", (profile.goals || []).includes(g) ? (profile.goals || []).filter((x) => x !== g) : [...(profile.goals || []), g]);
  const photoUrl = usePhotoUrl(profile.photo || client.photo);
  async function pickPhoto(file) {
    if (!file) return;
    const blob = await compressImage(file);
    const previousPhoto = profile.photo;
    const path = await uploadClientPhoto(client.id, "profile", blob);
    set("photo", path);
    if (isStoragePath(previousPhoto)) await deleteClientPhoto(previousPhoto);
  }
  async function save() {
    setSaving(true);
    const nextProfile = { ...emptyProfile(), ...profile };
    const cleanName = name.trim() || client.name;
    const cleanWeight = Number(weight || 0);
    await upsertSection(client.id, "profile", nextProfile);
    await updateClientRow(client.id, { name: cleanName, weight_kg: cleanWeight });
    const nextAge = ageFromBirthday(nextProfile.birthday) ?? client.age;
    updateClient({ ...client, profile: nextProfile, name: cleanName, weight: cleanWeight, age: nextAge, photo: nextProfile.photo || client.photo, color: nextProfile.color || client.color, goals: nextProfile.goals, goal: nextProfile.goals?.[0] || client.goal, notes: nextProfile.notes });
    setSaving(false);
  }
  return <Card style={{ padding: isMobile ? 14 : 18 }}><div style={{ marginBottom: 14 }}><SignedAgreementView client={client} /></div>{client.intake?.answers?.length ?<div style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 12, marginBottom: 14 }}><div style={{ color: BRAND.gold, fontWeight: 1000, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Intake answers</div>{client.intake.answers.map((a, i) => <div key={i} style={{ marginBottom: 8 }}><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800 }}>{a.question}</div><div style={{ fontSize: 13, fontWeight: 600 }}>{a.answer || "—"}</div></div>)}</div> : null}{isCoach ? <div style={{ marginBottom: 16, padding: 12, background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 14 }}><div style={{ color: BRAND.gold, fontWeight: 1000, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Coaching type</div><div style={{ display: "flex", gap: 8 }}>{["1:1", "Online"].map((t) => <button key={t} onClick={async () => { const np = { ...profile, clientType: t }; setProfile(np); await upsertSection(client.id, "profile", np); updateClient({ ...client, clientType: t, profile: np }); }} style={{ flex: 1, border: `1px solid ${(profile.clientType || "1:1") === t ? BRAND.gold : BRAND.line}`, background: (profile.clientType || "1:1") === t ? BRAND.gold : "transparent", color: (profile.clientType || "1:1") === t ? "#000" : BRAND.text, borderRadius: 999, padding: "10px 0", fontWeight: 900, cursor: "pointer" }}>{t === "1:1" ? "In-Person (1:1)" : "Online"}</button>)}</div><div style={{ color: BRAND.muted, fontSize: 11, marginTop: 8 }}>{(profile.clientType || "1:1") === "Online" ? "Online: gets Check-ins & Payments." : "In-person: gets Schedule & Packages."} Switches instantly.</div></div> : null}
    <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 1000, marginBottom: 14, textAlign: isMobile ? "center" : "left" }}>Client Profile</div>
    <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
      <button type="button" onClick={() => fileRef.current?.click()} title="Tap to change profile picture" style={{ width: 88, height: 88, borderRadius: 28, background: currentColor, overflow: "hidden", display: "grid", placeItems: "center", color: "#000", fontWeight: 1000, border: `1px solid ${BRAND.line}`, cursor: "pointer", padding: 0 }}>
        {photoUrl ? <img src={photoUrl} alt="client" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(client.name || client.avatar)}
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={(e) => pickPhoto(e.target.files?.[0])} style={{ display: "none" }} />
      <div style={{ flex: 1, minWidth: 190 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name" style={{ background: "transparent", border: "none", borderBottom: `1px solid ${BRAND.line}`, color: BRAND.text, fontWeight: 1000, fontSize: 18, padding: "2px 0", outline: "none", width: "100%" }} />
        <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 800, marginTop: 4 }}>Tap the picture to change it. Tap the name to rename.</div>
        {isCoach && <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="dark" onClick={() => setShowColorPicker((v) => !v)}>{showColorPicker ? "Hide client color" : "Change client color"}</Button>
          {!trialData && <Button variant="dark" onClick={() => setShowTrialLink(true)}>Link a Saved Trial</Button>}
        </div>}
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 14 }}>
      <Field label="Weight (kg)" value={weight} onChange={setWeight} type="number" />
      <div>
        <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 }}>Age</div>
        <div style={{ ...inputStyle(), display: "flex", alignItems: "center", color: computedAge != null ? BRAND.text : BRAND.muted }}>{computedAge != null ? `${computedAge} years` : "Add birthday below"}</div>
      </div>
    </div>
    {isCoach && showColorPicker && <div style={{ marginBottom: 14 }}><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{CLIENT_COLORS.map((c) => <button key={c} onClick={() => set("color", c)} style={{ width: 34, height: 34, borderRadius: 12, border: currentColor === c ? `3px solid ${BRAND.text}` : `1px solid ${BRAND.line}`, background: c, cursor: "pointer" }} />)}</div></div>}

    {isCoach && trialData && <div style={{ background: `${BRAND.purple}14`, border: `1px solid ${BRAND.purple}55`, borderRadius: 16, padding: 14, marginBottom: 16 }}>
      <div style={{ color: BRAND.purple, fontWeight: 1000, marginBottom: 8 }}>From Trial &middot; {String(trialData.savedAt || "").slice(0, 10) || "Consultation on file"}</div>
      <div style={{ color: BRAND.muted, fontSize: 13, marginBottom: 10 }}>Captured before this client signed up. Only you can see this.</div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(120px,1fr))", gap: 8, marginBottom: 10 }}>
        <Mini label="Fat loss priority" value={trialData.fatLossImportance || "-"} />
        <Mini label="Muscle gain priority" value={trialData.muscleGainImportance || "-"} />
        <Mini label="Strength/endurance priority" value={trialData.strengthEnduranceImportance || "-"} />
        <Mini label="Mobility priority" value={trialData.mobilityFlexibilityImportance || "-"} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
        <Mini label="Cardio assessment" value={trialData.cardiovascular || "-"} />
        <Mini label="Squat assessment" value={trialData.squat || "-"} />
        <Mini label="Push strength" value={trialData.pushStrength || "-"} />
        <Mini label="Pull strength" value={trialData.pullStrength || "-"} />
        <Mini label="Core strength" value={trialData.coreStrength || "-"} />
        <Mini label="Flexibility" value={trialData.flexibilityFitness || "-"} />
      </div>
      {trialData.fitnessHistory && <div style={{ marginTop: 10, fontSize: 13 }}><span style={{ color: BRAND.purple, fontWeight: 900 }}>Fitness history: </span>{trialData.fitnessHistory}</div>}
      {trialData.nutrition && <div style={{ marginTop: 6, fontSize: 13 }}><span style={{ color: BRAND.purple, fontWeight: 900 }}>Nutrition notes: </span>{trialData.nutrition}</div>}
    </div>}

    <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>What are you working toward?</div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>{GOAL_OPTIONS.map((g) => <button key={g} onClick={() => toggleGoal(g)} style={{ border: `1px solid ${(profile.goals || []).includes(g) ? currentColor : BRAND.line}`, background: (profile.goals || []).includes(g) ? currentColor : BRAND.card2, color: (profile.goals || []).includes(g) ? "#000" : BRAND.text, borderRadius: 999, padding: "11px 14px", minHeight: 40, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.4 }}>{String(g).toUpperCase()}</button>)}</div>

    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(230px,1fr))", gap: 12, marginBottom: 12 }}>
      <Field label="When's your birthday? We love celebrating with our clients" value={profile.birthday} onChange={(v) => set("birthday", v)} type="date" />
    </div>

    <div style={{ color: BRAND.gold, fontWeight: 1000, fontSize: 14, marginTop: 8, marginBottom: 10, borderTop: `1px solid ${BRAND.line}`, paddingTop: 16 }}>Getting to Know You</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}>
      <Field label="Do you have any current injuries or pain? (e.g. lower back, knee, shoulder)" value={profile.injuries} onChange={(v) => set("injuries", v)} textarea placeholder="None right now, or tell us where it hurts" />
      <Field label="Any medical conditions we should know about? (e.g. blood pressure, asthma, diabetes)" value={profile.medicalIssues} onChange={(v) => set("medicalIssues", v)} textarea placeholder="None, or list what applies" />
      <Field label="What usually gets in the way of sticking to a plan?" value={profile.barriers} onChange={(v) => set("barriers", v)} textarea placeholder="e.g. travel, late nights, motivation dips" />
      <Field label="How's your sleep? Hours and quality." value={profile.sleep} onChange={(v) => set("sleep", v)} textarea placeholder="e.g. 6-7 hours, often interrupted" />
      <Field label="Outside of training, how active is your day-to-day?" value={profile.neat} onChange={(v) => set("neat", v)} textarea placeholder="e.g. desk job, on my feet all day, active parent" />
      <Field label="What does your work schedule look like?" value={profile.workSchedule} onChange={(v) => set("workSchedule", v)} textarea placeholder="Helps us plan session times and meal timing" />
      <Field label="Do you follow any particular diet?" value={profile.vegetarianStatus} onChange={(v) => set("vegetarianStatus", v)} placeholder="e.g. vegetarian, vegan, no restrictions" />
      <Field label="Any food allergies or things you avoid?" value={profile.allergies} onChange={(v) => set("allergies", v)} placeholder="e.g. nuts, shellfish, none" />
    </div>

    <div style={{ color: BRAND.gold, fontWeight: 1000, fontSize: 14, marginTop: 20, marginBottom: 10, borderTop: `1px solid ${BRAND.line}`, paddingTop: 16 }}>So We Can Support You Better</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}>
      <Field label="What would make you feel proud of yourself in 3 months?" value={profile.proudGoal} onChange={(v) => set("proudGoal", v)} textarea placeholder="A win that would mean a lot to you" />
      <Field label="Anything going on in life right now we should know about?" value={profile.lifeContext} onChange={(v) => set("lifeContext", v)} textarea placeholder="e.g. stressful few weeks at work, upcoming travel" />
      <label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 }}>How do you like to be motivated?</div><select value={profile.motivationStyle} onChange={(e) => set("motivationStyle", e.target.value)} style={inputStyle()}>{MOTIVATION_STYLES.map((m) => <option key={m} value={m}>{m || "Select..."}</option>)}</select></label>
      <label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 }}>How should we celebrate your wins?</div><select value={profile.celebrationStyle} onChange={(e) => set("celebrationStyle", e.target.value)} style={inputStyle()}>{CELEBRATION_STYLES.map((m) => <option key={m} value={m}>{m || "Select..."}</option>)}</select></label>
      <Field label="Emergency contact name" value={profile.emergencyContactName} onChange={(v) => set("emergencyContactName", v)} placeholder="In case we ever need to reach someone" />
      <Field label="Emergency contact phone" value={profile.emergencyContactPhone} onChange={(v) => set("emergencyContactPhone", v)} />
    </div>

    {isCoach && <Field label="Private coach notes" value={profile.notes} onChange={(v) => set("notes", v)} textarea placeholder="Anything else worth remembering about this client" />}

    {isCoach && <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 6 }}>Measurements</div>
      <div style={{ color: BRAND.muted, marginBottom: 12 }}>Assessment fields copied from your paper form. Use cm unless another unit makes more sense.</div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>{MEASUREMENT_FIELDS.map(([key, label]) => <Field key={key} label={label} value={measurements[key] || ""} onChange={(v) => setMeasurement(key, v)} />)}</div>
    </div>}
    {showTrialLink && <TrialLinkModal client={client} onClose={() => setShowTrialLink(false)} onLinked={(t) => { setTrialData(t); setShowTrialLink(false); updateClient({ ...client, trialData: t }); }} />}
    <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}><label style={{ color: BRAND.muted }}><input type="checkbox" checked={!!profile.lactoseIntolerant} onChange={(e) => set("lactoseIntolerant", e.target.checked)} /> Lactose intolerant</label><label style={{ color: BRAND.muted }}><input type="checkbox" checked={!!profile.glutenIntolerant} onChange={(e) => set("glutenIntolerant", e.target.checked)} /> Gluten intolerant</label></div><Button disabled={saving} onClick={save} style={{ marginTop: 16 }}>{saving ? "Saving..." : "Save Profile"}</Button></Card>;
}
