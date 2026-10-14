import { useEffect, useMemo, useState } from "react";
import { T } from "../../theme/tokens.js";
import { Card } from "../../components/ui/Card.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Chip } from "../../components/ui/Chip.jsx";
import { inputStyle } from "../../components/ui/Field.jsx";
import { SectionLabel } from "../../components/ui/SectionLabel.jsx";
import { modalBackdrop } from "../../components/ui/modal.js";
import { showToast } from "../../components/ui/Toast.jsx";
import { isoDate } from "../../lib/dateUtils.js";
import { uid } from "../../lib/uid.js";
import { loadFoodLibrary } from "../../lib/nutritionPlan.js";
import { normalizePlans, normalizeLogs, normalizeMarks, logsForDate, marksForDate, saveLogs, saveMarks } from "../../lib/nutritionV2.js";
import { foodRefFromRow, normalizeFoodRow, unitGramsFor } from "./nutritionV2Model.js";
import { itemMacros, mealTotals, planForDate, mealStatus, unplannedEntries, loggedDayTotals, mergeLegacyMacroLog, addDaysISO } from "./nutritionV2Math.js";
import { CoachPlanBuilderV2 } from "./CoachPlanBuilderV2.jsx";

const MAC_COLOR = { kcal: T.gold, protein: T.good, carbs: T.blue, fat: T.violet };
const PORTION_CHIPS = [["None", 0], ["Half", 0.5], ["Three quarters", 0.75], ["All", 1]];

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtHeaderDate(dateISO) {
  const d = new Date(`${dateISO}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}
function itemLine(it) { return `${it.name} ${it.qty}${it.unit === "piece" ? "" : it.unit}`; }

function Ring({ value, target, color, unitLabel }) {
  const pct = target ? Math.min(1, value / target) : 0;
  const C = 2 * Math.PI * 26;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ position: "relative", width: 60, height: 60 }}>
        <svg width="60" height="60" viewBox="0 0 60 60" aria-hidden="true">
          <circle cx="30" cy="30" r="24" fill="none" stroke={T.card2} strokeWidth="6" />
          <circle cx="30" cy="30" r="24" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${pct * C} ${C}`} transform="rotate(-90 30 30)" />
        </svg>
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.sans, fontSize: 12, fontWeight: 600, color: T.text }}>{Math.round(value)}</span>
      </div>
      <span style={{ fontFamily: T.sans, fontSize: 10, color: T.muted }}>/ {Math.round(target || 0)} {unitLabel}</span>
    </div>
  );
}

function PortionSheet({ meal, onClose, onApply }) {
  const [pct, setPct] = useState(1);
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 420 }}>
        <SectionLabel color={T.muted} style={{ marginBottom: 10 }}>How much of {meal.name} did you eat?</SectionLabel>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {PORTION_CHIPS.map(([label, v]) => <Chip key={v} selected={pct === v} onClick={() => setPct(v)}>{label}</Chip>)}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={() => onApply(pct)} style={{ flex: 1 }}>Apply</Button>
        </div>
      </Card>
    </div>
  );
}

function SubstituteSheet({ meal, foods, onClose, onApply }) {
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState(null);
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => (q ? foods.filter((f) => !f.archived && f.name.toLowerCase().includes(q)).slice(0, 8) : []), [foods, q]);
  const reasons = ["Schedule", "Eating out", "Preference", "Not available", "Not hungry"];
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 440 }}>
        <SectionLabel color={T.muted} style={{ marginBottom: 4 }}>Log a substitution for {meal.name}</SectionLabel>
        <div style={{ color: T.dim, fontSize: 12, marginBottom: 12 }}>The prescription stays as-is — your coach sees both.</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {reasons.map((r) => <Chip key={r} selected={reason === r} onClick={() => setReason(reason === r ? null : r)}>{r}</Chip>)}
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What did you have instead?" style={inputStyle({ marginBottom: 8 })} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflow: "auto" }}>
          {matches.map((f) => (
            <button key={f.id} onClick={() => onApply(f, f.unit === "piece" ? 1 : 100, f.unit === "piece" ? "piece" : f.unit, reason)} style={{ display: "flex", justifyContent: "space-between", textAlign: "left", background: T.card2, border: "none", borderRadius: 10, padding: "10px 12px", color: T.text, fontFamily: T.sans, fontSize: 13, cursor: "pointer" }}>
              <span>{f.name}</span><span style={{ color: T.dim, fontSize: 11 }}>{f.kcal} kcal/100{f.unit === "ml" ? "ml" : "g"}</span>
            </button>
          ))}
        </div>
        <Button variant="ghost" onClick={onClose} style={{ marginTop: 14, width: "100%" }}>Cancel</Button>
      </Card>
    </div>
  );
}

