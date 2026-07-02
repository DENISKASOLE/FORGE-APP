

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { FOOD_DB } from "./data/foodDatabase.js";
import { EXERCISE_LIBRARY } from "./data/exercises";
import { BRAND, GOAL_OPTIONS, CLIENT_COLORS, LIFT_FIELDS, DEFAULT_TIME_SLOTS, DAYS, RPE_OPTIONS, PHOTO_TYPES, WATER_LITERS, SLEEP_HOURS, MEASUREMENT_FIELDS, TIMED_EXERCISES } from "./components/Common/constants.js";
import { textareaStyle, inputStyle, Button, Field, Card } from "./components/Common/ui.js";
import { cleanFoodText, foodTokens, bestFoodMatch, amountMultiplier, estimateSmartFood, readFileAsDataUrl, normalizeSlotLabel, timeKey, normalizeSlots, startOfWeek, addDays, isoDate, weekKey, weekRangeLabel, weekDays, uid, normalizeProgramRecord, initials, getClientColor, normalizeGoals, normalizeInjuries, timeLabel, moneyAED, makeInviteCode, makeWeek, buildPeriodizationPlan, normalizePeriodizationPlan, applyPeriodization, mergeProgramLogs, normalizeProgramWeeks, loadLocalTemplates, saveLocalTemplates, allProgramTemplates, templateWeekCount, isTimedExercise } from "./utilities/forgeHelpers.js";
 
/*
  FORGE V6.7 - Tablet Coach UI + Client Program Label Polish
  ------------------------------------------------
  What this version includes:
  - One clean login screen: "Welcome back"
  - Seamless trainer account creation
  - Forgot password via Supabase Auth
  - Coach dashboard: each trainer sees only their own clients
  - Denis keeps existing unassigned clients if logged in with kendenisdubai@gmail.com
  - Invite-based client access: coach creates profile first, client claims it with invite code
  - Client portal: food log, workout log, progress photos, profile view
  - Program builder restored to previous week/day style with a simpler two-action workflow
  - Program day has small X button to delete whole day
  - Trials split into Consultation and Fitness Assessment
  - Calendar has editable visible time slots and auto-scheduled recurring clients
  - AED currency and simple number time labels
  - Dead Hang added to exercise library and progress tracking
  - Fast resume from local cache instead of showing Forge loading every time
  - Offline-first client/program/nutrition/session saves with pending sync queue
  - Program session view shows Personal Best, Recent, and New entry area for each exercise
  - Metric Data returned to each program day: kcal, max HR, average HR
  - Client tabs are round pill tabs for a cleaner mobile feel
  - Program templates remain available internally for starting from a template inside the builder
  - V6.1: true phone-first client portal across Home, Nutrition, Program, Progress, Photos, Profile
  - V6.1: tablet-friendly coach dashboard with cleaner cards and compact layout
  - V6.1: fixed mobile viewport so the app does not render as a wide desktop page on phones
  - V6.5: smart custom food macro estimator for combined meals like chapati + chicken curry + rice
  - V6.5: spreadsheet-style calendar zoom slider with Fit Week view
*/
 
const FORGE_CACHE_PREFIX = "forge_v47_cache_";
const FORGE_SYNC_QUEUE_KEY = "forge_v47_pending_sync";
 
function cacheKey(userId) {
  return `${FORGE_CACHE_PREFIX}${userId || "guest"}`;
}
 
function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}
 
function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {}
}
 
function saveForgeCache(userId, snapshot) {
  if (!userId) return;
  writeJson(cacheKey(userId), { ...snapshot, savedAt: new Date().toISOString() });
}
 
function readForgeCache(userId) {
  if (!userId) return null;
  return readJson(cacheKey(userId), null);
}
 
function enqueueSync(item) {
  const queue = readJson(FORGE_SYNC_QUEUE_KEY, []);
  queue.push({ id: uid(), createdAt: new Date().toISOString(), ...item });
  writeJson(FORGE_SYNC_QUEUE_KEY, queue);
}
 
async function flushSyncQueue() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const queue = readJson(FORGE_SYNC_QUEUE_KEY, []);
  if (!queue.length) return;
  const remaining = [];
  for (const item of queue) {
    try {
      if (item.type === "client_data") {
        const { error } = await supabase.from("client_data").upsert(
          { client_id: item.clientId, section: item.section, data: item.data },
          { onConflict: "client_id,section" }
        );
        if (error) throw error;
      }
      if (item.type === "trainer_data") {
        const { error } = await supabase.from("trainer_data").upsert(
          { trainer_id: item.trainerId, section: item.section, data: item.data },
          { onConflict: "trainer_id,section" }
        );
        if (error) throw error;
      }
    } catch (e) {
      remaining.push(item);
    }
  }
  writeJson(FORGE_SYNC_QUEUE_KEY, remaining);
}
const DENIS_EMAIL = "kendenisdubai@gmail.com";
 
function ensureMobileViewport() {
  if (typeof document === "undefined") return;
  let meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "viewport");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover");
  document.documentElement.style.maxWidth = "100%";
  document.body.style.maxWidth = "100%";
  document.body.style.overflowX = "hidden";
}
 
function useIsMobile(breakpoint = 760) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" ? window.innerWidth <= breakpoint : false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}
 
function useExerciseLibrary() {
  const [library, setLibrary] = useState(EXERCISE_LIBRARY);
  useEffect(() => {
    let active = true;
    async function loadExercises() {
      try {
        const { data, error } = await supabase
          .from("exercise_library")
          .select("name")
          .order("name", { ascending: true });
        if (!active) return;
        if (!error && Array.isArray(data) && data.length) {
          const dbNames = data.map((r) => r?.name).filter(Boolean);
          const merged = Array.from(new Set([...dbNames, ...EXERCISE_LIBRARY])).sort((a, b) => a.localeCompare(b));
          setLibrary(merged);
        }
      } catch (_) {
        // If the exercise_library table does not exist, Forge uses the built-in library.
      }
    }
    loadExercises();
    return () => { active = false; };
  }, []);
  return library;
}
const PERIODIZATION_STYLES = [
  "Simple 4-Week Cycle",
  "Linear Progression",
  "Undulating",
  "Block Periodization",
  "Maintenance",
];
 
const PROGRAM_TEMPLATES = [
  {
    key: "mens_fat_loss",
    name: "Men's Fat Loss",
    goal: "Fat Loss",
    description: "Strength supersets + conditioning finishers for male fat-loss clients.",
    totalWeeks: 4,
    days: [
      { name: "Day 1 - Lower Strength + Sweat", exercises: [
        { name: "Goblet Squat", numSets: 4, reps: "10-12", weight: "" },
        { name: "Leg Press", numSets: 3, reps: "12-15", weight: "" },
        { name: "Romanian Deadlift", numSets: 3, reps: "10-12", weight: "" },
        { name: "Sled Push", numSets: 6, reps: "20-30m", weight: "" },
        { name: "Plank", numSets: 3, reps: "30-45 sec", weight: "" },
      ]},
      { name: "Day 2 - Upper Burn", exercises: [
        { name: "Flat Barbell Bench Press", numSets: 4, reps: "8-10", weight: "" },
        { name: "Neutral Grip Lat Pulldown", numSets: 4, reps: "10-12", weight: "" },
        { name: "Seated Cable Row", numSets: 3, reps: "12", weight: "" },
        { name: "DB Shoulder Press", numSets: 3, reps: "10-12", weight: "" },
        { name: "Battle Ropes", numSets: 6, reps: "30 sec", weight: "" },
      ]},
      { name: "Day 3 - Full Body Conditioning", exercises: [
        { name: "Trap Bar Deadlift", numSets: 4, reps: "6-8", weight: "" },
        { name: "Incline DB Chest Press", numSets: 3, reps: "10-12", weight: "" },
        { name: "Walking Lunge", numSets: 3, reps: "12 each", weight: "" },
        { name: "Farmer's Carry", numSets: 4, reps: "30-40m", weight: "" },
        { name: "Assault Bike", numSets: 8, reps: "20 sec hard", weight: "" },
      ]},
    ],
  },
  {
    key: "female_fat_loss",
    name: "Female Fat Loss",
    goal: "Fat Loss",
    description: "Glute/leg emphasis, posture, core, and conditioning.",
    totalWeeks: 4,
    days: [
      { name: "Day 1 - Glutes + Lower", exercises: [
        { name: "Hip Thrust", numSets: 4, reps: "10-12", weight: "" },
        { name: "Leg Press", numSets: 4, reps: "12-15", weight: "" },
        { name: "Bulgarian Split Squat", numSets: 3, reps: "10 each", weight: "" },
        { name: "Cable Glute Kickback", numSets: 3, reps: "12-15", weight: "" },
        { name: "Dead Bug", numSets: 3, reps: "10 each", weight: "" },
      ]},
      { name: "Day 2 - Upper + Core", exercises: [
        { name: "Incline DB Chest Press", numSets: 3, reps: "10-12", weight: "" },
        { name: "Neutral Grip Lat Pulldown", numSets: 4, reps: "10-12", weight: "" },
        { name: "Seated Cable Row", numSets: 3, reps: "12", weight: "" },
        { name: "DB Lateral Raises", numSets: 3, reps: "12-15", weight: "" },
        { name: "Pallof Press", numSets: 3, reps: "10 each", weight: "" },
      ]},
      { name: "Day 3 - Lower + Conditioning", exercises: [
        { name: "Goblet Squat", numSets: 4, reps: "10-12", weight: "" },
        { name: "Lying Leg Curl", numSets: 3, reps: "12-15", weight: "" },
        { name: "Step Up", numSets: 3, reps: "10 each", weight: "" },
        { name: "Stair Climber", numSets: 1, reps: "10-15 min", weight: "" },
        { name: "Side Plank", numSets: 3, reps: "25-40 sec", weight: "" },
      ]},
    ],
  },
  {
    key: "muscle_gain",
    name: "Muscle Gain",
    goal: "Muscle Gain",
    description: "Hypertrophy-focused full-body/PPL hybrid.",
    totalWeeks: 4,
    days: [
      { name: "Day 1 - Push Hypertrophy", exercises: [
        { name: "Flat Barbell Bench Press", numSets: 4, reps: "6-8", weight: "" },
        { name: "Incline DB Chest Press", numSets: 4, reps: "8-10", weight: "" },
        { name: "DB Shoulder Press", numSets: 3, reps: "8-10", weight: "" },
        { name: "Cable Lateral Raises", numSets: 4, reps: "12-15", weight: "" },
        { name: "Tricep Pushdown", numSets: 3, reps: "10-12", weight: "" },
      ]},
      { name: "Day 2 - Pull Hypertrophy", exercises: [
        { name: "Pull-Up", numSets: 4, reps: "6-10", weight: "" },
        { name: "Chest-Supported Row", numSets: 4, reps: "8-10", weight: "" },
        { name: "Neutral Grip Lat Pulldown", numSets: 3, reps: "10-12", weight: "" },
        { name: "Face Pull", numSets: 3, reps: "12-15", weight: "" },
        { name: "Hammer Curl", numSets: 3, reps: "10-12", weight: "" },
      ]},
      { name: "Day 3 - Legs Hypertrophy", exercises: [
        { name: "Squat", numSets: 4, reps: "6-8", weight: "" },
        { name: "Leg Press", numSets: 4, reps: "10-12", weight: "" },
        { name: "Romanian Deadlift", numSets: 3, reps: "8-10", weight: "" },
        { name: "Leg Extension", numSets: 3, reps: "12-15", weight: "" },
        { name: "Standing Calf Raise", numSets: 4, reps: "12-15", weight: "" },
      ]},
    ],
  },
  {
    key: "upper_lower",
    name: "Upper Lower",
    goal: "Strength + Muscle Gain",
    description: "Four-day upper/lower split for strength and physique.",
    totalWeeks: 4,
    days: [
      { name: "Day 1 - Upper Strength", exercises: [
        { name: "Flat Barbell Bench Press", numSets: 4, reps: "4-6", weight: "" },
        { name: "Pull-Up", numSets: 4, reps: "5-8", weight: "" },
        { name: "Overhead Press", numSets: 3, reps: "5-6", weight: "" },
        { name: "Seated Cable Row", numSets: 3, reps: "8-10", weight: "" },
        { name: "Dead Hang", numSets: 3, reps: "30-60 sec", weight: "" },
      ]},
      { name: "Day 2 - Lower Strength", exercises: [
        { name: "Squat", numSets: 4, reps: "4-6", weight: "" },
        { name: "Romanian Deadlift", numSets: 4, reps: "6-8", weight: "" },
        { name: "Leg Press", numSets: 3, reps: "8-10", weight: "" },
        { name: "Lying Leg Curl", numSets: 3, reps: "10-12", weight: "" },
        { name: "Plank", numSets: 3, reps: "45-60 sec", weight: "" },
      ]},
      { name: "Day 3 - Upper Hypertrophy", exercises: [
        { name: "Incline DB Chest Press", numSets: 4, reps: "8-10", weight: "" },
        { name: "Neutral Grip Lat Pulldown", numSets: 4, reps: "10-12", weight: "" },
        { name: "DB Lateral Raises", numSets: 4, reps: "12-15", weight: "" },
        { name: "Face Pull", numSets: 3, reps: "12-15", weight: "" },
        { name: "EZ Bar Curl", numSets: 3, reps: "10-12", weight: "" },
      ]},
      { name: "Day 4 - Lower Hypertrophy", exercises: [
        { name: "Hack Squat", numSets: 4, reps: "8-10", weight: "" },
        { name: "Hip Thrust", numSets: 4, reps: "8-12", weight: "" },
        { name: "Bulgarian Split Squat", numSets: 3, reps: "10 each", weight: "" },
        { name: "Leg Extension", numSets: 3, reps: "12-15", weight: "" },
        { name: "Seated Calf Raise", numSets: 4, reps: "12-15", weight: "" },
      ]},
    ],
  },
  {
    key: "ppl",
    name: "PPL",
    goal: "Muscle Gain",
    description: "Classic Push/Pull/Legs structure.",
    totalWeeks: 4,
    days: [
      { name: "Day 1 - Push", exercises: [
        { name: "Flat Barbell Bench Press", numSets: 4, reps: "6-8", weight: "" },
        { name: "Incline DB Chest Press", numSets: 3, reps: "8-10", weight: "" },
        { name: "Overhead Press", numSets: 3, reps: "6-8", weight: "" },
        { name: "DB Lateral Raises", numSets: 4, reps: "12-15", weight: "" },
        { name: "Tricep Pushdown", numSets: 3, reps: "10-12", weight: "" },
      ]},
      { name: "Day 2 - Pull", exercises: [
        { name: "Pull-Up", numSets: 4, reps: "6-10", weight: "" },
        { name: "Barbell Row", numSets: 4, reps: "6-8", weight: "" },
        { name: "Neutral Grip Lat Pulldown", numSets: 3, reps: "10-12", weight: "" },
        { name: "Face Pull", numSets: 3, reps: "12-15", weight: "" },
        { name: "Bicep Curl", numSets: 3, reps: "10-12", weight: "" },
      ]},
      { name: "Day 3 - Legs", exercises: [
        { name: "Squat", numSets: 4, reps: "6-8", weight: "" },
        { name: "Leg Press", numSets: 4, reps: "10-12", weight: "" },
        { name: "Romanian Deadlift", numSets: 3, reps: "8-10", weight: "" },
        { name: "Leg Extension", numSets: 3, reps: "12-15", weight: "" },
        { name: "Standing Calf Raise", numSets: 4, reps: "12-15", weight: "" },
      ]},
    ],
  },
];
 
function cloneTemplateProgram(template, client, weeksOverride = null) {
  const safeDays = (template.days || []).map((day) => ({
    ...day,
    exercises: (day.exercises || []).map((ex) => ({ ...ex })),
  }));
  const totalWeeks = Math.max(1, Number(weeksOverride || template.totalWeeks || 4));
  const program = {
    id: uid(),
    name: `DENIS's Program`,
    templateKey: template.key,
    templateName: template.name,
    totalWeeks,
    days: safeDays,
    trainingGoal: template.goal || client.goal || "General Fitness",
    periodizationStyle: template.periodizationStyle || "Simple 4-Week Cycle",
  };
  const periodized = applyPeriodization(program);
  return {
    ...periodized,
    weekLogs: Array.from({ length: Number(periodized.totalWeeks || 4) }, (_, i) => makeWeek(i + 1, periodized.days)),
  };
}
 
function emptyProfile() {
  return {
    goals: [],
    birthday: "",
    injuries: "",
    medicalIssues: "",
    barriers: "",
    sleep: "",
    neat: "",
    workSchedule: "",
    vegetarianStatus: "non-vegetarian",
    allergies: "",
    lactoseIntolerant: false,
    glutenIntolerant: false,
    notes: "",
    photo: "",
    measurements: {},
  };
}

function normalizeClientType(value) {
  const raw = String(value || "").trim().toLowerCase();
  return raw === "online" ? "online" : "in_person";
}

function clientTypeLabel(value) {
  return normalizeClientType(value) === "online" ? "Online" : "In-Person";
}
 
function emptyNutrition() {
  return {
    targets: { calories: "", protein: "", carbs: "", fats: "", steps: 10000, water: 3, sleep: 7 },
    mealPlan: { Breakfast: "", Lunch: "", Dinner: "" },
    planNotes: "",
    logs: [],
    daily: {},
  };
}
 
