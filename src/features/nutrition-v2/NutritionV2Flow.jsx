import { useEffect, useMemo, useState } from "react";
import { Chip } from "../../components/ui/Chip.jsx";
import { Field } from "../../components/ui/Field.jsx";
import { showToast } from "../../components/ui/Toast.jsx";
import { isoDate } from "../../lib/dateUtils.js";
import { uid } from "../../lib/uid.js";
import { loadFoodLibrary } from "../../lib/nutritionPlan.js";
import { useFatSecretResults } from "../../lib/fatsecret.js";
import { normalizePlans, normalizeLogs, normalizeMarks, logsForDate, marksForDate, saveLogs, saveMarks } from "../../lib/nutritionV2.js";
import { normalizeFoodRow, unitGramsFor, fatSecretFoodRow } from "./nutritionV2Model.js";
import { itemMacros, mealTotals, planForDate, mealStatus, unplannedEntries, loggedDayTotals, mergeLegacyMacroLog, addDaysISO } from "./nutritionV2Math.js";
import { CoachPlanBuilderV2 } from "./CoachPlanBuilderV2.jsx";
import { ClientFoodLogTab } from "./ClientFoodLogTab.jsx";
import { NutritionV2Progress } from "./NutritionV2Progress.jsx";
import { Ring, MacroBarRow } from "./NutritionRing.jsx";
import { FatSecretResultRow, FatSecretGroupLabel, FatSecretServingSheet } from "./FatSecretSearch.jsx";
import { NT, MACRO_COLORS } from "./nutritionV2Theme.js";

