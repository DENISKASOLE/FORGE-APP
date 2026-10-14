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
export function planForDate(plans, dateISO) {
  return (plans || []).find((p) => p.status === "published" && p.from <= dateISO && (!p.to || p.to >= dateISO)) || null;
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
export function loggedDayTotals(dateLogEntries) { return sumMacros((dateLogEntries || []).map((e) => e.macros)); }

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