function mapClient(row, dataRows = [], index = 0) {
  const sections = {};
  dataRows.forEach((r) => {
    if (r.client_id === row.id) sections[r.section] = r.data || {};
  });
  const profile = { ...emptyProfile(), ...(sections.profile || {}) };
  profile.goals = normalizeGoals(profile.goals?.length ? profile.goals : row.goal);
  if (!profile.injuries && row.injuries) profile.injuries = normalizeInjuries(row.injuries).join("\n");
  return {
    id: row.id,
    trainer_id: row.trainer_id,
    client_user_id: row.client_user_id || null,
    name: row.name || "Unnamed Client",
    email: row.email || "",
    phone: row.phone || "",
    age: row.age || "",
    weight: row.weight_kg || row.weight || "",
    joinDate: row.created_at ? row.created_at.split("T")[0] : new Date().toISOString().slice(0, 10),
    inviteCode: row.invite_code || "",
    inviteStatus: row.invite_status || "not_sent",
    goals: profile.goals,
    goal: profile.goals?.[0] || row.goal || "General Fitness",
    profile,
    clientType: normalizeClientType(row.clientType || row.client_type || row.type || "in_person"),
    color: row.color || profile.color || getClientColor(row.id, index),
    photo: profile.photo || row.photo || "",
    avatar: initials(row.name),
    packages: sections.packages || row.packages || [],
    program: sections.program || row.program || null,
    nutrition: { ...emptyNutrition(), ...(sections.nutrition || {}) },
    transformPhotos: sections.transformPhotos || [],
    progress: sections.progress?.progress || row.progress || [],
    measurements: sections.progress?.measurements || row.measurements || {},
    schedule: sections.sessions?.schedule || row.schedule || [],
    checkIns: sections.sessions?.checkIns || row.checkIns || [],
    sessions: sections.sessions?.sessions || row.sessions_conducted || 0,
    workoutLogs: sections.workoutLogs || [],
    notes: profile.notes || row.notes || "",
  };
}
 
async function upsertSection(clientId, section, data) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    enqueueSync({ type: "client_data", clientId, section, data });
    return { queued: true };
  }
  try {
    const { error } = await supabase.from("client_data").upsert(
      { client_id: clientId, section, data },
      { onConflict: "client_id,section" }
    );
    if (error) throw error;
    await flushSyncQueue();
    return { queued: false };
  } catch (error) {
    enqueueSync({ type: "client_data", clientId, section, data });
    return { queued: true, error };
  }
}
 
async function upsertTrainerData(trainerId, section, data) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    enqueueSync({ type: "trainer_data", trainerId, section, data });
    return { queued: true };
  }
  try {
    const { error } = await supabase.from("trainer_data").upsert(
      { trainer_id: trainerId, section, data },
      { onConflict: "trainer_id,section" }
    );
    if (error) throw error;
    await flushSyncQueue();
    return { queued: false };
  } catch (error) {
    enqueueSync({ type: "trainer_data", trainerId, section, data });
    return { queued: true, error };
  }
}
 
async function safeSelect(table, queryBuilder) {
  try {
    const res = await queryBuilder(supabase.from(table));
    return res;
  } catch (e) {
    return { data: null, error: e };
  }
}
 
function aiFoodSuggestions(client) {
  const profile = client.profile || emptyProfile();
  const target = client.nutrition?.targets || {};
  const vegetarian = profile.vegetarianStatus === "vegetarian" || profile.vegetarianStatus === "vegan";
  const lactose = !!profile.lactoseIntolerant;
  const gluten = !!profile.glutenIntolerant;
  const allergies = String(profile.allergies || "").toLowerCase();
 
  const foods = FOOD_DB.filter((f) => {
    if (vegetarian && !f.tags.includes("vegetarian") && !f.tags.includes("vegan")) return false;
    if (profile.vegetarianStatus === "vegan" && !f.tags.includes("vegan")) return false;
    if (lactose && !f.tags.includes("lactose-free")) return false;
    if (gluten && !f.tags.includes("gluten-free")) return false;
    if (allergies && allergies.split(/[,;]+/).some((a) => a.trim() && f.name.toLowerCase().includes(a.trim()))) return false;
    return true;
  });
 
  const highProtein = foods.filter((f) => f.protein >= 15).slice(0, 4).map((f) => f.name).join(", ");
  const carbs = foods.filter((f) => f.carbs >= 20).slice(0, 4).map((f) => f.name).join(", ");
  const calories = Number(target.calories || 0);
  const protein = Number(target.protein || 0);
  const base = [];
  if (protein) base.push(`Protein target is ${protein}g. Build each meal around: ${highProtein || "lean protein source"}.`);
  if (calories) base.push(`Calories target is ${calories}. Divide it across breakfast, lunch, and dinner so you do not overload one meal.`);
  base.push(`Good carb options: ${carbs || "rice, potatoes, oats, fruits"}.`);
  if (profile.lactoseIntolerant) base.push("Avoid milk/yogurt/whey unless lactose-free.");
  if (profile.glutenIntolerant) base.push("Avoid chapati, bread, and pasta unless gluten-free.");
  return base.join(" ");
}
 
function aiProgression(program, client) {
  if (!program?.weekLogs?.length) return "Log at least one workout first. Then Forge can recommend progression.";
  const logs = program.weekLogs.flatMap((w) => w.days || []);
  const done = logs.filter((d) => d.date || d.sessionData?.some((e) => e.sets?.some((s) => s.weight || s.reps)));
  if (!done.length) return "No completed sessions yet. Start logging sets, reps, and RPE.";
  const last = done[done.length - 1];
  const easySets = last.sessionData?.flatMap((e) => e.sets?.map((s) => ({ ex: e.name, ...s })) || []).filter((s) => Number(s.rpe || 0) && Number(s.rpe) <= 7) || [];
  if (easySets.length >= 3) return "Last session looked controlled. Add 2.5kg on upper-body lifts or 5kg on lower-body lifts next time, while keeping form clean.";
  return "Keep the same weight next time and aim for better reps, cleaner tempo, or lower RPE before increasing load.";
}
 