const PORTION_CHIPS = [["None", 0], ["Half", 0.5], ["Three quarters", 0.75], ["All", 1]];
const STATUS_META = {
  eaten: ["As planned", NT.protein], partial: ["Partly eaten", NT.accent], substituted: ["Substituted", NT.fat],
  skipped: ["Skipped", NT.dim], open: ["Not logged", NT.dim], future: ["Upcoming", NT.dim],
};

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtHeaderDate(dateISO) {
  const d = new Date(`${dateISO}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}
function itemLine(it) { return `${it.name} ${it.qty}${it.unit === "piece" ? "" : it.unit}`; }
function pillBtnStyle(selected) {
  return { border: `1px solid ${selected ? "transparent" : NT.lineSoft}`, background: selected ? NT.accent : "transparent", color: selected ? NT.bg : NT.muted, fontFamily: NT.sans, fontSize: 11, fontWeight: 600, padding: "9px 14px", borderRadius: 999, cursor: "pointer" };
}

function PortionSheet({ meal, onClose, onApply }) {
  const [pct, setPct] = useState(1);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 420, background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 20, padding: 18 }}>
        <div style={{ fontFamily: NT.sans, fontSize: 12, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: NT.muted, marginBottom: 10 }}>How much of {meal.name} did you eat?</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {PORTION_CHIPS.map(([label, v]) => <button key={v} onClick={() => setPct(v)} style={pillBtnStyle(pct === v)}>{label}</button>)}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: "transparent", border: `1px solid ${NT.lineSoft}`, color: NT.muted, fontFamily: NT.sans, fontSize: 13, fontWeight: 600, padding: 13, borderRadius: 14, cursor: "pointer" }}>Cancel</button>
          <button onClick={() => onApply(pct)} style={{ flex: 1, background: NT.accent, border: "none", color: NT.bg, fontFamily: NT.sans, fontSize: 13, fontWeight: 700, padding: 13, borderRadius: 14, cursor: "pointer" }}>Apply</button>
        </div>
      </div>
    </div>
  );
}

// Search (local library + FatSecret, same as the regular food log) finds
// an exact match to log with real macros. "Describe it" is the fallback
// for anything that isn't in either database - a HubFit-style Quick Log:
// type what you had and its macros (roughly, if known) and log it as-is,
// rather than leaving a client stuck with no way to submit. Either path
// hands the caller one plain {name, foodId, qty, unit, macros, reason}
// object - OverviewTab's applySub() just finishes it into a log entry.
function SubstituteSheet({ meal, foods, onClose, onApply }) {
  const [mode, setMode] = useState("search"); // 'search' | 'quick'
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState(null);
  const [fsPick, setFsPick] = useState(null);
  const [quick, setQuick] = useState({ name: "", kcal: "", protein: "", carbs: "", fat: "" });
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => (q ? foods.filter((f) => !f.archived && f.name.toLowerCase().includes(q)).slice(0, 8) : []), [foods, q]);
  const { results: fsResults, loading: fsLoading } = useFatSecretResults(query);
  const reasons = ["Schedule", "Eating out", "Preference", "Not available", "Not hungry"];

  function pickLocal(foodRow) {
    const food = normalizeFoodRow(foodRow);
    const qty = food.unit === "piece" ? 1 : 100;
    const unit = food.unit === "piece" ? "piece" : food.unit;
    const factor = (qty * unitGramsFor(food, unit)) / (food.basisGrams || 100);
    onApply({ name: food.name, foodId: food.id, qty, unit, macros: { kcal: food.kcal * factor, protein: food.protein * factor, carbs: food.carbs * factor, fat: food.fat * factor }, reason });
  }
  function pickFatSecret(serving, multiplier) {
    const food = normalizeFoodRow(fatSecretFoodRow(fsPick, serving));
    const factor = (multiplier * unitGramsFor(food, food.unit)) / (food.basisGrams || 100);
    onApply({ name: food.name, foodId: food.id, qty: multiplier, unit: food.unit, macros: { kcal: food.kcal * factor, protein: food.protein * factor, carbs: food.carbs * factor, fat: food.fat * factor }, reason });
    setFsPick(null);
  }
  function logQuick() {
    if (!quick.name.trim()) { showToast("Describe what you had.", "warn"); return; }
    onApply({ name: quick.name.trim(), foodId: null, qty: null, unit: null, macros: { kcal: Number(quick.kcal) || 0, protein: Number(quick.protein) || 0, carbs: Number(quick.carbs) || 0, fat: Number(quick.fat) || 0 }, reason });
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 440, maxHeight: "88vh", overflow: "auto", background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 20, padding: 18 }}>
        <div style={{ fontFamily: NT.sans, fontSize: 12, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: NT.muted, marginBottom: 4 }}>Log a substitution for {meal.name}</div>
        <div style={{ color: NT.dim, fontFamily: NT.sans, fontSize: 12, marginBottom: 12 }}>The prescription stays as-is — your coach sees both.</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {reasons.map((r) => <button key={r} onClick={() => setReason(reason === r ? null : r)} style={pillBtnStyle(reason === r)}>{r}</button>)}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {[["search", "Search"], ["quick", "Describe it"]].map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} style={{ border: `1px solid ${mode === k ? "transparent" : NT.lineSoft}`, background: mode === k ? NT.accent : "transparent", color: mode === k ? NT.bg : NT.muted, fontFamily: NT.sans, fontSize: 11, fontWeight: 600, padding: "9px 14px", borderRadius: 999, cursor: "pointer" }}>{l}</button>
          ))}
        </div>

        {mode === "search" ? (
          <>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What did you have instead?" autoFocus
              style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${NT.lineSoft}`, background: NT.card2, color: NT.text, fontFamily: NT.sans, fontSize: 13.5, padding: "11px 14px", borderRadius: 14, outline: "none", marginBottom: 8 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflow: "auto" }}>
              {matches.map((f) => (
                <button key={f.id} onClick={() => pickLocal(f)} style={{ display: "flex", justifyContent: "space-between", textAlign: "left", background: NT.card2, border: "none", borderRadius: 10, padding: "10px 12px", color: NT.text, fontFamily: NT.sans, fontSize: 13, cursor: "pointer" }}>
                  <span>{f.name}</span><span style={{ color: NT.dim, fontSize: 11 }}>{f.kcal} kcal/100{f.unit === "ml" ? "ml" : "g"}</span>
                </button>
              ))}
              {q && matches.length === 0 && fsResults.length === 0 && !fsLoading && (
                <div style={{ color: NT.muted, fontSize: 12, padding: "6px 2px" }}>No foods match "{query.trim()}" yet — try <button onClick={() => setMode("quick")} style={{ background: "none", border: "none", color: NT.accent, fontFamily: NT.sans, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>describing it</button> instead.</div>
              )}
              {fsResults.length > 0 && (
                <>
                  {matches.length > 0 && <FatSecretGroupLabel />}
                  {fsResults.map((f) => <FatSecretResultRow key={f.id} food={f} onClick={() => setFsPick(f)} />)}
                </>
              )}
              {fsLoading && <div style={{ color: NT.dim, fontSize: 11, padding: "6px 2px" }}>Searching FatSecret...</div>}
            </div>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Field label="What did you have?" value={quick.name} onChange={(v) => setQuick((q2) => ({ ...q2, name: v }))} placeholder="e.g. Oatmeal with berries" />
            <div style={{ color: NT.dim, fontFamily: NT.sans, fontSize: 11 }}>Macros optional — leave blank if you're not sure.</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              <Field label="Kcal" type="number" value={quick.kcal} onChange={(v) => setQuick((q2) => ({ ...q2, kcal: v }))} />
              <Field label="Protein" type="number" value={quick.protein} onChange={(v) => setQuick((q2) => ({ ...q2, protein: v }))} />
              <Field label="Carbs" type="number" value={quick.carbs} onChange={(v) => setQuick((q2) => ({ ...q2, carbs: v }))} />
              <Field label="Fat" type="number" value={quick.fat} onChange={(v) => setQuick((q2) => ({ ...q2, fat: v }))} />
            </div>
            <button onClick={logQuick} style={{ background: NT.accent, border: "none", color: NT.bg, fontFamily: NT.sans, fontSize: 13, fontWeight: 700, padding: 13, borderRadius: 14, cursor: "pointer" }}>Log substitution</button>
          </div>
        )}
        <button onClick={onClose} style={{ marginTop: 14, width: "100%", background: "transparent", border: `1px solid ${NT.lineSoft}`, color: NT.muted, fontFamily: NT.sans, fontSize: 13, fontWeight: 600, padding: 13, borderRadius: 14, cursor: "pointer" }}>Cancel</button>
      </div>
      {fsPick && <FatSecretServingSheet food={fsPick} onClose={() => setFsPick(null)} onAdd={pickFatSecret} />}
    </div>
  );
}