function ClientMealCard({ meal, status, dateEntries, editable, onConfirm, onOpenEdit, onOpenSub, onSkip, onUnskip }) {
  const totals = mealTotals(meal);
  const confirmedEntries = dateEntries.filter((e) => e.source === "confirm" && e.meal === meal.key);
  const subEntries = dateEntries.filter((e) => e.source === "sub" && e.replaces === meal.key);
  const meta = {
    eaten: ["As planned", T.good], partial: ["Partly eaten", T.warn], substituted: ["Substituted", T.violet],
    skipped: ["Skipped", T.dim], open: ["Not logged yet", T.dim], future: ["Upcoming", T.dim],
  }[status];
  return (
    <Card style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, opacity: status === "skipped" ? 0.6 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div>
          <div style={{ fontFamily: T.sans, fontWeight: 600, fontSize: 15, color: T.text }}>{meal.name} <span style={{ color: T.dim, fontSize: 12, fontWeight: 400 }}>{meal.time}</span></div>
          <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>{meal.items.map(itemLine).join(", ") || "No foods prescribed"}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: T.sans, fontSize: 13, color: T.text }}>{Math.round(totals.kcal)} kcal</div>
          <div style={{ fontSize: 11, color: meta[1] }}>{meta[0]}</div>
        </div>
      </div>
      {status === "substituted" && subEntries.length > 0 && (
        <div style={{ background: T.card2, borderRadius: 10, padding: 10, fontSize: 12, color: T.text }}>
          Actually eaten: {subEntries.map((e) => `${e.name} ${e.qty}${e.unit === "piece" ? "" : e.unit}${e.reason ? ` · ${e.reason}` : ""}`).join(", ")}
        </div>
      )}
      {(status === "eaten" || status === "partial") && confirmedEntries.length > 0 && (
        <div style={{ color: T.dim, fontSize: 11 }}>Logged at {confirmedEntries[0].time}</div>
      )}
      {editable && (status === "open" || status === "eaten" || status === "partial") && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 }}>
          <Button onClick={onConfirm} style={{ fontSize: 12 }}>Ate as planned</Button>
          <Button variant="dark" onClick={onOpenEdit} style={{ fontSize: 12 }}>Edit portion</Button>
          <Button variant="dark" onClick={onOpenSub} style={{ fontSize: 12 }}>Substitute</Button>
        </div>
      )}
      {editable && status === "open" && <Button variant="ghost" onClick={onSkip} style={{ fontSize: 12, justifySelf: "start" }}>Skip meal</Button>}
      {editable && status === "skipped" && <Button variant="ghost" onClick={onUnskip} style={{ fontSize: 12, justifySelf: "start" }}>Undo skip</Button>}
    </Card>
  );
}

