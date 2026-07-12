import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
const textareaStyle = (extra = {}) => ({
  width: "100%",
  minHeight: 90,
  background: BRAND.card2,
  border: `1px solid ${BRAND.line}`,
  borderRadius: 12,
  color: BRAND.text,
  padding: "12px",
  resize: "vertical",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  fontSize: 16,
  ...extra,
});
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
  - V6.1: true phone-first client portal across Home, Nutrition, Program, Progress, Photos, Profile
  - V6.1: tablet-friendly coach dashboard with cleaner cards and compact layout
  - V6.1: fixed mobile viewport so the app does not render as a wide desktop page on phones
  - V6.5: smart custom food macro estimator for combined meals like chapati + chicken curry + rice
  - V6.5: spreadsheet-style calendar zoom slider with Fit Week view
*/
const BRAND = {
  bg: "#050810",
  panel: "#0a0e1a",
  card: "#0f1424",
  card2: "#161c30",
  line: "#26314a",
  text: "#ffffff",
  muted: "#a8adba",
  dim: "#78808f",
  gold: "#E8C547",
  red: "#FF5C5C",
  green: "#3DD68C",
  cyan: "#3FC7C0",
  blue: "#5B9EF9",
  purple: "#A78BFA",
  orange: "#FFA94D",
};
const GLOBAL_TEXT_CSS = `
  html, body, #root { margin: 0 !important; padding: 0 !important; border: none !important; outline: none !important; box-shadow: none !important; background: ${BRAND.bg} !important; min-height: 100%; }
  body { min-height: 100vh; }
  * { font-weight: 700 !important; }
  input, textarea, select, button { font-weight: 700 !important; }
  ::placeholder { font-weight: 600 !important; opacity: 0.8; }
`;
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
const CLIENT_TYPES = ["1:1", "Online"];
const DEFAULT_CHECKIN_QUESTIONS = [
  { id: "q1", text: "What's your current weight?", type: "text" },
  { id: "q2", text: "Energy this week", type: "choice", options: ["Struggling", "Steady", "Strong", "Crushing It"] },
  { id: "q3", text: "How was your sleep this week?", type: "choice", options: ["Poor", "Fair", "Good", "Excellent"] },
  { id: "q4", text: "Stuck to your program this week", type: "choice", options: ["Struggling", "Steady", "Strong", "Crushing It"] },
  { id: "q8", text: "Stuck to your nutrition this week", type: "choice", options: ["Struggling", "Steady", "Strong", "Crushing It"] },
  { id: "q5", text: "What's your biggest win this week?", type: "text" },
  { id: "q6", text: "What was your biggest challenge this week?", type: "text" },
  { id: "q7", text: "Anything your coach should know?", type: "text" },
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
  { name: "Idli 2 pieces", kcal: 140, protein: 5, carbs: 30, fats: 1, tags: ["vegetarian", "vegan", "lactose-free"] },
  { name: "Masala dosa 1 piece", kcal: 390, protein: 9, carbs: 55, fats: 14, tags: ["vegetarian", "lactose-free"] },
  { name: "Plain dosa 1 piece", kcal: 180, protein: 5, carbs: 28, fats: 5, tags: ["vegetarian", "vegan", "lactose-free"] },
  { name: "Upma 1 bowl", kcal: 300, protein: 8, carbs: 45, fats: 10, tags: ["vegetarian"] },
  { name: "Poha 1 bowl", kcal: 280, protein: 7, carbs: 46, fats: 8, tags: ["vegetarian", "lactose-free"] },
  { name: "Samosa 1 piece", kcal: 260, protein: 5, carbs: 30, fats: 14, tags: ["vegetarian", "lactose-free"] },
  { name: "Chicken korma 1 bowl", kcal: 560, protein: 34, carbs: 18, fats: 40, tags: ["non-vegetarian"] },
  { name: "Fish curry 1 bowl", kcal: 380, protein: 35, carbs: 12, fats: 22, tags: ["non-vegetarian", "gluten-free"] },
  { name: "Prawn curry 1 bowl", kcal: 360, protein: 32, carbs: 14, fats: 20, tags: ["non-vegetarian", "gluten-free"] },
  { name: "Mutton curry 1 bowl", kcal: 590, protein: 34, carbs: 12, fats: 45, tags: ["non-vegetarian", "gluten-free"] },
  { name: "Chicken kebab 200g", kcal: 420, protein: 50, carbs: 8, fats: 20, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Beef kebab 200g", kcal: 480, protein: 46, carbs: 8, fats: 28, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Grilled fish 200g", kcal: 300, protein: 44, carbs: 0, fats: 12, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Grilled salmon 200g", kcal: 416, protein: 40, carbs: 0, fats: 26, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Mixed grill plate", kcal: 850, protein: 70, carbs: 35, fats: 45, tags: ["non-vegetarian"] },
  { name: "Lamb chops 3 pieces", kcal: 650, protein: 45, carbs: 0, fats: 50, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Chicken mandi 1 plate", kcal: 820, protein: 44, carbs: 100, fats: 26, tags: ["non-vegetarian", "lactose-free"] },
  { name: "Chicken madghout 1 plate", kcal: 850, protein: 42, carbs: 105, fats: 28, tags: ["non-vegetarian", "lactose-free"] },
  { name: "Lamb mandi 1 plate", kcal: 980, protein: 45, carbs: 105, fats: 42, tags: ["non-vegetarian", "lactose-free"] },
  { name: "Manakish cheese 1 piece", kcal: 420, protein: 15, carbs: 45, fats: 20, tags: ["vegetarian"] },
  { name: "Manakish zaatar 1 piece", kcal: 330, protein: 9, carbs: 45, fats: 12, tags: ["vegetarian", "vegan", "lactose-free"] },
  { name: "Fattoush salad 1 bowl", kcal: 180, protein: 4, carbs: 22, fats: 9, tags: ["vegetarian", "vegan", "lactose-free"] },
  { name: "Tabbouleh 1 bowl", kcal: 160, protein: 4, carbs: 22, fats: 6, tags: ["vegetarian", "vegan", "lactose-free"] },
  { name: "Greek salad 1 bowl", kcal: 250, protein: 10, carbs: 14, fats: 18, tags: ["vegetarian", "gluten-free"] },
  { name: "Chicken Caesar salad", kcal: 520, protein: 38, carbs: 22, fats: 32, tags: ["non-vegetarian"] },
  { name: "Tuna salad", kcal: 360, protein: 35, carbs: 15, fats: 18, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Turkey sandwich", kcal: 430, protein: 28, carbs: 45, fats: 15, tags: ["non-vegetarian"] },
  { name: "Chicken sandwich", kcal: 480, protein: 32, carbs: 48, fats: 18, tags: ["non-vegetarian"] },
  { name: "Beef burger", kcal: 750, protein: 38, carbs: 55, fats: 42, tags: ["non-vegetarian"] },
  { name: "Chicken burger", kcal: 650, protein: 35, carbs: 52, fats: 32, tags: ["non-vegetarian"] },
  { name: "French fries medium", kcal: 365, protein: 4, carbs: 48, fats: 17, tags: ["vegetarian", "vegan", "lactose-free"] },
  { name: "Pizza slice", kcal: 285, protein: 12, carbs: 36, fats: 10, tags: ["vegetarian"] },
  { name: "Pasta chicken Alfredo 1 plate", kcal: 850, protein: 42, carbs: 90, fats: 35, tags: ["non-vegetarian"] },
  { name: "Pasta arrabbiata 1 plate", kcal: 620, protein: 16, carbs: 100, fats: 16, tags: ["vegetarian", "vegan", "lactose-free"] },
  { name: "White rice 1 cup", kcal: 205, protein: 4, carbs: 45, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Brown rice 1 cup", kcal: 216, protein: 5, carbs: 45, fats: 2, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Quinoa 1 cup", kcal: 222, protein: 8, carbs: 39, fats: 4, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Sweet potato 200g", kcal: 180, protein: 4, carbs: 42, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Boiled eggs 3 pieces", kcal: 216, protein: 18, carbs: 0, fats: 15, tags: ["vegetarian", "gluten-free", "lactose-free"] },
  { name: "Omelette 3 eggs", kcal: 300, protein: 21, carbs: 2, fats: 23, tags: ["vegetarian", "gluten-free", "lactose-free"] },
  { name: "Overnight oats with whey", kcal: 520, protein: 38, carbs: 62, fats: 12, tags: ["vegetarian"] },
  { name: "Protein smoothie", kcal: 420, protein: 35, carbs: 45, fats: 10, tags: ["vegetarian"] },
  { name: "Chicken fried rice 1 plate", kcal: 720, protein: 32, carbs: 92, fats: 24, tags: ["non-vegetarian", "lactose-free"] },
  { name: "Egg fried rice 1 plate", kcal: 650, protein: 22, carbs: 90, fats: 22, tags: ["vegetarian", "lactose-free"] },
  { name: "Veg fried rice 1 plate", kcal: 590, protein: 14, carbs: 88, fats: 18, tags: ["vegetarian", "vegan", "lactose-free"] },
  { name: "Chicken noodles 1 plate", kcal: 760, protein: 36, carbs: 95, fats: 26, tags: ["non-vegetarian", "lactose-free"] },
  { name: "Veg noodles 1 plate", kcal: 620, protein: 16, carbs: 95, fats: 18, tags: ["vegetarian", "vegan", "lactose-free"] },
  { name: "Chicken momos 6 pieces", kcal: 420, protein: 24, carbs: 48, fats: 14, tags: ["non-vegetarian", "lactose-free"] },
  { name: "Veg momos 6 pieces", kcal: 360, protein: 12, carbs: 52, fats: 10, tags: ["vegetarian", "vegan", "lactose-free"] },
  { name: "Chicken thali", kcal: 950, protein: 45, carbs: 115, fats: 32, tags: ["non-vegetarian"] },
  { name: "Vegetarian thali", kcal: 880, protein: 28, carbs: 125, fats: 28, tags: ["vegetarian"] },
  { name: "Fish biryani 1 plate", kcal: 740, protein: 38, carbs: 88, fats: 24, tags: ["non-vegetarian", "lactose-free"] },
  { name: "Paneer biryani 1 plate", kcal: 820, protein: 28, carbs: 90, fats: 36, tags: ["vegetarian"] },
  { name: "Chicken 65 200g", kcal: 520, protein: 40, carbs: 22, fats: 30, tags: ["non-vegetarian", "lactose-free"] },
  { name: "Gobi manchurian 1 bowl", kcal: 420, protein: 10, carbs: 55, fats: 18, tags: ["vegetarian", "vegan", "lactose-free"] },
  { name: "Chicken manchurian 1 bowl", kcal: 520, protein: 36, carbs: 42, fats: 24, tags: ["non-vegetarian", "lactose-free"] },
  { name: "Palak paneer 1 bowl", kcal: 430, protein: 22, carbs: 18, fats: 30, tags: ["vegetarian", "gluten-free"] },
  { name: "Aloo gobi 1 bowl", kcal: 280, protein: 7, carbs: 38, fats: 12, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Bhindi masala 1 bowl", kcal: 240, protein: 6, carbs: 25, fats: 14, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Chicken tikka masala 1 bowl", kcal: 560, protein: 38, carbs: 22, fats: 36, tags: ["non-vegetarian"] },
  { name: "Keema 1 bowl", kcal: 480, protein: 35, carbs: 12, fats: 34, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Chicken soup 1 bowl", kcal: 180, protein: 22, carbs: 8, fats: 6, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Lentil soup 1 bowl", kcal: 210, protein: 12, carbs: 30, fats: 5, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Arabic lentil soup 1 bowl", kcal: 200, protein: 11, carbs: 30, fats: 4, tags: ["vegetarian", "vegan", "lactose-free"] },
  { name: "Chicken wrap grilled", kcal: 520, protein: 38, carbs: 48, fats: 18, tags: ["non-vegetarian"] },
  { name: "Beef shawarma wrap", kcal: 620, protein: 34, carbs: 50, fats: 30, tags: ["non-vegetarian"] },
  { name: "Chicken shawarma plate", kcal: 850, protein: 55, carbs: 80, fats: 32, tags: ["non-vegetarian"] },
  { name: "Falafel wrap", kcal: 560, protein: 18, carbs: 70, fats: 24, tags: ["vegetarian", "vegan", "lactose-free"] },
  { name: "Hummus with pita", kcal: 420, protein: 14, carbs: 55, fats: 16, tags: ["vegetarian", "vegan", "lactose-free"] },
  { name: "Mutabal 100g", kcal: 150, protein: 4, carbs: 10, fats: 10, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Kofta plate", kcal: 780, protein: 48, carbs: 55, fats: 42, tags: ["non-vegetarian"] },
  { name: "Shish tawook plate", kcal: 680, protein: 55, carbs: 55, fats: 24, tags: ["non-vegetarian"] },
  { name: "Grilled chicken breast 200g", kcal: 330, protein: 62, carbs: 0, fats: 8, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Grilled chicken with rice", kcal: 620, protein: 55, carbs: 65, fats: 14, tags: ["non-vegetarian", "lactose-free"] },
  { name: "Tuna sandwich", kcal: 460, protein: 32, carbs: 42, fats: 18, tags: ["non-vegetarian"] },
  { name: "Turkey breast 100g", kcal: 135, protein: 30, carbs: 0, fats: 1, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Cottage cheese 100g", kcal: 98, protein: 11, carbs: 3, fats: 4, tags: ["vegetarian", "gluten-free"] },
  { name: "Paneer 100g", kcal: 265, protein: 18, carbs: 4, fats: 20, tags: ["vegetarian", "gluten-free"] },
  { name: "Tofu 100g", kcal: 76, protein: 8, carbs: 2, fats: 5, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Edamame 100g", kcal: 122, protein: 11, carbs: 10, fats: 5, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Peanut butter 1 tbsp", kcal: 95, protein: 4, carbs: 3, fats: 8, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Almonds 30g", kcal: 174, protein: 6, carbs: 6, fats: 15, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Cashews 30g", kcal: 165, protein: 5, carbs: 9, fats: 13, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Apple 1 medium", kcal: 95, protein: 0, carbs: 25, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Orange 1 medium", kcal: 62, protein: 1, carbs: 15, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Mango 1 cup", kcal: 100, protein: 1, carbs: 25, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Mixed berries 1 cup", kcal: 85, protein: 1, carbs: 21, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Milk full fat 250ml", kcal: 150, protein: 8, carbs: 12, fats: 8, tags: ["vegetarian", "gluten-free"] },
  { name: "Low fat milk 250ml", kcal: 105, protein: 8, carbs: 12, fats: 3, tags: ["vegetarian", "gluten-free"] },
  { name: "Laban 250ml", kcal: 110, protein: 8, carbs: 12, fats: 3, tags: ["vegetarian", "gluten-free"] },
  { name: "Cappuccino", kcal: 120, protein: 6, carbs: 12, fats: 5, tags: ["vegetarian", "gluten-free"] },
  { name: "Americano", kcal: 5, protein: 0, carbs: 0, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Protein bar", kcal: 220, protein: 20, carbs: 22, fats: 7, tags: ["vegetarian"] },
  // ---- expanded database: proteins ----
  { name: "Chicken thigh cooked 100g", kcal: 209, protein: 26, carbs: 0, fats: 11, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Turkey mince cooked 100g", kcal: 176, protein: 27, carbs: 0, fats: 7, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Beef sirloin steak 100g", kcal: 206, protein: 29, carbs: 0, fats: 9, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Beef mince 5% fat 100g", kcal: 137, protein: 22, carbs: 0, fats: 5, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Lamb leg roasted 100g", kcal: 258, protein: 26, carbs: 0, fats: 17, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Pork chop cooked 100g", kcal: 231, protein: 27, carbs: 0, fats: 13, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Tuna canned in water 100g", kcal: 116, protein: 26, carbs: 0, fats: 1, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Tilapia cooked 100g", kcal: 128, protein: 26, carbs: 0, fats: 3, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Cod cooked 100g", kcal: 105, protein: 23, carbs: 0, fats: 1, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Shrimp cooked 100g", kcal: 99, protein: 24, carbs: 0, fats: 0, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Sardines canned 100g", kcal: 208, protein: 25, carbs: 0, fats: 11, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Duck breast cooked 100g", kcal: 201, protein: 24, carbs: 0, fats: 11, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Chickpeas cooked 100g", kcal: 164, protein: 9, carbs: 27, fats: 3, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Black beans cooked 100g", kcal: 132, protein: 9, carbs: 24, fats: 1, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Kidney beans cooked 100g", kcal: 127, protein: 9, carbs: 23, fats: 1, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Casein protein 1 scoop", kcal: 120, protein: 24, carbs: 4, fats: 1, tags: ["vegetarian", "gluten-free"] },
  { name: "Vegan protein powder 1 scoop", kcal: 110, protein: 21, carbs: 4, fats: 2, tags: ["vegetarian", "vegan", "gluten-free"] },
  // ---- carbs / grains ----
  { name: "Basmati rice cooked 100g", kcal: 121, protein: 3, carbs: 25, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Whole wheat pasta cooked 100g", kcal: 124, protein: 5, carbs: 25, fats: 1, tags: ["vegetarian", "vegan", "lactose-free"] },
  { name: "White pasta cooked 100g", kcal: 131, protein: 5, carbs: 25, fats: 1, tags: ["vegetarian", "vegan", "lactose-free"] },
  { name: "Couscous cooked 100g", kcal: 112, protein: 4, carbs: 23, fats: 0, tags: ["vegetarian", "vegan", "lactose-free"] },
  { name: "White bread 1 slice", kcal: 80, protein: 3, carbs: 15, fats: 1, tags: ["vegetarian", "vegan", "lactose-free"] },
  { name: "Whole wheat bread 1 slice", kcal: 82, protein: 4, carbs: 14, fats: 1, tags: ["vegetarian", "vegan", "lactose-free"] },
  { name: "Rice cakes 2 pieces", kcal: 70, protein: 1, carbs: 15, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Granola 50g", kcal: 220, protein: 5, carbs: 32, fats: 8, tags: ["vegetarian"] },
  { name: "Muesli 50g", kcal: 180, protein: 5, carbs: 33, fats: 3, tags: ["vegetarian", "vegan"] },
  { name: "Corn flakes 40g", kcal: 150, protein: 3, carbs: 34, fats: 0, tags: ["vegetarian", "vegan", "lactose-free"] },
  { name: "Sweet corn 100g", kcal: 96, protein: 3, carbs: 21, fats: 1, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Popcorn plain 30g", kcal: 110, protein: 3, carbs: 22, fats: 1, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  // ---- fats ----
  { name: "Olive oil 1 tbsp", kcal: 119, protein: 0, carbs: 0, fats: 14, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Coconut oil 1 tbsp", kcal: 117, protein: 0, carbs: 0, fats: 14, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Butter 1 tbsp", kcal: 102, protein: 0, carbs: 0, fats: 12, tags: ["vegetarian", "gluten-free"] },
  { name: "Walnuts 30g", kcal: 196, protein: 5, carbs: 4, fats: 20, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Chia seeds 1 tbsp", kcal: 60, protein: 2, carbs: 5, fats: 4, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Flax seeds 1 tbsp", kcal: 55, protein: 2, carbs: 3, fats: 4, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Mixed nuts 30g", kcal: 175, protein: 6, carbs: 6, fats: 15, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  // ---- vegetables ----
  { name: "Spinach cooked 100g", kcal: 23, protein: 3, carbs: 4, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Cauliflower 100g", kcal: 25, protein: 2, carbs: 5, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Carrots 100g", kcal: 41, protein: 1, carbs: 10, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Cucumber 100g", kcal: 15, protein: 1, carbs: 4, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Tomato 1 medium", kcal: 22, protein: 1, carbs: 5, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Bell pepper 100g", kcal: 31, protein: 1, carbs: 6, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Mushroom 100g", kcal: 22, protein: 3, carbs: 3, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Green beans 100g", kcal: 31, protein: 2, carbs: 7, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Zucchini 100g", kcal: 17, protein: 1, carbs: 3, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Mixed salad greens 100g", kcal: 15, protein: 1, carbs: 3, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  // ---- fruits ----
  { name: "Grapes 1 cup", kcal: 104, protein: 1, carbs: 27, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Pineapple 1 cup", kcal: 82, protein: 1, carbs: 22, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Watermelon 1 cup", kcal: 46, protein: 1, carbs: 12, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Strawberries 1 cup", kcal: 49, protein: 1, carbs: 12, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Kiwi 1 medium", kcal: 42, protein: 1, carbs: 10, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Pear 1 medium", kcal: 101, protein: 1, carbs: 27, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Papaya 1 cup", kcal: 62, protein: 1, carbs: 16, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Raisins 30g", kcal: 90, protein: 1, carbs: 24, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  // ---- dairy ----
  { name: "Cheddar cheese 30g", kcal: 120, protein: 7, carbs: 0, fats: 10, tags: ["vegetarian", "gluten-free"] },
  { name: "Mozzarella cheese 30g", kcal: 85, protein: 6, carbs: 1, fats: 6, tags: ["vegetarian", "gluten-free"] },
  { name: "Feta cheese 30g", kcal: 75, protein: 4, carbs: 1, fats: 6, tags: ["vegetarian", "gluten-free"] },
  { name: "Halloumi 30g", kcal: 100, protein: 7, carbs: 1, fats: 8, tags: ["vegetarian", "gluten-free"] },
  { name: "Labneh 100g", kcal: 130, protein: 6, carbs: 5, fats: 10, tags: ["vegetarian", "gluten-free"] },
  { name: "Cream cheese 30g", kcal: 100, protein: 2, carbs: 1, fats: 10, tags: ["vegetarian", "gluten-free"] },
  { name: "Skyr 170g", kcal: 105, protein: 18, carbs: 7, fats: 0, tags: ["vegetarian", "gluten-free"] },
  { name: "Honey 1 tbsp", kcal: 64, protein: 0, carbs: 17, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  // ---- breakfast ----
  { name: "Pancakes 2 pieces", kcal: 350, protein: 8, carbs: 55, fats: 10, tags: ["vegetarian"] },
  { name: "Waffles 2 pieces", kcal: 400, protein: 8, carbs: 60, fats: 14, tags: ["vegetarian"] },
  { name: "French toast 2 slices", kcal: 350, protein: 12, carbs: 40, fats: 15, tags: ["vegetarian"] },
  { name: "Bacon 3 strips", kcal: 130, protein: 9, carbs: 0, fats: 10, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Breakfast sausage 2 links", kcal: 170, protein: 9, carbs: 2, fats: 14, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Scrambled eggs 2 with butter", kcal: 220, protein: 14, carbs: 2, fats: 17, tags: ["vegetarian", "gluten-free", "lactose-free"] },
  { name: "Shakshuka 1 bowl", kcal: 320, protein: 16, carbs: 18, fats: 20, tags: ["vegetarian", "gluten-free", "lactose-free"] },
  { name: "Manakish egg 1 piece", kcal: 380, protein: 14, carbs: 42, fats: 18, tags: ["vegetarian"] },
  // ---- fast food / international ----
  { name: "Chicken nuggets 6 pieces", kcal: 280, protein: 15, carbs: 18, fats: 17, tags: ["non-vegetarian"] },
  { name: "Onion rings 6 pieces", kcal: 250, protein: 3, carbs: 30, fats: 13, tags: ["vegetarian"] },
  { name: "Fried chicken 1 piece", kcal: 320, protein: 22, carbs: 12, fats: 20, tags: ["non-vegetarian"] },
  { name: "Sushi salmon roll 8 pieces", kcal: 300, protein: 12, carbs: 45, fats: 8, tags: ["non-vegetarian", "lactose-free"] },
  { name: "California roll 8 pieces", kcal: 280, protein: 8, carbs: 42, fats: 9, tags: ["non-vegetarian", "lactose-free"] },
  { name: "Chicken ramen 1 bowl", kcal: 550, protein: 28, carbs: 65, fats: 18, tags: ["non-vegetarian", "lactose-free"] },
  { name: "Pho beef 1 bowl", kcal: 450, protein: 28, carbs: 55, fats: 12, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Chicken burrito 1 piece", kcal: 650, protein: 35, carbs: 75, fats: 22, tags: ["non-vegetarian"] },
  { name: "Beef taco 1 piece", kcal: 210, protein: 12, carbs: 18, fats: 10, tags: ["non-vegetarian", "lactose-free"] },
  { name: "Lasagna 1 slice", kcal: 480, protein: 26, carbs: 38, fats: 25, tags: ["non-vegetarian"] },
  { name: "Risotto mushroom 1 plate", kcal: 420, protein: 10, carbs: 65, fats: 12, tags: ["vegetarian", "gluten-free"] },
  { name: "Margherita pizza slice", kcal: 250, protein: 10, carbs: 32, fats: 9, tags: ["vegetarian"] },
  { name: "Pepperoni pizza slice", kcal: 300, protein: 13, carbs: 32, fats: 14, tags: ["non-vegetarian"] },
  { name: "Baklava 1 piece", kcal: 220, protein: 3, carbs: 25, fats: 13, tags: ["vegetarian"] },
  { name: "Kunafa 1 slice", kcal: 350, protein: 6, carbs: 42, fats: 18, tags: ["vegetarian"] },
  // ---- drinks / extras ----
  { name: "Orange juice 250ml", kcal: 110, protein: 2, carbs: 26, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Cola 330ml can", kcal: 140, protein: 0, carbs: 39, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Beer 330ml", kcal: 150, protein: 1, carbs: 13, fats: 0, tags: ["vegetarian", "vegan", "gluten-free"] },
  { name: "Red wine 150ml", kcal: 125, protein: 0, carbs: 4, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Dark chocolate 30g", kcal: 170, protein: 2, carbs: 13, fats: 12, tags: ["vegetarian", "gluten-free"] },
  { name: "Milk chocolate 30g", kcal: 160, protein: 2, carbs: 17, fats: 9, tags: ["vegetarian", "gluten-free"] },
  { name: "Ice cream 1 scoop", kcal: 145, protein: 2, carbs: 17, fats: 8, tags: ["vegetarian", "gluten-free"] },
  { name: "Latte 250ml", kcal: 150, protein: 8, carbs: 12, fats: 8, tags: ["vegetarian", "gluten-free"] },
  { name: "Energy drink 250ml", kcal: 110, protein: 0, carbs: 28, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Protein pancakes 2 pieces", kcal: 300, protein: 28, carbs: 30, fats: 8, tags: ["vegetarian"] },
  { name: "Rice pudding 1 bowl", kcal: 280, protein: 6, carbs: 45, fats: 8, tags: ["vegetarian", "gluten-free"] },
];
const SMART_FOOD_ALIAS = {
  chicken: "Chicken breast 100g",
  "chicken breast": "Chicken breast 100g",
  "grilled chicken": "Grilled chicken breast 200g",
  fish: "Grilled fish 200g",
  salmon: "Salmon 100g",
  egg: "Whole egg 1 piece",
  eggs: "Boiled eggs 3 pieces",
  "egg white": "Egg white 1 piece",
  rice: "Cooked rice 100g",
  "white rice": "White rice 1 cup",
  "brown rice": "Brown rice 1 cup",
  potato: "Potato 100g",
  "sweet potato": "Sweet potato 200g",
  chapati: "Chapati 1 medium",
  roti: "Roti 1 piece",
  naan: "Naan 1 piece",
  paratha: "Paratha 1 piece",
  oats: "Oats 50g",
  banana: "Banana 1 medium",
  whey: "Whey protein 1 scoop",
  protein: "Whey protein 1 scoop",
  yogurt: "Greek yogurt 170g",
  biryani: "Chicken biryani 1 plate",
  shawarma: "Chicken shawarma wrap",
  mandi: "Chicken mandi 1 plate",
  dal: "Dal 1 bowl",
  lentils: "Lentils cooked 100g",
  beans: "Rajma 1 bowl",
  paneer: "Paneer 100g",
  beef: "Ground beef 100g",
  avocado: "Avocado 100g",
  broccoli: "Broccoli 100g",
  pasta: "Pasta arrabbiata 1 plate",
  burger: "Beef burger",
  fries: "French fries medium",
  dosa: "Plain dosa 1 piece",
  idli: "Idli 2 pieces",
  samosa: "Samosa 1 piece",
  hummus: "Hummus 100g",
  falafel: "Falafel 4 pieces",
  dates: "Dates 3 pieces",
};
function cleanFoodText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+.,/\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function foodTokens(value = "") {
  return cleanFoodText(value).split(/\s+/).filter((x) => x.length > 1 && !["with", "and", "plus", "the", "one", "cup", "plate", "bowl", "piece", "pieces", "small", "medium", "large"].includes(x));
}
function bestFoodMatch(part = "") {
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
function amountMultiplier(part = "", matchedName = "") {
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
function estimateSmartFood(text = "") {
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
const DEFAULT_TIME_SLOTS = ["5:30 AM", "6:00 AM", "6:30 AM", "7:00 AM", "7:30 AM", "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM", "9:30 PM", "10:00 PM"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const RPE_OPTIONS = ["", "7", "7.5", "8", "8.5", "9", "9.5", "10"];
const PHOTO_TYPES = ["Front", "Side", "Back", "Before", "After", "Progress", "Other"];
const WATER_LITERS = ["", "1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5", "5.5", "6"];
const SLEEP_HOURS = ["", "4", "4.5", "5", "5.5", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10"];
const MEASUREMENT_FIELDS = [
  ["bloodPressure", "Blood Pressure"],
  ["bmi", "BMI"],
  ["chest", "Chest"],
  ["leftArm", "Left Arm"],
  ["rightArm", "Right Arm"],
  ["waist", "Waist"],
  ["sternum", "Sternum"],
  ["stomach", "Stomach"],
  ["hip", "Hip"],
  ["waistHipRatio", "Waist To Hip Ratio"],
  ["push", "Push Strength"],
  ["pull", "Pull Strength"],
  ["leg", "Leg Strength"],
  ["core", "Core Strength"],
  ["cardio", "Cardio Fitness"],
];
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
function stripPhotosForCache(clients) {
  return (clients || []).map((c) => (c.transformPhotos?.length ? { ...c, transformPhotos: [] } : c));
}
function saveForgeCache(userId, snapshot) {
  if (!userId) return;
  const lightweight = {
    ...snapshot,
    clients: stripPhotosForCache(snapshot.clients),
    clientPortal: snapshot.clientPortal?.transformPhotos?.length ? { ...snapshot.clientPortal, transformPhotos: [] } : snapshot.clientPortal,
  };
  writeJson(cacheKey(userId), { ...lightweight, savedAt: new Date().toISOString() });
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
      if (item.type === "clients_update") {
        const { error } = await supabase.from("clients").update(item.patch).eq("id", item.clientId);
        if (error) throw error;
      }
    } catch (e) {
      remaining.push(item);
    }
  }
  writeJson(FORGE_SYNC_QUEUE_KEY, remaining);
}
async function updateClientRow(clientId, patch) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    enqueueSync({ type: "clients_update", clientId, patch });
    return { queued: true };
  }
  try {
    const { error } = await supabase.from("clients").update(patch).eq("id", clientId);
    if (error) throw error;
    await flushSyncQueue();
    return { queued: false };
  } catch (error) {
    enqueueSync({ type: "clients_update", clientId, patch });
    return { queued: true, error };
  }
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
function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function isoDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}
function weekKey(date) {
  return isoDate(startOfWeek(date));
}
function weekRangeLabel(start) {
  const a = new Date(start);
  const b = addDays(a, 6);
  return `${a.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${b.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}
function weekDays(start) {
  return DAYS.map((name, i) => {
    const date = addDays(start, i);
    return { name, date: isoDate(date), label: `${name} ${date.getDate()}` };
  });
}
// ================= PROGRAM SYSTEM (V2 — fresh design) =================
// Model: Program { weeks: [{ workouts: [{ blocks: [{ exercises: [{ sets: [] }] }] }] }] }
// Logs are separate from the program so editing a program never touches history.

function newSet() { return { id: uid(), targetReps: "", targetLoad: "", targetRpe: "" }; }
function newExercise(name = "") {
  return { id: uid(), name, loadType: "kg", tempo: "", rest: "", note: "", videoUrl: "", sets: [newSet(), newSet(), newSet()] };
}
function newBlock(type = "straight") { return { id: uid(), type, rounds: type === "circuit" ? 3 : 1, exercises: [] }; }
function newWorkout(name = "Workout") { return { id: uid(), name, note: "", blocks: [] }; }
function newProgWeek(n = 1) { return { id: uid(), weekNum: n, label: "", focus: "", targetRpe: "", workouts: [] }; }
function newProgram(name = "New Program", goal = "General Fitness", weeksCount = 4) {
  return { version: 2, id: uid(), name, goal, startDate: new Date().toISOString().slice(0, 10), weeks: Array.from({ length: weeksCount }, (_, i) => newProgWeek(i + 1)) };
}
function cloneWithNewIds(node) {
  if (Array.isArray(node)) return node.map(cloneWithNewIds);
  if (node && typeof node === "object") {
    const out = {};
    for (const k of Object.keys(node)) out[k] = cloneWithNewIds(node[k]);
    if (out.id) out.id = uid();
    return out;
  }
  return node;
}
function fmtLoad(load, loadType = "kg") {
  if (loadType === "BW") return load ? `BW +${load}kg` : "BW";
  if (!load) return "";
  if (loadType === "%1RM") return `${load}%`;
  if (loadType === "RPE") return `@${load}`;
  return `${load}kg`;
}
function fmtSetTarget(set = {}, ex = {}) {
  const timed = isTimedExercise(ex.name);
  const parts = [];
  if (set.targetReps) parts.push(timed ? set.targetReps : `${set.targetReps} reps`);
  const load = fmtLoad(set.targetLoad, ex.loadType);
  if (load) parts.push(load);
  if (set.targetRpe) parts.push(`RPE ${set.targetRpe}`);
  return parts.join(" · ");
}
function fmtExerciseSummary(ex = {}) {
  const sets = ex.sets || [];
  const reps = [...new Set(sets.map((s) => s.targetReps || "?"))];
  const setsReps = reps.length === 1 ? `${sets.length} x ${reps[0]}` : sets.map((s) => s.targetReps || "?").join("/");
  const parts = [setsReps];
  const loads = [...new Set(sets.map((s) => fmtLoad(s.targetLoad, ex.loadType)).filter(Boolean))];
  if (loads.length === 1) parts.push(loads[0]);
  if (ex.tempo) parts.push(`Tempo ${ex.tempo}`);
  if (ex.rest) parts.push(`Rest ${ex.rest}`);
  return parts.join(" · ");
}
function blockTitle(block, index) {
  const letter = String.fromCharCode(65 + index);
  if (block.type === "superset") return `${letter} · Superset`;
  if (block.type === "circuit") return `${letter} · Circuit x${block.rounds || 3}`;
  return `${letter} · Straight sets`;
}
function exerciseTag(block, blockIndex, exIndex) {
  const letter = String.fromCharCode(65 + blockIndex);
  if (block.type === "straight" && block.exercises.length === 1) return letter;
  return `${letter}${exIndex + 1}`;
}
function parseSeconds(text = "") {
  const t = String(text).toLowerCase().trim();
  if (!t) return 0;
  const min = t.match(/(\d+(?:\.\d+)?)\s*m/);
  const sec = t.match(/(\d+(?:\.\d+)?)\s*s/);
  if (min || sec) return Math.round((min ? parseFloat(min[1]) * 60 : 0) + (sec ? parseFloat(sec[1]) : 0));
  const n = parseFloat(t);
  return Number.isFinite(n) ? Math.round(n) : 0;
}
function fmtClock(totalSec = 0) {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function getVideoThumb(url = "") {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{6,})/);
  if (yt) return { thumb: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`, watchUrl: `https://www.youtube.com/watch?v=${yt[1]}` };
  return null;
}
function emptyTrainingLogs() { return { version: 2, sessions: [] }; }
function startSession(program, week, workout) {
  return {
    id: uid(), programId: program.id, programName: program.name, weekId: week.id, weekNum: week.weekNum,
    workoutId: workout.id, workoutName: workout.name, date: new Date().toISOString().slice(0, 10),
    startedAt: new Date().toISOString(), completedAt: null, status: "in_progress",
    entries: (workout.blocks || []).flatMap((block, bi) => (block.exercises || []).map((ex, ei) => ({
      id: uid(), exerciseId: ex.id, blockId: block.id, tag: exerciseTag(block, bi, ei), name: ex.name, substitutedName: "",
      sets: (ex.sets || []).map((s) => ({ setId: s.id, reps: "", load: "", duration: "", rpe: "", done: false })),
    }))),
    metrics: { kcal: "", maxHR: "", avgHR: "" }, notes: "", sessionRpe: "",
  };
}
function sessionForWorkout(logs, weekId, workoutId) {
  const sessions = logs?.sessions || [];
  const inProgress = sessions.find((s) => s.weekId === weekId && s.workoutId === workoutId && s.status === "in_progress");
  if (inProgress) return inProgress;
  const completed = sessions.filter((s) => s.weekId === weekId && s.workoutId === workoutId && s.status === "completed");
  return completed.length ? completed[completed.length - 1] : null;
}
function upsertSessionInLogs(logs, session) {
  const base = logs && Array.isArray(logs.sessions) ? logs : emptyTrainingLogs();
  const idx = base.sessions.findIndex((s) => s.id === session.id);
  const sessions = idx >= 0 ? base.sessions.map((s, i) => (i === idx ? session : s)) : [...base.sessions, session];
  return { ...base, sessions };
}
function setScoreV2(set, timed) {
  if (timed) return parseSeconds(set.duration || set.reps || "");
  const load = parseFloat(set.load) || 0;
  const reps = parseFloat(set.reps) || 0;
  if (!load && !reps) return 0;
  if (!load) return reps * 0.001;
  return load * (1 + reps / 30);
}
function fmtLoggedSet(set, timed) {
  if (timed) return set.duration || set.reps || "-";
  const load = set.load ? `${set.load}kg` : "";
  const reps = set.reps ? `${set.reps} reps` : "";
  return [load, reps].filter(Boolean).join(" x ") || "-";
}
function exerciseHistoryV2(logs, exerciseName) {
  const name = String(exerciseName || "").toLowerCase();
  const timed = isTimedExercise(exerciseName);
  const rows = [];
  for (const s of logs?.sessions || []) {
    if (s.status !== "completed" && s.status !== "in_progress") continue;
    for (const e of s.entries || []) {
      const effective = String(e.substitutedName || e.name || "").toLowerCase();
      if (effective !== name) continue;
      for (const set of e.sets || []) {
        const score = setScoreV2(set, timed);
        if (score > 0) rows.push({ score, set, date: s.date });
      }
    }
  }
  const best = rows.length ? rows.reduce((a, b) => (b.score > a.score ? b : a), rows[0]) : null;
  const recent = rows.length ? rows[rows.length - 1] : null;
  return {
    hasData: rows.length > 0,
    best: best ? `${fmtLoggedSet(best.set, timed)} · ${best.date || ""}` : "No PB yet",
    bestScore: best ? best.score : 0,
    recent: recent ? `${fmtLoggedSet(recent.set, timed)} · ${recent.date || ""}` : "No recent log",
  };
}
function sessionStatsV2(session) {
  let volume = 0, setsDone = 0, setsTotal = 0;
  for (const e of session?.entries || []) for (const s of e.sets || []) {
    setsTotal += 1;
    if (s.done || s.reps || s.load || s.duration) { setsDone += 1; volume += (parseFloat(s.load) || 0) * (parseFloat(s.reps) || 0); }
  }
  const dur = session?.startedAt && session?.completedAt ? Math.round((new Date(session.completedAt) - new Date(session.startedAt)) / 1000) : 0;
  return { volume: Math.round(volume), setsDone, setsTotal, durationSec: dur };
}
function detectSessionPBs(session, logsBefore) {
  const pbs = []; const seen = new Set();
  for (const e of session?.entries || []) {
    const name = e.substitutedName || e.name;
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const timed = isTimedExercise(name);
    const prior = exerciseHistoryV2(logsBefore, name).bestScore;
    let bestNow = 0, bestSet = null;
    for (const s of e.sets || []) { const sc = setScoreV2(s, timed); if (sc > bestNow) { bestNow = sc; bestSet = s; } }
    if (bestSet && bestNow > 0 && (bestNow > prior || prior === 0)) pbs.push({ name, detail: fmtLoggedSet(bestSet, timed) + (prior === 0 ? " (first log)" : "") });
  }
  return pbs;
}
// ---------------- Real PDF generation (pdf-lib) + download/share ----------------
const PDF_PAGE = { width: 595.28, height: 841.89, margin: 50 }; // A4, points
async function buildPdfDoc(title, subtitle, sections) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width, height, margin } = PDF_PAGE;
  const maxWidth = width - margin * 2;
  let page = pdfDoc.addPage([width, height]);
  let y = height - margin;

  function ensureSpace(needed) {
    if (y - needed < margin) { page = pdfDoc.addPage([width, height]); y = height - margin; }
  }
  function wrap(text, f, size) {
    const words = String(text ?? "").split(" ");
    const lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) > maxWidth && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }
  function drawText(text, { size = 10.5, bold = false, color = rgb(0.12, 0.12, 0.14), gap = 6, indent = 0 } = {}) {
    const f = bold ? boldFont : font;
    for (const l of wrap(text, f, size)) {
      ensureSpace(size + gap);
      page.drawText(l, { x: margin + indent, y, size, font: f, color });
      y -= size + gap;
    }
  }
  function rule() { ensureSpace(14); y -= 4; page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.75, color: rgb(0.82, 0.82, 0.85) }); y -= 12; }

  drawText(title, { size: 21, bold: true, gap: 4 });
  if (subtitle) drawText(subtitle, { size: 10.5, color: rgb(0.45, 0.45, 0.5), gap: 16 });
  rule();

  for (const sec of sections) {
    ensureSpace(28);
    drawText(sec.heading, { size: 13.5, bold: true, gap: 8, color: rgb(0.55, 0.43, 0.08) });
    for (const l of sec.lines || []) drawText(l.label ? `${l.label}: ${l.value ?? "-"}` : l, { size: 10, gap: 7, indent: 2 });
    for (const row of sec.table || []) {
      ensureSpace(13);
      const tagW = 26, nameW = 150;
      page.drawText(row[0] || "", { x: margin, y, size: 9.5, font: boldFont, color: rgb(0.55, 0.43, 0.08) });
      page.drawText(row[1] || "", { x: margin + tagW, y, size: 9.5, font: boldFont, color: rgb(0.12, 0.12, 0.14) });
      const rest = wrap(row.slice(2).filter(Boolean).join("  ·  "), font, 9);
      page.drawText(rest[0] || "", { x: margin + tagW + nameW, y, size: 9, font, color: rgb(0.35, 0.35, 0.4) });
      y -= 15;
    }
    y -= 12;
  }
  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: "application/pdf" });
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
async function sharePdfBlob(blob, filename, shareTitle) {
  try {
    const file = new File([blob], filename, { type: "application/pdf" });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: shareTitle });
      return "shared";
    }
  } catch (e) {
    if (e?.name === "AbortError") return "cancelled"; // user closed the share sheet - not an error
  }
  downloadBlob(blob, filename);
  return "downloaded";
}
function safeFilename(name) { return String(name || "file").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 60); }

async function downloadProgramPDF2(client, program) {
  if (!program) return;
  const sections = (program.weeks || []).map((w) => ({
    heading: `Week ${w.weekNum}${w.label ? ` \u2014 ${w.label}` : ""}${w.focus ? `  ·  ${w.focus}` : ""}${w.targetRpe ? `  ·  Target RPE ${w.targetRpe}` : ""}`,
    lines: (w.workouts || []).map((wo) => `${wo.name}`),
    table: (w.workouts || []).flatMap((wo) => (wo.blocks || []).flatMap((b, bi) => (b.exercises || []).map((ex, ei) => [exerciseTag(b, bi, ei), ex.name, fmtExerciseSummary(ex), ex.note || ""]))),
  }));
  const subtitle = `Client: ${client?.name || ""}  ·  Goal: ${program.goal || ""}  ·  ${program.weeks?.length || 0} weeks`;
  const blob = await buildPdfDoc(program.name, subtitle, sections);
  return { blob, filename: `${safeFilename(program.name)}.pdf` };
}
async function downloadTrialPDF(trial) {
  const sections = [
    { heading: "Contact", lines: [{ label: "Phone", value: trial.phone }, { label: "Email", value: trial.email }] },
    { heading: "Goals & History", lines: [{ label: "Goal", value: trial.goal }, { label: "Fitness history", value: trial.fitnessHistory }, { label: "Barriers", value: trial.barriers }] },
    { heading: "Health", lines: [{ label: "Injuries", value: trial.injuries }, { label: "Medical issues", value: trial.medicalIssues }] },
    { heading: "Lifestyle", lines: [{ label: "Nutrition", value: trial.nutrition }, { label: "Sleep", value: trial.sleep }, { label: "Daily activity (NEAT)", value: trial.neat }] },
    { heading: "Priorities", lines: [{ label: "Fat loss", value: trial.fatLossImportance }, { label: "Muscle gain", value: trial.muscleGainImportance }, { label: "Strength/endurance", value: trial.strengthEnduranceImportance }, { label: "Mobility/flexibility", value: trial.mobilityFlexibilityImportance }] },
    { heading: `Assessment${trial.assessmentDate ? ` \u2014 ${trial.assessmentDate}` : ""}`, lines: [{ label: "Cardiovascular", value: trial.cardiovascular }, { label: "Squat", value: trial.squat }, { label: "Push strength", value: trial.pushStrength }, { label: "Pull strength", value: trial.pullStrength }, { label: "Core strength", value: trial.coreStrength }, { label: "Flexibility", value: trial.flexibilityFitness }] },
  ];
  const subtitle = `Trial consultation${trial.savedAt ? `  ·  ${String(trial.savedAt).slice(0, 10)}` : ""}`;
  const blob = await buildPdfDoc(trial.name || "Trial", subtitle, sections);
  return { blob, filename: `${safeFilename(trial.name)}_trial.pdf` };
}

// ---------- Coach: Block editor ----------
function BlockEditor({ block, index, onChange, onDelete, onMoveUp, onMoveDown, isMobile }) {
  const [addSearch, setAddSearch] = useState("");
  const [openEx, setOpenEx] = useState(null);
  const exerciseLibrary = useExerciseLibrary();
  const suggestions = addSearch ? exerciseLibrary.filter((n) => n.toLowerCase().includes(addSearch.toLowerCase())).slice(0, 20) : [];
  function patch(p) { onChange({ ...block, ...p }); }
  function patchEx(ei, p) { patch({ exercises: block.exercises.map((e, i) => (i === ei ? { ...e, ...p } : e)) }); }
  function addExercise(name) { patch({ exercises: [...block.exercises, newExercise(name)] }); setAddSearch(""); }
  function deleteEx(ei) { patch({ exercises: block.exercises.filter((_, i) => i !== ei) }); }
  function moveEx(ei, dir) { const j = ei + dir; if (j < 0 || j >= block.exercises.length) return; const next = [...block.exercises]; [next[ei], next[j]] = [next[j], next[ei]]; patch({ exercises: next }); }
  function patchSet(ei, si, p) { patchEx(ei, { sets: block.exercises[ei].sets.map((s, i) => (i === si ? { ...s, ...p } : s)) }); }
  function addSet(ei) { const sets = block.exercises[ei].sets; const last = sets[sets.length - 1]; patchEx(ei, { sets: [...sets, { id: uid(), targetReps: last?.targetReps || "", targetLoad: last?.targetLoad || "", targetRpe: last?.targetRpe || "" }] }); }
  function removeSet(ei, si) { const sets = block.exercises[ei].sets; if (sets.length <= 1) return; patchEx(ei, { sets: sets.filter((_, i) => i !== si) }); }
  return (
    <div style={{ background: BRAND.card2, border: `1px solid ${block.type === "straight" ? BRAND.line : BRAND.gold + "77"}`, borderRadius: 16, padding: 12, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ color: BRAND.gold, fontWeight: 1000 }}>{blockTitle(block, index)}</div>
          <select value={block.type} onChange={(e) => patch({ type: e.target.value })} style={inputStyle({ padding: "6px 8px", width: "auto" })}>
            <option value="straight">Straight sets</option><option value="superset">Superset</option><option value="circuit">Circuit</option>
          </select>
          {block.type === "circuit" && <input value={block.rounds || ""} onChange={(e) => patch({ rounds: Number(e.target.value || 1) })} placeholder="Rounds" style={inputStyle({ width: 70 })} />}
        </div>
        <div style={{ display: "flex" }}>
          <button onClick={onMoveUp} style={{ background: "transparent", border: "none", color: BRAND.muted, fontWeight: 1000, cursor: "pointer", padding: "2px 5px" }}>▲</button>
          <button onClick={onMoveDown} style={{ background: "transparent", border: "none", color: BRAND.muted, fontWeight: 1000, cursor: "pointer", padding: "2px 5px" }}>▼</button>
          <button onClick={onDelete} style={{ background: "transparent", border: "none", color: BRAND.red, fontWeight: 1000, cursor: "pointer", padding: "2px 5px" }}>x</button>
        </div>
      </div>
      {block.exercises.map((ex, ei) => {
        const open = openEx === ei;
        return (
          <div key={ex.id} style={{ borderTop: `1px solid ${BRAND.line}`, marginTop: 10, paddingTop: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center" }}>
              <div style={{ background: BRAND.gold, color: "#000", borderRadius: 8, padding: "4px 8px", fontWeight: 1000, fontSize: 12 }}>{exerciseTag(block, index, ei)}</div>
              <input value={ex.name} onChange={(e) => patchEx(ei, { name: e.target.value })} style={inputStyle({ fontWeight: 800 })} />
              <div style={{ display: "flex" }}>
                <button onClick={() => moveEx(ei, -1)} style={{ background: "transparent", border: "none", color: BRAND.muted, fontWeight: 1000, cursor: "pointer", padding: "2px 5px" }}>▲</button>
                <button onClick={() => moveEx(ei, 1)} style={{ background: "transparent", border: "none", color: BRAND.muted, fontWeight: 1000, cursor: "pointer", padding: "2px 5px" }}>▼</button>
                <button onClick={() => setOpenEx(open ? null : ei)} style={{ background: "transparent", border: "none", color: BRAND.gold, fontWeight: 1000, cursor: "pointer", padding: "2px 5px" }}>{open ? "-" : "..."}</button>
                <button onClick={() => deleteEx(ei)} style={{ background: "transparent", border: "none", color: BRAND.red, fontWeight: 1000, cursor: "pointer", padding: "2px 5px" }}>x</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, minmax(90px, 160px))", gap: 8, marginTop: 8 }}>
              <label><div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 800, marginBottom: 3 }}>Load type</div><select value={ex.loadType || "kg"} onChange={(e) => patchEx(ei, { loadType: e.target.value })} style={inputStyle()}>{["kg", "%1RM", "RPE", "BW"].map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
              <label><div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 800, marginBottom: 3 }}>Tempo</div><input value={ex.tempo || ""} onChange={(e) => patchEx(ei, { tempo: e.target.value })} placeholder="3010" style={inputStyle()} /></label>
              <label><div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 800, marginBottom: 3 }}>Rest</div><input value={ex.rest || ""} onChange={(e) => patchEx(ei, { rest: e.target.value })} placeholder="90s" style={inputStyle()} /></label>
            </div>
            <div style={{ marginTop: 8 }}>
              {ex.sets.map((s, si) => (
                <div key={s.id} style={{ display: "grid", gridTemplateColumns: isMobile ? "34px 1fr 1fr 64px 26px" : "44px 1fr 1fr 90px 30px", gap: 8, marginBottom: 6, alignItems: "center" }}>
                  <div style={{ color: BRAND.muted, fontWeight: 900 }}>S{si + 1}</div>
                  <input value={s.targetReps || ""} onChange={(e) => patchSet(ei, si, { targetReps: e.target.value })} placeholder="Reps / time" style={inputStyle()} />
                  <input value={s.targetLoad || ""} onChange={(e) => patchSet(ei, si, { targetLoad: e.target.value })} placeholder={ex.loadType === "BW" ? "+kg" : ex.loadType || "kg"} style={inputStyle()} />
                  <input value={s.targetRpe || ""} onChange={(e) => patchSet(ei, si, { targetRpe: e.target.value })} placeholder="RPE" style={inputStyle()} />
                  <button onClick={() => removeSet(ei, si)} style={{ background: "transparent", border: "none", color: BRAND.red, fontWeight: 1000, cursor: "pointer" }}>x</button>
                </div>
              ))}
              <Button variant="dark" onClick={() => addSet(ei)} style={{ padding: "6px 12px", fontSize: 12 }}>+ Set</Button>
            </div>
            {open && <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginTop: 8 }}>
              <label><div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 800, marginBottom: 3 }}>Coach note (client sees this)</div><input value={ex.note || ""} onChange={(e) => patchEx(ei, { note: e.target.value })} placeholder="Cue, setup, intent..." style={inputStyle()} /></label>
              <label><div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 800, marginBottom: 3 }}>Video link</div><input value={ex.videoUrl || ""} onChange={(e) => patchEx(ei, { videoUrl: e.target.value })} placeholder="https://..." style={inputStyle()} /></label>
            </div>}
          </div>
        );
      })}
      <div style={{ marginTop: 10 }}>
        <input placeholder={block.exercises.length ? "Add exercise to this block..." : "Search first exercise..."} value={addSearch} onChange={(e) => setAddSearch(e.target.value)} style={inputStyle()} />
        {addSearch && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          {suggestions.map((n) => <button key={n} onClick={() => addExercise(n)} style={{ background: BRAND.panel, color: BRAND.text, border: `1px solid ${BRAND.line}`, borderRadius: 999, padding: "6px 10px", fontWeight: 800, cursor: "pointer" }}>+ {n}</button>)}
          <button onClick={() => addExercise(addSearch.trim())} style={{ background: BRAND.gold, color: "#000", border: "none", borderRadius: 999, padding: "6px 10px", fontWeight: 900, cursor: "pointer" }}>+ Custom: {addSearch.trim()}</button>
        </div>}
      </div>
    </div>
  );
}