// One row of the meals timeline: a status dot + connecting line on the
// left, a warm card on the right with the prescription, actual-eaten
// note, and action buttons - replaces the old plain stacked meal cards.
function ClientMealCard({ meal, status, dateEntries, editable, showLine, onConfirm, onOpenEdit, onOpenSub, onSkip, onUnskip }) {
  const totals = mealTotals(meal);
  const confirmedEntries = dateEntries.filter((e) => e.source === "confirm" && e.meal === meal.key);
  const subEntries = dateEntries.filter((e) => e.source === "sub" && e.replaces === meal.key);
  const [label, color] = STATUS_META[status] || STATUS_META.open;
  return (
    <div style={{ display: "flex", gap: 14 }}>
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", width: 10 }}>
        <div aria-hidden="true" style={{ width: 9, height: 9, borderRadius: "50%", marginTop: 6, background: status === "open" ? "transparent" : color, border: status === "open" ? `1px solid ${NT.faint}` : "none" }} />
        {showLine && <div style={{ width: 1, flex: 1, background: NT.line, marginTop: 6 }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0, background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 18, padding: "14px 16px", marginBottom: 14, opacity: status === "skipped" ? 0.6 : 1, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: NT.sans, fontWeight: 600, fontSize: 14.5, color: NT.text }}>{meal.name} <span style={{ color: NT.dim, fontSize: 12, fontWeight: 400 }}>{meal.time}</span></div>
            <div style={{ color: NT.dim, fontFamily: NT.sans, fontSize: 11.5, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meal.items.map(itemLine).join(", ") || "No foods prescribed"}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontFamily: NT.sans, fontSize: 13.5, fontWeight: 600, color: NT.text }}>{Math.round(totals.kcal)} kcal</div>
            <span style={{ fontSize: 10, fontWeight: 600, color, background: status === "open" ? "transparent" : `${color}22`, padding: status === "open" ? 0 : "2px 8px", borderRadius: 999, display: "inline-block", marginTop: 4 }}>{label}</span>
          </div>
        </div>
        {status === "substituted" && subEntries.length > 0 && (
          <div style={{ background: NT.card2, borderRadius: 10, padding: 10, fontFamily: NT.sans, fontSize: 12, color: NT.text }}>
            Actually eaten: {subEntries.map((e) => `${e.name}${e.qty ? ` ${e.qty}${e.unit === "piece" ? "" : e.unit}` : ""}${e.reason ? ` · ${e.reason}` : ""}`).join(", ")}
          </div>
        )}
        {(status === "eaten" || status === "partial") && confirmedEntries.length > 0 && (
          <div style={{ color: NT.dim, fontFamily: NT.sans, fontSize: 11 }}>Logged at {confirmedEntries[0].time}</div>
        )}
        {editable && (status === "open" || status === "eaten" || status === "partial") && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 }}>
            <button onClick={onConfirm} style={{ background: NT.accent, color: NT.bg, border: "none", fontFamily: NT.sans, fontSize: 11.5, fontWeight: 700, padding: "10px 6px", borderRadius: 11, cursor: "pointer" }}>Ate as planned</button>
            <button onClick={onOpenEdit} style={{ background: NT.card2, color: NT.text, border: "none", fontFamily: NT.sans, fontSize: 11.5, fontWeight: 600, padding: "10px 6px", borderRadius: 11, cursor: "pointer" }}>Edit portion</button>
            <button onClick={onOpenSub} style={{ background: NT.card2, color: NT.text, border: "none", fontFamily: NT.sans, fontSize: 11.5, fontWeight: 600, padding: "10px 6px", borderRadius: 11, cursor: "pointer" }}>Substitute</button>
          </div>
        )}
        {editable && status === "open" && <button onClick={onSkip} style={{ alignSelf: "flex-start", background: "none", border: "none", color: NT.dim, fontFamily: NT.sans, fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: 0 }}>Skip meal</button>}
        {editable && status === "skipped" && <button onClick={onUnskip} style={{ alignSelf: "flex-start", background: "none", border: "none", color: NT.dim, fontFamily: NT.sans, fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: 0 }}>Undo skip</button>}
      </div>
    </div>
  );
}

