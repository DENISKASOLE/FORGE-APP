

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient.js";
 
const textareaStyle = (extra = {}) => ({
  width: "100%",
  minHeight: 90,
  background: "#111",
  border: "1px solid #333",
  borderRadius: 12,
  color: "#fff",
  padding: "12px",
  resize: "vertical",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  ...extra,
});
 
/*
  FORGE V5.0 - Client Portal Pro + Fast Resume + Offline Sync
  ------------------------------------------------
  What this version includes:
  - One clean login screen: "Welcome back"
  - Seamless trainer account creation
  - Forgot password via Supabase Auth
  - Coach dashboard: each trainer sees only their own clients
  - Denis keeps existing unassigned clients if logged in with kendenisdubai@gmail.com
  - Invite-based client access: coach creates profile first, client claims it with invite code
  - Client portal: food log, workout log, progress photos, profile view
  - Program builder restored to previous week/day style, with AI builder and recap
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
  - Program Templates: Men's Fat Loss, Female Fat Loss, Muscle Gain, Upper Lower, PPL
  - Use Template button applies a reusable program to any client, then you can edit it
*/
 
const BRAND = {
  bg: "#070707",
  panel: "#0f1013",
  card: "#15161b",
  card2: "#1b1d24",
  line: "#2a2d36",
  text: "#f5f5f5",
  muted: "#a1a1aa",
  dim: "#6b7280",
  gold: "#E8C547",
  red: "#FF4D4D",
  green: "#54D990",
  cyan: "#4ECDC4",
  blue: "#60A5FA",
  purple: "#A78BFA",
  orange: "#FB923C",
};
 
const GOAL_OPTIONS = [
  "Fat Loss",
  "Muscle Gain",
  "Strength",
  "Endurance",
  "Mobility",
  "General Fitness",
  "Rehab",
  "Lifestyle",
];
 
const CLIENT_COLORS = [
  "#E8C547",
  "#4ECDC4",
  "#A78BFA",
  "#6EE7B7",
  "#FB923C",
  "#60A5FA",
  "#F472B6",
  "#F97316",
  "#22D3EE",
  "#84CC16",
  "#C084FC",
];
 
const LIFT_FIELDS = [
  { key: "benchPress", label: "Bench" },
  { key: "squat", label: "Squat" },
  { key: "deadlift", label: "Deadlift" },
  { key: "ohp", label: "OHP" },
  { key: "deadHang", label: "Dead Hang" },
];
 
const EXERCISE_LIBRARY = [
  "Barbell Bench Press",
  "Flat Barbell Bench Press",
  "Close-Grip Bench Press",
  "Wide-Grip Bench Press",
  "Paused Bench Press",
  "Tempo Bench Press",
  "Incline Barbell Bench Press",
  "Decline Barbell Bench Press",
  "Smith Machine Bench Press",
  "Smith Machine Incline Press",
  "Machine Chest Press",
  "Plate-Loaded Chest Press",
  "Seated Chest Press",
  "Hammer Strength Chest Press",
  "Dumbbell Bench Press",
  "Flat DB Chest Press",
  "Incline DB Chest Press",
  "Decline DB Chest Press",
  "Neutral-Grip DB Press",
  "Single-Arm DB Chest Press",
  "Dumbbell Fly",
  "Incline Dumbbell Fly",
  "Decline Dumbbell Fly",
  "Cable Crossover",
  "High-to-Low Cable Fly",
  "Low-to-High Cable Fly",
  "Standing Cable Chest Press",
  "Pec Deck Fly",
  "Machine Fly",
  "Push-Up",
  "Incline Push-Up",
  "Decline Push-Up",
  "Weighted Push-Up",
  "Deficit Push-Up",
  "Diamond Push-Up",
  "TRX Push-Up",
  "Medicine Ball Push-Up",
  "Chest Dips",
  "Assisted Chest Dips",
  "Machine Dips",
  "Pull-Up",
  "Wide-Grip Pull-Up",
  "Neutral-Grip Pull-Up",
  "Chin-Up",
  "Assisted Pull-Up",
  "Band-Assisted Pull-Up",
  "Weighted Pull-Up",
  "Lat Pulldown",
  "Wide-Grip Lat Pulldown",
  "Neutral Grip Lat Pulldown",
  "Close-Grip Lat Pulldown",
  "Single-Arm Lat Pulldown",
  "Reverse-Grip Lat Pulldown",
  "Straight-Arm Pulldown",
  "Cable Pullover",
  "Seated Row",
  "Seated Cable Row",
  "Wide-Grip Seated Row",
  "Close-Grip Seated Row",
  "Single-Arm Cable Row",
  "Machine Rows",
  "Machine High Row",
  "Machine Low Row",
  "Chest-Supported Row",
  "Chest-Supported DB Row",
  "Chest-Supported T-Bar Row",
  "T-Bar Row",
  "Landmine Row",
  "Barbell Row",
  "Bent-Over Barbell Row",
  "Pendlay Row",
  "Yates Row",
  "Dumbbell Row",
  "Single-Arm Dumbbell Row",
  "Meadows Row",
  "Seal Row",
  "Inverted Row",
  "TRX Row",
  "Rack Pulls",
  "Block Pulls",
  "Deadlift",
  "Barbell Deadlift",
  "Trap Bar Deadlift",
  "Sumo Deadlift",
  "Deficit Deadlift",
  "Romanian Deadlift",
  "Dumbbell Romanian Deadlift",
  "Single-Leg Romanian Deadlift",
  "Good Morning",
  "Back Extension",
  "45-Degree Back Extension",
  "Reverse Hyperextension",
  "Superman Hold",
  "Overhead Press",
  "Standing Barbell Overhead Press",
  "Seated Barbell Shoulder Press",
  "DB Shoulder Press",
  "Seated DB Shoulder Press",
  "Single-Arm DB Shoulder Press",
  "Arnold Press",
  "Machine Shoulder Press",
  "Smith Machine Shoulder Press",
  "Landmine Press",
  "Single-Arm Landmine Press",
  "Push Press",
  "Z Press",
  "Pike Push-Up",
  "Handstand Push-Up",
  "DB Lateral Raises",
  "Cable Lateral Raises",
  "Machine Lateral Raise",
  "Lean-Away Lateral Raise",
  "Front Raise",
  "Plate Front Raise",
  "Cable Front Raise",
  "Rear Delt Fly",
  "Reverse Pec Deck",
  "Cable Rear Delt Fly",
  "Face Pull",
  "Upright Row",
  "Cable Upright Row",
  "Barbell Shrug",
  "Dumbbell Shrug",
  "Smith Machine Shrug",
  "Trap 3 Raise",
  "Y Raise",
  "T Raise",
  "Wall Slide",
  "Scaption Raise",
  "External Rotation Cable",
  "Banded External Rotation",
  "Internal Rotation Cable",
  "Bicep Curl",
  "Barbell Curl",
  "EZ-Bar Curl",
  "Dumbbell Curl",
  "Alternating DB Curl",
  "Incline DB Curl",
  "Hammer Curl",
  "Cross-Body Hammer Curl",
  "Cable Curl",
  "Rope Curl",
  "Bayesian Cable Curl",
  "Preacher Curl",
  "Machine Curl",
  "Spider Curl",
  "Concentration Curl",
  "Reverse Curl",
  "Zottman Curl",
  "Drag Curl",
  "High Cable Curl",
  "Single-Arm Cable Curl",
  "Tricep Pushdown",
  "Rope Tricep Pushdown",
  "Straight-Bar Pushdown",
  "V-Bar Pushdown",
  "Single-Arm Pushdown",
  "Overhead Cable Tricep Extension",
  "EZ Tricep Extension",
  "Skull Crusher",
  "Incline Skull Crusher",
  "Dips",
  "Assisted Dips",
  "Bench Dips",
  "Machine Tricep Extension",
  "Dumbbell Overhead Tricep Extension",
  "Single-Arm DB Tricep Extension",
  "Cable Kickback",
  "Dumbbell Kickback",
  "JM Press",
  "Squat",
  "Back Squat",
  "High-Bar Squat",
  "Low-Bar Squat",
  "Front Squat",
  "Goblet Squat",
  "Box Squat",
  "Pause Squat",
  "Tempo Squat",
  "Smith Machine Squat",
  "Hack Squat",
  "V-Squat",
  "Pendulum Squat",
  "Belt Squat",
  "Safety Bar Squat",
  "Landmine Squat",
  "Leg Press",
  "Single-Leg Leg Press",
  "Narrow-Stance Leg Press",
  "Wide-Stance Leg Press",
  "Leg Extension",
  "Single-Leg Extension",
  "Sissy Squat",
  "Spanish Squat",
  "Wall Sit",
  "Lunge",
  "Walking Lunge",
  "Reverse Lunge",
  "Forward Lunge",
  "Deficit Reverse Lunge",
  "Dumbbell Lunge",
  "Barbell Lunge",
  "Bulgarian Split Squat",
  "Split Squat",
  "Smith Machine Split Squat",
  "Step-Up",
  "Box Step-Up",
  "Lateral Step-Up",
  "Cossack Squat",
  "Cyclist Squat",
  "Cable Squat",
  "Lying Leg Curl",
  "Seated Leg Curl",
  "Standing Leg Curl",
  "Nordic Hamstring Curl",
  "Glute-Ham Raise",
  "Hip Thrust",
  "Barbell Hip Thrust",
  "Smith Machine Hip Thrust",
  "Single-Leg Hip Thrust",
  "Glute Bridge",
  "Barbell Glute Bridge",
  "Single-Leg Glute Bridge",
  "Cable Pull-Through",
  "Kettlebell Swing",
  "Dumbbell RDL",
  "Barbell RDL",
  "Stiff-Leg Deadlift",
  "Single-Leg Deadlift",
  "B-Stance RDL",
  "Hip Abduction Machine",
  "Cable Hip Abduction",
  "Cable Hip Adduction",
  "Banded Lateral Walk",
  "Monster Walk",
  "Clamshell",
  "Frog Pump",
  "Kickback Machine",
  "Cable Glute Kickback",
  "Donkey Kick",
  "Reverse Lunge to Knee Drive",
  "Standing Calf Raise",
  "Seated Calf Raise",
  "Leg Press Calf Raise",
  "Smith Machine Calf Raise",
  "Single-Leg Calf Raise",
  "Donkey Calf Raise",
  "Tibialis Raise",
  "Toe Raise",
  "Farmer Walk on Toes",
  "Jump Rope Calf Bounce",
  "Plank",
  "Side Plank",
  "Weighted Plank",
  "RKC Plank",
  "Hollow Hold",
  "Hollow Rock",
  "Dead Bug",
  "Bird Dog",
  "McGill Curl Up",
  "Curl Up",
  "Crunch",
  "Machine Crunch",
  "Cable Crunch",
  "Decline Sit-Up",
  "Sit-Up",
  "Reverse Crunch",
  "Hanging Knee Raise",
  "Hanging Leg Raise",
  "Captain's Chair Knee Raise",
  "Toes to Bar",
  "Ab Wheel",
  "Stability Ball Rollout",
  "TRX Fallout",
  "Pallof Press",
  "Pallof Hold",
  "Cable Wood Chop",
  "Cable Lift",
  "Russian Twist",
  "Medicine Ball Slam",
  "Medicine Ball Rotational Throw",
  "Landmine Rotation",
  "Farmers Carry",
  "Suitcase Carry",
  "Overhead Carry",
  "Waiter Carry",
  "Copenhagen Plank",
  "Copenhagen Hold",
  "Stir the Pot",
  "Dragon Flag",
  "V-Up",
  "Bicycle Crunch",
  "Heel Touch",
  "Mountain Climber",
  "Dead Hang",
  "Scapular Pull-Up",
  "Scapular Push-Up",
  "Band Pull-Aparts",
  "Band Pass Throughs",
  "Shoulder CARs",
  "Hip CARs",
  "90/90 Hip Rotation",
  "World's Greatest Stretch",
  "Cat-Cow",
  "Thoracic Rotation",
  "Open Book Rotation",
  "Thread the Needle",
  "Half-Kneeling Hip Flexor Stretch",
  "Couch Stretch",
  "Pigeon Stretch",
  "Hamstring Stretch",
  "Calf Stretch",
  "Lat Stretch",
  "Pec Stretch",
  "Child's Pose",
  "Foam Rolling",
  "Ankle Mobility Drill",
  "Wall Ankle Mobilization",
  "Goblet Squat Hold",
  "Deep Squat Hold",
  "Hip Airplane",
  "Glute Med Walk",
  "Terminal Knee Extension",
  "Spanish Squat Hold",
  "TKE Band Extension",
  "Face Pull External Rotation",
  "Serratus Wall Slide",
  "Prone Y Raise",
  "Prone T Raise",
  "Prone W Raise",
  "Banded Row",
  "Banded Good Morning",
  "Sled Push",
  "Sled Pull",
  "Backward Sled Drag",
  "Battle Ropes",
  "Battle Rope Waves",
  "Battle Rope Slams",
  "SkiErg",
  "Rower",
  "Rowing Machine",
  "Assault Bike",
  "Air Bike",
  "Stationary Bike",
  "Spin Bike",
  "Elliptical",
  "Treadmill Walk",
  "Incline Treadmill Walk",
  "Treadmill Run",
  "Stair Climber",
  "Stairmaster",
  "VersaClimber",
  "Jump Rope",
  "Box Jump",
  "Step Jump",
  "Broad Jump",
  "Burpee",
  "Burpee Box Jump",
  "Kettlebell Clean",
  "Kettlebell Snatch",
  "Kettlebell Goblet Squat",
  "Kettlebell Turkish Get-Up",
  "Medicine Ball Throw",
  "Wall Ball",
  "Farmer's Carry",
  "Trap Bar Carry",
  "Sandbag Carry",
  "Sandbag Clean",
  "Sandbag Squat",
  "Tire Flip",
  "Rope Climb",
  "Bear Crawl",
  "Crab Walk",
  "Prowler Push",
  "Prowler Sprint",
  "Cable Row",
  "Cable Chest Press",
  "Cable Shoulder Press",
  "Cable Lunge",
  "Cable Pull Through",
  "Cable Abduction",
  "Cable Adduction",
  "Cable Lateral Raise",
  "Smith Machine Row",
  "Smith Machine RDL",
  "Smith Machine Lunge",
  "Machine Pullover",
  "Machine Bicep Curl",
  "Machine Preacher Curl",
  "Machine Tricep Dip",
  "Machine Ab Crunch",
  "Machine Back Extension",
  "Machine Glute Kickback",
  "Machine Hip Thrust",
  "Machine Adductor",
  "Machine Abductor",
];
 