// ---------- Coach: Program Builder ----------
function ProgramBuilder({ client, program, onClose, onSave }) {
  const isMobile = useIsMobile(520);
  const [p, setP] = useState(() => (program?.version === 2 ? JSON.parse(JSON.stringify(program)) : newProgram(`${client.name?.split(" ")[0] || "Client"}'s Program`, client.goal || "General Fitness", 4)));
  const [wk, setWk] = useState(0);
  const [wo, setWo] = useState(0);
  const week = p.weeks[Math.min(wk, p.weeks.length - 1)];
  const workout = week?.workouts[Math.min(wo, Math.max(0, (week?.workouts.length || 1) - 1))];
  const safeWk = p.weeks.indexOf(week);
  const safeWo = week ? week.workouts.indexOf(workout) : 0;
  function patchProgram(patch) { setP((prev) => ({ ...prev, ...patch })); }
  function patchWeek(patch) { setP((prev) => ({ ...prev, weeks: prev.weeks.map((w, i) => (i === safeWk ? { ...w, ...patch } : w)) })); }
  function patchWorkout(patch) { patchWeek({ workouts: week.workouts.map((w, i) => (i === safeWo ? { ...w, ...patch } : w)) }); }
  function addWeek() { setP((prev) => ({ ...prev, weeks: [...prev.weeks, newProgWeek(prev.weeks.length + 1)].map((w, i) => ({ ...w, weekNum: i + 1 })) })); setWk(p.weeks.length); }
  function duplicateWeek(i) { setP((prev) => { const copy = cloneWithNewIds(prev.weeks[i]); const weeks = [...prev.weeks.slice(0, i + 1), copy, ...prev.weeks.slice(i + 1)].map((w, j) => ({ ...w, weekNum: j + 1 })); return { ...prev, weeks }; }); }
  function deleteWeek(i) { setP((prev) => { const weeks = prev.weeks.filter((_, j) => j !== i).map((w, j) => ({ ...w, weekNum: j + 1 })); return { ...prev, weeks: weeks.length ? weeks : [newProgWeek(1)] }; }); setWk(0); setWo(0); }
  function copyWeekForward() { setP((prev) => ({ ...prev, weeks: prev.weeks.map((w, i) => (i > safeWk ? { ...cloneWithNewIds(prev.weeks[safeWk]), id: w.id, weekNum: w.weekNum, label: w.label, focus: w.focus, targetRpe: w.targetRpe } : w)) })); }
  function addWorkout() { patchWeek({ workouts: [...week.workouts, newWorkout(`Workout ${week.workouts.length + 1}`)] }); setWo(week.workouts.length); }
  function duplicateWorkout(i) { const copy = cloneWithNewIds(week.workouts[i]); copy.name = `${copy.name} (copy)`; patchWeek({ workouts: [...week.workouts.slice(0, i + 1), copy, ...week.workouts.slice(i + 1)] }); }
  function deleteWorkout(i) { patchWeek({ workouts: week.workouts.filter((_, j) => j !== i) }); setWo(0); }
  function copyWorkoutToAllWeeks() { const src = week.workouts[safeWo]; setP((prev) => ({ ...prev, weeks: prev.weeks.map((w, i) => (i === safeWk ? w : { ...w, workouts: [...w.workouts, cloneWithNewIds(src)] })) })); }
  function addBlock(type) { patchWorkout({ blocks: [...workout.blocks, newBlock(type)] }); }
  function patchBlock(bi, next) { patchWorkout({ blocks: workout.blocks.map((b, i) => (i === bi ? next : b)) }); }
  function deleteBlock(bi) { patchWorkout({ blocks: workout.blocks.filter((_, i) => i !== bi) }); }
  function moveBlock(bi, dir) { const j = bi + dir; if (j < 0 || j >= workout.blocks.length) return; const next = [...workout.blocks]; [next[bi], next[j]] = [next[j], next[bi]]; patchWorkout({ blocks: next }); }
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 1100, maxHeight: "94vh", overflow: "auto", padding: isMobile ? 12 : 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", marginBottom: 12 }}>
          <div><div style={{ fontSize: 24, fontWeight: 1000, color: BRAND.gold }}>Program Builder</div><div style={{ color: BRAND.muted }}>Weeks → Workouts → Blocks. Logs live separately, so edit freely.</div></div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 10 }}>
          <Field label="Program name (client sees this)" value={p.name} onChange={(v) => patchProgram({ name: v })} />
          <label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 }}>Goal</div><select value={p.goal} onChange={(e) => patchProgram({ goal: e.target.value })} style={inputStyle()}>{GOAL_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}</select></label>
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 12, paddingBottom: 4, alignItems: "center" }}>
          {p.weeks.map((w, i) => <Button key={w.id} variant={i === safeWk ? "gold" : "dark"} onClick={() => { setWk(i); setWo(0); }}>W{w.weekNum}{w.label ? ` · ${w.label}` : ""}</Button>)}
          <Button variant="ghost" onClick={addWeek}>+ Week</Button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <Button variant="dark" onClick={() => duplicateWeek(safeWk)} style={{ fontSize: 12 }}>Duplicate W{week.weekNum}</Button>
          <Button variant="dark" onClick={copyWeekForward} style={{ fontSize: 12 }}>Copy W{week.weekNum} to following weeks</Button>
          <Button variant="dark" onClick={() => deleteWeek(safeWk)} style={{ fontSize: 12, color: BRAND.red }}>Delete W{week.weekNum}</Button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 2fr 100px", gap: 8, marginTop: 10 }}>
          <Field label="Phase label" value={week.label} onChange={(v) => patchWeek({ label: v })} />
          <Field label="Week focus" value={week.focus} onChange={(v) => patchWeek({ focus: v })} />
          <Field label="Target RPE" value={week.targetRpe} onChange={(v) => patchWeek({ targetRpe: v })} />
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 12, paddingBottom: 4, alignItems: "center" }}>
          {week.workouts.map((w, i) => <Button key={w.id} variant={i === safeWo ? "gold" : "dark"} onClick={() => setWo(i)}>{w.name}</Button>)}
          <Button variant="ghost" onClick={addWorkout}>+ Workout</Button>
        </div>
        {workout ? <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <Button variant="dark" onClick={() => duplicateWorkout(safeWo)} style={{ fontSize: 12 }}>Duplicate</Button>
            <Button variant="dark" onClick={copyWorkoutToAllWeeks} style={{ fontSize: 12 }}>Copy to all other weeks</Button>
            <Button variant="dark" onClick={() => deleteWorkout(safeWo)} style={{ fontSize: 12, color: BRAND.red }}>Delete workout</Button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr", gap: 8, marginTop: 10 }}>
            <Field label="Workout name" value={workout.name} onChange={(v) => patchWorkout({ name: v })} />
            <Field label="Workout note (warm-up, intent...)" value={workout.note} onChange={(v) => patchWorkout({ note: v })} />
          </div>
          <div style={{ marginTop: 12 }}>
            {workout.blocks.map((b, bi) => <BlockEditor key={b.id} block={b} index={bi} isMobile={isMobile} onChange={(next) => patchBlock(bi, next)} onDelete={() => deleteBlock(bi)} onMoveUp={() => moveBlock(bi, -1)} onMoveDown={() => moveBlock(bi, 1)} />)}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="dark" onClick={() => addBlock("straight")}>+ Exercise</Button>
              <Button variant="dark" onClick={() => addBlock("superset")}>+ Superset</Button>
              <Button variant="dark" onClick={() => addBlock("circuit")}>+ Circuit</Button>
            </div>
          </div>
        </> : <Card style={{ background: BRAND.card2, marginTop: 12 }}><div style={{ color: BRAND.muted }}>No workouts in week {week.weekNum} yet. Add one above, or duplicate another week.</div></Card>}
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}><Button onClick={() => onSave(p)} style={{ flex: 1 }}>Save Program</Button><Button variant="ghost" onClick={onClose}>Cancel</Button></div>
      </Card>
    </div>
  );
}