function OverviewTab({ dateISO, today, signedPlan, dateEntries, dateMarks, foods, onWrite }) {
  const [editingMeal, setEditingMeal] = useState(null); // {mode:'portion'|'sub', meal}
  const totals = loggedDayTotals(dateEntries);
  const unplanned = unplannedEntries(dateEntries);
  const target = signedPlan?.targets || {};
  const maxMacro = Math.max(target.protein || 0, target.carbs || 0, target.fat || 0, totals.protein, totals.carbs, totals.fat, 1);

  async function confirmMeal(meal) {
    const st = mealStatus(dateISO, today, meal, dateEntries, dateMarks);
    if (st === "eaten") { showToast(`${meal.name} is already logged as planned.`, "info"); return; }
    const kept = dateEntries.filter((e) => !(e.source === "confirm" && e.meal === meal.key));
    const added = meal.items.map((it) => ({ id: uid(), date: dateISO, meal: meal.key, name: it.name, foodId: it.foodId, qty: it.qty, unit: it.unit, macros: itemMacros(it), source: "confirm", time: nowHHMM(), planItemId: it.id, estimate: false, replaces: null, reason: null }));
    await onWrite([...kept, ...added], dateMarks);
    if (navigator.vibrate) navigator.vibrate(10);
    showToast(`${meal.name} logged as planned.`, "success");
  }
  async function applyPortion(meal, pct) {
    const kept = dateEntries.filter((e) => !(e.source === "confirm" && e.meal === meal.key));
    const added = pct > 0 ? meal.items.map((it) => ({ id: uid(), date: dateISO, meal: meal.key, name: it.name, foodId: it.foodId, qty: Math.round(it.qty * pct * 10) / 10, unit: it.unit, macros: { kcal: itemMacros(it).kcal * pct, protein: itemMacros(it).protein * pct, carbs: itemMacros(it).carbs * pct, fat: itemMacros(it).fat * pct }, source: "confirm", time: nowHHMM(), planItemId: it.id, estimate: false, replaces: null, reason: null })) : [];
    await onWrite([...kept, ...added], dateMarks);
    setEditingMeal(null);
    showToast(pct > 0 ? `${meal.name} portion saved.` : `${meal.name}: nothing logged.`, "success");
  }
  async function applySub(meal, sub) {
    const kept = dateEntries.filter((e) => !(e.source === "confirm" && e.meal === meal.key));
    const entry = { id: uid(), date: dateISO, meal: meal.key, name: sub.name, foodId: sub.foodId, qty: sub.qty, unit: sub.unit, macros: sub.macros, source: "sub", time: nowHHMM(), planItemId: null, estimate: false, replaces: meal.key, reason: sub.reason };
    await onWrite([...kept, entry], dateMarks);
    setEditingMeal(null);
    showToast(`Logged as a substitution for ${meal.name}.`, "success");
  }
  async function skipMeal(meal) {
    const kept = dateEntries.filter((e) => !(e.source === "confirm" && e.meal === meal.key));
    await onWrite(kept, { ...dateMarks, [meal.key]: "skipped" });
    showToast(`${meal.name} marked as skipped.`, "success");
  }
  async function unskipMeal(meal) {
    const nextMarks = { ...dateMarks };
    delete nextMarks[meal.key];
    await onWrite(dateEntries, nextMarks);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 28, padding: "28px 24px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <Ring value={totals.kcal} max={target.kcal || totals.kcal || 1} size={188} stroke={14} color={MACRO_COLORS.kcal}>
          <span style={{ fontFamily: NT.display, fontSize: 40, fontWeight: 620, lineHeight: 1, color: NT.text }}>{Math.round(totals.kcal)}</span>
          <span style={{ fontFamily: NT.sans, fontSize: 11, color: NT.dim }}>of {Math.round(target.kcal || 0) || "—"} kcal</span>
          {target.kcal > 0 && (
            <span style={{ marginTop: 6, fontFamily: NT.sans, fontSize: 11, fontWeight: 600, color: NT.accent, background: NT.accentBg, padding: "3px 10px", borderRadius: 999 }}>
              {target.kcal - totals.kcal >= 0 ? `${Math.round(target.kcal - totals.kcal)} left` : `${Math.round(totals.kcal - target.kcal)} over`}
            </span>
          )}
        </Ring>
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          <MacroBarRow label="Protein" color={MACRO_COLORS.protein} pct={(totals.protein / maxMacro) * 100} value={`${Math.round(totals.protein)} / ${Math.round(target.protein || 0)}g`} />
          <MacroBarRow label="Carbs" color={MACRO_COLORS.carbs} pct={(totals.carbs / maxMacro) * 100} value={`${Math.round(totals.carbs)} / ${Math.round(target.carbs || 0)}g`} />
          <MacroBarRow label="Fat" color={MACRO_COLORS.fat} pct={(totals.fat / maxMacro) * 100} value={`${Math.round(totals.fat)} / ${Math.round(target.fat || 0)}g`} />
        </div>
      </div>

      {!signedPlan ? (
        <div style={{ background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 18, padding: 16, color: NT.muted, fontFamily: NT.sans, fontSize: 13 }}>No meals prescribed for this date. You can still log what you eat in Food log.</div>
      ) : (
        <div>
          <div style={{ padding: "0 2px 4px", fontFamily: NT.sans, fontSize: 12, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: NT.muted }}>Today's meals</div>
          {signedPlan.meals.map((meal, i) => (
            <ClientMealCard
              key={meal.key} meal={meal} status={mealStatus(dateISO, today, meal, dateEntries, dateMarks)} dateEntries={dateEntries}
              editable={dateISO <= today} showLine={i < signedPlan.meals.length - 1}
              onConfirm={() => confirmMeal(meal)}
              onOpenEdit={() => setEditingMeal({ mode: "portion", meal })}
              onOpenSub={() => setEditingMeal({ mode: "sub", meal })}
              onSkip={() => skipMeal(meal)}
              onUnskip={() => unskipMeal(meal)}
            />
          ))}
        </div>
      )}

      {unplanned.length > 0 && (
        <div style={{ background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 18, padding: 14 }}>
          <div style={{ fontFamily: NT.sans, fontSize: 12, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: NT.muted, marginBottom: 8 }}>Also logged</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {unplanned.map((e) => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", fontFamily: NT.sans, fontSize: 13, color: NT.text }}>
                <span>{e.name} <span style={{ color: NT.dim, fontSize: 11 }}>· {e.time}</span></span><span>{Math.round(e.macros.kcal)} kcal</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {editingMeal?.mode === "portion" && <PortionSheet meal={editingMeal.meal} onClose={() => setEditingMeal(null)} onApply={(pct) => applyPortion(editingMeal.meal, pct)} />}
      {editingMeal?.mode === "sub" && <SubstituteSheet meal={editingMeal.meal} foods={foods} onClose={() => setEditingMeal(null)} onApply={(sub) => applySub(editingMeal.meal, sub)} />}
    </div>
  );
}

function MealPlanTab({ signedPlan }) {
  if (!signedPlan) return <div style={{ background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 18, padding: 16, color: NT.muted, fontFamily: NT.sans, fontSize: 13 }}>No meals prescribed for this date.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 18, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div style={{ fontFamily: NT.display, fontWeight: 600, fontSize: 16, color: NT.text }}>Plan v{signedPlan.version}</div>
          <div style={{ color: NT.dim, fontFamily: NT.sans, fontSize: 11 }}>Effective {signedPlan.from}{signedPlan.to ? ` – ${signedPlan.to}` : ""}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8 }}>
          {["kcal", "protein", "carbs", "fat"].map((k) => (
            <div key={k} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: NT.sans, fontSize: 10, color: NT.muted, textTransform: "uppercase" }}><span style={{ width: 7, height: 7, borderRadius: 2, background: MACRO_COLORS[k] }} />{k}</span>
              <span style={{ fontFamily: NT.sans, fontSize: 15, fontWeight: 600, color: NT.text }}>{signedPlan.targets[k] || 0}{k !== "kcal" ? "g" : ""}</span>
            </div>
          ))}
        </div>
      </div>
      {signedPlan.meals.map((m) => (
        <div key={m.key} style={{ background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 18, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontFamily: NT.sans, fontWeight: 600, fontSize: 14, color: NT.text }}>{m.name} <span style={{ color: NT.dim, fontSize: 12, fontWeight: 400 }}>{m.time}</span></div>
            <div style={{ fontFamily: NT.sans, fontSize: 13, color: NT.muted }}>{Math.round(mealTotals(m).kcal)} kcal</div>
          </div>
          <div style={{ color: NT.muted, fontFamily: NT.sans, fontSize: 13 }}>{m.items.map(itemLine).join(" · ") || "No foods yet"}</div>
          {m.note && <div style={{ color: NT.dim, fontFamily: NT.sans, fontSize: 12, marginTop: 6, fontStyle: "italic" }}>{m.note}</div>}
        </div>
      ))}
    </div>
  );
}

