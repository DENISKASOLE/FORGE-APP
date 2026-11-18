import { useMemo, useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { isoDate, startOfWeek, addDays, DAYS } from "../../lib/dateUtils.js";
import { buildProgramDays } from "../../lib/programModel.js";
import { mealTotals, planForDate, mealOutcomeFor, dayOnPlanTally, mergeLegacyMacroLog, addDaysISO } from "./nutritionV2Math.js";
import { dayTypeFor } from "./fuelDayType.js";
import { FuelMealLog } from "./FuelMealLog.jsx";
import { FuelPlanView } from "./FuelPlanView.jsx";
import { FUEL, fuelLbl, MACRO_COLOR } from "./fuelTheme.js";
import { Chevron, PlusIcon, CheckIcon, ChartIcon } from "./fuelUi.jsx";

// Calorie gauge - thin 270° "speedo" arc (Nov 2026: Denis asked for a
// thin ring and slimmer cards). Track starts at 7:30 and sweeps clockwise
// to 4:30: rotate(135) = this codebase's 12-o'clock start (-90) + 225.
function CalorieGauge({ kcalEaten, kcalGoal }) {
  const r = 52, sw = 4;
  const C = 2 * Math.PI * r;
  const trackLen = C * 0.75;
  const pct = kcalGoal > 0 ? Math.max(0, Math.min(1, kcalEaten / kcalGoal)) : 0;
  const left = Math.max(Math.round(kcalGoal - kcalEaten), 0);
  const side = (v, l) => (
    <div style={{ textAlign: "center", flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: BRAND.display, fontSize: 19, fontWeight: 600 }}>{Math.round(v).toLocaleString()}</div>
      <div style={{ fontSize: 11, color: FUEL.dim }}>{l}</div>
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "6px 10px 0" }}>
      {side(kcalEaten, "eaten")}
      <svg width="124" height="112" viewBox="0 0 124 118" role="img" aria-label={`${left} calories left`} style={{ flexShrink: 0 }}>
        <circle cx="62" cy="62" r={r} fill="none" stroke={FUEL.lineSoft} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${trackLen.toFixed(1)} ${C.toFixed(1)}`} transform="rotate(135 62 62)" />
        <circle cx="62" cy="62" r={r} fill="none" stroke={FUEL.text} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${(trackLen * pct).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(135 62 62)" />
        <text x="62" y="62" textAnchor="middle" fill={FUEL.text} fontSize="24" fontWeight="600" fontFamily={BRAND.display}>{left.toLocaleString()}</text>
        <text x="62" y="80" textAnchor="middle" fill={FUEL.muted} fontSize="11" fontFamily={BRAND.sans}>kcal left</text>
      </svg>
      {side(kcalGoal, "goal")}
    </div>
  );
}

function MacroBars({ now, target }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14, padding: "10px 14px 12px", borderTop: `1px solid ${FUEL.line}` }}>
      {[["carbs", "Carbs"], ["fat", "Fat"], ["protein", "Protein"]].map(([key, label]) => {
        const t = Math.round(target[key] || 0);
        const n = Math.round(now[key] || 0);
        const pct = t > 0 ? Math.min(100, (n / t) * 100) : 0;
        return (
          <div key={key} style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: "nowrap" }}>{label} <span style={{ color: FUEL.dim }}>{n}/{t}g</span></div>
            <div style={{ height: 3, borderRadius: 9, background: FUEL.lineSoft, marginTop: 6, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", borderRadius: 9, background: MACRO_COLOR[key] }} /></div>
          </div>
        );
      })}
    </div>
  );
}

// Day ring: share of that day's meals on plan (planned or swapped). Future
// days are a dashed track; the strip always shows the week containing the
// selected date.
function DayRing({ pct, future, label }) {
  const r = 16, C = 2 * Math.PI * r;
  return (
    <div style={{ width: 38, height: 38, margin: "0 auto", position: "relative", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 600 }}>
      <svg width="38" height="38" viewBox="0 0 38 38" style={{ position: "absolute", inset: 0 }} aria-hidden="true">
        <circle cx="19" cy="19" r={r} fill="none" stroke={FUEL.lineSoft} strokeWidth="2.5" strokeDasharray={future ? "3 3.4" : undefined} />
        {pct > 0 && <circle cx="19" cy="19" r={r} fill="none" stroke={FUEL.protein} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(C * pct).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 19 19)" />}
      </svg>
      {label}
    </div>
  );
}
function WeekStrip({ plans, logs, marks, dateISO, todayISO, onSelect }) {
  const monday = startOfWeek(new Date(`${dateISO}T00:00:00`));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4, margin: "12px 0 10px" }}>
      {DAYS.map((name, i) => {
        const date = addDays(monday, i);
        const cellISO = isoDate(date);
        const sel = cellISO === dateISO;
        const future = cellISO > todayISO;
        const p = planForDate(plans, cellISO);
        const tally = p && !future ? dayOnPlanTally(p, cellISO, todayISO, logs?.[cellISO] || [], marks?.[cellISO] || {}) : null;
        const pct = tally && tally.total ? tally.onPlan / tally.total : 0;
        return (
          <button key={name} onClick={() => onSelect(cellISO)} aria-label={date.toDateString()} aria-pressed={sel} style={{ padding: "5px 0 6px", borderRadius: 16, background: sel ? FUEL.card : "transparent", border: `1px solid ${sel ? FUEL.lineSoft : "transparent"}`, color: FUEL.text, cursor: "pointer", fontFamily: "inherit" }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: sel ? FUEL.text : FUEL.dim, marginBottom: 4 }}>{name.slice(0, 3)}</div>
            <DayRing pct={pct} future={future} label={date.getDate()} />
          </button>
        );
      })}
    </div>
  );
}

// Logged entries grouped for display: a swap writes one entry per item
// all titled with the swap's name, so group by name and sum.
function loggedLayers(mealEntries) {
  const map = new Map();
  mealEntries.forEach((e) => {
    const key = e.name || "Logged";
    const cur = map.get(key) || { name: key, kcal: 0, count: 0, qty: e.qty, unit: e.unit };
    cur.kcal += e.macros?.kcal || 0;
    cur.count += 1;
    map.set(key, cur);
  });
  return [...map.values()];
}
function sumEntries(list) {
  return list.reduce((t, e) => ({ kcal: t.kcal + (e.macros?.kcal || 0), protein: t.protein + (e.macros?.protein || 0), carbs: t.carbs + (e.macros?.carbs || 0), fat: t.fat + (e.macros?.fat || 0) }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

function MealRow({ meal, outcome, isNext, mealEntries, onOpen }) {
  const logged = mealEntries.length > 0;
  const t = sumEntries(mealEntries);
  const planned = mealTotals(meal);
  return (
    <div style={{ background: FUEL.card, border: `1px solid ${isNext ? FUEL.lineSoft : FUEL.line}`, borderRadius: 18, padding: "10px 12px" }}>
      <button onClick={onOpen} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", padding: 0, color: FUEL.text, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 500 }}>{cap(meal.name)}</span>
            {outcome === "swapped" && <span style={pill(FUEL.proteinTrack, FUEL.protein)}>Swapped</span>}
            {outcome === "offplan" && logged && <span style={pill("var(--orange-bg)", FUEL.amber)}>Off-plan</span>}
            {isNext && !logged && <span style={pill(FUEL.text, FUEL.onText)}>Next</span>}
          </div>
          <div style={{ fontSize: 12, color: FUEL.muted, marginTop: 2 }}>
            {logged
              ? <>{Math.round(t.kcal)} kcal · <span style={{ color: MACRO_COLOR.carbs }}>{Math.round(t.carbs)}C</span> · <span style={{ color: MACRO_COLOR.fat }}>{Math.round(t.fat)}F</span> · <span style={{ color: MACRO_COLOR.protein }}>{Math.round(t.protein)}P</span></>
              : <>{meal.time} · {Math.round(planned.kcal)} kcal planned</>}
          </div>
        </div>
        {logged ? (
          <div aria-label="Logged" style={{ width: 32, height: 32, borderRadius: 99, background: FUEL.protein, display: "grid", placeItems: "center", flexShrink: 0 }}><CheckIcon color={FUEL.onColor} /></div>
        ) : (
          <div aria-label={`Log ${meal.name}`} style={{ width: 32, height: 32, borderRadius: 99, background: FUEL.card2, border: `1px solid ${FUEL.lineSoft}`, display: "grid", placeItems: "center", flexShrink: 0 }}><PlusIcon color={FUEL.text} /></div>
        )}
      </button>
      {logged && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {loggedLayers(mealEntries).map((l) => (
            <div key={l.name} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 10px", borderRadius: 10, background: "var(--card-soft)", border: `1px solid ${FUEL.line}`, fontSize: 12 }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}{l.count === 1 && l.qty != null ? <span style={{ color: FUEL.dim }}> · {l.qty}{l.unit === "piece" ? " pc" : ` ${l.unit}`}</span> : null}</span>
              <span style={{ color: FUEL.muted, flexShrink: 0 }}>{Math.round(l.kcal)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function pill(bg, fg) {
  return { fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", padding: "3px 7px", borderRadius: 99, fontWeight: 600, background: bg, color: fg };
}

// Client · Fuel (Nov 2026 redesign, approved mockup fuel-log-v2):
// Log/Plan toggle, week strip of on-plan rings, a slim summary card (thin
// calorie gauge + macro bars), then one slim row per meal with a + on the
// right. Tapping a meal opens FuelMealLog, where all logging happens;
// logged foods show as small layers under the meal here. Same data layer
// as before (planForDate, log entries, mealOutcomeFor) - new UI only.
// Viewing a date after today is read-only.
export function FuelToday({ client, plans, logs, marks, notes, onWrite, onOpenWeek }) {
  const todayISO = isoDate();
  const [dateISO, setDateISO] = useState(todayISO);
  const [view, setView] = useState("log");
  const [openMealKey, setOpenMealKey] = useState(null);
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
  const totals = sumEntries(entries);
  const target = plan?.targets || {};
  const workoutByDate = useMemo(() => {
    const map = new Map();
    buildProgramDays(client.program, client.trainingLogs).forEach((d) => map.set(d.dateISO, !!d.workout));
    return map;
  }, [client.program, client.trainingLogs]);
  const chip = dayTypeFor(plan, workoutByDate.get(dateISO));
  const tally = plan ? dayOnPlanTally(plan, dateISO, todayISO, entries, dateMarks) : { onPlan: 0, total: 0 };
  const firstOpenKey = orderedMeals.find((m) => mealOutcomeFor(dateISO, todayISO, m, entries, dateMarks) === "missed")?.key;
  const dayWord = dateISO === todayISO ? "Today" : dateISO === addDaysISO(todayISO, -1) ? "Yesterday" : dateISO === addDaysISO(todayISO, 1) ? "Tomorrow" : new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const openMeal = orderedMeals.find((m) => m.key === openMealKey);

  if (openMeal) {
    return (
      <FuelMealLog client={client} plan={plan} meal={openMeal} dateISO={dateISO} entries={entries} dateMarks={dateMarks} editable={editable}
        onWrite={(nextEntries, nextMarks) => onWrite(dateISO, nextEntries, nextMarks)} onBack={() => setOpenMealKey(null)} />
    );
  }

  const seg = (key, label) => (
    <button onClick={() => setView(key)} aria-pressed={view === key} style={{ padding: "7px 14px", borderRadius: 999, border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", background: view === key ? FUEL.text : "transparent", color: view === key ? FUEL.onText : FUEL.muted }}>{label}</button>
  );

  return (
    <div style={{ width: "100%", color: FUEL.text, fontFamily: BRAND.sans, display: "flex", flexDirection: "column", paddingBottom: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", paddingTop: 2 }}>
        <div style={{ display: "flex" }}><div style={{ display: "flex", background: FUEL.card2, border: `1px solid ${FUEL.line}`, borderRadius: 999, padding: 3 }}>{seg("log", "Log")}{seg("plan", "Plan")}</div></div>
        <div style={{ fontFamily: BRAND.display, fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em" }}>Fuel</div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onOpenWeek} aria-label="This week" style={{ width: 36, height: 36, borderRadius: 99, background: FUEL.card2, border: `1px solid ${FUEL.line}`, display: "grid", placeItems: "center", cursor: "pointer", color: FUEL.text }}><ChartIcon /></button>
        </div>
      </div>

      {view === "plan" ? (
        <FuelPlanView plans={plans} dateISO={dateISO} />
      ) : (
        <>
          <WeekStrip plans={plans} logs={logs} marks={marks} dateISO={dateISO} todayISO={todayISO} onSelect={setDateISO} />

          <div style={{ background: FUEL.card, border: `1px solid ${FUEL.line}`, borderRadius: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderBottom: `1px solid ${FUEL.line}` }}>
              <button onClick={() => setDateISO(addDaysISO(dateISO, -1))} aria-label="Previous day" style={navBtn}><Chevron dir="left" color={FUEL.dim} /></button>
              <button onClick={() => setDateISO(todayISO)} style={{ background: "none", border: "none", color: FUEL.text, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                {dayWord} · <span style={{ color: chip.training ? FUEL.amber : FUEL.muted }}>{chip.label}</span>
              </button>
              <button onClick={() => setDateISO(addDaysISO(dateISO, 1))} aria-label="Next day" style={navBtn}><Chevron dir="right" color={FUEL.dim} /></button>
            </div>
            <CalorieGauge kcalEaten={totals.kcal} kcalGoal={target.kcal || 0} />
            <MacroBars now={totals} target={target} />
          </div>

          {notes?.shared && (
            <div style={{ marginTop: 8, background: FUEL.card, border: `1px solid ${FUEL.line}`, borderRadius: 14, padding: "8px 12px", display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 24, height: 24, borderRadius: 99, background: FUEL.red, color: "#fff", fontSize: 11, display: "grid", placeItems: "center", flexShrink: 0, fontWeight: 600 }}>D</div>
              <div style={{ fontSize: 12, lineHeight: 1.4, color: FUEL.muted }}>{notes.shared}</div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "14px 2px 0" }}>
            <span style={fuelLbl}>{dateISO === todayISO ? "Today's meals" : "Meals"}</span>
            <span style={{ fontSize: 12, color: FUEL.dim }}>{tally.onPlan} of {orderedMeals.length} on plan</span>
          </div>

          {!plan ? (
            <div style={{ marginTop: 10, color: FUEL.muted, fontSize: 13 }}>No meals prescribed for this day.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {orderedMeals.map((meal) => (
                <MealRow key={meal.key} meal={meal} outcome={mealOutcomeFor(dateISO, todayISO, meal, entries, dateMarks)} isNext={meal.key === firstOpenKey && dateISO === todayISO}
                  mealEntries={entries.filter((e) => e.meal === meal.key)} onOpen={() => setOpenMealKey(meal.key)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
const navBtn = { width: 32, height: 32, borderRadius: 99, background: "none", border: "none", display: "grid", placeItems: "center", cursor: "pointer" };
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
