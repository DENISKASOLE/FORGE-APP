// Pure functions only - no React, no Supabase - so the day-level rules
// (status, adherence, versioning) can be unit tested directly and reused
// identically by every screen, same "one source of truth" approach as
// the feature this replaces (nutrition-plan/planMath.js).
import { isoDate } from "../../lib/dateUtils.js";
import { uid } from "../../lib/uid.js";
import { emptyMacros } from "./nutritionV2Model.js";

function sumMacros(list) {
  return list.reduce((t, m) => ({ kcal: t.kcal + m.kcal, protein: t.protein + m.protein, carbs: t.carbs + m.carbs, fat: t.fat + m.fat }), emptyMacros());
}
// Local-safe date arithmetic (not dateUtils.addDays with a bare string,
// which parses date-only ISO as UTC and can land on the wrong local day -
// the exact "Dubai 23:59 vs 00:01" class of bug this app has hit before).
export function addDaysISO(dateISO, n) {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

// ---------- food-form macro sanity check ----------
// Ported from the retired nutrition-plan feature's planMath.js (same
// Foods screen, just relocated here). Warns, never blocks - catches a
// typo (a decimal in the wrong place, protein/fat swapped) without
// stopping a coach entering a real food whose label genuinely rounds oddly.
export function macroSanityCheck({ kcal, protein, carbs, fat }) {
  const expected = 4 * (protein || 0) + 4 * (carbs || 0) + 9 * (fat || 0);
  if (expected <= 0) return { ok: true, expectedKcal: 0, pct: 0 };
  const pct = Math.abs((kcal || 0) - expected) / expected;
  return { ok: pct <= 0.15, expectedKcal: Math.round(expected), pct };
}

// ---------- item / meal / day macros (plan items only - log entries store their macros directly) ----------
export function itemGrams(item) { return (Number(item.qty) || 0) * (item.unitGrams || 1); }
export function itemMacros(item) {
  const factor = itemGrams(item) / (item.snapshot?.basisGrams || 100);
  const m = item.snapshot || emptyMacros();
  return { kcal: (m.kcal || 0) * factor, protein: (m.protein || 0) * factor, carbs: (m.carbs || 0) * factor, fat: (m.fat || 0) * factor };
}
export function mealTotals(meal) { return sumMacros((meal.items || []).map(itemMacros)); }
export function dayTotals(planVersion) { return sumMacros((planVersion?.meals || []).map(mealTotals)); }
export function roundMacros(m) { return { kcal: Math.round(m.kcal), protein: Math.round(m.protein), carbs: Math.round(m.carbs), fat: Math.round(m.fat) }; }

// ---------- §6.1-equivalent: which plan version applies, and versioning on publish ----------
// A plan's status stays 'published' for its whole lifetime once it goes
// live, even after a newer version supersedes it (its `to` just narrows) -
// 'archived' means it was replaced before it ever took effect. This
// mirrors the prototype's own confirmPublish() exactly; getting the
// archived/published split wrong would make historical days resolve to
// the wrong version.
//
// Weekly rotation: a version may carry `days`, keyed "1".."7" (Mon..Sun,
// same numbering as a program workout's dayOfWeek). Each entry can
// override that weekday's meals and/or targets and give it a label
// ("Training day", "Dinner out"). A weekday with no entry uses the
// version's own meals/targets, so a plan without `days` behaves exactly
// as before.
//
// planVersionForDate = the raw stored version (what the coach builder
// edits and publishes). planForDate = that version resolved to the
// weekday's meals/targets - what every client screen, adherence and
// report calculation reads, so they all pick up the rotation for free.
export function dayOfWeekISO(dateISO) {
  const d = new Date(`${dateISO}T00:00:00`).getDay();
  return d === 0 ? 7 : d;
}
// Same resolution as resolvePlanDay, but keyed directly off a weekday
// number (1=Mon..7=Sun) instead of a real date - used by the
// Change-a-meal sheet to show "what lunch looks like on your other
// rotation days" without having to fabricate a date for each one.
export function resolvePlanDayNum(plan, dayNum) {
  if (!plan) return null;
  const day = plan.days?.[String(dayNum)];
  if (!day) return plan;
  return {
    ...plan,
    meals: Array.isArray(day.meals) && day.meals.length ? day.meals : plan.meals,
    targets: day.targets ? { ...emptyMacros(), ...day.targets } : plan.targets,
    dayLabel: day.label || "",
  };
}
export function resolvePlanDay(plan, dateISO) {
  return resolvePlanDayNum(plan, dayOfWeekISO(dateISO));
}
export function planVersionForDate(plans, dateISO) {
  return (plans || []).find((p) => p.status === "published" && p.from <= dateISO && (!p.to || p.to >= dateISO)) || null;
}
export function planForDate(plans, dateISO) {
  return resolvePlanDay(planVersionForDate(plans, dateISO), dateISO);
}
export function publishPlan(plans, draft, publishedAtISO) {
  const updated = (plans || []).map((p) => {
    if (p.status !== "published") return p;
    if (p.from >= draft.from) return { ...p, status: "archived" };
    if (!p.to || p.to >= draft.from) return { ...p, to: addDaysISO(draft.from, -1) };
    return p;
  });
  const published = { ...draft, status: "published", to: null, published: publishedAtISO };
  return [...updated, published];
}
export function nextDraftFrom(draft, publishedVersionStatus) {
  // Called the first time a coach edits an already-published draft: bumps
  // the version exactly once, not on every keystroke (matches the
  // prototype's editDraft(): `if (cstatus==='published') { version+=1; ... }`).
  if (publishedVersionStatus !== "published") return draft;
  return { ...draft, id: uid(), version: draft.version + 1, status: "draft", published: null };
}

// ---------- §6.2-equivalent: a meal's status for one date ----------
// dateLogEntries: this date's LogEntry[]. dateMarks: this date's {[mealKey]:'skipped'}.
export function mealStatus(dateISO, todayISO, meal, dateLogEntries, dateMarks) {
  if ((dateMarks || {})[meal.key] === "skipped") return "skipped";
  const confirmed = (dateLogEntries || []).filter((e) => e.source === "confirm" && e.meal === meal.key);
  if (confirmed.length) {
    const full = (meal.items || []).every((it) => {
      const e = confirmed.find((c) => c.planItemId === it.id);
      return e && Number(e.qty) >= Number(it.qty);
    });
    return full ? "eaten" : "partial";
  }
  if ((dateLogEntries || []).some((e) => e.source === "sub" && e.replaces === meal.key)) return "substituted";
  return dateISO > todayISO ? "future" : "open";
}
// Entries with no planItemId and not a substitution - "also logged" on
// Overview, grouped separately from the prescribed meal cards.
export function unplannedEntries(dateLogEntries) {
  return (dateLogEntries || []).filter((e) => !e.planItemId && e.source !== "sub");
}
export function loggedDayTotals(dateLogEntries) { return sumMacros((dateLogEntries || []).map((e) => e.macros || emptyMacros())); }

// ---------- Fuel tab redesign: the 4-state outcome model (DECISIONS.md "Fuel tab redesign") ----------
// mealStatus above (eaten/partial/substituted/skipped/open/future) backs
// the OLD client screens' portion-editing and skip actions, which the
// redesign retires - the new screens (Today, Change-a-meal, My week) only
// ever show one of 4 outcomes per meal, "no-shame logging" by design
// (ground rule: swaps/off-plan are never shown as a failure):
//   planned  - confirmed exactly as prescribed (source "confirm").
//   swapped  - logged as another PLAN meal instead (source "sub",
//              Swap.dc.html section 1) - counts as on-plan.
//   offplan  - logged something that's neither the plan nor a plan-swap
//              (quick/photo/search, i.e. eating-out or "something else" -
//              Swap.dc.html sections 2-3), or a legacy skip mark. Neutral
//              amber, never red, and never counts as on-plan.
//   missed   - nothing logged for a date that's already happened.
//   future   - the date hasn't happened yet, so there's nothing to judge.
export function mealOutcomeFor(dateISO, todayISO, meal, dateLogEntries, dateMarks) {
  const entries = (dateLogEntries || []).filter((e) => e.meal === meal.key);
  if (entries.some((e) => e.source === "confirm")) return "planned";
  if (entries.some((e) => e.source === "sub")) return "swapped";
  if (entries.length) return "offplan";
  if ((dateMarks || {})[meal.key] === "skipped") return "offplan";
  return dateISO > todayISO ? "future" : "missed";
}
// One day's on-plan tally - "swapped" counts as on-plan, "offplan" and
// "missed" don't (brief, Client · My week); "future" meals are excluded
// entirely rather than counted as a failure.
export function dayOnPlanTally(planVersion, dateISO, todayISO, dateLogEntries, dateMarks) {
  const meals = planVersion?.meals || [];
  let onPlan = 0, counted = 0;
  meals.forEach((m) => {
    const outcome = mealOutcomeFor(dateISO, todayISO, m, dateLogEntries, dateMarks);
    if (outcome === "future") return;
    counted += 1;
    if (outcome === "planned" || outcome === "swapped") onPlan += 1;
  });
  return { onPlan, counted, total: meals.length };
}
// Last 7 days' on-plan % (Today's "This week" teaser and My week's
// headline tile share this) plus a day streak. The streak counts
// consecutive days, back from today, that were never a total blank -
// anything logged (planned, swapped, or off-plan alike) keeps it alive,
// same "no-shame logging" principle as the outcome model above, rather
// than requiring a perfect on-plan day. A day with no plan at all (or no
// meals on it) can't break the streak either - there was nothing to log.
// Each day also carries its own meal-by-meal outcome grid (`meals`) and
// logged protein - the same per-day/per-meal walk the client "My week"
// day-by-day grid and the coach's roster heatmap both need (brief: "the
// same states and legend as the client week grid"), so both screens
// read it from this one call instead of re-deriving it twice.
export function last7DaysOnPlan(plans, logs, marks, todayISO) {
  const days = weekDatesEnding(todayISO);
  let onPlanSum = 0, countedSum = 0;
  const perDay = days.map((d) => {
    const plan = planForDate(plans, d);
    const dateEntries = logs?.[d] || [];
    const dateMarks = marks?.[d] || {};
    const orderedMeals = plan?.meals ? [...plan.meals].sort((a, b) => a.time.localeCompare(b.time)) : [];
    const meals = orderedMeals.map((m) => ({ key: m.key, name: m.name, outcome: mealOutcomeFor(d, todayISO, m, dateEntries, dateMarks) }));
    const tally = plan ? dayOnPlanTally(plan, d, todayISO, dateEntries, dateMarks) : { onPlan: 0, counted: 0, total: 0 };
    onPlanSum += tally.onPlan;
    countedSum += tally.counted;
    const protein = loggedDayTotals(dateEntries).protein;
    return { date: d, plan, tally, meals, protein, proteinTarget: plan?.targets?.protein || 0, hasAnyLog: dateEntries.length > 0 };
  });
  let streak = 0;
  for (let i = perDay.length - 1; i >= 0; i--) {
    const day = perDay[i];
    if (day.tally.total === 0 || day.hasAnyLog) streak += 1; else break;
  }
  return { onPlanPct: countedSum ? onPlanSum / countedSum : null, onPlanCount: onPlanSum, totalCount: countedSum, streak, days: perDay };
}

// ---------- §adherence: eaten ÷ meals with any logged outcome, not-logged excluded ----------
export function dayAdherence(planVersion, dateISO, todayISO, dateLogEntries, dateMarks) {
  if (!planVersion) return null;
  let eaten = 0, outcome = 0;
  (planVersion.meals || []).forEach((m) => {
    const st = mealStatus(dateISO, todayISO, m, dateLogEntries, dateMarks);
    if (st === "open" || st === "future") return;
    outcome += 1;
    if (st === "eaten") eaten += 1;
  });
  return outcome ? eaten / outcome : null;
}

// ---------- Progress tab: one week's chart/adherence/insight data, shared by client + coach ----------
export function weekDatesEnding(endDateISO) {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(endDateISO, i - 6));
}
// endDateISO: the last day of the 7-day window being viewed (today, or
// today-7 for "previous week"). todayISO: the REAL today, always - needed
// separately so mealStatus still correctly calls a day "future" when
// looking at an upcoming window, rather than treating every day in a
// past window as "today".
export function weeklyProgress(plans, logs, marks, endDateISO, todayISO) {
  const days = weekDatesEnding(endDateISO);
  const counts = { eaten: 0, partial: 0, substituted: 0, skipped: 0, open: 0 };
  let loggedCount = 0, unplannedCount = 0, kcalWithinTarget = 0;
  let actualSum = emptyMacros(), targetSum = emptyMacros();
  const subCounts = {};
  const rows = days.map((d) => {
    const plan = planForDate(plans, d);
    const entries = logs?.[d] || [];
    const dayMarks = marks?.[d] || {};
    const has = entries.length > 0;
    const totals = loggedDayTotals(entries);
    if (plan) {
      plan.meals.forEach((m) => {
        const st = mealStatus(d, todayISO, m, entries, dayMarks);
        counts[st === "future" ? "open" : st] = (counts[st === "future" ? "open" : st] || 0) + 1;
      });
      entries.filter((e) => e.source === "sub").forEach((e) => {
        const m = plan.meals.find((x) => x.key === e.replaces);
        if (m) subCounts[m.name] = (subCounts[m.name] || 0) + 1;
      });
    }
    unplannedCount += unplannedEntries(entries).length;
    if (has && plan) {
      loggedCount += 1;
      actualSum = { kcal: actualSum.kcal + totals.kcal, protein: actualSum.protein + totals.protein, carbs: actualSum.carbs + totals.carbs, fat: actualSum.fat + totals.fat };
      targetSum = { kcal: targetSum.kcal + (plan.targets.kcal || 0), protein: targetSum.protein + (plan.targets.protein || 0), carbs: targetSum.carbs + (plan.targets.carbs || 0), fat: targetSum.fat + (plan.targets.fat || 0) };
      if (plan.targets.kcal && Math.abs(totals.kcal - plan.targets.kcal) / plan.targets.kcal <= 0.1) kcalWithinTarget += 1;
    }
    return { date: d, has, totals, target: plan ? plan.targets : null };
  });
  const outcome = counts.eaten + counts.partial + counts.substituted + counts.skipped;
  const avg = (sum) => (loggedCount ? { kcal: sum.kcal / loggedCount, protein: sum.protein / loggedCount, carbs: sum.carbs / loggedCount, fat: sum.fat / loggedCount } : emptyMacros());
  return {
    days: rows, loggedCount, avg: avg(actualSum), avgTarget: avg(targetSum),
    counts, outcome, adherencePct: outcome ? counts.eaten / outcome : null, unplannedCount,
    kcalWithinTarget, subCounts,
  };
}
// Rule-based, not AI - the prototype's own stated framing ("Review
// prompts - Rule-based, not medical advice"). Takes weeklyProgress()'s
// result directly so it stays trivially testable without its own data
// plumbing.
export function weeklyInsights(result) {
  const insights = [];
  if (result.loggedCount && result.avgTarget.protein && result.avg.protein < 0.9 * result.avgTarget.protein) {
    const below = result.days.filter((d) => d.has && d.target?.protein && d.totals.protein < 0.9 * d.target.protein).length;
    insights.push(`Protein has been below target on ${below} of ${result.loggedCount} logged days (avg ${Math.round(result.avg.protein)}g vs ${Math.round(result.avgTarget.protein)}g).`);
  }
  const notLogged = result.days.filter((d) => !d.has);
  if (notLogged.length) insights.push(`Nothing was logged on ${notLogged.length} of the last 7 days.`);
  Object.entries(result.subCounts || {}).forEach(([name, n]) => { if (n >= 2) insights.push(`${name} was substituted ${n} times this period.`); });
  if (result.loggedCount) insights.push(`Calories were within ±10% of target on ${result.kcalWithinTarget} of ${result.loggedCount} logged days.`);
  return insights;
}

