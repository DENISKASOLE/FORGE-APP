import { useMemo, useState } from "react";
import { NP, npCard, npInput, npButton, npLabel } from "./theme.jsx";
import { currentProgramWeek, weekDayMap } from "../../lib/programModel.js";

const DOW_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DOW_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

// Spec §5.3 step 3 defaults. A program's scheduled training weekdays come
// from its CURRENT week's workouts (dayOfWeek, 1=Mon..7=Sun, see
// weekDayMap in programModel.js) - the same source the Train tab itself
// uses to lay out the week, so this stays in sync without new state.
export function defaultSchedule(doc, client) {
  const days = doc.days;
  const sched = {};
  if (days.length === 1) {
    DOW_KEYS.forEach((k) => { sched[k] = days[0].id; });
    return sched;
  }
  const training = days.filter((d) => d.type === "training");
  const rest = days.filter((d) => d.type === "rest");
  if (days.length === 2 && training.length === 1 && rest.length === 1) {
    let trainingDows = null;
    const program = client?.program;
    if (program?.weeks?.length) {
      const week = program.weeks[Math.min(currentProgramWeek(program), program.weeks.length) - 1];
      const dows = Object.keys(weekDayMap(week)).map(Number);
      if (dows.length) trainingDows = dows;
    }
    if (!trainingDows) trainingDows = [1, 2, 4, 5]; // Mon/Tue/Thu/Fri fallback
    DOW_KEYS.forEach((k, i) => { sched[k] = trainingDows.includes(i + 1) ? training[0].id : rest[0].id; });
    return sched;
  }
  DOW_KEYS.forEach((k, i) => { sched[k] = days[i % days.length].id; });
  return sched;
}

function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Spec §5.3: one sheet, six steps. Step 5 ("edit for this client before
// signing") hands off to PlanBuilder itself in a client-sign context
// (see PlanBuilder's `signContext` prop) rather than duplicating the
// whole block-editing UI here - onEditForClient closes this sheet and
// opens the builder on a cloned doc with schedule/startDate/note carried
// over, so the coach only fills those in once.
export function AssignPlanSheet({ doc, clients, onClose, onSignDirect, onEditForClient }) {
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState(null);
  const [startDate, setStartDate] = useState(todayLocalISO());
  const [schedule, setSchedule] = useState(null);
  const [note, setNote] = useState("");
  const [editBeforeSigning, setEditBeforeSigning] = useState(false);
  const [signing, setSigning] = useState(false);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [clients, search]);
  const client = clients.find((c) => c.id === clientId) || null;

  function pickClient(c) {
    setClientId(c.id);
    setSchedule(defaultSchedule(doc, c));
  }

  async function handleSubmit() {
    if (!client || !schedule) return;
    if (editBeforeSigning) {
      onEditForClient({ client, schedule, startDate, coachNote: note });
      return;
    }
    setSigning(true);
    try {
      await onSignDirect({ client, schedule, startDate, coachNote: note });
    } finally {
      setSigning(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1300, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,.6)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, maxHeight: "88vh", overflow: "auto", boxSizing: "border-box", padding: "12px 20px 28px", background: NP.card, borderTop: `1px solid ${NP.lineDashed}`, borderRadius: "24px 24px 0 0", fontFamily: NP.font }}>
        <div style={{ width: 40, height: 4, borderRadius: 999, background: NP.lineDashed, margin: "4px auto 16px" }} />
        <div style={{ fontSize: 20, color: NP.text, letterSpacing: "0.02em", marginBottom: 4 }}>ASSIGN "{doc.name}"</div>
        <div style={{ fontSize: 12, color: NP.muted, marginBottom: 16 }}>Pick a client, set their schedule, and sign — they'll get a message the moment you do.</div>

        {!client ? (
          <>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients..." style={npInput({ marginBottom: 10 })} autoFocus />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {matches.map((c) => {
                const active = c.nutritionPlan?.active;
                return (
                  <button key={c.id} onClick={() => pickClient(c)} style={{ textAlign: "left", background: NP.card2, border: "none", borderRadius: 10, padding: "12px 14px", color: NP.text, fontFamily: NP.font, cursor: "pointer" }}>
                    <div style={{ fontSize: 14 }}>{c.name}</div>
                    {active && <div style={{ fontSize: 11, color: NP.warn, marginTop: 3, letterSpacing: "0.04em" }}>ACTIVE: {active.doc.name.toUpperCase()} · V{active.version}</div>}
                  </button>
                );
              })}
              {matches.length === 0 && <div style={{ color: NP.dim, fontSize: 12, padding: "8px 2px" }}>No clients match "{search}".</div>}
            </div>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={npCard({ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" })}>
              <div style={{ fontSize: 14, color: NP.text }}>{client.name}</div>
              <button onClick={() => setClientId(null)} style={npButton("ghost", { fontSize: 10, height: 28, padding: "0 10px" })}>CHANGE</button>
            </div>
            {client.nutritionPlan?.active && (
              <div style={{ fontSize: 11, color: NP.warn, letterSpacing: "0.04em" }}>They already have an active plan: {client.nutritionPlan.active.doc.name.toUpperCase()} · V{client.nutritionPlan.active.version}. Signing creates V{client.nutritionPlan.active.version + 1} and archives it.</div>
            )}

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 10, letterSpacing: "0.14em", color: NP.muted }}>START DATE
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={npInput()} />
            </label>

            <div>
              <div style={{ ...npLabel(), marginBottom: 8 }}>WEEKLY SCHEDULE</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {DOW_KEYS.map((k, i) => (
                  <div key={k} style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: NP.dim, letterSpacing: "0.1em" }}>{DOW_LABELS[i]}</span>
                    <select value={schedule[k]} onChange={(e) => setSchedule({ ...schedule, [k]: e.target.value })} style={npInput({ height: 38 })}>
                      {doc.days.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.type.toUpperCase()}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 10, letterSpacing: "0.14em", color: NP.muted }}>NOTE TO CLIENT (OPTIONAL)
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Goes into the message with the plan." style={{ ...npInput({ height: "auto", padding: 10 }), resize: "vertical" }} />
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: NP.text, cursor: "pointer" }}>
              <input type="checkbox" checked={editBeforeSigning} onChange={(e) => setEditBeforeSigning(e.target.checked)} />
              EDIT FOR THIS CLIENT BEFORE SIGNING
            </label>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose} style={npButton("ghost", { flex: 1 })}>CANCEL</button>
              <button onClick={handleSubmit} disabled={signing} style={npButton("fill", { flex: 2 })}>
                {signing ? "SIGNING…" : editBeforeSigning ? "OPEN EDITOR" : "SIGN & SEND"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