function numberFromText(value) {
  const match = String(value || "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}
 
function formatSetPerformance(set, timed) {
  if (!set) return "-";
  if (timed) {
    const dur = set.duration || set.reps || "";
    const load = set.weight ? `${set.weight}kg · ` : "";
    return dur ? `${load}${dur}` : "-";
  }
  const load = set.weight ? `${set.weight}kg` : "";
  const reps = set.reps ? `${set.reps} reps` : "";
  return [load, reps].filter(Boolean).join(" × ") || "-";
}
 
function setScore(set, timed) {
  if (!set) return 0;
  if (timed) return numberFromText(set.duration || set.reps);
  const weight = numberFromText(set.weight);
  const reps = numberFromText(set.reps);
  if (weight && reps) return weight * reps;
  return weight || reps;
}
 
function getExerciseHistory(program, exerciseName) {
  const timed = isTimedExercise(exerciseName);
  const rows = [];
  (program?.weekLogs || []).forEach((week, wi) => {
    (week.days || []).forEach((day, di) => {
      (day.sessionData || []).forEach((ex) => {
        if (String(ex.name || "").toLowerCase() !== String(exerciseName || "").toLowerCase()) return;
        (ex.sets || []).forEach((set, si) => {
          const score = setScore(set, timed);
          if (score > 0) rows.push({ score, set, week: wi + 1, day: day.name || `Day ${di + 1}`, setNum: si + 1, date: day.date || "" });
        });
      });
    });
  });
  const best = rows.length ? rows.reduce((a, b) => (b.score > a.score ? b : a), rows[0]) : null;
  const recent = rows.length ? rows[rows.length - 1] : null;
  return {
    timed,
    best: best ? `${formatSetPerformance(best.set, timed)} · W${best.week} ${best.day}` : "No PB yet",
    recent: recent ? `${formatSetPerformance(recent.set, timed)} · W${recent.week} ${recent.day}` : "No recent log",
  };
}
 
function LoginScreen({ onReady }) {
  const isMobile = useIsMobile(760);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
 
  async function login() {
    setLoading(true); setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
    else onReady?.();
    setLoading(false);
  }
 
  async function createTrainer() {
    setLoading(true); setMsg("");
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, role: "coach" } } });
    if (error) setMsg(error.message);
    else {
      const user = data.user;
      if (user) await supabase.from("trainers").upsert({ id: user.id, name: name || email.split("@")[0], email, role: "Coach" });
      setMsg("Account created. Check email if confirmation is required, then log in.");
      setMode("login");
    }
    setLoading(false);
  }
 
  async function acceptInvite() {
    setLoading(true); setMsg("");
    const code = inviteCode.trim().toUpperCase();
    const { data: found, error: findErr } = await supabase.from("clients").select("*").eq("invite_code", code).maybeSingle();
    if (findErr || !found) { setMsg("Invite code not found."); setLoading(false); return; }
    const { data, error } = await supabase.auth.signUp({ email: found.email || email, password, options: { data: { name: found.name, role: "client" } } });
    if (error) { setMsg(error.message); setLoading(false); return; }
    if (data.user) {
      await supabase.from("clients").update({ client_user_id: data.user.id, invite_status: "accepted", email: found.email || email }).eq("id", found.id);
      setMsg("Client account connected. Log in with the password you created.");
      setMode("login");
    }
    setLoading(false);
  }
 
  async function forgotPassword() {
    setLoading(true); setMsg("");
    const redirectTo = window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setMsg(error ? error.message : "Password reset link sent to your email.");
    setLoading(false);
  }
 
  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(circle at 20% 10%, ${BRAND.gold}22, transparent 30%), ${BRAND.bg}`, color: BRAND.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <Card style={{ width: "100%", maxWidth: 430, padding: 26 }}>
        <div style={{ fontSize: isMobile ? 30 : 42, fontWeight: 900, letterSpacing: 1 }}>FORGE</div>
        <div style={{ fontSize: 25, fontWeight: 900, marginTop: 10 }}>Welcome back</div>
        <div style={{ color: BRAND.muted, marginBottom: 22 }}>Log in to continue your coaching system.</div>
        {mode !== "login" && <Field label="Name" value={name} onChange={setName} placeholder="Your name" />}
        <div style={{ height: 10 }} />
        <Field label="Email" value={email} onChange={setEmail} placeholder="you@email.com" />
        <div style={{ height: 10 }} />
        <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="Password" />
        {mode === "invite" && <><div style={{ height: 10 }} /><Field label="Invite Code" value={inviteCode} onChange={setInviteCode} placeholder="ABC123" /></>}
        {msg && <div style={{ marginTop: 12, color: msg.includes("sent") || msg.includes("created") || msg.includes("connected") ? BRAND.green : BRAND.red, fontSize: 13 }}>{msg}</div>}
        <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
          {mode === "login" && <Button disabled={loading} onClick={login}>Log in</Button>}
          {mode === "trainer" && <Button disabled={loading} onClick={createTrainer}>Create coach account</Button>}
          {mode === "invite" && <Button disabled={loading} onClick={acceptInvite}>Accept invite</Button>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          <Button variant="ghost" onClick={() => setMode("login")} style={{ flex: 1 }}>Login</Button>
          <Button variant="ghost" onClick={() => setMode("trainer")} style={{ flex: 1 }}>Create coach</Button>
          <Button variant="ghost" onClick={() => setMode("invite")} style={{ flex: 1 }}>Accept invite</Button>
        </div>
        <button onClick={forgotPassword} style={{ marginTop: 14, background: "transparent", border: "none", color: BRAND.gold, cursor: "pointer", padding: 0 }}>Forgot password?</button>
      </Card>
    </div>
  );
}
 
function AddClientModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", age: "", weight: "", color: CLIENT_COLORS[0], clientType: "in_person", profile: emptyProfile() });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const setProfile = (k, v) => setForm((f) => ({ ...f, profile: { ...f.profile, [k]: v } }));
  const toggleGoal = (g) => setProfile("goals", form.profile.goals.includes(g) ? form.profile.goals.filter((x) => x !== g) : [...form.profile.goals, g]);
  async function pickPhoto(file) {
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setProfile("photo", dataUrl);
  }
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 780, maxHeight: "92vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div><div style={{ fontSize: 24, fontWeight: 900 }}>Add New Client</div><div style={{ color: BRAND.muted }}>Create the profile first. Invite the client later.</div></div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
          <div style={{ width: 72, height: 72, borderRadius: 22, background: form.color, overflow: "hidden", display: "grid", placeItems: "center", color: "#000", fontWeight: 1000 }}>{form.profile.photo ? <img src={form.profile.photo} alt="client" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(form.name)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>CLIENT PHOTO</div>
            <input type="file" accept="image/*" onChange={(e) => pickPhoto(e.target.files?.[0])} style={inputStyle()} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
          <Field label="Client name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <label>
            <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 }}>Client type</div>
            <select value={form.clientType} onChange={(e) => setForm({ ...form, clientType: e.target.value })} style={inputStyle()}>
              <option value="in_person">In-Person Client</option>
              <option value="online">Online Client</option>
            </select>
          </label>
          <Field label="Age" value={form.age} onChange={(v) => setForm({ ...form, age: v })} type="number" />
          <Field label="Birthday" value={form.profile.birthday} onChange={(v) => setProfile("birthday", v)} type="date" />
          <Field label="Weight kg" value={form.weight} onChange={(v) => setForm({ ...form, weight: v })} type="number" />
        </div>
        <div style={{ marginTop: 14 }}>
          <Button variant="dark" onClick={() => setShowColorPicker((v) => !v)}>{showColorPicker ? "Hide client color" : "Change client color"}</Button>
          {showColorPicker && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>{CLIENT_COLORS.map((c) => <button key={c} onClick={() => setForm({ ...form, color: c, profile: { ...form.profile, color: c } })} style={{ width: 34, height: 34, borderRadius: 12, border: form.color === c ? `3px solid ${BRAND.text}` : `1px solid ${BRAND.line}`, background: c, cursor: "pointer" }} />)}</div>}
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: BRAND.muted, fontWeight: 900, marginBottom: 8 }}>GOALS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{GOAL_OPTIONS.map((g) => <button key={g} onClick={() => toggleGoal(g)} style={{ border: `1px solid ${form.profile.goals.includes(g) ? BRAND.gold : BRAND.line}`, background: form.profile.goals.includes(g) ? BRAND.gold : BRAND.card2, color: form.profile.goals.includes(g) ? "#000" : BRAND.text, borderRadius: 20, padding: "7px 11px", fontWeight: 800 }}>{String(g).toUpperCase()}</button>)}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12, marginTop: 14 }}>
          <Field label="Injuries" value={form.profile.injuries} onChange={(v) => setProfile("injuries", v)} textarea />
          <Field label="Medical issues" value={form.profile.medicalIssues} onChange={(v) => setProfile("medicalIssues", v)} textarea />
          <Field label="Barriers" value={form.profile.barriers} onChange={(v) => setProfile("barriers", v)} textarea />
          <Field label="Sleep" value={form.profile.sleep} onChange={(v) => setProfile("sleep", v)} textarea />
          <Field label="NEAT / Daily Activity" value={form.profile.neat} onChange={(v) => setProfile("neat", v)} textarea />
          <Field label="Work Schedule" value={form.profile.workSchedule} onChange={(v) => setProfile("workSchedule", v)} textarea />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <Button onClick={() => { if (!form.clientType) { alert("Choose a client type first."); return; } onCreate(form); }} style={{ flex: 1 }}>Create client</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </Card>
    </div>
  );
}
function modalBackdrop() {
  const isTabletLike = typeof window !== "undefined" && window.innerWidth >= 768;
  return { position: "fixed", inset: 0, background: "rgba(0,0,0,.86)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: isTabletLike ? 24 : 16 };
}
 
function CoachSettingsModal({ user, trainer, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: trainer?.name || user?.user_metadata?.name || user?.email?.split("@")[0] || "",
    email: trainer?.email || user?.email || "",
    phone: trainer?.phone || "",
    photo: trainer?.photo || "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  async function pickPhoto(file) {
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    set("photo", dataUrl);
  }
  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const emailChanged = form.email && form.email !== user.email;
      if (emailChanged) {
        const { error: authErr } = await supabase.auth.updateUser({ email: form.email });
        if (authErr) throw authErr;
      }
      const payload = {
        id: user.id,
        name: form.name || user.email?.split("@")[0] || "Coach",
        email: form.email || user.email || "",
        phone: form.phone || "",
        photo: form.photo || "",
        role: "Coach",
      };
      const { error } = await supabase.from("trainers").upsert(payload, { onConflict: "id" });
      if (error) throw error;
      onSaved?.(payload);
      setMessage(emailChanged ? "Saved. Check your email to confirm the new login email." : "Settings saved.");
    } catch (e) {
      alert(e.message || "Could not save coach settings");
    }
    setSaving(false);
  }
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 560 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 1000 }}>Coach Settings</div>
            <div style={{ color: BRAND.muted }}>Edit your profile shown inside Forge.</div>
          </div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
          <div style={{ width: 84, height: 84, borderRadius: 24, background: BRAND.card2, border: `1px solid ${BRAND.line}`, overflow: "hidden", display: "grid", placeItems: "center", color: BRAND.gold, fontWeight: 1000 }}>
            {form.photo ? <img src={form.photo} alt="Coach" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(form.name)}
          </div>
          <label style={{ flex: 1 }}>
            <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>PROFILE PHOTO</div>
            <input type="file" accept="image/*" onChange={(e) => pickPhoto(e.target.files?.[0])} style={inputStyle()} />
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          <Field label="Coach name" value={form.name} onChange={(v) => set("name", v)} />
          <Field label="Email" value={form.email} onChange={(v) => set("email", v)} />
          <Field label="Phone number" value={form.phone} onChange={(v) => set("phone", v)} />
        </div>
        {message && <div style={{ color: BRAND.green, fontWeight: 900, marginTop: 12 }}>{message}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <Button disabled={saving} onClick={save} style={{ flex: 1 }}>{saving ? "Saving..." : "Save Settings"}</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </Card>
    </div>
  );
}
 
function CoachDashboard({ user, trainer, setTrainer, clients, setClients, selectClient, refresh, syncStatus = "online" }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tab, setTab] = useState("clients");
  const [query, setQuery] = useState("");
  const [clientView, setClientView] = useState("all");
  const isMobile = useIsMobile(820);
  const isTablet = useIsMobile(1180) && !isMobile;
  const filtered = clients.filter((c) => {
    const matchesView = clientView === "all" || c.clientType === clientView;
    const matchesQuery = c.name.toLowerCase().includes(query.toLowerCase());
    return matchesView && matchesQuery;
  });
  const upcoming = clients.reduce((n, c) => n + (c.schedule?.length || 0), 0);
 
  async function createClient(form) {
    const color = form.color || getClientColor(uid(), clients.length);
    const invite_code = makeInviteCode();
    const payload = { trainer_id: user.id, name: form.name, email: form.email, phone: form.phone, age: Number(form.age || 0), weight_kg: Number(form.weight || 0), goal: form.profile.goals?.[0] || "General Fitness", color, clientType: normalizeClientType(form.clientType || "in_person"), invite_code, invite_status: "not_sent" };
    const { data, error } = await supabase.from("clients").insert(payload).select("*").single();
    if (error) { alert(error.message); return; }
    await upsertSection(data.id, "profile", form.profile);
    setShowAdd(false);
    await refresh();
  }
 
  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(circle at top left, ${BRAND.gold}10, transparent 28%), ${BRAND.bg}`, color: BRAND.text }}>
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(7,7,7,.93)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${BRAND.line}`, padding: isMobile ? "10px 12px" : isTablet ? "12px 16px" : "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: isTablet ? "wrap" : "nowrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: isMobile ? 42 : isTablet ? 44 : 50, height: isMobile ? 42 : isTablet ? 44 : 50, borderRadius: "50%", background: BRAND.card2, border: `1px solid ${BRAND.line}`, overflow: "hidden", display: "grid", placeItems: "center", color: BRAND.gold, fontWeight: 1000 }}>
            {trainer?.photo ? <img src={trainer.photo} alt="Coach" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(trainer?.name || user.email)}
          </div>
          <div><div style={{ fontSize: isMobile ? 24 : isTablet ? 28 : 34, fontWeight: 1000, color: BRAND.gold, lineHeight: 1 }}>FORGE</div><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900 }}>COACH {trainer?.name || user.email?.split("@")[0]}</div></div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span style={{ color: syncStatus === "offline" ? BRAND.red : syncStatus === "syncing" ? BRAND.gold : BRAND.green, fontSize: 12, fontWeight: 1000 }}>{syncStatus === "offline" ? "Offline" : syncStatus === "syncing" ? "Syncing" : "Synced"}</span>
          <Button variant="dark" onClick={() => setShowSettings(true)} style={{ padding: isMobile ? "8px 10px" : undefined }}>Settings</Button>
          <Button variant="ghost" onClick={() => supabase.auth.signOut()} style={{ padding: isMobile ? "8px 10px" : undefined }}>Logout</Button>
        </div>
      </header>
      <main style={{ width: "100%", maxWidth: isMobile ? 430 : isTablet ? 1080 : 1180, margin: "0 auto", padding: isMobile ? 10 : isTablet ? 14 : 16, boxSizing: "border-box", overflowX: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : isTablet ? "repeat(4,minmax(130px,1fr))" : "repeat(4,minmax(170px,1fr))", gap: isMobile ? 10 : isTablet ? 10 : 14, marginBottom: isTablet ? 12 : 16 }}>
          <Kpi title="Active Clients" value={clients.length} icon="👥" color={BRAND.gold} onClick={() => setTab("clients")} compact={isMobile || isTablet} />
          <Kpi title="Trials" value="Open" icon="🔥" color={BRAND.red} onClick={() => setTab("trials")} compact={isMobile || isTablet} />
          <Kpi title="Calendar" value="Open" icon="📅" color={BRAND.green} onClick={() => setTab("calendar")} compact={isMobile || isTablet} />
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: isTablet ? "visible" : "auto", flexWrap: isTablet ? "wrap" : "nowrap", paddingBottom: 4 }}>
          {[["clients", "Clients"], ["trials", "Trials"], ["calendar", "Calendar"]].map(([k, l]) => <Button key={k} variant={tab === k ? "gold" : "dark"} onClick={() => setTab(k)}>{l}</Button>)}
        </div>
        {tab === "clients" && <>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 10, marginBottom: 10 }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients..." style={inputStyle()} />
            <Button onClick={() => setShowAdd(true)}>+ Add New Client</Button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {[["all", "All Clients"], ["online", "Online Clients"], ["in_person", "In-Person Clients"]].map(([value, label]) => <Button key={value} variant={clientView === value ? "gold" : "dark"} onClick={() => setClientView(value)}>{label}</Button>)}
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : isTablet ? "repeat(4,minmax(0,1fr))" : "repeat(auto-fit,minmax(150px,1fr))",
            gap: isMobile ? 12 : isTablet ? 14 : 18,
            alignItems: "start",
          }}>
            {filtered.map((c, i) => <ClientCard key={c.id} client={c} onClick={() => selectClient(c)} index={i} />)}
          </div>
        </>}
        {tab === "calendar" && <Calendar clients={clients} refresh={refresh} user={user} />}
        {tab === "trials" && <Trials user={user} />}
      </main>
      {showAdd && <AddClientModal onClose={() => setShowAdd(false)} onCreate={createClient} />}
      {showSettings && <CoachSettingsModal user={user} trainer={trainer} onClose={() => setShowSettings(false)} onSaved={(next) => { setTrainer?.(next); setShowSettings(false); refresh(); }} />}
    </div>
  );
}
 
 
function Kpi({ title, value, icon, color, onClick, compact = false }) {
  return <Card onClick={onClick} style={{ cursor: onClick ? "pointer" : "default", borderColor: onClick ? `${color}66` : BRAND.line, minHeight: compact ? 92 : 128, padding: compact ? 12 : 16, background: `linear-gradient(180deg, ${BRAND.card}, #0b0c11)` }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <div><div style={{ color: BRAND.muted, fontSize: compact ? 11 : 12, fontWeight: 900 }}>{title}</div><div style={{ fontSize: compact ? 24 : 30, fontWeight: 1000, color, lineHeight: 1.05 }}>{value}</div></div>
      <div style={{ fontSize: compact ? 22 : 30 }}>{icon}</div>
    </div>
    <div style={{ marginTop: 8, color: BRAND.dim, fontSize: 11, fontWeight: 800 }}>{onClick ? "Tap to open" : ""}</div>
  </Card>;
}
 
 
function ScheduledView({ clients, selectClient }) {
  const isMobile = useIsMobile(760);
  const scheduled = clients.flatMap((client) => (client.schedule || []).map((s) => ({
    id: `${client.id}_${s.day}_${s.time}`,
    client,
    day: s.day,
    time: s.time,
  })));
  const dayIndex = Object.fromEntries(DAYS.map((d, i) => [d, i]));
  scheduled.sort((a, b) => (dayIndex[a.day] ?? 99) - (dayIndex[b.day] ?? 99) || String(a.time).localeCompare(String(b.time)));
  return (
    <div style={{ display: "grid", gap: isMobile ? 10 : 14, maxWidth: "100%", overflowX: "hidden" }}>
      <Card>
        <div style={{ fontSize: 24, fontWeight: 1000, color: BRAND.cyan }}>Scheduled Sessions</div>
        <div style={{ color: BRAND.muted, marginTop: 4 }}>All recurring client sessions from client schedules. Tap a client row to open their profile.</div>
      </Card>
      {scheduled.length === 0 ? (
        <Card><div style={{ color: BRAND.muted }}>No scheduled sessions yet. Open a client, go to Schedule, and add their recurring days and times.</div></Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
          {scheduled.map((s) => (
            <Card key={s.id} onClick={() => selectClient(s.client)} style={{ cursor: "pointer", borderColor: s.client.color }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                  <div style={{ color: s.client.color, fontSize: 12, fontWeight: 1000 }}>{s.day} · {timeLabel(s.time)}</div>
                  <div style={{ fontSize: 20, fontWeight: 1000 }}>{s.client.name}</div>
                  <div style={{ color: BRAND.muted, fontSize: 12 }}>{s.client.goals?.join(" + ") || s.client.goal}</div>
                </div>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: s.client.color, color: "#000", display: "grid", placeItems: "center", fontWeight: 1000 }}>{s.client.avatar}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
 
function ClientCard({ client, onClick }) {
  const isCompact = useIsMobile(920);
  const size = isCompact ? 146 : 162;
  const goals = client.goals?.join(" + ") || client.goal || "General Fitness";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        maxWidth: size,
        aspectRatio: "1 / 1",
        justifySelf: "center",
        borderRadius: "50%",
        border: `1.5px solid ${client.color}aa`,
        background: `radial-gradient(circle at 50% 18%, ${client.color}44, transparent 34%), linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.025))`,
        boxShadow: `0 0 26px ${client.color}2c, inset 0 0 0 1px rgba(255,255,255,.04)`,
        color: BRAND.text,
        cursor: "pointer",
        padding: isCompact ? 10 : 12,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        overflow: "hidden",
      }}
    >
      <ClientAvatar client={client} size={isCompact ? 46 : 52} />
      <div style={{
        marginTop: 8,
        fontSize: isCompact ? 14 : 16,
        fontWeight: 1000,
        letterSpacing: .4,
        lineHeight: 1.05,
        maxWidth: "92%",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>{client.name}</div>
      <div style={{
        color: client.color,
        fontSize: isCompact ? 10 : 11,
        fontWeight: 1000,
        marginTop: 5,
        lineHeight: 1.18,
        maxWidth: "86%",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>{goals}</div>
      <div style={{
        color: BRAND.text,
        fontSize: isCompact ? 11 : 12,
        fontWeight: 1000,
        marginTop: 8,
        background: "rgba(255,255,255,.07)",
        border: `1px solid ${BRAND.line}`,
        borderRadius: 999,
        padding: "5px 9px",
        maxWidth: "92%",
        whiteSpace: "nowrap",
      }}>{client.weight || 0}kg · {client.age || 0} yrs</div>
      <div style={{
        color: client.clientType === "online" ? BRAND.cyan : BRAND.gold,
        fontSize: isCompact ? 10 : 11,
        fontWeight: 1000,
        marginTop: 7,
        textTransform: "uppercase",
        letterSpacing: 0.7,
      }}>{clientTypeLabel(client.clientType)}</div>
    </button>
  );
}
 
 
function Mini({ label, value }) { return <div style={{ background: "#0b0c10", border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: 10 }}><div style={{ color: BRAND.dim, fontSize: 10, fontWeight: 800 }}>{label}</div><div style={{ color: BRAND.text, fontWeight: 900 }}>{value}</div></div>; }
 
function ClientAvatar({ client, size = 54 }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", display: "grid", placeItems: "center", background: client.color, color: "#000", fontWeight: 1000, overflow: "hidden", flexShrink: 0, boxShadow: `0 0 24px ${client.color}33` }}>{client.photo ? <img src={client.photo} alt={client.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : client.avatar}</div>;
}
 
 
function ClientView({ client, updateClient, back, refresh, refreshClient, isCoach = true }) {
  const [tab, setTab] = useState(isCoach ? "profile" : "home");
  const isMobile = useIsMobile(760);
  const isTablet = useIsMobile(1180) && !isMobile;
  const tabs = isCoach ? [
    ["profile", "Profile"], ["program", "Program"], ["nutrition", "Nutrition"], ["progress", "Progress"], ["photos", "Photos"], ["schedule", "Schedule"], ["packages", "Packages"], ["invite", "Invite"]
  ] : [["home", "Home"], ["nutrition", "Nutrition"], ["program", "Program"], ["progress", "Progress"], ["photos", "Photos"], ["profile", "Profile"]];
  async function delClient() {
    if (!confirm(`Delete ${client.name}? This cannot be undone.`)) return;
    await supabase.from("client_data").delete().eq("client_id", client.id);
    await supabase.from("clients").delete().eq("id", client.id);
    back(); refresh();
  }
  return (
    <div style={{ minHeight: "100vh", width: "100%", maxWidth: "100vw", overflowX: "hidden", background: BRAND.bg, color: BRAND.text }}>
      <header style={{ borderBottom: `1px solid ${BRAND.line}`, padding: isMobile ? "8px 10px" : isTablet ? "12px 16px" : 14, display: "flex", gap: 9, alignItems: "center", position: "sticky", top: 0, background: "rgba(7,7,7,.96)", backdropFilter: "blur(16px)", zIndex: 80, maxWidth: "100vw", overflow: "hidden" }}>
        {isCoach && <Button variant="ghost" onClick={back} style={{ padding: isMobile ? "8px 10px" : undefined }}>Back</Button>}
        <ClientAvatar client={client} size={isMobile ? 44 : 56} />
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: isMobile ? 20 : 25, fontWeight: 1000, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client.name}</div><div style={{ color: client.color, fontWeight: 1000, fontSize: 12 }}>{client.goals?.join(" + ") || client.goal}</div></div>
        {isCoach && <Button variant="red" onClick={delClient} style={{ padding: isMobile ? "8px 10px" : undefined }}>Delete</Button>}
      </header>
      <main style={{ width: "100%", maxWidth: isCoach ? (isMobile ? 430 : isTablet ? 1040 : 1080) : (isMobile ? 430 : 760), margin: "0 auto", padding: isMobile ? "6px 8px 12px" : isTablet ? 16 : 16, boxSizing: "border-box", overflowX: "hidden" }}>
        <div style={{
          display: "flex",
          gap: isMobile ? 6 : 8,
          overflowX: isTablet ? "visible" : "auto",
          flexWrap: isTablet ? "wrap" : "nowrap",
          marginBottom: isMobile ? 8 : 14,
          padding: isMobile ? "2px 0 6px" : "0 0 6px",
          position: "relative",
          top: "auto",
          zIndex: 1,
          background: "transparent",
          backdropFilter: "none",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}>
          {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{
            minWidth: isMobile ? 64 : 96,
            height: isMobile ? 34 : 48,
            borderRadius: 999,
            border: `1px solid ${tab === k ? client.color : BRAND.line}`,
            background: tab === k ? client.color : BRAND.card2,
            color: tab === k ? "#000" : BRAND.text,
            fontSize: isMobile ? 11 : 14,
            fontWeight: 1000,
            whiteSpace: "nowrap",
            cursor: "pointer",
            flex: "0 0 auto",
            boxShadow: tab === k ? `0 0 20px ${client.color}33` : "none",
          }}>{l}</button>)}
        </div>
        {tab === "home" && <ClientHome client={client} />}
        {tab === "profile" && <ProfileTab client={client} updateClient={updateClient} isCoach={isCoach} />}
        {tab === "program" && <ProgramTab client={client} updateClient={updateClient} isCoach={isCoach} refreshClient={refreshClient} />}
        {tab === "nutrition" && <NutritionTab client={client} updateClient={updateClient} isCoach={isCoach} />}
        {tab === "progress" && <ProgressTab client={client} />}
        {tab === "photos" && <TransformPhotos client={client} updateClient={updateClient} isCoach={isCoach} />}
        {tab === "schedule" && <ScheduleTab client={client} updateClient={updateClient} />}
        {tab === "packages" && <PackagesTab client={client} updateClient={updateClient} />}
        {tab === "invite" && <InviteTab client={client} updateClient={updateClient} />}
        {tab === "workouts" && <ClientWorkoutLog client={client} updateClient={updateClient} />}
      </main>
    </div>
  );
}
 
 
function todaysNutritionStats(client, date = new Date().toISOString().slice(0, 10)) {
  const nutrition = normalizeNutrition(client.nutrition);
  const logs = (nutrition.logs || []).filter((l) => l.date === date);
  const totals = logs.reduce((a, l) => ({
    kcal: a.kcal + Number(l.kcal || 0),
    protein: a.protein + Number(l.protein || 0),
    carbs: a.carbs + Number(l.carbs || 0),
    fats: a.fats + Number(l.fats || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fats: 0 });
  const daily = nutrition.daily?.[date] || {};
  const completedMeals = ["Breakfast", "Lunch", "Dinner"].filter((m) => logs.some((l) => l.meal === m) || daily?.meals?.[m]).length;
  const calTarget = Number(nutrition.targets?.calories || 0);
  const proteinTarget = Number(nutrition.targets?.protein || 0);
  const stepsTarget = Number(nutrition.targets?.steps || 10000);
  const waterTarget = Number(nutrition.targets?.water || 3);
  const sleepTarget = Number(nutrition.targets?.sleep || 7);
  const scoreParts = [
    completedMeals / 3,
    calTarget ? Math.min(totals.kcal / calTarget, 1) : 0,
    proteinTarget ? Math.min(totals.protein / proteinTarget, 1) : 0,
    stepsTarget ? Math.min(Number(daily.steps || 0) / stepsTarget, 1) : 0,
    waterTarget ? Math.min(Number(daily.water || 0) / waterTarget, 1) : 0,
    sleepTarget ? Math.min(Number(daily.sleep || 0) / sleepTarget, 1) : 0,
  ];
  const score = Math.round((scoreParts.reduce((a, b) => a + b, 0) / scoreParts.length) * 100);
  return { nutrition, logs, totals, daily, completedMeals, score, calTarget, proteinTarget, stepsTarget, waterTarget, sleepTarget };
}
function parseNumberFromText(value) {
  const match = String(value || "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}
function sessionEntries(program) {
  const logs = program?.weekLogs || [];
  const entries = [];
  logs.forEach((week, wi) => (week.days || []).forEach((day, di) => {
    (day.sessionData || []).forEach((ex) => (ex.sets || []).forEach((set, si) => {
      const timed = isTimedExercise(ex.name);
      const value = timed ? parseNumberFromText(set.duration || set.reps) : Number(set.weight || 0);
      if (!value) return;
      entries.push({ week: wi + 1, dayIndex: di, date: day.date || "", dayName: day.name || `Day ${di + 1}`, exercise: ex.name, timed, value, weight: set.weight, reps: set.reps, duration: set.duration, rpe: set.rpe, set: si + 1, notes: day.notes || "" });
    }));
  }));
  return entries;
}
function computePerformanceMetrics(program) {
  const wanted = ["Dead Hang", "Plank", "Bench Press", "Squat", "Deadlift"];
  const aliases = {
    "Dead Hang": ["dead hang", "dead hung"],
    "Plank": ["plank"],
    "Bench Press": ["bench press", "flat barbell bench press", "barbell bench press"],
    "Squat": ["squat", "back squat", "barbell squat"],
    "Deadlift": ["deadlift", "barbell deadlift"],
  };
  const entries = sessionEntries(program);
  return wanted.map((name) => {
    const keys = aliases[name];
    const data = entries.filter((e) => keys.some((k) => e.exercise.toLowerCase().includes(k)) && (name !== "Plank" || !e.exercise.toLowerCase().includes("side")));
    const timed = ["Dead Hang", "Plank"].includes(name);
    const sorted = [...data].sort((a, b) => a.value - b.value);
    const best = sorted[sorted.length - 1];
    const recent = data[data.length - 1];
    const first = data[0];
    const trend = first && recent ? recent.value - first.value : 0;
    return { name, timed, best, recent, trend };
  });
}
function metricDisplay(entry, timed) {
  if (!entry) return "-";
  if (timed) return `${entry.value}s`;
  return `${entry.value}kg${entry.reps ? ` x ${entry.reps}` : ""}`;
}
function recentCompletedSessions(program, limit = 6) {
  const logs = program?.weekLogs || [];
  const days = [];
  logs.forEach((week, wi) => (week.days || []).forEach((day) => {
    const hasData = day.date || (day.sessionData || []).some((ex) => (ex.sets || []).some((s) => s.weight || s.reps || s.duration));
    if (hasData) days.push({ ...day, weekNum: week.weekNum || wi + 1 });
  }));
  return days.slice(-limit).reverse();
}
 
 
function clampPercent(value, total) {
  const v = Number(value || 0);
  const t = Number(total || 0);
  if (!t) return 0;
  return Math.max(0, Math.min(100, Math.round((v / t) * 100)));
}
function ProgressRing({ label, value, total, unit = "", color = BRAND.gold, size = 132 }) {
  const pct = clampPercent(value, total);
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (pct / 100);
  return (
    <div style={{ background: "linear-gradient(180deg, #151821, #0c0d12)", border: `1px solid ${BRAND.line}`, borderRadius: 26, padding: 14, display: "grid", placeItems: "center", minHeight: size + 64 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)", filter: `drop-shadow(0 0 14px ${color}33)` }}>
          <circle cx={size / 2} cy={size / 2} r={r} stroke="#252833" strokeWidth={stroke} fill="transparent" />
          <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="transparent" strokeLinecap="round" strokeDasharray={`${dash} ${c - dash}`} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
          <div>
            <div style={{ fontSize: 25, fontWeight: 1000, color: BRAND.text }}>{value || 0}{unit}</div>
            <div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 900 }}>/{total || 0}{unit}</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10, color: BRAND.text, fontWeight: 1000 }}>{label}</div>
      <div style={{ color: color, fontWeight: 900, fontSize: 12 }}>{pct}% complete</div>
    </div>
  );
}
function PremiumTile({ label, value, sub = "", color = BRAND.gold }) {
  return <div style={{ background: "linear-gradient(180deg, #151821, #0d0f15)", border: `1px solid ${BRAND.line}`, borderRadius: 22, padding: 16, boxShadow: `0 18px 40px ${color}12` }}><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 1000, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div><div style={{ color, fontSize: 24, fontWeight: 1000, marginTop: 7 }}>{value}</div>{sub && <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 5 }}>{sub}</div>}</div>;
}
function MealStatusPill({ meal, done, color }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: done ? `${color}22` : BRAND.card2, border: `1px solid ${done ? color : BRAND.line}`, borderRadius: 18, padding: "12px 14px" }}><b>{meal}</b><span style={{ color: done ? color : BRAND.muted, fontWeight: 1000 }}>{done ? "Done" : "Pending"}</span></div>;
}
 
 
function CompactScore({ value, color }) {
  return <div style={{ width: 70, height: 70, borderRadius: "50%", display: "grid", placeItems: "center", background: `conic-gradient(${color} ${value}%, #242733 ${value}% 100%)` }}><div style={{ width: 52, height: 52, borderRadius: "50%", background: BRAND.bg, display: "grid", placeItems: "center", textAlign: "center" }}><div><div style={{ fontSize: 18, fontWeight: 1000 }}>{value}%</div><div style={{ color: BRAND.muted, fontSize: 7, fontWeight: 1000 }}>SCORE</div></div></div></div>;
}
function CompactMetric({ label, value, total, color, percent }) {
  const n = typeof percent === "number" ? percent : (Number(total) ? Math.min(100, Math.round(Number(value || 0) / Number(total || 1) * 100)) : 0);
  return <Card style={{ padding: 12, borderRadius: 20, minHeight: 98, background: `linear-gradient(180deg, ${BRAND.card}, #0b0d13)` }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}><div><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 1000 }}>{label}</div><div style={{ fontSize: 22, fontWeight: 1000, marginTop: 4 }}>{value}</div><div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 900 }}>/{total}</div></div><div style={{ width: 44, height: 44, borderRadius: "50%", background: `conic-gradient(${color} ${n}%, #252936 ${n}% 100%)`, display: "grid", placeItems: "center" }}><div style={{ width: 31, height: 31, borderRadius: "50%", background: BRAND.bg }} /></div></div><div style={{ color, fontSize: 11, fontWeight: 1000, marginTop: 8 }}>{n}% complete</div></Card>;
}
 