// ---------- Client: Live Workout Session ----------
function WorkoutSession({ client, program, week, workout, session, logsBefore, onUpdate, onFinish, onExit }) {
  const isMobile = useIsMobile(520);
  const exerciseLibrary = useExerciseLibrary();
  const [subFor, setSubFor] = useState(null);
  const [subQuery, setSubQuery] = useState("");
  const [rest, setRest] = useState(null);
  const [finished, setFinished] = useState(() => (session.status === "completed" ? session : null));
  const [, forceTick] = useState(0);
  useEffect(() => { const t = setInterval(() => forceTick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  const exById = {};
  (workout?.blocks || []).forEach((b) => (b.exercises || []).forEach((ex) => { exById[ex.id] = { ex, block: b }; }));
  function patchEntry(entryId, patch) { onUpdate({ ...session, entries: session.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)) }); }
  function patchSet(entryId, si, patch) { onUpdate({ ...session, entries: session.entries.map((e) => (e.id === entryId ? { ...e, sets: e.sets.map((s, i) => (i === si ? { ...s, ...patch } : s)) } : e)) }); }
  function toggleDone(entry, si) {
    const meta = exById[entry.exerciseId];
    const target = meta?.ex.sets[si];
    const timed = isTimedExercise(entry.substitutedName || entry.name);
    const s = entry.sets[si];
    if (s.done) { patchSet(entry.id, si, { done: false }); setRest(null); return; }
    const patch = { done: true };
    if (timed) { if (!s.duration) patch.duration = target?.targetReps || ""; }
    else { if (!s.reps) patch.reps = target?.targetReps || ""; if (!s.load && (meta?.ex.loadType || "kg") === "kg") patch.load = target?.targetLoad || ""; }
    patchSet(entry.id, si, patch);
    const restSec = parseSeconds(meta?.ex.rest || "");
    if (restSec > 0) setRest({ until: Date.now() + restSec * 1000, total: restSec });
  }
  function finish() { const completed = { ...session, status: "completed", completedAt: new Date().toISOString() }; setFinished(completed); onUpdate(completed); }
  const elapsed = session.startedAt ? Math.round((Date.now() - new Date(session.startedAt)) / 1000) : 0;
  const stats = sessionStatsV2(session);
  const restLeft = rest ? Math.ceil((rest.until - Date.now()) / 1000) : 0;
  if (rest && restLeft <= 0) setTimeout(() => setRest(null), 0);
  if (finished) {
    const fStats = sessionStatsV2(finished);
    const pbs = detectSessionPBs(finished, logsBefore);
    return (
      <Card style={{ padding: isMobile ? 14 : 18 }}>
        <div style={{ textAlign: "center", marginBottom: 14 }}><div style={{ fontSize: 30, fontWeight: 1000, color: BRAND.gold }}>Session Complete</div><div style={{ color: BRAND.muted }}>{finished.workoutName} · Week {finished.weekNum}</div></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
          <div style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 12, textAlign: "center" }}><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800 }}>DURATION</div><div style={{ fontWeight: 1000, fontSize: 20 }}>{fStats.durationSec ? fmtClock(fStats.durationSec) : "-"}</div></div>
          <div style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 12, textAlign: "center" }}><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800 }}>VOLUME</div><div style={{ fontWeight: 1000, fontSize: 20 }}>{fStats.volume.toLocaleString()}kg</div></div>
          <div style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 12, textAlign: "center" }}><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800 }}>SETS</div><div style={{ fontWeight: 1000, fontSize: 20 }}>{fStats.setsDone}/{fStats.setsTotal}</div></div>
        </div>
        {pbs.length > 0 && <div style={{ background: `${BRAND.gold}18`, border: `1px solid ${BRAND.gold}`, borderRadius: 14, padding: 12, marginBottom: 14 }}><div style={{ color: BRAND.gold, fontWeight: 1000, marginBottom: 6 }}>Personal Bests</div>{pbs.map((pb) => <div key={pb.name} style={{ fontWeight: 800 }}>{pb.name}: <span style={{ color: BRAND.gold }}>{pb.detail}</span></div>)}</div>}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 10 }}>
          <Field label="Session RPE (1-10)" value={finished.sessionRpe} onChange={(v) => { const next = { ...finished, sessionRpe: v }; setFinished(next); onUpdate(next); }} />
          <Field label="Kcals" value={finished.metrics?.kcal || ""} onChange={(v) => { const next = { ...finished, metrics: { ...finished.metrics, kcal: v } }; setFinished(next); onUpdate(next); }} type="number" />
          <Field label="Max HR" value={finished.metrics?.maxHR || ""} onChange={(v) => { const next = { ...finished, metrics: { ...finished.metrics, maxHR: v } }; setFinished(next); onUpdate(next); }} type="number" />
          <Field label="Avg HR" value={finished.metrics?.avgHR || ""} onChange={(v) => { const next = { ...finished, metrics: { ...finished.metrics, avgHR: v } }; setFinished(next); onUpdate(next); }} type="number" />
        </div>
        <Field label="How did it feel?" value={finished.notes} onChange={(v) => { const next = { ...finished, notes: v }; setFinished(next); onUpdate(next); }} textarea />
        <Button onClick={() => onFinish(finished)} style={{ width: "100%", marginTop: 12 }}>Done</Button>
      </Card>
    );
  }
  return (
    <Card style={{ padding: isMobile ? 12 : 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <div><div style={{ fontSize: 22, fontWeight: 1000 }}>{workout?.name || session.workoutName}</div><div style={{ color: BRAND.muted, fontSize: 13 }}>Week {session.weekNum}{week?.label ? ` · ${week.label}` : ""}{week?.targetRpe ? ` · Target RPE ${week.targetRpe}` : ""}</div></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}><div style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 10, padding: "6px 12px", fontWeight: 1000, color: BRAND.gold }}>{session.startedAt ? fmtClock(elapsed) : ""}</div><Button variant="ghost" onClick={onExit}>Exit</Button></div>
      </div>
      <div style={{ color: BRAND.muted, fontSize: 12, marginBottom: 10 }}>{stats.setsDone}/{stats.setsTotal} sets · {stats.volume.toLocaleString()}kg volume</div>
      {workout?.note && <div style={{ background: BRAND.card2, border: `1px solid ${BRAND.gold}44`, borderRadius: 12, padding: 10, marginBottom: 10, fontSize: 13 }}><span style={{ color: BRAND.gold, fontWeight: 1000 }}>Coach: </span>{workout.note}</div>}
      {rest && restLeft > 0 && <div style={{ position: "sticky", top: 0, zIndex: 5, background: BRAND.gold, color: "#000", borderRadius: 14, padding: 12, marginBottom: 12, textAlign: "center" }}>
        <div style={{ fontWeight: 1000, fontSize: 22 }}>REST {fmtClock(restLeft)}</div>
        <div style={{ height: 6, background: "#00000033", borderRadius: 999, marginTop: 6 }}><div style={{ height: 6, width: `${Math.max(0, (restLeft / rest.total) * 100)}%`, background: "#000", borderRadius: 999 }} /></div>
        <button onClick={() => setRest(null)} style={{ marginTop: 6, background: "transparent", border: "none", fontWeight: 900, cursor: "pointer" }}>Skip</button>
      </div>}
      {(workout?.blocks || []).map((block, bi) => {
        const blockEntries = session.entries.filter((e) => e.blockId === block.id);
        if (!blockEntries.length) return null;
        return (
          <div key={block.id} style={{ border: `1px solid ${block.type === "straight" ? BRAND.line : BRAND.gold + "77"}`, borderRadius: 16, padding: 12, marginBottom: 12, background: BRAND.card2 }}>
            <div style={{ color: BRAND.gold, fontWeight: 1000, marginBottom: 4 }}>{blockTitle(block, bi)}</div>
            {block.type !== "straight" && <div style={{ color: BRAND.muted, fontSize: 12, marginBottom: 8 }}>{block.type === "circuit" ? `Rotate through ${blockEntries.map((e) => e.tag).join(" → ")} for ${block.rounds || 3} rounds.` : `Alternate ${blockEntries.map((e) => e.tag).join(" and ")} with minimal rest.`}</div>}
            {blockEntries.map((entry) => {
              const meta = exById[entry.exerciseId];
              const ex = meta?.ex || {};
              const effectiveName = entry.substitutedName || entry.name;
              const timed = isTimedExercise(effectiveName);
              const history = exerciseHistoryV2(logsBefore, effectiveName);
              const thumb = getVideoThumb(ex.videoUrl);
              const subbing = subFor === entry.id;
              const suggestions = subQuery ? exerciseLibrary.filter((n) => n.toLowerCase().includes(subQuery.toLowerCase())).slice(0, 10) : [];
              return (
                <div key={entry.id} style={{ borderTop: `1px solid ${BRAND.line}`, marginTop: 10, paddingTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div style={{ background: BRAND.gold, color: "#000", borderRadius: 8, padding: "4px 8px", fontWeight: 1000, fontSize: 12 }}>{entry.tag}</div>
                      <div><div style={{ color: client.color, fontWeight: 1000, fontSize: 17 }}>{effectiveName}</div>{entry.substitutedName && <div style={{ color: BRAND.muted, fontSize: 11 }}>Substituted for {entry.name}</div>}{(ex.tempo || ex.rest) && <div style={{ color: BRAND.muted, fontSize: 12 }}>{[ex.tempo && `Tempo ${ex.tempo}`, ex.rest && `Rest ${ex.rest}`].filter(Boolean).join(" · ")}</div>}</div>
                    </div>
                    <button onClick={() => { setSubFor(subbing ? null : entry.id); setSubQuery(""); }} style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 999, color: BRAND.muted, fontWeight: 900, cursor: "pointer", fontSize: 13, padding: "10px 14px", minHeight: 40 }}>{subbing ? "Cancel" : "Swap"}</button>
                  </div>
                  {ex.note && <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 4 }}>Coach: {ex.note}</div>}
                  {thumb && <a href={thumb.watchUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", position: "relative", marginTop: 8 }}><img src={thumb.thumb} alt="Exercise video" style={{ width: 160, height: 90, objectFit: "cover", borderRadius: 10, border: `1px solid ${BRAND.line}` }} /><div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}><div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center", color: "#fff", fontSize: 14 }}>▶</div></div></a>}
                  {history.hasData && <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 12, flexWrap: "wrap" }}><span><span style={{ color: BRAND.gold, fontWeight: 1000 }}>PB </span>{history.best}</span><span><span style={{ color: BRAND.gold, fontWeight: 1000 }}>Last </span>{history.recent}</span></div>}
                  {subbing && <div style={{ marginTop: 8 }}>
                    <input placeholder="Search a substitute..." value={subQuery} onChange={(e) => setSubQuery(e.target.value)} style={inputStyle()} />
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      {entry.substitutedName && <button onClick={() => { patchEntry(entry.id, { substitutedName: "" }); setSubFor(null); }} style={{ background: BRAND.panel, color: BRAND.text, border: `1px solid ${BRAND.line}`, borderRadius: 999, padding: "6px 10px", fontWeight: 800, cursor: "pointer" }}>Use original: {entry.name}</button>}
                      {suggestions.map((n) => <button key={n} onClick={() => { patchEntry(entry.id, { substitutedName: n }); setSubFor(null); }} style={{ background: BRAND.panel, color: BRAND.text, border: `1px solid ${BRAND.line}`, borderRadius: 999, padding: "6px 10px", fontWeight: 800, cursor: "pointer" }}>{n}</button>)}
                    </div>
                  </div>}
                  <div style={{ marginTop: 8 }}>
                    {entry.sets.map((s, si) => {
                      const target = ex.sets?.[si];
                      const targetText = target ? fmtSetTarget(target, ex) : "";
                      return (
                        <div key={si} style={{ display: "grid", gridTemplateColumns: isMobile ? "26px 1fr 1fr 54px 44px" : "40px 1fr 1fr 84px 48px", gap: 8, marginBottom: 6, alignItems: "center" }}>
                          <div style={{ color: BRAND.muted, fontWeight: 900 }}>S{si + 1}</div>
                          <div>{targetText && <div style={{ color: BRAND.muted, fontSize: 10, marginBottom: 2 }}>{targetText}</div>}<input placeholder={timed ? "load/assist" : "kg"} value={s.load || ""} onChange={(e) => patchSet(entry.id, si, { load: e.target.value })} style={inputStyle()} /></div>
                          <div style={{ alignSelf: "end" }}><input placeholder={timed ? "time e.g. 45s" : "reps"} value={timed ? (s.duration || "") : (s.reps || "")} onChange={(e) => patchSet(entry.id, si, timed ? { duration: e.target.value } : { reps: e.target.value })} style={inputStyle()} /></div>
                          <div style={{ alignSelf: "end" }}><input placeholder="RPE" value={s.rpe || ""} onChange={(e) => patchSet(entry.id, si, { rpe: e.target.value })} style={inputStyle()} /></div>
                          <button onClick={() => toggleDone(entry, si)} style={{ alignSelf: "end", height: 44, minWidth: 44, borderRadius: 10, border: `1px solid ${s.done ? BRAND.gold : BRAND.line}`, background: s.done ? BRAND.gold : BRAND.panel, color: s.done ? "#000" : BRAND.muted, fontWeight: 1000, fontSize: 16, cursor: "pointer" }}>&#10003;</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      <Button onClick={finish} style={{ width: "100%", marginTop: 4 }}>Finish Workout</Button>
    </Card>
  );
}

// ---------- Client: Training History ----------
function TrainingHistory({ client, logs }) {
  const [open, setOpen] = useState(null);
  const sessions = [...(logs?.sessions || [])].filter((s) => s.status === "completed").reverse();
  if (!sessions.length) return <Card><div style={{ color: BRAND.muted }}>No completed sessions yet. Finished workouts will appear here.</div></Card>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {sessions.map((s) => {
        const stats = sessionStatsV2(s);
        const expanded = open === s.id;
        return (
          <Card key={s.id} onClick={() => setOpen(expanded ? null : s.id)} style={{ cursor: "pointer", padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div><div style={{ fontWeight: 1000, color: client.color }}>{s.workoutName}</div><div style={{ color: BRAND.muted, fontSize: 12 }}>{s.date || "No date"} · Week {s.weekNum}</div></div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, color: BRAND.muted, fontWeight: 800 }}><span>{stats.setsDone} sets</span><span>{stats.volume.toLocaleString()}kg</span>{stats.durationSec > 0 && <span>{fmtClock(stats.durationSec)}</span>}{s.sessionRpe && <span>RPE {s.sessionRpe}</span>}</div>
            </div>
            {expanded && <div style={{ marginTop: 10, borderTop: `1px solid ${BRAND.line}`, paddingTop: 10 }}>
              {(s.entries || []).map((e) => {
                const loggedSets = (e.sets || []).filter((x) => x.done || x.reps || x.load || x.duration);
                if (!loggedSets.length) return null;
                return <div key={e.id} style={{ marginBottom: 8 }}><div style={{ fontWeight: 900 }}>{e.tag ? `${e.tag} · ` : ""}{e.substitutedName || e.name}</div><div style={{ color: BRAND.muted, fontSize: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>{loggedSets.map((x, i) => <span key={i}>{[x.load && `${x.load}kg`, x.reps && `x${x.reps}`, x.duration, x.rpe && `@${x.rpe}`].filter(Boolean).join(" ")}</span>)}</div></div>;
              })}
              {s.notes && <div style={{ fontSize: 13, marginTop: 4 }}><span style={{ color: BRAND.gold, fontWeight: 900 }}>Notes: </span>{s.notes}</div>}
            </div>}
          </Card>
        );
      })}
    </div>
  );
}

// ---------- ProgramTab: coach + client entry point ----------
function ProgramTab({ client, updateClient, isCoach }) {
  const isMobile = useIsMobile(520);
  const [program, setProgram] = useState(client.program?.version === 2 ? client.program : null);
  const [logs, setLogs] = useState(client.trainingLogs || emptyTrainingLogs());
  const [view, setView] = useState("overview");
  const [wk, setWk] = useState(0);
  const [builder, setBuilder] = useState(false);
  const [live, setLive] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  async function persist(nextProgram, nextLogs) {
    updateClient({ ...client, program: nextProgram, trainingLogs: nextLogs });
    let failed = null;
    if (nextProgram) { const r = await upsertSection(client.id, "program", nextProgram); if (r?.error) failed = r.error; }
    if (nextLogs) { const r = await upsertSection(client.id, "training_logs", nextLogs); if (r?.error) failed = r.error; }
    if (failed) alert(`Heads up: the server rejected this save (${failed.message || failed}). It's kept safely on this device and will keep retrying, but if you see this repeatedly, the database needs attention - don't clear your browser data in the meantime.`);
  }
  function saveProgram(p) { setProgram(p); persist(p, logs); setBuilder(false); }
  function saveLogs(l) { setLogs(l); persist(program, l); }
  function startOrContinue(week, workout) {
    const existing = sessionForWorkout(logs, week.id, workout.id);
    if (existing && existing.status === "in_progress") { setLive(existing); return; }
    const fresh = startSession(program, week, workout);
    setLive(fresh);
    saveLogs(upsertSessionInLogs(logs, fresh));
  }
  function updateLive(session) { setLive(session); saveLogs(upsertSessionInLogs(logs, session)); }
  const week = program?.weeks?.[Math.min(wk, (program?.weeks?.length || 1) - 1)];
  if (live && program) {
    const liveWeek = program.weeks.find((w) => w.id === live.weekId) || week;
    const liveWorkout = liveWeek?.workouts.find((w) => w.id === live.workoutId);
    const logsBefore = { ...logs, sessions: (logs?.sessions || []).filter((s) => s.id !== live.id) };
    return <WorkoutSession client={client} program={program} week={liveWeek} workout={liveWorkout} session={live} logsBefore={logsBefore} onUpdate={updateLive} onFinish={() => setLive(null)} onExit={() => setLive(null)} />;
  }
  return (
    <div style={{ display: "grid", gap: isMobile ? 10 : 14 }}>
      <Card style={{ padding: isMobile ? 12 : 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 10, alignItems: "center" }}>
          <div><div style={{ fontSize: 22, fontWeight: 1000 }}>{program?.name || "No program yet"}</div>{program && <div style={{ color: BRAND.muted, fontSize: 13 }}>{program.goal} · {program.weeks?.length || 0} weeks{program.startDate ? ` · started ${program.startDate}` : ""}</div>}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant={view === "overview" ? "gold" : "dark"} onClick={() => setView("overview")}>Program</Button>
            <Button variant={view === "history" ? "gold" : "dark"} onClick={() => setView("history")}>History</Button>
            {program && <Button variant="dark" disabled={pdfBusy} onClick={async () => { setPdfBusy(true); const { blob, filename } = await downloadProgramPDF2(client, program); downloadBlob(blob, filename); setPdfBusy(false); }}>{pdfBusy ? "..." : "Download PDF"}</Button>}
            {program && typeof navigator !== "undefined" && navigator.share && <Button variant="dark" disabled={pdfBusy} onClick={async () => { setPdfBusy(true); const { blob, filename } = await downloadProgramPDF2(client, program); await sharePdfBlob(blob, filename, program.name); setPdfBusy(false); }}>Share</Button>}
            {isCoach && <Button variant="dark" onClick={() => setBuilder(true)}>{program ? "Edit Program" : "Build Program"}</Button>}
          </div>
        </div>
      </Card>
      {view === "history" && <TrainingHistory client={client} logs={logs} />}
      {view === "overview" && !program && <Card><div style={{ color: BRAND.muted }}>{isCoach ? "No program assigned. Click Build Program to design one." : "Your coach hasn't assigned a program yet."}</div></Card>}
      {view === "overview" && program && <>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
          {program.weeks.map((w, i) => { const done = w.workouts.length > 0 && w.workouts.every((wo) => sessionForWorkout(logs, w.id, wo.id)?.status === "completed"); return <Button key={w.id} variant={i === wk ? "gold" : "dark"} onClick={() => setWk(i)}>W{w.weekNum}{done ? " ✓" : ""}</Button>; })}
        </div>
        {(week?.label || week?.focus || week?.targetRpe) && <Card style={{ background: BRAND.card2, padding: 12 }}><div style={{ color: BRAND.gold, fontWeight: 1000 }}>Week {week.weekNum}{week.label ? `: ${week.label}` : ""}</div>{(week.focus || week.targetRpe) && <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 4 }}>{[week.focus, week.targetRpe && `Target RPE ${week.targetRpe}`].filter(Boolean).join(" · ")}</div>}</Card>}
        {week?.workouts.map((wo) => {
          const session = sessionForWorkout(logs, week.id, wo.id);
          const status = session?.status === "completed" ? "completed" : session?.status === "in_progress" ? "in_progress" : "none";
          const exCount = wo.blocks.reduce((n, b) => n + b.exercises.length, 0);
          return (
            <Card key={wo.id} style={{ padding: 14, border: `1px solid ${status === "completed" ? BRAND.green + "88" : status === "in_progress" ? BRAND.gold : BRAND.line}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div><div style={{ fontWeight: 1000, fontSize: 17, color: client.color }}>{wo.name}</div><div style={{ color: BRAND.muted, fontSize: 12 }}>{exCount} exercises{status === "completed" ? ` · completed ${session.date || ""}` : status === "in_progress" ? " · in progress" : ""}</div></div>
                <Button variant={status === "completed" ? "dark" : "gold"} onClick={() => startOrContinue(week, wo)}>{status === "in_progress" ? "Continue" : status === "completed" ? "Log again" : "Start Workout"}</Button>
              </div>
              <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
                {wo.blocks.map((b, bi) => b.exercises.map((ex, ei) => <div key={ex.id} style={{ display: "flex", gap: 8, fontSize: 13, alignItems: "baseline" }}><span style={{ color: BRAND.gold, fontWeight: 1000, minWidth: 26 }}>{exerciseTag(b, bi, ei)}</span><span style={{ fontWeight: 800 }}>{ex.name}</span><span style={{ color: BRAND.muted }}>{fmtExerciseSummary(ex)}</span></div>))}
                {wo.blocks.length === 0 && <div style={{ color: BRAND.muted, fontSize: 13 }}>Empty workout</div>}
              </div>
            </Card>
          );
        })}
        {week && week.workouts.length === 0 && <Card><div style={{ color: BRAND.muted }}>No workouts in this week{isCoach ? " — add some in Edit Program." : "."}</div></Card>}
      </>}
      {builder && <ProgramBuilder client={client} program={program} onClose={() => setBuilder(false)} onSave={saveProgram} />}
    </div>
  );
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
function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
function ageFromBirthday(birthday) {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const t1 = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((t1 - t0) / (24 * 3600 * 1000));
}
function nextBirthdayDaysAway(birthday) {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (isNaN(b.getTime())) return null;
  const today = new Date();
  let next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
  if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) next.setFullYear(today.getFullYear() + 1);
  return Math.round((next - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / (24 * 3600 * 1000));
}
function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.round((Date.now() - d.getTime()) / (24 * 3600 * 1000));
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
function emptyProfile() {
  return {
    clientType: "1:1",
    paymentDueDate: "",
    paymentPaid: false,
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
    lifeContext: "",
    proudGoal: "",
    motivationStyle: "",
    celebrationStyle: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    notes: "",
    photo: "",
    measurements: {},
  };
}
function emptyNutrition() {
  return {
    targets: { calories: "", protein: "", carbs: "", fats: "", steps: 10000, water: 3, sleep: 7 },
    mealPlan: { Breakfast: "", Lunch: "", Dinner: "", Snacks: "" },
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
    age: ageFromBirthday(profile.birthday) ?? (row.age || ""),
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
    legacyCheckIns: sections.sessions?.checkIns || row.checkIns || [],
    sessions: sections.sessions?.sessions || row.sessions_conducted || 0,
    workoutLogs: sections.workoutLogs || [],
    trialData: sections.trial || null,
    clientType: profile.clientType || "1:1",
    paymentDueDate: profile.paymentDueDate || "",
    paymentPaid: !!profile.paymentPaid,
    checkIns: sections.checkins?.submissions || [],
    messages: sections.messages?.list || [],
    trainingLogs: sections.training_logs || null,
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
function Button({ children, onClick, variant = "gold", type = "button", disabled = false, style = {} }) {
  const bg = variant === "ghost" ? "transparent" : variant === "red" ? BRAND.red : variant === "dark" ? BRAND.card2 : BRAND.gold;
  const color = variant === "ghost" ? BRAND.text : variant === "red" ? "#fff" : variant === "dark" ? BRAND.text : "#000";
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={{ background: bg, color, border: variant === "ghost" ? `1px solid ${BRAND.line}` : "none", borderRadius: 999, padding: "10px 16px", fontWeight: 700, fontSize: 14, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, transition: "opacity .15s", ...style }}>
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
  return { width: "100%", minWidth: 0, boxSizing: "border-box", background: BRAND.card2, border: `1px solid ${BRAND.line}`, color: BRAND.text, borderRadius: 12, padding: "11px 12px", outline: "none", fontSize: 16, ...extra };
}
function Card({ children, style = {}, onClick }) {
  return <div onClick={onClick} style={{ width: "100%", minWidth: 0, boxSizing: "border-box", background: BRAND.card, border: `1px solid ${BRAND.line}`, borderRadius: 20, padding: 18, ...style }}>{children}</div>;
}
function AccountNotActiveScreen({ onBackToLogin }) {
  return (
    <div style={{ minHeight: "100vh", background: BRAND.bg, color: BRAND.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
        <div style={{ color: BRAND.gold, fontSize: 38, fontWeight: 900, letterSpacing: 1 }}>FORGE</div>
        <Card style={{ marginTop: 26, padding: 26 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: BRAND.card2, display: "grid", placeItems: "center", margin: "0 auto 18px" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={BRAND.dim} strokeWidth="2" /><path d="M4 21C4 16.5 7.5 14 12 14C16.5 14 20 16.5 20 21" stroke={BRAND.dim} strokeWidth="2" strokeLinecap="round" /><line x1="4" y1="4" x2="20" y2="20" stroke={BRAND.dim} strokeWidth="2" /></svg>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>This Account Is No Longer Active</div>
          <div style={{ color: BRAND.muted, fontSize: 13.5, fontWeight: 600, lineHeight: 1.5, marginBottom: 20 }}>We couldn't find an active client profile for this login. If you think this is a mistake, reach out to your coach directly.</div>
          <div style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: 12, marginBottom: 22 }}>
            <div style={{ color: BRAND.dim, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>Contact</div>
            <div style={{ color: BRAND.gold, fontSize: 14, fontWeight: 700, marginTop: 4 }}>Denis &middot; +971 567 088 638</div>
          </div>
          <Button onClick={onBackToLogin} style={{ width: "100%" }}>Back to Login</Button>
        </Card>
      </div>
    </div>
  );
}
function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  async function save() {
    if (password.length < 6) { setMsg("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setMsg("Passwords don't match."); return; }
    setSaving(true); setMsg("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setMsg(error.message); setSaving(false); return; }
    setMsg("Password updated. Redirecting to login...");
    setTimeout(() => { window.location.href = window.location.origin; }, 1500);
  }
  return (
    <div style={{ minHeight: "100vh", background: BRAND.bg, color: BRAND.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <Card style={{ width: "100%", maxWidth: 430, padding: 26 }}>
        <div style={{ color: BRAND.gold, fontSize: 30, fontWeight: 900, textAlign: "center" }}>FORGE</div>
        <div style={{ fontSize: 22, fontWeight: 900, marginTop: 12, textAlign: "center" }}>Set a New Password</div>
        <div style={{ color: BRAND.muted, marginTop: 6, marginBottom: 20, textAlign: "center" }}>Choose a new password for your account.</div>
        <Field label="New password" type="password" value={password} onChange={setPassword} placeholder="At least 6 characters" />
        <div style={{ height: 10 }} />
        <Field label="Confirm password" type="password" value={confirm} onChange={setConfirm} />
        {msg && <div style={{ color: msg.includes("updated") ? BRAND.green : BRAND.red, fontWeight: 800, marginTop: 10, fontSize: 13 }}>{msg}</div>}
        <Button disabled={saving} onClick={save} style={{ width: "100%", marginTop: 16 }}>{saving ? "Saving..." : "Update Password"}</Button>
      </Card>
    </div>
  );
}
function LoginScreen({ onReady }) {
  const isMobile = useIsMobile(520);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    const redirectTo = "https://forgeappbydenis.vercel.app/";
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setMsg(error ? error.message : "Password reset link sent to your email.");
    setLoading(false);
  }
  return (
    <div style={{ minHeight: "100vh", background: BRAND.bg, color: BRAND.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <Card style={{ width: "100%", maxWidth: 430, padding: 26 }}>
        <div style={{ fontSize: isMobile ? 30 : 42, fontWeight: 900, letterSpacing: 1 }}>FORGE</div>
        <div style={{ fontSize: 25, fontWeight: 900, marginTop: 10, textTransform: "uppercase" }}>Welcome back</div>
        <div style={{ color: BRAND.muted, marginBottom: 22 }}>Log in, or use an invite code your coach sent you.</div>
        <Field label="Email" value={email} onChange={setEmail} placeholder="you@email.com" />
        <div style={{ height: 10 }} />
        <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="Password" />
        {mode === "invite" && <><div style={{ height: 10 }} /><Field label="Invite Code" value={inviteCode} onChange={setInviteCode} placeholder="ABC123" /></>}
        {msg && <div style={{ marginTop: 12, color: msg.includes("sent") || msg.includes("created") || msg.includes("connected") ? BRAND.green : BRAND.red, fontSize: 13 }}>{msg}</div>}
        <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
          {mode === "login" && <Button disabled={loading} onClick={login}>Log in</Button>}
          {mode === "invite" && <Button disabled={loading} onClick={acceptInvite}>Accept invite</Button>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          <Button variant="ghost" onClick={() => setMode("login")} style={{ flex: 1 }}>Login</Button>
          <Button variant="ghost" onClick={() => setMode("invite")} style={{ flex: 1 }}>Have an invite code?</Button>
        </div>
        <button onClick={forgotPassword} style={{ marginTop: 14, background: "transparent", border: "none", color: BRAND.gold, cursor: "pointer", padding: 0 }}>Forgot password?</button>
      </Card>
    </div>
  );
}
function AddClientModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", weight: "", color: CLIENT_COLORS[0], profile: emptyProfile() });
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
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 8 }}>CLIENT TYPE</div>
          <div style={{ display: "flex", gap: 8 }}>{CLIENT_TYPES.map((t) => <button key={t} onClick={() => setProfile("clientType", t)} style={{ border: `1px solid ${form.profile.clientType === t ? BRAND.gold : BRAND.line}`, background: form.profile.clientType === t ? BRAND.gold : BRAND.card2, color: form.profile.clientType === t ? "#000" : BRAND.text, borderRadius: 999, padding: "8px 16px", fontWeight: 900, cursor: "pointer" }}>{t}</button>)}</div>
          <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 6 }}>{form.profile.clientType === "Online" ? "Online clients get Check-ins and Payments instead of Schedule and Packages." : "1:1 clients keep the in-person Schedule and Packages tabs."}</div>
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
          <Field label="Birthday (age is calculated from this)" value={form.profile.birthday} onChange={(v) => setProfile("birthday", v)} type="date" />
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
function computeNotifications(clients) {
  const items = [];
  clients.forEach((c) => {
    const unreadFromClient = (c.messages || []).filter((m) => m.from === "client" && !m.read).length;
    if (unreadFromClient > 0) items.push({ id: `msg_${c.id}`, type: "message", severity: 2, client: c, text: `${c.name} sent you ${unreadFromClient} message${unreadFromClient === 1 ? "" : "s"}` });

    const bday = nextBirthdayDaysAway(c.profile?.birthday);
    if (bday !== null && bday <= 7) items.push({ id: `bday_${c.id}`, type: "birthday", severity: 3, client: c, text: bday === 0 ? `${c.name}'s birthday is today!` : `${c.name}'s birthday is in ${bday} day${bday === 1 ? "" : "s"}` });

    if (c.paymentDueDate && !c.paymentPaid) {
      const d = daysUntil(c.paymentDueDate);
      if (d < 0) items.push({ id: `pay_over_${c.id}`, type: "payment", severity: 0, client: c, text: `${c.name}'s payment is overdue by ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"}` });
      else if (d <= 2) items.push({ id: `pay_2_${c.id}`, type: "payment", severity: 1, client: c, text: `${c.name}'s payment is due ${d === 0 ? "today" : `in ${d} day${d === 1 ? "" : "s"}`}` });
      else if (d <= 5) items.push({ id: `pay_5_${c.id}`, type: "payment", severity: 2, client: c, text: `${c.name}'s payment is due in ${d} days` });
    }

    const lastFoodDate = (c.nutrition?.logs || []).map((l) => l.date).sort().pop();
    const daysSinceFood = lastFoodDate ? daysSince(lastFoodDate) : (c.joinDate ? daysSince(c.joinDate) : null);
    if (daysSinceFood !== null && daysSinceFood >= 7) items.push({ id: `food_${c.id}`, type: "food", severity: 4, client: c, text: `${c.name} hasn't logged food in ${daysSinceFood} days` });

    if (c.clientType === "Online") {
      const lastSession = (c.trainingLogs?.sessions || []).filter((s) => s.status === "completed").map((s) => s.date).sort().pop();
      const daysSinceExercise = lastSession ? daysSince(lastSession) : (c.joinDate ? daysSince(c.joinDate) : null);
      if (daysSinceExercise !== null && daysSinceExercise >= 7) items.push({ id: `ex_${c.id}`, type: "exercise", severity: 4, client: c, text: `${c.name} hasn't logged a workout in ${daysSinceExercise} days` });
    }
  });
  return items.sort((a, b) => a.severity - b.severity);
}
const NOTIF_ICONS = { message: "\u{1F4AC}", birthday: "\u{1F382}", payment: "\u{1F4B0}", food: "\u{1F37D}\uFE0F", exercise: "\u{1F4AA}" };
function NotificationsTab({ notifications, selectClient }) {
  if (notifications.length === 0) return <Card><div style={{ color: BRAND.muted }}>You're all caught up. No notifications right now.</div></Card>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {notifications.map((n) => (
        <Card key={n.id} onClick={() => selectClient(n.client)} style={{ cursor: "pointer", padding: 14, border: `1px solid ${n.severity === 0 ? BRAND.red : n.severity === 1 ? BRAND.red : n.severity === 2 ? BRAND.gold : BRAND.line}` }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ fontSize: 20 }}>{NOTIF_ICONS[n.type]}</div>
            <div style={{ fontWeight: 800 }}>{n.text}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}
function CoachDashboard({ user, trainer, setTrainer, clients, setClients, selectClient, refresh, syncStatus = "online" }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tab, setTab] = useState("clients");
  const [query, setQuery] = useState("");
  const isMobile = useIsMobile(520);
  const isTablet = useIsMobile(1180) && !isMobile;
  const filtered = clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  const notifications = computeNotifications(clients);
  const upcoming = clients.reduce((n, c) => n + (c.schedule?.length || 0), 0);
  async function createClient(form) {
    if (typeof navigator !== "undefined" && !navigator.onLine) { alert("You're offline. Creating a new client needs an internet connection - please try again once you're back online."); return; }
    const color = form.color || getClientColor(uid(), clients.length);
    const invite_code = makeInviteCode();
    const payload = { trainer_id: user.id, name: form.name, email: form.email, phone: form.phone, age: ageFromBirthday(form.profile.birthday) || 0, weight_kg: Number(form.weight || 0), goal: form.profile.goals?.[0] || "General Fitness", color, invite_code, invite_status: "not_sent" };
    const { data, error } = await supabase.from("clients").insert(payload).select("*").single();
    if (error) { alert(error.message); return; }
    await upsertSection(data.id, "profile", form.profile);
    setShowAdd(false);
    await refresh();
  }
  async function convertTrialToClient(trial) {
    if (typeof navigator !== "undefined" && !navigator.onLine) { alert("You're offline. Converting a trial needs an internet connection - please try again once you're back online."); return null; }
    const color = getClientColor(uid(), clients.length);
    const invite_code = makeInviteCode();
    const payload = { trainer_id: user.id, name: trial.name, email: trial.email, phone: trial.phone, age: 0, weight_kg: 0, goal: trial.goal ? trial.goal.slice(0, 60) : "General Fitness", color, invite_code, invite_status: "not_sent" };
    const { data, error } = await supabase.from("clients").insert(payload).select("*").single();
    if (error) { alert(error.message); return null; }
    const profile = {
      ...emptyProfile(),
      injuries: trial.injuries || "",
      medicalIssues: trial.medicalIssues || "",
      barriers: trial.barriers || "",
      sleep: trial.sleep || "",
      neat: trial.neat || "",
    };
    await upsertSection(data.id, "profile", profile);
    await upsertSection(data.id, "trial", trial);
    await refresh();
    return data.id;
  }
  return (
    <div style={{ minHeight: "100vh", background: BRAND.bg, color: BRAND.text }}>
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(7,7,7,.93)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${BRAND.line}`, padding: isMobile ? "10px 12px" : isTablet ? "10px 14px" : "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
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
      <main style={{ width: "100%", maxWidth: isMobile ? 430 : isTablet ? 960 : 1180, margin: "0 auto", padding: isMobile ? 10 : isTablet ? 12 : 16, boxSizing: "border-box", overflowX: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : isTablet ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(170px,1fr))", gap: isMobile ? 10 : isTablet ? 12 : 14, marginBottom: isTablet ? 12 : 16 }}>
          <Kpi title="Active Clients" value={clients.length} icon="👥" color={BRAND.gold} onClick={() => setTab("clients")} compact={isMobile || isTablet} />
          <Kpi title="Notifications" value={notifications.length} icon="🔔" color={notifications.length > 0 ? BRAND.red : BRAND.muted} onClick={() => setTab("notifications")} compact={isMobile || isTablet} />
          <Kpi title="Trials" value="Open" icon="" color={BRAND.red} onClick={() => setTab("trials")} compact={isMobile || isTablet} />
          <Kpi title="Calendar" value="Open" icon="📅" color={BRAND.green} onClick={() => setTab("calendar")} compact={isMobile || isTablet} />
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
          {[["clients", "Clients"], ["notifications", `Notifications${notifications.length > 0 ? ` (${notifications.length})` : ""}`], ["trials", "Trials"], ["calendar", "Calendar"]].map(([k, l]) => <Button key={k} variant={tab === k ? "gold" : "dark"} onClick={() => setTab(k)}>{l}</Button>)}
        </div>
        {tab === "clients" && <>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 10, marginBottom: 14 }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients..." style={inputStyle()} />
            <Button onClick={() => setShowAdd(true)}>+ Add New Client</Button>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : isTablet ? "repeat(3,minmax(0,1fr))" : "repeat(auto-fit,minmax(150px,1fr))",
            gap: isMobile ? 12 : isTablet ? 14 : 18,
            alignItems: "start",
          }}>
            {filtered.map((c, i) => <ClientCard key={c.id} client={c} onClick={() => selectClient(c)} index={i} />)}
          </div>
        </>}
        {tab === "calendar" && <Calendar clients={clients} refresh={refresh} user={user} />}
        {tab === "notifications" && <NotificationsTab notifications={notifications} selectClient={selectClient} />}
        {tab === "trials" && <Trials user={user} onConvert={convertTrialToClient} />}
      </main>
      {showAdd && <AddClientModal onClose={() => setShowAdd(false)} onCreate={createClient} />}
      {showSettings && <CoachSettingsModal user={user} trainer={trainer} onClose={() => setShowSettings(false)} onSaved={(next) => { setTrainer?.(next); setShowSettings(false); refresh(); }} />}
    </div>
  );
}
function Kpi({ title, value, icon, color, onClick, compact = false }) {
  return <Card onClick={onClick} style={{ cursor: onClick ? "pointer" : "default", borderColor: onClick ? `${color}55` : BRAND.line, minHeight: compact ? 92 : 128, padding: compact ? 12 : 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <div><div style={{ color: BRAND.muted, fontSize: compact ? 11 : 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6 }}>{title}</div><div style={{ fontSize: compact ? 24 : 30, fontWeight: 800, color, lineHeight: 1.05, letterSpacing: -0.5 }}>{value}</div></div>
      <div style={{ fontSize: compact ? 20 : 26, opacity: 0.85 }}>{icon}</div>
    </div>
    <div style={{ marginTop: 8, color: BRAND.dim, fontSize: 11, fontWeight: 500 }}>{onClick ? "Tap to open" : ""}</div>
  </Card>;
}
function ScheduledView({ clients, selectClient }) {
  const isMobile = useIsMobile(520);
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
  const isCompact = useIsMobile(520);
  const size = isCompact ? 146 : 162;
  const goals = client.goals?.join(" + ") || client.goal || "General Fitness";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: size,
        aspectRatio: "1 / 1",
        justifySelf: "center",
        borderRadius: "50%",
        border: `1px solid ${BRAND.line}`,
        background: BRAND.card,
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
      <div style={{
        position: "absolute",
        top: 8,
        right: 8,
        background: client.clientType === "Online" ? BRAND.cyan : BRAND.gold,
        color: "#000",
        fontSize: 9,
        fontWeight: 700,
        borderRadius: 999,
        padding: "2px 7px",
        letterSpacing: 0.3,
      }}>{client.clientType === "Online" ? "ONLINE" : "1:1"}</div>
      <ClientAvatar client={client} size={isCompact ? 46 : 52} />
      <div style={{
        marginTop: 8,
        fontSize: isCompact ? 14 : 16,
        fontWeight: 700,
        letterSpacing: 0,
        lineHeight: 1.05,
        maxWidth: "92%",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>{client.name}</div>
      <div style={{
        color: client.color,
        fontSize: isCompact ? 10 : 11,
        fontWeight: 600,
        marginTop: 5,
        lineHeight: 1.18,
        maxWidth: "86%",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>{goals}</div>
      <div style={{
        color: BRAND.muted,
        fontSize: isCompact ? 11 : 12,
        fontWeight: 600,
        marginTop: 8,
        background: BRAND.card2,
        border: `1px solid ${BRAND.line}`,
        borderRadius: 999,
        padding: "5px 9px",
        maxWidth: "92%",
        whiteSpace: "nowrap",
      }}>{client.weight || 0}kg &middot; {client.age || 0} yrs</div>
    </button>
  );
}
function Mini({ label, value }) { return <div style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: 10 }}><div style={{ color: BRAND.dim, fontSize: 10, fontWeight: 600 }}>{label}</div><div style={{ color: BRAND.text, fontWeight: 700 }}>{value}</div></div>; }
const NAV_ICON_PATHS = {
  home: <path d="M3 11L12 3L21 11V21H15V14H9V21H3V11Z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />,
  food: <><path d="M6 2V10C6 11.6569 7.34315 13 9 13V13C10.6569 13 12 11.6569 12 10V2M9 13V22M6 2V6M12 2V6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /><path d="M18 2C16 4 16 8 18 10V22" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></>,
  train: <path d="M6 7V17M18 7V17M2 10V14M22 10V14M6 12H18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  me: <><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M4 21C4 16.5 7.5 14 12 14C16.5 14 20 16.5 20 21" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></>,
  back: <path d="M15 5L8 12L15 19" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  program: <><rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M9 4V2H15V4M8 10H16M8 14H16M8 18H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>,
  progress: <><path d="M3 17L9 11L13 15L21 7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 7H15M21 7V13" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></>,
  photo: <><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" fill="none" /><circle cx="9" cy="10" r="1.6" fill="currentColor" /><path d="M21 15L16 10L7 19" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></>,
  msg: <path d="M21 12C21 16.4183 16.9706 20 12 20C10.5 20 9.1 19.7 7.9 19.1L3 20L4.3 15.9C3.5 14.8 3 13.5 3 12C3 7.58172 7.02944 4 12 4C16.9706 4 21 7.58172 21 12Z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />,
  card: <><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M2 10H22" stroke="currentColor" strokeWidth="2" /></>,
  gear: <><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" /><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" fill="none" /></>,
  check: <><rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></>,
};
function NavIcon({ name, size = 21, color = "currentColor", rotate = 0 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{ color, display: "block", transform: rotate ? `rotate(${rotate}deg)` : undefined }}>{NAV_ICON_PATHS[name]}</svg>;
}
const CLIENT_BOTTOM_NAV = [
  { key: "home", label: "Home", icon: "home", group: ["home"] },
  { key: "nutrition", label: "Nutrition", icon: "food", group: ["nutrition"] },
  { key: "train_hub", label: "Train", icon: "train", group: ["train_hub", "program", "progress", "photos"] },
  { key: "me_hub", label: "Me", icon: "me", group: ["me_hub", "messages", "payments", "profile", "checkins"] },
];
function ClientBottomNav({ tab, setTab, unreadMessages }) {
  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 90, background: BRAND.panel, borderTop: `1px solid ${BRAND.line}`, display: "flex", justifyContent: "space-around", paddingTop: 10, paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
      {CLIENT_BOTTOM_NAV.map((item) => {
        const active = item.group.includes(tab);
        return (
          <button key={item.key} onClick={() => setTab(item.key)} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: 64, position: "relative", padding: 0 }}>
            <div style={{ width: 42, height: 28, borderRadius: 999, background: active ? `${BRAND.gold}22` : "transparent", display: "grid", placeItems: "center" }}>
              <NavIcon name={item.icon} color={active ? BRAND.gold : BRAND.dim} />
              {item.key === "me_hub" && unreadMessages > 0 && <div style={{ position: "absolute", top: -2, right: 6, width: 16, height: 16, borderRadius: "50%", background: BRAND.red, color: "#fff", fontSize: 9, fontWeight: 900, display: "grid", placeItems: "center", border: `2px solid ${BRAND.panel}` }}>{unreadMessages > 9 ? "9+" : unreadMessages}</div>}
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color: active ? BRAND.gold : BRAND.dim }}>{item.label}</div>
          </button>
        );
      })}
    </div>
  );
}
function HubScreen({ title, subtitle, cards, onOpen }) {
  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 2 }}>{title}</div>
      <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{subtitle}</div>
      {cards.map((c) => (
        <button key={c.key} onClick={() => onOpen(c.key)} style={{ width: "100%", textAlign: "left", background: BRAND.card, border: `1px solid ${BRAND.line}`, borderRadius: 20, padding: 16, marginBottom: 12, display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
          <div style={{ width: 48, height: 48, borderRadius: 15, background: `${c.color}18`, display: "grid", placeItems: "center", flexShrink: 0 }}><NavIcon name={c.icon} size={24} color={c.color} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: BRAND.text, fontWeight: 800, fontSize: 15 }}>{c.title}</div>
            <div style={{ color: c.alert ? BRAND.red : BRAND.muted, fontWeight: 600, fontSize: 12, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.sub}</div>
          </div>
          <NavIcon name="back" size={16} color={BRAND.dim} rotate={180} />
        </button>
      ))}
    </div>
  );
}
function ClientAvatar({ client, size = 54 }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", display: "grid", placeItems: "center", background: client.color, color: "#000", fontWeight: 700, overflow: "hidden", flexShrink: 0 }}>{client.photo ? <img src={client.photo} alt={client.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : client.avatar}</div>;
}
function ClientSettingsModal({ client, onClose }) {
  const [changing, setChanging] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  async function updatePassword() {
    if (!newPassword || newPassword.length < 6) { setMessage("Password must be at least 6 characters."); return; }
    setChanging(true); setMessage("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setMessage(error ? error.message : "Password updated.");
    setChanging(false);
    setNewPassword("");
  }
  async function logout() {
    await supabase.auth.signOut();
    onClose();
  }
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 1000 }}>Settings</div>
            <div style={{ color: BRAND.muted }}>{client.name}</div>
          </div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <Field label="New password" value={newPassword} onChange={setNewPassword} type="password" placeholder="At least 6 characters" />
        {message && <div style={{ color: message.includes("updated") ? BRAND.green : BRAND.red, fontWeight: 800, marginTop: 10, fontSize: 13 }}>{message}</div>}
        <Button disabled={changing} onClick={updatePassword} style={{ marginTop: 12, width: "100%" }}>{changing ? "Updating..." : "Update Password"}</Button>
        <div style={{ borderTop: `1px solid ${BRAND.line}`, marginTop: 18, paddingTop: 16 }}>
          <Button variant="red" onClick={logout} style={{ width: "100%" }}>Log Out</Button>
        </div>
      </Card>
    </div>
  );
}
function ClientView({ client, updateClient, back, refresh, isCoach = true }) {
  const [tab, setTab] = useState(isCoach ? "profile" : "home");
  const [showSettings, setShowSettings] = useState(false);
  const isMobile = useIsMobile(520);
  const isOnline = client.clientType === "Online";
  const tabs = isCoach ? [
    ["profile", "Profile"], ["program", "Program"], ["nutrition", "Nutrition"], ["progress", "Progress"], ["photos", "Photos"],
    isOnline ? ["checkins", "Check-ins"] : ["schedule", "Schedule"],
    isOnline ? ["payments", "Payments"] : ["packages", "Packages"],
    ["messages", "Messages"], ["invite", "Invite"],
  ] : [
    ["home", "Home"], ["nutrition", "Nutrition"], ["program", "Program"], ["progress", "Progress"], ["photos", "Photos"],
    ...(isOnline ? [["checkins", "Check-ins"], ["payments", "Payments"]] : []),
    ["messages", "Messages"], ["profile", "Profile"],
  ];
  async function delClient() {
    if (!confirm(`Delete ${client.name}? This cannot be undone.`)) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) { alert("You're offline. Deleting a client needs an internet connection - please try again once you're back online."); return; }
    await supabase.from("client_data").delete().eq("client_id", client.id);
    await supabase.from("clients").delete().eq("id", client.id);
    back(); refresh();
  }
  // ---- content block shared by both coach (tab bar) and client (bottom nav) ----
  const content = <>
    {tab === "home" && <ClientHome client={client} goTo={!isCoach ? setTab : undefined} />}
    {tab === "profile" && <ProfileTab client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "program" && <ProgramTab client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "nutrition" && <NutritionTab client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "progress" && <ProgressTab client={client} />}
    {tab === "photos" && <TransformPhotos client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "schedule" && <ScheduleTab client={client} updateClient={updateClient} />}
    {tab === "packages" && <PackagesTab client={client} updateClient={updateClient} />}
    {tab === "checkins" && <CheckInsTab client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "payments" && <PaymentsTab client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "messages" && <MessagesTab client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "invite" && <InviteTab client={client} updateClient={updateClient} />}
    {tab === "workouts" && <ClientWorkoutLog client={client} updateClient={updateClient} />}
  </>;

  // ---- COACH: unchanged horizontal tab bar, full tablet layout ----
  if (isCoach) {
    return (
      <div style={{ minHeight: "100vh", width: "100%", maxWidth: "100vw", overflowX: "hidden", background: BRAND.bg, color: BRAND.text }}>
        <header style={{ borderBottom: `1px solid ${BRAND.line}`, padding: isMobile ? "8px 10px" : 14, display: "flex", gap: 9, alignItems: "center", position: "sticky", top: 0, background: "rgba(7,7,7,.96)", backdropFilter: "blur(16px)", zIndex: 80, maxWidth: "100vw", overflow: "hidden" }}>
          <Button variant="ghost" onClick={back} style={{ padding: isMobile ? "8px 10px" : undefined }}>Back</Button>
          <ClientAvatar client={client} size={isMobile ? 44 : 56} />
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: isMobile ? 20 : 25, fontWeight: 1000, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client.name}</div><div style={{ color: client.color, fontWeight: 1000, fontSize: 12 }}>{client.goals?.join(" + ") || client.goal}</div></div>
          <Button variant="red" onClick={delClient} style={{ padding: isMobile ? "8px 10px" : undefined }}>Delete</Button>
        </header>
        <main style={{ width: "100%", maxWidth: isMobile ? 430 : 960, margin: "0 auto", padding: isMobile ? "6px 8px 12px" : 16, boxSizing: "border-box", overflowX: "hidden" }}>
          <div style={{
            display: "flex",
            gap: isMobile ? 6 : 8,
            overflowX: "auto",
            marginBottom: isMobile ? 8 : 14,
            padding: isMobile ? "2px 0 6px" : "0 0 6px",
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
              boxShadow: "none",
            }}>{l}</button>)}
          </div>
          {content}
        </main>
      </div>
    );
  }

  // ---- CLIENT: bottom nav (Home / Nutrition / Train / Me) with hub screens, full-bleed content, no top bar ----
  const parentHub = ["program", "progress", "photos"].includes(tab) ? "train_hub" : ["messages", "payments", "profile", "checkins"].includes(tab) ? "me_hub" : null;
  const parentHubLabel = parentHub === "train_hub" ? "Train" : "Me";
  const unreadMessages = (client.messages || []).filter((m) => m.from === "coach" && !m.read).length;
  const trainCards = [
    { key: "program", icon: "program", color: BRAND.gold, title: "Program", sub: client.program?.name ? `${client.program.name} · Week ${client.program.weeks?.[0]?.weekNum || 1}` : "No program yet" },
    { key: "progress", icon: "progress", color: BRAND.cyan, title: "Progress", sub: "See your trends and personal bests" },
    { key: "photos", icon: "photo", color: BRAND.purple, title: "Photos", sub: client.transformPhotos?.length ? `${client.transformPhotos.length} photo${client.transformPhotos.length === 1 ? "" : "s"} saved` : "No photos yet" },
  ];
  const meCards = [
    { key: "profile", icon: "gear", color: BRAND.purple, title: "Profile", sub: "Your details & settings" },
    { key: "checkins", icon: "check", color: BRAND.green, title: "Check-ins", sub: "Your weekly check-in" },
    { key: "payments", icon: "card", color: BRAND.green, title: "Payments", sub: paymentStatus(client).label },
    { key: "settings", icon: "gear", color: BRAND.dim, title: "Settings", sub: "Change password & log out" },
  ];
  function handleMeOpen(key) { if (key === "settings") setShowSettings(true); else setTab(key); }
  return (
    <div style={{ minHeight: "100vh", width: "100%", maxWidth: "100vw", overflowX: "hidden", background: BRAND.bg, color: BRAND.text, paddingBottom: 90 }}>
      <main style={{ width: "100%", maxWidth: isMobile ? 430 : 760, margin: "0 auto", padding: isMobile ? "14px 10px 0" : "18px 16px 0", boxSizing: "border-box", overflowX: "hidden" }}>
        {parentHub && (
          <button onClick={() => setTab(parentHub)} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: BRAND.muted, fontWeight: 800, fontSize: 13, padding: "10px 4px", margin: "-10px 0 4px -4px", minHeight: 44 }}>
            <NavIcon name="back" size={15} /> Back to {parentHubLabel}
          </button>
        )}
        {tab === "train_hub" && <HubScreen title="Train" subtitle="Program, progress, and photos" cards={trainCards} onOpen={setTab} />}
        {tab === "me_hub" && <HubScreen title="Me" subtitle="Messages, payments, and account" cards={meCards} onOpen={handleMeOpen} />}
        {tab !== "train_hub" && tab !== "me_hub" && content}
      </main>
      {showSettings && <ClientSettingsModal client={client} onClose={() => setShowSettings(false)} />}
      <ClientBottomNav tab={tab} setTab={setTab} unreadMessages={unreadMessages} />
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
function metricDisplay(entry, timed) {
  if (!entry) return "-";
  if (timed) return `${entry.value}s`;
  return `${entry.value}kg${entry.reps ? ` x ${entry.reps}` : ""}`;
}
function clampPercent(value, total) {
  const v = Number(value || 0);
  const t = Number(total || 0);
  if (!t) return 0;
  return Math.max(0, Math.min(100, Math.round((v / t) * 100)));
}
function ProgressRing({ label, value, total, unit = "", color = BRAND.gold, size = 132 }) {
  const pct = clampPercent(value, total);
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (pct / 100);
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: size + 56 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} stroke={BRAND.card2} strokeWidth={stroke} fill="transparent" />
          <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="transparent" strokeLinecap="round" strokeDasharray={`${dash} ${c - dash}`} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: BRAND.text, letterSpacing: -0.5 }}>{value || 0}{unit}</div>
            <div style={{ color: BRAND.dim, fontSize: 10, fontWeight: 600 }}>/{total || 0}{unit}</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10, color: BRAND.muted, fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
      <div style={{ color, fontWeight: 700, fontSize: 13, marginTop: 2 }}>{pct}%</div>
    </div>
  );
}
function PremiumTile({ label, value, sub = "", color = BRAND.gold }) {
  return <div style={{ background: BRAND.card, border: `1px solid ${BRAND.line}`, borderRadius: 20, padding: 16 }}><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase" }}>{label}</div><div style={{ color, fontSize: 24, fontWeight: 700, marginTop: 7, letterSpacing: -0.5 }}>{value}</div>{sub && <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 5 }}>{sub}</div>}</div>;
}
function MealStatusPill({ meal, done, color }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: done ? `${color}18` : BRAND.card2, border: `1px solid ${done ? color : BRAND.line}`, borderRadius: 18, padding: "12px 14px" }}><b style={{ fontWeight: 600 }}>{meal}</b><span style={{ color: done ? color : BRAND.muted, fontWeight: 700 }}>{done ? "Done" : "Pending"}</span></div>;
}
function CompactScore({ value, color }) {
  return <div style={{ width: 70, height: 70, borderRadius: "50%", display: "grid", placeItems: "center", background: `conic-gradient(${color} ${value}%, ${BRAND.card2} ${value}% 100%)` }}><div style={{ width: 54, height: 54, borderRadius: "50%", background: BRAND.bg, display: "grid", placeItems: "center", textAlign: "center" }}><div><div style={{ fontSize: 18, fontWeight: 700 }}>{value}%</div><div style={{ color: BRAND.muted, fontSize: 7, fontWeight: 600 }}>SCORE</div></div></div></div>;
}
function CompactMetric({ label, value, total, color, percent }) {
  const n = typeof percent === "number" ? percent : (Number(total) ? Math.min(100, Math.round(Number(value || 0) / Number(total || 1) * 100)) : 0);
  return <Card style={{ padding: 12, borderRadius: 20, minHeight: 98 }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}><div><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 600 }}>{label}</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, letterSpacing: -0.5 }}>{value}</div><div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 500 }}>/{total}</div></div><div style={{ width: 44, height: 44, borderRadius: "50%", background: `conic-gradient(${color} ${n}%, ${BRAND.card2} ${n}% 100%)`, display: "grid", placeItems: "center" }}><div style={{ width: 33, height: 33, borderRadius: "50%", background: BRAND.card }} /></div></div><div style={{ color, fontSize: 11, fontWeight: 700, marginTop: 8 }}>{n}% complete</div></Card>;
}
function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}
function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator?.standalone === true;
}
function InstallPrompt({ color = BRAND.gold }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(() => (typeof localStorage !== "undefined" ? localStorage.getItem("forge_install_dismissed") === "1" : false));
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  useEffect(() => {
    function onPrompt(e) { e.preventDefault(); setDeferredPrompt(e); }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  if (isStandalone() || dismissed) return null;
  if (!deferredPrompt && !isIOS()) return null; // Android/Chrome that hasn't fired the prompt yet, or an unsupported desktop browser - nothing useful to offer
  function dismiss() { setDismissed(true); localStorage.setItem("forge_install_dismissed", "1"); }
  async function install() {
    if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; setDeferredPrompt(null); dismiss(); }
    else setShowIOSHelp(true);
  }
  return (
    <Card style={{ padding: 14, background: `${color}14`, border: `1px solid ${color}55`, marginBottom: 4 }}>
      {!showIOSHelp ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 22 }}>&#128241;</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: BRAND.text, fontWeight: 800, fontSize: 14 }}>Add Forge to your Home Screen</div>
            <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 600, marginTop: 2 }}>One tap, and you'll never need the link again.</div>
          </div>
          <button onClick={dismiss} style={{ background: "transparent", border: "none", color: BRAND.dim, fontWeight: 900, fontSize: 16, cursor: "pointer", padding: 4 }}>&times;</button>
        </div>
      ) : (
        <div>
          <div style={{ color: BRAND.text, fontWeight: 800, fontSize: 14, marginBottom: 6 }}>Add to Home Screen</div>
          <div style={{ color: BRAND.muted, fontSize: 12.5, fontWeight: 600, lineHeight: 1.5 }}>Tap the Share button <span style={{ color, fontWeight: 900 }}>&#9633;&#8593;</span> at the bottom of Safari, then choose "Add to Home Screen".</div>
        </div>
      )}
      {!showIOSHelp && <Button onClick={install} style={{ width: "100%", marginTop: 12 }}>Add to Home Screen</Button>}
    </Card>
  );
}
function ClientHome({ client, goTo }) {
  const isMobile = useIsMobile(520);
  const stats = todaysNutritionStats(client);
  const metrics = computePerformanceMetrics(client.trainingLogs);
  const deadHang = metrics.find((m) => m.name === "Dead Hang");
  const plank = metrics.find((m) => m.name === "Plank");
  const todaysWorkout = client.program?.weeks?.[0]?.workouts?.[0]?.name || "Workout not assigned";
  const meals = ["Breakfast", "Lunch", "Dinner"];
  const mealDone = (meal) => stats.logs.some((l) => l.meal === meal) || stats.daily?.meals?.[meal];
  if (isMobile) {
    return <div style={{ display: "grid", gap: 12 }}>
      <InstallPrompt color={client.color} />
      <Card style={{ borderColor: `${client.color}44`, padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center" }}>
          <ClientAvatar client={client} size={58} />
          <div style={{ minWidth: 0 }}><div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 1000, letterSpacing: 1.8 }}>FORGE CLIENT</div><div style={{ fontSize: 22, fontWeight: 1000, lineHeight: 1.05, textTransform: "uppercase" }}>Welcome, {client.name}</div><div style={{ color: client.color, fontWeight: 1000, marginTop: 4, fontSize: 12 }}>{client.goals?.join(" + ") || client.goal}</div></div>
          <CompactScore value={stats.score} color={client.color} />
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <CompactMetric label="Calories" value={stats.totals.kcal} total={stats.calTarget || 0} color={BRAND.cyan} />
        <CompactMetric label="Protein" value={`${stats.totals.protein}g`} total={`${stats.proteinTarget || 0}g`} percent={stats.proteinTarget ? Math.min(100, Math.round(stats.totals.protein / stats.proteinTarget * 100)) : 0} color={BRAND.green} />
        <CompactMetric label="Steps" value={stats.daily.steps || 0} total={stats.stepsTarget || 10000} color={BRAND.gold} />
        <CompactMetric label="Water" value={`${stats.daily.water || 0}L`} total={`${stats.waterTarget || 3}L`} percent={(stats.waterTarget || 3) ? Math.min(100, Math.round(Number(stats.daily.water || 0) / Number(stats.waterTarget || 3) * 100)) : 0} color={BRAND.blue} />
      </div>
      <Card onClick={goTo ? () => goTo("nutrition") : undefined} style={{ cursor: goTo ? "pointer" : "default" }}><div style={{ color: BRAND.gold, fontWeight: 1000, marginBottom: 10 }}>TODAY'S NUTRITION</div><div style={{ display: "grid", gap: 8 }}>{meals.map((m) => <MealStatusPill key={m} meal={m} done={mealDone(m)} color={client.color} />)}</div></Card>
      <Card onClick={goTo ? () => goTo("program") : undefined} style={{ cursor: goTo ? "pointer" : "default" }}><div style={{ color: BRAND.gold, fontWeight: 1000, marginBottom: 8 }}>TODAY'S WORKOUT</div><div style={{ fontSize: 22, fontWeight: 1000 }}>{todaysWorkout}</div><div style={{ color: BRAND.muted, marginTop: 6 }}>Tap to open Program &rarr;</div></Card>
      <Card><div style={{ color: BRAND.gold, fontWeight: 1000, marginBottom: 10 }}>PERFORMANCE</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><PremiumTile label="Dead Hang PB" value={metricDisplay(deadHang?.best, true)} sub={`Recent ${metricDisplay(deadHang?.recent, true)}`} color={BRAND.cyan} /><PremiumTile label="Plank PB" value={metricDisplay(plank?.best, true)} sub={`Recent ${metricDisplay(plank?.recent, true)}`} color={BRAND.purple} /></div></Card>
    </div>;
  }
  return <div style={{ display: "grid", gap: isMobile ? 10 : 16, maxWidth: "100%", overflowX: "hidden" }}>
    <Card style={{ borderColor: `${client.color}44`, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}><ClientAvatar client={client} size={76} /><div><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 1000, letterSpacing: 2 }}>FORGE CLIENT</div><div style={{ fontSize: 31, fontWeight: 1000, lineHeight: 1, textTransform: "uppercase" }}>Welcome back, {client.name}</div><div style={{ color: client.color, fontWeight: 900, marginTop: 6 }}>{client.goals?.join(" + ") || client.goal}</div></div></div>
        <div style={{ width: 118, height: 118, borderRadius: "50%", display: "grid", placeItems: "center", background: `conic-gradient(${client.color} ${stats.score}%, ${BRAND.card2} ${stats.score}% 100%)` }}><div style={{ width: 86, height: 86, borderRadius: "50%", background: BRAND.bg, display: "grid", placeItems: "center", textAlign: "center" }}><div><div style={{ fontSize: 30, fontWeight: 1000 }}>{stats.score}%</div><div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 1000 }}>FORGE SCORE</div></div></div></div>
      </div>
    </Card>
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}><ProgressRing label="Calories" value={stats.totals.kcal} total={stats.calTarget || 0} color={BRAND.cyan} /><ProgressRing label="Protein" value={stats.totals.protein} total={stats.proteinTarget || 0} unit="g" color={BRAND.green} /><ProgressRing label="Steps" value={stats.daily.steps || 0} total={stats.stepsTarget || 10000} color={BRAND.gold} /><ProgressRing label="Water L" value={stats.daily.water || 0} total={stats.waterTarget || 3} color={BRAND.blue} /></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14 }}><Card onClick={goTo ? () => goTo("nutrition") : undefined} style={{ cursor: goTo ? "pointer" : "default" }}><div style={{ color: BRAND.gold, fontWeight: 1000, marginBottom: 10 }}>TODAY'S NUTRITION</div><div style={{ display: "grid", gap: 9 }}>{meals.map((m) => <MealStatusPill key={m} meal={m} done={mealDone(m)} color={client.color} />)}</div></Card><Card onClick={goTo ? () => goTo("program") : undefined} style={{ cursor: goTo ? "pointer" : "default" }}><div style={{ color: BRAND.gold, fontWeight: 1000, marginBottom: 10 }}>TODAY'S WORKOUT</div><div style={{ fontSize: 24, fontWeight: 1000 }}>{todaysWorkout}</div><div style={{ color: BRAND.muted, marginTop: 6 }}>Tap to open Program &rarr;</div></Card><Card><div style={{ color: BRAND.gold, fontWeight: 1000, marginBottom: 10 }}>PERFORMANCE</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><PremiumTile label="Dead Hang PB" value={metricDisplay(deadHang?.best, true)} sub={`Recent ${metricDisplay(deadHang?.recent, true)}`} color={BRAND.cyan} /><PremiumTile label="Plank PB" value={metricDisplay(plank?.best, true)} sub={`Recent ${metricDisplay(plank?.recent, true)}`} color={BRAND.purple} /></div></Card></div>
  </div>;
}
function TrialLinkModal({ client, onClose, onLinked }) {
  const [trials, setTrials] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", client.trainer_id).eq("section", "trials").maybeSingle();
      setTrials((data?.data?.trials || []).filter((t) => !t.convertedClientId || t.convertedClientId === client.id));
      setLoading(false);
    })();
  }, [client.trainer_id]);
  async function link(trial) {
    await upsertSection(client.id, "trial", trial);
    onLinked(trial);
  }
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 560, maxHeight: "80vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 1000 }}>Link a Saved Trial</div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        {loading && <div style={{ color: BRAND.muted }}>Loading trials...</div>}
        {!loading && trials.length === 0 && <div style={{ color: BRAND.muted }}>No unlinked trials found. Trials are matched by name — check the Trials tab.</div>}
        {trials.map((t) => (
          <button key={t.id} onClick={() => link(t)} style={{ display: "block", width: "100%", textAlign: "left", background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: 12, marginBottom: 8, cursor: "pointer", color: BRAND.text }}>
            <b>{t.name}</b>
            <div style={{ color: BRAND.muted, fontSize: 12 }}>{t.phone} &middot; {t.email}</div>
          </button>
        ))}
      </Card>
    </div>
  );
}
const MOTIVATION_STYLES = ["", "Encouraging cheerleader", "Direct and tough-love", "Data and numbers focused", "Quiet accountability, no fuss"];
const CELEBRATION_STYLES = ["", "A public shoutout", "A quiet high-five", "A message from you", "Just mark it in session"];
function ProfileTab({ client, updateClient, isCoach = true }) {
  const isMobile = useIsMobile(520);
  const [profile, setProfile] = useState({ ...emptyProfile(), ...(client.profile || {}) });
  const [name, setName] = useState(client.name || "");
  const [weight, setWeight] = useState(client.weight || "");
  const [saving, setSaving] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTrialLink, setShowTrialLink] = useState(false);
  const [trialData, setTrialData] = useState(client.trialData || null);
  const fileRef = useRef(null);
  const measurements = profile.measurements || {};
  const currentColor = profile.color || client.color || BRAND.cyan;
  const computedAge = ageFromBirthday(profile.birthday);
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
    const cleanName = name.trim() || client.name;
    const cleanWeight = Number(weight || 0);
    await upsertSection(client.id, "profile", nextProfile);
    await updateClientRow(client.id, { name: cleanName, weight_kg: cleanWeight });
    const nextAge = ageFromBirthday(nextProfile.birthday) ?? client.age;
    updateClient({ ...client, profile: nextProfile, name: cleanName, weight: cleanWeight, age: nextAge, photo: nextProfile.photo || client.photo, color: nextProfile.color || client.color, goals: nextProfile.goals, goal: nextProfile.goals?.[0] || client.goal, notes: nextProfile.notes });
    setSaving(false);
  }
  return <Card style={{ padding: isMobile ? 14 : 18 }}>
    <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 1000, marginBottom: 14, textAlign: isMobile ? "center" : "left" }}>Client Profile</div>
    <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
      <button type="button" onClick={() => fileRef.current?.click()} title="Tap to change profile picture" style={{ width: 88, height: 88, borderRadius: 28, background: currentColor, overflow: "hidden", display: "grid", placeItems: "center", color: "#000", fontWeight: 1000, border: `1px solid ${BRAND.line}`, cursor: "pointer", padding: 0 }}>
        {profile.photo || client.photo ? <img src={profile.photo || client.photo} alt="client" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(client.name || client.avatar)}
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={(e) => pickPhoto(e.target.files?.[0])} style={{ display: "none" }} />
      <div style={{ flex: 1, minWidth: 190 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name" style={{ background: "transparent", border: "none", borderBottom: `1px solid ${BRAND.line}`, color: BRAND.text, fontWeight: 1000, fontSize: 18, padding: "2px 0", outline: "none", width: "100%" }} />
        <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 800, marginTop: 4 }}>Tap the picture to change it. Tap the name to rename.</div>
        {isCoach && <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="dark" onClick={() => setShowColorPicker((v) => !v)}>{showColorPicker ? "Hide client color" : "Change client color"}</Button>
          {!trialData && <Button variant="dark" onClick={() => setShowTrialLink(true)}>Link a Saved Trial</Button>}
        </div>}
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 14 }}>
      <Field label="Weight (kg)" value={weight} onChange={setWeight} type="number" />
      <div>
        <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 }}>Age</div>
        <div style={{ ...inputStyle(), display: "flex", alignItems: "center", color: computedAge != null ? BRAND.text : BRAND.muted }}>{computedAge != null ? `${computedAge} years` : "Add birthday below"}</div>
      </div>
    </div>
    {isCoach && showColorPicker && <div style={{ marginBottom: 14 }}><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{CLIENT_COLORS.map((c) => <button key={c} onClick={() => set("color", c)} style={{ width: 34, height: 34, borderRadius: 12, border: currentColor === c ? `3px solid ${BRAND.text}` : `1px solid ${BRAND.line}`, background: c, cursor: "pointer" }} />)}</div></div>}

    {isCoach && trialData && <div style={{ background: `${BRAND.purple}14`, border: `1px solid ${BRAND.purple}55`, borderRadius: 16, padding: 14, marginBottom: 16 }}>
      <div style={{ color: BRAND.purple, fontWeight: 1000, marginBottom: 8 }}>From Trial &middot; {String(trialData.savedAt || "").slice(0, 10) || "Consultation on file"}</div>
      <div style={{ color: BRAND.muted, fontSize: 13, marginBottom: 10 }}>Captured before this client signed up. Only you can see this.</div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(120px,1fr))", gap: 8, marginBottom: 10 }}>
        <Mini label="Fat loss priority" value={trialData.fatLossImportance || "-"} />
        <Mini label="Muscle gain priority" value={trialData.muscleGainImportance || "-"} />
        <Mini label="Strength/endurance priority" value={trialData.strengthEnduranceImportance || "-"} />
        <Mini label="Mobility priority" value={trialData.mobilityFlexibilityImportance || "-"} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
        <Mini label="Cardio assessment" value={trialData.cardiovascular || "-"} />
        <Mini label="Squat assessment" value={trialData.squat || "-"} />
        <Mini label="Push strength" value={trialData.pushStrength || "-"} />
        <Mini label="Pull strength" value={trialData.pullStrength || "-"} />
        <Mini label="Core strength" value={trialData.coreStrength || "-"} />
        <Mini label="Flexibility" value={trialData.flexibilityFitness || "-"} />
      </div>
      {trialData.fitnessHistory && <div style={{ marginTop: 10, fontSize: 13 }}><span style={{ color: BRAND.purple, fontWeight: 900 }}>Fitness history: </span>{trialData.fitnessHistory}</div>}
      {trialData.nutrition && <div style={{ marginTop: 6, fontSize: 13 }}><span style={{ color: BRAND.purple, fontWeight: 900 }}>Nutrition notes: </span>{trialData.nutrition}</div>}
    </div>}

    <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>What are you working toward?</div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>{GOAL_OPTIONS.map((g) => <button key={g} onClick={() => toggleGoal(g)} style={{ border: `1px solid ${(profile.goals || []).includes(g) ? currentColor : BRAND.line}`, background: (profile.goals || []).includes(g) ? currentColor : BRAND.card2, color: (profile.goals || []).includes(g) ? "#000" : BRAND.text, borderRadius: 999, padding: "11px 14px", minHeight: 40, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.4 }}>{String(g).toUpperCase()}</button>)}</div>

    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(230px,1fr))", gap: 12, marginBottom: 12 }}>
      <Field label="When's your birthday? We love celebrating with our clients" value={profile.birthday} onChange={(v) => set("birthday", v)} type="date" />
    </div>

    <div style={{ color: BRAND.gold, fontWeight: 1000, fontSize: 14, marginTop: 8, marginBottom: 10, borderTop: `1px solid ${BRAND.line}`, paddingTop: 16 }}>Getting to Know You</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}>
      <Field label="Do you have any current injuries or pain? (e.g. lower back, knee, shoulder)" value={profile.injuries} onChange={(v) => set("injuries", v)} textarea placeholder="None right now, or tell us where it hurts" />
      <Field label="Any medical conditions we should know about? (e.g. blood pressure, asthma, diabetes)" value={profile.medicalIssues} onChange={(v) => set("medicalIssues", v)} textarea placeholder="None, or list what applies" />
      <Field label="What usually gets in the way of sticking to a plan?" value={profile.barriers} onChange={(v) => set("barriers", v)} textarea placeholder="e.g. travel, late nights, motivation dips" />
      <Field label="How's your sleep? Hours and quality." value={profile.sleep} onChange={(v) => set("sleep", v)} textarea placeholder="e.g. 6-7 hours, often interrupted" />
      <Field label="Outside of training, how active is your day-to-day?" value={profile.neat} onChange={(v) => set("neat", v)} textarea placeholder="e.g. desk job, on my feet all day, active parent" />
      <Field label="What does your work schedule look like?" value={profile.workSchedule} onChange={(v) => set("workSchedule", v)} textarea placeholder="Helps us plan session times and meal timing" />
      <Field label="Do you follow any particular diet?" value={profile.vegetarianStatus} onChange={(v) => set("vegetarianStatus", v)} placeholder="e.g. vegetarian, vegan, no restrictions" />
      <Field label="Any food allergies or things you avoid?" value={profile.allergies} onChange={(v) => set("allergies", v)} placeholder="e.g. nuts, shellfish, none" />
    </div>

    <div style={{ color: BRAND.gold, fontWeight: 1000, fontSize: 14, marginTop: 20, marginBottom: 10, borderTop: `1px solid ${BRAND.line}`, paddingTop: 16 }}>So We Can Support You Better</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}>
      <Field label="What would make you feel proud of yourself in 3 months?" value={profile.proudGoal} onChange={(v) => set("proudGoal", v)} textarea placeholder="A win that would mean a lot to you" />
      <Field label="Anything going on in life right now we should know about?" value={profile.lifeContext} onChange={(v) => set("lifeContext", v)} textarea placeholder="e.g. stressful few weeks at work, upcoming travel" />
      <label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 }}>How do you like to be motivated?</div><select value={profile.motivationStyle} onChange={(e) => set("motivationStyle", e.target.value)} style={inputStyle()}>{MOTIVATION_STYLES.map((m) => <option key={m} value={m}>{m || "Select..."}</option>)}</select></label>
      <label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 }}>How should we celebrate your wins?</div><select value={profile.celebrationStyle} onChange={(e) => set("celebrationStyle", e.target.value)} style={inputStyle()}>{CELEBRATION_STYLES.map((m) => <option key={m} value={m}>{m || "Select..."}</option>)}</select></label>
      <Field label="Emergency contact name" value={profile.emergencyContactName} onChange={(v) => set("emergencyContactName", v)} placeholder="In case we ever need to reach someone" />
      <Field label="Emergency contact phone" value={profile.emergencyContactPhone} onChange={(v) => set("emergencyContactPhone", v)} />
    </div>

    {isCoach && <Field label="Private coach notes" value={profile.notes} onChange={(v) => set("notes", v)} textarea placeholder="Anything else worth remembering about this client" />}

    {isCoach && <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 6 }}>Measurements</div>
      <div style={{ color: BRAND.muted, marginBottom: 12 }}>Assessment fields copied from your paper form. Use cm unless another unit makes more sense.</div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>{MEASUREMENT_FIELDS.map(([key, label]) => <Field key={key} label={label} value={measurements[key] || ""} onChange={(v) => setMeasurement(key, v)} />)}</div>
    </div>}
    {showTrialLink && <TrialLinkModal client={client} onClose={() => setShowTrialLink(false)} onLinked={(t) => { setTrialData(t); setShowTrialLink(false); updateClient({ ...client, trialData: t }); }} />}
    <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}><label style={{ color: BRAND.muted }}><input type="checkbox" checked={!!profile.lactoseIntolerant} onChange={(e) => set("lactoseIntolerant", e.target.checked)} /> Lactose intolerant</label><label style={{ color: BRAND.muted }}><input type="checkbox" checked={!!profile.glutenIntolerant} onChange={(e) => set("glutenIntolerant", e.target.checked)} /> Gluten intolerant</label></div><Button disabled={saving} onClick={save} style={{ marginTop: 16 }}>{saving ? "Saving..." : "Save Profile"}</Button></Card>;
}
function sessionEntriesV2(logs) {
  const entries = [];
  (logs?.sessions || []).forEach((s) => {
    if (s.status !== "completed") return;
    (s.entries || []).forEach((e) => {
      const name = e.substitutedName || e.name;
      const timed = isTimedExercise(name);
      (e.sets || []).forEach((set, si) => {
        const value = timed ? parseNumberFromText(set.duration || set.reps) : Number(set.load || 0);
        if (!value) return;
        entries.push({ week: s.weekNum, date: s.date || "", exercise: name, timed, value, weight: set.load, reps: set.reps, duration: set.duration, rpe: set.rpe, set: si + 1 });
      });
    });
  });
  return entries;
}
function computePerformanceMetrics(logs) {
  const wanted = ["Dead Hang", "Plank", "Bench Press", "Squat", "Deadlift"];
  const aliases = {
    "Dead Hang": ["dead hang", "dead hung"], "Plank": ["plank"],
    "Bench Press": ["bench press", "flat barbell bench press", "barbell bench press"],
    "Squat": ["squat", "back squat", "barbell squat"], "Deadlift": ["deadlift", "barbell deadlift"],
  };
  const entries = sessionEntriesV2(logs);
  return wanted.map((name) => {
    const keys = aliases[name];
    const data = entries.filter((e) => keys.includes(e.exercise.toLowerCase()));
    const timed = ["Dead Hang", "Plank"].includes(name);
    const sorted = [...data].sort((a, b) => a.value - b.value);
    const best = sorted[sorted.length - 1];
    const recent = data[data.length - 1];
    const first = data[0];
    const trend = first && recent ? recent.value - first.value : 0;
    return { name, timed, best, recent, trend };
  });
}
function recentCompletedSessions(logs, limit = 6) {
  const sessions = (logs?.sessions || []).filter((s) => s.status === "completed" && s.date);
  return sessions.slice(-limit).reverse().map((s) => ({
    id: s.id, date: s.date, name: s.workoutName, weekNum: s.weekNum, metrics: s.metrics, notes: s.notes,
    sessionData: (s.entries || []).map((e) => ({
      name: e.substitutedName || e.name,
      sets: (e.sets || []).map((set) => ({ weight: set.load, reps: set.reps, duration: set.duration, rpe: set.rpe })),
    })),
  }));
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
// ================= NUTRITION SYSTEM (redesigned) =================
// Design borrows the best of MacroFactor (clean rings, low friction),
// MyFitnessPal (meal-based diary), and Cronometer (clear macro breakdown).

const MEAL_ORDER = ["Breakfast", "Lunch", "Dinner", "Snacks"];

function macroPct(value, total) { return clampPercent(value, total); }

// USDA FoodData Central provides free nutrition lookups with no signup required
// at low volume (DEMO_KEY). For heavier use, get a free key in seconds at
// https://fdc.nal.usda.gov/api-key-signup and paste it here.
const FDC_API_KEY = "DEMO_KEY";

async function lookupFoodOnline(query) {
  if (!query || !query.trim()) return null;
  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query.trim())}&pageSize=5&dataType=Foundation,SR%20Legacy,Survey%20(FNDDS)&api_key=${FDC_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return { error: res.status === 429 ? "Lookup limit reached for now. Try again shortly, or add this food manually." : "Lookup failed. Add this food manually." };
    const data = await res.json();
    const food = data.foods?.[0];
    if (!food) return { error: "No match found online. Try different words, or add it manually." };
    const getNutrient = (names) => {
      const n = (food.foodNutrients || []).find((x) => names.some((name) => (x.nutrientName || "").toLowerCase().includes(name)));
      return n ? Number(n.value || 0) : 0;
    };
    const kcal = Math.round(getNutrient(["energy"]));
    const protein = Math.round(getNutrient(["protein"]));
    const carbs = Math.round(getNutrient(["carbohydrate"]));
    const fats = Math.round(getNutrient(["total lipid", "fat"]));
    if (!kcal && !protein && !carbs && !fats) return { error: "Found a match but no usable nutrition data. Add manually." };
    return { name: (food.description || query).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) + " (100g)", kcal, protein, carbs, fats, source: "USDA FoodData Central", per100g: true };
  } catch (e) {
    return { error: "Couldn't reach the food database. Check your connection, or add manually." };
  }
}
async function loadCustomFoods(trainerId) {
  if (!trainerId) return [];
  const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", trainerId).eq("section", "custom_foods").maybeSingle();
  return data?.data?.foods || [];
}
async function saveCustomFood(trainerId, food) {
  if (!trainerId) return;
  const existing = await loadCustomFoods(trainerId);
  if (existing.some((f) => f.name.toLowerCase() === food.name.toLowerCase())) return existing;
  const next = [...existing, { ...food, tags: food.tags || [] }];
  await upsertTrainerData(trainerId, "custom_foods", { foods: next });
  return next;
}

function FoodSearchModal({ client, onClose, onAdd }) {
  const isMobile = useIsMobile(520);
  const [tab, setTab] = useState("search");
  const [query, setQuery] = useState("");
  const [qty, setQty] = useState(1);
  const [customName, setCustomName] = useState("");
  const [customMacros, setCustomMacros] = useState({ kcal: "", protein: "", carbs: "", fats: "" });
  const [smartText, setSmartText] = useState("");
  const [customFoods, setCustomFoods] = useState([]);
  const [lookupState, setLookupState] = useState(null); // null | "loading" | { result or error }
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const smartEstimate = useMemo(() => estimateSmartFood(smartText), [smartText]);
  useEffect(() => { loadCustomFoods(client?.trainer_id).then(setCustomFoods); }, [client?.trainer_id]);
  const combinedDb = useMemo(() => [...customFoods, ...FOOD_DB], [customFoods]);
  const results = query.trim() ? combinedDb.filter((f) => f.name.toLowerCase().includes(query.toLowerCase())).slice(0, 30) : combinedDb.slice(0, 12);

  function addFromSearch(f) {
    onAdd({ name: f.name, kcal: Math.round(f.kcal * qty), protein: Math.round(f.protein * qty), carbs: Math.round(f.carbs * qty), fats: Math.round(f.fats * qty), qty });
  }
  function addCustom() {
    if (!customName.trim()) { alert("Give this food a name."); return; }
    onAdd({ name: customName.trim(), kcal: Number(customMacros.kcal || 0), protein: Number(customMacros.protein || 0), carbs: Number(customMacros.carbs || 0), fats: Number(customMacros.fats || 0), qty: 1 });
    if (saveToLibrary && client?.trainer_id) saveCustomFood(client.trainer_id, { name: customName.trim(), kcal: Number(customMacros.kcal || 0), protein: Number(customMacros.protein || 0), carbs: Number(customMacros.carbs || 0), fats: Number(customMacros.fats || 0) });
  }
  function addSmart() {
    if (!smartText.trim()) return;
    onAdd({ name: smartText.trim(), kcal: Number(smartEstimate.kcal || 0), protein: Number(smartEstimate.protein || 0), carbs: Number(smartEstimate.carbs || 0), fats: Number(smartEstimate.fats || 0), qty: 1, estimate: smartEstimate });
  }
  async function runOnlineLookup() {
    setLookupState("loading");
    const result = await lookupFoodOnline(query);
    setLookupState(result);
  }
  function addFromLookup() {
    if (!lookupState || lookupState.error) return;
    const mult = qty || 1;
    const item = { name: lookupState.name, kcal: Math.round(lookupState.kcal * mult), protein: Math.round(lookupState.protein * mult), carbs: Math.round(lookupState.carbs * mult), fats: Math.round(lookupState.fats * mult), qty: mult };
    onAdd(item);
    if (saveToLibrary && client?.trainer_id) saveCustomFood(client.trainer_id, { name: lookupState.name, kcal: lookupState.kcal, protein: lookupState.protein, carbs: lookupState.carbs, fats: lookupState.fats });
  }
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 560, maxHeight: "88vh", overflow: "auto", padding: isMobile ? 14 : 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 1000 }}>Add Food</div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <Button variant={tab === "search" ? "gold" : "dark"} onClick={() => setTab("search")} style={{ flex: 1 }}>Search</Button>
          <Button variant={tab === "smart" ? "gold" : "dark"} onClick={() => setTab("smart")} style={{ flex: 1 }}>Describe Meal</Button>
          <Button variant={tab === "custom" ? "gold" : "dark"} onClick={() => setTab("custom")} style={{ flex: 1 }}>Custom</Button>
        </div>

        {tab === "search" && <>
          <input value={query} onChange={(e) => { setQuery(e.target.value); setLookupState(null); }} placeholder="Search foods..." style={inputStyle({ marginBottom: 10 })} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ color: BRAND.muted, fontSize: 12, fontWeight: 800 }}>Servings</span>
            <input type="number" step="0.5" min="0.5" value={qty} onChange={(e) => setQty(Number(e.target.value || 1))} style={inputStyle({ width: 80 })} />
          </div>
          <div style={{ display: "grid", gap: 6, maxHeight: 320, overflowY: "auto" }}>
            {results.map((f) => (
              <button key={f.name} onClick={() => addFromSearch(f)} style={{ textAlign: "left", background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: 10, cursor: "pointer", color: BRAND.text }}>
                <div style={{ fontWeight: 800 }}>{f.name}</div>
                <div style={{ color: BRAND.muted, fontSize: 12 }}>{Math.round(f.kcal * qty)} kcal · P {Math.round(f.protein * qty)}g · C {Math.round(f.carbs * qty)}g · F {Math.round(f.fats * qty)}g</div>
              </button>
            ))}
            {results.length === 0 && (
              <div style={{ padding: 12, textAlign: "center" }}>
                <div style={{ color: BRAND.muted, marginBottom: 10 }}>No matches in your food library.</div>
                {lookupState !== "loading" && (!lookupState || lookupState.error) && (
                  <Button onClick={runOnlineLookup}>Look up "{query.trim()}" online</Button>
                )}
                {lookupState === "loading" && <div style={{ color: BRAND.gold, fontWeight: 800 }}>Searching USDA food database...</div>}
                {lookupState?.error && <div style={{ color: BRAND.orange, fontSize: 13, marginTop: 8 }}>{lookupState.error}</div>}
                {lookupState && !lookupState.error && (
                  <div style={{ marginTop: 12, padding: 12, border: `1px solid ${BRAND.green}`, borderRadius: 16, background: `${BRAND.green}12`, textAlign: "left" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                      <b>{lookupState.name}</b>
                      <span style={{ color: BRAND.green, fontWeight: 900, fontSize: 12 }}>{lookupState.source}</span>
                    </div>
                    <div style={{ color: BRAND.muted, fontSize: 12, marginBottom: 8 }}>Values are per 100g — adjust servings below before adding.</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ color: BRAND.muted, fontSize: 12, fontWeight: 800 }}>Servings (x100g)</span>
                      <input type="number" step="0.5" min="0.25" value={qty} onChange={(e) => setQty(Number(e.target.value || 1))} style={inputStyle({ width: 80 })} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(80px,1fr))", gap: 8, marginBottom: 10 }}>
                      <Mini label="Calories" value={Math.round(lookupState.kcal * qty)} /><Mini label="Protein" value={`${Math.round(lookupState.protein * qty)}g`} /><Mini label="Carbs" value={`${Math.round(lookupState.carbs * qty)}g`} /><Mini label="Fats" value={`${Math.round(lookupState.fats * qty)}g`} />
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, color: BRAND.muted, fontSize: 12, marginBottom: 10 }}>
                      <input type="checkbox" checked={saveToLibrary} onChange={(e) => setSaveToLibrary(e.target.checked)} />
                      Save to your food library so it's instant next time
                    </label>
                    <Button onClick={addFromLookup} style={{ width: "100%" }}>Add to Diary</Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>}

        {tab === "smart" && <>
          <div style={{ color: BRAND.muted, fontSize: 13, marginBottom: 8 }}>Describe what you ate in plain words — portions and multiple items work.</div>
          <textarea value={smartText} onChange={(e) => setSmartText(e.target.value)} placeholder="2 chapati + chicken curry + rice" style={textareaStyle({ minHeight: 80 })} />
          {smartText.trim() && (
            <div style={{ marginTop: 10, padding: 12, border: `1px solid ${smartEstimate.confidence === "High" ? BRAND.green : BRAND.gold}`, borderRadius: 16, background: `${smartEstimate.confidence === "High" ? BRAND.green : BRAND.gold}12` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}><b>Estimate</b><span style={{ color: smartEstimate.confidence === "High" ? BRAND.green : BRAND.gold, fontWeight: 1000 }}>{smartEstimate.confidence} confidence</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(80px,1fr))", gap: 8 }}>
                <Mini label="Calories" value={smartEstimate.kcal || 0} /><Mini label="Protein" value={`${smartEstimate.protein || 0}g`} /><Mini label="Carbs" value={`${smartEstimate.carbs || 0}g`} /><Mini label="Fats" value={`${smartEstimate.fats || 0}g`} />
              </div>
              {smartEstimate.unmatched.length > 0 && <div style={{ color: BRAND.orange, fontSize: 12, marginTop: 6 }}>Needs review: {smartEstimate.unmatched.join(", ")}</div>}
            </div>
          )}
          <Button onClick={addSmart} style={{ width: "100%", marginTop: 12 }}>Add to Diary</Button>
        </>}

        {tab === "custom" && <>
          <Field label="Food name" value={customName} onChange={setCustomName} placeholder="Homemade protein shake" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 8, marginTop: 10 }}>
            <Field label="Calories" value={customMacros.kcal} onChange={(v) => setCustomMacros((m) => ({ ...m, kcal: v }))} type="number" />
            <Field label="Protein" value={customMacros.protein} onChange={(v) => setCustomMacros((m) => ({ ...m, protein: v }))} type="number" />
            <Field label="Carbs" value={customMacros.carbs} onChange={(v) => setCustomMacros((m) => ({ ...m, carbs: v }))} type="number" />
            <Field label="Fats" value={customMacros.fats} onChange={(v) => setCustomMacros((m) => ({ ...m, fats: v }))} type="number" />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, color: BRAND.muted, fontSize: 12, marginTop: 10 }}>
            <input type="checkbox" checked={saveToLibrary} onChange={(e) => setSaveToLibrary(e.target.checked)} />
            Save to your food library so it's searchable next time
          </label>
          <Button onClick={addCustom} style={{ width: "100%", marginTop: 10 }}>Add to Diary</Button>
        </>}
      </Card>
    </div>
  );
}

function WeekAdherenceStrip({ nutrition, targets, color }) {
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d.toISOString().slice(0, 10); });
  const target = Number(targets.calories || 0);
  const totals = days.map((d) => (nutrition.logs || []).filter((l) => l.date === d).reduce((a, l) => a + Number(l.kcal || 0), 0));
  const loggedCount = days.filter((d, i) => totals[i] > 0).length;
  const max = Math.max(target || 1, ...totals, 1);
  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: 1000 }}>Last 7 Days</div>
        <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 800 }}>{loggedCount}/7 days logged</div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 70 }}>
        {days.map((d, i) => {
          const h = Math.max(4, (totals[i] / max) * 64);
          const over = target && totals[i] > target * 1.1;
          const under = target && totals[i] < target * 0.85 && totals[i] > 0;
          const barColor = totals[i] === 0 ? BRAND.line : over ? BRAND.red : under ? BRAND.gold : color;
          return (
            <div key={d} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: "100%", height: h, background: barColor, borderRadius: 4 }} title={`${totals[i]} kcal`} />
              <div style={{ color: BRAND.muted, fontSize: 9, fontWeight: 800 }}>{new Date(d).toLocaleDateString(undefined, { weekday: "narrow" })}</div>
            </div>
          );
        })}
      </div>
      {target > 0 && <div style={{ color: BRAND.muted, fontSize: 11, marginTop: 8 }}>Target {target} kcal · gold = under, red = over 10%+</div>}
    </Card>
  );
}

function MealSection({ meal, logs, plan, color, onAdd, onDelete }) {
  const totals = logs.reduce((a, l) => ({ kcal: a.kcal + Number(l.kcal || 0), protein: a.protein + Number(l.protein || 0), carbs: a.carbs + Number(l.carbs || 0), fats: a.fats + Number(l.fats || 0) }), { kcal: 0, protein: 0, carbs: 0, fats: 0 });
  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: plan || logs.length ? 10 : 0 }}>
        <div><div style={{ fontWeight: 1000, fontSize: 16, color }}>{meal}</div>{logs.length > 0 && <div style={{ color: BRAND.muted, fontSize: 12 }}>{totals.kcal} kcal · P{totals.protein} C{totals.carbs} F{totals.fats}</div>}</div>
        <Button variant="dark" onClick={onAdd}>+ Add</Button>
      </div>
      {plan && <div style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: 10, marginBottom: 10, color: BRAND.muted, fontSize: 13, whiteSpace: "pre-wrap" }}><span style={{ color: BRAND.gold, fontWeight: 900 }}>Plan: </span>{plan}</div>}
      {logs.map((l) => (
        <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${BRAND.line}`, paddingTop: 8, marginTop: 8 }}>
          <div><div style={{ fontWeight: 800 }}>{l.food}{l.qty !== 1 ? ` (x${l.qty})` : ""}</div><div style={{ color: BRAND.muted, fontSize: 12 }}>{l.kcal} kcal · P{l.protein} C{l.carbs} F{l.fats}</div></div>
          <button onClick={() => onDelete(l.id)} style={{ background: "transparent", border: "none", color: BRAND.red, fontWeight: 1000, cursor: "pointer", fontSize: 16 }}>x</button>
        </div>
      ))}
    </Card>
  );
}

function startOfWeekMonday(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday;
}
const WEEKDAY_LETTERS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
function WeekStrip({ date, onSelect, loggedDates, color = BRAND.gold }) {
  const monday = startOfWeekMonday(date);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  const monthLabel = monday.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const todayIso = new Date().toISOString().slice(0, 10);
  function shiftWeek(deltaDays) {
    const d = new Date(date); d.setDate(d.getDate() + deltaDays);
    onSelect(d.toISOString().slice(0, 10));
  }
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, marginBottom: 16 }}>
        <button onClick={() => shiftWeek(-7)} style={{ background: "transparent", border: "none", color: BRAND.dim, fontSize: 20, fontWeight: 800, cursor: "pointer", padding: "10px 16px", minHeight: 44, minWidth: 44 }}>&lsaquo;</button>
        <div style={{ color: BRAND.text, fontSize: 16, fontWeight: 800 }}>{monthLabel}</div>
        <button onClick={() => shiftWeek(7)} style={{ background: "transparent", border: "none", color: BRAND.dim, fontSize: 20, fontWeight: 800, cursor: "pointer", padding: "10px 16px", minHeight: 44, minWidth: 44 }}>&rsaquo;</button>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {days.map((d, i) => {
          const iso = d.toISOString().slice(0, 10);
          const isToday = iso === todayIso;
          const isSelected = iso === date;
          const hasLog = loggedDates.has(iso);
          return (
            <button key={iso} onClick={() => onSelect(iso)} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flex: 1, padding: 0 }}>
              <div style={{ color: BRAND.dim, fontSize: 10, fontWeight: 800, letterSpacing: 0.3 }}>{WEEKDAY_LETTERS[i]}</div>
              <div style={{
                width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 15, fontWeight: 700,
                background: isSelected ? color : "transparent",
                border: !isSelected && isToday ? `2px solid ${color}` : "none",
                color: isSelected ? "#000" : isToday ? color : BRAND.muted,
              }}>{d.getDate()}</div>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: hasLog ? (isSelected ? color : BRAND.dim) : "transparent" }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
function NutritionTab({ client, updateClient, isCoach }) {
  const isMobile = useIsMobile(520);
  const [nutrition, setNutrition] = useState(() => normalizeNutrition(client.nutrition));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [addingMeal, setAddingMeal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showTargets, setShowTargets] = useState(false);

  useEffect(() => { setNutrition(normalizeNutrition(client.nutrition)); }, [client.id, client.nutrition]);

  const todays = (nutrition.logs || []).filter((l) => l.date === date);
  const loggedDates = useMemo(() => new Set((nutrition.logs || []).map((l) => l.date)), [nutrition.logs]);
  const daily = nutrition.daily?.[date] || {};
  const totals = todays.reduce((a, l) => ({ kcal: a.kcal + Number(l.kcal || 0), protein: a.protein + Number(l.protein || 0), carbs: a.carbs + Number(l.carbs || 0), fats: a.fats + Number(l.fats || 0) }), { kcal: 0, protein: 0, carbs: 0, fats: 0 });
  const targets = nutrition.targets || {};
  const remaining = Math.max(0, Number(targets.calories || 0) - totals.kcal);

  async function persist(next) {
    const clean = normalizeNutrition(next);
    setNutrition(clean);
    await upsertSection(client.id, "nutrition", clean);
    updateClient({ ...client, nutrition: clean });
  }
  function setTarget(k, v) { const next = { ...nutrition, targets: { ...nutrition.targets, [k]: v } }; setNutrition(next); }
  function setMealPlan(k, v) { const next = { ...nutrition, mealPlan: { ...nutrition.mealPlan, [k]: v } }; setNutrition(next); }
  async function saveTargets() { setSaving(true); await persist(nutrition); setMessage("Saved"); setSaving(false); setTimeout(() => setMessage(""), 1500); }
  async function addFoodTo(meal, item) {
    const entry = { id: uid(), date, meal, food: item.name, qty: item.qty || 1, kcal: Math.round(item.kcal || 0), protein: Math.round(item.protein || 0), carbs: Math.round(item.carbs || 0), fats: Math.round(item.fats || 0), estimate: item.estimate || null };
    await persist({ ...nutrition, logs: [...(nutrition.logs || []), entry] });
    setAddingMeal(null);
  }
  async function delLog(id) { await persist({ ...nutrition, logs: (nutrition.logs || []).filter((l) => l.id !== id) }); }
  function setDaily(k, v) { const next = { ...nutrition, daily: { ...(nutrition.daily || {}), [date]: { ...(nutrition.daily?.[date] || {}), [k]: v } } }; setNutrition(next); persist(next); }
  const waterGlasses = 8;
  const waterFilled = Math.round((Number(daily.water || 0) / (Number(targets.water || 3) || 3)) * waterGlasses);

  return (
    <div style={{ display: "grid", gap: isMobile ? 10 : 14, maxWidth: "100%", overflowX: "hidden" }}>
      <Card style={{ padding: isMobile ? 12 : 16 }}>
        <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 1000, color: BRAND.gold, marginBottom: 14 }}>Nutrition</div>
        <WeekStrip date={date} onSelect={setDate} loggedDates={loggedDates} color={client.color} />
      </Card>

      <Card style={{ padding: isMobile ? 14 : 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "auto 1fr", gap: 20, alignItems: "center" }}>
          <div style={{ display: "grid", placeItems: "center" }}>
            <ProgressRing label="Calories left" value={remaining} total={Number(targets.calories || 0) || remaining || 1} unit="" color={client.color} size={isMobile ? 130 : 150} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800, marginBottom: 4 }}><span style={{ color: BRAND.cyan }}>Protein</span><span style={{ color: BRAND.muted }}>{totals.protein}/{targets.protein || 0}g</span></div>
              <div style={{ height: 8, background: BRAND.card2, borderRadius: 999 }}><div style={{ height: 8, width: `${macroPct(totals.protein, targets.protein)}%`, background: BRAND.cyan, borderRadius: 999 }} /></div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800, marginBottom: 4 }}><span style={{ color: BRAND.gold }}>Carbs</span><span style={{ color: BRAND.muted }}>{totals.carbs}/{targets.carbs || 0}g</span></div>
              <div style={{ height: 8, background: BRAND.card2, borderRadius: 999 }}><div style={{ height: 8, width: `${macroPct(totals.carbs, targets.carbs)}%`, background: BRAND.gold, borderRadius: 999 }} /></div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800, marginBottom: 4 }}><span style={{ color: BRAND.purple }}>Fats</span><span style={{ color: BRAND.muted }}>{totals.fats}/{targets.fats || 0}g</span></div>
              <div style={{ height: 8, background: BRAND.card2, borderRadius: 999 }}><div style={{ height: 8, width: `${macroPct(totals.fats, targets.fats)}%`, background: BRAND.purple, borderRadius: 999 }} /></div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, paddingTop: 14, borderTop: `1px solid ${BRAND.line}`, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {Array.from({ length: waterGlasses }, (_, i) => (
              <button key={i} onClick={() => setDaily("water", Number((((i + 1) / waterGlasses) * Number(targets.water || 3)).toFixed(1)))} style={{ width: 22, height: 26, borderRadius: 4, border: `1px solid ${BRAND.blue}`, background: i < waterFilled ? BRAND.blue : "transparent", cursor: "pointer", padding: 0 }} title="Tap to set water intake" />
            ))}
            <span style={{ color: BRAND.muted, fontSize: 12, fontWeight: 800, marginLeft: 4 }}>{daily.water || 0}L / {targets.water || 3}L</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Field label="" value={daily.steps || ""} onChange={(v) => setDaily("steps", v)} type="number" placeholder="Steps today" />
            <label><select value={daily.sleep || ""} onChange={(e) => setDaily("sleep", e.target.value)} style={inputStyle({ minWidth: 120 })}>{SLEEP_HOURS.map((h) => <option key={h} value={h}>{h ? `${h}h sleep` : "Sleep"}</option>)}</select></label>
          </div>
        </div>
      </Card>

      {MEAL_ORDER.map((meal) => (
        <MealSection key={meal} meal={meal} logs={todays.filter((l) => l.meal === meal)} plan={nutrition.mealPlan?.[meal]} color={client.color} onAdd={() => setAddingMeal(meal)} onDelete={delLog} />
      ))}

      <WeekAdherenceStrip nutrition={nutrition} targets={targets} color={client.color} />

      {isCoach && <Card style={{ padding: isMobile ? 12 : 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showTargets ? 12 : 0 }}>
          <div style={{ fontSize: 18, fontWeight: 1000 }}>Coach Nutrition Targets</div>
          <Button variant="dark" onClick={() => setShowTargets((v) => !v)}>{showTargets ? "Hide" : "Edit Targets"}</Button>
        </div>
        {showTargets && <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
            {["calories", "protein", "carbs", "fats", "water", "steps"].map((k) => <Field key={k} label={k} value={nutrition.targets[k] || ""} onChange={(v) => setTarget(k, v)} type="number" />)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10, marginTop: 12 }}>
            {MEAL_ORDER.map((m) => (
              <div key={m}>
                <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 5 }}>{m.toUpperCase()} PLAN</div>
                <textarea value={nutrition.mealPlan?.[m] || ""} onChange={(e) => setMealPlan(m, e.target.value)} placeholder={`Write ${m.toLowerCase()} foods, portions, notes...`} style={textareaStyle({ minHeight: 80 })} />
              </div>
            ))}
          </div>
          <textarea value={nutrition.planNotes || ""} onChange={(e) => setNutrition((n) => ({ ...n, planNotes: e.target.value }))} placeholder="Coach notes: dietary restrictions, meal timing, foods to avoid..." style={textareaStyle({ minHeight: 70, marginTop: 10 })} />
          <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
            <Button onClick={saveTargets} disabled={saving}>{saving ? "Saving..." : "Save Targets & Plan"}</Button>
            {message && <span style={{ color: BRAND.green, fontWeight: 900 }}>{message}</span>}
          </div>
        </>}
      </Card>}

      {addingMeal && <FoodSearchModal client={client} onClose={() => setAddingMeal(null)} onAdd={(item) => addFoodTo(addingMeal, item)} />}
    </div>
  );
}