// ---------- coach alerts: rolling adherence / no-log streak / heavy extras ----------
// Ports the same three rules the old prescribed_plan-only alerts used
// (nutrition-plan/planMath.js's nutritionAlertSignals, now retired along
// with that feature), generalized to run for every client - a no-log
// streak is just as real for someone with no plan at all, so this is the
// single check that replaces BOTH the old food_log-only staleness alert
// and the old prescribed_plan-only no-log alert.
export const LOW_ADHERENCE_THRESHOLD = 0.6;
export const LOW_ADHERENCE_WINDOW_DAYS = 3;
export const NO_LOG_STREAK_DAYS_WITH_PLAN = 2;
export const NO_LOG_STREAK_DAYS_NO_PLAN = 7;
export const HEAVY_EXTRAS_PCT = 0.15;
export const HEAVY_EXTRAS_DAYS_OF_7 = 3;

function completeDaysBack(todayISO, n) {
  return Array.from({ length: n }, (_, i) => addDaysISO(todayISO, -(i + 1)));
}
export function recentAlertSignals(plans, logs, marks, todayISO) {
  const sevenDays = completeDaysBack(todayISO, 7);
  const threeDays = sevenDays.slice(0, LOW_ADHERENCE_WINDOW_DAYS);

  const adherenceScores = threeDays
    .map((d) => { const plan = planForDate(plans, d); return plan ? dayAdherence(plan, d, todayISO, logs?.[d] || [], marks?.[d] || {}) : null; })
    .filter((a) => a != null);
  const avgAdherence = adherenceScores.length ? adherenceScores.reduce((a, b) => a + b, 0) / adherenceScores.length : null;
  const lowAdherence = avgAdherence !== null && avgAdherence < LOW_ADHERENCE_THRESHOLD;

  let noLogDays = 0;
  for (const d of sevenDays) {
    if ((logs?.[d] || []).length > 0) break;
    noLogDays += 1;
  }
  const hasCurrentPlan = !!planForDate(plans, todayISO);
  const noLogThreshold = hasCurrentPlan ? NO_LOG_STREAK_DAYS_WITH_PLAN : NO_LOG_STREAK_DAYS_NO_PLAN;

  let heavyExtrasDays = 0;
  sevenDays.forEach((d) => {
    const plan = planForDate(plans, d);
    if (!plan?.targets.kcal) return;
    const extrasKcal = unplannedEntries(logs?.[d] || []).reduce((s, e) => s + e.macros.kcal, 0);
    if (extrasKcal / plan.targets.kcal > HEAVY_EXTRAS_PCT) heavyExtrasDays += 1;
  });

  return { lowAdherence, avgAdherence, noLogDays, noLogThreshold, hasCurrentPlan, heavyExtrasDays };
}
// Turns recentAlertSignals()'s numbers into the one plain-language reason
// a coach dashboard shows for a client that needs attention (DECISIONS.md
// "Nutrition redesign v2" - the coach Nutrition dashboard). Checked in
// priority order (a silent client is worth flagging before a noisy one);
// null means nothing's wrong - same thresholds recentAlertSignals already
// uses, nothing re-derived here.
export function attentionFlagFor(signals) {
  if (signals.noLogDays >= signals.noLogThreshold) return `No food logged in ${signals.noLogDays} days`;
  if (signals.lowAdherence) return `Meal adherence low (${Math.round((signals.avgAdherence || 0) * 100)}% over the last ${LOW_ADHERENCE_WINDOW_DAYS} days)`;
  if (signals.heavyExtrasDays >= HEAVY_EXTRAS_DAYS_OF_7) return `Unplanned extras heavy on ${signals.heavyExtrasDays} of the last 7 days`;
  return null;
}

