import { useMemo } from "react";
import { BRAND } from "../../theme/tokens.js";
import { isoDate } from "../../lib/dateUtils.js";
import { buildProgramDays } from "../../lib/programModel.js";
import { weightTrend } from "../../lib/clientMetrics.js";
import { last7DaysOnPlan, weeklyProgress } from "./nutritionV2Math.js";
import { dayTypeFor } from "./fuelDayType.js";
import { FUEL, fuelLbl, OUTCOME_MARK } from "./fuelTheme.js";

function dayShortName(dateISO) {
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
}

function OnPlanCard({ weekInfo }) {
  const pct = weekInfo.onPlanPct != null ? Math.round(weekInfo.onPlanPct * 100) : null;
  return (
    <div style={{ background: FUEL.card, border: `1px solid ${FUEL.line}`, borderRadius: 22, padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={fuelLbl}>On plan</div>
        <div style={{ fontSize: 44, lineHeight: 1, marginTop: 6 }}>{pct != null ? pct : "—"}<span style={{ fontSize: 22 }}>%</span></div>
        <div style={{ fontSize: 12, color: FUEL.muted, marginTop: 6 }}>{weekInfo.onPlanCount} of {weekInfo.totalCount} meals ticked or swapped</div>
      </div>
      <div style={{ textAlign: "center", padding: "12px 14px", borderRadius: 16, background: FUEL.card2 }}>
        <div style={{ fontSize: 26, color: FUEL.amber }}>{weekInfo.streak}</div>
        <div style={{ ...fuelLbl, marginTop: 2 }}>Day streak</div>
      </div>
    </div>
  );
}

function DayByDayCard({ weekInfo, workoutByDate }) {
  return (
    <div style={{ background: FUEL.card, border: `1px solid ${FUEL.line}`, borderRadius: 22, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={fuelLbl}>Day by day</div>
        <div style={fuelLbl}>Protein</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {weekInfo.days.map((d) => {
          const { label } = dayTypeFor(d.plan, workoutByDate.get(d.date));
          const proteinLow = d.protein < 100 || (d.proteinTarget > 0 && d.protein < d.proteinTarget * 0.9);
          return (
            <div key={d.date} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
              <div style={{ width: 74, fontSize: 13 }}>
                {dayShortName(d.date)}
                <div style={{ fontSize: 10, color: FUEL.muted, letterSpacing: ".06em", textTransform: "uppercase", marginTop: 2 }}>{label}</div>
              </div>
              <div style={{ flex: 1, display: "grid", gridTemplateColumns: `repeat(${d.meals.length || 4}, minmax(0, 1fr))`, gap: 5 }}>
                {d.meals.map((m) => {
                  const o = OUTCOME_MARK[m.outcome];
                  return (
                    <div key={m.key} aria-label={`${m.name}: ${o.label}`} style={{ height: 26, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, background: o.bg, color: o.fg, border: o.border ? `1px solid ${FUEL.lineDashed}` : "none" }}>{o.mark}</div>
                  );
                })}
              </div>
              <div style={{ width: 48, textAlign: "right", fontSize: 13, color: proteinLow ? FUEL.amber : FUEL.text }}>{Math.round(d.protein)} g</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12, fontSize: 11, color: FUEL.muted }}>
        <span><span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 4, background: FUEL.protein, color: "#000", fontSize: 10, textAlign: "center", lineHeight: "14px", verticalAlign: -3 }}>{"✓"}</span> As planned</span>
        <span><span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 4, background: FUEL.proteinSwapped, color: "#000", fontSize: 10, textAlign: "center", lineHeight: "14px", verticalAlign: -3 }}>{"⇄"}</span> Swapped</span>
        <span><span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 4, background: FUEL.amber, color: "#000", fontSize: 10, textAlign: "center", lineHeight: "14px", verticalAlign: -3 }}>+</span> Off-plan</span>
        <span><span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 4, border: `1px solid ${FUEL.lineDashed}`, verticalAlign: -3 }} /> Missed</span>
      </div>
    </div>
  );
}

function AvgTile({ label, value, target, suffix, barBg, barFg }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div style={{ background: FUEL.card, border: `1px solid ${FUEL.line}`, borderRadius: 18, padding: 14 }}>
      <div style={fuelLbl}>{label}</div>
      <div style={{ fontSize: 24, marginTop: 6 }}>{Math.round(value).toLocaleString()}<span style={{ fontSize: 13, color: FUEL.muted }}> / {Math.round(target).toLocaleString()}{suffix}</span></div>
      <div style={{ height: 6, borderRadius: 9, background: barBg, marginTop: 10 }}><div style={{ width: `${pct}%`, height: 6, borderRadius: 9, background: barFg }} /></div>
    </div>
  );
}