function ClientHome({ client }) {
  const isMobile = useIsMobile(760);
  const stats = todaysNutritionStats(client);
  const metrics = computePerformanceMetrics(client.program);
  const deadHang = metrics.find((m) => m.name === "Dead Hang");
  const plank = metrics.find((m) => m.name === "Plank");
  const todaysWorkout = client.program?.days?.[0]?.name || "Workout not assigned";
  const meals = ["Breakfast", "Lunch", "Dinner"];
  const mealDone = (meal) => stats.logs.some((l) => l.meal === meal) || stats.daily?.meals?.[meal];
  if (isMobile) {
    return <div style={{ display: "grid", gap: 12 }}>
      <Card style={{ background: `radial-gradient(circle at 14% 12%, ${client.color}2e, transparent 35%), linear-gradient(135deg, #151821, #08090d)`, borderColor: `${client.color}55`, padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center" }}>
          <ClientAvatar client={client} size={58} />
          <div style={{ minWidth: 0 }}><div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 1000, letterSpacing: 1.8 }}>FORGE CLIENT</div><div style={{ fontSize: 22, fontWeight: 1000, lineHeight: 1.05 }}>Welcome, {client.name}</div><div style={{ color: client.color, fontWeight: 1000, marginTop: 4, fontSize: 12 }}>{client.goals?.join(" + ") || client.goal}</div></div>
          <CompactScore value={stats.score} color={client.color} />
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <CompactMetric label="Calories" value={stats.totals.kcal} total={stats.calTarget || 0} color={BRAND.cyan} />
        <CompactMetric label="Protein" value={`${stats.totals.protein}g`} total={`${stats.proteinTarget || 0}g`} percent={stats.proteinTarget ? Math.min(100, Math.round(stats.totals.protein / stats.proteinTarget * 100)) : 0} color={BRAND.green} />
        <CompactMetric label="Steps" value={stats.daily.steps || 0} total={stats.stepsTarget || 10000} color={BRAND.gold} />
        <CompactMetric label="Water" value={`${stats.daily.water || 0}L`} total={`${stats.waterTarget || 3}L`} percent={(stats.waterTarget || 3) ? Math.min(100, Math.round(Number(stats.daily.water || 0) / Number(stats.waterTarget || 3) * 100)) : 0} color={BRAND.blue} />
      </div>
      <Card><div style={{ color: BRAND.gold, fontWeight: 1000, marginBottom: 10 }}>TODAY'S NUTRITION</div><div style={{ display: "grid", gap: 8 }}>{meals.map((m) => <MealStatusPill key={m} meal={m} done={mealDone(m)} color={client.color} />)}</div></Card>
      <Card><div style={{ color: BRAND.gold, fontWeight: 1000, marginBottom: 8 }}>TODAY'S WORKOUT</div><div style={{ fontSize: 22, fontWeight: 1000 }}>{todaysWorkout}</div><div style={{ color: BRAND.muted, marginTop: 6 }}>Open Program to log your session.</div></Card>
      <Card><div style={{ color: BRAND.gold, fontWeight: 1000, marginBottom: 10 }}>PERFORMANCE</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><PremiumTile label="Dead Hang PB" value={metricDisplay(deadHang?.best, true)} sub={`Recent ${metricDisplay(deadHang?.recent, true)}`} color={BRAND.cyan} /><PremiumTile label="Plank PB" value={metricDisplay(plank?.best, true)} sub={`Recent ${metricDisplay(plank?.recent, true)}`} color={BRAND.purple} /></div></Card>
    </div>;
  }
  return <div style={{ display: "grid", gap: isMobile ? 10 : 16, maxWidth: "100%", overflowX: "hidden" }}>
    <Card style={{ background: `radial-gradient(circle at 18% 20%, ${client.color}33, transparent 32%), linear-gradient(135deg, #171a22, #08090d)`, borderColor: `${client.color}55`, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}><ClientAvatar client={client} size={76} /><div><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 1000, letterSpacing: 2 }}>FORGE CLIENT</div><div style={{ fontSize: 31, fontWeight: 1000, lineHeight: 1 }}>Welcome back, {client.name}</div><div style={{ color: client.color, fontWeight: 900, marginTop: 6 }}>{client.goals?.join(" + ") || client.goal}</div></div></div>
        <div style={{ width: 118, height: 118, borderRadius: "50%", display: "grid", placeItems: "center", background: `conic-gradient(${client.color} ${stats.score}%, #242733 ${stats.score}% 100%)`, boxShadow: `0 0 34px ${client.color}33` }}><div style={{ width: 86, height: 86, borderRadius: "50%", background: BRAND.bg, display: "grid", placeItems: "center", textAlign: "center" }}><div><div style={{ fontSize: 30, fontWeight: 1000 }}>{stats.score}%</div><div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 1000 }}>FORGE SCORE</div></div></div></div>
      </div>
    </Card>
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}><ProgressRing label="Calories" value={stats.totals.kcal} total={stats.calTarget || 0} color={BRAND.cyan} /><ProgressRing label="Protein" value={stats.totals.protein} total={stats.proteinTarget || 0} unit="g" color={BRAND.green} /><ProgressRing label="Steps" value={stats.daily.steps || 0} total={stats.stepsTarget || 10000} color={BRAND.gold} /><ProgressRing label="Water L" value={stats.daily.water || 0} total={stats.waterTarget || 3} color={BRAND.blue} /></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14 }}><Card><div style={{ color: BRAND.gold, fontWeight: 1000, marginBottom: 10 }}>TODAY'S NUTRITION</div><div style={{ display: "grid", gap: 9 }}>{meals.map((m) => <MealStatusPill key={m} meal={m} done={mealDone(m)} color={client.color} />)}</div></Card><Card><div style={{ color: BRAND.gold, fontWeight: 1000, marginBottom: 10 }}>TODAY'S WORKOUT</div><div style={{ fontSize: 24, fontWeight: 1000 }}>{todaysWorkout}</div><div style={{ color: BRAND.muted, marginTop: 6 }}>Open Program to log sets, reps, duration and RPE.</div></Card><Card><div style={{ color: BRAND.gold, fontWeight: 1000, marginBottom: 10 }}>PERFORMANCE</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><PremiumTile label="Dead Hang PB" value={metricDisplay(deadHang?.best, true)} sub={`Recent ${metricDisplay(deadHang?.recent, true)}`} color={BRAND.cyan} /><PremiumTile label="Plank PB" value={metricDisplay(plank?.best, true)} sub={`Recent ${metricDisplay(plank?.recent, true)}`} color={BRAND.purple} /></div></Card></div>
  </div>;
}
 
 
function ProfileTab({ client, updateClient, isCoach = true }) {
  const isMobile = useIsMobile(760);
  const [profile, setProfile] = useState({ ...emptyProfile(), ...(client.profile || {}) });
  const [clientType, setClientType] = useState(normalizeClientType(client.clientType));
  const [saving, setSaving] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => {
    setClientType(normalizeClientType(client.clientType));
  }, [client.id, client.clientType]);
  const measurements = profile.measurements || {};
  const currentColor = profile.color || client.color || BRAND.cyan;
  const set = (k, v) => setProfile((p) => ({ ...p, [k]: v }));
  const setMeasurement = (k, v) => setProfile((p) => ({ ...p, measurements: { ...(p.measurements || {}), [k]: v } }));
  const toggleGoal = (g) => set("goals", (profile.goals || []).includes(g) ? (profile.goals || []).filter((x) => x !== g) : [...(profile.goals || []), g]);
  async function pickPhoto(file) {
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    set("photo", dataUrl);
  }
  async function save() {
    setSaving(true);
    const nextProfile = { ...emptyProfile(), ...profile };
    const nextClientType = normalizeClientType(clientType || client.clientType || "in_person");
    await upsertSection(client.id, "profile", nextProfile);
    await supabase.from("clients").update({ clientType: nextClientType }).eq("id", client.id);
    updateClient({ ...client, clientType: nextClientType, profile: nextProfile, photo: nextProfile.photo || client.photo, color: nextProfile.color || client.color, goals: nextProfile.goals, goal: nextProfile.goals?.[0] || client.goal, notes: nextProfile.notes });
    setSaving(false);
  }
  return <Card style={{ padding: isMobile ? 14 : 18 }}>
    <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 1000, marginBottom: 14, textAlign: isMobile ? "center" : "left" }}>Client Profile</div>
    <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
      <button type="button" onClick={() => fileRef.current?.click()} title="Tap to change profile picture" style={{ width: 88, height: 88, borderRadius: 28, background: currentColor, overflow: "hidden", display: "grid", placeItems: "center", color: "#000", fontWeight: 1000, border: `1px solid ${BRAND.line}`, cursor: "pointer", boxShadow: `0 0 22px ${currentColor}55`, padding: 0 }}>
        {profile.photo || client.photo ? <img src={profile.photo || client.photo} alt="client" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(client.name || client.avatar)}
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={(e) => pickPhoto(e.target.files?.[0])} style={{ display: "none" }} />
      <div style={{ flex: 1, minWidth: 190 }}>
        <div style={{ color: BRAND.text, fontWeight: 1000, fontSize: 18 }}>{client.name}</div>
        <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 800, marginTop: 4 }}>Tap the picture to change it.</div>
        {isCoach && <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <label>
            <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 }}>Client type</div>
            <select value={clientType} onChange={(e) => setClientType(normalizeClientType(e.target.value))} style={inputStyle({ minWidth: 180 })}>
              <option value="in_person">In-Person Client</option>
              <option value="online">Online Client</option>
            </select>
          </label>
          <Button variant="dark" onClick={() => setShowColorPicker((v) => !v)}>{showColorPicker ? "Hide client color" : "Change client color"}</Button>
        </div>}
      </div>
    </div>
    {isCoach && showColorPicker && <div style={{ marginBottom: 14 }}><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{CLIENT_COLORS.map((c) => <button key={c} onClick={() => set("color", c)} style={{ width: 34, height: 34, borderRadius: 12, border: currentColor === c ? `3px solid ${BRAND.text}` : `1px solid ${BRAND.line}`, background: c, cursor: "pointer" }} />)}</div></div>}
    <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Goals</div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>{GOAL_OPTIONS.map((g) => <button key={g} onClick={() => toggleGoal(g)} style={{ border: `1px solid ${(profile.goals || []).includes(g) ? currentColor : BRAND.line}`, background: (profile.goals || []).includes(g) ? currentColor : BRAND.card2, color: (profile.goals || []).includes(g) ? "#000" : BRAND.text, borderRadius: 999, padding: "8px 12px", fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.4 }}>{String(g).toUpperCase()}</button>)}</div>
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(230px,1fr))", gap: 12, marginBottom: 12 }}>
      <Field label="Client Birthday" value={profile.birthday} onChange={(v) => set("birthday", v)} type="date" />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}><Field label="Injuries" value={profile.injuries} onChange={(v) => set("injuries", v)} textarea /><Field label="Medical Issues" value={profile.medicalIssues} onChange={(v) => set("medicalIssues", v)} textarea /><Field label="Barriers" value={profile.barriers} onChange={(v) => set("barriers", v)} textarea /><Field label="Sleep" value={profile.sleep} onChange={(v) => set("sleep", v)} textarea /><Field label="NEAT / Daily Activity" value={profile.neat} onChange={(v) => set("neat", v)} textarea /><Field label="Work Schedule" value={profile.workSchedule} onChange={(v) => set("workSchedule", v)} textarea /><Field label="Vegetarian Status" value={profile.vegetarianStatus} onChange={(v) => set("vegetarianStatus", v)} /><Field label="Allergies" value={profile.allergies} onChange={(v) => set("allergies", v)} /><Field label="Notes" value={profile.notes} onChange={(v) => set("notes", v)} textarea /></div>
    {isCoach && <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 6 }}>Measurements</div>
      <div style={{ color: BRAND.muted, marginBottom: 12 }}>Assessment fields copied from your paper form. Use cm unless another unit makes more sense.</div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>{MEASUREMENT_FIELDS.map(([key, label]) => <Field key={key} label={label} value={measurements[key] || ""} onChange={(v) => setMeasurement(key, v)} />)}</div>
    </div>}
    <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}><label style={{ color: BRAND.muted }}><input type="checkbox" checked={!!profile.lactoseIntolerant} onChange={(e) => set("lactoseIntolerant", e.target.checked)} /> Lactose intolerant</label><label style={{ color: BRAND.muted }}><input type="checkbox" checked={!!profile.glutenIntolerant} onChange={(e) => set("glutenIntolerant", e.target.checked)} /> Gluten intolerant</label></div><Button disabled={saving} onClick={save} style={{ marginTop: 16 }}>{saving ? "Saving..." : "Save Profile"}</Button></Card>;
}
 
