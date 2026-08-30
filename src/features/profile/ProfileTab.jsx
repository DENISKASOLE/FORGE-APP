import { useEffect, useRef, useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field, inputStyle } from "../../components/ui/Field.jsx";
import { Mini } from "../../components/ui/Mini.jsx";
import { modalBackdrop } from "../../components/ui/modal.js";
import { useIsMobile } from "../../lib/browser.js";
import { GOAL_OPTIONS, CLIENT_COLORS } from "../../lib/constants.js";
import { ageFromBirthday, initials, emptyProfile, upsertSection } from "../../lib/clientData.js";
import { updateClientRow } from "../../lib/cache.js";
import { compressImage } from "../../lib/compressImage.js";
import { uploadClientPhoto, deleteClientPhoto, usePhotoUrl, isStoragePath } from "../../lib/storage.js";
import { showToast } from "../../components/ui/Toast.jsx";
import { SignedScreeningView } from "../screening/SignedScreeningView.jsx";

const labelStyle = { fontFamily: BRAND.sans, fontSize: 11, color: BRAND.muted, fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.14em" };
const sectionHeadStyle = { fontFamily: BRAND.sans, color: BRAND.dim, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", marginTop: 20, marginBottom: 10, borderTop: `${BRAND.hairline} solid ${BRAND.line}`, paddingTop: 16 };

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
          <div style={{ fontFamily: BRAND.display, fontSize: 18, fontWeight: 500, letterSpacing: "-0.01em", color: BRAND.text }}>Link a saved trial</div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        {loading && <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 13 }}>Loading trials...</div>}
        {!loading && trials.length === 0 && <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 13, lineHeight: 1.6 }}>No unlinked trials found. Trials are matched by name — check the Trials tab.</div>}
        {trials.map((t) => (
          <button key={t.id} onClick={() => link(t)} style={{ display: "block", width: "100%", textAlign: "left", background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusControl, padding: 12, marginBottom: 8, cursor: "pointer", color: BRAND.text, fontFamily: BRAND.sans }}>
            <div style={{ fontWeight: 500, fontSize: 14 }}>{t.name}</div>
            <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 2 }}>{t.phone} &middot; {t.email}</div>
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
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTrialLink, setShowTrialLink] = useState(false);
  const [trialData, setTrialData] = useState(client.trialData || null);
  const fileRef = useRef(null);
  const skipNextAutoSave = useRef(true);
  const currentColor = profile.color || client.color || BRAND.dim;
  const computedAge = ageFromBirthday(profile.birthday);
  const set = (k, v) => setProfile((p) => ({ ...p, [k]: v }));
  const toggleGoal = (g) => set("goals", (profile.goals || []).includes(g) ? (profile.goals || []).filter((x) => x !== g) : [...(profile.goals || []), g]);
  const photoUrl = usePhotoUrl(profile.photo || client.photo);
  async function pickPhoto(file) {
    if (!file) return;
    try {
      const blob = await compressImage(file);
      const previousPhoto = profile.photo;
      const path = await uploadClientPhoto(client.id, "profile", blob);
      set("photo", path);
      if (isStoragePath(previousPhoto)) await deleteClientPhoto(previousPhoto);
    } catch (error) {
      showToast(error.message || "Couldn't upload that photo. Check your connection and try again.", "error");
    }
  }
  async function save() {
    const nextProfile = { ...emptyProfile(), ...profile };
    const cleanName = name.trim() || client.name;
    const cleanWeight = Number(weight || 0);
    const r1 = await upsertSection(client.id, "profile", nextProfile);
    const r2 = await updateClientRow(client.id, { name: cleanName, weight_kg: cleanWeight });
    if (r1?.error || r2?.error) {
      showToast((r1?.error || r2?.error)?.message || "Couldn't save - check your connection. It'll keep this on the device and retry.", "error");
    }
    const nextAge = ageFromBirthday(nextProfile.birthday) ?? client.age;
    updateClient({ ...client, profile: nextProfile, name: cleanName, weight: cleanWeight, age: nextAge, photo: nextProfile.photo || client.photo, color: nextProfile.color || client.color, goals: nextProfile.goals, goal: nextProfile.goals?.[0] || client.goal, notes: nextProfile.notes });
  }

  // Autosaves shortly after the coach stops typing/toggling anything below -
  // most people never hit an explicit save button, so there isn't one.
  // Skips the save that would otherwise fire the instant this tab mounts
  // (profile/name/weight are seeded from the client prop at that point,
  // there's nothing new to persist yet).
  useEffect(() => {
    if (skipNextAutoSave.current) { skipNextAutoSave.current = false; return; }
    const t = setTimeout(() => { save(); }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, name, weight]);

  return (
    <Card style={{ padding: isMobile ? 14 : 18 }}>
      <div style={{ marginBottom: 14 }}><SignedScreeningView client={client} /></div>

      {isCoach ? (
        <div style={{ marginBottom: 16, padding: 12, background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusCard }}>
          <div style={{ fontFamily: BRAND.sans, color: BRAND.dim, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8 }}>Coaching type</div>
          <div style={{ display: "flex", gap: 8 }}>
            {["1:1", "Online"].map((t) => {
              const active = (profile.clientType || "1:1") === t;
              return (
                <button key={t} onClick={async () => { const np = { ...profile, clientType: t }; setProfile(np); await upsertSection(client.id, "profile", np); updateClient({ ...client, clientType: t, profile: np }); }} style={{ flex: 1, fontFamily: BRAND.sans, border: `${BRAND.hairline} solid ${active ? "transparent" : BRAND.line}`, background: active ? BRAND.btnBg : "transparent", color: active ? BRAND.btnInk : BRAND.text, borderRadius: 999, padding: "10px 0", fontWeight: 500, fontSize: 13, cursor: "pointer" }}>
                  {t === "1:1" ? "In-person (1:1)" : "Online"}
                </button>
              );
            })}
          </div>
          <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>{(profile.clientType || "1:1") === "Online" ? "Online: gets Check-ins & Payments." : "In-person: gets Schedule & Packages."} Switches instantly.</div>
        </div>
      ) : null}

      <div style={{ fontFamily: BRAND.display, fontSize: isMobile ? 24 : 28, fontWeight: 500, letterSpacing: "-0.01em", color: BRAND.text, marginBottom: 14, textAlign: isMobile ? "center" : "left" }}>Client profile</div>

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <button type="button" onClick={() => fileRef.current?.click()} title="Tap to change profile picture" style={{ width: 88, height: 88, borderRadius: 28, background: currentColor, overflow: "hidden", display: "grid", placeItems: "center", color: "#000", fontFamily: BRAND.display, fontWeight: 500, fontSize: 22, border: `${BRAND.hairline} solid ${BRAND.line}`, cursor: "pointer", padding: 0 }}>
          {photoUrl ? <img src={photoUrl} alt="client" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(client.name || client.avatar)}
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={(e) => pickPhoto(e.target.files?.[0])} style={{ display: "none" }} />
        <div style={{ flex: 1, minWidth: 190 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name" style={{ fontFamily: BRAND.display, background: "transparent", border: "none", borderBottom: `${BRAND.hairline} solid ${BRAND.line}`, color: BRAND.text, fontWeight: 500, fontSize: 18, padding: "2px 0", outline: "none", width: "100%" }} />
          <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 12, fontWeight: 400, marginTop: 4 }}>Tap the picture to change it. Tap the name to rename.</div>
          {isCoach && <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="dark" onClick={() => setShowColorPicker((v) => !v)}>{showColorPicker ? "Hide client color" : "Change client color"}</Button>
            {!trialData && <Button variant="dark" onClick={() => setShowTrialLink(true)}>Link a saved trial</Button>}
          </div>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 14 }}>
        <Field label="Weight (kg)" value={weight} onChange={setWeight} type="number" />
        <div>
          <div style={labelStyle}>Age</div>
          <div style={{ ...inputStyle(), display: "flex", alignItems: "center", color: computedAge != null ? BRAND.text : BRAND.muted }}>{computedAge != null ? `${computedAge} years` : "Add birthday below"}</div>
        </div>
      </div>

      {isCoach && showColorPicker && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {CLIENT_COLORS.map((c) => (
              <button key={c} onClick={() => set("color", c)} style={{ width: 34, height: 34, borderRadius: BRAND.radiusControl, border: currentColor === c ? `2px solid ${BRAND.text}` : `${BRAND.hairline} solid ${BRAND.line}`, background: c, cursor: "pointer" }} />
            ))}
          </div>
        </div>
      )}

      {isCoach && trialData && (
        <div style={{ background: BRAND.panel, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusCard, padding: 14, marginBottom: 16 }}>
          <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontWeight: 500, fontSize: 13, marginBottom: 8 }}>From trial &middot; {String(trialData.savedAt || "").slice(0, 10) || "Consultation on file"}</div>
          <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 13, marginBottom: 10, lineHeight: 1.6 }}>Captured before this client signed up. Only you can see this.</div>
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
          {trialData.fitnessHistory && <div style={{ fontFamily: BRAND.sans, marginTop: 10, fontSize: 13, lineHeight: 1.6, color: BRAND.text }}><span style={{ color: BRAND.muted, fontWeight: 500 }}>Fitness history: </span>{trialData.fitnessHistory}</div>}
          {trialData.nutrition && <div style={{ fontFamily: BRAND.sans, marginTop: 6, fontSize: 13, lineHeight: 1.6, color: BRAND.text }}><span style={{ color: BRAND.muted, fontWeight: 500 }}>Nutrition notes: </span>{trialData.nutrition}</div>}
        </div>
      )}

      <div style={{ fontFamily: BRAND.sans, color: BRAND.dim, fontSize: 11, fontWeight: 500, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.14em" }}>What are you working toward?</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {GOAL_OPTIONS.map((g) => {
          const active = (profile.goals || []).includes(g);
          return (
            <button key={g} onClick={() => toggleGoal(g)} style={{ fontFamily: BRAND.sans, border: `${BRAND.hairline} solid ${active ? "transparent" : BRAND.line}`, background: active ? BRAND.btnBg : BRAND.card2, color: active ? BRAND.btnInk : BRAND.text, borderRadius: 999, padding: "11px 14px", minHeight: 40, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em" }}>{g}</button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(230px,1fr))", gap: 12, marginBottom: 12 }}>
        <Field label="When's your birthday? We love celebrating with our clients" value={profile.birthday} onChange={(v) => set("birthday", v)} type="date" />
      </div>

      <div style={sectionHeadStyle}>Getting to know you</div>
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

      <div style={sectionHeadStyle}>So we can support you better</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}>
        <Field label="What would make you feel proud of yourself in 3 months?" value={profile.proudGoal} onChange={(v) => set("proudGoal", v)} textarea placeholder="A win that would mean a lot to you" />
        <Field label="Anything going on in life right now we should know about?" value={profile.lifeContext} onChange={(v) => set("lifeContext", v)} textarea placeholder="e.g. stressful few weeks at work, upcoming travel" />
        <label>
          <div style={labelStyle}>How do you like to be motivated?</div>
          <select value={profile.motivationStyle} onChange={(e) => set("motivationStyle", e.target.value)} style={inputStyle()}>{MOTIVATION_STYLES.map((m) => <option key={m} value={m}>{m || "Select..."}</option>)}</select>
        </label>
        <label>
          <div style={labelStyle}>How should we celebrate your wins?</div>
          <select value={profile.celebrationStyle} onChange={(e) => set("celebrationStyle", e.target.value)} style={inputStyle()}>{CELEBRATION_STYLES.map((m) => <option key={m} value={m}>{m || "Select..."}</option>)}</select>
        </label>
        <Field label="Emergency contact name" value={profile.emergencyContactName} onChange={(v) => set("emergencyContactName", v)} placeholder="In case we ever need to reach someone" />
        <Field label="Emergency contact phone" value={profile.emergencyContactPhone} onChange={(v) => set("emergencyContactPhone", v)} />
      </div>

      {isCoach && <div style={{ marginTop: 12 }}><Field label="Private coach notes" value={profile.notes} onChange={(v) => set("notes", v)} textarea placeholder="Anything else worth remembering about this client" /></div>}

      {showTrialLink && <TrialLinkModal client={client} onClose={() => setShowTrialLink(false)} onLinked={(t) => { setTrialData(t); setShowTrialLink(false); updateClient({ ...client, trialData: t }); }} />}

      <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
        <label style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}><input type="checkbox" checked={!!profile.lactoseIntolerant} onChange={(e) => set("lactoseIntolerant", e.target.checked)} /> Lactose intolerant</label>
        <label style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}><input type="checkbox" checked={!!profile.glutenIntolerant} onChange={(e) => set("glutenIntolerant", e.target.checked)} /> Gluten intolerant</label>
      </div>
    </Card>
  );
}