function WeightCard({ trend }) {
  if (!trend) return null;
  const vals = trend.points.map((p) => p.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const pad = Math.max((max - min) * 0.15, 0.3);
  const lo = min - pad, hi = max + pad;
  const W = 318, H = 70;
  const xs = (i) => (trend.points.length > 1 ? (i / (trend.points.length - 1)) * (W - 8) + 4 : W / 2);
  const ys = (v) => H - 6 - ((v - lo) / (hi - lo || 1)) * (H - 12);
  const points = trend.points.map((p, i) => `${xs(i).toFixed(1)},${ys(p.value).toFixed(1)}`).join(" ");
  const last = trend.points[trend.points.length - 1];
  const changeStr = `${trend.change >= 0 ? "+" : "−"}${Math.abs(trend.change).toFixed(1)} kg`;
  return (
    <div style={{ background: FUEL.card, border: `1px solid ${FUEL.line}`, borderRadius: 22, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={fuelLbl}>Weight · 7-day average</div>
        <div style={{ fontSize: 13, color: FUEL.protein }}>{changeStr}</div>
      </div>
      <div style={{ fontSize: 24, marginTop: 6 }}>{last.value}<span style={{ fontSize: 13, color: FUEL.muted }}> kg</span></div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Weight trend" style={{ marginTop: 8, display: "block" }}>
        <polyline points={points} fill="none" stroke={FUEL.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={xs(trend.points.length - 1)} cy={ys(last.value)} r="4" fill={FUEL.text} />
      </svg>
      <div style={{ fontSize: 12, color: FUEL.muted, marginTop: 4 }}>Weigh-ins are tracked at check-in, so one off day doesn't scare you.</div>
    </div>
  );
}

// Client · My week (docs/design/fuel-tab/Week.dc.html, DECISIONS.md "Fuel
// tab redesign"). Reads almost entirely from last7DaysOnPlan (shared with
// FuelToday's "This week" teaser and, later, the coach's roster heatmap).
export function FuelWeek({ client, plans, logs, marks, notes, onBack }) {
  const todayISO = isoDate();
  const weekInfo = last7DaysOnPlan(plans, logs, marks, todayISO);
  const progress = weeklyProgress(plans, logs, marks, todayISO, todayISO);
  const trend = weightTrend(client.checkIns);
  const workoutByDate = useMemo(() => {
    const map = new Map();
    buildProgramDays(client.program, client.trainingLogs).forEach((d) => map.set(d.dateISO, !!d.workout));
    return map;
  }, [client.program, client.trainingLogs]);

  return (
    <div style={{ width: "100%", background: FUEL.bg, color: FUEL.text, fontFamily: BRAND.sans, display: "flex", flexDirection: "column", gap: 14, margin: "0 -16px", padding: "6px 20px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} aria-label="Back to today" style={{ width: 44, height: 44, borderRadius: 99, background: FUEL.card2, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke={FUEL.text} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div>
          <div style={fuelLbl}>Last 7 days</div>
          <div style={{ fontSize: 24, textTransform: "uppercase", letterSpacing: ".04em", marginTop: 2, fontWeight: 700 }}>My week</div>
        </div>
      </div>

      <OnPlanCard weekInfo={weekInfo} />
      <DayByDayCard weekInfo={weekInfo} workoutByDate={workoutByDate} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <AvgTile label="Avg protein" value={progress.avg.protein} target={progress.avgTarget.protein} suffix=" g" barBg={FUEL.proteinTrack} barFg={FUEL.protein} />
        <AvgTile label="Avg calories" value={progress.avg.kcal} target={progress.avgTarget.kcal} suffix="" barBg={FUEL.line} barFg={FUEL.text} />
      </div>

      <WeightCard trend={trend} />

      {notes?.shared && (
        <div style={{ background: FUEL.card2, border: `1px solid ${FUEL.lineSoft}`, borderRadius: 22, padding: 16, display: "flex", gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 99, background: FUEL.red, color: "#fff", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>D</div>
          <div>
            <div style={fuelLbl}>Coach Denis · weekly review</div>
            <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 6, color: "#e5e5e5" }}>{notes.shared}</div>
          </div>
        </div>
      )}
    </div>
  );
}
