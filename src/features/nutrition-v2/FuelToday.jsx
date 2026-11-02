import { useMemo, useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { showToast } from "../../components/ui/Toast.jsx";
import { isoDate, startOfWeek, addDays, DAYS } from "../../lib/dateUtils.js";
import { uid } from "../../lib/uid.js";
import { buildProgramDays, currentProgramWeek } from "../../lib/programModel.js";
import { itemMacros, mealTotals, planForDate, mealOutcomeFor, dayOnPlanTally, last7DaysOnPlan, mergeLegacyMacroLog, addDaysISO } from "./nutritionV2Math.js";
import { dayTypeFor } from "./fuelDayType.js";
import { FuelSwap } from "./FuelSwap.jsx";
import { FUEL, fuelLbl } from "./fuelTheme.js";

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtHeaderDate(dateISO) {
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" });
}

function DayTypeChip({ label, training }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: FUEL.card2, border: `1px solid ${FUEL.line}`, borderRadius: 999, padding: "8px 12px", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: FUEL.text, fontWeight: 700, flexShrink: 0 }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: training ? FUEL.amber : FUEL.lineDashed }} />{label}
    </div>
  );
}

// 132x132 concentric rings, ported 1:1 from Main.dc.html's own SVG
// (outer=calories/white, inner=protein/green) rather than reused via
// NutritionRing.jsx's single-ring <Ring/> - stacking two of those
// wouldn't reproduce the exact concentric-with-centered-text geometry
// the approved design calls for.
function DoubleRing({ kcalNow, kcalTarget, proteinNow, proteinTarget }) {
  const CK = 2 * Math.PI * 60, CP = 2 * Math.PI * 44;
  const kf = kcalTarget > 0 ? Math.min(kcalNow / kcalTarget, 1) : 0;
  const pf = proteinTarget > 0 ? Math.min(proteinNow / proteinTarget, 1) : 0;
  const pLeft = Math.max(Math.round(proteinTarget - proteinNow), 0);
  return (
    <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label="Calories and protein progress">
      <circle cx="66" cy="66" r="60" fill="none" stroke="#1f1f1f" strokeWidth="10" />
      <circle cx="66" cy="66" r="60" fill="none" stroke={FUEL.text} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(CK * kf).toFixed(1)} ${CK.toFixed(1)}`} transform="rotate(-90 66 66)" />
      <circle cx="66" cy="66" r="44" fill="none" stroke={FUEL.proteinTrack} strokeWidth="10" />
      <circle cx="66" cy="66" r="44" fill="none" stroke={FUEL.protein} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(CP * pf).toFixed(1)} ${CP.toFixed(1)}`} transform="rotate(-90 66 66)" />
      <text x="66" y="63" textAnchor="middle" fill={FUEL.text} fontSize="22" fontWeight="800" fontFamily={BRAND.sans}>{pLeft}</text>
      <text x="66" y="80" textAnchor="middle" fill={FUEL.muted} fontSize="9" fontWeight="700" letterSpacing="1" fontFamily={BRAND.sans}>G PROTEIN LEFT</text>
    </svg>
  );
}

