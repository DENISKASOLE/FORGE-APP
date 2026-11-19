import { useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { DAYS } from "../../lib/dateUtils.js";
import { planVersionForDate, resolvePlanDayNum, dayOfWeekISO, mealTotals, itemMacros, addDaysISO } from "./nutritionV2Math.js";
import { FUEL, fuelLbl, MACRO_COLOR } from "./fuelTheme.js";

function fmtDate(iso) {
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";
}
function qtyLabel(qty, unit) {
  return unit === "piece" ? `${qty} pc` : `${qty} ${unit || ""}`.trim();
}

// Fuel › Plan. Nov 19 2026: a week calendar instead of one long list.
// Each day shows dots for its planned meals; tap a day to see that day's
// meals with every food shown (amounts, calories, macros). Arrows
// move a week at a time. Used by the client Plan tab and the coach's
// per-client "Week plan" view.
function dayInfo(plans, dISO) {
  const v = planVersionForDate(plans, dISO);
  const r = v ? resolvePlanDayNum(v, dayOfWeekISO(dISO)) : null;
  const meals = [...(r?.meals || [])].filter((m) => m.items?.length).sort((a, b) => a.time.localeCompare(b.time));
  const kcal = meals.reduce((sum, m) => sum + mealTotals(m).kcal, 0);
  return { dISO, date: new Date(`${dISO}T00:00:00`), label: r?.dayLabel || "", meals, kcal };
}

export function FuelPlanView({ plans, dateISO, todayISO, coach = false }) {
  const today = todayISO || dateISO;
  const [sel, setSel] = useState(dateISO);
  const version = planVersionForDate(plans, sel) || planVersionForDate(plans, dateISO);
  if (!version) return <div style={{ marginTop: 16, color: FUEL.muted, fontSize: 13 }}>No plan has been published yet.</div>;

  const t = version.targets || {};
  const monday = addDaysISO(sel, -(dayOfWeekISO(sel) - 1));
  const week = DAYS.map((name, i) => ({ name, ...dayInfo(plans, addDaysISO(monday, i)) }));
  const day = dayInfo(plans, sel);
  const training = day.label.toLowerCase().includes("train");
  const monthLabel = new Date(`${addDaysISO(monday, 3)}T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const pick = (dISO) => setSel(dISO);
  const arrow = { width: 34, height: 34, borderRadius: 99, border: "1px solid var(--line-strong)", background: FUEL.card, color: FUEL.text, display: "grid", placeItems: "center", cursor: "pointer", padding: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
      <div style={{ background: "linear-gradient(140deg, var(--accent) 0%, var(--accent-deep) 100%)", color: "var(--btn-ink)", borderRadius: 20, padding: "14px 16px", boxShadow: "0 4px 14px color-mix(in srgb, var(--accent) 20%, transparent)" }}>
        <div style={{ ...fuelLbl, color: "color-mix(in srgb, var(--btn-ink) 80%, transparent)", fontWeight: 600 }}>{coach ? "Current plan" : "Your plan"}</div>
        <div style={{ fontFamily: BRAND.display, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 4 }}>{version.name || "Nutrition plan"}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "color-mix(in srgb, var(--btn-ink) 75%, transparent)", marginTop: 2 }}>Since {fmtDate(version.from)} · Signed by Coach Denis</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginTop: 10 }}>
          {[["kcal", "Calories", "var(--gold)", ""], ["carbs", "Carbs", MACRO_COLOR.carbs, "g"], ["fat", "Fat", MACRO_COLOR.fat, "g"], ["protein", "Protein", MACRO_COLOR.protein, "g"]].map(([k, l, c, u]) => (
            <div key={k} style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "color-mix(in srgb, var(--btn-ink) 75%, transparent)" }}>{l}</div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{Math.round(t[k] || 0).toLocaleString()}{u}</div>
              <div style={{ height: 4, borderRadius: 9, background: `color-mix(in srgb, ${c} 75%, white)`, marginTop: 4 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div style={{ background: FUEL.card, border: "1px solid var(--line-strong)", borderRadius: 20, padding: "12px 10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 10px" }}>
          <button onClick={() => pick(addDaysISO(sel, -7))} aria-label="Previous week" style={arrow}>{chev("left")}</button>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{monthLabel}</div>
          <button onClick={() => pick(addDaysISO(sel, 7))} aria-label="Next week" style={arrow}>{chev("right")}</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
          {week.map((d) => {
            const on = d.dISO === sel;
            const isToday = d.dISO === today;
            return (
              <button key={d.dISO} onClick={() => pick(d.dISO)} aria-pressed={on}
                style={{ border: "none", cursor: "pointer", fontFamily: "inherit", borderRadius: 14, padding: "7px 0 8px", minWidth: 0,
                  background: on ? "var(--accent)" : "transparent", color: on ? "var(--btn-ink)" : FUEL.text }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: on ? "color-mix(in srgb, var(--btn-ink) 80%, transparent)" : isToday ? FUEL.red : FUEL.dim }}>{d.name.slice(0, 3)}</div>
                <div style={{ fontSize: 17, fontWeight: 600, marginTop: 2 }}>{d.date.getDate()}</div>
                <div style={{ display: "flex", justifyContent: "center", gap: 3, marginTop: 5, height: 5 }}>
                  {d.meals.slice(0, 5).map((m) => <span key={m.key} style={{ width: 5, height: 5, borderRadius: 9, background: on ? "var(--btn-ink)" : MEAL_TINT[m.key] || FUEL.red, opacity: on ? 0.85 : 1 }} />)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, margin: "6px 2px 0" }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontFamily: BRAND.display, fontSize: 18, fontWeight: 600 }}>{day.date.toLocaleDateString(undefined, { weekday: "long" })}</span>
          <span style={{ fontSize: 13, color: FUEL.dim }}> {day.date.getDate()} {day.date.toLocaleDateString(undefined, { month: "short" })}</span>
          {sel === today && <span style={{ marginLeft: 8, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 99, fontWeight: 600, background: FUEL.red, color: FUEL.onText, verticalAlign: 2 }}>Today</span>}
        </div>
        <span style={{ fontSize: 12, color: FUEL.dim, whiteSpace: "nowrap" }}>
          {day.label && <span style={{ color: training ? FUEL.amber : FUEL.muted, fontWeight: 600 }}>{day.label} · </span>}{Math.round(day.kcal).toLocaleString()} kcal
        </span>
      </div>

      {day.meals.length === 0 ? (
        <div style={{ background: FUEL.card, border: "1px solid var(--line-strong)", borderRadius: 18, padding: "16px 14px", fontSize: 13, color: FUEL.dim }}>No meals planned for this day.</div>
      ) : day.meals.map((meal) => {
        const mt = mealTotals(meal);
        const tint = MEAL_TINT[meal.key] || FUEL.red;
        return (
          <div key={meal.key} style={{ background: FUEL.card, border: "1px solid var(--line-strong)", borderLeft: `3px solid ${tint}`, borderRadius: 18, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", color: FUEL.text }}>
              <span style={{ width: 42, flexShrink: 0, color: tint, fontWeight: 600, fontSize: 13 }}>{meal.time}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{cap(meal.name)}</div>
                <div style={{ fontSize: 12, color: FUEL.muted, marginTop: 1 }}>
                  {meal.items.length} {meal.items.length === 1 ? "food" : "foods"} · <span style={{ color: MACRO_COLOR.carbs }}>{Math.round(mt.carbs)}C</span> · <span style={{ color: MACRO_COLOR.fat }}>{Math.round(mt.fat)}F</span> · <span style={{ color: MACRO_COLOR.protein }}>{Math.round(mt.protein)}P</span>
                </div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, flexShrink: 0 }}>{Math.round(mt.kcal)}</span>
            </div>
            {(
              <div style={{ padding: "0 14px 10px 68px" }}>
                {meal.items.map((it, n) => {
                  const m = itemMacros(it);
                  return (
                    <div key={`${it.name}-${n}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: `1px solid ${FUEL.line}`, fontSize: 13 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 500, overflowWrap: "anywhere" }}>{it.name}</div>
                        <div style={{ fontSize: 12, color: FUEL.dim, marginTop: 1 }}>{qtyLabel(it.qty, it.unit)} · {Math.round(m.carbs)}C · {Math.round(m.fat)}F · {Math.round(m.protein)}P</div>
                      </div>
                      <span style={{ fontWeight: 600, flexShrink: 0 }}>{Math.round(m.kcal)}</span>
                    </div>
                  );
                })}
                {meal.note && <div style={{ fontSize: 12, color: FUEL.amber, paddingTop: 6, borderTop: `1px solid ${FUEL.line}` }}>{meal.note}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
function chev(dir) {
  const d = { left: "M15 18l-6-6 6-6", right: "M9 6l6 6-6 6" }[dir];
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}
const MEAL_TINT = { breakfast: "var(--orange)", lunch: "var(--blue)", snack: "var(--green)", snacks: "var(--green)", dinner: "var(--violet)" };
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