function PhotoUploadModal({ onClose, onSave }) {
  const [form, setForm] = useState({ image: "", type: "Progress", weight: "", notes: "", date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  async function pickImage(file) { if (!file) return; const dataUrl = await readFileAsDataUrl(file); setForm((f) => ({ ...f, image: dataUrl })); }
  async function save() {
    if (!form.image) { alert("Choose a photo from your device first."); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 440, maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 1000 }}>Add Photo</div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        {form.image ? (
          <div style={{ position: "relative", marginBottom: 14 }}>
            <img src={form.image} alt="preview" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 16 }} />
            <button onClick={() => setForm((f) => ({ ...f, image: "" }))} style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,.7)", border: "none", color: "#fff", borderRadius: 999, width: 30, height: 30, fontWeight: 900, cursor: "pointer" }}>x</button>
          </div>
        ) : (
          <label style={{ display: "grid", placeItems: "center", height: 180, background: BRAND.card2, border: `2px dashed ${BRAND.line}`, borderRadius: 16, marginBottom: 14, cursor: "pointer", color: BRAND.muted, fontWeight: 800 }}>
            + Choose a photo
            <input type="file" accept="image/*" onChange={(e) => pickImage(e.target.files?.[0])} style={{ display: "none" }} />
          </label>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, marginBottom: 6, textTransform: "uppercase" }}>Type</div><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={inputStyle()}>{PHOTO_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <Field label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
        </div>
        <Field label="Weight (optional)" value={form.weight} onChange={(v) => setForm({ ...form, weight: v })} type="number" />
        <Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} textarea />
        <Button onClick={save} disabled={saving} style={{ width: "100%", marginTop: 12 }}>{saving ? "Saving..." : "Save Photo"}</Button>
      </Card>
    </div>
  );
}
function PhotoLightbox({ photos, index, onClose, onNavigate, onDelete }) {
  const photo = photos[index];
  if (!photo) return null;
  return (
    <div style={{ ...modalBackdrop(), padding: 0 }}>
      <div style={{ position: "absolute", top: 14, right: 14, zIndex: 2, display: "flex", gap: 8 }}>
        <Button variant="red" onClick={() => onDelete(photo.id)}>Delete</Button>
        <Button variant="ghost" onClick={onClose}>X</Button>
      </div>
      {index > 0 && <button onClick={() => onNavigate(index - 1)} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", zIndex: 2, background: "rgba(0,0,0,.6)", border: "none", color: "#fff", width: 40, height: 40, borderRadius: "50%", fontSize: 20, fontWeight: 900, cursor: "pointer" }}>&lsaquo;</button>}
      {index < photos.length - 1 && <button onClick={() => onNavigate(index + 1)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", zIndex: 2, background: "rgba(0,0,0,.6)", border: "none", color: "#fff", width: 40, height: 40, borderRadius: "50%", fontSize: 20, fontWeight: 900, cursor: "pointer" }}>&rsaquo;</button>}
      <div style={{ maxWidth: 480, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <img src={photo.image || photo.url} alt={photo.type} style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 12 }} />
        <div style={{ background: BRAND.card, border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 14, marginTop: 12, width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: BRAND.text, fontWeight: 800 }}><span>{photo.type}</span><span style={{ color: BRAND.muted, fontWeight: 600 }}>{photo.date}</span></div>
          {photo.weight && <div style={{ color: BRAND.gold, fontWeight: 700, fontSize: 13, marginTop: 4 }}>{photo.weight}kg</div>}
          {photo.notes && <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 6 }}>{photo.notes}</div>}
        </div>
      </div>
    </div>
  );
}
function PhotoCompareSlot({ label, photo, onPick }) {
  return (
    <button onClick={onPick} style={{ background: BRAND.card, border: `1px solid ${BRAND.line}`, borderRadius: 20, overflow: "hidden", cursor: "pointer", padding: 0, textAlign: "left", width: "100%" }}>
      <div style={{ padding: "10px 12px", color: BRAND.gold, fontWeight: 900, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      {photo?.image || photo?.url ? <img src={photo.image || photo.url} alt={label} style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover" }} /> : <div style={{ aspectRatio: "3/4", display: "grid", placeItems: "center", color: BRAND.dim, fontSize: 13, fontWeight: 700 }}>No photo</div>}
      {photo && <div style={{ padding: "8px 12px 12px" }}><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 700 }}>{photo.date}{photo.weight ? ` · ${photo.weight}kg` : ""}</div></div>}
      <div style={{ padding: "0 12px 12px", color: BRAND.dim, fontSize: 11, fontWeight: 700 }}>Tap to change</div>
    </button>
  );
}
function PhotoPickerModal({ photos, onPick, onClose }) {
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 480, maxHeight: "80vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 1000 }}>Choose a Photo</div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {photos.map((p) => (
            <button key={p.id} onClick={() => onPick(p.id)} style={{ padding: 0, border: `1px solid ${BRAND.line}`, borderRadius: 12, overflow: "hidden", cursor: "pointer", background: "none" }}>
              <img src={p.image || p.url} alt={p.type} style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover" }} />
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
function TransformPhotos({ client, updateClient, isCoach }) {
  const isMobile = useIsMobile(520);
  const [photos, setPhotos] = useState(client.transformPhotos || []);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [picking, setPicking] = useState(null); // "left" | "right" | null
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("client_data").select("data").eq("client_id", client.id).eq("section", "transformPhotos").maybeSingle();
      if (cancelled) return;
      const fetched = data?.data || [];
      setPhotos(fetched);
      setLoadingPhotos(false);
      updateClient({ ...client, transformPhotos: fetched });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);
  const sorted = [...photos].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const [compareIds, setCompareIds] = useState(() => [sorted[0]?.id, sorted[sorted.length - 1]?.id]);
  const leftPhoto = photos.find((p) => p.id === compareIds[0]);
  const rightPhoto = photos.find((p) => p.id === compareIds[1]);
  const gridPhotos = [...photos].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  async function persist(next) { setPhotos(next); await upsertSection(client.id, "transformPhotos", next); updateClient({ ...client, transformPhotos: next }); }
  async function addPhoto(form) { await persist([{ id: uid(), ...form }, ...photos]); setShowUpload(false); }
  async function delPhoto(id) { await persist(photos.filter((p) => p.id !== id)); setLightboxIndex(null); }
  function pickCompare(id) { setCompareIds((prev) => (picking === "left" ? [id, prev[1]] : [prev[0], id])); setPicking(null); }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800 }}>Transformation Photos</div>
        <Button onClick={() => setShowUpload(true)}>+ Add Photo</Button>
      </div>

      {photos.length >= 2 && (
        <div>
          <div style={{ color: BRAND.gold, fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 10 }}>Compare</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <PhotoCompareSlot label="Before" photo={leftPhoto} onPick={() => setPicking("left")} />
            <PhotoCompareSlot label="After" photo={rightPhoto} onPick={() => setPicking("right")} />
          </div>
        </div>
      )}

      <div>
        <div style={{ color: BRAND.gold, fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 10 }}>All Photos</div>
        {loadingPhotos ? (
          <Card><div style={{ color: BRAND.muted }}>Loading photos...</div></Card>
        ) : photos.length === 0 ? (
          <Card><div style={{ color: BRAND.muted }}>{isCoach ? "No photos yet. Add the first one to start tracking visual progress." : "No photos yet. Tap + Add Photo to log your first one."}</div></Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3,1fr)" : "repeat(auto-fill,minmax(120px,1fr))", gap: 8 }}>
            {gridPhotos.map((p) => {
              const realIndex = gridPhotos.indexOf(p);
              return (
                <button key={p.id} onClick={() => setLightboxIndex(realIndex)} style={{ padding: 0, border: `1px solid ${BRAND.line}`, borderRadius: 14, overflow: "hidden", cursor: "pointer", background: BRAND.card2, position: "relative" }}>
                  {p.image || p.url ? <img src={p.image || p.url} alt={p.type} style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block" }} /> : <div style={{ aspectRatio: "1/1", display: "grid", placeItems: "center", color: BRAND.dim, fontSize: 11 }}>No image</div>}
                  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "linear-gradient(0deg, rgba(0,0,0,.85), transparent)", padding: "12px 8px 6px", textAlign: "left" }}>
                    <div style={{ color: "#fff", fontSize: 10, fontWeight: 800 }}>{p.date}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showUpload && <PhotoUploadModal onClose={() => setShowUpload(false)} onSave={addPhoto} />}
      {lightboxIndex !== null && <PhotoLightbox photos={gridPhotos} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onNavigate={setLightboxIndex} onDelete={delPhoto} />}
      {picking && <PhotoPickerModal photos={sorted} onPick={pickCompare} onClose={() => setPicking(null)} />}
    </div>
  );
}
function recentPBsAcrossHistory(logs, limit = 5) {
  const completed = [...(logs?.sessions || [])].filter((s) => s.status === "completed" && s.date).sort((a, b) => a.date.localeCompare(b.date));
  const found = [];
  for (let i = 0; i < completed.length; i++) {
    const before = { ...logs, sessions: completed.slice(0, i) };
    const pbs = detectSessionPBs(completed[i], before);
    pbs.forEach((pb) => { if (!pb.detail.includes("first log")) found.push({ ...pb, date: completed[i].date }); });
  }
  return found.slice(-limit).reverse();
}
function currentStreakWeeks(logs) {
  const completed = (logs?.sessions || []).filter((s) => s.status === "completed" && s.date);
  if (!completed.length) return 0;
  const isoWeek = (dateStr) => {
    const d = new Date(dateStr);
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    const diff = target - firstThursday;
    return `${target.getFullYear()}-W${1 + Math.round(diff / (7 * 24 * 3600 * 1000))}`;
  };
  const weeksWithSessions = new Set(completed.map((s) => isoWeek(s.date)));
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const wk = isoWeek(cursor.toISOString().slice(0, 10));
    if (weeksWithSessions.has(wk)) { streak += 1; cursor.setDate(cursor.getDate() - 7); }
    else break;
  }
  return streak;
}
function overallAdherence(program, logs) {
  if (!program?.weeks?.length) return { done: 0, total: 0, pct: 0 };
  let done = 0, total = 0;
  program.weeks.forEach((week) => {
    (week.workouts || []).forEach((wo) => {
      total += 1;
      if (sessionForWorkout(logs, week.id, wo.id)?.status === "completed") done += 1;
    });
  });
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}
function weeklyVolumeTrend(logs, weeksBack = 4) {
  const completed = (logs?.sessions || []).filter((s) => s.status === "completed" && s.date);
  const now = new Date();
  const labels = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i * 7);
    labels.push(d.toISOString().slice(0, 10));
  }
  const volumes = Array(weeksBack).fill(0);
  completed.forEach((s) => {
    const d = new Date(s.date);
    let idx = -1;
    for (let i = 0; i < labels.length; i++) {
      const end = new Date(labels[i]);
      const start = new Date(end); start.setDate(start.getDate() - 6);
      if (d >= start && d <= end) idx = i;
    }
    if (idx < 0) return;
    idx >= 0 && (volumes[idx] += sessionStatsV2(s).volume);
  });
  return { labels, volumes };
}
function buildProgressInsight(streak, volumeTrend, pbs) {
  const parts = [];
  if (streak >= 2) parts.push(`${streak}-week streak${streak >= 4 ? ", your longest yet" : ""}`);
  const v = volumeTrend.volumes;
  if (v.length >= 2 && v[v.length - 2] > 0) {
    const change = Math.round(((v[v.length - 1] - v[v.length - 2]) / v[v.length - 2]) * 100);
    if (change >= 10) parts.push(`volume up ${change}% this week`);
  }
  if (parts.length === 0 && pbs.length > 0) parts.push(`new PB on ${pbs[0].name}`);
  if (parts.length === 0) return { text: "Keep logging sessions to start seeing trends here." };
  return { text: parts.join(" \u2014 ") };
}
function ProgressTab({ client }) {
  const isMobile = useIsMobile(520);
  const logs = client.trainingLogs;
  const streak = currentStreakWeeks(logs);
  const volumeTrend = weeklyVolumeTrend(logs, 4);
  const pbs = recentPBsAcrossHistory(logs, 5);
  const adherence = overallAdherence(client.program, logs);
  const insight = buildProgressInsight(streak, volumeTrend, pbs);
  const recentSessions = [...(logs?.sessions || [])].filter((s) => s.status === "completed" && s.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const maxVolume = Math.max(1, ...volumeTrend.volumes);
  const pbsThisMonth = pbs.filter((pb) => pb.date && pb.date.slice(0, 7) === new Date().toISOString().slice(0, 7)).length;

  return <div style={{ display: "grid", gap: 14, maxWidth: "100%", overflowX: "hidden" }}>
    <div style={{ fontSize: isMobile ? 26 : 30, fontWeight: 800, letterSpacing: -0.4 }}>Progress</div>

    <div style={{ background: `${BRAND.gold}14`, border: `1px solid ${BRAND.gold}44`, borderRadius: 20, padding: 16 }}>
      <div style={{ color: BRAND.text, fontWeight: 700, fontSize: 14, lineHeight: 1.35 }}>{insight.text}</div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
      <div style={{ background: BRAND.card, border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: "14px 8px", textAlign: "center" }}><div style={{ color: adherence.total ? BRAND.green : BRAND.dim, fontSize: 22, fontWeight: 900 }}>{adherence.total ? `${adherence.pct}%` : "-"}</div><div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", marginTop: 4 }}>Adherence</div></div>
      <div style={{ background: BRAND.card, border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: "14px 8px", textAlign: "center" }}><div style={{ color: BRAND.gold, fontSize: 22, fontWeight: 900 }}>{streak}</div><div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", marginTop: 4 }}>Wk Streak</div></div>
      <div style={{ background: BRAND.card, border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: "14px 8px", textAlign: "center" }}><div style={{ color: BRAND.cyan, fontSize: 22, fontWeight: 900 }}>{pbsThisMonth}</div><div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", marginTop: 4 }}>PBs / mo</div></div>
    </div>

    <div>
      <div style={{ color: BRAND.gold, fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 10 }}>Recent Personal Bests</div>
      <Card style={{ padding: 16 }}>
        {pbs.length === 0 && <div style={{ color: BRAND.muted, fontSize: 13 }}>No PBs yet - complete a few sessions and they'll show up here.</div>}
        {pbs.slice(0, 3).map((pb, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: i === 0 ? "none" : `1px solid ${BRAND.card2}` }}>
            <div><div style={{ color: BRAND.text, fontWeight: 700, fontSize: 14 }}>{pb.name}</div><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 600, marginTop: 2 }}>{pb.detail} &middot; {pb.date}</div></div>
            <span style={{ background: `${BRAND.green}18`, color: BRAND.green, fontWeight: 800, fontSize: 10, padding: "4px 9px", borderRadius: 999 }}>NEW PB</span>
          </div>
        ))}
      </Card>
    </div>

    <div>
      <div style={{ color: BRAND.gold, fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 10 }}>Weekly Volume</div>
      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 56 }}>
          {volumeTrend.volumes.map((v, i) => {
            const isLast = i === volumeTrend.volumes.length - 1;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <div style={{ width: "100%", height: Math.max(4, (v / maxVolume) * 56), background: isLast ? BRAND.gold : BRAND.card2, borderRadius: "3px 3px 0 0" }} />
                <div style={{ color: isLast ? BRAND.gold : BRAND.dim, fontSize: 9, fontWeight: 700 }}>W{i + 1}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>

    <div>
      <div style={{ color: BRAND.gold, fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 10 }}>Recent Sessions</div>
      <Card style={{ padding: 16 }}>
        {recentSessions.length === 0 && <div style={{ color: BRAND.muted, fontSize: 13 }}>No sessions logged yet.</div>}
        {recentSessions.map((s, i) => (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: i === 0 ? "none" : `1px solid ${BRAND.card2}` }}>
            <span style={{ color: BRAND.text, fontWeight: 700, fontSize: 13 }}>{s.workoutName}</span>
            <span style={{ color: BRAND.dim, fontSize: 11, fontWeight: 700 }}>{s.date}</span>
          </div>
        ))}
      </Card>
    </div>
  </div>;
}
async function loadCheckInTemplate(trainerId) {
  if (!trainerId) return DEFAULT_CHECKIN_QUESTIONS;
  const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", trainerId).eq("section", "checkin_template").maybeSingle();
  return data?.data?.questions?.length ? data.data.questions : DEFAULT_CHECKIN_QUESTIONS;
}
const CHECKIN_QUESTION_TYPES = [["text", "Text"], ["scale", "1-10 Scale"], ["choice", "Multiple Choice"]];
function CheckInTemplateEditor({ trainerId, template, onSave, onClose }) {
  const [questions, setQuestions] = useState(template.map((q) => ({ type: "text", ...q })));
  const [newQ, setNewQ] = useState("");
  function updateQ(id, patch) { setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q))); }
  function deleteQ(id) { setQuestions((qs) => qs.filter((q) => q.id !== id)); }
  function addQ() { if (!newQ.trim()) return; setQuestions((qs) => [...qs, { id: uid(), text: newQ.trim(), type: "text" }]); setNewQ(""); }
  async function save() { await upsertTrainerData(trainerId, "checkin_template", { questions }); onSave(questions); }
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 560, maxHeight: "85vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 1000 }}>Weekly Check-in Questions</div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <div style={{ color: BRAND.muted, fontSize: 13, marginBottom: 12 }}>These questions go to every client's weekly check-in. Scale and Multiple Choice let clients tap an answer instead of typing.</div>
        {questions.map((q) => (
          <div key={q.id} style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input value={q.text} onChange={(e) => updateQ(q.id, { text: e.target.value })} style={inputStyle()} />
              <button onClick={() => deleteQ(q.id)} style={{ background: "transparent", border: "none", color: BRAND.red, fontWeight: 1000, cursor: "pointer", fontSize: 18, padding: "0 6px" }}>x</button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: q.type === "choice" ? 8 : 0 }}>
              {CHECKIN_QUESTION_TYPES.map(([val, label]) => (
                <button key={val} onClick={() => updateQ(q.id, { type: val, options: val === "choice" ? (q.options || ["Struggling", "Steady", "Strong", "Crushing It"]) : undefined })} style={{ background: q.type === val ? BRAND.gold : BRAND.panel, color: q.type === val ? "#000" : BRAND.muted, border: `1px solid ${q.type === val ? BRAND.gold : BRAND.line}`, borderRadius: 999, padding: "6px 12px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>{label}</button>
              ))}
            </div>
            {q.type === "choice" && (
              <input value={(q.options || []).join(", ")} onChange={(e) => updateQ(q.id, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Options, comma separated" style={inputStyle({ fontSize: 13 })} />
            )}
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input value={newQ} onChange={(e) => setNewQ(e.target.value)} placeholder="Add a question..." style={inputStyle()} onKeyDown={(e) => e.key === "Enter" && addQ()} />
          <Button variant="dark" onClick={addQ}>Add</Button>
        </div>
        <Button onClick={save} style={{ width: "100%", marginTop: 16 }}>Save Questions</Button>
      </Card>
    </div>
  );
}
function CheckInsTab({ client, updateClient, isCoach }) {
  const isMobile = useIsMobile(520);
  const [template, setTemplate] = useState(DEFAULT_CHECKIN_QUESTIONS);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(null);
  const submissions = client.checkIns || [];
  const lastSubmission = submissions[submissions.length - 1];
  const daysSinceLast = lastSubmission ? daysSince(lastSubmission.date) : null;
  const dueForCheckIn = daysSinceLast === null || daysSinceLast >= 7;
  useEffect(() => { loadCheckInTemplate(client.trainer_id).then((qs) => { setTemplate(qs); setLoadingTemplate(false); }); }, [client.trainer_id]);
  function setAnswer(id, v) { setAnswers((a) => ({ ...a, [id]: v })); }
  async function submit() {
    setSaving(true);
    const entry = { id: uid(), date: new Date().toISOString().slice(0, 10), answers: template.map((q) => ({ question: q.text, answer: answers[q.id] || "" })) };
    const next = [...submissions, entry];
    await upsertSection(client.id, "checkins", { submissions: next });
    updateClient({ ...client, checkIns: next });
    setAnswers({});
    setSaving(false);
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Card style={{ padding: isMobile ? 12 : 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 1000 }}>Weekly Check-in</div>
          {isCoach && <Button variant="dark" onClick={() => setShowEditor(true)}>Edit Questions</Button>}
        </div>
        <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 4 }}>{lastSubmission ? `Last check-in: ${lastSubmission.date} (${daysSinceLast} day${daysSinceLast === 1 ? "" : "s"} ago)` : "No check-ins submitted yet."}</div>
      </Card>
      {!isCoach && !loadingTemplate && (
        <Card style={{ padding: isMobile ? 12 : 16, border: dueForCheckIn ? `1px solid ${BRAND.gold}` : undefined }}>
          <div style={{ fontWeight: 1000, marginBottom: dueForCheckIn ? 4 : 0, color: dueForCheckIn ? BRAND.gold : BRAND.text }}>{dueForCheckIn ? "Your check-in is due" : "Check in early if you'd like"}</div>
          <div style={{ display: "grid", gap: 14, marginTop: 10 }}>
            {template.map((q) => (
              <div key={q.id}>
                <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>{q.text}</div>
                {q.type === "scale" && (
                  <div style={{ display: "flex", gap: 6 }}>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <button key={n} onClick={() => setAnswer(q.id, String(n))} style={{ flex: 1, height: 40, borderRadius: 10, border: `1px solid ${String(answers[q.id]) === String(n) ? BRAND.gold : BRAND.line}`, background: String(answers[q.id]) === String(n) ? BRAND.gold : BRAND.card2, color: String(answers[q.id]) === String(n) ? "#000" : BRAND.muted, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{n}</button>
                    ))}
                  </div>
                )}
                {q.type === "choice" && (
                  <div style={{ display: "flex", gap: 6 }}>
                    {(q.options || []).map((opt) => (
                      <button key={opt} onClick={() => setAnswer(q.id, opt)} style={{ flex: 1, textAlign: "center", padding: "11px 4px", borderRadius: 12, border: `1px solid ${answers[q.id] === opt ? BRAND.green : BRAND.line}`, background: answers[q.id] === opt ? BRAND.green : BRAND.card2, color: answers[q.id] === opt ? "#000" : BRAND.muted, fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", cursor: "pointer" }}>{opt}</button>
                    ))}
                  </div>
                )}
                {(!q.type || q.type === "text") && (
                  <textarea value={answers[q.id] || ""} onChange={(e) => setAnswer(q.id, e.target.value)} placeholder="Type your answer..." style={textareaStyle({ minHeight: 64 })} />
                )}
              </div>
            ))}
          </div>
          <Button onClick={submit} disabled={saving} style={{ marginTop: 12, width: "100%" }}>{saving ? "Submitting..." : "Submit Check-in"}</Button>
        </Card>
      )}
      <Card style={{ padding: isMobile ? 12 : 16 }}>
        <div style={{ fontSize: 16, fontWeight: 1000, marginBottom: 10 }}>History</div>
        {submissions.length === 0 && <div style={{ color: BRAND.muted }}>No check-ins yet.</div>}
        {[...submissions].reverse().map((s) => (
          <div key={s.id} onClick={() => setOpen(open === s.id ? null : s.id)} style={{ borderTop: `1px solid ${BRAND.line}`, paddingTop: 10, marginTop: 10, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><b>{s.date}</b><span style={{ color: BRAND.gold, fontSize: 12, fontWeight: 900 }}>{open === s.id ? "Hide" : "View"}</span></div>
            {open === s.id && <div style={{ marginTop: 8, display: "grid", gap: 6 }}>{s.answers.map((a, i) => <div key={i}><div style={{ color: BRAND.gold, fontSize: 12, fontWeight: 900 }}>{a.question}</div><div style={{ color: BRAND.text, fontSize: 13 }}>{a.answer || "-"}</div></div>)}</div>}
          </div>
        ))}
      </Card>
      {showEditor && <CheckInTemplateEditor trainerId={client.trainer_id} template={template} onSave={(qs) => { setTemplate(qs); setShowEditor(false); }} onClose={() => setShowEditor(false)} />}
    </div>
  );
}
function paymentStatus(client) {
  if (!client.paymentDueDate) return { label: "Not scheduled", color: BRAND.muted };
  if (client.paymentPaid) return { label: "Paid", color: BRAND.green };
  const d = daysUntil(client.paymentDueDate);
  if (d < 0) return { label: `Overdue by ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"}`, color: BRAND.red };
  if (d <= 2) return { label: d === 0 ? "Due today" : `Due in ${d} day${d === 1 ? "" : "s"}`, color: BRAND.red };
  if (d <= 5) return { label: `Due in ${d} days`, color: BRAND.gold };
  return { label: `Due ${client.paymentDueDate}`, color: BRAND.text };
}
function PaymentsTab({ client, updateClient, isCoach }) {
  const isMobile = useIsMobile(520);
  const [dueDate, setDueDate] = useState(client.paymentDueDate || "");
  const [saving, setSaving] = useState(false);
  const status = paymentStatus(client);
  async function persist(next) {
    await upsertSection(client.id, "profile", { ...client.profile, ...next });
    updateClient({ ...client, ...next, profile: { ...client.profile, ...next } });
  }
  async function saveDueDate() { setSaving(true); await persist({ paymentDueDate: dueDate, paymentPaid: false }); setSaving(false); }
  async function markPaid() { await persist({ paymentPaid: true }); }
  async function renew30() { const next = new Date(); next.setDate(next.getDate() + 30); const nextDate = next.toISOString().slice(0, 10); setDueDate(nextDate); await persist({ paymentDueDate: nextDate, paymentPaid: false }); }
  return (
    <Card style={{ padding: isMobile ? 12 : 16 }}>
      <div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 10 }}>Payments</div>
      <div style={{ background: BRAND.card2, border: `1px solid ${status.color}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <div style={{ color: status.color, fontWeight: 1000, fontSize: 18 }}>{status.label}</div>
        {client.paymentDueDate && <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 4 }}>Due date: {client.paymentDueDate}</div>}
      </div>
      {isCoach && <>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 8, marginBottom: 12 }}>
          <Field label="Payment due date" value={dueDate} onChange={setDueDate} type="date" />
          <Button onClick={saveDueDate} disabled={saving} style={{ alignSelf: "end" }}>{saving ? "Saving..." : "Set Due Date"}</Button>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="dark" onClick={markPaid}>Mark as Paid</Button>
          <Button variant="dark" onClick={renew30}>Mark Paid & Renew 30 Days</Button>
        </div>
        <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 12 }}>You'll get a reminder 5 days before, another 2 days before, and one if a payment goes overdue.</div>
      </>}
    </Card>
  );
}
function MessagesTab({ client, updateClient, isCoach }) {
  const isMobile = useIsMobile(520);
  const [messages, setMessages] = useState(client.messages || []);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  useEffect(() => {
    const unread = messages.filter((m) => (isCoach ? m.from === "client" : m.from === "coach") && !m.read);
    if (unread.length > 0) {
      const marked = messages.map((m) => (unread.some((u) => u.id === m.id) ? { ...m, read: true } : m));
      setMessages(marked);
      upsertSection(client.id, "messages", { list: marked });
      updateClient({ ...client, messages: marked });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function send() {
    if (!text.trim()) return;
    setSending(true);
    const entry = { id: uid(), from: isCoach ? "coach" : "client", text: text.trim(), date: new Date().toISOString(), read: false };
    const next = [...messages, entry];
    setMessages(next);
    setText("");
    await upsertSection(client.id, "messages", { list: next });
    updateClient({ ...client, messages: next });
    setSending(false);
  }
  return (
    <Card style={{ padding: isMobile ? 12 : 16, display: "flex", flexDirection: "column", height: isMobile ? "60vh" : "65vh" }}>
      <div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 10 }}>Messages</div>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 4 }}>
        {messages.length === 0 && <div style={{ color: BRAND.muted, textAlign: "center", marginTop: 30 }}>No messages yet. Say hello.</div>}
        {messages.map((m) => {
          const mine = (isCoach && m.from === "coach") || (!isCoach && m.from === "client");
          return (
            <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "80%" }}>
              <div style={{ background: mine ? client.color : BRAND.card2, color: mine ? "#000" : BRAND.text, borderRadius: 16, padding: "8px 12px", fontWeight: mine ? 800 : 600 }}>{m.text}</div>
              <div style={{ color: BRAND.muted, fontSize: 10, marginTop: 2, textAlign: mine ? "right" : "left" }}>{m.from === "coach" ? "Coach" : client.name} &middot; {new Date(m.date).toLocaleString()}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a message..." style={inputStyle()} />
        <Button onClick={send} disabled={sending}>Send</Button>
      </div>
    </Card>
  );
}
function ScheduleTab({ client, updateClient }) {
  const isMobile = useIsMobile(520);
  const [schedule, setSchedule] = useState(client.schedule || []);
  const [form, setForm] = useState({ day: "Mon", time: DEFAULT_TIME_SLOTS[0] });
  async function save(next) { setSchedule(next); await upsertSection(client.id, "sessions", { schedule: next, checkIns: client.legacyCheckIns || [], sessions: client.sessions || 0 }); updateClient({ ...client, schedule: next }); }
  return <Card style={{ padding: isMobile ? 12 : 16 }}><div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 1000, marginBottom: 12 }}>Recurring Schedule</div><div style={{ color: BRAND.muted, marginBottom: 12 }}>These recurring times automatically appear in the main Calendar.</div><div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr auto", gap: 8 }}><select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} style={inputStyle()}>{DAYS.map((d) => <option key={d}>{d}</option>)}</select><select value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} style={inputStyle()}>{DEFAULT_TIME_SLOTS.map((t, i) => <option key={`${t}_${i}`} value={t}>{timeLabel(t)}</option>)}</select><Button onClick={() => save([...schedule, { ...form, id: uid() }])}>Add</Button></div><div style={{ marginTop: 12 }}>{schedule.map((s, i) => <div key={s.id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${BRAND.line}`, padding: 10 }}><b>{s.day} · {timeLabel(s.time)}</b><Button variant="red" onClick={() => save(schedule.filter((_, j) => j !== i))}>x</Button></div>)}</div></Card>;
}
function InviteTab({ client, updateClient }) {
  const [code, setCode] = useState(client.inviteCode || makeInviteCode());
  async function saveInvite() { await updateClientRow(client.id, { invite_code: code, invite_status: "sent" }); updateClient({ ...client, inviteCode: code, inviteStatus: "sent" }); }
  const link = `${window.location.origin}?invite=${code}`;
  return <Card><div style={{ fontSize: 22, fontWeight: 1000 }}>Invite Client</div><div style={{ color: BRAND.muted, marginBottom: 12 }}>Client uses this code to claim the profile you created.</div><Field label="Invite Code" value={code} onChange={(v) => setCode(v.toUpperCase())} /><Button onClick={saveInvite} style={{ marginTop: 10 }}>Save Invite</Button><div style={{ marginTop: 12, color: BRAND.green, wordBreak: "break-all" }}>{link}</div></Card>;
}
function ClientWorkoutLog({ client, updateClient }) {
  const isMobile = useIsMobile(520);
  const [logs, setLogs] = useState(client.workoutLogs || []);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), workout: "", weights: "", cardio: "", rpe: "", notes: "" });
  async function add() { const next = [{ id: uid(), ...form }, ...logs]; setLogs(next); await upsertSection(client.id, "workoutLogs", next); updateClient({ ...client, workoutLogs: next }); setForm({ ...form, workout: "", weights: "", cardio: "", rpe: "", notes: "" }); }
  return <Card style={{ padding: isMobile ? 12 : 16 }}><div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 1000 }}>Workout Log</div><div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}><Field label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} /><Field label="Workout done" value={form.workout} onChange={(v) => setForm({ ...form, workout: v })} /><Field label="Weights / reps" value={form.weights} onChange={(v) => setForm({ ...form, weights: v })} /><Field label="Cardio" value={form.cardio} onChange={(v) => setForm({ ...form, cardio: v })} /><label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 }}>RPE</div><select value={form.rpe || ""} onChange={(e) => setForm({ ...form, rpe: e.target.value })} style={inputStyle()}>{RPE_OPTIONS.map((r) => <option key={r} value={r}>{r || "RPE"}</option>)}</select></label></div><Field label="Notes" textarea value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} /><Button onClick={add} style={{ marginTop: 10 }}>Log Workout</Button>{logs.map((l) => <div key={l.id} style={{ borderTop: `1px solid ${BRAND.line}`, marginTop: 12, paddingTop: 12 }}><b>{l.date} - {l.workout}</b><div style={{ color: BRAND.muted }}>{l.weights} · {l.cardio} · RPE {l.rpe}</div><div>{l.notes}</div></div>)}</Card>;
}
function PackagesTab({ client, updateClient }) {
  const isMobile = useIsMobile(520);
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
function Trials({ user, onConvert }) {
  const [trials, setTrials] = useState([]);
  const [tab, setTab] = useState("consultation");
  const [openTrial, setOpenTrial] = useState(null);
  const [converting, setConverting] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", goal: "", fitnessHistory: "", barriers: "", injuries: "", medicalIssues: "", nutrition: "", sleep: "", neat: "", fatLossImportance: "", muscleGainImportance: "", strengthEnduranceImportance: "", mobilityFlexibilityImportance: "", assessmentDate: "", cardiovascular: "", squat: "", pushStrength: "", pullStrength: "", coreStrength: "", flexibilityFitness: "" });
  useEffect(() => { load(); }, []);
  async function load() { const uidVal = user?.id || (await supabase.auth.getUser()).data.user?.id; const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", uidVal).eq("section", "trials").maybeSingle(); setTrials(data?.data?.trials || []); }
  async function save(next) { setTrials(next); const uidVal = user?.id || (await supabase.auth.getUser()).data.user?.id; await upsertTrainerData(uidVal, "trials", { trials: next }); }
  function set(k, v) { setForm({ ...form, [k]: v }); }
  function saveTrial() { const saved = { id: form.id || uid(), ...form, savedAt: new Date().toISOString() }; save([saved, ...trials.filter((t) => t.id !== saved.id)]); setForm({ name: "", phone: "", email: "", goal: "", fitnessHistory: "", barriers: "", injuries: "", medicalIssues: "", nutrition: "", sleep: "", neat: "", fatLossImportance: "", muscleGainImportance: "", strengthEnduranceImportance: "", mobilityFlexibilityImportance: "", assessmentDate: "", cardiovascular: "", squat: "", pushStrength: "", pullStrength: "", coreStrength: "", flexibilityFitness: "" }); }
  async function convertToClient(trial) {
    if (!onConvert) return;
    if (!confirm(`Convert ${trial.name} to a paying client? A client profile will be created with their trial details attached.`)) return;
    setConverting(true);
    const clientId = await onConvert(trial);
    setConverting(false);
    if (clientId) save(trials.map((t) => (t.id === trial.id ? { ...t, convertedClientId: clientId, convertedAt: new Date().toISOString() } : t)));
  }
  return <div style={{ display: "grid", gap: 14 }}><Card><div style={{ fontSize: 24, fontWeight: 1000, color: BRAND.gold }}>Trials</div><div style={{ display: "flex", gap: 8, margin: "12px 0" }}><Button variant={tab === "consultation" ? "gold" : "dark"} onClick={() => setTab("consultation")}>Consultation</Button><Button variant={tab === "assessment" ? "gold" : "dark"} onClick={() => setTab("assessment")}>Fitness Assessment</Button></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}><Field label="Name" value={form.name} onChange={(v) => set("name", v)} /><Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} /><Field label="Email" value={form.email} onChange={(v) => set("email", v)} />{tab === "consultation" ? <><Field label="Goal" value={form.goal} onChange={(v) => set("goal", v)} textarea /><Field label="Fitness history" value={form.fitnessHistory} onChange={(v) => set("fitnessHistory", v)} textarea /><Field label="Barriers" value={form.barriers} onChange={(v) => set("barriers", v)} textarea /><Field label="Injuries" value={form.injuries} onChange={(v) => set("injuries", v)} textarea /><Field label="Medical issues" value={form.medicalIssues} onChange={(v) => set("medicalIssues", v)} textarea /><Field label="Nutrition" value={form.nutrition} onChange={(v) => set("nutrition", v)} textarea /><Field label="Sleep" value={form.sleep} onChange={(v) => set("sleep", v)} textarea /><Field label="NEAT / daily activity" value={form.neat} onChange={(v) => set("neat", v)} textarea /><div style={{ gridColumn: "1 / -1", color: BRAND.gold, fontWeight: 1000, marginTop: 8 }}>On a scale of 1-5, rate how important these are to the client:</div><RatingSelect label="Fat loss" value={form.fatLossImportance} onChange={(v) => set("fatLossImportance", v)} /><RatingSelect label="Muscle gain" value={form.muscleGainImportance} onChange={(v) => set("muscleGainImportance", v)} /><RatingSelect label="Strength and endurance" value={form.strengthEnduranceImportance} onChange={(v) => set("strengthEnduranceImportance", v)} /><RatingSelect label="Mobility & flexibility" value={form.mobilityFlexibilityImportance} onChange={(v) => set("mobilityFlexibilityImportance", v)} /></> : <><Field label="Date" type="date" value={form.assessmentDate} onChange={(v) => set("assessmentDate", v)} /><Field label="Cardiovascular fitness" value={form.cardiovascular} onChange={(v) => set("cardiovascular", v)} /><Field label="Squat" value={form.squat} onChange={(v) => set("squat", v)} /><Field label="Push strength" value={form.pushStrength} onChange={(v) => set("pushStrength", v)} /><Field label="Pull strength" value={form.pullStrength} onChange={(v) => set("pullStrength", v)} /><Field label="Core strength" value={form.coreStrength} onChange={(v) => set("coreStrength", v)} /><Field label="Flexibility fitness" value={form.flexibilityFitness} onChange={(v) => set("flexibilityFitness", v)} /></>}</div><Button onClick={saveTrial} style={{ marginTop: 12 }}>Save Trial</Button></Card><Card><div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 10 }}>Saved Trials</div>{trials.length === 0 && <div style={{ color: BRAND.muted }}>No saved trials yet.</div>}{trials.map((t) => <div key={t.id} onClick={() => setOpenTrial(t)} style={{ borderTop: `1px solid ${BRAND.line}`, paddingTop: 12, marginTop: 12, cursor: "pointer" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><b>{t.name}</b>{t.convertedClientId && <span style={{ background: BRAND.green, color: "#000", fontSize: 10, fontWeight: 1000, borderRadius: 999, padding: "2px 8px" }}>CLIENT</span>}</div><div style={{ color: BRAND.muted }}>{t.phone} · {t.email}</div><div style={{ color: BRAND.gold, fontSize: 12, fontWeight: 900 }}>Tap to open</div></div>)}</Card>{openTrial && <div style={modalBackdrop()}><Card style={{ width: "100%", maxWidth: 760, maxHeight: "90vh", overflow: "auto" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 12 }}><div><div style={{ fontSize: 24, fontWeight: 1000 }}>{openTrial.name}</div><div style={{ color: BRAND.muted }}>{openTrial.phone} · {openTrial.email}</div></div><Button variant="ghost" onClick={() => setOpenTrial(null)}>X</Button></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>{Object.entries(openTrial).filter(([k]) => !["id","savedAt"].includes(k)).map(([k,v]) => <Mini key={k} label={k.replace(/([A-Z])/g, " $1")} value={String(v || "-")} />)}</div>{openTrial.convertedClientId ? <div style={{ background: `${BRAND.green}18`, border: `1px solid ${BRAND.green}`, borderRadius: 12, padding: 10, marginTop: 12, color: BRAND.green, fontWeight: 800, fontSize: 13 }}>Converted to a client on {String(openTrial.convertedAt || "").slice(0, 10)}.</div> : null}<div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>{!openTrial.convertedClientId && <Button onClick={() => convertToClient(openTrial)} disabled={converting} style={{ flex: 1 }}>{converting ? "Converting..." : "Convert to Client (client has paid)"}</Button>}<Button variant="dark" disabled={pdfBusy} onClick={async () => { setPdfBusy(true); const { blob, filename } = await downloadTrialPDF(openTrial); downloadBlob(blob, filename); setPdfBusy(false); }}>{pdfBusy ? "..." : "Download PDF"}</Button>{typeof navigator !== "undefined" && navigator.share && <Button variant="dark" disabled={pdfBusy} onClick={async () => { setPdfBusy(true); const { blob, filename } = await downloadTrialPDF(openTrial); await sharePdfBlob(blob, filename, openTrial.name); setPdfBusy(false); }}>Share</Button>}<Button variant="dark" onClick={() => { setForm(openTrial); setOpenTrial(null); }}>Edit</Button><Button variant="red" onClick={() => { save(trials.filter((x) => x.id !== openTrial.id)); setOpenTrial(null); }}>Delete</Button></div></Card></div>}</div>;
}
export default function App() {
  const isMobile = useIsMobile(520);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trainer, setTrainer] = useState(null);
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [clientPortal, setClientPortal] = useState(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [accountNotActive, setAccountNotActive] = useState(false);
  const [syncStatus, setSyncStatus] = useState(typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline");
  useEffect(() => {
    ensureMobileViewport();
    const goOnline = async () => { setSyncStatus("syncing"); await flushSyncQueue(); setSyncStatus("online"); };
    const goOffline = () => setSyncStatus("offline");
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const retryTimer = setInterval(async () => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        const queued = readJson(FORGE_SYNC_QUEUE_KEY, []);
        if (queued.length) await flushSyncQueue();
      }
    }, 20000);
    // Supabase's password-reset email can arrive as a PKCE "?code=" link (needs an explicit
    // exchange) or the older "#access_token=...&type=recovery" hash link. Handle both so the
    // link actually lands somewhere instead of failing to load.
    const url = new URL(window.location.href);
    const hasRecoveryCode = url.searchParams.get("type") === "recovery" && url.searchParams.get("code");
    const hasRecoveryHash = window.location.hash.includes("type=recovery");
    if (hasRecoveryCode) {
      setRecoveryMode(true);
      supabase.auth.exchangeCodeForSession(url.searchParams.get("code")).then(({ data }) => { if (data?.session) setSession(data.session); setLoading(false); });
    } else if (hasRecoveryHash) {
      setRecoveryMode(true);
    } else {
      supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (data.session) boot(data.session.user); else setLoading(false); });
    }
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (_event === "PASSWORD_RECOVERY") { setRecoveryMode(true); setLoading(false); return; }
      if (_event === "TOKEN_REFRESHED" || _event === "USER_UPDATED") return; // session stayed the same, just the token renewed - don't reload data mid-session
      if (recoveryMode) return; // don't auto-boot into the dashboard while someone is mid-way through setting a new password
      if (sess) boot(sess.user);
      else { setLoading(false); setTrainer(null); setClients([]); setClientPortal(null); }
    });
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); clearInterval(retryTimer); sub.subscription.unsubscribe(); };
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
      const hasPendingEdits = readJson(FORGE_SYNC_QUEUE_KEY, []).some((item) => item.clientId === clientMatch.id);
      setClientPortal((prev) => {
        const next = hasPendingEdits && prev?.id === mappedClient.id ? prev : mappedClient;
        saveForgeCache(user.id, { trainer: null, clients: [], clientPortal: next });
        return next;
      });
      setSelected(null); setClients([]);
      return;
    }
    if ((user.email || "").toLowerCase() !== DENIS_EMAIL) {
      // Not the coach, and no client profile found (deleted, or never existed) - never fall through to the coach dashboard.
      await supabase.auth.signOut();
      setSession(null); setTrainer(null); setClients([]); setClientPortal(null);
      setAccountNotActive(true);
      setLoading(false);
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
    if (error) { console.error(error); return; }
    const ids = (clientRows || []).map((c) => c.id);
    let dataRows = [];
    if (ids.length) {
      // Photos are fetched lazily per-client when their Photos tab is opened (see TransformPhotos) -
      // excluding them here is what keeps a 16-client sync fast instead of downloading every photo up front.
      const { data } = await supabase.from("client_data").select("*").in("client_id", ids).neq("section", "transformPhotos");
      dataRows = data || [];
    }
    const mapped = (clientRows || []).map((r, i) => mapClient(r, dataRows, i));
    const pendingIds = new Set(readJson(FORGE_SYNC_QUEUE_KEY, []).map((item) => item.clientId).filter(Boolean));
    setClients((prev) => {
      const prevById = new Map(prev.map((c) => [c.id, c]));
      // A client with edits still waiting to sync is newer than what we just fetched - keep the local version so we never silently revert unsaved work.
      return mapped.map((c) => (pendingIds.has(c.id) && prevById.has(c.id) ? prevById.get(c.id) : c));
    });
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
  return <>
    <style>{GLOBAL_TEXT_CSS}</style>
    {accountNotActive ? <AccountNotActiveScreen onBackToLogin={() => setAccountNotActive(false)} />
    : recoveryMode ? <ResetPasswordScreen onDone={() => setRecoveryMode(false)} />
    : loading ? <div style={{ minHeight: "100vh", background: BRAND.bg, display: "grid", placeItems: "center" }}><div style={{ textAlign: "center" }}><div style={{ color: BRAND.gold, fontSize: isMobile ? 40 : 54, fontWeight: 900, letterSpacing: 1, lineHeight: 1 }}>FORGE</div><div style={{ color: BRAND.muted, fontSize: isMobile ? 13 : 15, fontWeight: 700, letterSpacing: 3, marginTop: 6 }}>COACH</div></div></div>
    : !session ? <LoginScreen onReady={() => supabase.auth.getSession().then(({ data }) => data.session && boot(data.session.user))} />
    : clientPortal ? <ClientView client={clientPortal} updateClient={updateClient} isCoach={false} refresh={() => boot(session.user)} />
    : selected ? <ClientView client={selected} updateClient={updateClient} back={() => setSelected(null)} refresh={() => loadCoach(session.user)} isCoach />
    : <CoachDashboard user={session.user} trainer={trainer} setTrainer={setTrainer} clients={clients} setClients={setClients} selectClient={setSelected} refresh={() => loadCoach(session.user)} syncStatus={syncStatus} />}
  </>;
}
