import { useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Sheet } from "../../components/ui/Sheet.jsx";
import { showToast } from "../../components/ui/Toast.jsx";
import { SLEEP_HOURS, WATER_LITERS } from "../../lib/constants.js";
import { FoodSearchSheet, BarcodeSheet } from "./FoodQuickLog.jsx";
import { todaysHabits, saveHabit, latestWeight, saveMeasurements } from "./quickLogData.js";

const primary = { width: "100%", height: 50, borderRadius: 14, border: "none", background: BRAND.btnBg, color: BRAND.btnInk, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const quick = { flex: 1, height: 44, borderRadius: 12, border: "none", background: BRAND.card2, color: BRAND.text, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const chip = (on) => ({ minWidth: 58, height: 44, borderRadius: 12, border: `1px solid ${on ? BRAND.gold : BRAND.line}`, background: on ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent", color: on ? BRAND.gold : BRAND.text, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" });

const Ico = {
  search: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4-4" /></svg>,
  barcode: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7V5h3M17 5h3v2M4 17v2h3M17 19h3v-2M8 9v6M11 9v6M14 9v6M17 9v6" /></svg>,
  steps: <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="8" cy="7" rx="3" ry="4.5" /><ellipse cx="16" cy="12" rx="3" ry="4.5" /><rect x="5.5" y="12.5" width="5" height="3" rx="1.5" /><rect x="13.5" y="17.5" width="5" height="3" rx="1.5" /></svg>,
  water: <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z" /></svg>,
  sleep: <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 15A8 8 0 019 4a8 8 0 1011 11z" /></svg>,
  tape: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="7" width="18" height="10" rx="2" /><path d="M7 7v4M11 7v3M15 7v4M19 7v3" /></svg>,
};

function StepsSheet({ client, updateClient, onClose }) {
  const [v, setV] = useState(String(todaysHabits(client).steps || ""));
  const n = parseInt(v, 10) || 0;
  async function save() { await saveHabit(client, updateClient, "steps", String(n)); showToast("Steps saved.", "success"); onClose(); }
  return (
    <Sheet title="Steps today" onClose={onClose}>
      <input value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="0" aria-label="Steps today"
        style={{ width: "100%", border: "none", background: "transparent", color: BRAND.text, textAlign: "center", fontFamily: BRAND.display, fontSize: 52, fontWeight: 600, outline: "none", padding: "8px 0" }} />
      <div style={{ display: "flex", gap: 8, margin: "10px 0 12px" }}>
        {[500, 1000, 2000].map((x) => <button key={x} onClick={() => setV(String(n + x))} style={quick}>+{x.toLocaleString()}</button>)}
      </div>
      <button onClick={save} style={primary}>Save steps</button>
    </Sheet>
  );
}
function ChoiceSheet({ title, field, options, suffix, client, updateClient, onClose }) {
  const [v, setV] = useState(String(todaysHabits(client)[field] || ""));
  async function save() { await saveHabit(client, updateClient, field, v); showToast(`${title.split(" ")[0]} saved.`, "success"); onClose(); }
  return (
    <Sheet title={title} onClose={onClose}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {options.filter(Boolean).map((o) => <button key={o} onClick={() => setV(o)} aria-pressed={v === o} style={chip(v === o)}>{o}{suffix}</button>)}
      </div>
      <button onClick={save} disabled={!v} style={primary}>Save</button>
    </Sheet>
  );
}
const MEASURE_FIELDS = [["waist", "Waist", "cm"], ["hip", "Hip", "cm"], ["chest", "Chest", "cm"], ["stomach", "Stomach", "cm"], ["leftArm", "Left arm", "cm"], ["rightArm", "Right arm", "cm"], ["restingHr", "Resting HR", "bpm"], ["vo2max", "VO₂ max", "ml/kg/min"]];
function MeasureSheet({ client, updateClient, onClose }) {
  const [f, setF] = useState({});
  const [saving, setSaving] = useState(false);
  const last = latestWeight(client);
  async function save() {
    setSaving(true);
    try {
      const ok = await saveMeasurements(client, updateClient, f);
      if (!ok) { showToast("Enter your weight or at least one measurement.", "warn"); return; }
      showToast("Saved.", "success"); onClose();
    } finally { setSaving(false); }
  }
  const field = (k, l, unit, big) => (
    <label key={k} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 12, color: BRAND.muted }}>{l} ({unit})</span>
      <input value={f[k] || ""} onChange={(e) => setF({ ...f, [k]: e.target.value.replace(/[^0-9.]/g, "") })} inputMode="decimal" placeholder={big && last ? String(last) : "—"}
        style={{ height: big ? 56 : 44, borderRadius: 12, border: `1px solid ${BRAND.line}`, background: BRAND.card2, color: BRAND.text, padding: "0 12px", fontSize: big ? 22 : 16, fontFamily: big ? BRAND.display : "inherit", fontWeight: big ? 600 : 500, width: "100%", boxSizing: "border-box" }} />
    </label>
  );
  return (
    <Sheet title="Weight & measurements" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {field("weight", "Weight", "kg", true)}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{MEASURE_FIELDS.map(([k, l, u]) => field(k, l, u))}</div>
        <div style={{ fontSize: 12, color: BRAND.dim }}>Fill in what you measured today. Resting HR and VO₂ max are on your watch or Apple Health. Coach Denis sees it in your progress.</div>
        <button onClick={save} disabled={saving} style={primary}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </Sheet>
  );
}