const FOOD_DB = [
  { name: "Chicken breast 100g", kcal: 165, protein: 31, carbs: 0, fats: 4, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Salmon 100g", kcal: 208, protein: 20, carbs: 0, fats: 13, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Egg white 1 piece", kcal: 17, protein: 4, carbs: 0, fats: 0, tags: ["vegetarian", "gluten-free", "lactose-free"] },
  { name: "Whole egg 1 piece", kcal: 72, protein: 6, carbs: 0, fats: 5, tags: ["vegetarian", "gluten-free", "lactose-free"] },
  { name: "Cooked rice 100g", kcal: 130, protein: 3, carbs: 28, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Potato 100g", kcal: 87, protein: 2, carbs: 20, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Chapati 1 medium", kcal: 180, protein: 5, carbs: 30, fats: 5, tags: ["vegetarian", "lactose-free"] },
  { name: "Oats 50g", kcal: 190, protein: 7, carbs: 32, fats: 4, tags: ["vegetarian", "vegan", "lactose-free"] },
  { name: "Banana 1 medium", kcal: 105, protein: 1, carbs: 27, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Whey protein 1 scoop", kcal: 120, protein: 24, carbs: 3, fats: 2, tags: ["vegetarian", "gluten-free"] },
  { name: "Lentils cooked 100g", kcal: 116, protein: 9, carbs: 20, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Greek yogurt 170g", kcal: 100, protein: 17, carbs: 6, fats: 0, tags: ["vegetarian", "gluten-free"] },
  { name: "Avocado 100g", kcal: 160, protein: 2, carbs: 9, fats: 15, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Broccoli 100g", kcal: 35, protein: 2, carbs: 7, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Ground beef 100g", kcal: 250, protein: 26, carbs: 0, fats: 15, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Chicken biryani 1 plate", kcal: 760, protein: 35, carbs: 90, fats: 28, tags: ["non-vegetarian", "lactose-free"] },
  { name: "Mutton biryani 1 plate", kcal: 880, protein: 38, carbs: 90, fats: 38, tags: ["non-vegetarian", "lactose-free"] },
  { name: "Chicken tikka 200g", kcal: 330, protein: 48, carbs: 4, fats: 12, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Tandoori chicken half", kcal: 480, protein: 60, carbs: 6, fats: 22, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Butter chicken 1 bowl", kcal: 520, protein: 32, carbs: 18, fats: 36, tags: ["non-vegetarian", "gluten-free"] },
  { name: "Chicken curry 1 bowl", kcal: 420, protein: 34, carbs: 14, fats: 24, tags: ["non-vegetarian"] },
  { name: "Dal 1 bowl", kcal: 230, protein: 13, carbs: 34, fats: 5, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Chana masala 1 bowl", kcal: 310, protein: 14, carbs: 45, fats: 9, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Paneer curry 1 bowl", kcal: 450, protein: 22, carbs: 18, fats: 32, tags: ["vegetarian", "gluten-free"] },
  { name: "Rajma 1 bowl", kcal: 260, protein: 14, carbs: 42, fats: 4, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Roti 1 piece", kcal: 120, protein: 4, carbs: 22, fats: 3, tags: ["vegetarian", "vegan", "lactose-free"] },
  { name: "Naan 1 piece", kcal: 260, protein: 8, carbs: 45, fats: 6, tags: ["vegetarian"] },
  { name: "Paratha 1 piece", kcal: 320, protein: 7, carbs: 38, fats: 16, tags: ["vegetarian"] },
  { name: "Chicken shawarma wrap", kcal: 520, protein: 32, carbs: 48, fats: 22, tags: ["non-vegetarian"] },
  { name: "Arabic grilled chicken half", kcal: 560, protein: 68, carbs: 10, fats: 26, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Kabsa chicken 1 plate", kcal: 780, protein: 42, carbs: 95, fats: 24, tags: ["non-vegetarian", "lactose-free"] },
  { name: "Machboos chicken 1 plate", kcal: 760, protein: 40, carbs: 92, fats: 24, tags: ["non-vegetarian", "lactose-free"] },
  { name: "Hummus 100g", kcal: 166, protein: 8, carbs: 14, fats: 10, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Falafel 4 pieces", kcal: 330, protein: 13, carbs: 32, fats: 18, tags: ["vegetarian", "vegan", "lactose-free"] },
  { name: "Dates 3 pieces", kcal: 210, protein: 2, carbs: 54, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Karak tea 1 cup", kcal: 160, protein: 4, carbs: 28, fats: 4, tags: ["vegetarian"] },
];
 
const DEFAULT_TIME_SLOTS = ["5:30 AM", "6:00 AM", "6:30 AM", "7:00 AM", "7:30 AM", "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM", "9:30 PM", "10:00 PM"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const RPE_OPTIONS = ["", "5", "5.5", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10"];
const PHOTO_TYPES = ["Front", "Side", "Back", "Before", "After", "Progress", "Other"];
const TIMED_EXERCISES = ["dead hang", "scapular pull-up", "plank", "side plank", "weighted plank", "rkc plank", "hollow hold", "wall sit", "farmer walk", "farmer's carry", "suitcase carry", "overhead carry", "waiter carry", "sled push", "sled pull", "battle ropes", "battle rope waves", "battle rope slams", "skierg", "elliptical", "rower", "rowing machine", "stair climber", "stairmaster", "assault bike", "air bike", "stationary bike", "treadmill", "incline treadmill", "versa climber", "versaclimber", "jump rope", "bear crawl", "crab walk", "copenhagen", "hollow rock", "pallof hold", "deep squat hold", "goblet squat hold", "stretch", "stretching", "mobility", "carry"];
function isTimedExercise(name = "") {
  const n = String(name).toLowerCase();
  return TIMED_EXERCISES.some((x) => n.includes(x));
}
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function normalizeSlotLabel(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return raw.toUpperCase();
  const hour = Number(match[1]);
  const mins = match[2] || "00";
  const period = match[3] ? match[3].toUpperCase() : "";
  return `${hour}:${mins}${period ? ` ${period}` : ""}`;
}
 
function timeKey(value = "") {
  return normalizeSlotLabel(value).toLowerCase().replace(/\s+/g, " ").trim();
}
 
function normalizeSlots(raw) {
  const hasAmPm = Array.isArray(raw) && raw.some((s) => /\b(am|pm)\b/i.test(typeof s === "string" ? s : s?.label || s?.time || ""));
  const source = Array.isArray(raw) && raw.length && hasAmPm ? raw : DEFAULT_TIME_SLOTS;
  return source.map((s, i) => {
    const label = normalizeSlotLabel(typeof s === "string" ? s : s.label || s.time || String(s));
    return { id: typeof s === "object" && s.id ? s.id : `slot_${i}_${label}`, label };
  });
}
 
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
 
function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
 
function initials(name = "") {
  return name.split(" ").filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "??";
}
 
function getClientColor(id, index = 0) {
  const raw = String(id || index);
  const seed = raw.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return CLIENT_COLORS[(seed + index) % CLIENT_COLORS.length];
}
 
function normalizeGoals(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
}
 
function normalizeInjuries(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
}
 
function timeLabel(t) {
  return normalizeSlotLabel(t).replace(/^0/, "");
}
 
function moneyAED(n) {
  return `AED ${Number(n || 0).toLocaleString()}`;
}
 
function makeInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
 
function makeWeek(n, days) {
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
 
function cloneTemplateProgram(template, client) {
  const safeDays = (template.days || []).map((day) => ({
    ...day,
    exercises: (day.exercises || []).map((ex) => ({ ...ex })),
  }));
  const program = {
    name: `${client.name} - ${template.name}`,
    templateKey: template.key,
    templateName: template.name,
    totalWeeks: template.totalWeeks || 4,
    days: safeDays,
  };
  return {
    ...program,
    weekLogs: Array.from({ length: Number(program.totalWeeks || 4) }, (_, i) => makeWeek(i + 1, program.days)),
  };
}
 
function emptyProfile() {
  return {
    goals: [],
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
  };
}
 
function emptyNutrition() {
  return {
    targets: { calories: "", protein: "", carbs: "", fats: "", steps: 10000, water: 8 },
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
  if (calories) base.push(`Calories target is ${calories}. Divide it across breakfast, lunch, and dinner so the client does not overload one meal.`);
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
 
function Button({ children, onClick, variant = "gold", type = "button", disabled = false, style = {} }) {
  const bg = variant === "ghost" ? "transparent" : variant === "red" ? BRAND.red : variant === "dark" ? BRAND.card2 : BRAND.gold;
  const color = variant === "ghost" ? BRAND.text : variant === "red" ? "#fff" : variant === "dark" ? BRAND.text : "#050505";
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={{ background: bg, color, border: variant === "ghost" ? `1px solid ${BRAND.line}` : "none", borderRadius: 12, padding: "10px 14px", fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, ...style }}>
      {children}
    </button>
  );
}
 
function Field({ label, value, onChange, type = "text", placeholder = "", textarea = false }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 11, color: BRAND.muted, fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 }}>{label}</div>
      {textarea ? (
        <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle({ minHeight: 85, resize: "vertical" })} />
      ) : (
        <input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle()} />
      )}
    </label>
  );
}
 
function inputStyle(extra = {}) {
  return { width: "100%", boxSizing: "border-box", background: "#0b0c10", border: `1px solid ${BRAND.line}`, color: BRAND.text, borderRadius: 12, padding: "11px 12px", outline: "none", fontSize: 14, ...extra };
}
 
function Card({ children, style = {}, onClick }) {
  return <div onClick={onClick} style={{ background: `linear-gradient(180deg, ${BRAND.card}, #101116)`, border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: 16, boxShadow: "0 16px 40px rgba(0,0,0,.25)", ...style }}>{children}</div>;
}
 
function LoginScreen({ onReady }) {
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
        <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: 1 }}>FORGE</div>
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
  const [form, setForm] = useState({ name: "", email: "", phone: "", age: "", weight: "", color: CLIENT_COLORS[0], profile: emptyProfile() });
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
          <Field label="Age" value={form.age} onChange={(v) => setForm({ ...form, age: v })} type="number" />
          <Field label="Weight kg" value={form.weight} onChange={(v) => setForm({ ...form, weight: v })} type="number" />
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: BRAND.muted, fontWeight: 900, marginBottom: 8 }}>CLIENT COLOR</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{CLIENT_COLORS.map((c) => <button key={c} onClick={() => setForm({ ...form, color: c, profile: { ...form.profile, color: c } })} style={{ width: 34, height: 34, borderRadius: 12, border: form.color === c ? `3px solid ${BRAND.text}` : `1px solid ${BRAND.line}`, background: c, cursor: "pointer" }} />)}</div>
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: BRAND.muted, fontWeight: 900, marginBottom: 8 }}>GOALS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{GOAL_OPTIONS.map((g) => <button key={g} onClick={() => toggleGoal(g)} style={{ border: `1px solid ${form.profile.goals.includes(g) ? BRAND.gold : BRAND.line}`, background: form.profile.goals.includes(g) ? BRAND.gold : BRAND.card2, color: form.profile.goals.includes(g) ? "#000" : BRAND.text, borderRadius: 20, padding: "7px 11px", fontWeight: 800 }}>{g}</button>)}</div>
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
          <Button onClick={() => onCreate(form)} style={{ flex: 1 }}>Create client</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </Card>
    </div>
  );
}
function modalBackdrop() {
  return { position: "fixed", inset: 0, background: "rgba(0,0,0,.86)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
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
  const filtered = clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  const upcoming = clients.reduce((n, c) => n + (c.schedule?.length || 0), 0);
 
  async function createClient(form) {
    const color = form.color || getClientColor(uid(), clients.length);
    const invite_code = makeInviteCode();
    const payload = {
      trainer_id: user.id,
      name: form.name,
      email: form.email,
      phone: form.phone,
      age: Number(form.age || 0),
      weight_kg: Number(form.weight || 0),
      goal: form.profile.goals?.[0] || "General Fitness",
      color,
      invite_code,
      invite_status: "not_sent",
    };
    const { data, error } = await supabase.from("clients").insert(payload).select("*").single();
    if (error) { alert(error.message); return; }
    await upsertSection(data.id, "profile", form.profile);
    setShowAdd(false);
    await refresh();
  }
 
  return (
    <div style={{ minHeight: "100vh", background: BRAND.bg, color: BRAND.text }}>
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(7,7,7,.92)", backdropFilter: "blur(14px)", borderBottom: `1px solid ${BRAND.line}`, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: 16, background: BRAND.card2, border: `1px solid ${BRAND.line}`, overflow: "hidden", display: "grid", placeItems: "center", color: BRAND.gold, fontWeight: 1000 }}>
            {trainer?.photo ? <img src={trainer.photo} alt="Coach" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(trainer?.name || user.email)}
          </div>
          <div><div style={{ fontSize: 29, fontWeight: 1000, color: BRAND.gold }}>FORGE</div><div style={{ color: BRAND.muted, fontSize: 12 }}>COACH {trainer?.name || user.email?.split("@")[0]}</div></div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: syncStatus === "offline" ? BRAND.red : syncStatus === "syncing" ? BRAND.gold : BRAND.green, fontSize: 12, fontWeight: 1000 }}>{syncStatus === "offline" ? "Offline" : syncStatus === "syncing" ? "Syncing" : "Synced"}</span>
          <Button variant="dark" onClick={() => setShowSettings(true)}>Settings</Button>
          <Button variant="ghost" onClick={() => supabase.auth.signOut()}>Logout</Button>
        </div>
      </header>
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 16 }}>
          <Kpi title="Active Clients" value={clients.length} icon="👥" color={BRAND.gold} onClick={() => setTab("clients")} />
          <Kpi title="Scheduled" value={upcoming} icon="📅" color={BRAND.cyan} onClick={() => setTab("scheduled")} />
          <Kpi title="Trials" value="Open" icon="🔥" color={BRAND.red} onClick={() => setTab("trials")} />
          <Kpi title="Calendar" value="Open" icon="⏱" color={BRAND.green} onClick={() => setTab("calendar")} />
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
          {[["clients", "Clients"], ["scheduled", "Scheduled"], ["trials", "Trials"], ["calendar", "Calendar"]].map(([k, l]) => <Button key={k} variant={tab === k ? "gold" : "dark"} onClick={() => setTab(k)}>{l}</Button>)}
        </div>
        {tab === "clients" && <>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients..." style={inputStyle()} />
            <Button onClick={() => setShowAdd(true)}>+ Add New Client</Button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
            {filtered.map((c, i) => <ClientCard key={c.id} client={c} onClick={() => selectClient(c)} index={i} />)}
          </div>
        </>}
        {tab === "scheduled" && <ScheduledView clients={clients} selectClient={selectClient} />}
        {tab === "calendar" && <Calendar clients={clients} refresh={refresh} user={user} />}
        {tab === "trials" && <Trials user={user} />}
      </main>
      {showAdd && <AddClientModal onClose={() => setShowAdd(false)} onCreate={createClient} />}
      {showSettings && <CoachSettingsModal user={user} trainer={trainer} onClose={() => setShowSettings(false)} onSaved={(next) => { setTrainer?.(next); setShowSettings(false); refresh(); }} />}
    </div>
  );
}
 
