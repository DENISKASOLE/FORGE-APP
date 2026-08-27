import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field, inputStyle, textareaStyle } from "../../components/ui/Field.jsx";
import { modalBackdrop } from "../../components/ui/modal.js";
import { useIsMobile } from "../../lib/browser.js";
import { uid } from "../../lib/uid.js";
import { isoDate, currentStreakWeeks } from "../../lib/dateUtils.js";
import { daysSince, upsertSection, upsertTrainerData } from "../../lib/clientData.js";
import { DEFAULT_CHECKIN_QUESTIONS } from "../../lib/constants.js";

async function loadCheckInTemplate(trainerId) {
  if (!trainerId) return DEFAULT_CHECKIN_QUESTIONS;
  const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", trainerId).eq("section", "checkin_template").maybeSingle();
  return data?.data?.questions?.length ? data.data.questions : DEFAULT_CHECKIN_QUESTIONS;
}
const CHECKIN_QUESTION_TYPES = [["text", "Text"], ["scale", "1-10 Scale"], ["choice", "Multiple Choice"]];

function CheckInTemplateEditor({ trainerId, template, onSave, onClose }) {
  const [questions, setQuestions] = useState(template.map((q) => ({ type: "text", ...q })));
  const [newQ, setNewQ] = useState("");
  function updateQ(id, patch) { setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q))); }
  function deleteQ(id) { setQuestions((qs) => qs.filter((q) => q.id !== id)); }
  function addQ() { if (!newQ.trim()) return; setQuestions((qs) => [...qs, { id: uid(), text: newQ.trim(), type: "text" }]); setNewQ(""); }
  async function save() { await upsertTrainerData(trainerId, "checkin_template", { questions }); onSave(questions); }
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 560, maxHeight: "85vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 1000 }}>Weekly Check-in Questions</div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <div style={{ color: BRAND.muted, fontSize: 13, marginBottom: 12 }}>These questions go to every client's weekly check-in. Scale and Multiple Choice let clients tap an answer instead of typing.</div>
        {questions.map((q) => (
          <div key={q.id} style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input value={q.text} onChange={(e) => updateQ(q.id, { text: e.target.value })} style={inputStyle()} />
              <button onClick={() => deleteQ(q.id)} style={{ background: "transparent", border: "none", color: BRAND.red, fontWeight: 1000, cursor: "pointer", fontSize: 18, padding: "0 6px" }}>x</button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: q.type === "choice" ? 8 : 0 }}>
              {CHECKIN_QUESTION_TYPES.map(([val, label]) => (
                <button key={val} onClick={() => updateQ(q.id, { type: val, options: val === "choice" ? (q.options || ["Struggling", "Steady", "Strong", "Crushing It"]) : undefined })} style={{ background: q.type === val ? BRAND.gold : BRAND.panel, color: q.type === val ? "#000" : BRAND.muted, border: `1px solid ${q.type === val ? BRAND.gold : BRAND.line}`, borderRadius: 999, padding: "6px 12px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>{label}</button>
              ))}
            </div>
            {q.type === "choice" && (
              <input value={(q.options || []).join(", ")} onChange={(e) => updateQ(q.id, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Options, comma separated" style={inputStyle({ fontSize: 13 })} />
            )}
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input value={newQ} onChange={(e) => setNewQ(e.target.value)} placeholder="Add a question..." style={inputStyle()} onKeyDown={(e) => e.key === "Enter" && addQ()} />
          <Button variant="dark" onClick={addQ}>Add</Button>
        </div>
        <Button onClick={save} style={{ width: "100%", marginTop: 16 }}>Save Questions</Button>
      </Card>
    </div>
  );
}
function computeCheckInFlags(template, answers) {
  const low = ["Struggling", "Poor", "Fair", "50-74%", "Below 50%"];
  const flags = [];
  template.forEach((q) => {
    const a = answers[q.id];
    if (!a) return;
    if (low.includes(a)) flags.push({ q: q.text, a });
    else if (q.type === "scale" && Number(a) > 0 && Number(a) <= 4) flags.push({ q: q.text, a: a + "/10" });
  });
  return flags;
}
export function CheckInsTab({ client, updateClient, isCoach }) {
  const isMobile = useIsMobile(520);
  const [template, setTemplate] = useState(DEFAULT_CHECKIN_QUESTIONS);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(null);
  const [step, setStep] = useState(0);
  const submissions = client.checkIns || [];
  const lastSubmission = submissions[submissions.length - 1];
  const daysSinceLast = lastSubmission ? daysSince(lastSubmission.date) : null;
  const dueForCheckIn = daysSinceLast === null || daysSinceLast >= 7;
  const streak = currentStreakWeeks(submissions.map((s) => s.date));
  useEffect(() => { loadCheckInTemplate(client.trainer_id).then((qs) => { setTemplate(qs); setLoadingTemplate(false); }); }, [client.trainer_id]);
  function setAnswer(id, v) { setAnswers((a) => ({ ...a, [id]: v })); }
  const perStep = 2;
  const pages = [];
  for (let i = 0; i < template.length; i += perStep) pages.push(template.slice(i, i + perStep));
  const totalSteps = pages.length + 1;
  const isReview = step >= pages.length;
  const liveFlags = computeCheckInFlags(template, answers);
  async function submit() {
    setSaving(true);
    const entry = { id: uid(), date: isoDate(), answers: template.map((q) => ({ question: q.text, answer: answers[q.id] || "" })), flags: liveFlags };
    const next = [...submissions, entry];
    await upsertSection(client.id, "checkins", { submissions: next });
    updateClient({ ...client, checkIns: next });
    setAnswers({}); setStep(0); setSaving(false);
  }
  function renderQuestion(q) {
    return (
      <div key={q.id}>
        <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>{q.text}</div>
        {q.type === "scale" && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} onClick={() => setAnswer(q.id, String(n))} style={{ flex: 1, minWidth: 0, height: 40, borderRadius: 10, border: `1px solid ${String(answers[q.id]) === String(n) ? BRAND.gold : BRAND.line}`, background: String(answers[q.id]) === String(n) ? BRAND.gold : BRAND.card2, color: String(answers[q.id]) === String(n) ? "#000" : BRAND.muted, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{n}</button>
            ))}
          </div>
        )}
        {q.type === "choice" && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(q.options || []).map((opt) => (
              <button key={opt} onClick={() => setAnswer(q.id, opt)} style={{ flex: 1, minWidth: 72, textAlign: "center", padding: "11px 4px", borderRadius: 12, border: `1px solid ${answers[q.id] === opt ? BRAND.green : BRAND.line}`, background: answers[q.id] === opt ? BRAND.green : BRAND.card2, color: answers[q.id] === opt ? "#000" : BRAND.muted, fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", cursor: "pointer" }}>{opt}</button>
            ))}
          </div>
        )}
        {(!q.type || q.type === "text") && (
          <textarea value={answers[q.id] || ""} onChange={(e) => setAnswer(q.id, e.target.value)} placeholder="Type your answer..." style={textareaStyle({ minHeight: 64 })} />
        )}
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Card style={{ padding: isMobile ? 12 : 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 1000 }}>Weekly Check-in</div>
            {streak >= 2 && <span style={{ background: `${BRAND.gold}18`, color: BRAND.gold, borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 900 }}>🔥 {streak}-week streak</span>}
          </div>
          {isCoach && <Button variant="dark" onClick={() => setShowEditor(true)}>Edit Questions</Button>}
        </div>
        <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 4 }}>{lastSubmission ? `Last check-in: ${lastSubmission.date} (${daysSinceLast} day${daysSinceLast === 1 ? "" : "s"} ago)` : "No check-ins submitted yet."}</div>
      </Card>
      {!isCoach && !loadingTemplate && (
        <Card style={{ padding: isMobile ? 12 : 16, border: dueForCheckIn ? `1px solid ${BRAND.gold}` : undefined }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 1000, color: dueForCheckIn ? BRAND.gold : BRAND.text }}>{isReview ? "Review & submit" : dueForCheckIn ? "Your check-in is due" : "Check in early if you'd like"}</div>
            <div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 800 }}>{Math.min(step + 1, totalSteps)} / {totalSteps}</div>
          </div>
          <div style={{ height: 4, background: BRAND.card2, borderRadius: 999, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ height: 4, width: `${((step + 1) / totalSteps) * 100}%`, background: BRAND.gold, borderRadius: 999, transition: "width .3s" }} />
          </div>
          {!isReview && <div style={{ display: "grid", gap: 16 }}>{pages[step].map(renderQuestion)}</div>}
          {isReview && (
            <div style={{ display: "grid", gap: 10 }}>
              {template.map((q) => (
                <div key={q.id} style={{ borderTop: `1px solid ${BRAND.line}`, paddingTop: 8 }}>
                  <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 900 }}>{q.text}</div>
                  <div style={{ color: answers[q.id] ? BRAND.text : BRAND.dim, fontSize: 13 }}>{answers[q.id] || "-"}</div>
                </div>
              ))}
              <div style={{ marginTop: 4, color: liveFlags.length ? BRAND.red : BRAND.green, fontSize: 12, fontWeight: 900 }}>{liveFlags.length ? `⚑ ${liveFlags.length} thing${liveFlags.length === 1 ? "" : "s"} flagged for your coach` : "✓ Nothing flagged"}</div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            {step > 0 && <Button variant="dark" onClick={() => setStep(step - 1)} style={{ flex: 1 }}>Back</Button>}
            {!isReview && <Button onClick={() => setStep(step + 1)} style={{ flex: 2 }}>Next</Button>}
            {isReview && <Button onClick={submit} disabled={saving} style={{ flex: 2 }}>{saving ? "Submitting..." : "Submit Check-in"}</Button>}
          </div>
        </Card>
      )}
      <Card style={{ padding: isMobile ? 12 : 16 }}>
        <div style={{ fontSize: 16, fontWeight: 1000, marginBottom: 10 }}>History</div>
        {submissions.length === 0 && <div style={{ color: BRAND.muted }}>No check-ins yet.</div>}
        {[...submissions].reverse().map((s) => (
          <div key={s.id} onClick={() => setOpen(open === s.id ? null : s.id)} style={{ borderTop: `1px solid ${BRAND.line}`, paddingTop: 10, marginTop: 10, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><b>{s.date}</b>{s.flags && s.flags.length > 0 && <span style={{ color: BRAND.red, fontSize: 11, fontWeight: 900 }}>{"⚑"} {s.flags.length}</span>}</div>
              <span style={{ color: BRAND.gold, fontSize: 12, fontWeight: 900 }}>{open === s.id ? "Hide" : "View"}</span>
            </div>
            {open === s.id && <div style={{ marginTop: 8, display: "grid", gap: 6 }}>{s.answers.map((a, i) => <div key={i}><div style={{ color: BRAND.gold, fontSize: 12, fontWeight: 900 }}>{a.question}</div><div style={{ color: BRAND.text, fontSize: 13 }}>{a.answer || "-"}</div></div>)}</div>}
          </div>
        ))}
      </Card>
      {showEditor && <CheckInTemplateEditor trainerId={client.trainer_id} template={template} onSave={(qs) => { setTemplate(qs); setShowEditor(false); }} onClose={() => setShowEditor(false)} />}
    </div>
  );
}