// ---------- coach Nutrition dashboard: weekly check-in suggestion ----------
// Brief's exact rule, read as a fat-loss framing (the example client is a
// fat-loss case): a trend between -1%/wk and -0.25%/wk of bodyweight, at
// >=75% on-plan, is on pace - keep. Flat for 2+ weeks at >=75% on-plan
// suggests tightening by 100 kcal. Losing faster than -1%/wk suggests
// loosening by 100 kcal - not one of the brief's two stated bullets, but
// the mirror case the +100 kcal button exists for. Below 75% on-plan,
// adherence (not the target) is the variable worth fixing first, so it's
// always "keep" regardless of the trend - the brief's own third bullet.
export const CHECKIN_ONPLAN_THRESHOLD = 0.75;
export const CHECKIN_SLOW_PCT = 0.0025; // 0.25% bodyweight/week - the slow edge of "on pace"
export const CHECKIN_FAST_PCT = 0.01; // 1% bodyweight/week - the fast edge of "on pace"
export const CHECKIN_FLAT_PCT = 0.001; // under this, a week's change counts as "flat"
export function nextMondayISO(todayISO) {
  const dow = dayOfWeekISO(todayISO);
  return addDaysISO(todayISO, dow === 1 ? 7 : 8 - dow);
}
// weightPoints: oldest-first [{date,value}] (same shape as clientMetrics.js's
// weightTrend().points). onPlanPct: this client's last7DaysOnPlan() figure.
export function weeklyCheckinSuggestion(weightPoints, onPlanPct) {
  const n = weightPoints?.length || 0;
  if (n < 2) return { action: "keep", headline: "Keep targets.", reason: "Not enough weigh-in history yet to judge the trend." };
  const bodyweight = weightPoints[n - 1].value;
  const deltas = [];
  for (let i = n - 1; i > 0 && deltas.length < 3; i--) deltas.push(weightPoints[i].value - weightPoints[i - 1].value);
  const latest = deltas[0];
  const pctPerWeek = bodyweight > 0 ? latest / bodyweight : 0;
  const onPlanPctRounded = onPlanPct != null ? Math.round(onPlanPct * 100) : null;
  const trendStr = `${latest >= 0 ? "+" : "−"}${Math.abs(latest).toFixed(1)} kg/week`;
  const trendLine = `Weight trend ${trendStr} at ${onPlanPctRounded != null ? `${onPlanPctRounded}%` : "an unknown"} on plan.`;
  const lowAdherence = onPlanPct == null || onPlanPct < CHECKIN_ONPLAN_THRESHOLD;
  if (lowAdherence) return { action: "keep", headline: "Keep targets. Adherence first.", reason: `On-plan is ${onPlanPctRounded != null ? `${onPlanPctRounded}%` : "low"}, so the plan isn't the variable to change yet.` };
  if (pctPerWeek <= -CHECKIN_SLOW_PCT && pctPerWeek >= -CHECKIN_FAST_PCT) return { action: "keep", headline: "Keep targets. On pace.", reason: trendLine };
  if (pctPerWeek < -CHECKIN_FAST_PCT) return { action: "add", headline: "Add 100 kcal. Losing too fast.", reason: trendLine };
  const flat = deltas.length >= 2 && bodyweight > 0 && deltas.slice(0, 2).every((d) => Math.abs(d / bodyweight) < CHECKIN_FLAT_PCT);
  if (flat) return { action: "cut", headline: "Cut 100 kcal. Progress has stalled.", reason: `Weight has been flat for 2+ weeks at ${onPlanPctRounded}% on plan.` };
  return { action: "keep", headline: "Keep targets.", reason: trendLine };
}

