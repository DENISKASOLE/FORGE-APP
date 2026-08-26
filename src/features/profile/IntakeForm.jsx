import { useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { inputStyle } from "../../components/ui/Field.jsx";
import { isoDate } from "../../lib/dateUtils.js";
import { upsertSection } from "../../lib/clientData.js";

export const INTAKE_FORM = [
  { name: "About you", lede: "Welcome to The Forge Method. This takes about four minutes and gives me everything I need to build your plan. The more honest you are here, the sharper it gets.", fields: [
    { id: "name", q: "Full name", type: "text", req: true },
    { id: "email", q: "Email", type: "email", req: true },
    { id: "phone", q: "WhatsApp number", type: "tel", req: true, hint: "Include the country code. This is how I will reply.", ph: "+971 5X XXX XXXX" },
    { id: "age", q: "Age", type: "number", req: true },
    { id: "city", q: "City and country", type: "text", req: true, ph: "Dubai, UAE" },
    { id: "sex", q: "Sex", type: "choice", req: true, hint: "Used for calorie and programming calculations only.", options: ["Female", "Male", "Prefer not to say"] },
  ] },
  { name: "Your goal", lede: "Be specific. Get in shape tells me nothing. Drop 8kg before my wedding in March tells me everything.", fields: [
    { id: "goal", q: "Main goal", type: "choice", req: true, options: ["Lose body fat", "Build muscle and size", "Lose fat and build muscle at the same time", "Get stronger on the main lifts", "Health, energy and habits", "Performance for a sport or event"] },
    { id: "target", q: "Put a number on it", type: "textarea", req: true, hint: "Weight, size, a lift, a time. Whatever makes it measurable." },
    { id: "deadline", q: "Is there a deadline?", type: "text", hint: "A wedding, a holiday, a competition. Leave blank if there is none." },
    { id: "why", q: "Why now?", type: "textarea", req: true, hint: "What changed recently that made you fill this in today?" },
  ] },
  { name: "Where you are now", lede: "No judgement here. I need the truth, not the version that sounds good.", fields: [
    { id: "exp", q: "Training experience", type: "choice", req: true, options: ["Beginner. Under a year, or starting again", "Intermediate. One to three years", "Advanced. Three years or more"] },
    { id: "now", q: "How often are you training right now?", type: "choice", req: true, options: ["Not at all", "1 to 2 a week", "3 to 4 a week", "5 or more"] },
    { id: "where", q: "Where will you train?", type: "choice", req: true, options: ["Full commercial gym", "Building or hotel gym, limited kit", "Home setup", "Mixed, I travel a lot"] },
    { id: "prev", q: "Have you worked with a coach before?", type: "choice", req: true, options: ["No", "Yes, it worked", "Yes, it did not work"] },
    { id: "history", q: "Your training history so far", type: "textarea", hint: "A few lines on what you have done and how it went." },
    { id: "blocker", q: "What has stopped you before?", type: "textarea", req: true, hint: "The real reason. Consistency, travel, injury, motivation, life getting in the way." },
  ] },
  { name: "Body and health", lede: "I need this to programme safely. Everything here stays private and is never shared.", fields: [
    { id: "height", q: "Height", type: "text", req: true, ph: "175cm" },
    { id: "weight", q: "Current weight", type: "text", req: true, ph: "92kg" },
    { id: "injuries", q: "Any injuries, current or past?", type: "textarea", req: true, hint: "Back, knees, shoulders, anything that changes how you move. Write none if none." },
    { id: "medical", q: "Anything a doctor has told you to be careful about?", type: "textarea", req: true, hint: "Heart, blood pressure, joints, pregnancy or postpartum. Write none if none." },
    { id: "cleared", q: "Are you currently cleared for exercise?", type: "choice", req: true, options: ["Yes", "Not sure", "No"] },
  ] },
  { name: "Food and lifestyle", lede: "Training is the easy part. This section is where results are usually won or lost.", fields: [
    { id: "eating", q: "How would you describe your eating right now?", type: "choice", req: true, options: ["No structure, I eat whatever is around", "Mostly sensible, but it falls apart at weekends", "I have tracked before and know roughly what I am doing", "I am tracking calories or macros right now"] },
    { id: "diet", q: "Any food restrictions?", type: "textarea", hint: "Allergies, vegetarian, halal, things you will not eat. Write none if none." },
    { id: "cook", q: "Who does the cooking?", type: "choice", req: true, options: ["Me", "Partner or family", "Mostly eat out", "Meal prep service"] },
    { id: "sleep", q: "Average sleep a night", type: "choice", req: true, options: ["Under 5h", "5 to 6h", "6 to 7h", "7h or more"] },
    { id: "job", q: "How active is your job?", type: "choice", req: true, options: ["Desk bound", "Mixed", "On my feet all day", "Physically demanding"] },
  ] },
  { name: "Priorities", lede: "Rank what matters most to you. It tells me where to put the emphasis.", fields: [
    { id: "priFat", q: "Fat loss", type: "rating", req: true, hint: "1 = low priority, 5 = top priority" },
    { id: "priMuscle", q: "Muscle gain", type: "rating", req: true, hint: "1 = low priority, 5 = top priority" },
    { id: "priStrength", q: "Strength and endurance", type: "rating", req: true, hint: "1 = low priority, 5 = top priority" },
    { id: "priMobility", q: "Mobility and flexibility", type: "rating", req: true, hint: "1 = low priority, 5 = top priority" },
  ] },
  { name: "Commitment", lede: "I would rather build a plan around three honest days than five imaginary ones.", fields: [
    { id: "days", q: "Days a week you can realistically train", type: "choice", req: true, options: ["2", "3", "4", "5", "6"] },
    { id: "mins", q: "Time per session", type: "choice", req: true, options: ["30 min", "45 min", "60 min", "75 min", "90 min"] },
    { id: "anything", q: "Anything else I should know?", type: "textarea", hint: "Optional. Anything that helps me build the right plan for you." },
  ] },
];
export function IntakeForm({ client, updateClient, goTo }) {
  const allFields = INTAKE_FORM.flatMap((s) => s.fields);
  const [step, setStep] = useState(0);
  const [resp, setResp] = useState(() => {
    const seed = {};
    (client.intake?.answers || []).forEach((a) => { const f = allFields.find((x) => x.q === a.question); if (f) seed[f.id] = a.answer; });
    if (!seed.name && client.name) seed.name = client.name;
    if (!seed.email && client.email) seed.email = client.email;
    return seed;
  });
  const [saving, setSaving] = useState(false);
  const [showErr, setShowErr] = useState(false);
  const steps = INTAKE_FORM;
  const total = steps.length + 1;
  const isReview = step >= steps.length;
  const set = (id, v) => setResp((r) => ({ ...r, [id]: v }));
  const stepValid = isReview || steps[step].fields.every((f) => !f.req || String(resp[f.id] || "").trim());
  function next() { if (!stepValid) { setShowErr(true); return; } setShowErr(false); setStep(step + 1); }
  async function submit() {
    setSaving(true);
    const answers = allFields.map((f) => ({ question: f.q, answer: resp[f.id] || "" }));
    const intake = { answers, completedAt: isoDate() };
    await upsertSection(client.id, "intake", intake);
    updateClient({ ...client, intake });
    setSaving(false);
    goTo("home");
  }
  function renderField(f) {
    const missing = showErr && f.req && !String(resp[f.id] || "").trim();
    return <div key={f.id} style={{ marginBottom: 18 }}>
      <div style={{ fontWeight: 900, fontSize: 15 }}>{f.q}{f.req && <span style={{ color: BRAND.gold, fontSize: 11, marginLeft: 6, fontWeight: 800 }}>required</span>}</div>
      {f.hint && <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 600, marginTop: 3 }}>{f.hint}</div>}
      <div style={{ marginTop: 8 }}>
        {f.type === "rating"
          ? <div style={{ display: "flex", gap: 6 }}>{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => set(f.id, String(n))} style={{ flex: 1, padding: "12px 0", borderRadius: 10, cursor: "pointer", fontSize: 15, fontWeight: 1000, color: String(resp[f.id]) === String(n) ? "#000" : BRAND.text, background: String(resp[f.id]) === String(n) ? BRAND.gold : BRAND.card2, border: `1px solid ${String(resp[f.id]) === String(n) ? BRAND.gold : BRAND.line}` }}>{n}</button>)}</div>
          : f.type === "choice"
          ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{f.options.map((o) => <button key={o} type="button" onClick={() => set(f.id, o)} style={{ padding: "11px 15px", borderRadius: 11, cursor: "pointer", fontSize: 14, fontWeight: 700, textAlign: "left", color: resp[f.id] === o ? "#000" : BRAND.text, background: resp[f.id] === o ? BRAND.gold : BRAND.card2, border: `1px solid ${resp[f.id] === o ? BRAND.gold : BRAND.line}` }}>{o}</button>)}</div>
          : f.type === "textarea"
            ? <textarea value={resp[f.id] || ""} onChange={(e) => set(f.id, e.target.value)} placeholder={f.ph || ""} style={inputStyle({ minHeight: 84, resize: "vertical", borderColor: missing ? BRAND.red : BRAND.line })} />
            : <input type={f.type} value={resp[f.id] || ""} onChange={(e) => set(f.id, e.target.value)} placeholder={f.ph || ""} style={inputStyle({ borderColor: missing ? BRAND.red : BRAND.line })} />}
      </div>
      {missing && <div style={{ color: BRAND.red, fontSize: 12, fontWeight: 700, marginTop: 6 }}>Please answer this.</div>}
    </div>;
  }
  return <div style={{ display: "grid", gap: 8 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 1000, letterSpacing: 1.2, textTransform: "uppercase" }}>Application</div>
      <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900 }}>{Math.min(step + 1, total)} / {total}</div>
    </div>
    <div style={{ height: 4, background: BRAND.card2, borderRadius: 999, overflow: "hidden" }}><div style={{ height: 4, width: `${((step + 1) / total) * 100}%`, background: BRAND.gold, borderRadius: 999, transition: "width .3s" }} /></div>
    {!isReview && <><div style={{ fontSize: 26, fontWeight: 1000, margin: "14px 0 6px", textTransform: "uppercase" }}>{steps[step].name}</div><div style={{ color: BRAND.muted, fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{steps[step].lede}</div></>}
    <Card style={{ marginTop: 8 }}>
      {isReview
        ? <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 1000 }}>Review and submit</div>
            {allFields.map((f) => <div key={f.id} style={{ borderTop: `1px solid ${BRAND.line}`, paddingTop: 8 }}><div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 900 }}>{f.q}</div><div style={{ fontSize: 13, fontWeight: 600, color: resp[f.id] ? BRAND.text : BRAND.dim }}>{resp[f.id] || "—"}</div></div>)}
          </div>
        : steps[step].fields.map(renderField)}
    </Card>
    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
      {step > 0 && <Button variant="dark" onClick={() => { setShowErr(false); setStep(step - 1); }} style={{ flex: 1 }}>Back</Button>}
      {!isReview ? <Button onClick={next} style={{ flex: 2 }}>Next</Button> : <Button onClick={submit} disabled={saving} style={{ flex: 2 }}>{saving ? "Submitting..." : "Submit application"}</Button>}
    </div>
  </div>;
}
