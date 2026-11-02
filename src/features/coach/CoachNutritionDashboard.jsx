import { useMemo, useState } from "react";
import { isoDate, startOfWeek, addDays } from "../../lib/dateUtils.js";
import { showToast } from "../../components/ui/Toast.jsx";
import { confirmDialog, promptDialog } from "../../components/ui/ConfirmDialog.jsx";
import { usePhotoUrl } from "../../lib/storage.js";
import { weightTrend } from "../../lib/clientMetrics.js";
import { buildProgramDays } from "../../lib/programModel.js";
import { normalizePlans, normalizeLogs, normalizeMarks, savePlans } from "../../lib/nutritionV2.js";
import {
  recentAlertSignals, attentionFlagFor, weeklyProgress, last7DaysOnPlan, weeklyCheckinSuggestion,
  planVersionForDate, resolvePlanDayNum, publishPlan, nextMondayISO, weekDatesEnding, dayOfWeekISO, mealTotals,
} from "../nutrition-v2/nutritionV2Math.js";
import { cloneVersionWithNewIds } from "../nutrition-v2/nutritionV2Model.js";
import { dayTypeFor } from "../nutrition-v2/fuelDayType.js";
import { FUEL, fuelLbl, OUTCOME_MARK } from "../nutrition-v2/fuelTheme.js";

const DAY_NUMS = [1, 2, 3, 4, 5, 6, 7];
const DAY_SHORT = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun" };
const HEATMAP_MEAL_KEYS = [["breakfast", "Bkfst"], ["lunch", "Lunch"], ["snack", "Snack"], ["dinner", "Dinner"]];

