import { useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { DAYS } from "../../lib/dateUtils.js";
import { planVersionForDate, resolvePlanDayNum, dayOfWeekISO, mealTotals, itemMacros } from "./nutritionV2Math.js";
import { FUEL, fuelLbl, MACRO_COLOR } from "./fuelTheme.js";
import { mealOptionsFor } from "./fuelOptions.js";

function fmtDate(iso) {
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";
}
function qtyLabel(qty, unit) {
  return unit === "piece" ? `${qty} pc` : `${qty} ${unit || ""}`.trim();
}

// Client · Fuel › Plan (Nov 2026 redesign): the coach-signed plan in
// force for the selected date, read-only. Day-type targets come from the
// plan's weekly rotation labels; the weekday picker shows each day's
// meals, and "N options" counts the distinct versions of that meal across
// the week (the same pool the meal screen offers as Coach's options).
export function FuelPlanView({ plans, dateISO }) {
  const version = planVersionForDate(plans, dateISO);
  const [dayNum, setDayNum] = useState(dayOfWeekISO(dateISO));
  if (!version) return <div style={{ marginTop: 16, color: FUEL.muted, fontSize: 13 }}>Your coach hasn't published a plan yet.</div>;

  const resolved = resolvePlanDayNum(version, dayNum);
  const meals = [...(resolved?.meals || [])].sort((a, b) => a.time.localeCompare(b.time));
  const t = resolved?.targets || version.targets || {};
  const dayTypes = [];
  const seen = new Set();
  for (let d = 1; d <= 7; d++) {
    const r = resolvePlanDayNum(version, d);
    const label = r?.dayLabel || "";
    if (!label || seen.has(label)) continue;
    seen.add(label);
    dayTypes.push({ label, kcal: Math.round(r.targets?.kcal || 0), d });
  }
  const sampleISO = (d) => {
    const base = new Date(`${dateISO}T00:00:00`);
    base.setDate(base.getDate() + (d - dayOfWeekISO(dateISO)));
    return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
      <div style={{ background: FUEL.card, border: `1px solid ${FUEL.line}`, borderRadius: 18, padding: "12px 14px" }}>
        <div style={fuelLbl}>Your plan</div>
        <div style={{ fontFamily: BRAND.display, fontSize: 19, fontWeight: 600, marginTop: 4 }}>{version.name || "Nutrition plan"}</div>
        <div style={{ fontSize: 12, color: FUEL.dim, marginTop: 2 }}>Since {fmtDate(version.from)} · Signed by Coach Denis</div>
        {dayTypes.length > 1 && (
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {dayTypes.map((dt) => {
              const on = dt.label === resolved?.dayLabel;
              return (
                <div key={dt.label} style={{ flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 12, border: `1px solid ${on ? FUEL.lineSoft : FUEL.line}`, background: on ? FUEL.card2 : "transparent" }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: dt.label.toLowerCase().includes("train") ? FUEL.amber : FUEL.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{dt.label}</div>
                  <div style={{ fontFamily: BRAND.display, fontSize: 16, fontWeight: 600, marginTop: 1 }}>{dt.kcal.toLocaleString()} <span style={{ fontFamily: BRAND.sans, fontSize: 11, fontWeight: 400, color: FUEL.dim }}>kcal</span></div>
                </div>
              );
            })}
          </div>
        )}
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4, marginTop: 4 }}>
        {DAYS.map((name, i) => {
          const d = i + 1;
          const on = d === dayNum;
          const lbl = resolvePlanDayNum(version, d)?.dayLabel || "";
          return (
            <button key={name} onClick={() => setDayNum(d)} aria-pressed={on} style={{ padding: "7px 0", borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 500, background: on ? FUEL.text : FUEL.card2, color: on ? FUEL.onText : FUEL.muted }}>
              {name.slice(0, 3)}
              <div style={{ width: 5, height: 5, borderRadius: 9, margin: "4px auto 0", background: on ? FUEL.onText : lbl.toLowerCase().includes("train") ? FUEL.amber : FUEL.lineSoft }} />
            </button>
          );
        })}
      </div>

      {meals.map((meal) => {
        const tot = mealTotals(meal);
        const nOpts = mealOptionsFor(version, meal, sampleISO(dayNum)).length;
        return (
          <div key={meal.key} style={{ background: FUEL.card, border: `1px solid ${FUEL.line}`, borderRadius: 18, padding: "10px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <div><span style={{ fontSize: 15, fontWeight: 500 }}>{cap(meal.name)}</span> <span style={{ fontSize: 12, color: FUEL.dim }}>{meal.time}</span></div>
              <span style={{ fontSize: 12, color: FUEL.dim, whiteSpace: "nowrap" }}>{Math.round(tot.kcal)} kcal{nOpts > 1 ? ` · ${nOpts} options` : ""}</span>
            </div>
            {meal.items.map((it) => (
              <div key={it.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderTop: `1px solid ${FUEL.line}`, marginTop: 6, fontSize: 13 }}>
                <span>{it.name} <span style={{ color: FUEL.dim, fontSize: 12 }}>· {qtyLabel(it.qty, it.unit)}</span></span>
                <span style={{ color: FUEL.muted }}>{Math.round(itemMacros(it).kcal)}</span>
              </div>
            ))}
            {meal.note && <div style={{ fontSize: 12, color: FUEL.amber, marginTop: 4 }}>{meal.note}</div>}
          </div>
        );
      })}
    </div>
  );
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