// ---------- legacy macro_log -> nutrition_v2_logs, read-time promote-on-first-touch ----------
// macroDay = one date's entry from the OLD nutrition.js macro_log shape:
// { breakfast: MacroEntry[], lunch: [], dinner: [], snacks: [] }, where
// MacroEntry = { id, foodId, name, brand, serving, amount, kcal, protein,
// carbs, fats, custom, loggedAt } (see lib/nutrition.js emptyMacroEntry).
// Converts to the new flat LogEntry[] shape so a client's existing macro
// data shows up in the new Food log without ever rewriting the old rows.
const LEGACY_SLOT_TO_MEAL = { breakfast: "breakfast", lunch: "lunch", dinner: "dinner", snacks: "snack" };
export function mergeLegacyMacroLog(macroDay, dateISO) {
  if (!macroDay) return [];
  const out = [];
  Object.entries(LEGACY_SLOT_TO_MEAL).forEach(([slot, meal]) => {
    (macroDay[slot] || []).forEach((entry) => {
      out.push({
        id: uid(), date: dateISO, meal, name: entry.name || "Logged food", foodId: entry.foodId || null,
        qty: entry.amount ?? null, unit: entry.serving || "g",
        macros: { kcal: Number(entry.kcal) || 0, protein: Number(entry.protein) || 0, carbs: Number(entry.carbs) || 0, fat: Number(entry.fats) || 0 },
        source: entry.custom ? "quick" : "search",
        time: entry.loggedAt && !isNaN(new Date(entry.loggedAt).getTime()) ? new Date(entry.loggedAt).toTimeString().slice(0, 5) : "",
        planItemId: null, estimate: false, replaces: null, reason: null,
      });
    });
  });
  return out;
}

