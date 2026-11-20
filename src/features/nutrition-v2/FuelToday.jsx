import { useMemo, useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { isoDate, startOfWeek, addDays, DAYS } from "../../lib/dateUtils.js";
import { mealTotals, planForDate, planVersionForDate, mealOutcomeFor, dayOnPlanTally, mergeLegacyMacroLog } from "./nutritionV2Math.js";
import { MEAL_KEYS, newPlanMeal } from "./nutritionV2Model.js";
import { FuelMealLog } from "./FuelMealLog.jsx";
import { FuelPlanView } from "./FuelPlanView.jsx";
import { FUEL, MACRO_COLOR } from "./fuelTheme.js";
import { PlusIcon, CheckIcon } from "./fuelUi.jsx";
import { PageHeader, PillSwitch, DayStrip } from "../../components/ui/Screen.jsx";
import { screenCard, screenLabel, tint } from "../../components/ui/screenStyles.js";

// Calories card (Nov 2026 restyle): a full ring like Home's, "kcal left"
// with a plan, "kcal today" without one.
function CaloriesCard({ kcalEaten, kcalGoal }) {
  const free = !(kcalGoal > 0);
  const pct = free ? 0 : Math.max(0, Math.min(1, kcalEaten / kcalGoal));
  const left = Math.max(Math.round(kcalGoal - kcalEaten), 0);
  const size = 118, sw = 9, r = (size - sw) / 2, C = 2 * Math.PI * r;
  return (
    <div style={{ ...screenCard, padding: 14, textAlign: "center" }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>Calories</div>
      <div style={{ position: "relative", width: size, height: size, margin: "8px auto 0" }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-strong)" strokeWidth={sw} />
          {pct > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${C * pct} ${C}`} />}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{(free ? Math.round(kcalEaten) : left).toLocaleString()}</div>
          <div style={{ fontSize: 12, color: FUEL.dim }}>{free ? "kcal today" : "kcal left"}</div>
        </div>
      </div>
      <div style={{ fontSize: 13, marginTop: 8, color: FUEL.dim }}>{free ? "No target yet" : <><b style={{ color: FUEL.text }}>{Math.round(kcalEaten).toLocaleString()}</b> of {Math.round(kcalGoal).toLocaleString()} kcal</>}</div>
    </div>
  );
}
function MacrosCard({ now, target }) {
  return (
    <div style={{ ...screenCard, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 8 }}>
      {[["protein", "Protein"], ["carbs", "Carbs"], ["fat", "Fat"]].map(([key, label]) => {
        const t = Math.round(target[key] || 0);
        const n = Math.round(now[key] || 0);
        const pct = t > 0 ? Math.min(100, (n / t) * 100) : 0;
        return (
          <div key={key} style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{label}</div>
            <div style={{ height: 6, borderRadius: 9, background: "var(--line-strong)", margin: "6px 0 4px", overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", borderRadius: 9, background: MACRO_COLOR[key] }} /></div>
            <div style={{ fontSize: 14, fontVariantNumeric: "tabular-nums" }}><b style={{ color: MACRO_COLOR[key] }}>{n}</b><span style={{ color: FUEL.dim }}>{t > 0 ? ` / ${t} g` : " g"}</span></div>
          </div>
        );
      })}
    </div>
  );
}

// Days for the shared Home-style strip. Dot: green = every meal on plan,
// orange = something logged but not all on plan; no plan = teal if
// anything was logged.
function fuelStripDays(plans, logs, marks, dateISO, todayISO) {
  const monday = startOfWeek(new Date(`${dateISO}T00:00:00`));
  return DAYS.map((name, i) => {
    const date = addDays(monday, i);
    const iso = isoDate(date);
    const future = iso > todayISO;
    const p = planForDate(plans, iso);
    const entries = logs?.[iso] || [];
    let dot = null;
    if (!future) {
      if (p) {
        const t = dayOnPlanTally(p, iso, todayISO, entries, marks?.[iso] || {});
        if (t.total && t.onPlan === t.total) dot = "var(--green)";
        else if (entries.length || t.onPlan) dot = "var(--orange)";
      } else if (entries.length) dot = "var(--accent)";
    }
    return { iso, name: name.slice(0, 3), num: date.getDate(), dot, label: date.toDateString() };
  });
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

function MealRow({ meal, outcome, isNext, mealEntries, onOpen, free = false }) {
  // The tick means the meal itself is logged; extras added from the +
  // quick log show as layers but don't tick the meal.
  const logged = free ? mealEntries.length > 0 : mealEntries.some((e) => !e.extra);
  const hasLayers = mealEntries.length > 0;
  const t = sumEntries(mealEntries);
  const planned = mealTotals(meal);
  return (
    <div style={{ ...screenCard, padding: 14 }}>
      <button onClick={onOpen} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", padding: 0, color: FUEL.text, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>{cap(meal.name)}</span>
            {outcome === "swapped" && <span style={pill(FUEL.proteinTrack, FUEL.protein)}>Swapped</span>}
            {!free && outcome === "offplan" && logged && <span style={pill("var(--orange-bg)", FUEL.amber)}>Off-plan</span>}
            {!free && isNext && !logged && <span style={pill(tint(), "var(--accent)")}>Next</span>}
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: FUEL.muted, marginTop: 2 }}>
            {hasLayers
              ? <><span style={{ color: FUEL.text, fontWeight: 600 }}>{Math.round(t.kcal)} kcal</span> · <span style={{ color: MACRO_COLOR.carbs }}>{Math.round(t.carbs)}C</span> · <span style={{ color: MACRO_COLOR.fat }}>{Math.round(t.fat)}F</span> · <span style={{ color: MACRO_COLOR.protein }}>{Math.round(t.protein)}P</span></>
              : free ? <>Tap to log</> : <><span style={{ color: FUEL.text, fontWeight: 600 }}>{meal.time}</span> · {Math.round(planned.kcal)} kcal planned</>}
          </div>
        </div>
        {logged ? (
          <div aria-label="Logged" style={{ width: 34, height: 34, borderRadius: 99, background: FUEL.protein, display: "grid", placeItems: "center", flexShrink: 0 }}><CheckIcon color={FUEL.onColor} /></div>
        ) : (
          <div aria-label={`Log ${meal.name}`} style={{ width: 34, height: 34, borderRadius: 99, background: FUEL.card2, border: `1px solid ${FUEL.line}`, display: "grid", placeItems: "center", flexShrink: 0 }}><PlusIcon color={FUEL.red} /></div>
        )}
      </button>
      {hasLayers && (
        <div style={{ minWidth: 0, marginTop: 8, display: "flex", flexDirection: "column" }}>
          {loggedLayers(mealEntries).map((l) => (
            <div key={l.name} style={{ minWidth: 0, display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: `1px solid color-mix(in srgb, var(--ink) 9%, transparent)`, fontSize: 13 }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{l.name}{l.count === 1 && l.qty != null ? <span style={{ color: FUEL.dim }}> · {l.qty}{l.unit === "piece" ? " pc" : ` ${l.unit}`}</span> : null}</span>
              <span style={{ color: FUEL.text, fontWeight: 600, flexShrink: 0 }}>{Math.round(l.kcal)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function pill(bg, fg) {
  return { fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 99, fontWeight: 600, background: bg, color: fg };
}

// Client · Fuel (Nov 2026 redesign, approved mockup fuel-log-v2):
// Log/Plan toggle, week strip of on-plan rings, a slim summary card (thin
// calorie gauge + macro bars), then one slim row per meal with a + on the
// right. Tapping a meal opens FuelMealLog, where all logging happens;
// logged foods show as small layers under the meal here. Same data layer
// as before (planForDate, log entries, mealOutcomeFor) - new UI only.
// Viewing a date after today is read-only.
export function FuelToday({ client, updateClient, plans, logs, marks, notes, onWrite, onOpenWeek }) {
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
  // No plan (default for anyone without one, Nov 2026): the same screen
  // with the four standard meals and free logging - search, barcode,
  // photo/description, eating out. No targets, no on-plan tally.
  const free = !plan;
  const orderedMeals = plan?.meals ? [...plan.meals].sort((a, b) => a.time.localeCompare(b.time)) : MEAL_KEYS.map((k) => newPlanMeal(k)).sort((a, b) => a.time.localeCompare(b.time));
  const totals = sumEntries(entries);
  const target = plan?.targets || {};
  const tally = plan ? dayOnPlanTally(plan, dateISO, todayISO, entries, dateMarks) : { onPlan: 0, total: 0 };
  const firstOpenKey = orderedMeals.find((m) => mealOutcomeFor(dateISO, todayISO, m, entries, dateMarks) === "missed")?.key;
  const openMeal = orderedMeals.find((m) => m.key === openMealKey);

  if (openMeal) {
    return (
      <FuelMealLog client={client} updateClient={updateClient} free={free} plan={plan} meal={openMeal} dateISO={dateISO} entries={entries} dateMarks={dateMarks} editable={editable}
        onWrite={(nextEntries, nextMarks) => onWrite(dateISO, nextEntries, nextMarks)} onBack={() => setOpenMealKey(null)} />
    );
  }

  const version = planVersionForDate(plans, dateISO);
  const title = dateISO === todayISO ? "Today" : new Date(`${dateISO}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
  const sub = free ? "No plan yet - log what you eat" : `Plan v${version?.version || ""} from your coach · ${Math.round(target.kcal || 0).toLocaleString()} kcal`;

  return (
    <div style={{ width: "100%", minWidth: 0, maxWidth: "100%", color: FUEL.text, fontFamily: BRAND.sans, display: "flex", flexDirection: "column", gap: 12, paddingBottom: 12 }}>
      <PageHeader kicker="Nutrition" title={title} sub={sub} />
      <PillSwitch value={view} onChange={(k) => (k === "week" ? onOpenWeek() : setView(k))} items={[["log", "Log"], ["plan", "Plan"], ["week", "Week"]]} />

      {view === "plan" ? (
        <FuelPlanView plans={plans} dateISO={dateISO} todayISO={todayISO} />
      ) : (
        <>
          <DayStrip days={fuelStripDays(plans, logs, marks, dateISO, todayISO)} value={dateISO} todayISO={todayISO} onSelect={(d) => setDateISO(d.iso)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <CaloriesCard kcalEaten={totals.kcal} kcalGoal={target.kcal || 0} />
            <MacrosCard now={totals} target={target} />
          </div>

          {notes?.shared && (
            <div style={{ ...screenCard, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 26, height: 26, borderRadius: 99, background: tint(), color: "var(--accent)", fontSize: 12, display: "grid", placeItems: "center", flexShrink: 0, fontWeight: 700 }}>D</div>
              <div style={{ fontSize: 13, lineHeight: 1.4, color: FUEL.muted }}>{notes.shared}</div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "4px 2px -4px" }}>
            <div style={screenLabel}>{dateISO === todayISO ? "Today's meals" : "Meals"}</div>
            {!free && <div style={{ fontSize: 13, fontWeight: 600, color: FUEL.protein }}>{tally.onPlan} of {orderedMeals.length} on plan</div>}
          </div>

          {(
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {orderedMeals.map((meal) => (
                <MealRow key={meal.key} meal={meal} outcome={mealOutcomeFor(dateISO, todayISO, meal, entries, dateMarks)} isNext={meal.key === firstOpenKey && dateISO === todayISO}
                  mealEntries={entries.filter((e) => e.meal === meal.key)} onOpen={() => setOpenMealKey(meal.key)} free={free} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