// The strip always shows the week CONTAINING the selected date, not a
// fixed calendar week - paging dateISO across a Sun/Mon boundary (via
// the date-nav chevrons or by tapping a day here) naturally slides the
// whole strip to the right week with no extra logic.
function WeekStrip({ plans, workoutByDate, dateISO, todayISO, onSelect }) {
  const monday = startOfWeek(new Date(`${dateISO}T00:00:00`));
  const days = DAYS.map((name, i) => {
    const date = addDays(monday, i);
    const cellISO = isoDate(date);
    const isSelected = cellISO === dateISO;
    const isToday = cellISO === todayISO;
    const { training } = dayTypeFor(planForDate(plans, cellISO), workoutByDate.get(cellISO));
    return { name, num: date.getDate(), cellISO, isSelected, isToday, training };
  });
  return (
    <div style={{ padding: "16px 20px 0", display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
      {days.map((d) => (
        <button key={d.name} onClick={() => onSelect(d.cellISO)} style={{ textAlign: "center", padding: "8px 0", borderRadius: 12, background: d.isSelected ? FUEL.text : FUEL.card, border: d.isSelected ? "none" : `1px solid ${d.isToday ? FUEL.lineSoft : FUEL.line}`, cursor: "pointer", fontFamily: "inherit" }}>
          <div style={{ fontSize: 10, letterSpacing: ".08em", color: d.isSelected ? "#000" : FUEL.muted, fontWeight: 700 }}>{d.name.toUpperCase()}</div>
          <div style={{ fontSize: 15, marginTop: 3, color: d.isSelected ? "#000" : FUEL.text, fontWeight: 700 }}>{d.num}</div>
          <div style={{ width: 5, height: 5, borderRadius: 99, margin: "5px auto 0", background: d.isSelected ? "#000" : (d.training ? FUEL.amber : FUEL.lineDashed) }} />
        </button>
      ))}
    </div>
  );
}
function DateNavRow({ dateISO, todayISO, onChange }) {
  return (
    <div style={{ margin: "14px 20px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
      <button onClick={() => onChange(addDaysISO(dateISO, -1))} aria-label="Previous day" style={{ width: 36, height: 36, borderRadius: 99, background: FUEL.card2, border: `1px solid ${FUEL.line}`, color: FUEL.text, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>{"‹"}</button>
      <div style={{ textAlign: "center", minWidth: 120 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{fmtHeaderDate(dateISO)}</div>
        {dateISO !== todayISO && <button onClick={() => onChange(todayISO)} style={{ marginTop: 2, background: "none", border: "none", color: FUEL.amber, fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", cursor: "pointer", padding: 0 }}>Jump to today</button>}
      </div>
      <button onClick={() => onChange(addDaysISO(dateISO, 1))} aria-label="Next day" style={{ width: 36, height: 36, borderRadius: 99, background: FUEL.card2, border: `1px solid ${FUEL.line}`, color: FUEL.text, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>{"›"}</button>
    </div>
  );
}

function doneNoteFor(meal, entries) {
  const mealEntries = entries.filter((e) => e.meal === meal.key);
  const confirm = mealEntries.find((e) => e.source === "confirm");
  if (confirm) return `Ate as planned · ${confirm.time || ""}`;
  const sub = mealEntries.find((e) => e.source === "sub");
  if (sub) return `Swapped for ${sub.name} · ${sub.time || ""}`;
  const other = mealEntries[0];
  return other ? `${other.name || "Logged"} · ${other.time || ""}` : "Logged";
}

function MealCard({ meal, totals, outcome, isNext, entries, editable, onAte, onUndo, onSwap }) {
  const done = outcome !== "missed" && outcome !== "future";
  return (
    <div style={{ background: FUEL.card, borderRadius: 20, padding: 16, border: `1px solid ${isNext ? FUEL.text : FUEL.line}`, opacity: done ? 0.8 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {done ? (
            <div style={{ width: 26, height: 26, borderRadius: 99, background: FUEL.protein, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          ) : (
            <div style={{ width: 26, height: 26, borderRadius: 99, border: "2px solid #3a3a3a", flexShrink: 0 }} />
          )}
          <div>
            <div style={{ fontSize: 15, textTransform: "uppercase", letterSpacing: ".06em", color: FUEL.text, fontWeight: 700 }}>{meal.name}</div>
            <div style={{ fontSize: 12, color: FUEL.muted, marginTop: 2, fontWeight: 700 }}>{meal.time} · {Math.round(totals.kcal)} kcal · <span style={{ color: FUEL.protein }}>{Math.round(totals.protein)} g protein</span></div>
          </div>
        </div>
        {isNext && !done && <div style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", background: FUEL.text, color: "#000", borderRadius: 99, padding: "5px 9px", fontWeight: 700, flexShrink: 0 }}>Next</div>}
      </div>

      {!done ? (
        <>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {meal.items.map((it) => (
              <div key={it.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14, color: "#e5e5e5", padding: "8px 0", borderTop: "1px solid #1f1f1f", fontWeight: 700 }}>
                <span>{it.name}</span><span style={{ color: FUEL.muted, whiteSpace: "nowrap" }}>{it.qty}{it.unit === "piece" ? "" : it.unit}</span>
              </div>
            ))}
            {meal.note && <div style={{ fontSize: 12, color: FUEL.amber, lineHeight: 1.4, fontWeight: 700 }}>{meal.note}</div>}
          </div>
          {editable && (
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
              <button onClick={onAte} style={{ gridColumn: "span 2", height: 48, borderRadius: 14, border: "none", background: FUEL.text, color: "#000", fontSize: 13, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer" }}>Ate it</button>
              <button onClick={onSwap} style={{ height: 48, borderRadius: 14, border: `1px solid ${FUEL.lineSoft}`, background: FUEL.card2, color: FUEL.text, fontSize: 13, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer" }}>Swap</button>
            </div>
          )}
        </>
      ) : (
        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: FUEL.muted, fontWeight: 700 }}>
          <span>{doneNoteFor(meal, entries)}</span>
          {editable && <button onClick={onUndo} style={{ background: "none", border: "none", color: FUEL.muted, fontSize: 12, textDecoration: "underline", padding: "10px 0", cursor: "pointer", fontWeight: 700 }}>Undo</button>}
        </div>
      )}
    </div>
  );
}

// Client · Fuel › Today (docs/design/fuel-tab/Main.dc.html, DECISIONS.md
// "Fuel tab redesign"). Reuses nutrition-v2's existing data layer end to
// end (planForDate, log entries, mealOutcomeFor) - this is a new UI on
// the same model, not a new one.
//
// Real date navigation (chevrons, tap a day in the strip, "Jump to
// today"): `dateISO` is owned here, not in the caller, since it only
// ever needs `plans`/`logs`/`marks` (the client's full, every-date
// stores) to resolve whichever date is selected - including the legacy
// macro_log merge-on-first-touch (see `entries` below), previously done
// by the caller for "today" only. Viewing a date after today is
// read-only (`editable` below) - nothing can be logged ahead of when it
// happens, same rule the pre-redesign screen enforced. "This week" and
// the 7-day strip's training dots always use the REAL today
// (`todayISO`), never the browsed `dateISO` - browsing history doesn't
// change what "this week" means. The Change-a-meal sheet (FuelSwap) is
// owned right here too, since every prop it needs (plan/entries/onWrite)
// already lives in this component.
export function FuelToday({ client, plans, logs, marks, notes, onWrite, onOpenWeek }) {
  const todayISO = isoDate();
  const [dateISO, setDateISO] = useState(todayISO);
  const editable = dateISO <= todayISO;
  const plan = planForDate(plans, dateISO);
  const dateMarks = marks?.[dateISO] || {};
  const entries = useMemo(() => {
    const existing = logs?.[dateISO] || [];
    if (existing.length) return existing;
    const legacyDay = client.nutrition?.macro_log?.[dateISO];
    return legacyDay ? mergeLegacyMacroLog(legacyDay, dateISO) : existing;
  }, [logs, dateISO, client.nutrition]);
  const orderedMeals = plan?.meals ? [...plan.meals].sort((a, b) => a.time.localeCompare(b.time)) : [];
  const [swapMeal, setSwapMeal] = useState(null);
  const totals = entries.reduce((t, e) => ({ kcal: t.kcal + (e.macros?.kcal || 0), protein: t.protein + (e.macros?.protein || 0) }), { kcal: 0, protein: 0 });
  const target = plan?.targets || {};

  const workoutByDate = useMemo(() => {
    const map = new Map();
    buildProgramDays(client.program, client.trainingLogs).forEach((d) => map.set(d.dateISO, !!d.workout));
    return map;
  }, [client.program, client.trainingLogs]);
  const chip = dayTypeFor(plan, workoutByDate.get(dateISO));
  const tally = plan ? dayOnPlanTally(plan, dateISO, todayISO, entries, dateMarks) : { onPlan: 0, total: 0 };
  const weekInfo = last7DaysOnPlan(plans, logs, marks, todayISO);
  const firstOpenKey = orderedMeals.find((m) => mealOutcomeFor(dateISO, todayISO, m, entries, dateMarks) === "missed")?.key;
  const planLabel = dateISO === todayISO ? "Today's plan" : `${new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { weekday: "long" })}'s plan`;

  async function ateMeal(meal) {
    const kept = entries.filter((e) => e.meal !== meal.key);
    const time = nowHHMM();
    const added = meal.items.map((it) => ({
      id: uid(), date: dateISO, meal: meal.key, name: it.name, foodId: it.foodId, qty: it.qty, unit: it.unit,
      macros: itemMacros(it), source: "confirm", time, planItemId: it.id, estimate: false, replaces: null, reason: null,
    }));
    await onWrite(dateISO, [...kept, ...added], dateMarks);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
    showToast(`${meal.name} logged as planned.`, "success");
  }
  async function undoMeal(meal) {
    const kept = entries.filter((e) => e.meal !== meal.key);
    const nextMarks = { ...dateMarks };
    delete nextMarks[meal.key];
    await onWrite(dateISO, kept, nextMarks);
  }

  return (
    <div style={{ width: "100%", background: FUEL.bg, color: FUEL.text, fontFamily: BRAND.sans, display: "flex", flexDirection: "column", margin: "0 -16px", padding: "0 0 24px" }}>
      <div style={{ padding: "6px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={fuelLbl}>{new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { weekday: "long" })}{client.program ? ` · Week ${currentProgramWeek(client.program)}` : ""}</div>
          <div style={{ fontSize: 30, letterSpacing: ".04em", textTransform: "uppercase", marginTop: 4, fontWeight: 700 }}>Fuel</div>
        </div>
        <DayTypeChip label={chip.label} training={chip.training} />
      </div>

      <WeekStrip plans={plans} workoutByDate={workoutByDate} dateISO={dateISO} todayISO={todayISO} onSelect={setDateISO} />
      <DateNavRow dateISO={dateISO} todayISO={todayISO} onChange={setDateISO} />

      <div style={{ margin: "18px 20px 0", background: FUEL.card, border: `1px solid ${FUEL.line}`, borderRadius: 22, padding: 18, display: "flex", gap: 18, alignItems: "center" }}>
        <DoubleRing kcalNow={totals.kcal} kcalTarget={target.kcal || 0} proteinNow={totals.protein} proteinTarget={target.protein || 0} />
        <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, ...fuelLbl }}><span style={{ width: 8, height: 8, borderRadius: 2, background: FUEL.protein }} />Protein</div>
            <div style={{ fontSize: 22, marginTop: 3, fontWeight: 700 }}>{Math.round(totals.protein)}<span style={{ color: FUEL.muted, fontSize: 14 }}> / {Math.round(target.protein || 0)} g</span></div>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, ...fuelLbl }}><span style={{ width: 8, height: 8, borderRadius: 2, background: FUEL.text }} />Calories</div>
            <div style={{ fontSize: 22, marginTop: 3, fontWeight: 700 }}>{Math.round(totals.kcal).toLocaleString()}<span style={{ color: FUEL.muted, fontSize: 14 }}> / {Math.round(target.kcal || 0).toLocaleString()}</span></div>
          </div>
          <div style={{ fontSize: 12, color: FUEL.muted, fontWeight: 700 }}>{tally.onPlan} of {orderedMeals.length || 4} meals on plan</div>
        </div>
      </div>

      {notes?.shared && (
        <div style={{ margin: "12px 20px 0", background: FUEL.card, border: `1px solid ${FUEL.line}`, borderRadius: 16, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ width: 28, height: 28, borderRadius: 99, background: FUEL.red, color: "#fff", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 700 }}>D</div>
          <div style={{ fontSize: 13, lineHeight: 1.45, color: "#d4d4d4", fontWeight: 700 }}>{notes.shared}</div>
        </div>
      )}

      <div style={{ padding: "22px 20px 8px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={fuelLbl}>{planLabel}</div>
        <div style={{ fontSize: 12, color: FUEL.muted, fontWeight: 700 }}>Signed by Coach Denis</div>
      </div>

      {!plan ? (
        <div style={{ margin: "0 20px", color: FUEL.muted, fontSize: 13, fontWeight: 700 }}>No meals prescribed for this day.</div>
      ) : (
        <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {orderedMeals.map((meal) => {
            const outcome = mealOutcomeFor(dateISO, todayISO, meal, entries, dateMarks);
            return (
              <MealCard
                key={meal.key}
                meal={meal}
                totals={mealTotals(meal)}
                outcome={outcome}
                isNext={meal.key === firstOpenKey}
                entries={entries}
                editable={editable}
                onAte={() => ateMeal(meal)}
                onUndo={() => undoMeal(meal)}
                onSwap={() => setSwapMeal(meal)}
              />
            );
          })}
        </div>
      )}

      {editable && (
        <button onClick={() => { const target = orderedMeals.find((m) => m.key === firstOpenKey) || orderedMeals[orderedMeals.length - 1]; if (target) setSwapMeal(target); else showToast("No meals prescribed for this day.", "info"); }} style={{ margin: "16px 20px 0", height: 54, borderRadius: 16, border: "1px dashed #3a3a3a", color: FUEL.text, background: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 13, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", fontWeight: 700 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke={FUEL.text} strokeWidth="2.4" strokeLinecap="round" /></svg>
          Ate something off-plan
        </button>
      )}

      <button onClick={() => (onOpenWeek ? onOpenWeek() : showToast("My week is coming in a later step.", "info"))} style={{ margin: "12px 20px 0", padding: "14px 16px", borderRadius: 16, background: FUEL.card, border: `1px solid ${FUEL.line}`, color: FUEL.text, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", textAlign: "left" }}>
        <div>
          <div style={fuelLbl}>This week</div>
          <div style={{ fontSize: 15, marginTop: 4, fontWeight: 700 }}>{weekInfo.streak}-day streak · {weekInfo.onPlanPct != null ? Math.round(weekInfo.onPlanPct * 100) : "—"}% on plan</div>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke={FUEL.muted} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      {swapMeal && (
        <FuelSwap
          client={client}
          plan={plan}
          meal={swapMeal}
          todayISO={dateISO}
          entries={entries}
          todayMarks={dateMarks}
          onWrite={(nextEntries, nextMarks) => onWrite(dateISO, nextEntries, nextMarks)}
          onClose={() => setSwapMeal(null)}
        />
      )}
    </div>
  );
}