function OverviewTab({ dateISO, today, signedPlan, dateEntries, dateMarks, foods, onWrite }) {
  const [editingMeal, setEditingMeal] = useState(null); // {mode:'portion'|'sub', meal}
  const totals = loggedDayTotals(dateEntries);
  const unplanned = unplannedEntries(dateEntries);

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
  async function applySub(meal, foodRow, qty, unit, reason) {
    const food = foodRefFromRow(foodRow);
    const factor = (Number(qty) * unitGramsFor(food, unit)) / (food.basisGrams || 100);
    const macros = { kcal: food.macros.kcal * factor, protein: food.macros.protein * factor, carbs: food.macros.carbs * factor, fat: food.macros.fat * factor };
    const kept = dateEntries.filter((e) => !(e.source === "confirm" && e.meal === meal.key));
    const entry = { id: uid(), date: dateISO, meal: meal.key, name: food.name, foodId: food.foodId, qty, unit, macros, source: "sub", time: nowHHMM(), planItemId: null, estimate: false, replaces: meal.key, reason };
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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card style={{ padding: 14, display: "flex", justifyContent: "space-around" }}>
        <Ring value={totals.kcal} target={signedPlan?.targets.kcal} color={MAC_COLOR.kcal} unitLabel="KCAL" />
        <Ring value={totals.protein} target={signedPlan?.targets.protein} color={MAC_COLOR.protein} unitLabel="G P" />
        <Ring value={totals.carbs} target={signedPlan?.targets.carbs} color={MAC_COLOR.carbs} unitLabel="G C" />
        <Ring value={totals.fat} target={signedPlan?.targets.fat} color={MAC_COLOR.fat} unitLabel="G F" />
      </Card>

      {!signedPlan ? (
        <Card style={{ padding: 16, color: T.muted, fontSize: 13 }}>No meals prescribed for this date. You can still log what you eat below.</Card>
      ) : (
        signedPlan.meals.map((meal) => (
          <ClientMealCard
            key={meal.key} meal={meal} status={mealStatus(dateISO, today, meal, dateEntries, dateMarks)} dateEntries={dateEntries}
            editable={dateISO <= today}
            onConfirm={() => confirmMeal(meal)}
            onOpenEdit={() => setEditingMeal({ mode: "portion", meal })}
            onOpenSub={() => setEditingMeal({ mode: "sub", meal })}
            onSkip={() => skipMeal(meal)}
            onUnskip={() => unskipMeal(meal)}
          />
        ))
      )}

      {unplanned.length > 0 && (
        <Card style={{ padding: 14 }}>
          <SectionLabel color={T.muted} style={{ marginBottom: 8 }}>Also logged</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {unplanned.map((e) => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.text }}>
                <span>{e.name} <span style={{ color: T.dim, fontSize: 11 }}>· {e.time}</span></span><span>{Math.round(e.macros.kcal)} kcal</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {editingMeal?.mode === "portion" && <PortionSheet meal={editingMeal.meal} onClose={() => setEditingMeal(null)} onApply={(pct) => applyPortion(editingMeal.meal, pct)} />}
      {editingMeal?.mode === "sub" && <SubstituteSheet meal={editingMeal.meal} foods={foods} onClose={() => setEditingMeal(null)} onApply={(f, q, u, r) => applySub(editingMeal.meal, f, q, u, r)} />}
    </div>
  );
}

function MealPlanTab({ signedPlan }) {
  if (!signedPlan) return <Card style={{ padding: 16, color: T.muted, fontSize: 13 }}>No meals prescribed for this date.</Card>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card style={{ padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <div style={{ fontFamily: T.sans, fontWeight: 600, fontSize: 15, color: T.text }}>Plan v{signedPlan.version}</div>
          <div style={{ color: T.dim, fontSize: 11 }}>Effective {signedPlan.from}{signedPlan.to ? ` – ${signedPlan.to}` : ""}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8 }}>
          {["kcal", "protein", "carbs", "fat"].map((k) => (
            <div key={k} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.muted, textTransform: "uppercase" }}><span style={{ width: 7, height: 7, borderRadius: 2, background: MAC_COLOR[k] }} />{k}</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{signedPlan.targets[k] || 0}{k !== "kcal" ? "g" : ""}</span>
            </div>
          ))}
        </div>
      </Card>
      {signedPlan.meals.map((m) => (
        <Card key={m.key} style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontFamily: T.sans, fontWeight: 600, fontSize: 14, color: T.text }}>{m.name} <span style={{ color: T.dim, fontSize: 12, fontWeight: 400 }}>{m.time}</span></div>
            <div style={{ fontSize: 13, color: T.muted }}>{Math.round(mealTotals(m).kcal)} kcal</div>
          </div>
          <div style={{ color: T.muted, fontSize: 13 }}>{m.items.map(itemLine).join(" · ") || "No foods yet"}</div>
          {m.note && <div style={{ color: T.dim, fontSize: 12, marginTop: 6, fontStyle: "italic" }}>{m.note}</div>}
        </Card>
      ))}
    </div>
  );
}

// Unified replacement for food_log/macros/prescribed_plan (DECISIONS.md
// "Nutrition redesign"), built against the interactive prototype read
// from Forge Nutrition.dc.html. Not wired into live routing yet - see
// mellow-wandering-grove.md's plan; every client still gets the OLD
// NutritionFlow.jsx until this is feature-complete (Progress tab +
// Food log still to come).
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

  async function writeDay(nextEntries, nextMarksForDate) {
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
        {coachTab === "builder" ? <CoachPlanBuilderV2 client={client} updateClient={updateClient} /> : <Card style={{ padding: 16, color: T.muted }}>Weekly review is coming in the next phase.</Card>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => setDateISO(addDaysISO(dateISO, -1))} aria-label="Previous day" style={{ background: "none", border: "none", color: T.dim, fontSize: 18, cursor: "pointer" }}>‹</button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: T.sans, fontSize: 13, color: T.muted }}>{fmtHeaderDate(dateISO)}{dateISO === today && <span style={{ color: T.gold }}> · Today</span>}</div>
        <button onClick={() => setDateISO(addDaysISO(dateISO, 1))} aria-label="Next day" style={{ background: "none", border: "none", color: T.dim, fontSize: 18, cursor: "pointer" }}>›</button>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
        {[["overview", "Overview"], ["plan", "Meal plan"], ["log", "Food log"], ["progress", "Progress"]].map(([k, l]) => (
          <Chip key={k} selected={tab === k} onClick={() => setTab(k)}>{l}</Chip>
        ))}
      </div>
      {tab === "overview" && <OverviewTab dateISO={dateISO} today={today} signedPlan={signedPlan} dateEntries={dateEntries} dateMarks={dateMarks} foods={foods} onWrite={writeDay} />}
      {tab === "plan" && <MealPlanTab signedPlan={signedPlan} />}
      {tab === "log" && <Card style={{ padding: 16, color: T.muted }}>Food log is coming in the next phase.</Card>}
      {tab === "progress" && <Card style={{ padding: 16, color: T.muted }}>Progress is coming in the next phase.</Card>}
    </div>
  );
}
