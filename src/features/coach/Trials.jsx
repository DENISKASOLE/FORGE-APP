import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field, inputStyle } from "../../components/ui/Field.jsx";
import { Mini } from "../../components/ui/Mini.jsx";
import { modalBackdrop } from "../../components/ui/modal.js";
import { uid } from "../../lib/uid.js";
import { upsertTrainerData } from "../../lib/clientData.js";
import { buildPdfDoc, downloadBlob, sharePdfBlob, safeFilename } from "../../lib/pdf.js";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";

async function downloadTrialPDF(trial) {
  const sections = [
    { heading: "Contact", lines: [{ label: "Phone", value: trial.phone }, { label: "Email", value: trial.email }] },
    { heading: "Goals & History", lines: [{ label: "Goal", value: trial.goal }, { label: "Fitness history", value: trial.fitnessHistory }, { label: "Barriers", value: trial.barriers }] },
    { heading: "Health", lines: [{ label: "Injuries", value: trial.injuries }, { label: "Medical issues", value: trial.medicalIssues }] },
    { heading: "Lifestyle", lines: [{ label: "Nutrition", value: trial.nutrition }, { label: "Sleep", value: trial.sleep }, { label: "Daily activity (NEAT)", value: trial.neat }] },
    { heading: "Priorities", lines: [{ label: "Fat loss", value: trial.fatLossImportance }, { label: "Muscle gain", value: trial.muscleGainImportance }, { label: "Strength/endurance", value: trial.strengthEnduranceImportance }, { label: "Mobility/flexibility", value: trial.mobilityFlexibilityImportance }] },
    { heading: `Assessment${trial.assessmentDate ? ` — ${trial.assessmentDate}` : ""}`, lines: [{ label: "Cardiovascular", value: trial.cardiovascular }, { label: "Squat", value: trial.squat }, { label: "Push strength", value: trial.pushStrength }, { label: "Pull strength", value: trial.pullStrength }, { label: "Core strength", value: trial.coreStrength }, { label: "Flexibility", value: trial.flexibilityFitness }] },
  ];
  const subtitle = `Trial consultation${trial.savedAt ? `  ·  ${String(trial.savedAt).slice(0, 10)}` : ""}`;
  const blob = await buildPdfDoc(trial.name || "Trial", subtitle, sections);
  return { blob, filename: `${safeFilename(trial.name)}_trial.pdf` };
}