function downloadProgramPDF(client, program) {
  if (!program) return;
  const days = (program.days || []).map((day) => `
    <section style="margin:18px 0;padding:14px;border:1px solid #ddd;border-radius:12px;">
      <h2 style="margin:0 0 10px 0;">${day.name || "Workout Day"}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr><th style="text-align:left;border-bottom:1px solid #ccc;padding:8px;">Exercise</th><th style="border-bottom:1px solid #ccc;padding:8px;">Sets</th><th style="border-bottom:1px solid #ccc;padding:8px;">Reps/Time</th><th style="border-bottom:1px solid #ccc;padding:8px;">Load</th></tr></thead>
        <tbody>${(day.exercises || []).map((ex) => `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${ex.name || ""}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${ex.numSets || ""}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${ex.reps || ""}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${ex.weight || ""}</td></tr>`).join("")}</tbody>
      </table>
    </section>`).join("");
  const html = `<!doctype html><html><head><title>${program.name || "Workout Program"}</title></head><body style="font-family:Arial,sans-serif;padding:28px;color:#111;">
    <h1 style="margin-bottom:4px;">${program.name || "Workout Program"}</h1>
    <div style="color:#555;margin-bottom:18px;">Client: ${client.name || "Client"} | Total weeks: ${program.totalWeeks || 4}</div>
    ${days}
    <script>window.onload = () => window.print();<\/script>
  </body></html>`;
  const win = window.open("", "_blank");
  if (!win) { alert("Allow popups to download/print the program PDF."); return; }
  win.document.write(html);
  win.document.close();
}
 
function weeksFromProgram(program) {
  return Number(program?.totalWeeks || program?.periodizationPlan?.length || program?.weekLogs?.length || 4);
}
 
function ProgramTab({ client, updateClient, isCoach, refreshClient }) {
  const isMobile = useIsMobile(760);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderMode, setBuilderMode] = useState("build");
  const [program, setProgram] = useState(client.program);

  useEffect(() => {
    setProgram(client.program || null);
  }, [client.id, client.program?.id, client.program?.savedAt]);

  async function saveProgram(p) {
    if (!p) return;
    const previous = program || client.program || null;
    const base = normalizeProgramRecord({ ...p, totalWeeks: Math.max(1, Number(p.totalWeeks || weeksFromProgram(p) || 4)) }, previous);
    const periodized = applyPeriodization(base);
    const final = {
      ...periodized,
      id: base.id,
      weekLogs: p.weekLogs && Array.isArray(p.weekLogs) && p.weekLogs.length ? p.weekLogs : mergeProgramLogs(previous, periodized),
      savedAt: new Date().toISOString(),
    };
    setProgram(final);
    const saved = await upsertSection(client.id, "program", final);
    updateClient({ ...client, program: final });
    if (typeof refreshClient === "function") {
      try { await refreshClient(client.id); } catch (error) { console.warn("Program refresh failed", error); }
    }
    if (saved?.queued) console.warn("Program saved locally and queued for sync", saved?.error || "");
    setBuilderOpen(false);
  }

  function openBuilder(mode) {
    setBuilderMode(mode);
    setBuilderOpen(true);
  }

  return <div style={{ display: "grid", gap: isMobile ? 10 : 14 }}><Card style={{ padding: isMobile ? 12 : 16 }}><div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 10, alignItems: "center" }}><div><div style={{ fontSize: 22, fontWeight: 1000 }}>Program</div><div style={{ color: BRAND.muted }}>{program?.name || "No program yet"}</div>{isCoach && program?.templateName && <div style={{ color: BRAND.gold, fontSize: 12, fontWeight: 900, marginTop: 4 }}>Template: {program.templateName}</div>}{program?.periodizationStyle && <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 800, marginTop: 4 }}>{program.trainingGoal || "General Fitness"} · {program.periodizationStyle}</div>}</div>{program && <Button variant="dark" onClick={() => downloadProgramPDF(client, program)} style={{ width: isMobile ? "100%" : undefined }}>Download PDF</Button>}{isCoach && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Button onClick={() => openBuilder("build")}>Build Program</Button><Button variant="dark" onClick={() => openBuilder("edit")}>Edit Program</Button></div>}</div>{program && <div style={{ marginTop: 12, color: BRAND.green, fontWeight: 800 }}>{aiProgression(program, client)}</div>}</Card>{program ? <SessionTracker client={client} program={program} saveProgram={saveProgram} isCoach={isCoach} /> : <Card><div style={{ color: BRAND.muted }}>No program assigned yet. Create one with Build Program.</div></Card>}{builderOpen && <ProgramBuilder client={client} program={builderMode === "edit" ? (program || null) : null} mode={builderMode} onClose={() => setBuilderOpen(false)} onSave={saveProgram} />}</div>;
}
 
 
 
function ProgramBuilder({ client, program, onClose, onSave, mode = "build" }) {
  const isMobile = useIsMobile(760);
  const exerciseLibrary = useExerciseLibrary();
  const availableTemplates = useMemo(() => allProgramTemplates(), []);
  const baseDays = program?.days?.length ? program.days : [{ name: "Day 1", exercises: [] }];
  const [name, setName] = useState(program?.name || `DENIS's Program`);
  const [weeks, setWeeks] = useState(Number(program?.totalWeeks || 4));
  const [trainingGoal, setTrainingGoal] = useState(program?.trainingGoal || client.goals?.[0] || client.goal || "General Fitness");
  const [periodizationStyle, setPeriodizationStyle] = useState(program?.periodizationStyle || "Simple 4-Week Cycle");
  const [days, setDays] = useState(() => baseDays.map((d) => ({ ...d, exercises: (d.exercises || []).map((e) => ({ ...e })) })));
  const [active, setActive] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(program?.templateKey || "");
  const [selectedTemplateWeeks, setSelectedTemplateWeeks] = useState(Number(program?.totalWeeks || 4));
  const [phasePreview, setPhasePreview] = useState(() => normalizePeriodizationPlan(weeks, periodizationStyle, trainingGoal, program?.periodizationPlan));
  useEffect(() => {
    setPhasePreview((prev) => normalizePeriodizationPlan(weeks, periodizationStyle, trainingGoal, prev));
  }, [weeks, periodizationStyle, trainingGoal]);
  const filtered = exerciseLibrary.filter((e) => e.toLowerCase().includes(search.toLowerCase())).slice(0, 80);
  const updatePhase = (wi, field, value) => setPhasePreview((prev) => prev.map((w, i) => i === wi ? { ...w, [field]: value } : w));
  function updateDay(di, patch) { setDays((prev) => prev.map((d, i) => i === di ? { ...d, ...patch } : d)); }
  function addDay() { setDays((prev) => [...prev, { name: `Day ${prev.length + 1}`, exercises: [] }]); setActive(days.length); }
  function deleteDay(di) { const next = days.filter((_, i) => i !== di); setDays(next.length ? next : [{ name: "Day 1", exercises: [] }]); setActive(0); }
  function addExercise(name) {
    setDays((prev) => prev.map((d, i) => i === active ? { ...d, exercises: [...(d.exercises || []), { name, numSets: 3, reps: isTimedExercise(name) ? "30-60 sec" : "8-10", weight: "" }] } : d));
    setSearch("");
  }
  function updateExercise(di, ei, field, value) {
    setDays((prev) => prev.map((d, i) => i === di ? { ...d, exercises: (d.exercises || []).map((ex, j) => j === ei ? { ...ex, [field]: value } : ex) } : d));
  }
  function applyTemplateSelection() {
    const template = availableTemplates.find((t) => t.key === selectedTemplateKey) || availableTemplates[0];
    if (!template) return;
    const seeded = cloneTemplateProgram(template, client, selectedTemplateWeeks);
    setName(seeded.name || `DENIS's Program`);
    setWeeks(Number(seeded.totalWeeks || 4));
    setTrainingGoal(seeded.trainingGoal || client.goals?.[0] || client.goal || "General Fitness");
    setPeriodizationStyle(seeded.periodizationStyle || "Simple 4-Week Cycle");
    setDays((seeded.days || []).map((d) => ({ ...d, exercises: (d.exercises || []).map((e) => ({ ...e })) })));
    setPhasePreview(normalizePeriodizationPlan(Number(seeded.totalWeeks || 4), seeded.periodizationStyle || "Simple 4-Week Cycle", seeded.trainingGoal || client.goals?.[0] || client.goal || "General Fitness", seeded.periodizationPlan));
  }
  function save() {
    const next = applyPeriodization({ ...(program || {}), name, totalWeeks: Number(weeks || 4), trainingGoal, periodizationStyle, days, periodizationPlan: phasePreview });
    onSave(next);
  }
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 980, maxHeight: "92vh", overflow: "auto", padding: isMobile ? 12 : 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 1000, color: BRAND.gold }}>{mode === "edit" ? "Edit Program" : "Build Program"}</div>
            <div style={{ color: BRAND.muted }}>{mode === "edit" ? "Update the existing plan and keep the same program id." : "Create a program manually, or start from a saved template."}</div>
          </div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 0.8fr auto", gap: 10, marginBottom: 12, alignItems: "end" }}>
          <label>
            <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 }}>Start from template</div>
            <select value={selectedTemplateKey} onChange={(e) => setSelectedTemplateKey(e.target.value)} style={inputStyle()}>
              <option value="">Blank program</option>
              {availableTemplates.map((template) => <option key={template.key} value={template.key}>{template.name}</option>)}
            </select>
          </label>
          <label>
            <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 }}>Weeks</div>
            <select value={selectedTemplateWeeks} onChange={(e) => setSelectedTemplateWeeks(Number(e.target.value))} style={inputStyle()}>{[4, 6, 8, 10, 12, 16].map((w) => <option key={w} value={w}>{w} weeks</option>)}</select>
          </label>
          <Button variant="dark" onClick={applyTemplateSelection}>Load Template</Button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
          <Field label="Client-visible program name" value={name} onChange={setName} />
          <label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 }}>Weeks</div><select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} style={inputStyle()}>{[4, 6, 8, 10, 12, 16].map((w) => <option key={w} value={w}>{w} weeks</option>)}</select></label>
          <label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 }}>Training Goal</div><select value={trainingGoal} onChange={(e) => setTrainingGoal(e.target.value)} style={inputStyle()}>{GOAL_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}</select></label>
          <label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 }}>Periodization</div><select value={periodizationStyle} onChange={(e) => setPeriodizationStyle(e.target.value)} style={inputStyle()}>{PERIODIZATION_STYLES.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
        </div>
        <Card style={{ background: BRAND.card2, marginTop: 12 }}>
          <div style={{ color: BRAND.gold, fontWeight: 1000, marginBottom: 8 }}>Editable Weeks</div>
          <div style={{ color: BRAND.muted, fontSize: 12, marginBottom: 10 }}>Adjust each week so the periodization fits the client, not the other way around.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 8 }}>
            {phasePreview.map((w, wi) => <div key={w.week} style={{ border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 10, background: BRAND.panel }}>
              <div style={{ fontWeight: 1000, marginBottom: 8 }}>Week {w.week}</div>
              <input value={w.phase || ""} onChange={(e) => updatePhase(wi, "phase", e.target.value)} placeholder="Phase" style={inputStyle({ marginBottom: 6 })} />
              <input value={w.focus || ""} onChange={(e) => updatePhase(wi, "focus", e.target.value)} placeholder="Focus" style={inputStyle({ marginBottom: 6 })} />
              <input value={w.rpe || ""} onChange={(e) => updatePhase(wi, "rpe", e.target.value)} placeholder="Target RPE" style={inputStyle({ marginBottom: 6 })} />
              <input value={w.volume || ""} onChange={(e) => updatePhase(wi, "volume", e.target.value)} placeholder="Volume" style={inputStyle()} />
            </div>)}
          </div>
        </Card>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(210px,280px) 1fr", gap: 12, marginTop: 12 }}>
          <div>
            <Button variant="dark" onClick={addDay} style={{ width: "100%", marginBottom: 10 }}>+ Add Day</Button>
            {days.map((d, i) => <div key={i} onClick={() => setActive(i)} style={{ position: "relative", background: i === active ? `${client.color}22` : BRAND.card2, border: `1px solid ${i === active ? client.color : BRAND.line}`, borderRadius: 16, padding: 12, marginBottom: 8, cursor: "pointer" }}><button onClick={(e) => { e.stopPropagation(); deleteDay(i); }} style={{ position: "absolute", top: 6, right: 8, background: "transparent", border: "none", color: BRAND.red, fontWeight: 1000, cursor: "pointer" }}>x</button><div style={{ fontWeight: 1000, paddingRight: 20 }}>{d.name}</div><div style={{ color: BRAND.muted, fontSize: 12 }}>{d.exercises?.length || 0} exercises</div></div>)}
          </div>
          <div>
            <Field label="Day name" value={days[active]?.name || ""} onChange={(v) => updateDay(active, { name: v })} />
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 8, marginTop: 10 }}><input placeholder="Search exercise to add..." value={search} onChange={(e) => setSearch(e.target.value)} style={inputStyle()} /><Button variant="dark" onClick={() => search.trim() && addExercise(search.trim())}>Add Custom</Button></div>
            {search && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{filtered.map((ex) => <button key={ex} onClick={() => addExercise(ex)} style={{ background: BRAND.card2, color: BRAND.text, border: `1px solid ${BRAND.line}`, borderRadius: 999, padding: "6px 10px", fontWeight: 800, cursor: "pointer" }}>+ {ex}</button>)}</div>}
            <div style={{ marginTop: 12 }}>{(days[active]?.exercises || []).map((ex, ei) => <div key={ei} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 60px 80px 70px 28px" : "1.4fr 70px 95px 85px 30px", gap: 8, alignItems: "center", background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 10, marginBottom: 8 }}><input value={ex.name || ""} onChange={(e) => updateExercise(active, ei, "name", e.target.value)} style={inputStyle()} /><input value={ex.numSets || ""} onChange={(e) => updateExercise(active, ei, "numSets", e.target.value)} style={inputStyle()} /><input value={ex.reps || ""} onChange={(e) => updateExercise(active, ei, "reps", e.target.value)} style={inputStyle()} /><input value={ex.weight || ""} onChange={(e) => updateExercise(active, ei, "weight", e.target.value)} placeholder="kg" style={inputStyle()} /><button onClick={() => updateDay(active, { exercises: days[active].exercises.filter((_, j) => j !== ei) })} style={{ background: "transparent", border: "none", color: BRAND.red, fontWeight: 1000, cursor: "pointer" }}>x</button></div>)}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}><Button onClick={save} style={{ flex: 1 }}>Save Program</Button><Button variant="ghost" onClick={onClose}>Cancel</Button></div>
      </Card>
    </div>
  );
}
 