function Kpi({ title, value, icon, color, onClick }) {
  return <Card onClick={onClick} style={{ cursor: onClick ? "pointer" : "default", transition: "transform .15s ease, border-color .15s ease", borderColor: onClick ? `${color}66` : BRAND.line }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 800 }}>{title}</div><div style={{ fontSize: 28, fontWeight: 1000, color }}>{value}</div></div><div style={{ fontSize: 28 }}>{icon}</div></div><div style={{ marginTop: 8, color: BRAND.dim, fontSize: 11, fontWeight: 800 }}>{onClick ? "Tap to open" : ""}</div></Card>;
}
 
function ScheduledView({ clients, selectClient }) {
  const scheduled = clients.flatMap((client) => (client.schedule || []).map((s) => ({
    id: `${client.id}_${s.day}_${s.time}`,
    client,
    day: s.day,
    time: s.time,
  })));
  const dayIndex = Object.fromEntries(DAYS.map((d, i) => [d, i]));
  scheduled.sort((a, b) => (dayIndex[a.day] ?? 99) - (dayIndex[b.day] ?? 99) || String(a.time).localeCompare(String(b.time)));
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <div style={{ fontSize: 24, fontWeight: 1000, color: BRAND.cyan }}>Scheduled Sessions</div>
        <div style={{ color: BRAND.muted, marginTop: 4 }}>All recurring client sessions from client schedules. Tap a client row to open their profile.</div>
      </Card>
      {scheduled.length === 0 ? (
        <Card><div style={{ color: BRAND.muted }}>No scheduled sessions yet. Open a client, go to Schedule, and add their recurring days and times.</div></Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
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
  return (
    <Card style={{ cursor: "pointer", borderColor: client.color }} onClick={onClick}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <ClientAvatar client={client} size={54} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 1000 }}>{client.name}</div>
          <div style={{ color: client.color, fontSize: 12, fontWeight: 900 }}>{client.goals?.join(" + ") || client.goal}</div>
          <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 4 }}>{client.weight || 0}kg · {client.age || 0} yrs</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
        <Mini label="Program" value={client.program ? "Ready" : "Empty"} />
        <Mini label="Invite" value={client.inviteStatus === "accepted" ? "Accepted" : "Pending"} />
      </div>
    </Card>
  );
}
 
function Mini({ label, value }) { return <div style={{ background: "#0b0c10", border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: 10 }}><div style={{ color: BRAND.dim, fontSize: 10, fontWeight: 800 }}>{label}</div><div style={{ color: BRAND.text, fontWeight: 900 }}>{value}</div></div>; }
 
