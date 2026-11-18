import { BRAND } from "../../theme/tokens.js";
import { DAYS } from "../../lib/dateUtils.js";
import { planVersionForDate, resolvePlanDayNum, dayOfWeekISO, mealTotals } from "./nutritionV2Math.js";
import { FUEL, fuelLbl, MACRO_COLOR } from "./fuelTheme.js";

function fmtDate(iso) {
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";
}
function qtyLabel(qty, unit) {
  return unit === "piece" ? `${qty} pc` : `${qty} ${unit || ""}`.trim();
}

// Fuel › Plan (Nov 2026): the signed plan in force, read-only, showing
// EVERY day of the selected week at once (Denis: "show all the meals
// scheduled for the week") - each day with its type, calories and meals.
// Used by the client Plan tab and the coach's per-client nutrition view.
export function FuelPlanView({ plans, dateISO, todayISO, coach = false }) {
  const version = planVersionForDate(plans, dateISO);
  if (!version) return <div style={{ marginTop: 16, color: FUEL.muted, fontSize: 13 }}>No plan has been published yet.</div>;

  const t = version.targets || {};
  const monday = new Date(`${dateISO}T00:00:00`);
  monday.setDate(monday.getDate() - (dayOfWeekISO(dateISO) - 1));
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const days = DAYS.map((name, i) => {
    const date = new Date(monday); date.setDate(monday.getDate() + i);
    const dISO = iso(date);
    // A day can fall under a different plan version (e.g. a new plan
    // starting mid-week), so resolve each day on its own.
    const v = planVersionForDate(plans, dISO);
    const r = v ? resolvePlanDayNum(v, i + 1) : null;
    const meals = [...(r?.meals || [])].filter((m) => m.items?.length).sort((a, b) => a.time.localeCompare(b.time));
    const kcal = meals.reduce((sum, m) => sum + mealTotals(m).kcal, 0);
    return { name, date, dISO, label: r?.dayLabel || "", meals, kcal, target: r?.targets?.kcal || 0 };
  });
  const today = todayISO || dateISO;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
      <div style={{ background: FUEL.card, border: `1px solid ${FUEL.line}`, borderRadius: 18, padding: "12px 14px" }}>
        <div style={fuelLbl}>{coach ? "Current plan" : "Your plan"}</div>
        <div style={{ fontFamily: BRAND.display, fontSize: 19, fontWeight: 600, marginTop: 4 }}>{version.name || "Nutrition plan"}</div>
        <div style={{ fontSize: 12, color: FUEL.dim, marginTop: 2 }}>Since {fmtDate(version.from)} · Signed by Coach Denis</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginTop: 10 }}>
          {[["kcal", "Calories", FUEL.text, ""], ["carbs", "Carbs", MACRO_COLOR.carbs, "g"], ["fat", "Fat", MACRO_COLOR.fat, "g"], ["protein", "Protein", MACRO_COLOR.protein, "g"]].map(([k, l, c, u]) => (
            <div key={k} style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: FUEL.dim }}>{l}</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{Math.round(t[k] || 0).toLocaleString()}{u}</div>
              <div style={{ height: 3, borderRadius: 9, background: c, marginTop: 4 }} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...fuelLbl, margin: "8px 2px 0" }}>This week's meals</div>
      {days.map((d) => {
        const isToday = d.dISO === today;
        const training = d.label.toLowerCase().includes("train");
        return (
          <div key={d.dISO} style={{ background: FUEL.card, border: `1px solid ${isToday ? FUEL.lineSoft : FUEL.line}`, borderRadius: 18, padding: "10px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontFamily: BRAND.display, fontSize: 16, fontWeight: 600 }}>{d.name}</span>
                <span style={{ fontSize: 12, color: FUEL.dim }}> {d.date.getDate()} {d.date.toLocaleDateString(undefined, { month: "short" })}</span>
                {isToday && <span style={{ marginLeft: 8, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 99, fontWeight: 600, background: FUEL.text, color: FUEL.onText }}>Today</span>}
              </div>
              <span style={{ fontSize: 12, color: FUEL.dim, whiteSpace: "nowrap" }}>
                {d.label && <span style={{ color: training ? FUEL.amber : FUEL.muted }}>{d.label} · </span>}{Math.round(d.kcal).toLocaleString()} kcal
              </span>
            </div>
            {d.meals.length === 0 ? (
              <div style={{ fontSize: 12, color: FUEL.dim, marginTop: 6 }}>No meals planned.</div>
            ) : d.meals.map((meal) => (
              <div key={meal.key} style={{ display: "flex", gap: 10, padding: "7px 0", borderTop: `1px solid ${FUEL.line}`, marginTop: 6, fontSize: 13 }}>
                <span style={{ width: 42, flexShrink: 0, color: FUEL.dim, fontSize: 12, paddingTop: 1 }}>{meal.time}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{cap(meal.name)}</div>
                  <div style={{ fontSize: 12, color: FUEL.muted, marginTop: 1, lineHeight: 1.35 }}>{meal.items.map((it) => `${it.name.split(" (")[0]} ${qtyLabel(it.qty, it.unit)}`).join(" · ")}</div>
                  {meal.note && <div style={{ fontSize: 12, color: FUEL.amber, marginTop: 2 }}>{meal.note}</div>}
                </div>
                <span style={{ color: FUEL.muted, flexShrink: 0, fontSize: 12 }}>{Math.round(mealTotals(meal).kcal)}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