function SessionTracker({ client, program, saveProgram, isCoach }) {
  const isMobile = useIsMobile(760);
  const exerciseLibrary = useExerciseLibrary();
  const logs = program.weekLogs || mergeProgramLogs(null, program);
  const [wk, setWk] = useState(0);
  const [dy, setDy] = useState(0);
  const [subSearch, setSubSearch] = useState({});
  const week = logs[wk];
  const day = week?.days?.[dy];
  const phase = program.periodizationPlan?.[wk] || buildPeriodizationPlan(program.totalWeeks || logs.length, program.periodizationStyle || "Simple 4-Week Cycle", program.trainingGoal || client.goal || "General Fitness")[wk];
  function patch(fn) { const next = fn(logs); saveProgram({ ...program, weekLogs: next }); }
  function setSet(ei, si, f, v) { patch((ls) => ls.map((w, wi) => wi !== wk ? w : { ...w, days: w.days.map((d, di) => di !== dy ? d : { ...d, sessionData: d.sessionData.map((ex, xi) => xi !== ei ? ex : { ...ex, sets: ex.sets.map((s, j) => j !== si ? s : { ...s, [f]: v }) }) }) })); }
  function setExField(ei, f, v) { patch((ls) => ls.map((w, wi) => wi !== wk ? w : { ...w, days: w.days.map((d, di) => di !== dy ? d : { ...d, sessionData: d.sessionData.map((ex, xi) => xi !== ei ? ex : { ...ex, [f]: v }) }) })); }
  function setMeta(f, v) { patch((ls) => ls.map((w, wi) => wi !== wk ? w : { ...w, days: w.days.map((d, di) => di !== dy ? d : { ...d, [f]: v }) })); }
  function setMetric(f, v) { setMeta("metrics", { ...(day?.metrics || {}), [f]: v }); }
  return <Card style={{ padding: isMobile ? 12 : 16 }}>
    <div style={{ display: "flex", gap: 6, overflowX: "auto", flexWrap: isMobile ? "nowrap" : "wrap", marginBottom: 10, paddingBottom: 4 }}>{logs.map((_, i) => <Button key={i} variant={wk === i ? "gold" : "dark"} onClick={() => { setWk(i); setDy(0); }}>Week {i + 1}</Button>)}</div>
    {phase && <div style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 12, marginBottom: 12 }}><div style={{ color: BRAND.gold, fontWeight: 1000 }}>Week {wk + 1}: {phase.phase}</div><div style={{ color: BRAND.muted, fontSize: 12, marginTop: 4 }}>Focus: {phase.focus} · Target RPE {phase.rpe} · {phase.volume}</div></div>}
    <div style={{ display: "flex", gap: 6, overflowX: "auto", flexWrap: isMobile ? "nowrap" : "wrap", marginBottom: 14, paddingBottom: 4 }}>{week?.days?.map((d, i) => <Button key={i} variant={dy === i ? "gold" : "dark"} onClick={() => setDy(i)}>{d.name}</Button>)}</div>
    {day && <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}><div><div style={{ fontSize: 20, fontWeight: 1000 }}>{day.name}</div><div style={{ color: BRAND.muted }}>Week {wk + 1}</div></div><input type="date" value={day.date || ""} onChange={(e) => setMeta("date", e.target.value)} style={inputStyle({ maxWidth: 180 })} /></div>
      {day.sessionData?.map((ex, ei) => {
        const effectiveName = ex.substitute || ex.actualName || ex.name;
        const timed = isTimedExercise(effectiveName);
        const q = subSearch[ei] || "";
        const suggestions = exerciseLibrary.filter((n) => n.toLowerCase().includes(q.toLowerCase())).slice(0, 12);
        return <div key={ei} style={{ borderTop: `1px solid ${BRAND.line}`, paddingTop: 12, marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}><div><div style={{ color: client.color, fontWeight: 1000, fontSize: 18 }}>{effectiveName}</div>{ex.substitute && <div style={{ color: BRAND.muted, fontSize: 12 }}>Substituted for {ex.name}</div>}</div><Button variant="dark" onClick={() => setExField(ei, "substitute", "")}>Use Original</Button></div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 8, marginTop: 8, marginBottom: 10 }}><input placeholder="Substitute exercise if gym is busy..." value={q} onChange={(e) => setSubSearch({ ...subSearch, [ei]: e.target.value })} style={inputStyle()} /><Button variant="dark" onClick={() => q && setExField(ei, "substitute", q)}>Substitute</Button></div>
          {q && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>{suggestions.map((n) => <button key={n} onClick={() => { setExField(ei, "substitute", n); setSubSearch({ ...subSearch, [ei]: "" }); }} style={{ border: `1px solid ${BRAND.line}`, background: BRAND.card2, color: BRAND.text, borderRadius: 999, padding: "6px 10px", cursor: "pointer", fontWeight: 800 }}>{n}</button>)}</div>}
          {ex.sets.map((s, si) => <div key={si} style={{ display: "grid", gridTemplateColumns: isMobile ? "34px 1fr 1fr 76px" : "48px 1fr 1fr 100px", gap: 8, marginBottom: 6, alignItems: "center" }}><div style={{ color: BRAND.muted }}>S{si + 1}</div><input placeholder={timed ? "load/assist" : "kg"} value={s.weight || ""} onChange={(e) => setSet(ei, si, "weight", e.target.value)} style={inputStyle()} /><input placeholder={timed ? "time e.g. 30 sec" : "reps"} value={timed ? (s.duration || s.reps || "") : (s.reps || "")} onChange={(e) => setSet(ei, si, timed ? "duration" : "reps", e.target.value)} style={inputStyle()} /><select value={s.rpe || ""} onChange={(e) => setSet(ei, si, "rpe", e.target.value)} style={inputStyle()}>{RPE_OPTIONS.map((r) => <option key={r} value={r}>{r || "RPE"}</option>)}</select></div>)}
        </div>;
      })}
      <div style={{ borderTop: `1px solid ${BRAND.line}`, marginTop: 14, paddingTop: 14 }}><div style={{ color: BRAND.gold, fontSize: 13, fontWeight: 1000, marginBottom: 10 }}>METRIC DATA</div><div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}><Field label="Kcals" value={day.metrics?.kcal || ""} onChange={(v) => setMetric("kcal", v)} type="number" /><Field label="Max HR" value={day.metrics?.maxHR || ""} onChange={(v) => setMetric("maxHR", v)} type="number" /><Field label="Average HR" value={day.metrics?.avgHR || ""} onChange={(v) => setMetric("avgHR", v)} type="number" /></div></div>
      <Field label="Session notes" value={day.notes} onChange={(v) => setMeta("notes", v)} textarea />
    </>}
  </Card>;
}
 
 
function normalizeNutrition(raw) {
  const base = emptyNutrition();
  const n = raw && typeof raw === "object" ? raw : {};
  return {
    ...base,
    ...n,
    targets: { ...base.targets, ...(n.targets || {}) },
    mealPlan: { ...base.mealPlan, ...(n.mealPlan || {}) },
    logs: Array.isArray(n.logs) ? n.logs : [],
    daily: n.daily && typeof n.daily === "object" ? n.daily : {},
  };
}
 
function NutritionTab({ client, updateClient, isCoach }) {
  const isMobile = useIsMobile(760);
  const [nutrition, setNutrition] = useState(() => normalizeNutrition(client.nutrition));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [meal, setMeal] = useState("Breakfast");
  const [food, setFood] = useState("");
  const [customFood, setCustomFood] = useState("");
  const [customMacros, setCustomMacros] = useState({ kcal: "", protein: "", carbs: "", fats: "" });
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const smartEstimate = useMemo(() => estimateSmartFood(customFood), [customFood]);
  useEffect(() => {
    if (!customFood.trim()) return;
    if (!smartEstimate.matches.length) return;
    setCustomMacros({
      kcal: smartEstimate.kcal || "",
      protein: smartEstimate.protein || "",
      carbs: smartEstimate.carbs || "",
      fats: smartEstimate.fats || "",
    });
  }, [customFood, smartEstimate.kcal, smartEstimate.protein, smartEstimate.carbs, smartEstimate.fats]);
  useEffect(() => { setNutrition(normalizeNutrition(client.nutrition)); }, [client.id, client.nutrition]);
  const todays = (nutrition.logs || []).filter((l) => l.date === date);
  const daily = nutrition.daily?.[date] || {};
  const totals = todays.reduce((a, l) => ({ kcal: a.kcal + Number(l.kcal || 0), protein: a.protein + Number(l.protein || 0), carbs: a.carbs + Number(l.carbs || 0), fats: a.fats + Number(l.fats || 0) }), { kcal: 0, protein: 0, carbs: 0, fats: 0 });
  const targets = nutrition.targets || {};
  const score = todaysNutritionStats({ ...client, nutrition }, date).score;
  function setTarget(k, v) { setNutrition((n) => ({ ...n, targets: { ...n.targets, [k]: v } })); }
  function setMealPlan(k, v) { setNutrition((n) => ({ ...n, mealPlan: { ...n.mealPlan, [k]: v } })); }
  function setDaily(k, v) { setNutrition((n) => ({ ...n, daily: { ...(n.daily || {}), [date]: { ...(n.daily?.[date] || {}), [k]: v } } })); }
  async function save(nextNutrition = nutrition) {
    setSaving(true); setMessage("");
    try {
      const clean = normalizeNutrition(nextNutrition);
      await upsertSection(client.id, "nutrition", clean);
      setNutrition(clean);
      updateClient({ ...client, nutrition: clean });
      setMessage("Saved");
    } catch (e) { console.error("Nutrition save failed", e); alert(e.message || "Nutrition failed to save"); }
    setSaving(false);
  }
  async function addFood() {
    const selected = FOOD_DB.find((f) => f.name === food);
    if (!selected && !customFood.trim()) { alert("Choose a food or type a custom food name."); return; }
    const base = selected && !customFood.trim() ? selected : { name: customFood.trim(), kcal: Number(customMacros.kcal || smartEstimate.kcal || 0), protein: Number(customMacros.protein || smartEstimate.protein || 0), carbs: Number(customMacros.carbs || smartEstimate.carbs || 0), fats: Number(customMacros.fats || smartEstimate.fats || 0), smartEstimate };
    const q = Number(qty || 1);
    const entry = { id: uid(), date, meal, food: base.name, qty: q, kcal: Math.round(Number(base.kcal || 0) * q), protein: Math.round(Number(base.protein || 0) * q), carbs: Math.round(Number(base.carbs || 0) * q), fats: Math.round(Number(base.fats || 0) * q), estimate: base.smartEstimate || null };
    const next = normalizeNutrition({ ...nutrition, logs: [...(nutrition.logs || []), entry] });
    await save(next); setCustomFood(""); setCustomMacros({ kcal: "", protein: "", carbs: "", fats: "" }); setQty(1); setFood("");
  }
  async function delLog(id) { const next = normalizeNutrition({ ...nutrition, logs: (nutrition.logs || []).filter((l) => l.id !== id) }); await save(next); }
  async function saveDaily() { await save(nutrition); }
  const mealLogs = todays.filter((l) => l.meal === meal);
  const customActive = !!customFood.trim() || !food;
  return (
    <div style={{ display: "grid", gap: isMobile ? 10 : 14, maxWidth: "100%", overflowX: "hidden" }}>
      <Card style={{ background: `linear-gradient(135deg, ${client.color}22, ${BRAND.card})`, padding: isMobile ? 12 : 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", flexWrap: "wrap" }}>
          <div><div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 1000, color: BRAND.gold }}>Nutrition</div><div style={{ color: BRAND.green, fontWeight: 800, marginTop: 5 }}>{aiFoodSuggestions(client)}</div></div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle({ maxWidth: 170 })} />
        </div>
      </Card>
      <Card style={{ padding: isMobile ? 12 : 16 }}>
        <div style={{ display: isMobile ? "grid" : "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}><div><div style={{ color: BRAND.gold, fontWeight: 1000 }}>Daily Score</div><div style={{ fontSize: isMobile ? 30 : 42, fontWeight: 1000 }}>{score}%</div></div><div style={{ color: BRAND.muted }}>Estimated calories and macros. Restaurant portions vary.</div></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
          <Mini label="Calories" value={`${totals.kcal}/${targets.calories || 0}`} />
          <Mini label="Protein" value={`${totals.protein}g/${targets.protein || 0}g`} />
          <Mini label="Carbs" value={`${totals.carbs}g/${targets.carbs || 0}g`} />
          <Mini label="Fats" value={`${totals.fats}g/${targets.fats || 0}g`} />
          <Mini label="Water" value={`${daily.water || 0}L/${targets.water || 3}L`} />
          <Mini label="Steps" value={`${daily.steps || 0}/${targets.steps || 10000}`} />
        </div>
      </Card>
      <Card style={{ padding: isMobile ? 12 : 16 }}>
        <div style={{ fontSize: 18, fontWeight: 1000, marginBottom: 10 }}>Daily Habits</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
          <Field label="Steps" value={daily.steps || ""} onChange={(v) => setDaily("steps", v)} type="number" />
          <label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>WATER LITERS</div><select value={daily.water || ""} onChange={(e) => setDaily("water", e.target.value)} style={inputStyle()}>{WATER_LITERS.map((w) => <option key={w} value={w}>{w || "Water"}</option>)}</select></label>
          <label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>SLEEP HOURS</div><select value={daily.sleep || ""} onChange={(e) => setDaily("sleep", e.target.value)} style={inputStyle()}>{SLEEP_HOURS.map((h) => <option key={h} value={h}>{h || "Sleep"}</option>)}</select></label>
        </div>
        <Button onClick={saveDaily} disabled={saving} style={{ marginTop: 12 }}>{saving ? "Saving..." : "Save Daily Habits"}</Button>
      </Card>
      {isCoach && <Card>
        <div style={{ fontSize: 18, fontWeight: 1000, marginBottom: 10 }}>Coach Nutrition Targets</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>{["calories", "protein", "carbs", "fats", "steps", "water", "sleep"].map((k) => <Field key={k} label={`${k} target`} value={nutrition.targets[k] || ""} onChange={(v) => setTarget(k, v)} type="number" />)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 12 }}>{["Breakfast", "Lunch", "Dinner"].map((m) => <div key={m}><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 5 }}>{m.toUpperCase()} PLAN</div><textarea value={nutrition.mealPlan[m] || ""} onChange={(e) => setMealPlan(m, e.target.value)} placeholder={`Write ${m.toLowerCase()} foods, portions, notes...`} style={textareaStyle({ minHeight: 92 })} /></div>)}</div>
        <textarea value={nutrition.planNotes || ""} onChange={(e) => setNutrition((n) => ({ ...n, planNotes: e.target.value }))} placeholder="Coach notes: vegetarian/non-vegetarian, allergies, foods to avoid, meal timing..." style={textareaStyle({ minHeight: 80, marginTop: 10 })} />
        <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}><Button onClick={() => save()} disabled={saving}>{saving ? "Saving..." : "Save Nutrition Plan"}</Button>{message && <span style={{ color: BRAND.green, fontWeight: 900 }}>{message}</span>}</div>
      </Card>}
      <Card style={{ padding: isMobile ? 12 : 16 }}>
        <div style={{ fontSize: 18, fontWeight: 1000, marginBottom: 10 }}>Food Log</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, overflowX: "auto" }}>{["Breakfast", "Lunch", "Dinner"].map((m) => <Button key={m} variant={meal === m ? "gold" : "dark"} onClick={() => setMeal(m)}>{m}</Button>)}</div>
        {nutrition.mealPlan?.[meal] && <div style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 12, marginBottom: 12 }}><div style={{ color: BRAND.gold, fontWeight: 1000, marginBottom: 5 }}>{meal} Plan</div><div style={{ color: BRAND.text, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{nutrition.mealPlan[meal]}</div></div>}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(190px,1.4fr) minmax(260px,2fr) 90px 110px", gap: 8 }}>
          <select value={food} onChange={(e) => { setFood(e.target.value); if (e.target.value) setCustomFood(""); }} style={inputStyle()}><option value="">Select food</option>{FOOD_DB.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}</select>
          <input value={customFood} onChange={(e) => { setCustomFood(e.target.value); if (e.target.value) setFood(""); }} placeholder="Smart custom: 2 chapati + chicken curry + rice" style={inputStyle()} />
          <input type="number" step="0.5" value={qty} onChange={(e) => setQty(e.target.value)} style={inputStyle()} />
          <Button onClick={addFood}>Add</Button>
        </div>
        {customFood.trim() && <div style={{ marginTop: 10, padding: 12, border: `1px solid ${smartEstimate.confidence === "High" ? BRAND.green : BRAND.gold}`, borderRadius: 16, background: `${smartEstimate.confidence === "High" ? BRAND.green : BRAND.gold}12` }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}><b>Smart macro estimate</b><span style={{ color: smartEstimate.confidence === "High" ? BRAND.green : BRAND.gold, fontWeight: 1000 }}>{smartEstimate.confidence} confidence</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 8 }}><Mini label="Calories" value={smartEstimate.kcal || 0} /><Mini label="Protein" value={`${smartEstimate.protein || 0}g`} /><Mini label="Carbs" value={`${smartEstimate.carbs || 0}g`} /><Mini label="Fats" value={`${smartEstimate.fats || 0}g`} /></div>
          {smartEstimate.matches.length > 0 && <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 8 }}>Recognized: {smartEstimate.matches.map((m) => `${m.typed} → ${m.matched}${m.factor !== 1 ? ` x${m.factor}` : ""}`).join(" | ")}</div>}
          {smartEstimate.unmatched.length > 0 && <div style={{ color: BRAND.orange, fontSize: 12, marginTop: 5 }}>Needs review: {smartEstimate.unmatched.join(", ")}</div>}
        </div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8, marginTop: 10, opacity: customActive ? 1 : .5 }}><Field label="Kcal" value={customMacros.kcal} onChange={(v) => setCustomMacros((m) => ({ ...m, kcal: v }))} type="number" /><Field label="Protein" value={customMacros.protein} onChange={(v) => setCustomMacros((m) => ({ ...m, protein: v }))} type="number" /><Field label="Carbs" value={customMacros.carbs} onChange={(v) => setCustomMacros((m) => ({ ...m, carbs: v }))} type="number" /><Field label="Fats" value={customMacros.fats} onChange={(v) => setCustomMacros((m) => ({ ...m, fats: v }))} type="number" /></div>
        <div style={{ marginTop: 14 }}>{mealLogs.length === 0 && <div style={{ color: BRAND.muted, padding: "12px 0" }}>No {meal.toLowerCase()} foods logged yet.</div>}{mealLogs.map((l) => <div key={l.id} style={{ display: isMobile ? "grid" : "flex", justifyContent: "space-between", gap: 10, borderTop: `1px solid ${BRAND.line}`, paddingTop: 10, marginTop: 10 }}><div><b style={{ color: BRAND.text }}>{l.food}</b><div style={{ color: BRAND.muted }}>{l.qty}x · {l.kcal} kcal · P {l.protein}g · C {l.carbs}g · F {l.fats}g</div></div><Button variant="red" onClick={() => delLog(l.id)}>x</Button></div>)}</div>
      </Card>
    </div>
  );
}
 