function ClientAvatar({ client, size = 54 }) {
  return <div style={{ width: size, height: size, borderRadius: Math.round(size / 3), display: "grid", placeItems: "center", background: client.color, color: "#000", fontWeight: 1000, overflow: "hidden", flexShrink: 0 }}>{client.photo ? <img src={client.photo} alt={client.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : client.avatar}</div>;
}
 
function ClientView({ client, updateClient, back, refresh, isCoach = true }) {
  const [tab, setTab] = useState(isCoach ? "profile" : "home");
  const tabs = isCoach ? [
    ["profile", "📋 Profile"], ["program", "💪 Program"], ["nutrition", "🥗 Nutrition"], ["progress", "📈 Progress"], ["photos", "📸 Transform"], ["schedule", "📅 Schedule"], ["packages", "💳 Packages"], ["invite", "🔗 Invite"]
  ] : [["home", "🏠 Home"], ["nutrition", "🥗 Nutrition"], ["program", "💪 Program"], ["progress", "📈 Progress"], ["photos", "📸 Photos"], ["profile", "👤 Profile"]];
  async function delClient() {
    if (!confirm(`Delete ${client.name}? This cannot be undone.`)) return;
    await supabase.from("client_data").delete().eq("client_id", client.id);
    await supabase.from("clients").delete().eq("id", client.id);
    back(); refresh();
  }
  return (
    <div style={{ minHeight: "100vh", background: BRAND.bg, color: BRAND.text }}>
      <header style={{ borderBottom: `1px solid ${BRAND.line}`, padding: 14, display: "flex", gap: 10, alignItems: "center", position: "sticky", top: 0, background: "rgba(7,7,7,.94)", zIndex: 80 }}>
        {isCoach && <Button variant="ghost" onClick={back}>Back</Button>}
        <ClientAvatar client={client} size={54} />
        <div style={{ flex: 1 }}><div style={{ fontSize: 24, fontWeight: 1000 }}>{client.name}</div><div style={{ color: client.color, fontWeight: 900, fontSize: 12 }}>{client.goals?.join(" + ") || client.goal}</div></div>
        {isCoach && <Button variant="red" onClick={delClient}>Delete</Button>}
      </header>
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", marginBottom: 16, paddingBottom: 4 }}>{tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{ minWidth: 92, height: 48, borderRadius: 999, border: `1px solid ${tab === k ? client.color : BRAND.line}`, background: tab === k ? client.color : BRAND.card2, color: tab === k ? "#000" : BRAND.text, fontWeight: 1000, whiteSpace: "nowrap", cursor: "pointer", boxShadow: tab === k ? `0 0 24px ${client.color}33` : "none" }}>{l}</button>)}</div>
        {tab === "home" && <ClientHome client={client} />}
        {tab === "profile" && <ProfileTab client={client} updateClient={updateClient} />}
        {tab === "program" && <ProgramTab client={client} updateClient={updateClient} isCoach={isCoach} />}
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
  const waterTarget = Number(nutrition.targets?.water || 8);
  const scoreParts = [
    completedMeals / 3,
    calTarget ? Math.min(totals.kcal / calTarget, 1) : 0,
    proteinTarget ? Math.min(totals.protein / proteinTarget, 1) : 0,
    stepsTarget ? Math.min(Number(daily.steps || 0) / stepsTarget, 1) : 0,
    waterTarget ? Math.min(Number(daily.water || 0) / waterTarget, 1) : 0,
  ];
  const score = Math.round((scoreParts.reduce((a, b) => a + b, 0) / scoreParts.length) * 100);
  return { nutrition, logs, totals, daily, completedMeals, score, calTarget, proteinTarget, stepsTarget, waterTarget };
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
  const wanted = ["Dead Hang", "Plank", "Side Plank", "Bench Press", "Squat", "Deadlift"];
  const aliases = {
    "Dead Hang": ["dead hang", "dead hung"],
    "Plank": ["plank"],
    "Side Plank": ["side plank"],
    "Bench Press": ["bench press", "flat barbell bench press", "barbell bench press"],
    "Squat": ["squat", "back squat", "barbell squat"],
    "Deadlift": ["deadlift", "barbell deadlift"],
  };
  const entries = sessionEntries(program);
  return wanted.map((name) => {
    const keys = aliases[name];
    const data = entries.filter((e) => keys.some((k) => e.exercise.toLowerCase().includes(k)) && (name !== "Plank" || !e.exercise.toLowerCase().includes("side")));
    const timed = ["Dead Hang", "Plank", "Side Plank"].includes(name);
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
 
function ClientHome({ client }) {
  const stats = todaysNutritionStats(client);
  const metrics = computePerformanceMetrics(client.program);
  const deadHang = metrics.find((m) => m.name === "Dead Hang");
  const plank = metrics.find((m) => m.name === "Plank");
  const todaysWorkout = client.program?.days?.[0]?.name || "Workout not assigned";
  const meals = ["Breakfast", "Lunch", "Dinner"];
  const mealDone = (meal) => stats.logs.some((l) => l.meal === meal) || stats.daily?.meals?.[meal];
  return <div style={{ display: "grid", gap: 16 }}>
    <Card style={{ background: `radial-gradient(circle at 18% 20%, ${client.color}33, transparent 32%), linear-gradient(135deg, #171a22, #08090d)`, borderColor: `${client.color}55`, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <ClientAvatar client={client} size={76} />
          <div>
            <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 1000, letterSpacing: 2 }}>FORGE CLIENT</div>
            <div style={{ fontSize: 31, fontWeight: 1000, lineHeight: 1 }}>Welcome back, {client.name}</div>
            <div style={{ color: client.color, fontWeight: 900, marginTop: 6 }}>{client.goals?.join(" + ") || client.goal}</div>
          </div>
        </div>
        <div style={{ width: 118, height: 118, borderRadius: "50%", display: "grid", placeItems: "center", background: `conic-gradient(${client.color} ${stats.score}%, #242733 ${stats.score}% 100%)`, boxShadow: `0 0 34px ${client.color}33` }}>
          <div style={{ width: 86, height: 86, borderRadius: "50%", background: BRAND.bg, display: "grid", placeItems: "center", textAlign: "center" }}>
            <div><div style={{ fontSize: 30, fontWeight: 1000 }}>{stats.score}%</div><div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 1000 }}>FORGE SCORE</div></div>
          </div>
        </div>
      </div>
    </Card>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
      <ProgressRing label="Calories" value={stats.totals.kcal} total={stats.calTarget || 0} color={BRAND.cyan} />
      <ProgressRing label="Protein" value={stats.totals.protein} total={stats.proteinTarget || 0} unit="g" color={BRAND.green} />
      <ProgressRing label="Steps" value={stats.daily.steps || 0} total={stats.stepsTarget || 10000} color={BRAND.gold} />
      <ProgressRing label="Water" value={stats.daily.water || 0} total={stats.waterTarget || 8} color={BRAND.blue} />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14 }}>
      <Card style={{ background: "linear-gradient(180deg, #151821, #0c0d12)" }}><div style={{ color: BRAND.gold, fontWeight: 1000, marginBottom: 10 }}>TODAY'S NUTRITION</div><div style={{ display: "grid", gap: 9 }}>{meals.map((m) => <MealStatusPill key={m} meal={m} done={mealDone(m)} color={client.color} />)}</div></Card>
      <Card style={{ background: "linear-gradient(180deg, #151821, #0c0d12)" }}><div style={{ color: BRAND.gold, fontWeight: 1000, marginBottom: 10 }}>TODAY'S WORKOUT</div><div style={{ fontSize: 24, fontWeight: 1000 }}>{todaysWorkout}</div><div style={{ color: BRAND.muted, marginTop: 6 }}>Open Program to log sets, reps, duration and RPE.</div></Card>
      <Card style={{ background: "linear-gradient(180deg, #151821, #0c0d12)" }}><div style={{ color: BRAND.gold, fontWeight: 1000, marginBottom: 10 }}>PERFORMANCE</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><PremiumTile label="Dead Hang PB" value={metricDisplay(deadHang?.best, true)} sub={`Recent ${metricDisplay(deadHang?.recent, true)}`} color={BRAND.cyan} /><PremiumTile label="Plank PB" value={metricDisplay(plank?.best, true)} sub={`Recent ${metricDisplay(plank?.recent, true)}`} color={BRAND.purple} /></div></Card>
    </div>
  </div>;
}
 
function ProfileTab({ client, updateClient }) {
  const [profile, setProfile] = useState(client.profile || emptyProfile());
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setProfile((p) => ({ ...p, [k]: v }));
  const toggleGoal = (g) => set("goals", profile.goals.includes(g) ? profile.goals.filter((x) => x !== g) : [...profile.goals, g]);
  async function pickPhoto(file) {
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    set("photo", dataUrl);
  }
  async function save() {
    setSaving(true);
    await upsertSection(client.id, "profile", profile);
    updateClient({ ...client, profile, photo: profile.photo || client.photo, color: profile.color || client.color, goals: profile.goals, goal: profile.goals?.[0] || client.goal, notes: profile.notes });
    setSaving(false);
  }
  return <Card><div style={{ fontSize: 22, fontWeight: 1000, marginBottom: 14 }}>Client Profile</div>
    <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
      <div style={{ width: 84, height: 84, borderRadius: 26, background: profile.color || client.color, overflow: "hidden", display: "grid", placeItems: "center", color: "#000", fontWeight: 1000 }}>{profile.photo || client.photo ? <img src={profile.photo || client.photo} alt="client" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : client.avatar}</div>
      <div style={{ flex: 1 }}>
        <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>PROFILE PICTURE</div>
        <input type="file" accept="image/*" onChange={(e) => pickPhoto(e.target.files?.[0])} style={inputStyle()} />
      </div>
    </div>
    <div style={{ marginBottom: 14 }}><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>CLIENT COLOR</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{CLIENT_COLORS.map((c) => <button key={c} onClick={() => set("color", c)} style={{ width: 34, height: 34, borderRadius: 12, border: (profile.color || client.color) === c ? `3px solid ${BRAND.text}` : `1px solid ${BRAND.line}`, background: c, cursor: "pointer" }} />)}</div></div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>{GOAL_OPTIONS.map((g) => <button key={g} onClick={() => toggleGoal(g)} style={{ border: `1px solid ${profile.goals.includes(g) ? client.color : BRAND.line}`, background: profile.goals.includes(g) ? client.color : BRAND.card2, color: profile.goals.includes(g) ? "#000" : BRAND.text, borderRadius: 20, padding: "7px 11px", fontWeight: 800 }}>{g}</button>)}</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}><Field label="Injuries" value={profile.injuries} onChange={(v) => set("injuries", v)} textarea /><Field label="Medical Issues" value={profile.medicalIssues} onChange={(v) => set("medicalIssues", v)} textarea /><Field label="Barriers" value={profile.barriers} onChange={(v) => set("barriers", v)} textarea /><Field label="Sleep" value={profile.sleep} onChange={(v) => set("sleep", v)} textarea /><Field label="NEAT / Daily Activity" value={profile.neat} onChange={(v) => set("neat", v)} textarea /><Field label="Work Schedule" value={profile.workSchedule} onChange={(v) => set("workSchedule", v)} textarea /><Field label="Vegetarian Status" value={profile.vegetarianStatus} onChange={(v) => set("vegetarianStatus", v)} /><Field label="Allergies" value={profile.allergies} onChange={(v) => set("allergies", v)} /><Field label="Notes" value={profile.notes} onChange={(v) => set("notes", v)} textarea /></div>
    <div style={{ display: "flex", gap: 10, marginTop: 14 }}><label style={{ color: BRAND.muted }}><input type="checkbox" checked={profile.lactoseIntolerant} onChange={(e) => set("lactoseIntolerant", e.target.checked)} /> Lactose intolerant</label><label style={{ color: BRAND.muted }}><input type="checkbox" checked={profile.glutenIntolerant} onChange={(e) => set("glutenIntolerant", e.target.checked)} /> Gluten intolerant</label></div><Button disabled={saving} onClick={save} style={{ marginTop: 16 }}>{saving ? "Saving..." : "Save Profile"}</Button></Card>;
}
function ProgramTemplatePicker({ client, onClose, onApply }) {
  const [selected, setSelected] = useState(PROGRAM_TEMPLATES[0]?.key || "");
  const template = PROGRAM_TEMPLATES.find((t) => t.key === selected) || PROGRAM_TEMPLATES[0];
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 760, maxHeight: "92vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 1000 }}>Use Program Template</div>
            <div style={{ color: BRAND.muted }}>Choose a template, apply it to {client.name}, then edit anything you want.</div>
          </div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 14 }}>
          {PROGRAM_TEMPLATES.map((t) => (
            <button key={t.key} onClick={() => setSelected(t.key)} style={{ textAlign: "left", background: selected === t.key ? BRAND.gold : BRAND.card2, color: selected === t.key ? "#000" : BRAND.text, border: `1px solid ${selected === t.key ? BRAND.gold : BRAND.line}`, borderRadius: 16, padding: 14, cursor: "pointer" }}>
              <div style={{ fontWeight: 1000, fontSize: 16 }}>{t.name}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{t.description}</div>
              <div style={{ fontSize: 11, fontWeight: 900, marginTop: 8 }}>{t.days?.length || 0} days · {t.totalWeeks || 4} weeks</div>
            </button>
          ))}
        </div>
        {template && (
          <Card style={{ background: BRAND.card2, marginBottom: 14 }}>
            <div style={{ color: BRAND.gold, fontWeight: 1000, marginBottom: 8 }}>{template.name} Preview</div>
            <div style={{ display: "grid", gap: 10 }}>
              {template.days.map((day) => (
                <div key={day.name} style={{ borderTop: `1px solid ${BRAND.line}`, paddingTop: 10 }}>
                  <div style={{ fontWeight: 1000 }}>{day.name}</div>
                  <div style={{ color: BRAND.muted, fontSize: 12, lineHeight: 1.7 }}>
                    {day.exercises.map((ex) => `${ex.name} (${ex.numSets} x ${ex.reps})`).join(" · ")}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <Button onClick={() => onApply(template)} style={{ flex: 1 }}>Apply Template</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </Card>
    </div>
  );
}
 
function ProgramTab({ client, updateClient, isCoach }) {
  const [builder, setBuilder] = useState(false);
  const [ai, setAi] = useState(false);
  const [templates, setTemplates] = useState(false);
  const [program, setProgram] = useState(client.program);
  async function saveProgram(p) {
    const logs = p.weekLogs || Array.from({ length: Number(p.totalWeeks || 4) }, (_, i) => makeWeek(i + 1, p.days || []));
    const final = { ...p, weekLogs: logs };
    setProgram(final);
    await upsertSection(client.id, "program", final);
    updateClient({ ...client, program: final });
    setBuilder(false); setAi(false); setTemplates(false);
  }
  async function applyTemplate(template) {
    if (!template) return;
    const nextProgram = cloneTemplateProgram(template, client);
    await saveProgram(nextProgram);
  }
  return <div style={{ display: "grid", gap: 14 }}><Card><div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}><div><div style={{ fontSize: 22, fontWeight: 1000 }}>Program</div><div style={{ color: BRAND.muted }}>{program?.name || "No program yet"}</div>{program?.templateName && <div style={{ color: BRAND.gold, fontSize: 12, fontWeight: 900, marginTop: 4 }}>Template: {program.templateName}</div>}</div>{isCoach && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Button onClick={() => setTemplates(true)}>Use Template</Button><Button onClick={() => setAi(true)}>AI Build</Button><Button variant="dark" onClick={() => setBuilder(true)}>Edit Builder</Button></div>}</div>{program && <div style={{ marginTop: 12, color: BRAND.green, fontWeight: 800 }}>{aiProgression(program, client)}</div>}</Card>{program ? <SessionTracker client={client} program={program} saveProgram={saveProgram} isCoach={isCoach} /> : <Card><div style={{ color: BRAND.muted }}>No program assigned yet. Use a template, AI Build, or Edit Builder to create one.</div></Card>}{templates && <ProgramTemplatePicker client={client} onClose={() => setTemplates(false)} onApply={applyTemplate} />}{builder && <ProgramBuilder client={client} program={program} onClose={() => setBuilder(false)} onSave={saveProgram} />}{ai && <AIProgramBuilder client={client} onClose={() => setAi(false)} onSave={saveProgram} />}</div>;
}
 function ProgramBuilder({ client, program, onClose, onSave }) {
  const [name, setName] = useState(program?.name || `${client.name} Program`);
  const [weeks, setWeeks] = useState(program?.totalWeeks || 4);
  const [days, setDays] = useState(program?.days || [{ name: "Day 1 - Push", exercises: [] }, { name: "Day 2 - Pull", exercises: [] }, { name: "Day 3 - Legs", exercises: [] }]);
  const [active, setActive] = useState(0);
  const [search, setSearch] = useState("");
  const [customExercise, setCustomExercise] = useState("");
  const [customExercises, setCustomExercises] = useState(() => {
    try { return JSON.parse(localStorage.getItem("forge_custom_exercises") || "[]"); }
    catch { return []; }
  });
  const fullExerciseLibrary = useMemo(() => Array.from(new Set([...EXERCISE_LIBRARY, ...customExercises])).sort((a, b) => a.localeCompare(b)), [customExercises]);
  const filtered = fullExerciseLibrary.filter((e) => e.toLowerCase().includes(search.toLowerCase()));
  const defaultPrescription = (exerciseName) => isTimedExercise(exerciseName)
    ? { name: exerciseName, numSets: 3, reps: "30-45 sec", weight: "" }
    : { name: exerciseName, numSets: 3, reps: "8-10", weight: "" };
  const addEx = (ex) => setDays((p) => p.map((d, i) => i === active ? { ...d, exercises: [...(d.exercises || []), defaultPrescription(ex)] } : d));
  const addCustomExercise = () => {
    const cleaned = customExercise.trim();
    if (!cleaned) return;
    const exists = fullExerciseLibrary.some((e) => e.toLowerCase() === cleaned.toLowerCase());
    const next = exists ? customExercises : [...customExercises, cleaned].sort((a, b) => a.localeCompare(b));
    setCustomExercises(next);
    localStorage.setItem("forge_custom_exercises", JSON.stringify(next));
    addEx(cleaned);
    setCustomExercise("");
    setSearch(cleaned);
  };
  const updateEx = (di, ei, f, v) => setDays((p) => p.map((d, i) => i === di ? { ...d, exercises: d.exercises.map((e, j) => j === ei ? { ...e, [f]: v } : e) } : d));
  const delDay = (di) => { const next = days.filter((_, i) => i !== di); setDays(next.length ? next : [{ name: "Day 1", exercises: [] }]); setActive(0); };
  return <div style={modalBackdrop()}><Card style={{ width: "100%", maxWidth: 980, maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column" }}><div style={{ display: "flex", gap: 10, marginBottom: 12 }}><input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle()} /><Button onClick={() => onSave({ name, totalWeeks: weeks, days })}>Save</Button><Button variant="ghost" onClick={onClose}>X</Button></div><div style={{ display: "flex", gap: 8, marginBottom: 10 }}>{[2, 4, 6, 8, 12].map((w) => <Button key={w} variant={weeks === w ? "gold" : "dark"} onClick={() => setWeeks(w)}>{w} weeks</Button>)}</div><div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 12, minHeight: 560, overflow: "hidden" }}><div style={{ overflow: "auto" }}><Button variant="dark" onClick={() => { setDays([...days, { name: `Day ${days.length + 1}`, exercises: [] }]); setActive(days.length); }} style={{ width: "100%", marginBottom: 10 }}>+ Add Day</Button>{days.map((d, i) => <div key={i} style={{ position: "relative", background: i === active ? client.color + "22" : BRAND.card2, border: `1px solid ${i === active ? client.color : BRAND.line}`, padding: 12, borderRadius: 14, marginBottom: 8, cursor: "pointer" }} onClick={() => setActive(i)}><button onClick={(e) => { e.stopPropagation(); delDay(i); }} style={{ position: "absolute", top: 5, right: 7, background: "transparent", border: "none", color: BRAND.red, cursor: "pointer", fontWeight: 1000 }}>x</button><div style={{ fontWeight: 900 }}>{d.name}</div><div style={{ color: BRAND.muted, fontSize: 12 }}>{d.exercises?.length || 0} exercises</div></div>)}<input placeholder="Search exercise..." value={search} onChange={(e) => setSearch(e.target.value)} style={inputStyle({ marginTop: 10 })} /><div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, marginTop: 8 }}><input placeholder="Custom exercise name" value={customExercise} onChange={(e) => setCustomExercise(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addCustomExercise(); }} style={inputStyle()} /><Button variant="dark" onClick={addCustomExercise}>Add</Button></div><div style={{ color: BRAND.muted, fontSize: 11, marginTop: 6 }}>If an exercise is missing, type it above and it will be saved on this device.</div>{filtered.slice(0, 220).map((ex) => <button key={ex} onClick={() => addEx(ex)} style={{ display: "block", width: "100%", textAlign: "left", marginTop: 4, background: "transparent", border: "none", color: customExercises.includes(ex) ? BRAND.gold : BRAND.text, padding: 8, cursor: "pointer" }}>+ {ex}{customExercises.includes(ex) ? "  custom" : ""}</button>)}</div><div style={{ overflow: "auto" }}><input value={days[active]?.name || ""} onChange={(e) => setDays((p) => p.map((d, i) => i === active ? { ...d, name: e.target.value } : d))} style={inputStyle({ marginBottom: 10, fontWeight: 900 })} />{days[active]?.exercises?.map((ex, ei) => <div key={ei} style={{ display: "grid", gridTemplateColumns: "1fr 70px 110px 90px 30px", gap: 8, alignItems: "center", background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 10, marginBottom: 8 }}><div style={{ fontWeight: 900 }}>{ex.name}<div style={{ color: BRAND.muted, fontSize: 10 }}>{isTimedExercise(ex.name) ? "Timed exercise" : "Reps exercise"}</div></div><input value={ex.numSets} onChange={(e) => updateEx(active, ei, "numSets", e.target.value)} style={inputStyle()} /><input value={ex.reps} placeholder={isTimedExercise(ex.name) ? "sec/min" : "reps"} onChange={(e) => updateEx(active, ei, "reps", e.target.value)} style={inputStyle()} /><input value={ex.weight} placeholder="kg" onChange={(e) => updateEx(active, ei, "weight", e.target.value)} style={inputStyle()} /><button onClick={() => setDays((p) => p.map((d, i) => i === active ? { ...d, exercises: d.exercises.filter((_, j) => j !== ei) } : d))} style={{ background: "transparent", border: "none", color: BRAND.red, fontWeight: 1000, cursor: "pointer" }}>x</button></div>)}</div></div></Card></div>;
}
 
function AIProgramBuilder({ client, onClose, onSave }) {
  const [days, setDays] = useState(4);
  const [weeks, setWeeks] = useState(4);
  const [extra, setExtra] = useState("");
  function build() {
    const goals = client.goals || [client.goal];
    const lowerBack = `${client.profile?.injuries || ""} ${extra}`.toLowerCase().includes("back");
    const split = days <= 3 ? ["Full Body A", "Full Body B", "Full Body C"] : ["Push", "Pull", "Legs", "Upper", "Conditioning"];
    const main = goals.includes("Strength") ? ["Squat", "Flat Barbell Bench Press", "Pull-Up", "Dead Hang", "Overhead Press"] : goals.includes("Fat Loss") ? ["Goblet Squat", "Push-Up", "Neutral Grip Lat Pulldown", "Dead Bug", "Sled Push"] : ["Leg Press", "Incline DB Chest Press", "Dumbbell Row", "DB Shoulder Press", "Dead Hang"];
    const safe = lowerBack ? main.filter((x) => !x.toLowerCase().includes("deadlift")) : main;
    const made = Array.from({ length: days }, (_, i) => ({ name: split[i] || `Day ${i + 1}`, exercises: safe.slice(0, 5).map((name) => ({ name, numSets: goals.includes("Strength") ? 4 : 3, reps: goals.includes("Strength") ? "4-6" : "8-12", weight: "" })) }));
    onSave({ name: `${client.name} AI Program`, totalWeeks: weeks, days: made });
  }
  return <div style={modalBackdrop()}><Card style={{ width: "100%", maxWidth: 520 }}><div style={{ fontSize: 24, fontWeight: 1000 }}>AI Program Builder</div><div style={{ color: BRAND.muted, marginBottom: 12 }}>Uses goals, injuries, and notes to make a safe starting plan.</div><div style={{ display: "flex", gap: 8, marginBottom: 12 }}>{[2, 3, 4, 5, 6].map((d) => <Button key={d} variant={days === d ? "gold" : "dark"} onClick={() => setDays(d)}>{d} days</Button>)}</div><div style={{ display: "flex", gap: 8, marginBottom: 12 }}>{[2, 4, 6, 8, 12].map((w) => <Button key={w} variant={weeks === w ? "gold" : "dark"} onClick={() => setWeeks(w)}>{w} weeks</Button>)}</div><Field label="Extra details" value={extra} onChange={setExtra} textarea /><div style={{ display: "flex", gap: 10, marginTop: 14 }}><Button onClick={build} style={{ flex: 1 }}>Generate</Button><Button variant="ghost" onClick={onClose}>Cancel</Button></div></Card></div>;
}
 
function SessionTracker({ client, program, saveProgram, isCoach }) {
  const logs = program.weekLogs || Array.from({ length: Number(program.totalWeeks || 4) }, (_, i) => makeWeek(i + 1, program.days || []));
  const [wk, setWk] = useState(0);
  const [dy, setDy] = useState(0);
  const week = logs[wk];
  const day = week?.days?.[dy];
  function patch(fn) { const next = fn(logs); saveProgram({ ...program, weekLogs: next }); }
  function setSet(ei, si, f, v) { patch((ls) => ls.map((w, wi) => wi !== wk ? w : { ...w, days: w.days.map((d, di) => di !== dy ? d : { ...d, sessionData: d.sessionData.map((ex, xi) => xi !== ei ? ex : { ...ex, sets: ex.sets.map((s, j) => j !== si ? s : { ...s, [f]: v }) }) }) })); }
  function setMeta(f, v) { patch((ls) => ls.map((w, wi) => wi !== wk ? w : { ...w, days: w.days.map((d, di) => di !== dy ? d : { ...d, [f]: v }) })); }
  function setMetric(f, v) { setMeta("metrics", { ...(day?.metrics || {}), [f]: v }); }
  return <Card><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>{logs.map((_, i) => <Button key={i} variant={wk === i ? "gold" : "dark"} onClick={() => { setWk(i); setDy(0); }}>Week {i + 1}</Button>)}</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>{week?.days?.map((d, i) => <Button key={i} variant={dy === i ? "gold" : "dark"} onClick={() => setDy(i)}>{d.name}</Button>)}</div>{day && <><div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10 }}><div><div style={{ fontSize: 20, fontWeight: 1000 }}>{day.name}</div><div style={{ color: BRAND.muted }}>Week {wk + 1}</div></div><input type="date" value={day.date || ""} onChange={(e) => setMeta("date", e.target.value)} style={inputStyle({ maxWidth: 180 })} /></div>{day.sessionData?.map((ex, ei) => {
    const history = getExerciseHistory(program, ex.name);
    const timed = history.timed;
    return <div key={ei} style={{ borderTop: `1px solid ${BRAND.line}`, paddingTop: 12, marginTop: 12 }}><div style={{ color: client.color, fontWeight: 1000, marginBottom: 8 }}>{ex.name}</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8, marginBottom: 10 }}><Mini label="Personal Best" value={history.best} /><Mini label="Recent" value={history.recent} /><Mini label="New" value={timed ? "Type hold time below" : "Type kg/reps below"} /></div>{ex.sets.map((s, si) => <div key={si} style={{ display: "grid", gridTemplateColumns: "50px 1fr 1fr 110px", gap: 8, marginBottom: 6, alignItems: "center" }}><div style={{ color: BRAND.muted }}>S{si + 1}</div><input placeholder={timed ? "load/assist" : "kg"} value={s.weight || ""} onChange={(e) => setSet(ei, si, "weight", e.target.value)} style={inputStyle()} /><input placeholder={timed ? "time held e.g. 30 sec" : "reps"} value={timed ? (s.duration || s.reps || "") : (s.reps || "")} onChange={(e) => setSet(ei, si, timed ? "duration" : "reps", e.target.value)} style={inputStyle()} /><select value={s.rpe || ""} onChange={(e) => setSet(ei, si, "rpe", e.target.value)} style={inputStyle()}>{RPE_OPTIONS.map((r) => <option key={r} value={r}>{r || "RPE"}</option>)}</select></div>)}</div>})}<div style={{ borderTop: `1px solid ${BRAND.line}`, marginTop: 14, paddingTop: 14 }}><div style={{ color: BRAND.gold, fontSize: 13, fontWeight: 1000, marginBottom: 10 }}>METRIC DATA</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}><Field label="Kcals" value={day.metrics?.kcal || ""} onChange={(v) => setMetric("kcal", v)} type="number" /><Field label="Max HR" value={day.metrics?.maxHR || ""} onChange={(v) => setMetric("maxHR", v)} type="number" /><Field label="Average HR" value={day.metrics?.avgHR || ""} onChange={(v) => setMetric("avgHR", v)} type="number" /></div></div><Field label="Session notes" value={day.notes} onChange={(v) => setMeta("notes", v)} textarea /></>}</Card>;
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
  const [nutrition, setNutrition] = useState(() => normalizeNutrition(client.nutrition));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [meal, setMeal] = useState("Breakfast");
  const [food, setFood] = useState(FOOD_DB[0]?.name || "");
  const [customFood, setCustomFood] = useState("");
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
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
    const base = selected || { name: customFood || "Custom food", kcal: 0, protein: 0, carbs: 0, fats: 0 };
    const q = Number(qty || 1);
    const entry = { id: uid(), date, meal, food: selected ? base.name : customFood || base.name, qty: q, kcal: Math.round(Number(base.kcal || 0) * q), protein: Math.round(Number(base.protein || 0) * q), carbs: Math.round(Number(base.carbs || 0) * q), fats: Math.round(Number(base.fats || 0) * q) };
    const next = normalizeNutrition({ ...nutrition, logs: [...(nutrition.logs || []), entry] });
    await save(next); setCustomFood(""); setQty(1);
  }
  async function delLog(id) { const next = normalizeNutrition({ ...nutrition, logs: (nutrition.logs || []).filter((l) => l.id !== id) }); await save(next); }
  async function saveDaily() { await save(nutrition); }
  const mealLogs = todays.filter((l) => l.meal === meal);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card style={{ background: `linear-gradient(135deg, ${client.color}22, ${BRAND.card})` }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", flexWrap: "wrap" }}>
          <div><div style={{ fontSize: 28, fontWeight: 1000, color: BRAND.gold }}>Nutrition</div><div style={{ color: BRAND.green, fontWeight: 800, marginTop: 5 }}>{aiFoodSuggestions(client)}</div></div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle({ maxWidth: 170 })} />
        </div>
      </Card>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><div><div style={{ color: BRAND.gold, fontWeight: 1000 }}>Daily Score</div><div style={{ fontSize: 42, fontWeight: 1000 }}>{score}%</div></div><div style={{ color: BRAND.muted }}>Estimated calories and macros. Restaurant portions vary.</div></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
          <Mini label="Calories" value={`${totals.kcal}/${targets.calories || 0}`} />
          <Mini label="Protein" value={`${totals.protein}g/${targets.protein || 0}g`} />
          <Mini label="Carbs" value={`${totals.carbs}g/${targets.carbs || 0}g`} />
          <Mini label="Fats" value={`${totals.fats}g/${targets.fats || 0}g`} />
          <Mini label="Water" value={`${daily.water || 0}/${targets.water || 8}`} />
          <Mini label="Steps" value={`${daily.steps || 0}/${targets.steps || 10000}`} />
        </div>
      </Card>
      <Card>
        <div style={{ fontSize: 18, fontWeight: 1000, marginBottom: 10 }}>Daily Habits</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
          <Field label="Steps" value={daily.steps || ""} onChange={(v) => setDaily("steps", v)} type="number" />
          <Field label="Water glasses" value={daily.water || ""} onChange={(v) => setDaily("water", v)} type="number" />
          <Field label="Weight today kg" value={daily.weight || ""} onChange={(v) => setDaily("weight", v)} type="number" />
        </div>
        <Button onClick={saveDaily} disabled={saving} style={{ marginTop: 12 }}>{saving ? "Saving..." : "Save Daily Habits"}</Button>
      </Card>
      {isCoach && <Card>
        <div style={{ fontSize: 18, fontWeight: 1000, marginBottom: 10 }}>Coach Nutrition Targets</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>{["calories", "protein", "carbs", "fats", "steps", "water"].map((k) => <Field key={k} label={`${k} target`} value={nutrition.targets[k] || ""} onChange={(v) => setTarget(k, v)} type="number" />)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 12 }}>{["Breakfast", "Lunch", "Dinner"].map((m) => <div key={m}><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 5 }}>{m.toUpperCase()} PLAN</div><textarea value={nutrition.mealPlan[m] || ""} onChange={(e) => setMealPlan(m, e.target.value)} placeholder={`Write ${m.toLowerCase()} foods, portions, notes...`} style={textareaStyle({ minHeight: 92 })} /></div>)}</div>
        <textarea value={nutrition.planNotes || ""} onChange={(e) => setNutrition((n) => ({ ...n, planNotes: e.target.value }))} placeholder="Coach notes: vegetarian/non-vegetarian, allergies, foods to avoid, meal timing..." style={textareaStyle({ minHeight: 80, marginTop: 10 })} />
        <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}><Button onClick={() => save()} disabled={saving}>{saving ? "Saving..." : "Save Nutrition Plan"}</Button>{message && <span style={{ color: BRAND.green, fontWeight: 900 }}>{message}</span>}</div>
      </Card>}
      <Card>
        <div style={{ fontSize: 18, fontWeight: 1000, marginBottom: 10 }}>Food Log</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, overflowX: "auto" }}>{["Breakfast", "Lunch", "Dinner"].map((m) => <Button key={m} variant={meal === m ? "gold" : "dark"} onClick={() => setMeal(m)}>{m}</Button>)}</div>
        {nutrition.mealPlan?.[meal] && <div style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 12, marginBottom: 12 }}><div style={{ color: BRAND.gold, fontWeight: 1000, marginBottom: 5 }}>{meal} Plan</div><div style={{ color: BRAND.text, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{nutrition.mealPlan[meal]}</div></div>}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(160px,2fr) minmax(120px,1.4fr) 90px 110px", gap: 8 }}>
          <select value={food} onChange={(e) => setFood(e.target.value)} style={inputStyle()}>{FOOD_DB.map((f) => <option key={f.name}>{f.name}</option>)}<option value="CUSTOM">Custom food</option></select>
          <input value={customFood} onChange={(e) => setCustomFood(e.target.value)} placeholder="Custom food name" disabled={food !== "CUSTOM"} style={inputStyle({ opacity: food === "CUSTOM" ? 1 : .45 })} />
          <input type="number" step="0.5" value={qty} onChange={(e) => setQty(e.target.value)} style={inputStyle()} />
          <Button onClick={addFood}>Add</Button>
        </div>
        <div style={{ marginTop: 14 }}>{mealLogs.length === 0 && <div style={{ color: BRAND.muted, padding: "12px 0" }}>No {meal.toLowerCase()} foods logged yet.</div>}{mealLogs.map((l) => <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, borderTop: `1px solid ${BRAND.line}`, paddingTop: 10, marginTop: 10 }}><div><b style={{ color: BRAND.text }}>{l.food}</b><div style={{ color: BRAND.muted }}>{l.qty}x · {l.kcal} kcal · P {l.protein}g · C {l.carbs}g · F {l.fats}g</div></div><Button variant="red" onClick={() => delLog(l.id)}>x</Button></div>)}</div>
      </Card>
    </div>
  );
}
 