// ---------- §saved-meal suggestions: surface a client's own repeated quick-adds as reusable meals ----------
// Read-only - never touches nutrition_v2_logs. "quick" is the one log
// source that's always a client's own typed name + macros, not a food-
// library lookup or a coach's prescription, so a name that recurs is
// unambiguously something the client made themselves and would plausibly
// want to log again in one tap - exactly what the meal-builder feature
// adds a deliberate way to do going forward. `existingNames` (already-
// saved meal names, lowercased) is excluded so a client's real saved
// meals are never duplicated as a "suggestion" of themselves.
export function suggestSavedMealsFromHistory(logs, existingNames = [], { minOccurrences = 2, limit = 8 } = {}) {
  const excluded = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  const byName = {};
  Object.entries(logs || {}).forEach(([date, entries]) => {
    (entries || []).forEach((e) => {
      if (e.source !== "quick" || !e.name?.trim()) return;
      const key = e.name.trim().toLowerCase();
      if (excluded.has(key)) return;
      const rec = byName[key] || { count: 0, lastDate: null, entry: null };
      rec.count += 1;
      if (!rec.lastDate || date > rec.lastDate) { rec.lastDate = date; rec.entry = e; }
      byName[key] = rec;
    });
  });
  return Object.values(byName)
    .filter((r) => r.count >= minOccurrences)
    .sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate))
    .slice(0, limit)
    .map((r) => ({
      name: r.entry.name, mealType: r.entry.meal || "any", occurrences: r.count,
      items: [{ foodId: r.entry.foodId || null, name: r.entry.name, qty: r.entry.qty, unit: r.entry.unit, macros: r.entry.macros }],
      macros: r.entry.macros,
    }));
}