function TransformPhotos({ client, updateClient }) {
  const isMobile = useIsMobile(760);
  const [photos, setPhotos] = useState(client.transformPhotos || []);
  const [form, setForm] = useState({ image: "", type: "Front", weight: "", notes: "", date: new Date().toISOString().slice(0, 10) });
  const beforePhoto = [...photos].find((p) => String(p.type || "").toLowerCase() === "before") || photos[photos.length - 1];
  const afterPhoto = [...photos].find((p) => String(p.type || "").toLowerCase() === "after") || photos[0];
  async function pickImage(file) { if (!file) return; const dataUrl = await readFileAsDataUrl(file); setForm((f) => ({ ...f, image: dataUrl })); }
  async function add() { if (!form.image) { alert("Choose a photo from your device first."); return; } const next = [{ id: uid(), ...form }, ...photos]; setPhotos(next); await upsertSection(client.id, "transformPhotos", next); updateClient({ ...client, transformPhotos: next }); setForm({ ...form, image: "", notes: "" }); }
  async function del(id) { const next = photos.filter((p) => p.id !== id); setPhotos(next); await upsertSection(client.id, "transformPhotos", next); updateClient({ ...client, transformPhotos: next }); }
  const photoCard = (photo, label) => <div style={{ background: "linear-gradient(180deg,#151821,#0d0f15)", border: `1px solid ${BRAND.line}`, borderRadius: 22, overflow: "hidden", minHeight: isMobile ? 210 : 260 }}><div style={{ padding: 12, color: BRAND.gold, fontWeight: 1000 }}>{label}</div>{photo?.image || photo?.url ? <img src={photo.image || photo.url} alt={label} style={{ width: "100%", height: isMobile ? 190 : 260, objectFit: "cover" }} /> : <div style={{ height: isMobile ? 190 : 260, display: "grid", placeItems: "center", color: BRAND.muted }}>No {label.toLowerCase()} photo yet</div>}{photo && <div style={{ padding: 12 }}><b>{photo.type}</b><div style={{ color: BRAND.muted }}>{photo.date} · {photo.weight ? `${photo.weight}kg` : "No weight"}</div><div style={{ color: BRAND.text }}>{photo.notes}</div></div>}</div>;
  return <Card style={{ padding: isMobile ? 12 : 16 }}><div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 1000, marginBottom: 12 }}>Transform Photos</div>
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(240px,1fr))", gap: 14, marginBottom: 16 }}>
      {photoCard(beforePhoto, "Before")}
      {photoCard(afterPhoto, "After")}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}><div><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>CHOOSE PHOTO</div><input type="file" accept="image/*" onChange={(e) => pickImage(e.target.files?.[0])} style={inputStyle()} /></div><label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>TYPE</div><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={inputStyle()}>{PHOTO_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label><Field label="Weight" value={form.weight} onChange={(v) => setForm({ ...form, weight: v })} /><Field label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} /></div>{form.image && <img src={form.image} alt="preview" style={{ width: 160, height: 160, objectFit: "cover", borderRadius: 18, marginTop: 12 }} />}<Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} textarea /><Button onClick={add} style={{ marginTop: 10 }}>Save Photo</Button><div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginTop: 14 }}>{photos.map((p) => <div key={p.id} style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 16, overflow: "hidden" }}>{p.image || p.url ? <img src={p.image || p.url} alt="progress" style={{ width: "100%", height: 180, objectFit: "cover" }} /> : <div style={{ height: 180, display: "grid", placeItems: "center", color: BRAND.muted }}>No image</div>}<div style={{ padding: 10 }}><b>{p.type}</b><div style={{ color: BRAND.muted }}>{p.date} · {p.weight}kg</div><div style={{ color: BRAND.text }}>{p.notes}</div><Button variant="red" onClick={() => del(p.id)} style={{ marginTop: 8 }}>Delete</Button></div></div>)}</div></Card>;
}
 
function ProgressTab({ client }) {
  const isMobile = useIsMobile(760);
  const latest = client.progress?.[client.progress.length - 1] || {};
  const metrics = computePerformanceMetrics(client.program);
  const coachSessions = recentCompletedSessions(client.program, 8).map((d) => ({ ...d, source: "Coach/Program" }));
  const selfSessions = (client.workoutLogs || []).map((l) => ({ id: l.id, date: l.date, name: l.workout || "Self Training", source: "Client", notes: l.notes, summary: [l.weights, l.cardio, l.rpe && `RPE ${l.rpe}`].filter(Boolean).join(" · ") })).filter((l) => l.date || l.summary || l.notes);
  const attendedSessions = [...coachSessions, ...selfSessions].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 8);
  const nutritionStats = todaysNutritionStats(client);
  return <div style={{ display: "grid", gap: isMobile ? 10 : 16, maxWidth: "100%", overflowX: "hidden" }}>
    <Card style={{ background: `radial-gradient(circle at 20% 15%, ${client.color}22, transparent 35%), linear-gradient(180deg, #151821, #090a0e)` }}>
      <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 1000, letterSpacing: 2 }}>PROGRESS DASHBOARD</div>
      <div style={{ fontSize: isMobile ? 22 : 29, fontWeight: 1000, marginTop: 6 }}>Your performance trend</div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginTop: 14 }}>
        <PremiumTile label="Today Score" value={`${nutritionStats.score}%`} color={client.color} />
        <PremiumTile label="Steps" value={nutritionStats.daily.steps || 0} sub="today" color={BRAND.gold} />
        <PremiumTile label="Attended Sessions" value={attendedSessions.length} color={BRAND.cyan} />
      </div>
    </Card>
    <Card><div style={{ fontSize: 22, fontWeight: 1000, marginBottom: 12 }}>Performance Metrics</div><div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>{metrics.map((m) => <div key={m.name} style={{ background: "linear-gradient(180deg,#151821,#0d0f15)", border: `1px solid ${BRAND.line}`, borderRadius: 22, padding: 14 }}><div style={{ color: BRAND.gold, fontWeight: 1000 }}>{m.name}</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}><Mini label="PB" value={metricDisplay(m.best, m.timed)} /><Mini label="Recent" value={metricDisplay(m.recent, m.timed)} /></div><div style={{ color: m.trend > 0 ? BRAND.green : BRAND.muted, fontSize: 12, fontWeight: 900, marginTop: 10 }}>Trend: {m.trend > 0 ? "+" : ""}{m.trend || 0}{m.timed ? " sec" : " kg"}</div></div>)}</div></Card>
    <Card><div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 12 }}>Attended Session History</div>{attendedSessions.length === 0 && <div style={{ color: BRAND.muted }}>No attended sessions logged yet.</div>}{attendedSessions.map((d, i) => <div key={d.id || i} style={{ borderTop: `1px solid ${BRAND.line}`, paddingTop: 12, marginTop: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><b>{d.date || "No date"} · {d.name}</b><span style={{ color: BRAND.muted }}>{d.source || (d.weekNum ? `Week ${d.weekNum}` : "Session")}</span></div>{d.sessionData ? <div style={{ color: BRAND.muted, marginTop: 6 }}>{(d.sessionData || []).map((ex) => `${ex.name}: ${(ex.sets || []).map((s) => isTimedExercise(ex.name) ? (s.duration || s.reps || "") : [s.weight && `${s.weight}kg`, s.reps && `${s.reps} reps`].filter(Boolean).join(" x ")).filter(Boolean).join(", ") || "not logged"}`).join(" | ")}</div> : <div style={{ color: BRAND.muted, marginTop: 6 }}>{d.summary || d.notes}</div>}{d.metrics && <div style={{ color: BRAND.gold, fontSize: 12, marginTop: 6 }}>Kcal {d.metrics.kcal || "-"} · Max HR {d.metrics.maxHR || "-"} · Avg HR {d.metrics.avgHR || "-"}</div>}</div>)}</Card>
    <Card><div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 12 }}>Classic Lifts</div><div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>{LIFT_FIELDS.map((f) => <Mini key={f.key} label={f.label} value={latest[f.key] || "-"} />)}</div></Card>
  </div>;
}
 
function ScheduleTab({ client, updateClient }) {
  const isMobile = useIsMobile(760);
  const [schedule, setSchedule] = useState(client.schedule || []);
  const [form, setForm] = useState({ day: "Mon", time: DEFAULT_TIME_SLOTS[0] });
  async function save(next) { setSchedule(next); await upsertSection(client.id, "sessions", { schedule: next, checkIns: client.checkIns || [], sessions: client.sessions || 0 }); updateClient({ ...client, schedule: next }); }
  return <Card style={{ padding: isMobile ? 12 : 16 }}><div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 1000, marginBottom: 12 }}>Recurring Schedule</div><div style={{ color: BRAND.muted, marginBottom: 12 }}>These recurring times automatically appear in the main Calendar.</div><div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr auto", gap: 8 }}><select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} style={inputStyle()}>{DAYS.map((d) => <option key={d}>{d}</option>)}</select><select value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} style={inputStyle()}>{DEFAULT_TIME_SLOTS.map((t, i) => <option key={`${t}_${i}`} value={t}>{timeLabel(t)}</option>)}</select><Button onClick={() => save([...schedule, { ...form, id: uid() }])}>Add</Button></div><div style={{ marginTop: 12 }}>{schedule.map((s, i) => <div key={s.id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${BRAND.line}`, padding: 10 }}><b>{s.day} · {timeLabel(s.time)}</b><Button variant="red" onClick={() => save(schedule.filter((_, j) => j !== i))}>x</Button></div>)}</div></Card>;
}
function InviteTab({ client, updateClient }) {
  const [code, setCode] = useState(client.inviteCode || makeInviteCode());
  async function saveInvite() { await supabase.from("clients").update({ invite_code: code, invite_status: "sent" }).eq("id", client.id); updateClient({ ...client, inviteCode: code, inviteStatus: "sent" }); }
  const link = `${window.location.origin}?invite=${code}`;
  return <Card><div style={{ fontSize: 22, fontWeight: 1000 }}>Invite Client</div><div style={{ color: BRAND.muted, marginBottom: 12 }}>Client uses this code to claim the profile you created.</div><Field label="Invite Code" value={code} onChange={(v) => setCode(v.toUpperCase())} /><Button onClick={saveInvite} style={{ marginTop: 10 }}>Save Invite</Button><div style={{ marginTop: 12, color: BRAND.green, wordBreak: "break-all" }}>{link}</div></Card>;
}
 
function ClientWorkoutLog({ client, updateClient }) {
  const isMobile = useIsMobile(760);
  const [logs, setLogs] = useState(client.workoutLogs || []);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), workout: "", weights: "", cardio: "", rpe: "", notes: "" });
  async function add() { const next = [{ id: uid(), ...form }, ...logs]; setLogs(next); await upsertSection(client.id, "workoutLogs", next); updateClient({ ...client, workoutLogs: next }); setForm({ ...form, workout: "", weights: "", cardio: "", rpe: "", notes: "" }); }
  return <Card style={{ padding: isMobile ? 12 : 16 }}><div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 1000 }}>Workout Log</div><div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}><Field label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} /><Field label="Workout done" value={form.workout} onChange={(v) => setForm({ ...form, workout: v })} /><Field label="Weights / reps" value={form.weights} onChange={(v) => setForm({ ...form, weights: v })} /><Field label="Cardio" value={form.cardio} onChange={(v) => setForm({ ...form, cardio: v })} /><label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 }}>RPE</div><select value={form.rpe || ""} onChange={(e) => setForm({ ...form, rpe: e.target.value })} style={inputStyle()}>{RPE_OPTIONS.map((r) => <option key={r} value={r}>{r || "RPE"}</option>)}</select></label></div><Field label="Notes" textarea value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} /><Button onClick={add} style={{ marginTop: 10 }}>Log Workout</Button>{logs.map((l) => <div key={l.id} style={{ borderTop: `1px solid ${BRAND.line}`, marginTop: 12, paddingTop: 12 }}><b>{l.date} - {l.workout}</b><div style={{ color: BRAND.muted }}>{l.weights} · {l.cardio} · RPE {l.rpe}</div><div>{l.notes}</div></div>)}</Card>;
}
 
function PackagesTab({ client, updateClient }) {
  const isMobile = useIsMobile(760);
  const [packages, setPackages] = useState(client.packages || []);
  const [form, setForm] = useState({ name: "10 Session Pack", total: 10, used: 0, price: "", paid: false });
  async function save(next) { setPackages(next); await upsertSection(client.id, "packages", next); updateClient({ ...client, packages: next }); }
  function addPackage() { const next = [{ id: uid(), ...form, total: Number(form.total || 0), used: Number(form.used || 0), price: Number(form.price || 0) }, ...packages]; save(next); setForm({ name: "10 Session Pack", total: 10, used: 0, price: "", paid: false }); }
  const totalSessions = packages.reduce((a, p) => a + Number(p.total || 0), 0);
  const usedSessions = packages.reduce((a, p) => a + Number(p.used || 0), 0);
  return <Card><div style={{ fontSize: 22, fontWeight: 1000, marginBottom: 12 }}>Packages</div><div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 14 }}><Mini label="Total Sessions" value={totalSessions} /><Mini label="Used" value={usedSessions} /><Mini label="Left" value={Math.max(totalSessions - usedSessions, 0)} /></div><div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}><Field label="Package name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} /><Field label="Total sessions" type="number" value={form.total} onChange={(v) => setForm({ ...form, total: v })} /><Field label="Used sessions" type="number" value={form.used} onChange={(v) => setForm({ ...form, used: v })} /><Field label="Price AED" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} /></div><label style={{ display: "block", marginTop: 10, color: BRAND.muted }}><input type="checkbox" checked={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.checked })} /> Paid</label><Button onClick={addPackage} style={{ marginTop: 12 }}>Add Package</Button><div style={{ marginTop: 14 }}>{packages.map((p) => { const left = Math.max(Number(p.total || 0) - Number(p.used || 0), 0); return <div key={p.id} style={{ borderTop: `1px solid ${BRAND.line}`, paddingTop: 12, marginTop: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div><b>{p.name}</b><div style={{ color: BRAND.muted }}>{Number(p.used || 0)}/{Number(p.total || 0)} used · {left} left · {moneyAED(p.price)} · {p.paid ? "Paid" : "Unpaid"}</div></div><div style={{ display: "flex", gap: 6 }}><Button variant="dark" onClick={() => save(packages.map((x) => x.id === p.id ? { ...x, used: Math.min(Number(x.used || 0) + 1, Number(x.total || 0)) } : x))}>+ Use</Button><Button variant="red" onClick={() => save(packages.filter((x) => x.id !== p.id))}>x</Button></div></div></div>})}</div></Card>;
}
 