function TransformPhotos({ client, updateClient }) {
  const [photos, setPhotos] = useState(client.transformPhotos || []);
  const [form, setForm] = useState({ image: "", type: "Front", weight: "", notes: "", date: new Date().toISOString().slice(0, 10) });
  async function pickImage(file) { if (!file) return; const dataUrl = await readFileAsDataUrl(file); setForm((f) => ({ ...f, image: dataUrl })); }
  async function add() { if (!form.image) { alert("Choose a photo from your device first."); return; } const next = [{ id: uid(), ...form }, ...photos]; setPhotos(next); await upsertSection(client.id, "transformPhotos", next); updateClient({ ...client, transformPhotos: next }); setForm({ ...form, image: "", notes: "" }); }
  async function del(id) { const next = photos.filter((p) => p.id !== id); setPhotos(next); await upsertSection(client.id, "transformPhotos", next); updateClient({ ...client, transformPhotos: next }); }
  return <Card><div style={{ fontSize: 22, fontWeight: 1000, marginBottom: 12 }}>Transform Photos</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}><div><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>CHOOSE PHOTO</div><input type="file" accept="image/*" onChange={(e) => pickImage(e.target.files?.[0])} style={inputStyle()} /></div><label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>TYPE</div><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={inputStyle()}>{PHOTO_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label><Field label="Weight" value={form.weight} onChange={(v) => setForm({ ...form, weight: v })} /><Field label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} /></div>{form.image && <img src={form.image} alt="preview" style={{ width: 160, height: 160, objectFit: "cover", borderRadius: 18, marginTop: 12 }} />}<Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} textarea /><Button onClick={add} style={{ marginTop: 10 }}>Save Photo</Button><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginTop: 14 }}>{photos.map((p) => <div key={p.id} style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 16, overflow: "hidden" }}>{p.image || p.url ? <img src={p.image || p.url} alt="progress" style={{ width: "100%", height: 180, objectFit: "cover" }} /> : <div style={{ height: 180, display: "grid", placeItems: "center", color: BRAND.muted }}>No image</div>}<div style={{ padding: 10 }}><b>{p.type}</b><div style={{ color: BRAND.muted }}>{p.date} · {p.weight}kg</div><div style={{ color: BRAND.text }}>{p.notes}</div><Button variant="red" onClick={() => del(p.id)} style={{ marginTop: 8 }}>Delete</Button></div></div>)}</div></Card>;
}
function ProgressTab({ client }) {
  const latest = client.progress?.[client.progress.length - 1] || {};
  const metrics = computePerformanceMetrics(client.program);
  const sessions = recentCompletedSessions(client.program, 8);
  const nutritionStats = todaysNutritionStats(client);
  return <div style={{ display: "grid", gap: 16 }}>
    <Card style={{ background: `radial-gradient(circle at 20% 15%, ${client.color}22, transparent 35%), linear-gradient(180deg, #151821, #090a0e)` }}>
      <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 1000, letterSpacing: 2 }}>PROGRESS DASHBOARD</div>
      <div style={{ fontSize: 29, fontWeight: 1000, marginTop: 6 }}>Your performance trend</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginTop: 14 }}>
        <PremiumTile label="Today Score" value={`${nutritionStats.score}%`} color={client.color} />
        <PremiumTile label="Steps" value={nutritionStats.daily.steps || 0} sub="today" color={BRAND.gold} />
        <PremiumTile label="Weight" value={nutritionStats.daily.weight || client.weight || "-"} sub="kg" color={BRAND.green} />
        <PremiumTile label="Logged Sessions" value={sessions.length} color={BRAND.cyan} />
      </div>
    </Card>
    <Card><div style={{ fontSize: 22, fontWeight: 1000, marginBottom: 12 }}>Performance Metrics</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>{metrics.map((m) => <div key={m.name} style={{ background: "linear-gradient(180deg,#151821,#0d0f15)", border: `1px solid ${BRAND.line}`, borderRadius: 22, padding: 14 }}><div style={{ color: BRAND.gold, fontWeight: 1000 }}>{m.name}</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}><Mini label="PB" value={metricDisplay(m.best, m.timed)} /><Mini label="Recent" value={metricDisplay(m.recent, m.timed)} /></div><div style={{ color: m.trend > 0 ? BRAND.green : BRAND.muted, fontSize: 12, fontWeight: 900, marginTop: 10 }}>Trend: {m.trend > 0 ? "+" : ""}{m.trend || 0}{m.timed ? " sec" : " kg"}</div></div>)}</div></Card>
    <Card><div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 12 }}>Session History</div>{sessions.length === 0 && <div style={{ color: BRAND.muted }}>No completed sessions logged yet.</div>}{sessions.map((d, i) => <div key={i} style={{ borderTop: `1px solid ${BRAND.line}`, paddingTop: 12, marginTop: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><b>{d.date || "No date"} · {d.name}</b><span style={{ color: BRAND.muted }}>Week {d.weekNum}</span></div><div style={{ color: BRAND.muted, marginTop: 6 }}>{(d.sessionData || []).map((ex) => `${ex.name}: ${(ex.sets || []).map((s) => isTimedExercise(ex.name) ? (s.duration || s.reps || "") : [s.weight && `${s.weight}kg`, s.reps && `${s.reps} reps`].filter(Boolean).join(" x ")).filter(Boolean).join(", ") || "not logged"}`).join(" | ")}</div>{d.metrics && <div style={{ color: BRAND.gold, fontSize: 12, marginTop: 6 }}>Kcal {d.metrics.kcal || "-"} · Max HR {d.metrics.maxHR || "-"} · Avg HR {d.metrics.avgHR || "-"}</div>}</div>)}</Card>
    <Card><div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 12 }}>Classic Lifts</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>{LIFT_FIELDS.map((f) => <Mini key={f.key} label={f.label} value={latest[f.key] || "-"} />)}</div></Card>
  </div>;
}
 