// The + quick-log menu (Nov 2026): log food, scan a barcode, steps, water,
// sleep, weight & measurements. The menu floats above the dock; each
// choice opens its own bottom sheet.
// `view`/`setView` can be passed in so other screens (Home tiles) can open
// a sheet directly; otherwise the menu keeps its own.
export function QuickLogMenu({ client, updateClient, open, onClose, view: viewProp, setView: setViewProp }) {
  const [ownView, setOwnView] = useState(null);
  const view = viewProp !== undefined ? viewProp : ownView;
  const setView = setViewProp || setOwnView;
  const h = todaysHabits(client);
  const w = latestWeight(client);
  const go = (v) => { setView(v); onClose(); };
  const close = () => setView(null);
  const props = { client, updateClient, onClose: close };
  const row = (key, icon, color, label, value) => (
    <button key={key} onClick={() => go(key)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 4px", border: "none", borderTop: key === "steps" ? "none" : `1px solid ${BRAND.lineSoft}`, background: "none", color: BRAND.text, cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 500, textAlign: "left" }}>
      <span style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", background: color, color: "#fff", flexShrink: 0 }}>{icon}</span>
      {label}
      <span style={{ marginLeft: "auto", fontSize: 13, color: BRAND.dim, fontWeight: 400 }}>{value}</span>
    </button>
  );
  return (
    <>
      {open && (
        <>
          <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,20,19,.45)", zIndex: 1050 }} />
          <div role="dialog" aria-label="Quick log" style={{ position: "fixed", left: 10, right: 10, bottom: "calc(98px + env(safe-area-inset-bottom))", zIndex: 1060, maxWidth: 460, margin: "0 auto", background: "var(--sheet)", border: `1px solid ${BRAND.line}`, borderRadius: 28, padding: 14, boxShadow: "0 24px 60px -10px rgba(0,0,0,.45)", fontFamily: BRAND.sans, color: BRAND.text }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[["food", Ico.search, BRAND.gold, "Log food"], ["barcode", Ico.barcode, "var(--orange)", "Scan barcode"]].map(([k, ic, c, l]) => (
                <button key={k} onClick={() => go(k)} style={{ background: BRAND.card2, border: "none", borderRadius: 18, padding: "16px 10px", cursor: "pointer", color: BRAND.text, fontFamily: "inherit", fontSize: 14, fontWeight: 600 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 99, display: "grid", placeItems: "center", margin: "0 auto 8px", background: c, color: k === "food" ? BRAND.btnInk : "#fff" }}>{ic}</span>
                  {l}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 10, background: BRAND.card2, borderRadius: 18, padding: "0 12px" }}>
              {row("steps", Ico.steps, "var(--yellow)", "Steps", h.steps ? `${Number(h.steps).toLocaleString()} today` : "Not logged")}
              {row("water", Ico.water, "var(--blue)", "Water", h.water ? `${h.water} L today` : "Not logged")}
              {row("sleep", Ico.sleep, "var(--violet)", "Sleep", h.sleep ? `${h.sleep} h` : "Not logged")}
              {row("measure", Ico.tape, "var(--green)", "Weight & measurements", w ? `${w} kg` : "")}
            </div>
          </div>
        </>
      )}
      {view === "food" && <FoodSearchSheet {...props} />}
      {view === "barcode" && <BarcodeSheet {...props} onSearchInstead={() => setView("food")} />}
      {view === "steps" && <StepsSheet {...props} />}
      {view === "water" && <ChoiceSheet {...props} title="Water today" field="water" options={WATER_LITERS} suffix=" L" />}
      {view === "sleep" && <ChoiceSheet {...props} title="Sleep last night" field="sleep" options={SLEEP_HOURS} suffix=" h" />}
      {view === "measure" && <MeasureSheet {...props} />}
    </>
  );
}