function Calendar({ clients, refresh, user }) {
  const [slots, setSlots] = useState(() => normalizeSlots(JSON.parse(localStorage.getItem("forge_time_slots") || "null")));
  const [zoom, setZoom] = useState(() => Number(localStorage.getItem("forge_calendar_zoom") || 1));
  const [bookings, setBookings] = useState([]);
  const [newSlot, setNewSlot] = useState("");
  const [draft, setDraft] = useState(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const days = weekDays(weekStart);
  const currentWeekKey = weekKey(weekStart);
  useEffect(() => { load(); }, []);
  async function load() { const uidVal = user?.id || (await supabase.auth.getUser()).data.user?.id; const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", uidVal).eq("section", "calendar").maybeSingle(); setBookings(data?.data?.bookings || []); }
  async function save(next) { setBookings(next); const uidVal = user?.id || (await supabase.auth.getUser()).data.user?.id; await upsertTrainerData(uidVal, "calendar", { bookings: next }); }
  function autoBookings() { return clients.flatMap((c) => (c.schedule || []).map((s) => { const foundDay = days.find((d) => d.name === s.day); return { id: `auto_${currentWeekKey}_${c.id}_${s.day}_${s.time}`, weekKey: currentWeekKey, date: foundDay?.date || "", day: s.day, time: s.time, title: c.name, type: "Client Session", color: c.color, auto: true, clientId: c.id }; })); }
  const all = [...autoBookings(), ...bookings.filter((b) => b.weekKey === currentWeekKey || days.some((d) => d.date === b.date))];
  function removeSlot(id) { const next = slots.filter((x) => x.id !== id); setSlots(next); localStorage.setItem("forge_time_slots", JSON.stringify(next)); }
  function addSlot() { if (!newSlot) return; const next = [...slots, { id: uid(), label: newSlot }]; setSlots(next); localStorage.setItem("forge_time_slots", JSON.stringify(next)); setNewSlot(""); }
  function openBooking(dayObj, slot, existing) { const b = existing || {}; const client = clients.find((c) => c.id === b.clientId) || clients[0]; setDraft({ id: b.id || null, weekKey: currentWeekKey, date: dayObj.date, day: dayObj.name, time: b.time || slot.label, type: b.type || "Client Session", clientId: b.clientId || client?.id || "", title: b.title || client?.name || "", color: b.color || client?.color || BRAND.blue, auto: !!b.auto }); }
  function saveDraft() { if (!draft?.title) { alert("Add a booking name or choose a client."); return; } const color = draft.type === "Free Trial" ? BRAND.red : draft.color; const clean = { ...draft, color, auto: false, id: draft.id?.startsWith("auto_") ? uid() : draft.id || uid() }; save([...(bookings.filter((x) => x.id !== draft.id)), clean]); setDraft(null); }
  const goWeek = (n) => setWeekStart((w) => addDays(w, n * 7));
  function setCalendarZoom(next) {
    const clean = Math.max(0.45, Math.min(1.8, Number(next)));
    setZoom(clean);
    localStorage.setItem("forge_calendar_zoom", String(clean));
  }
  const calendarCellHeight = zoom <= 0.7 ? 48 : zoom >= 1.25 ? 82 : 64;
  const calendarMinWidth = zoom <= 0.75 ? 760 : 920;
  return <Card style={{ overflowX: "auto" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
      <div><div style={{ fontSize: 24, fontWeight: 1000, color: BRAND.gold }}>Calendar</div><div style={{ color: BRAND.muted }}>{weekRangeLabel(weekStart)}</div></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Button variant="dark" onClick={() => goWeek(-1)}>Previous Week</Button><Button variant="dark" onClick={() => setWeekStart(startOfWeek(new Date()))}>This Week</Button><Button variant="dark" onClick={() => goWeek(1)}>Next Week</Button></div>
    </div>
    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
      <input value={newSlot} onChange={(e) => setNewSlot(e.target.value)} placeholder="Add time e.g. 6:30 PM" style={inputStyle({ maxWidth: 190 })} /><Button onClick={addSlot}>Add time</Button>
      <Button variant="dark" onClick={() => setCalendarZoom(zoom - 0.1)}>Zoom -</Button><input type="range" min="0.45" max="1.8" step="0.05" value={zoom} onChange={(e) => setCalendarZoom(e.target.value)} style={{ width: 180 }} /><div style={{ color: BRAND.muted, fontWeight: 900 }}>{Math.round(zoom * 100)}%</div><Button variant="dark" onClick={() => setCalendarZoom(zoom + 0.1)}>Zoom +</Button><Button variant="ghost" onClick={() => setCalendarZoom(0.65)}>Fit Week</Button><Button variant="ghost" onClick={() => setCalendarZoom(1)}>Reset</Button>
    </div>
    <div style={{ overflowX: "auto", overflowY: "hidden", width: "100%" }}>
      <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: `${100 / zoom}%`, minWidth: calendarMinWidth }}>
        <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "separate", borderSpacing: zoom < 0.75 ? 4 : 6, minWidth: calendarMinWidth }}><thead><tr><th style={{ width: 90 }}></th>{days.map((d) => <th key={d.date} style={{ color: BRAND.gold }}>{d.label}</th>)}</tr></thead><tbody>{slots.map((slot) => <tr key={slot.id}><td style={{ color: BRAND.muted, fontWeight: 900, width: 90 }}>{timeLabel(slot.label)} <button onClick={() => removeSlot(slot.id)} style={{ background: "transparent", border: "none", color: BRAND.red, cursor: "pointer" }}>x</button></td>{days.map((d) => { const b = all.find((x) => (x.date === d.date || x.day === d.name) && timeKey(x.time) === timeKey(slot.label)); return <td key={d.date} onClick={() => openBooking(d, slot, b)} style={{ height: calendarCellHeight, width: 120, background: b ? b.color : "#0b0c10", color: b ? "#000" : BRAND.dim, border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: zoom < 0.75 ? 5 : 8, cursor: "pointer", fontWeight: 900, verticalAlign: "top", overflow: "hidden" }}>{b ? <><div style={{ fontSize: zoom < 0.75 ? 10 : 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.type === "Free Trial" ? "TRIAL" : b.title}</div><div style={{ fontSize: 10, opacity: .75 }}>{b.time}</div></> : ""}{b && !b.auto && <button onClick={(e) => { e.stopPropagation(); save(bookings.filter((x) => x.id !== b.id)); }} style={{ float: "right", background: "transparent", border: "none", cursor: "pointer" }}>x</button>}</td>; })}</tr>)}</tbody></table>
      </div>
    </div>
    {draft && <div style={modalBackdrop()}><Card style={{ width: "100%", maxWidth: 540 }}><div style={{ fontSize: 24, fontWeight: 1000, marginBottom: 12 }}>{draft.auto ? "Reschedule" : "Book"} {draft.day} · {draft.time}</div><label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>TYPE</div><select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value, color: e.target.value === "Free Trial" ? BRAND.red : draft.color })} style={inputStyle()}><option>Client Session</option><option>Free Trial</option><option>Consultation</option></select></label>{draft.type !== "Free Trial" && <label style={{ display: "block", marginTop: 10 }}><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>CLIENT</div><select value={draft.clientId} onChange={(e) => { const c = clients.find((x) => x.id === e.target.value); setDraft({ ...draft, clientId: e.target.value, title: c?.name || draft.title, color: c?.color || draft.color }); }} style={inputStyle()}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}<Field label="Booking name" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} /><label style={{ display: "block", marginTop: 10 }}><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>TIME</div><select value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} style={inputStyle()}>{slots.map((s) => <option key={s.id}>{s.label}</option>)}</select></label><div style={{ marginTop: 10 }}><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>COLOR</div><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{CLIENT_COLORS.map((c) => <button key={c} disabled={draft.type === "Free Trial"} onClick={() => setDraft({ ...draft, color: c })} style={{ width: 34, height: 34, borderRadius: 12, border: draft.color === c ? `3px solid ${BRAND.text}` : `1px solid ${BRAND.line}`, background: draft.type === "Free Trial" ? BRAND.red : c, opacity: draft.type === "Free Trial" ? .45 : 1, cursor: "pointer" }} />)}</div></div><div style={{ display: "flex", gap: 10, marginTop: 14 }}><Button onClick={saveDraft} style={{ flex: 1 }}>Save booking</Button><Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button></div></Card></div>}
  </Card>;
}
 
 
function RatingSelect({ label, value, onChange }) {
  return <label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>{label}</div><select value={value || ""} onChange={(e) => onChange(e.target.value)} style={inputStyle()}><option value="">Choose 1-5</option>{[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>;
}
function Trials({ user }) {
  const [trials, setTrials] = useState([]);
  const [tab, setTab] = useState("consultation");
  const [openTrial, setOpenTrial] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", goal: "", fitnessHistory: "", barriers: "", injuries: "", medicalIssues: "", nutrition: "", sleep: "", neat: "", fatLossImportance: "", muscleGainImportance: "", strengthEnduranceImportance: "", mobilityFlexibilityImportance: "", assessmentDate: "", cardiovascular: "", squat: "", pushStrength: "", pullStrength: "", coreStrength: "", flexibilityFitness: "" });
  useEffect(() => { load(); }, []);
  async function load() { const uidVal = user?.id || (await supabase.auth.getUser()).data.user?.id; const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", uidVal).eq("section", "trials").maybeSingle(); setTrials(data?.data?.trials || []); }
  async function save(next) { setTrials(next); const uidVal = user?.id || (await supabase.auth.getUser()).data.user?.id; await upsertTrainerData(uidVal, "trials", { trials: next }); }
  function set(k, v) { setForm({ ...form, [k]: v }); }
  function saveTrial() { const saved = { id: form.id || uid(), ...form, savedAt: new Date().toISOString() }; save([saved, ...trials.filter((t) => t.id !== saved.id)]); setForm({ name: "", phone: "", email: "", goal: "", fitnessHistory: "", barriers: "", injuries: "", medicalIssues: "", nutrition: "", sleep: "", neat: "", fatLossImportance: "", muscleGainImportance: "", strengthEnduranceImportance: "", mobilityFlexibilityImportance: "", assessmentDate: "", cardiovascular: "", squat: "", pushStrength: "", pullStrength: "", coreStrength: "", flexibilityFitness: "" }); }
  return <div style={{ display: "grid", gap: 14 }}><Card><div style={{ fontSize: 24, fontWeight: 1000, color: BRAND.gold }}>Trials</div><div style={{ display: "flex", gap: 8, margin: "12px 0" }}><Button variant={tab === "consultation" ? "gold" : "dark"} onClick={() => setTab("consultation")}>Consultation</Button><Button variant={tab === "assessment" ? "gold" : "dark"} onClick={() => setTab("assessment")}>Fitness Assessment</Button></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}><Field label="Name" value={form.name} onChange={(v) => set("name", v)} /><Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} /><Field label="Email" value={form.email} onChange={(v) => set("email", v)} />{tab === "consultation" ? <><Field label="Goal" value={form.goal} onChange={(v) => set("goal", v)} textarea /><Field label="Fitness history" value={form.fitnessHistory} onChange={(v) => set("fitnessHistory", v)} textarea /><Field label="Barriers" value={form.barriers} onChange={(v) => set("barriers", v)} textarea /><Field label="Injuries" value={form.injuries} onChange={(v) => set("injuries", v)} textarea /><Field label="Medical issues" value={form.medicalIssues} onChange={(v) => set("medicalIssues", v)} textarea /><Field label="Nutrition" value={form.nutrition} onChange={(v) => set("nutrition", v)} textarea /><Field label="Sleep" value={form.sleep} onChange={(v) => set("sleep", v)} textarea /><Field label="NEAT / daily activity" value={form.neat} onChange={(v) => set("neat", v)} textarea /><div style={{ gridColumn: "1 / -1", color: BRAND.gold, fontWeight: 1000, marginTop: 8 }}>On a scale of 1-5, rate how important these are to the client:</div><RatingSelect label="Fat loss" value={form.fatLossImportance} onChange={(v) => set("fatLossImportance", v)} /><RatingSelect label="Muscle gain" value={form.muscleGainImportance} onChange={(v) => set("muscleGainImportance", v)} /><RatingSelect label="Strength and endurance" value={form.strengthEnduranceImportance} onChange={(v) => set("strengthEnduranceImportance", v)} /><RatingSelect label="Mobility & flexibility" value={form.mobilityFlexibilityImportance} onChange={(v) => set("mobilityFlexibilityImportance", v)} /></> : <><Field label="Date" type="date" value={form.assessmentDate} onChange={(v) => set("assessmentDate", v)} /><Field label="Cardiovascular fitness" value={form.cardiovascular} onChange={(v) => set("cardiovascular", v)} /><Field label="Squat" value={form.squat} onChange={(v) => set("squat", v)} /><Field label="Push strength" value={form.pushStrength} onChange={(v) => set("pushStrength", v)} /><Field label="Pull strength" value={form.pullStrength} onChange={(v) => set("pullStrength", v)} /><Field label="Core strength" value={form.coreStrength} onChange={(v) => set("coreStrength", v)} /><Field label="Flexibility fitness" value={form.flexibilityFitness} onChange={(v) => set("flexibilityFitness", v)} /></>}</div><Button onClick={saveTrial} style={{ marginTop: 12 }}>Save Trial</Button></Card><Card><div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 10 }}>Saved Trials</div>{trials.length === 0 && <div style={{ color: BRAND.muted }}>No saved trials yet.</div>}{trials.map((t) => <div key={t.id} onClick={() => setOpenTrial(t)} style={{ borderTop: `1px solid ${BRAND.line}`, paddingTop: 12, marginTop: 12, cursor: "pointer" }}><b>{t.name}</b><div style={{ color: BRAND.muted }}>{t.phone} · {t.email}</div><div style={{ color: BRAND.gold, fontSize: 12, fontWeight: 900 }}>Tap to open</div></div>)}</Card>{openTrial && <div style={modalBackdrop()}><Card style={{ width: "100%", maxWidth: 760, maxHeight: "90vh", overflow: "auto" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 12 }}><div><div style={{ fontSize: 24, fontWeight: 1000 }}>{openTrial.name}</div><div style={{ color: BRAND.muted }}>{openTrial.phone} · {openTrial.email}</div></div><Button variant="ghost" onClick={() => setOpenTrial(null)}>X</Button></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>{Object.entries(openTrial).filter(([k]) => !["id","savedAt"].includes(k)).map(([k,v]) => <Mini key={k} label={k.replace(/([A-Z])/g, " $1")} value={String(v || "-")} />)}</div><div style={{ display: "flex", gap: 10, marginTop: 14 }}><Button variant="dark" onClick={() => { setForm(openTrial); setOpenTrial(null); }}>Edit</Button><Button variant="red" onClick={() => { save(trials.filter((x) => x.id !== openTrial.id)); setOpenTrial(null); }}>Delete</Button></div></Card></div>}</div>;
}
 
 
export default function App() {
  const isMobile = useIsMobile(760);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trainer, setTrainer] = useState(null);
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [clientPortal, setClientPortal] = useState(null);
  const [syncStatus, setSyncStatus] = useState(typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline");
 
  useEffect(() => {
    ensureMobileViewport();
    const goOnline = async () => { setSyncStatus("syncing"); await flushSyncQueue(); setSyncStatus("online"); if (session?.user) loadCoach(session.user); };
    const goOffline = () => setSyncStatus("offline");
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (data.session) boot(data.session.user); else setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => { setSession(sess); if (sess) boot(sess.user); else { setLoading(false); setTrainer(null); setClients([]); setClientPortal(null); } });
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); sub.subscription.unsubscribe(); };
  }, []);
 
  async function boot(user) {
    const cached = readForgeCache(user.id);
    if (cached) {
      setTrainer(cached.trainer || null);
      setClients(cached.clients || []);
      setClientPortal(cached.clientPortal || null);
      setLoading(false);
    } else {
      setLoading(true);
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSyncStatus("offline");
      setLoading(false);
      return;
    }
    setSyncStatus("syncing");
    await flushSyncQueue();
    await ensureTrainer(user);
    await loadRole(user);
    setSyncStatus("online");
    setLoading(false);
  }
 
  async function ensureTrainer(user) {
    const email = user.email || "";
    const { data: existing } = await supabase.from("trainers").select("id").eq("id", user.id).maybeSingle();
    if (!existing) {
      const name = user.user_metadata?.name || email.split("@")[0] || "Coach";
      await supabase.from("trainers").insert({ id: user.id, email, name, role: "Coach" });
    } else {
      await supabase.from("trainers").update({ email }).eq("id", user.id);
    }
  }
 
  async function loadRole(user) {
    const { data: clientMatch } = await supabase.from("clients").select("*").eq("client_user_id", user.id).maybeSingle();
    if (clientMatch) {
      const { data: rows } = await supabase.from("client_data").select("*").eq("client_id", clientMatch.id);
      const mappedClient = mapClient(clientMatch, rows || []);
      setClientPortal(mappedClient);
      setSelected(null); setClients([]);
      saveForgeCache(user.id, { trainer: null, clients: [], clientPortal: mappedClient });
      return;
    }
    await loadCoach(user);
  }
 
  async function loadCoach(user = session?.user) {
    if (!user) return;
    const { data: trainerRow } = await supabase.from("trainers").select("*").eq("id", user.id).maybeSingle();
    setTrainer(trainerRow || { id: user.id, name: user.email?.split("@")[0], email: user.email });
 
    if ((user.email || "").toLowerCase() === DENIS_EMAIL) {
      await supabase.from("clients").update({ trainer_id: user.id }).is("trainer_id", null);
    }
 
    const { data: clientRows, error } = await supabase.from("clients").select("*").eq("trainer_id", user.id).order("created_at", { ascending: false });
    if (error) { console.error(error); setClients([]); return; }
    const ids = (clientRows || []).map((c) => c.id);
    let dataRows = [];
    if (ids.length) {
      const { data } = await supabase.from("client_data").select("*").in("client_id", ids);
      dataRows = data || [];
    }
    const mapped = (clientRows || []).map((r, i) => mapClient(r, dataRows, i));
    setClients(mapped);
    saveForgeCache(user.id, { trainer: trainerRow || { id: user.id, name: user.email?.split("@")[0], email: user.email }, clients: mapped, clientPortal: null });
  }
 
  async function refreshClient(clientId) {
    if (!clientId || !session?.user?.id) return;
    try {
      const { data: row } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
      if (!row) return;
      const { data: dataRows } = await supabase.from("client_data").select("*").eq("client_id", clientId);
      const refreshed = mapClient(row, dataRows || []);
      updateClient(refreshed);
    } catch (error) {
      console.warn("Failed to refresh client after program save", error);
    }
  }

  function updateClient(updated) {
    const userId = session?.user?.id;
    setClients((prev) => {
      const next = prev.map((c) => c.id === updated.id ? updated : c);
      if (userId) saveForgeCache(userId, { trainer, clients: next, clientPortal: null });
      return next;
    });
    setSelected(updated);
    setClientPortal((p) => {
      const nextPortal = p?.id === updated.id ? updated : p;
      if (userId && nextPortal) saveForgeCache(userId, { trainer: null, clients: [], clientPortal: nextPortal });
      return nextPortal;
    });
  }
 
  if (loading) return <div style={{ minHeight: "100vh", background: BRAND.bg, color: BRAND.gold, display: "grid", placeItems: "center", fontSize: isMobile ? 22 : 28, fontWeight: 1000 }}>FORGE loading...</div>;
  if (!session) return <LoginScreen onReady={() => supabase.auth.getSession().then(({ data }) => data.session && boot(data.session.user))} />;
  if (clientPortal) return <ClientView client={clientPortal} updateClient={updateClient} isCoach={false} refresh={() => boot(session.user)} refreshClient={refreshClient} />;
  if (selected) return <ClientView client={selected} updateClient={updateClient} back={() => setSelected(null)} refresh={() => loadCoach(session.user)} refreshClient={refreshClient} isCoach />;
  return <CoachDashboard user={session.user} trainer={trainer} setTrainer={setTrainer} clients={clients} setClients={setClients} selectClient={setSelected} refresh={() => loadCoach(session.user)} syncStatus={syncStatus} />;
}
