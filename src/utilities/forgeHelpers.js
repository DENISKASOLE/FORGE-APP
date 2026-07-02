import { FOOD_DB } from "../data/foodDatabase.js";
import { SMART_FOOD_ALIAS } from "../data/smartFood.js";
import { CLIENT_COLORS, DAYS, DEFAULT_TIME_SLOTS, RPE_OPTIONS, PHOTO_TYPES, WATER_LITERS, SLEEP_HOURS, MEASUREMENT_FIELDS, TIMED_EXERCISES } from "../components/Common/constants.js";

export { CLIENT_COLORS, DAYS, DEFAULT_TIME_SLOTS, RPE_OPTIONS, PHOTO_TYPES, WATER_LITERS, SLEEP_HOURS, MEASUREMENT_FIELDS, TIMED_EXERCISES };

export function cleanFoodText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+.,/\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function foodTokens(value = "") {
  return cleanFoodText(value).split(/\s+/).filter((x) => x.length > 1 && !["with", "and", "plus", "the", "one", "cup", "plate", "bowl", "piece", "pieces", "small", "medium", "large"].includes(x));
}

export function bestFoodMatch(part = "") {
  const cleaned = cleanFoodText(part);
  if (!cleaned) return null;
  const aliasKey = Object.keys(SMART_FOOD_ALIAS).sort((a, b) => b.length - a.length).find((k) => cleaned.includes(k));
  if (aliasKey) return FOOD_DB.find((f) => f.name === SMART_FOOD_ALIAS[aliasKey]) || null;
  const partTokens = foodTokens(cleaned);
  let best = null;
  let bestScore = 0;
  FOOD_DB.forEach((item) => {
    const name = cleanFoodText(item.name);
    if (name.includes(cleaned) || cleaned.includes(name)) {
      best = item;
      bestScore = 999;
      return;
    }
    const itemTokens = foodTokens(item.name);
    const overlap = partTokens.filter((t) => itemTokens.includes(t)).length;
    const score = overlap * 3 - Math.abs(itemTokens.length - partTokens.length) * 0.2;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  });
  return bestScore >= 2 ? best : null;
}

export function amountMultiplier(part = "", matchedName = "") {
  const text = cleanFoodText(part);
  const qtyMatch = text.match(/^(\d+(?:\.\d+)?)/);
  let factor = qtyMatch ? Number(qtyMatch[1]) : 1;
  const grams = text.match(/(\d+(?:\.\d+)?)\s*g\b/);
  if (grams && /100g/i.test(matchedName)) factor = Number(grams[1]) / 100;
  if (grams && /200g/i.test(matchedName)) factor = Number(grams[1]) / 200;
  if (/half/.test(text)) factor *= 0.5;
  if (/large/.test(text)) factor *= 1.25;
  if (/small/.test(text)) factor *= 0.75;
  return Math.max(0.25, factor || 1);
}