export function RatingSelect({ label, value, onChange }) {
  return (
    <label>
      <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 11, fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.14em" }}>{label}</div>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)} style={inputStyle()}>
        <option value="">Choose 1-5</option>
        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
  );
}
export function Trials({ user, onConvert }) {
  const [trials, setTrials] = useState([]);
  const [loadingTrials, setLoadingTrials] = useState(true);
  const [tab, setTab] = useState("contact");
  const [openTrial, setOpenTrial] = useState(null);
  const [converting, setConverting] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", goal: "", fitnessHistory: "", barriers: "", injuries: "", medicalIssues: "", nutrition: "", sleep: "", neat: "", fatLossImportance: "", muscleGainImportance: "", strengthEnduranceImportance: "", mobilityFlexibilityImportance: "", assessmentDate: "", cardiovascular: "", squat: "", pushStrength: "", pullStrength: "", coreStrength: "", flexibilityFitness: "" });
  useEffect(() => { load(); }, []);
  async function load() { const uidVal = user?.id || (await supabase.auth.getUser()).data.user?.id; const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", uidVal).eq("section", "trials").maybeSingle(); setTrials(data?.data?.trials || []); setLoadingTrials(false); }
  async function save(next) { setTrials(next); const uidVal = user?.id || (await supabase.auth.getUser()).data.user?.id; await upsertTrainerData(uidVal, "trials", { trials: next }); }
  function set(k, v) { setForm({ ...form, [k]: v }); }
  function saveTrial() { const saved = { id: form.id || uid(), ...form, savedAt: new Date().toISOString() }; save([saved, ...trials.filter((t) => t.id !== saved.id)]); setForm({ name: "", phone: "", email: "", goal: "", fitnessHistory: "", barriers: "", injuries: "", medicalIssues: "", nutrition: "", sleep: "", neat: "", fatLossImportance: "", muscleGainImportance: "", strengthEnduranceImportance: "", mobilityFlexibilityImportance: "", assessmentDate: "", cardiovascular: "", squat: "", pushStrength: "", pullStrength: "", coreStrength: "", flexibilityFitness: "" }); }
  async function convertToClient(trial) {
    if (!onConvert) return;
    if (!await confirmDialog(`Convert ${trial.name} to a paying client? A client profile will be created with their trial details attached.`, { confirmLabel: "Convert" })) return;
    setConverting(true);
    const clientId = await onConvert(trial);
    setConverting(false);
    if (clientId) save(trials.map((t) => (t.id === trial.id ? { ...t, convertedClientId: clientId, convertedAt: new Date().toISOString() } : t)));
  }
  const TRIAL_TABS = [
    { key: "contact", label: "Contact" },
    { key: "goals", label: "Goals" },
    { key: "health", label: "Health" },
    { key: "lifestyle", label: "Lifestyle" },
    { key: "priorities", label: "Priorities" },
    { key: "assessment", label: "Assessment" },
  ];
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <div style={{ fontFamily: BRAND.display, fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em", color: BRAND.text }}>Trials</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, margin: "12px 0" }}>
          {TRIAL_TABS.map((t) => <Button key={t.key} variant={tab === t.key ? "gold" : "dark"} onClick={() => setTab(t.key)}>{t.label}</Button>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          {tab === "contact" && <><Field label="Name" value={form.name} onChange={(v) => set("name", v)} /><Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} /><Field label="Email" value={form.email} onChange={(v) => set("email", v)} /></>}
          {tab === "goals" && <><Field label="Goal" value={form.goal} onChange={(v) => set("goal", v)} textarea /><Field label="Fitness history" value={form.fitnessHistory} onChange={(v) => set("fitnessHistory", v)} textarea /><Field label="Barriers" value={form.barriers} onChange={(v) => set("barriers", v)} textarea /></>}
          {tab === "health" && <><Field label="Injuries" value={form.injuries} onChange={(v) => set("injuries", v)} textarea /><Field label="Medical issues" value={form.medicalIssues} onChange={(v) => set("medicalIssues", v)} textarea /></>}
          {tab === "lifestyle" && <><Field label="Nutrition" value={form.nutrition} onChange={(v) => set("nutrition", v)} textarea /><Field label="Sleep" value={form.sleep} onChange={(v) => set("sleep", v)} textarea /><Field label="NEAT / daily activity" value={form.neat} onChange={(v) => set("neat", v)} textarea /></>}
          {tab === "priorities" && <><div style={{ gridColumn: "1 / -1", fontFamily: BRAND.sans, color: BRAND.text, fontWeight: 500, fontSize: 14, marginBottom: 4 }}>On a scale of 1-5, rate how important these are to the client:</div><RatingSelect label="Fat loss" value={form.fatLossImportance} onChange={(v) => set("fatLossImportance", v)} /><RatingSelect label="Muscle gain" value={form.muscleGainImportance} onChange={(v) => set("muscleGainImportance", v)} /><RatingSelect label="Strength and endurance" value={form.strengthEnduranceImportance} onChange={(v) => set("strengthEnduranceImportance", v)} /><RatingSelect label="Mobility & flexibility" value={form.mobilityFlexibilityImportance} onChange={(v) => set("mobilityFlexibilityImportance", v)} /></>}
          {tab === "assessment" && <><Field label="Date" type="date" value={form.assessmentDate} onChange={(v) => set("assessmentDate", v)} /><Field label="Cardiovascular fitness" value={form.cardiovascular} onChange={(v) => set("cardiovascular", v)} /><Field label="Squat" value={form.squat} onChange={(v) => set("squat", v)} /><Field label="Push strength" value={form.pushStrength} onChange={(v) => set("pushStrength", v)} /><Field label="Pull strength" value={form.pullStrength} onChange={(v) => set("pullStrength", v)} /><Field label="Core strength" value={form.coreStrength} onChange={(v) => set("coreStrength", v)} /><Field label="Flexibility fitness" value={form.flexibilityFitness} onChange={(v) => set("flexibilityFitness", v)} /></>}
        </div>
        <Button onClick={saveTrial} style={{ marginTop: 12 }}>Save Trial</Button>
      </Card>
      <Card>
        <div style={{ fontFamily: BRAND.display, fontSize: 18, fontWeight: 500, letterSpacing: "-0.01em", color: BRAND.text, marginBottom: 10 }}>Saved Trials</div>
        {loadingTrials ? (
          <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 14 }}>Loading...</div>
        ) : trials.length === 0 ? (
          <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 14 }}>No saved trials yet.</div>
        ) : trials.map((t) => (
          <div key={t.id} onClick={() => setOpenTrial(t)} style={{ borderTop: `${BRAND.hairline} solid ${BRAND.lineSoft}`, paddingTop: 12, marginTop: 12, cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: BRAND.sans }}>
              <span style={{ fontWeight: 500, fontSize: 14, color: BRAND.text }}>{t.name}</span>
              {t.convertedClientId && <span style={{ background: BRAND.greenBg, color: BRAND.green, fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", borderRadius: 999, padding: "3px 8px" }}>Client</span>}
            </div>
            <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 13, marginTop: 2 }}>{t.phone} · {t.email}</div>
            <div style={{ fontFamily: BRAND.sans, color: BRAND.blue, fontSize: 12, fontWeight: 500, marginTop: 2 }}>Tap to open</div>
          </div>
        ))}
      </Card>
      {openTrial && (
        <div style={modalBackdrop()}>
          <Card style={{ width: "100%", maxWidth: 760, maxHeight: "90vh", overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontFamily: BRAND.display, fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em", color: BRAND.text }}>{openTrial.name}</div>
                <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 13, marginTop: 2 }}>{openTrial.phone} · {openTrial.email}</div>
              </div>
              <Button variant="ghost" onClick={() => setOpenTrial(null)}>X</Button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
              {Object.entries(openTrial).filter(([k]) => !["id", "savedAt"].includes(k)).map(([k, v]) => <Mini key={k} label={k.replace(/([A-Z])/g, " $1")} value={String(v || "-")} />)}
            </div>
            {openTrial.convertedClientId ? (
              <div style={{ fontFamily: BRAND.sans, background: BRAND.greenBg, border: `1px solid ${BRAND.green}`, borderRadius: BRAND.radiusControl, padding: 10, marginTop: 12, color: BRAND.green, fontWeight: 500, fontSize: 13 }}>Converted to a client on {String(openTrial.convertedAt || "").slice(0, 10)}.</div>
            ) : null}
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              {!openTrial.convertedClientId && <Button onClick={() => convertToClient(openTrial)} disabled={converting} style={{ flex: 1 }}>{converting ? "Converting..." : "Convert to Client (client has paid)"}</Button>}
              <Button variant="dark" disabled={pdfBusy} onClick={async () => { setPdfBusy(true); const { blob, filename } = await downloadTrialPDF(openTrial); downloadBlob(blob, filename); setPdfBusy(false); }}>{pdfBusy ? "..." : "Download PDF"}</Button>
              {typeof navigator !== "undefined" && navigator.share && <Button variant="dark" disabled={pdfBusy} onClick={async () => { setPdfBusy(true); const { blob, filename } = await downloadTrialPDF(openTrial); await sharePdfBlob(blob, filename, openTrial.name); setPdfBusy(false); }}>Share</Button>}
              <Button variant="dark" onClick={() => { setForm(openTrial); setOpenTrial(null); }}>Edit</Button>
              <Button variant="red" onClick={() => { save(trials.filter((x) => x.id !== openTrial.id)); setOpenTrial(null); }}>Delete</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