function pillBtnStyle(selected) {
  return { height: 40, padding: "0 16px", borderRadius: 999, border: `1px solid ${selected ? "transparent" : FUEL.lineSoft}`, background: selected ? FUEL.text : FUEL.card, color: selected ? "#000" : FUEL.text, fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" };
}
function actionBtnStyle(emphasized) {
  return { height: 46, padding: "0 16px", borderRadius: 12, border: `1px solid ${emphasized ? "transparent" : FUEL.lineSoft}`, background: emphasized ? FUEL.text : FUEL.card, color: emphasized ? "#000" : FUEL.text, fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", fontWeight: 700 };
}
function dayShortName(dateISO) {
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
}
function fmtTrend(trend) {
  if (!trend) return "—";
  const arrow = trend.change < -0.05 ? "↓" : trend.change > 0.05 ? "↑" : "→";
  return `${arrow} ${trend.change >= 0 ? "+" : "−"}${Math.abs(trend.change).toFixed(1)} kg/wk`;
}
function flagColorFor(flag, hasPlan) {
  if (!hasPlan) return FUEL.muted;
  if (!flag) return FUEL.protein;
  if (/no (food logged|log)/i.test(flag)) return FUEL.coral;
  return FUEL.amber;
}
// "Training 1,700 / Rest 1,600 kcal" when the rotation sets a different
// kcal target on some day, else just "{kcal} kcal".
function kcalTargetsSummary(plan) {
  if (!plan) return "No plan set";
  const base = plan.targets?.kcal || 0;
  const entry = Object.values(plan.days || {}).find((d) => d.targets?.kcal && d.targets.kcal !== base);
  if (entry) return `Training ${base.toLocaleString()} / ${entry.label || "Rest"} ${entry.targets.kcal.toLocaleString()} kcal`;
  return `${base.toLocaleString()} kcal`;
}
function applyRotationChange(plans, livePlan, mutate) {
  const draft = cloneVersionWithNewIds(livePlan);
  draft.status = "draft";
  draft.version = (plans.length ? Math.max(...plans.map((p) => p.version)) : 0) + 1;
  draft.from = nextMondayISO(isoDate());
  mutate(draft);
  const published = plans.filter((p) => p.status !== "draft");
  return publishPlan(published, draft, new Date().toISOString());
}

// One client's nutrition health, computed from data already on the
// mapped client object (plans/logs/marks/checkIns) - no extra fetching.
function nutritionHealthFor(client, today) {
  const plans = normalizePlans(client.nutritionV2Plans);
  const logs = normalizeLogs(client.nutritionV2Logs);
  const marks = normalizeMarks(client.nutritionV2Marks);
  const signals = recentAlertSignals(plans, logs, marks, today);
  const flag = attentionFlagFor(signals);
  const week = weeklyProgress(plans, logs, marks, today, today);
  const weekOnPlan = last7DaysOnPlan(plans, logs, marks, today);
  const livePlan = planVersionForDate(plans, today);
  return { client, plans, logs, marks, flag, livePlan, week, weekOnPlan, trend: weightTrend(client.checkIns) };
}

function RosterTable({ healths, selectedId, onSelect }) {
  return (
    <div style={{ flex: "1 1 380px", minWidth: 0, background: FUEL.card, border: `1px solid ${FUEL.line}`, borderRadius: 22, padding: 8 }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 380 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={{ ...fuelLbl, padding: "12px 12px 10px" }}>Client</th>
              <th style={{ ...fuelLbl, padding: "12px 8px 10px" }}>On plan</th>
              <th style={{ ...fuelLbl, padding: "12px 8px 10px" }}>Protein</th>
              <th style={{ ...fuelLbl, padding: "12px 12px 10px", textAlign: "right" }}>Trend</th>
            </tr>
          </thead>
          <tbody>
            {healths.map((h) => {
              const hasPlan = !!h.livePlan;
              const flagText = !hasPlan ? "No plan yet · create" : h.flag || "On track";
              const adh = h.week.adherencePct != null ? `${Math.round(h.week.adherencePct * 100)}%` : "—";
              const proteinShort = h.week.avgTarget.protein > 0 && h.week.avg.protein < h.week.avgTarget.protein * 0.85;
              return (
                <tr key={h.client.id} onClick={() => onSelect(h.client.id)} style={{ borderTop: "1px solid #1f1f1f", background: selectedId === h.client.id ? FUEL.card2 : "transparent", cursor: "pointer" }}>
                  <td style={{ padding: 12, color: FUEL.text, fontWeight: 700 }}>
                    <div>{h.client.name}</div>
                    <div style={{ fontSize: 11, color: flagColorFor(h.flag, hasPlan), marginTop: 3, fontWeight: 700 }}>{flagText}</div>
                  </td>
                  <td style={{ padding: "12px 8px", color: FUEL.text, fontWeight: 700 }}>{adh}</td>
                  <td style={{ padding: "12px 8px", color: proteinShort ? FUEL.amber : FUEL.text, fontWeight: 700 }}>{Math.round(h.week.avg.protein)} / {Math.round(h.week.avgTarget.protein)} g</td>
                  <td style={{ padding: 12, textAlign: "right", color: FUEL.muted, fontWeight: 700 }}>{fmtTrend(h.trend)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CheckinCard({ health, onApplied }) {
  const { client, plans, livePlan, weekOnPlan, trend } = health;
  const [busy, setBusy] = useState(false);
  if (!livePlan) return null;
  const suggestion = weeklyCheckinSuggestion(trend?.points || [], weekOnPlan.onPlanPct);
  async function apply(action) {
    if (action === "keep") { showToast(`Kept ${client.name}'s targets as is.`, "info"); return; }
    const delta = action === "cut" ? -100 : 100;
    const from = nextMondayISO(isoDate());
    const ok = await confirmDialog(`${action === "cut" ? "Cut" : "Add"} 100 kcal for ${client.name}, effective ${from}?`, { confirmLabel: "Confirm" });
    if (!ok) return;
    setBusy(true);
    const nextPlans = applyRotationChange(plans, livePlan, (draft) => { draft.targets = { ...draft.targets, kcal: Math.max(0, (draft.targets.kcal || 0) + delta) }; });
    await savePlans(client.id, nextPlans);
    onApplied(client.id, nextPlans);
    setBusy(false);
    showToast(`${action === "cut" ? "Cut" : "Added"} 100 kcal for ${client.name}, effective ${from}.`, "success");
  }
  return (
    <div style={{ background: FUEL.card2, border: `1px solid ${FUEL.lineSoft}`, borderRadius: 22, padding: 18, display: "flex", flexWrap: "wrap", gap: 18, justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ flex: "1 1 320px" }}>
        <div style={fuelLbl}>Weekly check-in · suggested</div>
        <div style={{ fontSize: 20, marginTop: 6, fontWeight: 700 }}>{suggestion.headline}</div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: "#c4c4c4", marginTop: 6, fontWeight: 700 }}>{suggestion.reason}</div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button onClick={() => apply("keep")} disabled={busy} style={actionBtnStyle(suggestion.action === "keep")}>Keep</button>
        <button onClick={() => apply("cut")} disabled={busy} style={actionBtnStyle(suggestion.action === "cut")}>−100 kcal</button>
        <button onClick={() => apply("add")} disabled={busy} style={actionBtnStyle(suggestion.action === "add")}>+100 kcal</button>
      </div>
    </div>
  );
}

function HeatmapCard({ weekOnPlan }) {
  return (
    <div style={{ background: FUEL.card, border: `1px solid ${FUEL.line}`, borderRadius: 22, padding: 16 }}>
      <div style={{ ...fuelLbl, marginBottom: 10 }}>Last 7 days · meals</div>
      <div style={{ display: "grid", gridTemplateColumns: "70px repeat(4, minmax(0, 1fr))", gap: 5, fontSize: 10, color: FUEL.muted, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6, fontWeight: 700 }}>
        <span /> {HEATMAP_MEAL_KEYS.map(([k, l]) => <span key={k}>{l}</span>)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {weekOnPlan.days.map((d) => (
          <div key={d.date} style={{ display: "grid", gridTemplateColumns: "70px repeat(4, minmax(0, 1fr))", gap: 5, alignItems: "center" }}>
            <span style={{ fontSize: 12 }}>{dayShortName(d.date)}</span>
            {HEATMAP_MEAL_KEYS.map(([key]) => {
              const m = d.meals.find((x) => x.key === key);
              const o = m ? OUTCOME_MARK[m.outcome] : OUTCOME_MARK.missed;
              return <div key={key} aria-label={m ? `${m.name}: ${o.label}` : "No meal planned"} style={{ height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, background: o.bg, color: o.fg, border: o.border ? `1px solid ${FUEL.lineDashed}` : "none" }}>{o.mark}</div>;
            })}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: FUEL.muted, marginTop: 10 }}>{"✓"} as planned · {"⇄"} swapped · + off-plan · empty = missed</div>
    </div>
  );
}

function offPlanEntries(logs, todayISO, limit = 6) {
  const days = weekDatesEnding(todayISO);
  const out = [];
  days.forEach((d) => (logs?.[d] || []).forEach((e) => { if (e.source === "quick" || e.source === "photo") out.push({ ...e, date: d }); }));
  return out.sort((a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || ""))).slice(0, limit);
}
function OffPlanRow({ entry, onReply }) {
  const photoUrl = usePhotoUrl(entry.photo);
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "8px 0", borderTop: "1px solid #1f1f1f" }}>
      <div style={{ width: 52, height: 52, borderRadius: 12, background: FUEL.card2, border: `1px solid ${FUEL.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: FUEL.dim, textAlign: "center", letterSpacing: ".06em", flexShrink: 0, overflow: "hidden", fontWeight: 700 }}>
        {photoUrl ? <img src={photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "PHOTO"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{entry.name}</div>
        <div style={{ fontSize: 11, color: FUEL.muted, marginTop: 3, fontWeight: 700 }}>{dayShortName(entry.date)} {entry.meal} · {entry.reason || "—"}</div>
      </div>
      <button onClick={onReply} style={{ height: 44, padding: "0 12px", borderRadius: 10, border: `1px solid ${FUEL.lineSoft}`, background: FUEL.card, color: FUEL.text, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", fontWeight: 700 }}>Reply</button>
    </div>
  );
}
function OffPlanCard({ logs, onReply }) {
  const entries = offPlanEntries(logs, isoDate());
  return (
    <div style={{ background: FUEL.card, border: `1px solid ${FUEL.line}`, borderRadius: 22, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={fuelLbl}>Off-plan this week · {entries.length}</div>
      {entries.length === 0 && <div style={{ fontSize: 12.5, color: FUEL.dim, fontWeight: 700 }}>Nothing off-plan logged this week.</div>}
      {entries.map((e) => <OffPlanRow key={e.id} entry={e} onReply={onReply} />)}
    </div>
  );
}

function RotationEditor({ health, onApplied, workoutByDate }) {
  const { client, plans, livePlan } = health;
  const [selectedDay, setSelectedDay] = useState(dayOfWeekISO(isoDate()));
  const [busy, setBusy] = useState(false);
  if (!livePlan) return null;
  const monday = startOfWeek(new Date(`${isoDate()}T00:00:00`));
  const resolved = resolvePlanDayNum(livePlan, selectedDay);

  async function copySelectedDayTo() {
    const input = await promptDialog(`Copy ${DAY_SHORT[selectedDay]}'s meals to which days? e.g. "Tue, Wed"`, "", { title: "Copy to..." });
    if (!input) return;
    const targets = input.split(",").map((s) => s.trim().toLowerCase()).map((s) => Object.entries(DAY_SHORT).find(([, v]) => v.toLowerCase().startsWith(s))?.[0]).filter(Boolean).map(Number).filter((d, i, arr) => d !== selectedDay && arr.indexOf(d) === i);
    if (!targets.length) { showToast("Didn't recognize any day names - try \"Tue, Wed\".", "warn"); return; }
    const ok = await confirmDialog(`Copy ${DAY_SHORT[selectedDay]} to ${targets.map((d) => DAY_SHORT[d]).join(", ")}, effective ${nextMondayISO(isoDate())}?`, { confirmLabel: "Copy" });
    if (!ok) return;
    setBusy(true);
    const nextPlans = applyRotationChange(plans, livePlan, (draft) => {
      const days = { ...(draft.days || {}) };
      const copiedMeals = cloneVersionWithNewIds({ id: "x", meals: resolved.meals }).meals;
      targets.forEach((t) => { days[String(t)] = { ...(days[String(t)] || {}), meals: copiedMeals }; });
      draft.days = days;
    });
    await savePlans(client.id, nextPlans);
    onApplied(client.id, nextPlans);
    setBusy(false);
    showToast(`Copied ${DAY_SHORT[selectedDay]} to ${targets.map((d) => DAY_SHORT[d]).join(", ")}, effective next Monday.`, "success");
  }
  async function makeEatingOutDay() {
    const label = await promptDialog(`Label for ${DAY_SHORT[selectedDay]}`, "Dinner out", { title: "Make eating-out day" });
    if (!label) return;
    setBusy(true);
    const nextPlans = applyRotationChange(plans, livePlan, (draft) => {
      const days = { ...(draft.days || {}) };
      days[String(selectedDay)] = { ...(days[String(selectedDay)] || {}), label };
      draft.days = days;
    });
    await savePlans(client.id, nextPlans);
    onApplied(client.id, nextPlans);
    setBusy(false);
    showToast(`${DAY_SHORT[selectedDay]} is now "${label}", effective next Monday.`, "success");
  }

  return (
    <div style={{ background: FUEL.card, border: `1px solid ${FUEL.line}`, borderRadius: 22, padding: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={fuelLbl}>Week rotation</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={copySelectedDayTo} disabled={busy} style={{ height: 40, padding: "0 12px", borderRadius: 10, border: `1px solid ${FUEL.lineSoft}`, background: FUEL.card, color: FUEL.text, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", fontWeight: 700 }}>Copy {DAY_SHORT[selectedDay]} to...</button>
          <button onClick={makeEatingOutDay} disabled={busy} style={{ height: 40, padding: "0 12px", borderRadius: 10, border: `1px solid ${FUEL.lineSoft}`, background: FUEL.card, color: FUEL.text, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", fontWeight: 700 }}>Make eating-out day</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6, overflowX: "auto" }}>
        {DAY_NUMS.map((d) => {
          const r = resolvePlanDayNum(livePlan, d);
          const dateForDow = addDays(monday, d - 1);
          const { label, training } = dayTypeFor(r, workoutByDate.get(isoDate(dateForDow)));
          const selected = d === selectedDay;
          return (
            <button key={d} onClick={() => setSelectedDay(d)} style={{ padding: "10px 8px", borderRadius: 12, minWidth: 70, textAlign: "left", cursor: "pointer", fontWeight: 700, background: selected ? FUEL.text : FUEL.card2, color: selected ? "#000" : FUEL.text, border: selected ? "none" : `1px solid ${training ? FUEL.amber : FUEL.line}` }}>
              <div style={{ fontSize: 12 }}>{DAY_SHORT[d]}</div>
              <div style={{ fontSize: 10, marginTop: 3, letterSpacing: ".04em", textTransform: "uppercase", opacity: 0.8 }}>{label}</div>
              <div style={{ fontSize: 11, marginTop: 6 }}>{(r.targets?.kcal || 0).toLocaleString()}</div>
            </button>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, marginTop: 12 }}>
        {resolved.meals.map((m) => {
          const foodLine = m.items.map((it) => it.name).join(", ") || "No foods yet";
          const totals = mealTotals(m);
          return (
            <div key={m.key} style={{ padding: 12, borderRadius: 14, background: FUEL.card2 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700 }}><span>{m.name}</span><span style={{ color: FUEL.muted }}>{m.time}</span></div>
              <div style={{ fontSize: 13, marginTop: 6, color: "#e5e5e5", lineHeight: 1.4, fontWeight: 700 }}>{foodLine}</div>
              <div style={{ fontSize: 11, marginTop: 6, color: FUEL.muted, fontWeight: 700 }}>{Math.round(totals.kcal)} kcal · <span style={{ color: FUEL.protein }}>{Math.round(totals.protein)} g</span></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SelectedClientPanel({ health, selectClient, onApplied, workoutByDate }) {
  const { client, livePlan } = health;
  return (
    <div style={{ flex: "999 1 560px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{client.name}</div>
          <div style={{ fontSize: 12, color: FUEL.muted, marginTop: 3, fontWeight: 700 }}>{client.goal || (client.goals || []).join(" + ") || "No goal set"} · {client.clientType === "Online" ? "Online" : "1:1"} · {kcalTargetsSummary(livePlan)} · {livePlan?.targets?.protein || 0} g protein every day</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => selectClient(client)} style={{ height: 44, padding: "0 16px", borderRadius: 12, border: `1px solid ${FUEL.lineSoft}`, background: FUEL.card, color: FUEL.text, fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", fontWeight: 700 }}>Message</button>
          <button onClick={() => selectClient(client)} style={{ height: 44, padding: "0 16px", borderRadius: 12, border: "none", background: FUEL.text, color: "#000", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", fontWeight: 700 }}>Edit plan</button>
        </div>
      </div>

      <CheckinCard health={health} onApplied={onApplied} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        <HeatmapCard weekOnPlan={health.weekOnPlan} />
        <OffPlanCard logs={health.logs} onReply={() => selectClient(client)} />
      </div>

      <RotationEditor health={health} onApplied={onApplied} workoutByDate={workoutByDate} />
    </div>
  );
}

// Coach · Tools > Nutrition (docs/design/fuel-tab/Coach.dc.html,
// DECISIONS.md "Fuel tab redesign"). Replaces the earlier, simpler
// triage-only version of this screen - same mount point
// (CoachDashboard.jsx's "nutrition_dashboard" screen), richer content:
// a roster + a selected client's weekly check-in suggestion, meal
// heatmap, off-plan list and week rotation editor. "Message"/"Edit
// plan"/"Reply" all open the client directly (selectClient) rather than
// composing in place - there's no tab-deep-link into Messages from here
// yet, same simplification CoachAssistant-adjacent screens already make.
export function CoachNutritionDashboard({ clients, selectClient, updateClient, onBack }) {
  const [filter, setFilter] = useState("attention");
  const [selectedId, setSelectedId] = useState(null);
  const today = isoDate();

  const healths = useMemo(() => clients.map((c) => nutritionHealthFor(c, today)), [clients, today]);
  const attentionCount = healths.filter((h) => h.flag).length;
  const filtered = useMemo(() => {
    const list = healths.filter((h) => {
      if (filter === "attention") return !!h.flag;
      if (filter === "online") return h.client.clientType === "Online";
      if (filter === "inperson") return h.client.clientType !== "Online";
      return true;
    });
    return [...list].sort((a, b) => (a.flag ? 0 : 1) - (b.flag ? 0 : 1));
  }, [healths, filter]);
  const selected = filtered.find((h) => h.client.id === selectedId) || filtered[0] || healths[0];

  const workoutByDate = useMemo(() => {
    const map = new Map();
    if (selected) buildProgramDays(selected.client.program, selected.client.trainingLogs).forEach((d) => map.set(d.dateISO, !!d.workout));
    return map;
  }, [selected]);

  function handleApplied(clientId, nextPlans) {
    const c = clients.find((x) => x.id === clientId);
    if (c) updateClient({ ...c, nutritionV2Plans: nextPlans });
  }

  const filters = [["attention", `Needs attention · ${attentionCount}`], ["all", "All clients"], ["online", "Online"], ["inperson", "In-person"]];

  return (
    <div style={{ background: FUEL.bg, color: FUEL.text, fontFamily: "inherit", padding: 4, display: "flex", flexDirection: "column", gap: 18 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: FUEL.muted, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4, alignSelf: "flex-start" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Tools
      </button>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 14 }}>
        <div>
          <div style={fuelLbl}>Coach · Tools</div>
          <div style={{ fontSize: 30, textTransform: "uppercase", letterSpacing: ".04em", marginTop: 4, fontWeight: 700 }}>Nutrition</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {filters.map(([k, l]) => <button key={k} onClick={() => setFilter(k)} style={pillBtnStyle(filter === k)}>{l}</button>)}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ color: FUEL.muted, fontSize: 13, fontWeight: 700 }}>No clients match this filter.</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-start" }}>
          <RosterTable healths={filtered} selectedId={selected?.client.id} onSelect={setSelectedId} />
          {selected && <SelectedClientPanel health={selected} selectClient={selectClient} onApplied={handleApplied} workoutByDate={workoutByDate} />}
        </div>
      )}
    </div>
  );
}
