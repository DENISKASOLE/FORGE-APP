import { BRAND } from "../../theme/tokens.js";

// Shared set-logging rows: set #, kg, reps, RPE, done. Used by the normal
// single-exercise WorkoutSession view and by SupersetLogger so both stay on
// the exact same fields/behavior instead of drifting into parallel logic.
export function SetLogRows({ entry, timed, lastSets, prog, rpePickerFor, setRpePickerFor, patchSet, addSet, toggleDone, doneColor = BRAND.green }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr 0.7fr 38px", gap: 6, padding: "0 6px 6px" }}>{["Set", "Kg", "Reps", "RPE", ""].map((h, hi) => <div key={hi} style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", textAlign: hi >= 1 && hi <= 3 ? "center" : "left" }}>{h}</div>)}</div>
      {entry.sets.map((s, si) => {
        const prev = lastSets[si] || {};
        return (
          <div key={si} style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr 0.7fr 38px", gap: 6, alignItems: "center", padding: "13px 6px", marginBottom: 8, borderRadius: BRAND.radiusControl, background: s.done ? `color-mix(in srgb, ${doneColor} 12%, transparent)` : BRAND.card2, border: `${BRAND.hairline} solid ${s.done ? doneColor : BRAND.line}` }}>
            <div style={{ fontFamily: BRAND.sans, fontWeight: 500, fontSize: 15, textAlign: "center" }}>{si + 1}</div>
            <input inputMode="decimal" placeholder={prev.load || (timed ? "load" : "kg")} value={s.load || ""} onChange={(e) => patchSet(entry.id, si, { load: e.target.value })} style={{ fontFamily: BRAND.sans, width: "100%", minWidth: 0, background: "transparent", border: "none", color: BRAND.text, fontWeight: 500, fontSize: 17, textAlign: "center", outline: "none" }} />
            <input inputMode="numeric" placeholder={timed ? (prev.duration || "s") : (prev.reps || "reps")} value={timed ? (s.duration || "") : (s.reps || "")} onChange={(e) => patchSet(entry.id, si, timed ? { duration: e.target.value } : { reps: e.target.value })} style={{ fontFamily: BRAND.sans, width: "100%", minWidth: 0, background: "transparent", border: "none", color: BRAND.text, fontWeight: 500, fontSize: 17, textAlign: "center", outline: "none" }} />
            <div style={{ position: "relative" }}>
              <button onClick={() => setRpePickerFor(rpePickerFor === `${entry.id}:${si}` ? null : `${entry.id}:${si}`)} style={{ fontFamily: BRAND.sans, width: "100%", background: "transparent", border: "none", color: s.rpe ? BRAND.text : BRAND.dim, fontWeight: 500, fontSize: 16, textAlign: "center", cursor: "pointer" }}>{s.rpe || "—"}</button>
              {rpePickerFor === `${entry.id}:${si}` && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 20, background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusControl, padding: 6, display: "flex", gap: 4 }}>
                  {[6, 7, 8, 9, 10].map((n) => (
                    <button key={n} onClick={() => { patchSet(entry.id, si, { rpe: String(n) }); setRpePickerFor(null); }} style={{ fontFamily: BRAND.sans, width: 32, height: 32, borderRadius: 8, border: `${BRAND.hairline} solid ${String(s.rpe) === String(n) ? BRAND.gold : BRAND.line}`, background: String(s.rpe) === String(n) ? BRAND.btnBg : BRAND.panel, color: String(s.rpe) === String(n) ? BRAND.btnInk : BRAND.text, fontWeight: 500, fontSize: 13, cursor: "pointer" }}>{n}</button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "grid", placeItems: "center" }}>
              <button onClick={() => toggleDone(entry, si)} style={{ width: 32, height: 32, borderRadius: 9, border: `1.5px solid ${s.done ? doneColor : BRAND.dim}`, background: s.done ? doneColor : "transparent", color: BRAND.btnInk, fontWeight: 500, fontSize: 15, cursor: "pointer" }}>{s.done ? "✓" : ""}</button>
            </div>
          </div>
        );
      })}
      <button onClick={() => addSet(entry.id)} style={{ fontFamily: BRAND.sans, width: "100%", marginTop: 2, padding: "12px", borderRadius: BRAND.radiusControl, border: `1px dashed ${BRAND.line}`, background: "transparent", color: BRAND.gold, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", cursor: "pointer" }}>+ Add set</button>
      {prog && <div style={{ fontFamily: BRAND.sans, color: BRAND.dim, fontSize: 11, fontWeight: 500, marginTop: 12, textAlign: "center" }}>Progressive overload — +{prog.bump}kg vs last week</div>}
    </div>
  );
}