// Unified replacement for food_log/macros/prescribed_plan (DECISIONS.md
// "Nutrition redesign"), restyled with the warm look (DECISIONS.md
// "Nutrition redesign v2") approved in the design canvas. The coach side
// keeps the app's standard look (CoachPlanBuilderV2/NutritionV2Progress
// get their own pass); this file is the client-facing shell.
export function NutritionV2Flow({ client, updateClient, isCoach }) {
  const [coachTab, setCoachTab] = useState("builder");
  const [tab, setTab] = useState("overview");
  const [dateISO, setDateISO] = useState(isoDate());
  const [logs, setLogs] = useState(() => normalizeLogs(client.nutritionV2Logs));
  const [marks, setMarks] = useState(() => normalizeMarks(client.nutritionV2Marks));
  const [foods, setFoods] = useState([]);
  // Plans are edited by the coach (CoachPlanBuilderV2), never here - just
  // re-synced whenever the client object itself changes (a refresh, or
  // the coach publishing while this client's app is open elsewhere).
  const plans = useMemo(() => normalizePlans(client.nutritionV2Plans), [client.nutritionV2Plans]);

  useEffect(() => {
    let cancelled = false;
    loadFoodLibrary(client.trainer_id).then((rows) => { if (!cancelled) setFoods(rows.map(normalizeFoodRow)); });
    return () => { cancelled = true; };
  }, [client.trainer_id]);

  const today = isoDate();
  const signedPlan = planForDate(plans, dateISO);
  const dateMarks = marksForDate(marks, dateISO);
  // Legacy macros -> the new flat log shape, merged at render time (see
  // nutritionV2Math.js's mergeLegacyMacroLog) rather than written back
  // proactively from an effect - the merged result only actually gets
  // persisted the moment the client writes something new for this date
  // (writeDay below always saves whatever dateEntries current held, so a
  // confirm/edit/sub/skip on a legacy-only date naturally carries the old
  // entries forward in the same write). A date never revisited just stays
  // untouched in its original macro_log row forever, which is fine - no
  // data is ever deleted.
  const dateEntries = useMemo(() => {
    const existing = logsForDate(logs, dateISO);
    if (existing.length || isCoach) return existing;
    const legacyDay = client.nutrition?.macro_log?.[dateISO];
    return legacyDay ? mergeLegacyMacroLog(legacyDay, dateISO) : existing;
  }, [logs, dateISO, isCoach, client.nutrition]);

  // Every date's entries, new-shape and legacy alike, merged read-only for
  // the "Your meals" suggestion engine (ClientFoodLogTab.jsx) - a client's
  // repeated quick-adds from before nutrition-v2 existed need to be found
  // too, not just today's. Never written back; same promote-on-first-
  // touch principle as dateEntries above, just across every date at once.
  const allEntriesForHistory = useMemo(() => {
    const merged = { ...logs };
    const macroLog = client.nutrition?.macro_log || {};
    Object.keys(macroLog).forEach((date) => {
      if (!merged[date]?.length) merged[date] = mergeLegacyMacroLog(macroLog[date], date);
    });
    return merged;
  }, [logs, client.nutrition]);

  async function writeDay(nextEntries, nextMarksForDate = dateMarks) {
    const nextLogs = { ...logs, [dateISO]: nextEntries };
    const nextMarks = { ...marks, [dateISO]: nextMarksForDate };
    setLogs(nextLogs);
    setMarks(nextMarks);
    updateClient({ ...client, nutritionV2Logs: nextLogs, nutritionV2Marks: nextMarks });
    await Promise.all([saveLogs(client.id, nextLogs), saveMarks(client.id, nextMarks)]);
  }

  if (isCoach) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Chip selected={coachTab === "builder"} onClick={() => setCoachTab("builder")}>Plan builder</Chip>
          <Chip selected={coachTab === "review"} onClick={() => setCoachTab("review")}>Weekly review</Chip>
        </div>
        {coachTab === "builder" ? <CoachPlanBuilderV2 client={client} updateClient={updateClient} /> : <NutritionV2Progress key={client.id} client={client} updateClient={updateClient} isCoach plans={plans} logs={logs} marks={marks} />}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => setDateISO(addDaysISO(dateISO, -1))} aria-label="Previous day" style={{ background: "none", border: "none", color: NT.dim, fontSize: 18, cursor: "pointer" }}>‹</button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: NT.sans, fontSize: 13, color: NT.muted }}>{fmtHeaderDate(dateISO)}{dateISO === today && <span style={{ color: NT.accent }}> · Today</span>}</div>
        <button onClick={() => setDateISO(addDaysISO(dateISO, 1))} aria-label="Next day" style={{ background: "none", border: "none", color: NT.dim, fontSize: 18, cursor: "pointer" }}>›</button>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[["overview", "Overview"], ["plan", "Meal plan"], ["log", "Food log"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={pillBtnStyle(tab === k)}>{l}</button>
        ))}
      </div>
      {tab === "overview" && <OverviewTab dateISO={dateISO} today={today} signedPlan={signedPlan} dateEntries={dateEntries} dateMarks={dateMarks} foods={foods} onWrite={writeDay} />}
      {tab === "plan" && <MealPlanTab signedPlan={signedPlan} />}
      {tab === "log" && <ClientFoodLogTab client={client} updateClient={updateClient} logs={allEntriesForHistory} dateEntries={dateEntries} foods={foods} editable={dateISO <= today} onWrite={writeDay} />}
    </div>
  );
}
