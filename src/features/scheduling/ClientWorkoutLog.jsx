import { useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field, inputStyle } from "../../components/ui/Field.jsx";
import { useIsMobile } from "../../lib/browser.js";
import { uid } from "../../lib/uid.js";
import { isoDate } from "../../lib/dateUtils.js";
import { upsertSection } from "../../lib/clientData.js";
import { RPE_OPTIONS } from "../../lib/constants.js";

export function ClientWorkoutLog({ client, updateClient }) {
  const isMobile = useIsMobile(520);
  const [logs, setLogs] = useState(client.workoutLogs || []);
  const [form, setForm] = useState({ date: isoDate(), workout: "", weights: "", cardio: "", rpe: "", notes: "" });
  async function add() { const next = [{ id: uid(), ...form }, ...logs]; setLogs(next); await upsertSection(client.id, "workoutLogs", next); updateClient({ ...client, workoutLogs: next }); setForm({ ...form, workout: "", weights: "", cardio: "", rpe: "", notes: "" }); }
  return <Card style={{ padding: isMobile ? 12 : 16 }}><div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 1000 }}>Workout Log</div><div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}><Field label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} /><Field label="Workout done" value={form.workout} onChange={(v) => setForm({ ...form, workout: v })} /><Field label="Weights / reps" value={form.weights} onChange={(v) => setForm({ ...form, weights: v })} /><Field label="Cardio" value={form.cardio} onChange={(v) => setForm({ ...form, cardio: v })} /><label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 }}>RPE</div><select value={form.rpe || ""} onChange={(e) => setForm({ ...form, rpe: e.target.value })} style={inputStyle()}>{RPE_OPTIONS.map((r) => <option key={r} value={r}>{r || "RPE"}</option>)}</select></label></div><Field label="Notes" textarea value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} /><Button onClick={add} style={{ marginTop: 10 }}>Log Workout</Button>{logs.map((l) => <div key={l.id} style={{ borderTop: `1px solid ${BRAND.line}`, marginTop: 12, paddingTop: 12 }}><b>{l.date} - {l.workout}</b><div style={{ color: BRAND.muted }}>{l.weights} · {l.cardio} · RPE {l.rpe}</div><div>{l.notes}</div></div>)}</Card>;
}