export function estimateSmartFood(text = "") {
  const cleaned = cleanFoodText(text);
  const empty = { kcal: 0, protein: 0, carbs: 0, fats: 0, confidence: "Low", matches: [], unmatched: [], note: "Type foods like: 2 chapati + chicken curry + rice" };
  if (!cleaned) return empty;
  const parts = cleaned
    .split(/\s*(?:\+|,|\/| and | with | plus )\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  const total = { kcal: 0, protein: 0, carbs: 0, fats: 0, matches: [], unmatched: [] };
  parts.forEach((part) => {
    const match = bestFoodMatch(part);
    if (!match) {
      total.unmatched.push(part);
      return;
    }
    const factor = amountMultiplier(part, match.name);
    total.kcal += Number(match.kcal || 0) * factor;
    total.protein += Number(match.protein || 0) * factor;
    total.carbs += Number(match.carbs || 0) * factor;
    total.fats += Number(match.fats || 0) * factor;
    total.matches.push({ typed: part, matched: match.name, factor: Number(factor.toFixed(2)) });
  });
  const matchedCount = total.matches.length;
  const confidence = matchedCount === 0 ? "Low" : total.unmatched.length === 0 ? "High" : "Medium";
  return {
    kcal: Math.round(total.kcal),
    protein: Math.round(total.protein),
    carbs: Math.round(total.carbs),
    fats: Math.round(total.fats),
    confidence,
    matches: total.matches,
    unmatched: total.unmatched,
    note: confidence === "High" ? "Smart estimate ready." : "Review and edit the estimate before adding.",
  };
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function normalizeSlotLabel(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return raw.toUpperCase();
  const hour = Number(match[1]);
  const mins = match[2] || "00";
  const period = match[3] ? match[3].toUpperCase() : "";
  return `${hour}:${mins}${period ? ` ${period}` : ""}`;
}

export function timeKey(value = "") {
  return normalizeSlotLabel(value).toLowerCase().replace(/\s+/g, " ").trim();
}

export function normalizeSlots(raw) {
  const hasAmPm = Array.isArray(raw) && raw.some((s) => /\b(am|pm)\b/i.test(typeof s === "string" ? s : s?.label || s?.time || ""));
  const source = Array.isArray(raw) && raw.length && hasAmPm ? raw : DEFAULT_TIME_SLOTS;
  return source.map((s, i) => {
    const label = normalizeSlotLabel(typeof s === "string" ? s : s.label || s.time || String(s));
    return { id: typeof s === "object" && s.id ? s.id : `slot_${i}_${label}`, label };
  });
}

export function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isoDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

export function weekKey(date) {
  return isoDate(startOfWeek(date));
}

export function weekRangeLabel(start) {
  const a = new Date(start);
  const b = addDays(a, 6);
  return `${a.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${b.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

export function weekDays(start) {
  return DAYS.map((name, i) => {
    const date = addDays(start, i);
    return { name, date: isoDate(date), label: `${name} ${date.getDate()}` };
  });
}

export function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeProgramRecord(program, fallbackProgram = null) {
  const base = program && typeof program === "object" ? program : {};
  const id = base.id || fallbackProgram?.id || uid();
  return {
    ...base,
    id,
    savedAt: base.savedAt || fallbackProgram?.savedAt || new Date().toISOString(),
  };
}

export function initials(name = "") {
  return name.split(" ").filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "??";
}

export function getClientColor(id, index = 0) {
  const raw = String(id || index);
  const seed = raw.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return CLIENT_COLORS[(seed + index) % CLIENT_COLORS.length];
}

export function normalizeGoals(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
}

export function normalizeInjuries(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
}

export function timeLabel(t) {
  return normalizeSlotLabel(t).replace(/^0/, "");
}

export function moneyAED(n) {
  return `AED ${Number(n || 0).toLocaleString()}`;
}

export function makeInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function makeWeek(n, days) {
  return {
    weekNum: n,
    days: days.map((d) => ({
      ...d,
      date: "",
      sessionData: (d.exercises || []).map((ex) => ({
        name: ex.name,
        sets: Array.from({ length: Number(ex.numSets || 3) }, () => ({ weight: "", reps: "", rpe: "" })),
      })),
      metrics: { maxHR: "", avgHR: "", kcal: "" },
      notes: "",
    })),
  };
}

export function buildPeriodizationPlan(totalWeeks = 4, style = "Simple 4-Week Cycle", goal = "General Fitness") {
  const weeks = Math.max(1, Number(totalWeeks || 4));
  const simpleCycle = [
    { phase: "Base", focus: "Own the technique and leave reps in reserve.", rpe: "7", volume: "Normal volume" },
    { phase: "Build", focus: "Add reps or a small load increase where form is solid.", rpe: "7.5-8", volume: "Slightly higher challenge" },
    { phase: "Push", focus: "Work hard while keeping execution clean.", rpe: "8-9", volume: "Highest week" },
    { phase: "Deload", focus: "Reduce load or sets, recover, and prepare for the next cycle.", rpe: "6-7", volume: "Lower volume" },
  ];
  return Array.from({ length: weeks }, (_, i) => {
    if (style === "Linear Progression") {
      const step = Math.min(i, 3);
      return { week: i + 1, phase: step === 3 ? "Deload / Reset" : `Build ${i + 1}`, focus: step === 3 ? "Drop intensity and recover." : "Add small load or reps if last week was controlled.", rpe: step === 0 ? "7" : step === 1 ? "7.5-8" : "8-9", volume: step === 3 ? "Lower volume" : "Progressive overload" };
    }
    if (style === "Undulating") {
      const phases = [
        { phase: "Volume", focus: "More total reps and clean tempo.", rpe: "7-8", volume: "Higher reps" },
        { phase: "Strength", focus: "Heavier sets with controlled rest.", rpe: "8", volume: "Moderate reps" },
        { phase: "Conditioning", focus: "Density, finishers, and movement quality.", rpe: "7.5-8.5", volume: "Moderate/high density" },
        { phase: "Deload", focus: "Recover and sharpen technique.", rpe: "6-7", volume: "Lower volume" },
      ];
      return { week: i + 1, ...phases[i % 4] };
    }
    if (style === "Block Periodization") {
      const block = i < Math.floor(weeks / 2) ? { phase: "Accumulation", focus: "Build work capacity and movement skill.", rpe: "7-8", volume: "Higher volume" } : i === weeks - 1 ? { phase: "Test / Reset", focus: "Assess progress or prepare a new block.", rpe: "8-9", volume: "Lower exercise volume" } : { phase: "Intensification", focus: "Increase load and reduce junk volume.", rpe: "8-9", volume: "Moderate volume" };
      return { week: i + 1, ...block };
    }
    if (style === "Maintenance") {
      return { week: i + 1, phase: "Maintenance", focus: "Keep strength, consistency, and recovery stable.", rpe: "7-8", volume: "Moderate volume" };
    }
    return { week: i + 1, ...simpleCycle[i % 4] };
  }).map((w) => ({ ...w, goal }));
}

export function normalizePeriodizationPlan(totalWeeks = 4, style = "Simple 4-Week Cycle", goal = "General Fitness", existingPlan = []) {
  const base = buildPeriodizationPlan(totalWeeks, style, goal);
  const old = Array.isArray(existingPlan) ? existingPlan : [];
  return base.map((w, i) => ({ ...w, ...(old[i] || {}), week: i + 1, goal }));
}

export function applyPeriodization(program) {
  const totalWeeks = Number(program?.totalWeeks || 4);
  const style = program?.periodizationStyle || "Simple 4-Week Cycle";
  const goal = program?.trainingGoal || program?.goal || "General Fitness";
  return {
    ...program,
    totalWeeks,
    periodizationStyle: style,
    trainingGoal: goal,
    periodizationPlan: normalizePeriodizationPlan(totalWeeks, style, goal, program?.periodizationPlan),
  };
}

export function mergeProgramLogs(oldProgram, nextProgram) {
  const oldLogs = oldProgram?.weekLogs || [];
  const weeks = Number(nextProgram.totalWeeks || oldProgram?.totalWeeks || 4);
  const days = nextProgram.days || [];
  return Array.from({ length: weeks }, (_, wi) => {
    const oldWeek = oldLogs[wi] || {};
    return {
      weekNum: wi + 1,
      days: days.map((day, di) => {
        const oldDay = oldWeek.days?.[di] || {};
        const oldByName = new Map((oldDay.sessionData || []).map((ex) => [String(ex.name || "").toLowerCase(), ex]));
        return {
          ...oldDay,
          name: day.name,
          exercises: day.exercises || [],
          sessionData: (day.exercises || []).map((ex) => {
            const existing = oldByName.get(String(ex.name || "").toLowerCase());
            if (existing) return { ...existing, name: ex.name, prescribed: ex };
            return { name: ex.name, prescribed: ex, sets: Array.from({ length: Number(ex.numSets || 3) }, () => ({ weight: "", reps: "", duration: "", rpe: "", substitute: "" })) };
          }),
          metrics: oldDay.metrics || { maxHR: "", avgHR: "", kcal: "" },
          notes: oldDay.notes || "",
          date: oldDay.date || "",
        };
      }),
    };
  });
}

export function normalizeProgramWeeks(program, weeksOverride) {
  const totalWeeks = Math.max(1, Number(weeksOverride || program?.totalWeeks || 4));
  const periodized = applyPeriodization({ ...program, totalWeeks });
  return { ...periodized, weekLogs: mergeProgramLogs(program, periodized) };
}

export function loadLocalTemplates() {
  try { return JSON.parse(localStorage.getItem("forge_program_templates") || "[]"); }
  catch { return []; }
}

export function saveLocalTemplates(templates) {
  localStorage.setItem("forge_program_templates", JSON.stringify(templates || []));
}

export function allProgramTemplates(PROGRAM_TEMPLATES) {
  const custom = loadLocalTemplates();
  const byKey = new Map(PROGRAM_TEMPLATES.map((t) => [t.key, { ...t, custom: false }]));
  custom.forEach((t) => byKey.set(t.key, { ...t, custom: true }));
  return Array.from(byKey.values());
}

export function templateWeekCount(t) {
  return Math.max(1, Number(t?.totalWeeks || 4));
}

export function isTimedExercise(name = "") {
  const n = String(name).toLowerCase();
  return TIMED_EXERCISES.some((x) => n.includes(x));
}
