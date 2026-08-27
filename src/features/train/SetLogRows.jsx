import { BRAND } from "../../theme/tokens.js";

// Shared set-logging rows: set #, kg, reps, RPE, done. Used by the normal
// single-exercise WorkoutSession view and by SupersetLogger so both stay on
// the exact same fields/behavior instead of drifting into parallel logic.
export function SetLogRows({ entry, timed, lastSets, prog, rpePickerFor, setRpePickerFor, patchSet, addSet, toggleDone, doneColor = BRAND.gold }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr 0.7fr 38px", gap: 6, padding: "0 6px 6px" }}>{["Set", "Kg", "Reps", "RPE", ""].map((h, hi) => <div key={hi} style={{ color: BRAND.muted, fontSize: 9, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.6, textAlign: hi >= 1 && hi <= 3 ? "center" : "left" }}>{h}</div>)}</div>
      {entry.sets.map((s, si) => {
        const prev = lastSets[si] || {};
        return (
          <div key={si} style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr 0.7fr 38px", gap: 6, alignItems: "center", padding: "13px 6px", marginBottom: 8, borderRadius: 13, background: s.done ? `${doneColor}12` : BRAND.card2, border: `1px solid ${s.done ? doneColor : BRAND.line}` }}>
            <div style={{ fontWeight: 1000, fontSize: 15, textAlign: "center" }}>{si + 1}</div>
            <input inputMode="decimal" placeholder={prev.load || (timed ? "load" : "kg")} value={s.load || ""} onChange={(e) => patchSet(entry.id, si, { load: e.target.value })} style={{ width: "100%", minWidth: 0, background: "transparent", border: "none", color: BRAND.text, fontWeight: 1000, fontSize: 17, textAlign: "center", outline: "none" }} />
            <input inputMode="numeric" placeholder={timed ? (prev.duration || "s") : (prev.reps || "reps")} value={timed ? (s.duration || "") : (s.reps || "")} onChange={(e) => patchSet(entry.id, si, timed ? { duration: e.target.value } : { reps: e.target.value })} style={{ width: "100%", minWidth: 0, background: "transparent", border: "none", color: BRAND.text, fontWeight: 1000, fontSize: 17, textAlign: "center", outline: "none" }} />
            <div style={{ position: "relative" }}>
              <button onClick={() => setRpePickerFor(rpePickerFor === `${entry.id}:${si}` ? null : `${entry.id}:${si}`)} style={{ width: "100%", background: "transparent", border: "none", color: s.rpe ? BRAND.text : BRAND.dim, fontWeight: 1000, fontSize: 16, textAlign: "center", cursor: "pointer" }}>{s.rpe || "—"}</button>
              {rpePickerFor === `${entry.id}:${si}` && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 20, background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: 6, display: "flex", gap: 4, boxShadow: "0 8px 24px rgba(0,0,0,.5)" }}>
                  {[6, 7, 8, 9, 10].map((n) => (
                    <button key={n} onClick={() => { patchSet(entry.id, si, { rpe: String(n) }); setRpePickerFor(null); }} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${String(s.rpe) === String(n) ? BRAND.gold : BRAND.line}`, background: String(s.rpe) === String(n) ? BRAND.gold : BRAND.panel, color: String(s.rpe) === String(n) ? "#000" : BRAND.text, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{n}</button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "grid", placeItems: "center" }}>
              <button onClick={() => toggleDone(entry, si)} style={{ width: 32, height: 32, borderRadius: 9, border: `1.5px solid ${s.done ? doneColor : BRAND.dim}`, background: s.done ? doneColor : "transparent", color: "#000", fontWeight: 1000, fontSize: 15, cursor: "pointer" }}>{s.done ? "✓" : ""}</button>
            </div>
          </div>
        );
      })}
      <button onClick={() => addSet(entry.id)} style={{ width: "100%", marginTop: 2, padding: "12px", borderRadius: 12, border: `1px dashed ${BRAND.line}`, background: "transparent", color: BRAND.gold, fontWeight: 1000, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, cursor: "pointer" }}>+ Add set</button>
      {prog && <div style={{ color: BRAND.dim, fontSize: 10, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 12, textAlign: "center" }}>▲ Progressive overload — +{prog.bump}kg vs last week</div>}
    </div>
  );
}