function ScheduleTab({ client, updateClient }) {
  const [schedule, setSchedule] = useState(client.schedule || []);
  const [form, setForm] = useState({ day: "Mon", time: DEFAULT_TIME_SLOTS[0] });
  async function save(next) { setSchedule(next); await upsertSection(client.id, "sessions", { schedule: next, checkIns: client.checkIns || [], sessions: client.sessions || 0 }); updateClient({ ...client, schedule: next }); }
  return <Card><div style={{ fontSize: 22, fontWeight: 1000, marginBottom: 12 }}>Recurring Schedule</div><div style={{ color: BRAND.muted, marginBottom: 12 }}>These recurring times automatically appear in the main Calendar.</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}><select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} style={inputStyle()}>{DAYS.map((d) => <option key={d}>{d}</option>)}</select><select value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} style={inputStyle()}>{DEFAULT_TIME_SLOTS.map((t, i) => <option key={`${t}_${i}`} value={t}>{timeLabel(t)}</option>)}</select><Button onClick={() => save([...schedule, { ...form, id: uid() }])}>Add</Button></div><div style={{ marginTop: 12 }}>{schedule.map((s, i) => <div key={s.id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${BRAND.line}`, padding: 10 }}><b>{s.day} · {timeLabel(s.time)}</b><Button variant="red" onClick={() => save(schedule.filter((_, j) => j !== i))}>x</Button></div>)}</div></Card>;
}
function InviteTab({ client, updateClient }) {
  const [code, setCode] = useState(client.inviteCode || makeInviteCode());
  async function saveInvite() { await supabase.from("clients").update({ invite_code: code, invite_status: "sent" }).eq("id", client.id); updateClient({ ...client, inviteCode: code, inviteStatus: "sent" }); }
  const link = `${window.location.origin}?invite=${code}`;
  return <Card><div style={{ fontSize: 22, fontWeight: 1000 }}>Invite Client</div><div style={{ color: BRAND.muted, marginBottom: 12 }}>Client uses this code to claim the profile you created.</div><Field label="Invite Code" value={code} onChange={(v) => setCode(v.toUpperCase())} /><Button onClick={saveInvite} style={{ marginTop: 10 }}>Save Invite</Button><div style={{ marginTop: 12, color: BRAND.green, wordBreak: "break-all" }}>{link}</div></Card>;
}
 
function ClientWorkoutLog({ client, updateClient }) {
  const [logs, setLogs] = useState(client.workoutLogs || []);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), workout: "", weights: "", cardio: "", rpe: "", notes: "" });
  async function add() { const next = [{ id: uid(), ...form }, ...logs]; setLogs(next); await upsertSection(client.id, "workoutLogs", next); updateClient({ ...client, workoutLogs: next }); setForm({ ...form, workout: "", weights: "", cardio: "", rpe: "", notes: "" }); }
  return <Card><div style={{ fontSize: 22, fontWeight: 1000 }}>Workout Log</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}><Field label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} /><Field label="Workout done" value={form.workout} onChange={(v) => setForm({ ...form, workout: v })} /><Field label="Weights / reps" value={form.weights} onChange={(v) => setForm({ ...form, weights: v })} /><Field label="Cardio" value={form.cardio} onChange={(v) => setForm({ ...form, cardio: v })} /><Field label="RPE" value={form.rpe} onChange={(v) => setForm({ ...form, rpe: v })} /></div><Field label="Notes" textarea value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} /><Button onClick={add} style={{ marginTop: 10 }}>Log Workout</Button>{logs.map((l) => <div key={l.id} style={{ borderTop: `1px solid ${BRAND.line}`, marginTop: 12, paddingTop: 12 }}><b>{l.date} - {l.workout}</b><div style={{ color: BRAND.muted }}>{l.weights} · {l.cardio} · RPE {l.rpe}</div><div>{l.notes}</div></div>)}</Card>;
}
 
function PackagesTab({ client, updateClient }) {
  const [packages, setPackages] = useState(client.packages || []);
  const [form, setForm] = useState({ name: "10 Session Pack", total: 10, used: 0, price: "", paid: false });
  async function save(next) { setPackages(next); await upsertSection(client.id, "packages", next); updateClient({ ...client, packages: next }); }
  function addPackage() { const next = [{ id: uid(), ...form, total: Number(form.total || 0), used: Number(form.used || 0), price: Number(form.price || 0) }, ...packages]; save(next); setForm({ name: "10 Session Pack", total: 10, used: 0, price: "", paid: false }); }
  const totalSessions = packages.reduce((a, p) => a + Number(p.total || 0), 0);
  const usedSessions = packages.reduce((a, p) => a + Number(p.used || 0), 0);
  return <Card><div style={{ fontSize: 22, fontWeight: 1000, marginBottom: 12 }}>Packages</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 14 }}><Mini label="Total Sessions" value={totalSessions} /><Mini label="Used" value={usedSessions} /><Mini label="Left" value={Math.max(totalSessions - usedSessions, 0)} /></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}><Field label="Package name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} /><Field label="Total sessions" type="number" value={form.total} onChange={(v) => setForm({ ...form, total: v })} /><Field label="Used sessions" type="number" value={form.used} onChange={(v) => setForm({ ...form, used: v })} /><Field label="Price AED" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} /></div><label style={{ display: "block", marginTop: 10, color: BRAND.muted }}><input type="checkbox" checked={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.checked })} /> Paid</label><Button onClick={addPackage} style={{ marginTop: 12 }}>Add Package</Button><div style={{ marginTop: 14 }}>{packages.map((p) => { const left = Math.max(Number(p.total || 0) - Number(p.used || 0), 0); return <div key={p.id} style={{ borderTop: `1px solid ${BRAND.line}`, paddingTop: 12, marginTop: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div><b>{p.name}</b><div style={{ color: BRAND.muted }}>{Number(p.used || 0)}/{Number(p.total || 0)} used · {left} left · {moneyAED(p.price)} · {p.paid ? "Paid" : "Unpaid"}</div></div><div style={{ display: "flex", gap: 6 }}><Button variant="dark" onClick={() => save(packages.map((x) => x.id === p.id ? { ...x, used: Math.min(Number(x.used || 0) + 1, Number(x.total || 0)) } : x))}>+ Use</Button><Button variant="red" onClick={() => save(packages.filter((x) => x.id !== p.id))}>x</Button></div></div></div>})}</div></Card>;
}
 
function Calendar({ clients, refresh, user }) {
  const [slots, setSlots] = useState(() => normalizeSlots(JSON.parse(localStorage.getItem("forge_time_slots") || "null")));
  const [bookings, setBookings] = useState([]);
  const [newSlot, setNewSlot] = useState("");
  const [draft, setDraft] = useState(null);
  useEffect(() => { load(); }, []);
  async function load() { const uidVal = user?.id || (await supabase.auth.getUser()).data.user?.id; const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", uidVal).eq("section", "calendar").maybeSingle(); setBookings(data?.data?.bookings || []); }
  async function save(next) { setBookings(next); const uidVal = user?.id || (await supabase.auth.getUser()).data.user?.id; await upsertTrainerData(uidVal, "calendar", { bookings: next }); }
  function autoBookings() { return clients.flatMap((c) => (c.schedule || []).map((s) => ({ id: `auto_${c.id}_${s.day}_${s.time}`, day: s.day, time: s.time, title: c.name, type: "Client Session", color: c.color, auto: true }))); }
  const all = [...autoBookings(), ...bookings];
  function removeSlot(id) { const next = slots.filter((x) => x.id !== id); setSlots(next); localStorage.setItem("forge_time_slots", JSON.stringify(next)); }
  function addSlot() { if (!newSlot) return; const next = [...slots, { id: uid(), label: newSlot }]; setSlots(next); localStorage.setItem("forge_time_slots", JSON.stringify(next)); setNewSlot(""); }
  function openBooking(day, slot) { setDraft({ day, time: slot.label, type: "Client Session", clientId: clients[0]?.id || "", title: clients[0]?.name || "", color: clients[0]?.color || BRAND.blue }); }
  function saveDraft() { if (!draft?.title) { alert("Add a booking name or choose a client."); return; } const color = draft.type === "Free Trial" ? BRAND.red : draft.color; save([...bookings, { id: uid(), ...draft, color }]); setDraft(null); }
  return <Card style={{ overflowX: "auto" }}><div style={{ display: "flex", gap: 8, marginBottom: 12 }}><input value={newSlot} onChange={(e) => setNewSlot(e.target.value)} placeholder="Add time e.g. 6:30 PM" style={inputStyle({ maxWidth: 190 })} /><Button onClick={addSlot}>Add time</Button></div><table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 6, minWidth: 760 }}><thead><tr><th></th>{DAYS.map((d) => <th key={d} style={{ color: BRAND.gold }}>{d}</th>)}</tr></thead><tbody>{slots.map((slot) => <tr key={slot.id}><td style={{ color: BRAND.muted, fontWeight: 900, minWidth: 70 }}>{timeLabel(slot.label)} <button onClick={() => removeSlot(slot.id)} style={{ background: "transparent", border: "none", color: BRAND.red, cursor: "pointer" }}>x</button></td>{DAYS.map((d) => { const b = all.find((x) => x.day === d && timeKey(x.time) === timeKey(slot.label)); return <td key={d} onClick={() => !b && openBooking(d, slot)} style={{ height: 48, background: b ? b.color : "#0b0c10", color: b ? "#000" : BRAND.dim, border: `1px solid ${BRAND.line}`, borderRadius: 10, padding: 8, cursor: "pointer", fontWeight: 900 }}>{b ? b.title : ""}{b && !b.auto && <button onClick={(e) => { e.stopPropagation(); save(bookings.filter((x) => x.id !== b.id)); }} style={{ float: "right", background: "transparent", border: "none", cursor: "pointer" }}>x</button>}</td>; })}</tr>)}</tbody></table>{draft && <div style={modalBackdrop()}><Card style={{ width: "100%", maxWidth: 520 }}><div style={{ fontSize: 24, fontWeight: 1000, marginBottom: 12 }}>Book {draft.day} · {draft.time}</div><label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>TYPE</div><select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value, color: e.target.value === "Free Trial" ? BRAND.red : draft.color })} style={inputStyle()}><option>Client Session</option><option>Free Trial</option><option>Consultation</option></select></label>{draft.type !== "Free Trial" && <label style={{ display: "block", marginTop: 10 }}><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>CLIENT</div><select value={draft.clientId} onChange={(e) => { const c = clients.find((x) => x.id === e.target.value); setDraft({ ...draft, clientId: e.target.value, title: c?.name || draft.title, color: c?.color || draft.color }); }} style={inputStyle()}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}<Field label="Booking name" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} /><div style={{ marginTop: 10 }}><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>COLOR</div><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{CLIENT_COLORS.map((c) => <button key={c} disabled={draft.type === "Free Trial"} onClick={() => setDraft({ ...draft, color: c })} style={{ width: 34, height: 34, borderRadius: 12, border: draft.color === c ? `3px solid ${BRAND.text}` : `1px solid ${BRAND.line}`, background: draft.type === "Free Trial" ? BRAND.red : c, opacity: draft.type === "Free Trial" ? .45 : 1, cursor: "pointer" }} />)}</div></div><div style={{ display: "flex", gap: 10, marginTop: 14 }}><Button onClick={saveDraft} style={{ flex: 1 }}>Save booking</Button><Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button></div></Card></div>}</Card>;
}
function RatingSelect({ label, value, onChange }) {
  return <label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>{label}</div><select value={value || ""} onChange={(e) => onChange(e.target.value)} style={inputStyle()}><option value="">Choose 1-5</option>{[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>;
}
function Trials({ user }) {
  const [trials, setTrials] = useState([]);
  const [tab, setTab] = useState("consultation");
  const [form, setForm] = useState({ name: "", phone: "", email: "", goal: "", fitnessHistory: "", barriers: "", injuries: "", medicalIssues: "", nutrition: "", sleep: "", neat: "", fatLossImportance: "", muscleGainImportance: "", strengthEnduranceImportance: "", mobilityFlexibilityImportance: "", assessmentDate: "", cardiovascular: "", squat: "", pushStrength: "", pullStrength: "", coreStrength: "", flexibilityFitness: "" });
  useEffect(() => { load(); }, []);
  async function load() { const uidVal = user?.id || (await supabase.auth.getUser()).data.user?.id; const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", uidVal).eq("section", "trials").maybeSingle(); setTrials(data?.data?.trials || []); }
  async function save(next) { setTrials(next); const uidVal = user?.id || (await supabase.auth.getUser()).data.user?.id; await upsertTrainerData(uidVal, "trials", { trials: next }); }
  function set(k, v) { setForm({ ...form, [k]: v }); }
  return <Card><div style={{ fontSize: 22, fontWeight: 1000 }}>Trials</div><div style={{ display: "flex", gap: 8, margin: "12px 0" }}><Button variant={tab === "consultation" ? "gold" : "dark"} onClick={() => setTab("consultation")}>Consultation</Button><Button variant={tab === "assessment" ? "gold" : "dark"} onClick={() => setTab("assessment")}>Fitness Assessment</Button></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}><Field label="Name" value={form.name} onChange={(v) => set("name", v)} /><Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} /><Field label="Email" value={form.email} onChange={(v) => set("email", v)} />{tab === "consultation" ? <><Field label="Goal" value={form.goal} onChange={(v) => set("goal", v)} textarea /><Field label="Fitness history" value={form.fitnessHistory} onChange={(v) => set("fitnessHistory", v)} textarea /><Field label="Barriers" value={form.barriers} onChange={(v) => set("barriers", v)} textarea /><Field label="Injuries" value={form.injuries} onChange={(v) => set("injuries", v)} textarea /><Field label="Medical issues" value={form.medicalIssues} onChange={(v) => set("medicalIssues", v)} textarea /><Field label="Nutrition" value={form.nutrition} onChange={(v) => set("nutrition", v)} textarea /><Field label="Sleep" value={form.sleep} onChange={(v) => set("sleep", v)} textarea /><Field label="NEAT / daily activity" value={form.neat} onChange={(v) => set("neat", v)} textarea /><div style={{ gridColumn: "1 / -1", color: BRAND.gold, fontWeight: 1000, marginTop: 8 }}>On a scale of 1-5, rate how important these are to the client:</div><RatingSelect label="Fat loss" value={form.fatLossImportance} onChange={(v) => set("fatLossImportance", v)} /><RatingSelect label="Muscle gain" value={form.muscleGainImportance} onChange={(v) => set("muscleGainImportance", v)} /><RatingSelect label="Strength and endurance" value={form.strengthEnduranceImportance} onChange={(v) => set("strengthEnduranceImportance", v)} /><RatingSelect label="Mobility & flexibility" value={form.mobilityFlexibilityImportance} onChange={(v) => set("mobilityFlexibilityImportance", v)} /></> : <><Field label="Date" type="date" value={form.assessmentDate} onChange={(v) => set("assessmentDate", v)} /><Field label="Cardiovascular fitness" value={form.cardiovascular} onChange={(v) => set("cardiovascular", v)} /><Field label="Squat" value={form.squat} onChange={(v) => set("squat", v)} /><Field label="Push strength" value={form.pushStrength} onChange={(v) => set("pushStrength", v)} /><Field label="Pull strength" value={form.pullStrength} onChange={(v) => set("pullStrength", v)} /><Field label="Core strength" value={form.coreStrength} onChange={(v) => set("coreStrength", v)} /><Field label="Flexibility fitness" value={form.flexibilityFitness} onChange={(v) => set("flexibilityFitness", v)} /></>}</div><Button onClick={() => save([{ id: uid(), ...form }, ...trials])} style={{ marginTop: 12 }}>Save Trial</Button>{trials.map((t) => <div key={t.id} style={{ borderTop: `1px solid ${BRAND.line}`, paddingTop: 12, marginTop: 12 }}><b>{t.name}</b><div style={{ color: BRAND.muted }}>{t.phone} · {t.email}</div><Button variant="red" onClick={() => save(trials.filter((x) => x.id !== t.id))} style={{ marginTop: 8 }}>Delete</Button></div>)}</Card>;
}
export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trainer, setTrainer] = useState(null);
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [clientPortal, setClientPortal] = useState(null);
  const [syncStatus, setSyncStatus] = useState(typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline");
 
  useEffect(() => {
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
 
  if (loading) return <div style={{ minHeight: "100vh", background: BRAND.bg, color: BRAND.gold, display: "grid", placeItems: "center", fontSize: 28, fontWeight: 1000 }}>FORGE loading...</div>;
  if (!session) return <LoginScreen onReady={() => supabase.auth.getSession().then(({ data }) => data.session && boot(data.session.user))} />;
  if (clientPortal) return <ClientView client={clientPortal} updateClient={updateClient} isCoach={false} refresh={() => boot(session.user)} />;
  if (selected) return <ClientView client={selected} updateClient={updateClient} back={() => setSelected(null)} refresh={() => loadCoach(session.user)} isCoach />;
  return <CoachDashboard user={session.user} trainer={trainer} setTrainer={setTrainer} clients={clients} setClients={setClients} selectClient={setSelected} refresh={() => loadCoach(session.user)} syncStatus={syncStatus} />;
}
