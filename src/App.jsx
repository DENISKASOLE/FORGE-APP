import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { BRAND, GLOBAL_TEXT_CSS } from "./theme/tokens.js";
import { Button } from "./components/ui/Button.jsx";
import { Card } from "./components/ui/Card.jsx";
import { Field, inputStyle, textareaStyle } from "./components/ui/Field.jsx";
import { modalBackdrop } from "./components/ui/modal.js";
import { NavIcon } from "./components/ui/NavIcon.jsx";
import { CoachIcon } from "./components/ui/CoachIcon.jsx";
import { uid } from "./lib/uid.js";
import { DAYS, startOfWeek, addDays, isoDate, weekKey, weekRangeLabel, weekDays } from "./lib/dateUtils.js";
import { FORGE_SYNC_QUEUE_KEY, readJson, writeJson, saveForgeCache, readForgeCache, enqueueSync, flushSyncQueue, updateClientRow } from "./lib/cache.js";
import { DENIS_EMAIL, DEFAULT_TIME_SLOTS, RPE_OPTIONS, PHOTO_TYPES, WATER_LITERS, SLEEP_HOURS, MEASUREMENT_FIELDS, TIMED_EXERCISES, GOAL_OPTIONS, CLIENT_TYPES, DEFAULT_CHECKIN_QUESTIONS, CLIENT_COLORS, LIFT_FIELDS, DEFAULT_INTAKE_QUESTIONS } from "./lib/constants.js";
import { isTimedExercise, readFileAsDataUrl, ensureMobileViewport, useIsMobile, normalizeSlotLabel, timeKey, normalizeSlots } from "./lib/browser.js";
import { ageFromBirthday, daysUntil, nextBirthdayDaysAway, daysSince, initials, getClientColor, normalizeGoals, normalizeInjuries, timeLabel, moneyAED, makeInviteCode, emptyProfile, emptyNutrition, mapClient, upsertSection, upsertTrainerData, loadTrainerTemplates, safeSelect } from "./lib/clientData.js";
import { buildPdfDoc, downloadBlob, sharePdfBlob, safeFilename } from "./lib/pdf.js";
import { AccountNotActiveScreen } from "./features/auth/AccountNotActiveScreen.jsx";
import { ResetPasswordScreen } from "./features/auth/ResetPasswordScreen.jsx";
import { LoginScreen } from "./features/auth/LoginScreen.jsx";
import { CheckInsTab } from "./features/checkin/CheckInsTab.jsx";
import { Mini } from "./components/ui/Mini.jsx";
import { MessagesTab } from "./features/messages/MessagesTab.jsx";
import { ScheduleTab, InviteTab } from "./features/scheduling/ScheduleTab.jsx";
import { PackagesTab } from "./features/scheduling/PackagesTab.jsx";
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
function autoBookingsFor(clients, weekStart) {
  const days = weekDays(weekStart);
  const currentWeekKey = weekKey(weekStart);
  return clients.flatMap((c) => (c.schedule || []).map((s) => {
    const foundDay = days.find((d) => d.name === s.day);
    return { id: `auto_${currentWeekKey}_${c.id}_${s.day}_${s.time}`, weekKey: currentWeekKey, date: foundDay?.date || "", day: s.day, time: s.time, title: c.name, type: "Client Session", color: c.color, auto: true, clientId: c.id };
  }));
}
async function countTodaysCalendarSessions(clients, trainerId) {
  const todayISO = isoDate(new Date());
  const weekStart = startOfWeek(new Date());
  const currentWeekKey = weekKey(weekStart);
  const auto = autoBookingsFor(clients, weekStart);
  let saved = [];
  if (trainerId) {
    const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", trainerId).eq("section", "calendar").maybeSingle();
    saved = data?.data?.bookings || [];
  }
  const all = [...auto, ...saved.filter((b) => b.weekKey === currentWeekKey || b.date === todayISO)];
  return all.filter((b) => b.date === todayISO).length;
}
async function loadTodaysAgenda(clients, trainerId) {
  const todayISO = isoDate(new Date());
  const weekStart = startOfWeek(new Date());
  const currentWeekKey = weekKey(weekStart);
  const auto = autoBookingsFor(clients, weekStart);
  let saved = [];
  if (trainerId) {
    const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", trainerId).eq("section", "calendar").maybeSingle();
    saved = data?.data?.bookings || [];
  }
  const all = [...auto, ...saved.filter((b) => b.weekKey === currentWeekKey || b.date === todayISO)];
  const sessions = all.filter((b) => b.date === todayISO)
    .map((b) => {
      const client = clients.find((c) => c.id === b.clientId);
      const hasInjury = !!(client?.profile?.injuries || "").trim() && !/^none\b|^no\b|^n\/a$/i.test((client?.profile?.injuries || "").trim());
      return { ...b, hasInjury, injuryNote: hasInjury ? client.profile.injuries : "" };
    })
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  const checkInsDue = clients.filter((c) => {
    const submissions = c.checkIns || [];
    const last = submissions[submissions.length - 1];
    const daysSinceLast = last ? daysSince(last.date) : null;
    return daysSinceLast === null || daysSinceLast >= 7;
  });

  const paymentsDue = clients.filter((c) => c.clientType === "Online" && ["overdue", "due"].some((k) => (paymentStatus(c).label || "").toLowerCase().includes(k)));

  return { sessions, checkInsDue, paymentsDue };
}
// ================= PROGRAM SYSTEM (V2 — fresh design) =================
// Model: Program { weeks: [{ workouts: [{ blocks: [{ exercises: [{ sets: [] }] }] }] }] }
// Logs are separate from the program so editing a program never touches history.

function newSet() { return { id: uid(), targetReps: "", targetLoad: "", targetRpe: "" }; }
function newExercise(name = "") {
  return { id: uid(), name, loadType: "kg", tempo: "", rest: "", note: "", videoUrl: DEFAULT_EXERCISE_VIDEOS[name] || "", sets: [newSet(), newSet(), newSet()] };
}
function newBlock(type = "straight") { return { id: uid(), type, rounds: type === "circuit" ? 3 : 1, exercises: [] }; }
function newWorkout(name = "Workout") { return { id: uid(), name, note: "", blocks: [], dayOfWeek: null }; }
function newProgWeek(n = 1) { return { id: uid(), weekNum: n, label: "", focus: "", targetRpe: "", workouts: [], restDays: {} }; }
function newProgram(name = "New Program", goal = "General Fitness", weeksCount = 4) {
  return { version: 2, id: uid(), name, goal, startDate: isoDate(), weeks: Array.from({ length: weeksCount }, (_, i) => newProgWeek(i + 1)) };
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
// ---------- Program calendar: day allocation + rest days ----------
// A program day is derived from the program's start date, so the calendar and
// the adherence numbers always agree. Any day without a workout is a rest day.
const DOW_LETTER = ["M", "T", "W", "T", "F", "S", "S"];
const DOW_LABEL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function programStart(program) {
  const raw = program?.startDate;
  const d = raw ? new Date(`${raw}T00:00:00`) : new Date();
  const valid = isNaN(d.getTime()) ? new Date() : d;
  return startOfWeek(valid);
}
function dayDate(program, weekNum, dow) {
  return addDays(programStart(program), (weekNum - 1) * 7 + (dow - 1));
}
function restNoteFor(week, dow) { return week?.restDays?.[dow] || ""; }
// Programs built before day allocation existed have no dayOfWeek on their workouts.
// Rather than have those weeks render as seven rest days, lay the workouts out
// Mon, Tue, Wed... in order. Nothing disappears, and the coach can move them after.
function weekDayMap(week) {
  const map = {};
  const spare = [];
  (week?.workouts || []).forEach((w) => {
    const dow = Number(w.dayOfWeek);
    if (dow >= 1 && dow <= 7 && !map[dow]) map[dow] = w;
    else spare.push(w);
  });
  let cursor = 1;
  spare.forEach((w) => {
    while (cursor <= 7 && map[cursor]) cursor += 1;
    if (cursor <= 7) map[cursor] = w;
  });
  return map;
}
function workoutForDay(week, dow) { return weekDayMap(week)[dow] || null; }
function unassignedWorkouts(week) { return (week?.workouts || []).filter((w) => !w.dayOfWeek); }
// Writes the implied layout back onto the workouts, so what the builder shows is
// exactly what gets saved.
function normalizeProgramDays(program) {
  if (!program?.weeks) return program;
  return {
    ...program,
    startDate: program.startDate || isoDate(),
    weeks: program.weeks.map((week) => {
      const map = weekDayMap(week);
      const dowOf = {};
      Object.entries(map).forEach(([dow, w]) => { dowOf[w.id] = Number(dow); });
      return {
        ...week,
        restDays: week.restDays || {},
        workouts: (week.workouts || []).map((w) => ({ ...w, dayOfWeek: dowOf[w.id] ?? null })),
      };
    }),
  };
}
function buildProgramDays(program, logs) {
  if (!program?.weeks?.length) return [];
  const todayISO = isoDate(new Date());
  const out = [];
  program.weeks.forEach((week) => {
    for (let dow = 1; dow <= 7; dow++) {
      const date = dayDate(program, week.weekNum, dow);
      const dateISO = isoDate(date);
      const workout = workoutForDay(week, dow);
      const session = workout ? sessionForWorkout(logs, week.id, workout.id) : null;
      let state;
      if (!workout) state = "rest";
      else if (session?.status === "completed") state = "completed";
      else if (dateISO === todayISO) state = "today";
      else if (session?.status === "in_progress") state = "in_progress";
      else if (dateISO < todayISO) state = "missed";
      else state = "scheduled";
      out.push({
        key: `${week.id}_${dow}`, week, weekNum: week.weekNum, dow,
        date, dateISO, workout, session,
        isRest: !workout, note: restNoteFor(week, dow), state,
      });
    }
  });
  return out;
}
function currentProgramWeek(program) {
  if (!program?.weeks?.length) return 1;
  const diff = Math.floor((new Date(`${isoDate(new Date())}T00:00:00`) - new Date(`${isoDate(programStart(program))}T00:00:00`)) / 86400000);
  return Math.min(Math.max(1, Math.floor(diff / 7) + 1), program.weeks.length);
}
function exerciseCountOf(workout) {
  return (workout?.blocks || []).reduce((n, b) => n + (b.exercises?.length || 0), 0);
}
function findPrescribedExercise(workout, entry) {
  for (const b of workout?.blocks || []) {
    for (const ex of b.exercises || []) {
      if (ex.id === entry.exerciseId) return ex;
    }
  }
  return null;
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
  if (yt) return { thumb: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`, watchUrl: `https://www.youtube.com/watch?v=${yt[1]}`, videoId: yt[1] };
  return null;
}
// Short (mostly under a minute), verified proper-form demonstrations for the exercises actually in use across client programs.
const DEFAULT_EXERCISE_VIDEOS = {
  "Back Squat": "https://www.youtube.com/watch?v=5MXoGtPBz-I",
  "Barbell Bench Press": "https://www.youtube.com/shorts/hWbUlkb5Ms4",
  "Barbell Curl": "https://www.youtube.com/shorts/dIAxyJimXnA",
  "Barbell Row": "https://www.youtube.com/shorts/Nqh7q3zDCoQ",
  "Deadlift": "https://www.youtube.com/shorts/8np3vKDBJfc",
  "Dumbbell Row": "https://www.youtube.com/shorts/H8jf3DwlIlo",
  "Goblet Squat": "https://www.youtube.com/shorts/wjkoL-CagYE",
  "Incline DB Press": "https://www.youtube.com/shorts/8fXfwG4ftaQ",
  "Kettlebell Swing": "https://www.youtube.com/shorts/aSYap2yhW8s",
  "Leg Press": "https://www.youtube.com/shorts/nDh_BlnLCGc",
  "Overhead Press": "https://www.youtube.com/shorts/zoN5EH50Dro",
  "Plank": "https://www.youtube.com/shorts/hoeNgjheDHk",
  "Pull-Up": "https://www.youtube.com/shorts/ZPG8OsHKXLw",
  "Push-Up": "https://www.youtube.com/shorts/zUymek3A64A",
  "Romanian Deadlift": "https://www.youtube.com/shorts/8tm3JW1UpAs",
  "Triceps Pushdown": "https://www.youtube.com/shorts/leazgWMaSo8",
  "Lat Pulldown": "https://www.youtube.com/shorts/bNmvKpJSWKM",
  "Seated Leg Curl": "https://www.youtube.com/shorts/EnZZIaPCb8k",
  "Leg Extension": "https://www.youtube.com/shorts/iQ92TuvBqRo",
  "DB Lateral Raises": "https://www.youtube.com/shorts/Kl3LEzQ5Zqs",
  "Barbell Hip Thrust": "https://www.youtube.com/shorts/CcwyvfJcoeA",
  "Face Pull": "https://www.youtube.com/shorts/7kXfVIwmfwE",
  "Dumbbell Lunge": "https://www.youtube.com/watch?v=K5NhC44yuR8",
  "V-Squat": "https://www.youtube.com/shorts/OqSs_szse5U",
  "Split Squat": "https://www.youtube.com/shorts/iUOoNilQWEs",
  "Box Squat": "https://www.youtube.com/shorts/bcATXo7c6yU",
  "Dead Hang": "https://www.youtube.com/shorts/dOCQjaasbGs",
  "Chest-Supported Row": "https://www.youtube.com/shorts/09wri23R4SU",
  "Pec Deck Fly": "https://www.youtube.com/shorts/CRroep849bU",
  "Step-Up": "https://www.youtube.com/shorts/-D8rH8OGt4E",
  "Step Down": "https://www.youtube.com/shorts/qE-Azuf7XPE",
  "SkiErg": "https://www.youtube.com/shorts/3Qfhi3WXjbA",
  "Sled Push": "https://www.youtube.com/shorts/KkGWazCx93A",
  "Sled Pull": "https://www.youtube.com/shorts/o2JhIsqispo",
  "Assisted Pull-Up": "https://www.youtube.com/shorts/Nqy1rtyVH2o",
  "Lying Leg Curl": "https://www.youtube.com/shorts/bgfHeL6eR9Q",
  "Hip Abduction Machine": "https://www.youtube.com/shorts/Z6Aq5upUp4A",
  "Standing Calf Raise": "https://www.youtube.com/shorts/B30JglFGx8Y",
  "Machine Ab Crunch": "https://www.youtube.com/shorts/2lSf2F7RUAU",
  "Farmers Carry": "https://www.youtube.com/shorts/8RXTKE06mKc",
  "Farmer's Carry": "https://www.youtube.com/shorts/8RXTKE06mKc",
  "Walking Lunge": "https://www.youtube.com/shorts/5eQd_hsXESI",
  "Incline DB Chest Press": "https://www.youtube.com/shorts/8fXfwG4ftaQ",
  "Flat Barbell Bench Press": "https://www.youtube.com/shorts/hWbUlkb5Ms4",
  "Neutral Grip Lat Pulldown": "https://www.youtube.com/shorts/bNmvKpJSWKM",
  "Incline DB Shoulder Press": "https://www.youtube.com/shorts/k6tzKisR3NY",
  "Incline Shoulder DB Press": "https://www.youtube.com/shorts/k6tzKisR3NY",
  "Hip Thrust": "https://www.youtube.com/shorts/CcwyvfJcoeA",
  "Smith Machine Hip Thrust": "https://www.youtube.com/shorts/CcwyvfJcoeA",
  "Single-Leg Hip Thrust": "https://www.youtube.com/shorts/CcwyvfJcoeA",
  "Machine Hip Thrust": "https://www.youtube.com/shorts/CcwyvfJcoeA",
  "Cable Glute Kickback": "https://www.youtube.com/shorts/n-cgsNePyFo",
  "Machine Glute Kickback": "https://www.youtube.com/shorts/n-cgsNePyFo",
  "Cable Kickback": "https://www.youtube.com/shorts/n-cgsNePyFo",
  "Kickback Machine": "https://www.youtube.com/shorts/n-cgsNePyFo",
  "45-Degree Back Extension": "https://www.youtube.com/shorts/VH4Bqn1FUhM",
  "45 Degree Glute Extension": "https://www.youtube.com/shorts/VH4Bqn1FUhM",
  "Back Extension": "https://www.youtube.com/shorts/VH4Bqn1FUhM",
  "Machine Back Extension": "https://www.youtube.com/shorts/VH4Bqn1FUhM",
};
function VideoPlayerModal({ videoId, title, onClose }) {
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 420, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{title}</div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${BRAND.line}`, aspectRatio: "16/9", background: "#000" }}>
          <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${videoId}?autoplay=1`} title={title} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
        <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 600, marginTop: 10, textAlign: "center" }}>Form demonstration</div>
      </Card>
    </div>
  );
}
function emptyTrainingLogs() { return { version: 2, sessions: [] }; }
function startSession(program, week, workout) {
  return {
    id: uid(), programId: program.id, programName: program.name, weekId: week.id, weekNum: week.weekNum,
    workoutId: workout.id, workoutName: workout.name, date: isoDate(),
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
function suggestProgression(lastSets) {
  if (!lastSets || lastSets.length === 0) return null;
  const completed = lastSets.filter((s) => s.done);
  if (completed.length === 0 || completed.length < lastSets.length) return null; // didn't finish every set last time - don't push more
  const rpes = completed.map((s) => Number(s.rpe)).filter((n) => !isNaN(n) && n > 0);
  if (rpes.length < completed.length) return null; // missing RPE data - not enough to go on
  const avgRpe = rpes.reduce((a, b) => a + b, 0) / rpes.length;
  if (avgRpe > 7.5) return null; // was already hard - hold, don't add load
  const loads = completed.map((s) => Number(s.load)).filter((n) => !isNaN(n) && n > 0);
  if (loads.length < completed.length) return null; // bodyweight/time-based - no load to bump
  const avgLoad = loads.reduce((a, b) => a + b, 0) / loads.length;
  const bump = avgLoad >= 60 ? 5 : avgLoad >= 30 ? 2.5 : avgLoad >= 10 ? 1.25 : 0.5;
  return { bump, avgRpe: Math.round(avgRpe * 10) / 10 };
}
function lastSessionSetsFor(logs, exerciseName) {
  const name = String(exerciseName || "").toLowerCase();
  const sessions = [...(logs?.sessions || [])].filter((s) => s.status === "completed" && s.date).sort((a, b) => a.date.localeCompare(b.date));
  for (let i = sessions.length - 1; i >= 0; i--) {
    const entry = (sessions[i].entries || []).find((e) => String(e.substitutedName || e.name || "").toLowerCase() === name);
    if (entry && entry.sets?.length) return entry.sets;
  }
  return [];
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
async function downloadProgramPDF2(client, program) {
  if (!program) return;
  const sections = (program.weeks || []).map((w) => ({
    heading: `Week ${w.weekNum}${w.label ? ` — ${w.label}` : ""}${w.focus ? `  ·  ${w.focus}` : ""}${w.targetRpe ? `  ·  Target RPE ${w.targetRpe}` : ""}`,
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
    { heading: `Assessment${trial.assessmentDate ? ` — ${trial.assessmentDate}` : ""}`, lines: [{ label: "Cardiovascular", value: trial.cardiovascular }, { label: "Squat", value: trial.squat }, { label: "Push strength", value: trial.pushStrength }, { label: "Pull strength", value: trial.pullStrength }, { label: "Core strength", value: trial.coreStrength }, { label: "Flexibility", value: trial.flexibilityFitness }] },
  ];
  const subtitle = `Trial consultation${trial.savedAt ? `  ·  ${String(trial.savedAt).slice(0, 10)}` : ""}`;
  const blob = await buildPdfDoc(trial.name || "Trial", subtitle, sections);
  return { blob, filename: `${safeFilename(trial.name)}_trial.pdf` };
}

// ---------- Coach: Block editor ----------
function ExerciseLibraryScreen({ trainerId, onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => { loadExerciseLibraryData(trainerId).then((data) => { setItems(data); setLoading(false); }); }, [trainerId]);

  async function persist(next) {
    setItems(next);
    await upsertTrainerData(trainerId, "custom_exercise_library", { items: next });
  }
  async function saveItem(form) {
    if (editingItem) await persist(items.map((it) => (it.id === editingItem.id ? { ...it, ...form } : it)));
    else await persist([{ id: uid(), ...form }, ...items]);
    setShowAdd(false); setEditingItem(null);
  }
  async function remove(id) { await persist(items.filter((it) => it.id !== id)); }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Button variant="ghost" onClick={onBack} style={{ padding: "8px 14px" }}>‹ Back</Button>
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 900 }}>Exercise Library</div>
        <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginTop: 3 }}>Add your own exercises with a video link, so they're ready to pick - with the video attached - whenever you're building a program.</div>
      </div>
      <Button onClick={() => { setEditingItem(null); setShowAdd(true); }} style={{ width: "100%" }}>+ Add Exercise</Button>

      {loading ? (
        <Card><div style={{ color: BRAND.muted }}>Loading...</div></Card>
      ) : items.length === 0 ? (
        <Card><div style={{ color: BRAND.muted }}>No custom exercises yet. Add your first one above.</div></Card>
      ) : (
        items.map((it) => {
          const t = getVideoThumb(it.videoUrl);
          return (
            <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 12, background: BRAND.card, border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 12 }}>
              {t ? <img src={t.thumb} alt="Exercise video" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} /> : <div style={{ width: 52, height: 52, borderRadius: 10, background: BRAND.card2, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{it.name}</div>
                <div style={{ color: it.videoUrl ? BRAND.cyan : BRAND.dim, fontSize: 11, fontWeight: 700 }}>{it.videoUrl ? "Video attached" : "No video"}</div>
              </div>
              <button onClick={() => { setEditingItem(it); setShowAdd(true); }} style={{ background: "transparent", border: "none", color: BRAND.gold, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Edit</button>
              <button onClick={() => remove(it.id)} style={{ background: "transparent", border: "none", color: BRAND.red, fontWeight: 900, fontSize: 15, cursor: "pointer" }}>x</button>
            </div>
          );
        })
      )}
      {showAdd && <AddCustomExerciseModal initial={editingItem} onClose={() => { setShowAdd(false); setEditingItem(null); }} onSave={saveItem} />}
    </div>
  );
}
function AddCustomExerciseModal({ initial, onClose, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl || "");
  const [saving, setSaving] = useState(false);
  const thumb = getVideoThumb(videoUrl);
  async function save() {
    if (!name.trim()) { alert("Give this exercise a name."); return; }
    setSaving(true);
    await onSave({ name: name.trim(), videoUrl: videoUrl.trim() });
    setSaving(false);
  }
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 1000 }}>{initial ? "Edit Exercise" : "New Exercise"}</div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <Field label="Exercise name" value={name} onChange={setName} placeholder="e.g. Cable Crossover" />
        <div style={{ marginTop: 10 }}><Field label="Video link" value={videoUrl} onChange={setVideoUrl} placeholder="https://..." /></div>
        {thumb && <img src={thumb.thumb} alt="Exercise video" style={{ width: 160, height: 90, objectFit: "cover", borderRadius: 10, border: `1px solid ${BRAND.line}`, marginTop: 8 }} />}
        <Button onClick={save} disabled={saving} style={{ width: "100%", marginTop: 14 }}>{saving ? "Saving..." : initial ? "Save Changes" : "+ Add Exercise"}</Button>
      </Card>
    </div>
  );
}
function ExerciseLibraryEditor({ trainerId, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => { loadExerciseLibraryData(trainerId).then((data) => { setItems(data); setLoading(false); }); }, [trainerId]);

  async function persist(next) {
    setItems(next);
    await upsertTrainerData(trainerId, "custom_exercise_library", { items: next });
  }
  async function addOrUpdate() {
    if (!name.trim()) { alert("Enter an exercise name."); return; }
    setSaving(true);
    if (editingId) {
      await persist(items.map((it) => (it.id === editingId ? { ...it, name: name.trim(), videoUrl: videoUrl.trim() } : it)));
    } else {
      await persist([{ id: uid(), name: name.trim(), videoUrl: videoUrl.trim() }, ...items]);
    }
    setName(""); setVideoUrl(""); setEditingId(null); setSaving(false);
  }
  function startEdit(it) { setEditingId(it.id); setName(it.name); setVideoUrl(it.videoUrl || ""); }
  function cancelEdit() { setEditingId(null); setName(""); setVideoUrl(""); }
  async function remove(id) { await persist(items.filter((it) => it.id !== id)); if (editingId === id) cancelEdit(); }

  const draftThumb = getVideoThumb(videoUrl);

  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 19, fontWeight: 1000 }}>Exercise Library</div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <div style={{ color: BRAND.muted, fontSize: 12, marginBottom: 14 }}>Add an exercise with a video link here, and it'll show up ready to pick - with the video already attached - whenever you're building a program.</div>

        <Field label="Exercise name" value={name} onChange={setName} placeholder="e.g. Cable Crossover" />
        <div style={{ marginTop: 10 }}>
          <Field label="Video link" value={videoUrl} onChange={setVideoUrl} placeholder="https://..." />
        </div>
        {draftThumb && <img src={draftThumb.thumb} alt="Exercise video" style={{ width: 160, height: 90, objectFit: "cover", borderRadius: 10, border: `1px solid ${BRAND.line}`, marginTop: 8 }} />}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Button onClick={addOrUpdate} disabled={saving} style={{ flex: 1 }}>{saving ? "Saving..." : editingId ? "Update Exercise" : "+ Add Exercise"}</Button>
          {editingId && <Button variant="ghost" onClick={cancelEdit}>Cancel</Button>}
        </div>

        <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, margin: "18px 0 8px", textTransform: "uppercase" }}>Your Exercises ({items.length})</div>
        {loading ? <div style={{ color: BRAND.dim }}>Loading...</div> : items.length === 0 ? <div style={{ color: BRAND.dim, fontSize: 13 }}>No custom exercises yet.</div> : (
          items.map((it) => {
            const t = getVideoThumb(it.videoUrl);
            return (
              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, background: BRAND.card2, borderRadius: 12, padding: 10, marginBottom: 8 }}>
                {t ? <img src={t.thumb} alt="Exercise video" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} /> : <div style={{ width: 52, height: 52, borderRadius: 8, background: BRAND.panel, flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{it.name}</div>
                  <div style={{ color: BRAND.dim, fontSize: 11 }}>{it.videoUrl ? "Video attached" : "No video"}</div>
                </div>
                <button onClick={() => startEdit(it)} style={{ background: "transparent", border: "none", color: BRAND.gold, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Edit</button>
                <button onClick={() => remove(it.id)} style={{ background: "transparent", border: "none", color: BRAND.red, fontWeight: 900, fontSize: 15, cursor: "pointer" }}>x</button>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
function BlockEditor({ block, index, onChange, onDelete, onMoveUp, onMoveDown, isMobile, trainerId }) {
  const [addSearch, setAddSearch] = useState("");
  const [openEx, setOpenEx] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [pickSource, setPickSource] = useState("library");
  const [customLibrary, setCustomLibrary] = useState([]);
  useEffect(() => { if (trainerId) loadExerciseLibraryData(trainerId).then(setCustomLibrary); }, [trainerId, showLibrary]);
  const customVideoMap = Object.fromEntries(customLibrary.filter((it) => it.videoUrl).map((it) => [it.name, it.videoUrl]));
  const exerciseLibrary = useExerciseLibrary();
  const customNames = customLibrary.map((it) => it.name);
  const suggestions = !addSearch ? [] : (pickSource === "mine" ? customNames : exerciseLibrary).filter((n) => n.toLowerCase().includes(addSearch.toLowerCase())).slice(0, 20);
  function patch(p) { onChange({ ...block, ...p }); }
  function patchEx(ei, p) { patch({ exercises: block.exercises.map((e, i) => (i === ei ? { ...e, ...p } : e)) }); }
  function addExercise(name) { const ex = newExercise(name); if (customVideoMap[name]) ex.videoUrl = customVideoMap[name]; patch({ exercises: [...block.exercises, ex] }); setAddSearch(""); }
  function deleteEx(ei) { patch({ exercises: block.exercises.filter((_, i) => i !== ei) }); }
  function moveEx(ei, dir) { const j = ei + dir; if (j < 0 || j >= block.exercises.length) return; const next = [...block.exercises]; [next[ei], next[j]] = [next[j], next[ei]]; patch({ exercises: next }); }
  function patchSet(ei, si, p) { patchEx(ei, { sets: block.exercises[ei].sets.map((s, i) => (i === si ? { ...s, ...p } : s)) }); }
  function addSet(ei) { const sets = block.exercises[ei].sets; const last = sets[sets.length - 1]; patchEx(ei, { sets: [...sets, { id: uid(), targetReps: last?.targetReps || "", targetLoad: last?.targetLoad || "", targetRpe: last?.targetRpe || "" }] }); }
  function removeSet(ei, si) { const sets = block.exercises[ei].sets; if (sets.length <= 1) return; patchEx(ei, { sets: sets.filter((_, i) => i !== si) }); }
  return (
    <>
    <div style={{ background: BRAND.card2, border: `1px solid ${block.type === "straight" ? BRAND.line : BRAND.gold + "77"}`, borderRadius: 16, padding: 12, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ color: BRAND.gold, fontWeight: 1000 }}>{blockTitle(block, index)}</div>
          <select value={block.type} onChange={(e) => patch({ type: e.target.value })} style={inputStyle({ padding: "6px 8px", width: "auto" })}>
            <option value="straight">Straight sets</option><option value="superset">Superset</option><option value="circuit">Circuit</option>
          </select>
          {block.type === "circuit" && <input value={block.rounds || ""} onChange={(e) => patch({ rounds: Number(e.target.value || 1) })} placeholder="Rounds" style={inputStyle({ width: 70 })} />}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setShowLibrary(true)} style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 999, padding: "5px 10px", color: BRAND.gold, fontWeight: 800, fontSize: 11, cursor: "pointer" }}>Exercise Library</button>
          <button onClick={onMoveUp} style={{ background: "transparent", border: "none", color: BRAND.muted, fontWeight: 1000, cursor: "pointer", padding: "2px 5px" }}>▲</button>
          <button onClick={onMoveDown} style={{ background: "transparent", border: "none", color: BRAND.muted, fontWeight: 1000, cursor: "pointer", padding: "2px 5px" }}>▼</button>
          <button onClick={onDelete} style={{ background: "transparent", border: "none", color: BRAND.red, fontWeight: 1000, cursor: "pointer", padding: "2px 5px" }}>x</button>
        </div>
      </div>
      {showLibrary && <ExerciseLibraryEditor trainerId={trainerId} onClose={() => setShowLibrary(false)} />}
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
              <label><div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 800, marginBottom: 3 }}>Video link</div><input value={ex.videoUrl || ""} onChange={(e) => patchEx(ei, { videoUrl: e.target.value })} placeholder="https://..." style={inputStyle()} />
                {getVideoThumb(ex.videoUrl) && (() => { const t = getVideoThumb(ex.videoUrl); return <button onClick={() => setPlayingVideo({ videoId: t.videoId, title: ex.name })} style={{ padding: 0, border: "none", background: "transparent", cursor: "pointer", display: "inline-block", position: "relative", marginTop: 8 }}><img src={t.thumb} alt="Exercise video" style={{ width: 140, height: 79, objectFit: "cover", borderRadius: 10, border: `1px solid ${BRAND.line}` }} /><div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}><div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center", color: "#fff", fontSize: 12 }}>▶</div></div></button>; })()}
              </label>
            </div>}
          </div>
        );
      })}
      <div style={{ marginTop: 10 }}>
        <div style={{ display: "flex", gap: 6, background: BRAND.panel, border: `1px solid ${BRAND.line}`, borderRadius: 999, padding: 3, marginBottom: 8 }}>
          <button onClick={() => setPickSource("library")} style={{ flex: 1, padding: "8px 0", borderRadius: 999, border: "none", background: pickSource === "library" ? BRAND.gold : "transparent", color: pickSource === "library" ? "#000" : BRAND.muted, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Exercise Library</button>
          <button onClick={() => setPickSource("mine")} style={{ flex: 1, padding: "8px 0", borderRadius: 999, border: "none", background: pickSource === "mine" ? BRAND.gold : "transparent", color: pickSource === "mine" ? "#000" : BRAND.muted, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>My Exercises{customLibrary.length ? ` (${customLibrary.length})` : ""}</button>
        </div>
        <input placeholder={pickSource === "mine" ? "Search your exercises..." : (block.exercises.length ? "Add exercise to this block..." : "Search first exercise...")} value={addSearch} onChange={(e) => setAddSearch(e.target.value)} style={inputStyle()} />
        {pickSource === "mine" && customLibrary.length === 0 && (
          <div style={{ marginTop: 8, textAlign: "center", padding: 12 }}>
            <div style={{ color: BRAND.muted, fontSize: 12, marginBottom: 8 }}>No custom exercises yet.</div>
            <button onClick={() => setShowLibrary(true)} style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 999, padding: "8px 14px", color: BRAND.gold, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>+ Add your first exercise</button>
          </div>
        )}
        {addSearch && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          {suggestions.map((n) => <button key={n} onClick={() => addExercise(n)} style={{ background: BRAND.panel, color: BRAND.text, border: `1px solid ${BRAND.line}`, borderRadius: 999, padding: "6px 10px", fontWeight: 800, cursor: "pointer" }}>+ {n}</button>)}
          {pickSource === "library" && <button onClick={() => addExercise(addSearch.trim())} style={{ background: BRAND.gold, color: "#000", border: "none", borderRadius: 999, padding: "6px 10px", fontWeight: 900, cursor: "pointer" }}>+ Custom: {addSearch.trim()}</button>}
        </div>}
      </div>
      {showLibrary && <ExerciseLibraryEditor trainerId={trainerId} onClose={() => setShowLibrary(false)} />}
    </div>
    {playingVideo && <VideoPlayerModal videoId={playingVideo.videoId} title={playingVideo.title} onClose={() => setPlayingVideo(null)} />}
    </>
  );
}

// ---------- Coach: Program Builder ----------
function ProgramBuilder({ client, program, onClose, onSave }) {
  const isMobile = useIsMobile(520);
  const [p, setP] = useState(() => normalizeProgramDays(program?.version === 2 ? JSON.parse(JSON.stringify(program)) : newProgram(`${client.name?.split(" ")[0] || "Client"}'s Program`, client.goal || "General Fitness", 4)));
  const [wk, setWk] = useState(0);
  const [wo, setWo] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [savingTpl, setSavingTpl] = useState(false);
  const trainerId = client.trainer_id;
  useEffect(() => {
    let active = true;
    if (!trainerId) return;
    loadTrainerTemplates(trainerId).then((list) => { if (active) setTemplates(list); });
    return () => { active = false; };
  }, [trainerId]);
  function loadTemplate(t) {
    if (!confirm(`Load "${t.name}"? This replaces the program you're editing. Logs are never touched.`)) return;
    const copy = cloneWithNewIds(t.program);
    setP({ ...copy, id: uid(), name: p.name || copy.name, startDate: p.startDate || copy.startDate || isoDate() });
    setWk(0); setWo(0);
  }
  async function saveAsTemplate() {
    if (!trainerId) { alert("No trainer linked to this client, so the template can't be saved."); return; }
    const name = prompt("Template name", p.name || "New Template");
    if (!name) return;
    setSavingTpl(true);
    const entry = { id: uid(), name, goal: p.goal, weeks: p.weeks.length, savedAt: new Date().toISOString(), program: cloneWithNewIds(p) };
    const next = [entry, ...templates];
    setTemplates(next);
    await upsertTrainerData(trainerId, "templates", { templates: next });
    setSavingTpl(false);
    alert(`Saved "${name}" to Templates.`);
  }
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
  function assignDay(dow, workoutId) {
    // One workout per day. Assigning a workout to a day pulls it off whatever day it was on.
    patchWeek({
      workouts: week.workouts.map((w) => {
        if (workoutId && w.id === workoutId) return { ...w, dayOfWeek: dow };
        if (Number(w.dayOfWeek) === dow) return { ...w, dayOfWeek: null };
        return w;
      }),
    });
  }
  function setRestNote(dow, note) { patchWeek({ restDays: { ...(week.restDays || {}), [dow]: note } }); }
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
        <InjuryBanner client={client} />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr", gap: 10 }}>
          <Field label="Program name (client sees this)" value={p.name} onChange={(v) => patchProgram({ name: v })} />
          <label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 }}>Goal</div><select value={p.goal} onChange={(e) => patchProgram({ goal: e.target.value })} style={inputStyle()}>{GOAL_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}</select></label>
          <Field label="Start date (drives the calendar)" type="date" value={p.startDate || ""} onChange={(v) => patchProgram({ startDate: v })} />
        </div>
        {templates.length > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
            <select value="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) loadTemplate(t); }} style={inputStyle({ maxWidth: 260 })}>
              <option value="">Load from template...</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.goal ? ` · ${t.goal}` : ""}</option>)}
            </select>
          </div>
        )}
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
        <div style={{ marginTop: 14, background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 12 }}>
          <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8 }}>Week {week.weekNum} schedule</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 6 }}>
            {[1, 2, 3, 4, 5, 6, 7].map((dow) => {
              const assigned = workoutForDay(week, dow);
              const d = dayDate(p, week.weekNum, dow);
              return (
                <div key={dow} style={{ background: assigned ? BRAND.card : "transparent", border: `1px ${assigned ? "solid" : "dashed"} ${BRAND.line}`, borderRadius: 12, padding: 7, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: BRAND.dim, fontSize: 9, fontWeight: 900, letterSpacing: 0.5 }}>{DOW_LABEL[dow - 1].toUpperCase()}</div>
                    <div style={{ fontWeight: 900, fontSize: 13, color: BRAND.text }}>{d.getDate()}</div>
                  </div>
                  <select value={assigned?.id || ""} onChange={(e) => assignDay(dow, e.target.value)} style={inputStyle({ padding: "6px 3px", fontSize: 11, borderRadius: 8, background: BRAND.panel })}>
                    <option value="">Rest</option>
                    {week.workouts.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                  {!assigned && <input value={restNoteFor(week, dow)} onChange={(e) => setRestNote(dow, e.target.value)} placeholder="Recovery" style={inputStyle({ padding: "6px 4px", fontSize: 10, borderRadius: 8, background: BRAND.panel })} />}
                </div>
              );
            })}
          </div>
          <div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 600, marginTop: 8 }}>
            Any day without a workout is a rest day. Add a recovery note (steps, mobility, walk) and the client sees it on their calendar.
            {unassignedWorkouts(week).length > 0 && <span style={{ color: BRAND.gold }}> {unassignedWorkouts(week).length} workout{unassignedWorkouts(week).length === 1 ? " is" : "s are"} not on a day yet.</span>}
          </div>
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
            {workout.blocks.map((b, bi) => <BlockEditor key={b.id} block={b} index={bi} isMobile={isMobile} trainerId={client.trainer_id} onChange={(next) => patchBlock(bi, next)} onDelete={() => deleteBlock(bi)} onMoveUp={() => moveBlock(bi, -1)} onMoveDown={() => moveBlock(bi, 1)} />)}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="dark" onClick={() => addBlock("straight")}>+ Exercise</Button>
              <Button variant="dark" onClick={() => addBlock("superset")}>+ Superset</Button>
              <Button variant="dark" onClick={() => addBlock("circuit")}>+ Circuit</Button>
            </div>
          </div>
        </> : <Card style={{ background: BRAND.card2, marginTop: 12 }}><div style={{ color: BRAND.muted }}>No workouts in week {week.weekNum} yet. Add one above, or duplicate another week.</div></Card>}
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <Button onClick={() => onSave(p)} style={{ flex: 1, minWidth: 140 }}>Save Program</Button>
          <Button variant="dark" disabled={savingTpl} onClick={saveAsTemplate}>{savingTpl ? "Saving..." : "Save as Template"}</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
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
  const [rpePickerFor, setRpePickerFor] = useState(null); // `${entryId}:${si}` of the set currently choosing an RPE, or null
  const [playingVideo, setPlayingVideo] = useState(null); // { videoId, title } or null
  const [current, setCurrent] = useState(0);
  const [, forceTick] = useState(0);
  useEffect(() => { const t = setInterval(() => forceTick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  const exById = {};
  (workout?.blocks || []).forEach((b) => (b.exercises || []).forEach((ex) => { exById[ex.id] = { ex, block: b }; }));
  function patchEntry(entryId, patch) { onUpdate({ ...session, entries: session.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)) }); }
  function patchSet(entryId, si, patch) { onUpdate({ ...session, entries: session.entries.map((e) => (e.id === entryId ? { ...e, sets: e.sets.map((s, i) => (i === si ? { ...s, ...patch } : s)) } : e)) }); }
  function addSet(entryId) {
    const entry = session.entries.find((e) => e.id === entryId);
    if (!entry) return;
    patchEntry(entryId, { sets: [...entry.sets, { setId: null, reps: "", load: "", duration: "", rpe: "", done: false }] });
  }
  function toggleDone(entry, si) {
    const meta = exById[entry.exerciseId];
    const target = meta?.ex.sets[si];
    const timed = isTimedExercise(entry.substitutedName || entry.name);
    const s = entry.sets[si];
    if (s.done) { patchSet(entry.id, si, { done: false }); setRest(null); return; }
    const patch = { done: true };
    const lastSets = lastSessionSetsFor(logsBefore, entry.substitutedName || entry.name);
    const prev = lastSets[si] || {};
    if (timed) { if (!s.duration) patch.duration = prev.duration || target?.targetReps || ""; }
    else { if (!s.reps) patch.reps = prev.reps || target?.targetReps || ""; if (!s.load && (meta?.ex.loadType || "kg") === "kg") patch.load = prev.load || target?.targetLoad || ""; }
    patchSet(entry.id, si, patch);
    const restSec = parseSeconds(meta?.ex.rest || "");
    if (restSec > 0) setRest({ until: Date.now() + restSec * 1000, total: restSec });
  }
  function finish() { const completed = { ...session, status: "completed", completedAt: new Date().toISOString() }; setFinished(completed); onUpdate(completed); }
  function handleExit() { if (session.startedAt && session.status !== "completed") { const e = Math.round((Date.now() - new Date(session.startedAt)) / 1000); onUpdate({ ...session, startedAt: null, elapsedSec: e }); } onExit(); }
  function adjustRest(delta) { if (rest && restLeft > 0) { const nl = Math.max(5, restLeft + delta); setRest({ until: Date.now() + nl * 1000, total: Math.max(rest.total, nl) }); } else { const base = Math.max(15, restTotal + delta); setRest({ until: Date.now() + base * 1000, total: base }); } }
  const sessionRef = useRef(session); sessionRef.current = session;
  useEffect(() => () => { const sn = sessionRef.current; if (sn && sn.startedAt && sn.status !== "completed") { const e = Math.round((Date.now() - new Date(sn.startedAt)) / 1000); onUpdate({ ...sn, startedAt: null, elapsedSec: e }); } }, []);
  const elapsed = session.startedAt ? Math.round((Date.now() - new Date(session.startedAt)) / 1000) : (session.elapsedSec || 0);
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
  const allEntries = session.entries || [];
  const total = allEntries.length;
  const cur = Math.min(current, Math.max(0, total - 1));
  const entry = allEntries[cur];
  if (!entry) return <Card style={{ padding: 18 }}><div style={{ color: BRAND.muted }}>No exercises in this session.</div><Button onClick={handleExit} style={{ marginTop: 12 }}>Exit</Button></Card>;
  const meta = exById[entry.exerciseId];
  const ex = meta?.ex || {};
  const block = (workout?.blocks || []).find((b) => b.id === entry.blockId);
  const effectiveName = entry.substitutedName || entry.name;
  const timed = isTimedExercise(effectiveName);
  const lastSets = lastSessionSetsFor(logsBefore, effectiveName);
  const thumb = getVideoThumb(ex.videoUrl);
  const subbing = subFor === entry.id;
  const suggestions = subQuery ? exerciseLibrary.filter((n) => n.toLowerCase().includes(subQuery.toLowerCase())).slice(0, 10) : [];
  const prog = suggestProgression(lastSets);
  const restTotal = (rest?.total) || parseSeconds(ex.rest || "") || 120;
  const ringC = 2 * Math.PI * 26;
  const restPct = rest && restLeft > 0 ? restLeft / rest.total : 1;
  const chip = { fontSize: 10, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.5, borderRadius: 8, padding: "6px 10px" };
  return (
    <>
    <InjuryBanner client={client} />
    <div style={{ display: "grid", gap: 14, maxWidth: "100%", overflowX: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={handleExit} style={{ background: "none", border: "none", color: BRAND.gold, fontWeight: 1000, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer", padding: 0 }}>‹ Exit</button>
        <div style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 9, padding: "5px 11px", fontWeight: 1000, color: BRAND.gold, fontSize: 13 }}>{elapsed > 0 ? fmtClock(elapsed) : "0:00"}</div>
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.8 }}>Exercise {cur + 1} of {total}</div>
          <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "right" }}>{workout?.name || session.workoutName}</div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 1000, textTransform: "uppercase", lineHeight: 1.05, marginTop: 6 }}>{effectiveName}</div>
        {entry.substitutedName && <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 700, marginTop: 3 }}>Substituted for {entry.name}</div>}
        {block && block.type !== "straight" && <div style={{ color: BRAND.gold, fontSize: 10, fontWeight: 1000, textTransform: "uppercase", marginTop: 4 }}>{entry.tag} · {block.type}</div>}
      </div>
      {thumb ? <button onClick={() => setPlayingVideo({ videoId: thumb.videoId, title: effectiveName })} style={{ width: "100%", padding: 0, border: `1px solid ${BRAND.line}`, borderRadius: 18, overflow: "hidden", cursor: "pointer", display: "block", position: "relative", background: BRAND.card2 }}>
        <div style={{ position: "relative", height: 168 }}><img src={thumb.thumb} alt="Exercise" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.5 }} /><div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}><div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(0,0,0,.5)", border: `2px solid ${BRAND.gold}`, display: "grid", placeItems: "center", color: BRAND.gold, fontSize: 20 }}>▶</div></div></div>
        {(ex.tempo || week?.targetRpe || ex.rest) && <div style={{ display: "flex", gap: 8, padding: 12, flexWrap: "wrap" }}>{ex.tempo && <span style={{ ...chip, color: "#000", background: BRAND.gold }}>Tempo {ex.tempo}</span>}{week?.targetRpe && <span style={{ ...chip, color: BRAND.gold, border: `1px solid ${BRAND.gold}` }}>Target RPE {week.targetRpe}</span>}{ex.rest && <span style={{ ...chip, color: BRAND.muted, border: `1px solid ${BRAND.line}` }}>Rest {ex.rest}</span>}</div>}
      </button> : (ex.tempo || week?.targetRpe || ex.rest) ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{ex.tempo && <span style={{ ...chip, color: "#000", background: BRAND.gold }}>Tempo {ex.tempo}</span>}{week?.targetRpe && <span style={{ ...chip, color: BRAND.gold, border: `1px solid ${BRAND.gold}` }}>Target RPE {week.targetRpe}</span>}{ex.rest && <span style={{ ...chip, color: BRAND.muted, border: `1px solid ${BRAND.line}` }}>Rest {ex.rest}</span>}</div> : null}
      {ex.note && <div style={{ background: BRAND.card2, border: `1px solid ${BRAND.gold}44`, borderRadius: 12, padding: 10, fontSize: 13 }}><span style={{ color: BRAND.gold, fontWeight: 1000 }}>Coach: </span>{ex.note}</div>}
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr 0.7fr 38px", gap: 6, padding: "0 6px 6px" }}>{["Set", "Kg", "Reps", "RPE", ""].map((h, hi) => <div key={hi} style={{ color: BRAND.muted, fontSize: 9, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.6, textAlign: hi >= 1 && hi <= 3 ? "center" : "left" }}>{h}</div>)}</div>
        {entry.sets.map((s, si) => {
          const prev = lastSets[si] || {};
          return (
            <div key={si} style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr 0.7fr 38px", gap: 6, alignItems: "center", padding: "13px 6px", marginBottom: 8, borderRadius: 13, background: s.done ? `${BRAND.gold}12` : BRAND.card2, border: `1px solid ${s.done ? BRAND.gold : BRAND.line}` }}>
              <div style={{ fontWeight: 1000, fontSize: 15, textAlign: "center" }}>{si + 1}</div>
              <input inputMode="decimal" placeholder={prev.load || (timed ? "load" : "kg")} value={s.load || ""} onChange={(e) => patchSet(entry.id, si, { load: e.target.value })} style={{ width: "100%", minWidth: 0, background: "transparent", border: "none", color: BRAND.text, fontWeight: 1000, fontSize: 17, textAlign: "center", outline: "none" }} />
              <input inputMode="numeric" placeholder={timed ? (prev.duration || "s") : (prev.reps || "reps")} value={timed ? (s.duration || "") : (s.reps || "")} onChange={(e) => patchSet(entry.id, si, timed ? { duration: e.target.value } : { reps: e.target.value })} style={{ width: "100%", minWidth: 0, background: "transparent", border: "none", color: BRAND.text, fontWeight: 1000, fontSize: 17, textAlign: "center", outline: "none" }} />
              <div style={{ position: "relative" }}>
                <button onClick={() => setRpePickerFor(rpePickerFor === `${entry.id}:${si}` ? null : `${entry.id}:${si}`)} style={{ width: "100%", background: "transparent", border: "none", color: s.rpe ? BRAND.text : BRAND.dim, fontWeight: 1000, fontSize: 16, textAlign: "center", cursor: "pointer" }}>{s.rpe || "—"}</button>
                {rpePickerFor === `${entry.id}:${si}` && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 20, background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: 6, display: "flex", gap: 4, boxShadow: "0 8px 24px rgba(0,0,0,.5)" }}>
                    {[6, 7, 8, 9, 10].map((n) => (
                      <button key={n} onClick={() => { patchSet(entry.id, si, { rpe: String(n) }); setRpePickerFor(null); }} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${String(s.rpe) === String(n) ? BRAND.gold : BRAND.line}`, background: String(s.rpe) === String(n) ? BRAND.gold : BRAND.panel, color: String(s.rpe) === String(n) ? "#000" : BRAND.text, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{n}</button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "grid", placeItems: "center" }}>
                <button onClick={() => toggleDone(entry, si)} style={{ width: 32, height: 32, borderRadius: 9, border: `1.5px solid ${s.done ? BRAND.gold : BRAND.dim}`, background: s.done ? BRAND.gold : "transparent", color: "#000", fontWeight: 1000, fontSize: 15, cursor: "pointer" }}>{s.done ? "✓" : ""}</button>
              </div>
            </div>
          );
        })}
        <button onClick={() => addSet(entry.id)} style={{ width: "100%", marginTop: 2, padding: "12px", borderRadius: 12, border: `1px dashed ${BRAND.line}`, background: "transparent", color: BRAND.gold, fontWeight: 1000, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, cursor: "pointer" }}>+ Add set</button>
        {prog && <div style={{ color: BRAND.dim, fontSize: 10, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 12, textAlign: "center" }}>▲ Progressive overload — +{prog.bump}kg vs last week</div>}
      </div>
      <div>
        <button onClick={() => { setSubFor(subbing ? null : entry.id); setSubQuery(""); }} style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 999, color: BRAND.muted, fontWeight: 900, cursor: "pointer", fontSize: 12, padding: "9px 14px" }}>{subbing ? "Cancel" : "Swap exercise"}</button>
        {subbing && <div style={{ marginTop: 8 }}>
          <input placeholder="Search a substitute..." value={subQuery} onChange={(e) => setSubQuery(e.target.value)} style={inputStyle()} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {entry.substitutedName && <button onClick={() => { patchEntry(entry.id, { substitutedName: "" }); setSubFor(null); }} style={{ background: BRAND.panel, color: BRAND.text, border: `1px solid ${BRAND.line}`, borderRadius: 999, padding: "6px 10px", fontWeight: 800, cursor: "pointer" }}>Use original: {entry.name}</button>}
            {suggestions.map((n) => <button key={n} onClick={() => { patchEntry(entry.id, { substitutedName: n }); setSubFor(null); }} style={{ background: BRAND.panel, color: BRAND.text, border: `1px solid ${BRAND.line}`, borderRadius: 999, padding: "6px 10px", fontWeight: 800, cursor: "pointer" }}>{n}</button>)}
          </div>
        </div>}
      </div>
      <Card style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ position: "relative", width: 60, height: 60, flexShrink: 0 }}><svg width="60" height="60" style={{ transform: "rotate(-90deg)" }}><circle cx="30" cy="30" r="26" fill="none" stroke={BRAND.card2} strokeWidth="5" /><circle cx="30" cy="30" r="26" fill="none" stroke={BRAND.gold} strokeWidth="5" strokeLinecap="round" strokeDasharray={ringC} strokeDashoffset={ringC * (1 - restPct)} /></svg><div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 13, fontWeight: 1000 }}>{rest && restLeft > 0 ? fmtClock(restLeft) : fmtClock(restTotal)}</div></div>
        <div style={{ flex: 1 }}><div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.6 }}>Rest timer</div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button onClick={() => adjustRest(-30)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, cursor: "pointer", color: BRAND.text, background: BRAND.card2, border: `1px solid ${BRAND.line}`, fontWeight: 1000, fontSize: 12 }}>-30s</button>
            {rest && restLeft > 0
              ? <button onClick={() => setRest(null)} style={{ flex: 1.5, padding: "10px 0", borderRadius: 10, cursor: "pointer", color: "#000", background: BRAND.gold, border: "none", fontWeight: 1000, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Skip</button>
              : <button onClick={() => setRest({ until: Date.now() + restTotal * 1000, total: restTotal })} style={{ flex: 1.5, padding: "10px 0", borderRadius: 10, border: "none", background: BRAND.gold, color: "#000", fontWeight: 1000, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer" }}>Start {fmtClock(restTotal)}</button>}
            <button onClick={() => adjustRest(30)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, cursor: "pointer", color: BRAND.text, background: BRAND.card2, border: `1px solid ${BRAND.line}`, fontWeight: 1000, fontSize: 12 }}>+30s</button>
          </div>
        </div>
      </Card>
      <div style={{ display: "flex", gap: 8 }}>
        {cur > 0 && <Button variant="dark" onClick={() => { setCurrent(cur - 1); setRest(null); }} style={{ flex: 1 }}>Back</Button>}
        {cur < total - 1 ? <Button onClick={() => { setCurrent(cur + 1); setRest(null); }} style={{ flex: 2 }}>Next exercise ›</Button> : <Button onClick={finish} style={{ flex: 2 }}>Finish workout</Button>}
      </div>
      <div style={{ color: BRAND.dim, fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" }}>{total - cur - 1 > 0 ? `${total - cur - 1} exercise${total - cur - 1 === 1 ? "" : "s"} left` : "Last exercise"}</div>
    </div>
    {playingVideo && <VideoPlayerModal videoId={playingVideo.videoId} title={playingVideo.title} onClose={() => setPlayingVideo(null)} />}
    </>
  );
}



// ---------- Program calendar: shared bits ----------
function DayPill({ day, compact = false }) {
  const base = { fontSize: compact ? 8 : 9, fontWeight: 900, borderRadius: 6, padding: compact ? "3px 2px" : "4px 3px", width: "100%", textAlign: "center", lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", boxSizing: "border-box" };
  if (day.isRest) return <div style={{ ...base, background: "transparent", color: BRAND.dim, border: `1px solid ${BRAND.line}` }}>Rest</div>;
  if (day.state === "completed") return <div style={{ ...base, background: "transparent", color: BRAND.green, border: `1px solid ${BRAND.green}66` }}><span style={{ color: BRAND.green }}>✓</span> {day.workout.name}</div>;
  if (day.state === "missed") return <div style={{ ...base, background: "transparent", color: BRAND.red, border: `1px solid ${BRAND.red}66` }}>{day.workout.name}</div>;
  if (day.state === "in_progress") return <div style={{ ...base, background: "transparent", color: BRAND.gold, border: `1px solid ${BRAND.gold}` }}>{day.workout.name}</div>;
  return <div style={{ ...base, background: BRAND.gold, color: "#000" }}>{day.workout.name}</div>;
}
function dayBorder(day) {
  if (day.state === "today" || day.state === "in_progress") return BRAND.gold;
  if (day.state === "completed") return `${BRAND.green}55`;
  if (day.state === "missed") return `${BRAND.red}55`;
  return BRAND.line;
}
function ProgramWeekView({ program, days, weekNum, setWeekNum, onOpen }) {
  const isMobile = useIsMobile(520);
  const week = program.weeks.find((w) => w.weekNum === weekNum) || program.weeks[0];
  const weekDaysList = days.filter((d) => d.weekNum === week.weekNum).sort((a, b) => a.dow - b.dow);
  const training = weekDaysList.filter((d) => !d.isRest);
  const done = training.filter((d) => d.state === "completed").length;
  const todayISO = isoDate(new Date());
  const today = weekDaysList.filter((d) => d.dateISO === todayISO);
  const upcoming = weekDaysList.filter((d) => d.dateISO > todayISO);
  const past = weekDaysList.filter((d) => d.dateISO < todayISO && !d.isRest);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
        {program.weeks.map((w) => {
          const wd = days.filter((d) => d.weekNum === w.weekNum && !d.isRest);
          const allDone = wd.length > 0 && wd.every((d) => d.state === "completed");
          return <Button key={w.id} variant={w.weekNum === week.weekNum ? "gold" : "dark"} onClick={() => setWeekNum(w.weekNum)} style={{ fontSize: 13, padding: "8px 14px" }}>W{w.weekNum}{allDone ? " ✓" : ""}</Button>;
        })}
      </div>
      {(week.label || week.focus || week.targetRpe) && (
        <Card style={{ background: BRAND.card2, padding: 12 }}>
          <div style={{ color: BRAND.gold, fontWeight: 1000 }}>Week {week.weekNum}{week.label ? `: ${week.label}` : ""}</div>
          {(week.focus || week.targetRpe) && <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 4 }}>{[week.focus, week.targetRpe && `Target RPE ${week.targetRpe}`].filter(Boolean).join(" · ")}</div>}
        </Card>
      )}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", color: BRAND.dim, fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>
          <span>This week</span><span>{done} of {training.length}</span>
        </div>
        <div style={{ height: 4, background: BRAND.card2, borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${training.length ? (done / training.length) * 100 : 0}%`, background: BRAND.gold }} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: isMobile ? 4 : 6 }}>
        {weekDaysList.map((d) => (
          <button key={d.key} onClick={() => onOpen(d)} style={{ background: d.isRest ? "transparent" : BRAND.card, border: `1px ${d.isRest ? "dashed" : "solid"} ${dayBorder(d)}`, borderRadius: 12, padding: "8px 3px", minHeight: 88, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer", minWidth: 0 }}>
            <div style={{ color: BRAND.dim, fontSize: 9, fontWeight: 900 }}>{DOW_LETTER[d.dow - 1]}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: d.state === "today" ? BRAND.gold : BRAND.text }}>{d.date.getDate()}</div>
            <DayPill day={d} compact />
          </button>
        ))}
      </div>
      {today.length > 0 && <DaySection title="Today" days={today} onOpen={onOpen} />}
      {upcoming.length > 0 && <DaySection title="Coming up" days={upcoming} onOpen={onOpen} />}
      {past.length > 0 && <DaySection title="Done this week" days={past} onOpen={onOpen} />}
    </div>
  );
}
function DaySection({ title, days, onOpen }) {
  return (
    <div>
      <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8 }}>{title}</div>
      {days.map((d) => {
        const stats = d.session?.status === "completed" ? sessionStatsV2(d.session) : null;
        return (
          <button key={d.key} onClick={() => onOpen(d)} style={{ width: "100%", textAlign: "left", background: d.isRest ? "transparent" : BRAND.card, border: `1px ${d.isRest ? "dashed" : "solid"} ${dayBorder(d)}`, borderRadius: 16, padding: 13, marginBottom: 8, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
            <div style={{ width: 38, textAlign: "center", flexShrink: 0 }}>
              <div style={{ color: BRAND.dim, fontSize: 9, fontWeight: 900 }}>{DOW_LABEL[d.dow - 1].toUpperCase()}</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: d.state === "today" ? BRAND.gold : BRAND.text }}>{d.date.getDate()}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 15, color: d.isRest ? BRAND.muted : BRAND.text }}>{d.isRest ? "Rest day" : d.workout.name}</div>
              <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 600, marginTop: 2 }}>
                {d.isRest
                  ? (d.note || "Recovery")
                  : d.state === "completed"
                    ? `Completed · ${stats.setsDone} sets · ${stats.volume.toLocaleString()}kg`
                    : `${exerciseCountOf(d.workout)} exercises`}
              </div>
            </div>
            {d.state === "today" && <span style={{ background: BRAND.gold, color: "#000", fontSize: 10, fontWeight: 900, borderRadius: 999, padding: "4px 10px" }}>START</span>}
            {d.state === "in_progress" && <span style={{ border: `1px solid ${BRAND.gold}`, color: BRAND.gold, fontSize: 10, fontWeight: 900, borderRadius: 999, padding: "4px 10px" }}>RESUME</span>}
            {d.state === "completed" && <span style={{ color: BRAND.green, fontSize: 16, fontWeight: 900 }}>✓</span>}
            {d.state === "missed" && <span style={{ border: `1px solid ${BRAND.red}`, color: BRAND.red, fontSize: 10, fontWeight: 900, borderRadius: 999, padding: "4px 10px" }}>MISSED</span>}
          </button>
        );
      })}
    </div>
  );
}
function ProgramMonthView({ days, cursor, setCursor, currentWeek, onOpen }) {
  const byDate = new Map(days.map((d) => [d.dateISO, d]));
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const cells = [];
  const cur = addDays(first, -lead);
  for (let i = 0; i < 42; i++) {
    const date = addDays(cur, i);
    cells.push({ date, inMonth: date.getMonth() === cursor.getMonth(), day: byDate.get(isoDate(date)) || null });
  }
  const shift = (n) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Button variant="dark" onClick={() => shift(-1)} style={{ padding: "8px 14px" }}>‹</Button>
        <div style={{ fontWeight: 1000, fontSize: 16 }}>{cursor.toLocaleString("en-GB", { month: "long", year: "numeric" })}</div>
        <Button variant="dark" onClick={() => shift(1)} style={{ padding: "8px 14px" }}>›</Button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 4 }}>
        {DOW_LETTER.map((l, i) => <div key={i} style={{ textAlign: "center", color: BRAND.dim, fontSize: 9, fontWeight: 900, paddingBottom: 4 }}>{l}</div>)}
        {cells.map(({ date, inMonth, day }, i) => (
          <button key={i} disabled={!day} onClick={() => day && onOpen(day)} style={{
            aspectRatio: "1 / 1.2", minWidth: 0, boxSizing: "border-box",
            background: day && !day.isRest ? BRAND.card : "transparent",
            border: `1px ${day?.isRest ? "dashed" : "solid"} ${day ? dayBorder(day) : BRAND.line}`,
            borderRadius: 10, padding: 4, display: "flex", flexDirection: "column", justifyContent: "space-between",
            opacity: inMonth ? 1 : 0.28, cursor: day ? "pointer" : "default",
            boxShadow: day && day.weekNum === currentWeek ? `inset 0 0 0 1px ${BRAND.card2}` : "none",
          }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: day?.state === "today" ? BRAND.gold : BRAND.muted, textAlign: "left" }}>{date.getDate()}</div>
            {day && <DayPill day={day} compact />}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", color: BRAND.dim, fontSize: 10, fontWeight: 700 }}>
        <span><span style={{ color: BRAND.green }}>✓</span> Completed</span>
        <span style={{ color: BRAND.gold }}>■ Scheduled</span>
        <span>▢ Rest</span>
      </div>
    </div>
  );
}
// ---------- Completed day: the session report ----------
// A record of what was actually done, not a place to log. Prescribed sits next
// to actual, because the gap between them is the coaching.
function SessionReport({ client, day, logs, onBack, onStart, onSaveCoachNote, isCoach }) {
  const session = day.session;
  const [note, setNote] = useState(session?.coachNote || "");
  const [saved, setSaved] = useState(false);
  const stats = sessionStatsV2(session);
  const logsBefore = { ...logs, sessions: (logs?.sessions || []).filter((s) => s.id !== session.id) };
  const pbs = detectSessionPBs(session, logsBefore);
  const pbNames = new Set(pbs.map((p) => String(p.name).toLowerCase()));
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Button variant="ghost" onClick={onBack} style={{ justifySelf: "start", padding: "8px 14px" }}>‹ Back</Button>
      <Card>
        <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.8 }}>
          {day.date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · Week {day.weekNum}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 4 }}>
          <div style={{ fontSize: 24, fontWeight: 1000 }}>{day.workout.name}</div>
          {onStart && <Button variant="dark" onClick={() => onStart(day)}>Log again</Button>}
        </div>
        <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 3 }}>
          Completed{stats.durationSec > 0 ? ` · ${fmtClock(stats.durationSec)}` : ""}{session.sessionRpe ? ` · Session RPE ${session.sessionRpe}` : ""}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 14 }}>
          <Mini label="Volume" value={`${stats.volume.toLocaleString()} kg`} />
          <Mini label="Sets" value={`${stats.setsDone} / ${stats.setsTotal}`} />
          <Mini label="PBs" value={String(pbs.length)} />
        </div>
      </Card>
      <div>
        <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8 }}>What was done</div>
        {(session.entries || []).map((e) => {
          const name = e.substitutedName || e.name;
          const timed = isTimedExercise(name);
          const prescribed = findPrescribedExercise(day.workout, e);
          const loggedSets = (e.sets || []).filter((s) => s.done || s.reps || s.load || s.duration);
          const isPb = pbNames.has(String(name).toLowerCase());
          const short = prescribed && loggedSets.length > 0 && loggedSets.length < (prescribed.sets?.length || 0);
          if (!loggedSets.length) return null;
          return (
            <Card key={e.id} style={{ padding: 13, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 900, fontSize: 15 }}>{e.tag ? <span style={{ color: BRAND.gold, marginRight: 6 }}>{e.tag}</span> : null}{name}</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {isPb && <span style={{ background: BRAND.green, color: "#000", fontSize: 9, fontWeight: 1000, borderRadius: 999, padding: "3px 8px" }}>PB</span>}
                  {short && <span style={{ color: BRAND.red, fontSize: 10, fontWeight: 800 }}>{loggedSets.length} of {prescribed.sets.length} sets</span>}
                </div>
              </div>
              {prescribed && <div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 700, marginTop: 4 }}>Prescribed {fmtExerciseSummary(prescribed)}</div>}
              <div style={{ marginTop: 8 }}>
                {loggedSets.map((s, i) => {
                  const prev = loggedSets[i - 1];
                  const up = !timed && prev && (parseFloat(s.load) || 0) > (parseFloat(prev.load) || 0) ? (parseFloat(s.load) || 0) - (parseFloat(prev.load) || 0) : 0;
                  const target = prescribed?.sets?.[i];
                  return (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "20px 1fr auto", alignItems: "center", gap: 8, padding: "6px 0", borderTop: i === 0 ? "none" : `1px solid ${BRAND.card2}`, fontSize: 13 }}>
                      <span style={{ color: BRAND.dim, fontSize: 10, fontWeight: 900 }}>{i + 1}</span>
                      <span style={{ fontWeight: 900 }}>
                        {fmtLoggedSet(s, timed)}
                        {up > 0 && <span style={{ color: BRAND.green, fontSize: 11, marginLeft: 6 }}>↑ +{up}</span>}
                        {target && <span style={{ color: BRAND.dim, fontWeight: 600, fontSize: 11, marginLeft: 8 }}>target {fmtSetTarget(target, prescribed)}</span>}
                      </span>
                      <span style={{ color: BRAND.gold, fontSize: 11, fontWeight: 800 }}>{s.rpe ? `RPE ${s.rpe}` : ""}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
      {session.notes && (
        <Card style={{ borderLeft: `3px solid ${BRAND.gold}` }}>
          <div style={{ color: BRAND.gold, fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>{client.name}</div>
          <div style={{ color: BRAND.muted, fontSize: 13, lineHeight: 1.5 }}>{session.notes}</div>
        </Card>
      )}
      {!isCoach && session.coachNote && (
        <Card style={{ borderLeft: `3px solid ${BRAND.cyan}` }}>
          <div style={{ color: BRAND.cyan, fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Coach</div>
          <div style={{ color: BRAND.muted, fontSize: 13, lineHeight: 1.5 }}>{session.coachNote}</div>
        </Card>
      )}
      {isCoach && (
        <Card>
          <Field label="Coach note on this session" value={note} onChange={(v) => { setNote(v); setSaved(false); }} textarea />
          <Button onClick={() => { onSaveCoachNote(session, note); setSaved(true); }} style={{ marginTop: 10, width: "100%" }}>{saved ? "Saved" : "Save note"}</Button>
        </Card>
      )}
    </div>
  );
}
// ---------- Upcoming / rest day detail ----------
function DayDetail({ day, onBack, onStart, canStart }) {
  const isFuture = day.dateISO > isoDate(new Date());
  if (day.isRest) {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <Button variant="ghost" onClick={onBack} style={{ justifySelf: "start", padding: "8px 14px" }}>‹ Back</Button>
        <Card>
          <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.8 }}>
            {day.date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <div style={{ fontSize: 24, fontWeight: 1000, marginTop: 4 }}>Rest day</div>
          <div style={{ color: BRAND.muted, fontSize: 14, marginTop: 10, lineHeight: 1.5 }}>{day.note || "No session scheduled. Recover well."}</div>
        </Card>
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Button variant="ghost" onClick={onBack} style={{ justifySelf: "start", padding: "8px 14px" }}>‹ Back</Button>
      <Card>
        <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.8 }}>
          {day.date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · Week {day.weekNum}
        </div>
        <div style={{ fontSize: 24, fontWeight: 1000, marginTop: 4 }}>{day.workout.name}</div>
        <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 3 }}>{exerciseCountOf(day.workout)} exercises</div>
        {day.workout.note && <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 8 }}>{day.workout.note}</div>}
      </Card>
      <Card>
        {(day.workout.blocks || []).map((b, bi) => (b.exercises || []).map((ex, ei) => (
          <div key={ex.id} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "8px 0", borderTop: bi === 0 && ei === 0 ? "none" : `1px solid ${BRAND.card2}` }}>
            <span style={{ color: BRAND.gold, fontWeight: 1000, minWidth: 26, fontSize: 12 }}>{exerciseTag(b, bi, ei)}</span>
            <span style={{ fontWeight: 900, flex: 1 }}>{ex.name}</span>
            <span style={{ color: BRAND.muted, fontSize: 12 }}>{fmtExerciseSummary(ex)}</span>
          </div>
        )))}
        {exerciseCountOf(day.workout) === 0 && <div style={{ color: BRAND.muted }}>Empty workout.</div>}
      </Card>
      {canStart
        ? <Button onClick={() => onStart(day)} style={{ width: "100%" }}>{day.state === "in_progress" ? "Continue session" : "Start session"}</Button>
        : isFuture
          ? <Card style={{ background: BRAND.card2, textAlign: "center" }}><div style={{ color: BRAND.dim, fontSize: 13 }}>Opens {day.date.toLocaleDateString("en-GB", { day: "numeric", month: "long" })} — this week comes first.</div></Card>
          : null}
    </div>
  );
}
// ---------- ProgramTab: coach + client entry point ----------
function isVacationActive(vacation) {
  if (!vacation?.startDate || !vacation?.endDate) return false;
  const today = isoDate();
  return today >= vacation.startDate && today <= vacation.endDate;
}
function VacationModeModal({ client, vacation, onClose, onSave, onEnd }) {
  const [startDate, setStartDate] = useState(vacation?.startDate || isoDate());
  const [endDate, setEndDate] = useState(vacation?.endDate || isoDate(addDays(new Date(), 6)));
  const [workoutName, setWorkoutName] = useState(vacation?.workout?.name || "Bodyweight Full Body");
  const [exercises, setExercises] = useState(vacation?.workout?.exercises?.length ? vacation.workout.exercises : [
    { id: uid(), name: "Goblet Squat", sets: "3", reps: "15", videoUrl: DEFAULT_EXERCISE_VIDEOS["Goblet Squat"] || "" },
    { id: uid(), name: "Push-Up", sets: "3", reps: "12", videoUrl: DEFAULT_EXERCISE_VIDEOS["Push-Up"] || "" },
    { id: uid(), name: "Plank", sets: "3", reps: "45s", videoUrl: DEFAULT_EXERCISE_VIDEOS["Plank"] || "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [pickSource, setPickSource] = useState("library");
  const [addSearch, setAddSearch] = useState("");
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customLibrary, setCustomLibrary] = useState([]);
  const exerciseLibrary = useExerciseLibrary();
  useEffect(() => { if (client.trainer_id) loadExerciseLibraryData(client.trainer_id).then(setCustomLibrary); }, [client.trainer_id]);
  const customVideoMap = Object.fromEntries(customLibrary.filter((it) => it.videoUrl).map((it) => [it.name, it.videoUrl]));
  const customNames = customLibrary.map((it) => it.name);
  const suggestions = !addSearch ? [] : (pickSource === "mine" ? customNames : exerciseLibrary).filter((n) => n.toLowerCase().includes(addSearch.toLowerCase())).slice(0, 12);

  function updateEx(id, patch) { setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e))); }
  function removeEx(id) { setExercises((prev) => prev.filter((e) => e.id !== id)); }
  function addExercise(name) {
    const videoUrl = customVideoMap[name] || DEFAULT_EXERCISE_VIDEOS[name] || "";
    setExercises((prev) => [...prev, { id: uid(), name, sets: "3", reps: "12", videoUrl }]);
    setAddSearch("");
  }
  async function save() {
    if (!startDate || !endDate || startDate > endDate) { alert("Check the dates - start must be before end."); return; }
    if (exercises.length === 0) { alert("Add at least one exercise."); return; }
    setSaving(true);
    await onSave({ startDate, endDate, workout: { name: workoutName, exercises } });
    setSaving(false);
  }
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 460, maxHeight: "88vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 19, fontWeight: 1000 }}>Set Vacation Mode</div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <div style={{ color: BRAND.muted, fontSize: 12, marginBottom: 14 }}>{client.name?.split(" ")[0]}'s regular program stays exactly where it is - this just sits on top temporarily, then hands back automatically.</div>
        <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, marginBottom: 6, textTransform: "uppercase" }}>Dates</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle()} />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle()} />
        </div>
        <Field label="Workout name" value={workoutName} onChange={setWorkoutName} placeholder="e.g. Bodyweight Full Body" />
        <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, margin: "14px 0 8px", textTransform: "uppercase" }}>Home Workout Plan</div>
        {exercises.map((ex) => {
          const thumb = getVideoThumb(ex.videoUrl);
          return (
            <div key={ex.id} style={{ background: BRAND.card2, borderRadius: 12, padding: 10, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {thumb ? <img src={thumb.thumb} alt="Exercise video" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} /> : <div style={{ width: 40, height: 40, borderRadius: 8, background: BRAND.panel, flexShrink: 0 }} />}
                <div style={{ flex: 1, fontWeight: 800, fontSize: 13, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ex.name}</div>
                <button onClick={() => removeEx(ex.id)} style={{ background: "transparent", border: "none", color: BRAND.red, fontWeight: 900, fontSize: 15, cursor: "pointer", flexShrink: 0 }}>x</button>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input value={ex.sets} onChange={(e) => updateEx(ex.id, { sets: e.target.value })} placeholder="sets" style={inputStyle()} />
                <input value={ex.reps} onChange={(e) => updateEx(ex.id, { reps: e.target.value })} placeholder="reps" style={inputStyle()} />
              </div>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 6, background: BRAND.panel, border: `1px solid ${BRAND.line}`, borderRadius: 999, padding: 3, marginTop: 10, marginBottom: 8 }}>
          <button onClick={() => setPickSource("library")} style={{ flex: 1, padding: "8px 0", borderRadius: 999, border: "none", background: pickSource === "library" ? BRAND.gold : "transparent", color: pickSource === "library" ? "#000" : BRAND.muted, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Exercise Library</button>
          <button onClick={() => setPickSource("mine")} style={{ flex: 1, padding: "8px 0", borderRadius: 999, border: "none", background: pickSource === "mine" ? BRAND.gold : "transparent", color: pickSource === "mine" ? "#000" : BRAND.muted, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>My Exercises{customLibrary.length ? ` (${customLibrary.length})` : ""}</button>
        </div>
        <input placeholder={pickSource === "mine" ? "Search your exercises..." : "Search exercises to add..."} value={addSearch} onChange={(e) => setAddSearch(e.target.value)} style={inputStyle()} />
        {addSearch && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {suggestions.map((n) => <button key={n} onClick={() => addExercise(n)} style={{ background: BRAND.panel, color: BRAND.text, border: `1px solid ${BRAND.line}`, borderRadius: 999, padding: "6px 10px", fontWeight: 800, cursor: "pointer" }}>+ {n}</button>)}
            {pickSource === "library" && suggestions.length === 0 && <button onClick={() => addExercise(addSearch.trim())} style={{ background: BRAND.gold, color: "#000", border: "none", borderRadius: 999, padding: "6px 10px", fontWeight: 900, cursor: "pointer" }}>+ Custom: {addSearch.trim()}</button>}
          </div>
        )}
        <Button onClick={save} disabled={saving} style={{ width: "100%", marginTop: 16 }}>{saving ? "Saving..." : "Activate Vacation Mode"}</Button>
        {vacation && <Button variant="red" onClick={onEnd} style={{ width: "100%", marginTop: 8 }}>End Vacation Mode Now</Button>}
      </Card>
    </div>
  );
}
function VacationBanner({ vacation, isCoach, onEdit, onToggleDone, doneToday }) {
  const [playingVideo, setPlayingVideo] = useState(null);
  const active = isVacationActive(vacation);
  if (!active) return null;
  const fmt = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <Card style={{ padding: 14, background: `${BRAND.orange}14`, border: `1px solid ${BRAND.orange}55`, marginBottom: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 20 }}>🏖️</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: BRAND.orange, fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5 }}>Vacation Mode Active</div>
          <div style={{ color: BRAND.text, fontWeight: 700, fontSize: 12, marginTop: 2 }}>{fmt(vacation.startDate)} - {fmt(vacation.endDate)} · Regular program paused, resumes automatically</div>
        </div>
        {isCoach && <button onClick={onEdit} style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 999, padding: "6px 12px", color: BRAND.text, fontWeight: 800, fontSize: 11, cursor: "pointer", flexShrink: 0 }}>Edit</button>}
      </div>
      <div style={{ background: BRAND.card2, borderRadius: 12, padding: 12, marginTop: 12 }}>
        <div style={{ color: BRAND.orange, fontSize: 10, fontWeight: 900, textTransform: "uppercase", marginBottom: 6 }}>Today's Home Workout</div>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>{vacation.workout?.name}</div>
        {(vacation.workout?.exercises || []).map((ex) => {
          const thumb = getVideoThumb(ex.videoUrl);
          return (
            <div key={ex.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${BRAND.line}` }}>
              {thumb ? (
                <button onClick={() => setPlayingVideo({ videoId: thumb.videoId, title: ex.name })} style={{ padding: 0, border: "none", background: "transparent", cursor: "pointer", position: "relative", flexShrink: 0 }}>
                  <img src={thumb.thumb} alt="Exercise video" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 10, border: `1px solid ${BRAND.line}` }} />
                  <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}><div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center", color: "#fff", fontSize: 9 }}>▶</div></div>
                </button>
              ) : <div style={{ width: 44, height: 44, borderRadius: 10, background: BRAND.panel, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{ex.name}</div>
                <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 700 }}>{ex.sets} x {ex.reps}</div>
              </div>
            </div>
          );
        })}
        {!isCoach && (
          <button onClick={onToggleDone} style={{ width: "100%", marginTop: 12, padding: 12, borderRadius: 999, border: "none", background: doneToday ? BRAND.green : BRAND.orange, color: "#000", fontWeight: 900, fontSize: 13, cursor: "pointer" }}>{doneToday ? "✓ Marked Done Today" : "Mark Today's Workout Done"}</button>
        )}
      </div>
      {playingVideo && <VideoPlayerModal videoId={playingVideo.videoId} title={playingVideo.title} onClose={() => setPlayingVideo(null)} />}
    </Card>
  );
}
function ProgramTab({ client, updateClient, isCoach }) {
  const isMobile = useIsMobile(520);
  const [program, setProgram] = useState(client.program?.version === 2 ? client.program : null);
  const [logs, setLogs] = useState(client.trainingLogs || emptyTrainingLogs());
  const [builder, setBuilder] = useState(false);
  const [live, setLive] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [mode, setMode] = useState("week");
  const [openKey, setOpenKey] = useState(null);
  const [weekNum, setWeekNum] = useState(() => currentProgramWeek(client.program));
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [vacation, setVacation] = useState(client.vacation || null);
  const [showVacationModal, setShowVacationModal] = useState(false);
  const days = useMemo(() => buildProgramDays(program, logs), [program, logs]);
  async function persist(nextProgram, nextLogs) {
    updateClient({ ...client, program: nextProgram, trainingLogs: nextLogs });
    let failed = null;
    if (nextProgram) { const r = await upsertSection(client.id, "program", nextProgram); if (r?.error) failed = r.error; }
    if (nextLogs) { const r = await upsertSection(client.id, "training_logs", nextLogs); if (r?.error) failed = r.error; }
    if (failed) alert(`Heads up: the server rejected this save (${failed.message || failed}). It's kept safely on this device and will keep retrying, but if you see this repeatedly, the database needs attention - don't clear your browser data in the meantime.`);
  }
  function saveProgram(p) { setProgram(p); persist(p, logs); setBuilder(false); setWeekNum(currentProgramWeek(p)); }
  async function saveVacation(data) {
    const next = { ...vacation, ...data, completedDates: vacation?.completedDates || [] };
    setVacation(next);
    updateClient({ ...client, vacation: next });
    await upsertSection(client.id, "vacation_mode", next);
    setShowVacationModal(false);
  }
  async function endVacation() {
    const next = { ...vacation, endDate: isoDate(addDays(new Date(), -1)) };
    setVacation(next);
    updateClient({ ...client, vacation: next });
    await upsertSection(client.id, "vacation_mode", next);
    setShowVacationModal(false);
  }
  async function toggleVacationDoneToday() {
    const today = isoDate();
    const completedDates = vacation.completedDates || [];
    const next = { ...vacation, completedDates: completedDates.includes(today) ? completedDates.filter((d) => d !== today) : [...completedDates, today] };
    setVacation(next);
    updateClient({ ...client, vacation: next });
    await upsertSection(client.id, "vacation_mode", next);
  }
  function saveLogs(l) { setLogs(l); persist(program, l); }
  function startOrContinue(day) {
    const existing = sessionForWorkout(logs, day.week.id, day.workout.id);
    if (existing && existing.status === "in_progress") { setLive(existing); return; }
    const fresh = startSession(program, day.week, day.workout);
    setLive(fresh);
    saveLogs(upsertSessionInLogs(logs, fresh));
  }
  function updateLive(session) { setLive(session); saveLogs(upsertSessionInLogs(logs, session)); }
  function saveCoachNote(session, coachNote) { saveLogs(upsertSessionInLogs(logs, { ...session, coachNote })); }
  if (live && program) {
    const liveWeek = program.weeks.find((w) => w.id === live.weekId);
    const liveWorkout = liveWeek?.workouts.find((w) => w.id === live.workoutId);
    const logsBefore = { ...logs, sessions: (logs?.sessions || []).filter((s) => s.id !== live.id) };
    return <WorkoutSession client={client} program={program} week={liveWeek} workout={liveWorkout} session={live} logsBefore={logsBefore} onUpdate={updateLive} onFinish={() => { setLive(null); setOpenKey(null); }} onExit={() => setLive(null)} />;
  }
  const openDay = openKey ? days.find((d) => d.key === openKey) : null;
  const todayISO = isoDate(new Date());
  return (
    <div style={{ display: "grid", gap: isMobile ? 10 : 14 }}>
      <Card style={{ padding: isMobile ? 12 : 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 10, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 1000 }}>{program?.name || "No program yet"}</div>
            {program && <div style={{ color: BRAND.muted, fontSize: 13 }}>{program.goal} · {program.weeks?.length || 0} weeks{program.startDate ? ` · starts ${program.startDate}` : ""}</div>}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {program && isCoach && <Button variant="dark" disabled={pdfBusy} onClick={async () => { setPdfBusy(true); const { blob, filename } = await downloadProgramPDF2(client, program); await sharePdfBlob(blob, filename, program.name); setPdfBusy(false); }}>{pdfBusy ? "..." : "Share"}</Button>}
            {isCoach && <Button variant="dark" onClick={() => setShowVacationModal(true)}>{isVacationActive(vacation) ? "Vacation Mode" : "Set Vacation Mode"}</Button>}
            {isCoach && <Button variant="dark" onClick={() => setBuilder(true)}>{program ? "Edit Program" : "Build Program"}</Button>}
          </div>
        </div>
      </Card>
      <VacationBanner vacation={vacation} isCoach={isCoach} onEdit={() => setShowVacationModal(true)} onToggleDone={toggleVacationDoneToday} doneToday={(vacation?.completedDates || []).includes(isoDate())} />
      {showVacationModal && <VacationModeModal client={client} vacation={vacation} onClose={() => setShowVacationModal(false)} onSave={saveVacation} onEnd={endVacation} />}
      {!program && <Card><div style={{ color: BRAND.muted }}>{isCoach ? "No program assigned. Click Build Program to design one." : "Your coach hasn't assigned a program yet."}</div></Card>}
      {program && openDay && (
        openDay.state === "completed"
          ? <SessionReport client={client} day={openDay} logs={logs} isCoach={isCoach} onBack={() => setOpenKey(null)} onSaveCoachNote={saveCoachNote} onStart={startOrContinue} />
          : <DayDetail day={openDay} onBack={() => setOpenKey(null)} onStart={startOrContinue} canStart={!openDay.isRest && (isCoach || (openDay.dateISO >= isoDate(startOfWeek(new Date())) && openDay.dateISO <= isoDate(addDays(startOfWeek(new Date()), 6))))} />
      )}
      {program && !openDay && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.7 }}>
              Week {weekNum} of {program.weeks.length}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Button variant={mode === "week" ? "gold" : "dark"} onClick={() => setMode("week")} style={{ fontSize: 12, padding: "7px 14px" }}>Week</Button>
              <Button variant={mode === "month" ? "gold" : "dark"} onClick={() => setMode("month")} style={{ fontSize: 12, padding: "7px 14px" }}>Month</Button>
            </div>
          </div>
          {mode === "week"
            ? <ProgramWeekView program={program} days={days} weekNum={weekNum} setWeekNum={setWeekNum} onOpen={(d) => setOpenKey(d.key)} />
            : <ProgramMonthView days={days} cursor={monthCursor} setCursor={setMonthCursor} currentWeek={currentProgramWeek(program)} onOpen={(d) => setOpenKey(d.key)} />}
        </>
      )}
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
          <Field label="Monthly price USD" value={form.profile.price || ""} onChange={(v) => setForm({ ...form, profile: { ...form.profile, price: v } })} type="number" />
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
const NOTIF_ICONS = { message: "\u{1F4AC}", birthday: "\u{1F382}", payment: "\u{1F4B0}", food: "\u{1F37D}️", exercise: "\u{1F4AA}" };
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
// ---------- Coach shell: Home · Clients · Alerts · Settings ----------
function CoachPaymentsScreen({ clients, selectClient, onBack }) {
  const withDue = clients.filter((c) => c.paymentDueDate);
  const rank = (c) => { const s = paymentStatus(c); if (s.color === BRAND.red) return 0; if (s.color === BRAND.gold) return 1; if (s.color === BRAND.green) return 3; return 2; };
  const sorted = [...withDue].sort((a, b) => rank(a) - rank(b));
  const overdue = withDue.filter((c) => !c.paymentPaid && daysUntil(c.paymentDueDate) < 0).length;
  const dueSoon = withDue.filter((c) => !c.paymentPaid && daysUntil(c.paymentDueDate) >= 0 && daysUntil(c.paymentDueDate) <= 5).length;
  const paid = withDue.filter((c) => c.paymentPaid).length;
  return <div style={{ display: "grid", gap: 14 }}>
    <Button variant="ghost" onClick={onBack} style={{ padding: "8px 14px", justifySelf: "start" }}>‹ Back</Button>
    <div style={{ fontSize: 26, fontWeight: 900 }}>Payments</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
      <Mini label="Overdue" value={String(overdue)} color={overdue ? BRAND.red : BRAND.text} />
      <Mini label="Due soon" value={String(dueSoon)} color={dueSoon ? BRAND.gold : BRAND.text} />
      <Mini label="Paid" value={String(paid)} color={BRAND.green} />
    </div>
    <Card>
      <div style={{ fontSize: 16, fontWeight: 1000, marginBottom: 4 }}>By client</div>
      {sorted.length === 0 && <div style={{ color: BRAND.muted }}>No payment dates set yet. Add a due date on a client to track it here.</div>}
      {sorted.map((c) => { const st = paymentStatus(c); return <div key={c.id} onClick={() => selectClient(c)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${BRAND.line}`, paddingTop: 10, marginTop: 10, cursor: "pointer" }}>
        <div><div style={{ fontWeight: 900 }}>{c.name}</div><div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 700 }}>{c.paymentDueDate}</div></div>
        <div style={{ color: st.color, fontWeight: 900, fontSize: 13, textAlign: "right" }}>{st.label}</div>
      </div>; })}
    </Card>
  </div>;
}
function CoachBroadcastScreen({ clients, refresh, onBack }) {
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(null);
  async function sendAll() {
    if (!msg.trim()) return;
    if (!confirm(`Send this message to all ${clients.length} clients?`)) return;
    setSending(true);
    const text = msg.trim();
    for (const c of clients) {
      const entry = { id: uid(), from: "coach", text, date: new Date().toISOString(), read: false };
      const list = [...(c.messages || []), entry];
      await upsertSection(c.id, "messages", { list });
    }
    if (refresh) await refresh();
    setSentCount(clients.length); setMsg(""); setSending(false);
  }
  return <div style={{ display: "grid", gap: 14 }}>
    <Button variant="ghost" onClick={onBack} style={{ padding: "8px 14px", justifySelf: "start" }}>‹ Back</Button>
    <div><div style={{ fontSize: 26, fontWeight: 900 }}>Broadcast</div><div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginTop: 3 }}>Send one message to every client. Each one receives it in their Messages.</div></div>
    {sentCount != null && <Card style={{ borderColor: BRAND.green }}><div style={{ color: BRAND.green, fontWeight: 900 }}>Sent to {sentCount} client{sentCount === 1 ? "" : "s"}.</div></Card>}
    <Card style={{ display: "grid", gap: 10 }}>
      <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Write your message to all clients..." style={inputStyle({ minHeight: 130, resize: "vertical" })} />
      <Button onClick={sendAll} disabled={sending || !clients.length} style={{ width: "100%" }}>{sending ? "Sending..." : `Send to all ${clients.length} client${clients.length === 1 ? "" : "s"}`}</Button>
    </Card>
  </div>;
}
function CoachIntakeFormsScreen({ user, onBack }) {
  return <div style={{ display: "grid", gap: 14 }}>
    <Button variant="ghost" onClick={onBack} style={{ padding: "8px 14px", justifySelf: "start" }}>‹ Back</Button>
    <div><div style={{ fontSize: 26, fontWeight: 900 }}>Intake Form</div><div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginTop: 3 }}>The application every new client completes in-app. Their answers land on their Profile.</div></div>
    {INTAKE_FORM.map((s) => <Card key={s.name}>
      <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.6 }}>{s.name}</div>
      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>{s.fields.map((f) => <div key={f.id} style={{ borderTop: `1px solid ${BRAND.line}`, paddingTop: 8 }}><div style={{ fontWeight: 800, fontSize: 14 }}>{f.q}{f.req ? "" : "  (optional)"}</div>{f.options && <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 600, marginTop: 3 }}>{f.options.join("  ·  ")}</div>}{f.type === "rating" && <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 600, marginTop: 3 }}>Rating 1 to 5</div>}</div>)}</div>
    </Card>)}
  </div>;
}
function CoachAutomationsScreen({ user, onBack }) {
  const DEFAULTS = { staleWorkout: true, staleWorkoutDays: 3, checkinReminder: true, paymentReminder: true, welcomeMessage: false };
  const [rules, setRules] = useState(null);
  useEffect(() => {
    supabase.from("trainer_data").select("data").eq("trainer_id", user.id).eq("section", "automations").maybeSingle().then(({ data }) => setRules({ ...DEFAULTS, ...(data?.data?.rules || {}) }));
  }, [user.id]);
  async function persist(next) { setRules(next); await upsertTrainerData(user.id, "automations", { rules: next }); }
  if (rules === null) return <div style={{ display: "grid", gap: 14 }}><Button variant="ghost" onClick={onBack} style={{ padding: "8px 14px", justifySelf: "start" }}>‹ Back</Button><Card><div style={{ color: BRAND.muted }}>Loading...</div></Card></div>;
  const Row = ({ k, title, desc }) => <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderTop: `1px solid ${BRAND.line}`, paddingTop: 12, marginTop: 12 }}>
    <div><div style={{ fontWeight: 900, fontSize: 14 }}>{title}</div><div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 600, marginTop: 2 }}>{desc}</div></div>
    <button onClick={() => persist({ ...rules, [k]: !rules[k] })} style={{ width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", background: rules[k] ? BRAND.green : BRAND.card2, position: "relative", flexShrink: 0 }}><span style={{ position: "absolute", top: 3, left: rules[k] ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s" }} /></button>
  </div>;
  return <div style={{ display: "grid", gap: 14 }}>
    <Button variant="ghost" onClick={onBack} style={{ padding: "8px 14px", justifySelf: "start" }}>‹ Back</Button>
    <div><div style={{ fontSize: 26, fontWeight: 900 }}>Automations</div><div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginTop: 3 }}>Rules that keep clients on track in the background.</div></div>
    <Card style={{ paddingTop: 4 }}>
      <Row k="staleWorkout" title="Inactivity nudge" desc={`Remind clients who have not logged a workout in ${rules.staleWorkoutDays} days`} />
      <Row k="checkinReminder" title="Weekly check-in reminder" desc="Nudge clients whose weekly check-in is due" />
      <Row k="paymentReminder" title="Payment reminder" desc="Remind clients before a payment is due" />
      <Row k="welcomeMessage" title="Welcome message" desc="Auto-message new clients when they join" />
    </Card>
    <Card style={{ borderColor: `${BRAND.gold}44` }}><div style={{ color: BRAND.gold, fontWeight: 900, fontSize: 13 }}>Heads up</div><div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 600, marginTop: 4, lineHeight: 1.5 }}>These rules are saved, but sending on a schedule needs a small Supabase scheduled function (cron), since the app cannot run timers while it is closed. Ask me to add it when you want automations to actually fire.</div></Card>
  </div>;
}

function CoachContentScreen({ user, onBack }) {
  const CATS = { Training: BRAND.orange, Nutrition: BRAND.green, Mindset: BRAND.purple, Recovery: BRAND.blue };
  const cats = ["Training", "Nutrition", "Mindset", "Recovery"];
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [cat, setCat] = useState("Training");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  useEffect(() => { loadArticles(user.id).then((a) => { setArticles(a); setLoading(false); }); }, [user.id]);
  async function persist(next) { setArticles(next); await upsertTrainerData(user.id, "articles", { articles: next }); }
  async function publish() {
    if (!title.trim()) return;
    setSaving(true);
    const mins = Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 200)) + " min";
    const next = editId
      ? articles.map((a) => (a.id === editId ? { ...a, title: title.trim(), cat, body, read: mins } : a))
      : [{ id: uid(), title: title.trim(), cat, body, read: mins, date: isoDate(), isNew: true }, ...articles];
    await persist(next);
    setTitle(""); setBody(""); setCat("Training"); setEditId(null); setSaving(false);
  }
  function edit(a) { setEditId(a.id); setTitle(a.title); setCat(a.cat); setBody(a.body || ""); }
  async function remove(id) { if (!confirm("Delete this article?")) return; await persist(articles.filter((a) => a.id !== id)); }
  return <div style={{ display: "grid", gap: 14 }}>
    <Button variant="ghost" onClick={onBack} style={{ padding: "8px 14px", justifySelf: "start" }}>‹ Back</Button>
    <div><div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 1.5 }}>Forge Academy</div><div style={{ fontSize: 26, fontWeight: 900 }}>{editId ? "Edit article" : "Write an article"}</div></div>
    <Card style={{ display: "grid", gap: 10 }}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={inputStyle()} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{cats.map((c) => <button key={c} onClick={() => setCat(c)} style={{ fontSize: 12, fontWeight: 900, color: cat === c ? "#000" : BRAND.muted, background: cat === c ? CATS[c] : BRAND.card2, border: `1px solid ${cat === c ? CATS[c] : BRAND.line}`, borderRadius: 999, padding: "8px 12px", cursor: "pointer" }}>{c}</button>)}</div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your article. Every client sees this in their Learn tab." style={inputStyle({ minHeight: 150, resize: "vertical" })} />
      <div style={{ display: "flex", gap: 8 }}><Button onClick={publish} disabled={saving} style={{ flex: 1 }}>{saving ? "Publishing..." : editId ? "Update article" : "Publish to all clients"}</Button>{editId && <Button variant="dark" onClick={() => { setEditId(null); setTitle(""); setBody(""); }}>Cancel</Button>}</div>
    </Card>
    <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.7 }}>Published ({articles.length})</div>
    {loading && <Card><div style={{ color: BRAND.muted }}>Loading...</div></Card>}
    {!loading && articles.length === 0 && <Card><div style={{ color: BRAND.muted, fontSize: 14, fontWeight: 600 }}>No articles yet. Write your first one above.</div></Card>}
    {articles.map((a) => <Card key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
      <div style={{ minWidth: 0 }}><div style={{ fontWeight: 1000, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div><div style={{ color: CATS[a.cat] || BRAND.muted, fontSize: 11, fontWeight: 900, marginTop: 3 }}>{a.cat} · {a.date}</div></div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}><Button variant="dark" onClick={() => edit(a)}>Edit</Button><Button variant="red" onClick={() => remove(a.id)}>x</Button></div>
    </Card>)}
  </div>;
}

function CoachToolsTab({ onOpen }) {
  const isMobile = useIsMobile(520);
  const TOOLS = [
    { key: "templates", name: "Programs", meta: "Templates & builder", color: BRAND.purple },
    { key: "exercise_library", name: "Exercise Library", meta: "Custom moves & video", color: BRAND.orange },
    { key: "calendar", name: "Calendar", meta: "Sessions & bookings", color: BRAND.cyan },
    { key: "analytics", name: "Analytics", meta: "Adherence & trends", color: BRAND.green },
    { key: "trials", name: "Trials", meta: "Consults & assessments", color: BRAND.red },
    { key: "content", name: "Content", meta: "Forge Academy articles", color: BRAND.blue },
    { key: "payments", name: "Payments", meta: "Plans & invoices", color: BRAND.green },
    { key: "forms", name: "Intake Forms", meta: "Onboarding & health", color: BRAND.cyan },
  ];
  return <div style={{ display: "grid", gap: 14 }}>
    <div><div style={{ fontSize: 26, fontWeight: 900 }}>Tools</div><div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginTop: 3 }}>Everything you run your coaching with</div></div>
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(auto-fit,minmax(150px,1fr))", gap: isMobile ? 12 : 14 }}>
      {TOOLS.map((t) => <button key={t.key} onClick={() => onOpen(t.key)} style={{ textAlign: "left", cursor: "pointer", background: BRAND.card, border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: 14 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${t.color}22`, display: "grid", placeItems: "center", marginBottom: 10 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: t.color, display: "block" }} /></div>
        <div style={{ fontSize: 13, fontWeight: 1000 }}>{t.name}</div>
        <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 700, marginTop: 3 }}>{t.meta}</div>
      </button>)}
    </div>
  </div>;
}
function CoachToolPlaceholder({ screen, onBack }) {
  const META = {
    content: { name: "Content", desc: "Write articles for your Forge Academy and publish them to the Learn tab for all clients." },
    payments: { name: "Payments", desc: "Plans, invoices, and PayPal across all your clients." },
    forms: { name: "Intake Forms", desc: "Onboarding and health questionnaires new clients complete before starting." },
    broadcast: { name: "Broadcast", desc: "Send one message to every client at once." },
    automations: { name: "Automations", desc: "Auto check-in reminders, nudges, and sequences." },
  };
  const m = META[screen] || { name: "Tool", desc: "" };
  return <div style={{ display: "grid", gap: 12 }}>
    <Button variant="ghost" onClick={onBack} style={{ padding: "8px 14px", justifySelf: "start" }}>‹ Back</Button>
    <div style={{ fontSize: 26, fontWeight: 900 }}>{m.name}</div>
    <Card><div style={{ color: BRAND.muted, fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>{m.desc}</div><div style={{ color: BRAND.dim, fontSize: 12, fontWeight: 700, marginTop: 12 }}>The tab and navigation are wired — this screen gets built in a later phase.</div></Card>
  </div>;
}

const COACH_NAV = [
  { key: "home", label: "Home", icon: "home" },
  { key: "clients", label: "Clients", icon: "clients" },
  { key: "tools", label: "Tools", icon: "templates" },
  { key: "alerts", label: "Alerts", icon: "bell" },
  { key: "settings", label: "Settings", icon: "gear" },
];
function CoachBottomNav({ tab, setTab, unread }) {
  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 90, background: BRAND.panel, borderTop: `1px solid ${BRAND.line}`, display: "flex", justifyContent: "space-around", paddingTop: 10, paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
      {COACH_NAV.map((item) => {
        const active = tab === item.key;
        const color = active ? BRAND.gold : BRAND.dim;
        return (
          <button key={item.key} onClick={() => setTab(item.key)} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flex: 1, minWidth: 0, position: "relative", padding: 0 }}>
            <div style={{ width: 42, height: 28, borderRadius: 999, background: active ? `${BRAND.gold}22` : "transparent", display: "grid", placeItems: "center" }}>
              {item.icon === "gear" || item.icon === "home" ? <NavIcon name={item.icon} color={color} /> : <CoachIcon name={item.icon} size={21} color={color} />}
              {item.key === "alerts" && unread > 0 && <div style={{ position: "absolute", top: -2, right: 10, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: BRAND.red, color: "#fff", fontSize: 9, fontWeight: 900, display: "grid", placeItems: "center", border: `2px solid ${BRAND.panel}` }}>{unread > 9 ? "9+" : unread}</div>}
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color }}>{item.label}</div>
          </button>
        );
      })}
    </div>
  );
}
function CoachTile({ icon, name, meta, count, quiet, wide, isTablet, color = BRAND.gold, onClick }) {
  return (
    <button onClick={onClick} style={{
      gridColumn: wide ? "1 / -1" : "auto",
      background: BRAND.card, border: `1px solid ${BRAND.line}`, borderRadius: isTablet ? 26 : 22,
      padding: isTablet ? 24 : 18, minHeight: wide ? (isTablet ? 110 : 96) : (isTablet ? 172 : 136), cursor: "pointer", position: "relative",
      display: "flex", flexDirection: wide ? "row" : "column", alignItems: wide ? "center" : "flex-start",
      justifyContent: wide ? "flex-start" : "space-between", gap: wide ? 16 : 0, textAlign: "left", minWidth: 0,
    }}>
      {count != null && !wide && (
        <div style={{ position: "absolute", top: isTablet ? 20 : 16, right: isTablet ? 20 : 16, minWidth: isTablet ? 26 : 22, height: isTablet ? 26 : 22, padding: "0 7px", borderRadius: 999, background: quiet ? "transparent" : color, border: quiet ? `1px solid ${BRAND.line}` : "none", color: quiet ? BRAND.dim : "#000", fontSize: isTablet ? 13 : 11, fontWeight: 1000, display: "grid", placeItems: "center" }}>{count}</div>
      )}
      <div style={{ width: isTablet ? 66 : 52, height: isTablet ? 66 : 52, borderRadius: isTablet ? 20 : 16, background: `${color}22`, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <CoachIcon name={icon} size={isTablet ? 32 : 26} color={color} />
      </div>
      <div style={{ flex: wide ? 1 : "none", width: wide ? "auto" : "100%", minWidth: 0, marginTop: wide ? 0 : "auto" }}>
        <div style={{ fontWeight: 900, fontSize: 15, color: BRAND.text, textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
        <div style={{ color, fontSize: 12, fontWeight: 700, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</div>
      </div>
      {wide && <NavIcon name="back" size={18} color={BRAND.dim} rotate={180} />}
    </button>
  );
}
function coachStats(clients) {
  const lastSessionOf = (c) => (c.trainingLogs?.sessions || []).filter((s) => s.status === "completed" && s.date).map((s) => s.date).sort().pop();
  const cold = clients.filter((c) => {
    const last = lastSessionOf(c);
    const d = last ? daysSince(last) : (c.joinDate ? daysSince(c.joinDate) : null);
    return d !== null && d >= 7;
  });
  const scored = clients.map((c) => overallAdherence(c.program, c.trainingLogs)).filter((a) => a.total > 0);
  const adherence = scored.length ? Math.round(scored.reduce((s, a) => s + a.pct, 0) / scored.length) : null;
  const todayISO = isoDate(new Date());
  const sessionsToday = clients.reduce((n, c) => {
    const days = buildProgramDays(c.program, c.trainingLogs);
    return n + days.filter((d) => d.dateISO === todayISO && !d.isRest).length;
  }, 0);
  return { cold, adherence, sessionsToday, lastSessionOf };
}
function CoachHome({ trainer, user, clients, notifications, templatesCount, trialsCount, onTile, onOpenClients }) {
  const isMobile = useIsMobile(520);
  const isTablet = useIsMobile(1180) && !isMobile;
  const { cold, adherence, sessionsToday } = coachStats(clients);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  const name = (trainer?.name || user.email?.split("@")[0] || "Coach").split(" ")[0];
  const flagged = cold.length;
  const [customExerciseCount, setCustomExerciseCount] = useState(0);
  const [todaysSessions, setTodaysSessions] = useState(null);
  useEffect(() => { countTodaysCalendarSessions(clients, user.id).then(setTodaysSessions); }, [clients, user.id]);
  useEffect(() => { loadExerciseLibraryData(user.id).then((items) => setCustomExerciseCount(items.length)); }, [user.id]);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.9 }}>
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </div>
        <div style={{ fontSize: isMobile ? 26 : 30, fontWeight: 900, letterSpacing: -0.4, marginTop: 4 }}>{greeting}, {name}</div>
        <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginTop: 3 }}>
          {todaysSessions ?? "..."} session{todaysSessions === 1 ? "" : "s"} scheduled today{flagged > 0 ? ` · ${flagged} need attention` : ""}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        <Mini label="Active" value={String(clients.length)} color={BRAND.gold} />
        <Mini label="Adherence" value={adherence != null ? `${adherence}%` : "-"} color={BRAND.green} />
        <Mini label="Alerts" value={String(notifications.length)} color={notifications.length > 0 ? BRAND.red : BRAND.text} />
      </div>
      <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.7, marginTop: 4 }}>Go to</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: isTablet ? 18 : 12 }}>
        <CoachTile isTablet={isTablet} icon="clients" name="Clients" meta={`${clients.length} active${flagged ? ` · ${flagged} flagged` : ""}`} count={clients.length} color={BRAND.gold} onClick={onOpenClients} />
        <CoachTile isTablet={isTablet} icon="templates" name="Templates" meta={`${templatesCount} program${templatesCount === 1 ? "" : "s"} saved`} count={templatesCount} quiet color={BRAND.purple} onClick={() => onTile("templates")} />
        <CoachTile isTablet={isTablet} icon="calendar" name="Calendar" meta={`${todaysSessions ?? "..."} session${todaysSessions === 1 ? "" : "s"} today`} count={todaysSessions || null} color={BRAND.cyan} onClick={() => onTile("calendar")} />
        <CoachTile isTablet={isTablet} icon="analytics" name="Analytics" meta="Client activity trends" color={BRAND.green} onClick={() => onTile("analytics")} />
        <CoachTile isTablet={isTablet} icon="exlib" name="Exercise Library" meta={customExerciseCount ? `${customExerciseCount} custom exercise${customExerciseCount === 1 ? "" : "s"}` : "Add your own with video"} color={BRAND.orange} onClick={() => onTile("exercise_library")} />
        <CoachTile isTablet={isTablet} icon="trials" name="Trials" meta={trialsCount ? `${trialsCount} saved · consultations & assessments` : "Consultations & fitness assessments"} count={trialsCount || null} color={BRAND.red} onClick={() => onTile("trials")} />
      </div>
    </div>
  );
}
function CoachTemplates({ user, clients, onBack }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null);
  useEffect(() => {
    let active = true;
    loadTrainerTemplates(user.id).then((list) => { if (active) { setTemplates(list); setLoading(false); } });
    return () => { active = false; };
  }, [user.id]);
  async function save(next) { setTemplates(next); await upsertTrainerData(user.id, "templates", { templates: next }); }
  function remove(t) {
    if (!confirm(`Delete the template "${t.name}"? Programs already assigned to clients are not affected.`)) return;
    save(templates.filter((x) => x.id !== t.id));
  }
  async function saveEditedTemplate(updatedProgram) {
    const next = templates.map((t) => (t.id === editingTemplate.id ? { ...t, name: updatedProgram.name || t.name, goal: updatedProgram.goal, weeks: updatedProgram.weeks.length, program: updatedProgram } : t));
    await save(next);
    setEditingTemplate(null);
  }
  if (editingTemplate) {
    return <ProgramBuilder
      client={{ id: null, trainer_id: user.id, name: editingTemplate.name, goal: editingTemplate.goal }}
      program={editingTemplate.program}
      onClose={() => setEditingTemplate(null)}
      onSave={saveEditedTemplate}
    />;
  }
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Button variant="ghost" onClick={onBack} style={{ justifySelf: "start", padding: "8px 14px" }}>‹ Back</Button>
      <div>
        <div style={{ fontSize: 26, fontWeight: 900 }}>Templates</div>
        <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginTop: 3 }}>{templates.length} saved program{templates.length === 1 ? "" : "s"}</div>
      </div>
      {loading && <Card><div style={{ color: BRAND.muted }}>Loading...</div></Card>}
      {!loading && templates.length === 0 && (
        <Card>
          <div style={{ color: BRAND.text, fontWeight: 800, marginBottom: 6 }}>No templates yet</div>
          <div style={{ color: BRAND.muted, fontSize: 13, lineHeight: 1.55 }}>
            Open a client, build a program, then hit <b style={{ color: BRAND.gold }}>Save as Template</b> in the builder. It'll show up here and you can load it into any client.
          </div>
        </Card>
      )}
      {templates.map((t) => {
        const usedBy = clients.filter((c) => c.program?.templateId === t.id).length;
        return (
          <Card key={t.id} style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{t.name}</div>
                <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 600, marginTop: 3 }}>
                  {[t.goal, `${t.weeks} week${t.weeks === 1 ? "" : "s"}`, t.savedAt ? `saved ${String(t.savedAt).slice(0, 10)}` : null].filter(Boolean).join(" · ")}
                  {usedBy > 0 ? ` · used by ${usedBy}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="dark" onClick={() => setEditingTemplate(t)} style={{ fontSize: 12, padding: "8px 14px" }}>Edit</Button>
                <Button variant="red" onClick={() => remove(t)} style={{ fontSize: 12, padding: "8px 14px" }}>Delete</Button>
              </div>
            </div>
          </Card>
        );
      })}
      <Card style={{ background: BRAND.card2 }}>
        <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 600, lineHeight: 1.55 }}>
          To use a template: open a client → Program → Edit Program → <b style={{ color: BRAND.gold }}>Load from template</b>.
        </div>
      </Card>
    </div>
  );
}
function CoachAnalytics({ clients, selectClient, onBack }) {
  const isMobile = useIsMobile(520);
  const { cold, adherence, lastSessionOf } = coachStats(clients);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const pbsThisMonth = clients.reduce((n, c) => n + recentPBsAcrossHistory(c.trainingLogs, 20).filter((pb) => pb.date && pb.date.slice(0, 7) === thisMonth).length, 0);
  const overduePayments = clients.filter((c) => c.clientType === "Online" && paymentStatus(c).label?.toLowerCase().includes("overdue")).length;
  // Completed sessions bucketed into the last 8 calendar weeks, across every client.
  const weeks = [];
  const thisMonday = startOfWeek(new Date());
  for (let i = 7; i >= 0; i--) {
    const start = addDays(thisMonday, -i * 7);
    weeks.push({ start, startISO: isoDate(start), endISO: isoDate(addDays(start, 6)), count: 0 });
  }
  clients.forEach((c) => {
    (c.trainingLogs?.sessions || []).forEach((s) => {
      if (s.status !== "completed" || !s.date) return;
      const bucket = weeks.find((w) => s.date >= w.startISO && s.date <= w.endISO);
      if (bucket) bucket.count += 1;
    });
  });
  const maxWeek = Math.max(1, ...weeks.map((w) => w.count));
  const total = weeks.reduce((n, w) => n + w.count, 0);
  const rows = clients
    .map((c) => ({ client: c, adherence: overallAdherence(c.program, c.trainingLogs), last: lastSessionOf(c) }))
    .sort((a, b) => (a.adherence.pct || 0) - (b.adherence.pct || 0));
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Button variant="ghost" onClick={onBack} style={{ justifySelf: "start", padding: "8px 14px" }}>‹ Back</Button>
      <div>
        <div style={{ fontSize: 26, fontWeight: 900 }}>Analytics</div>
        <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginTop: 3 }}>Client activity, last 8 weeks</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        <Mini label="Sessions" value={String(total)} />
        <Mini label="Avg adherence" value={adherence != null ? `${adherence}%` : "-"} color={BRAND.green} />
        <Mini label="Going cold" value={String(cold.length)} color={cold.length > 0 ? BRAND.red : BRAND.text} />
        <Mini label="PBs this month" value={String(pbsThisMonth)} color={BRAND.cyan} />
        <Mini label="Payments overdue" value={String(overduePayments)} color={overduePayments > 0 ? BRAND.red : BRAND.text} />
      </div>
      <div>
        <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8 }}>Sessions completed per week</div>
        <Card style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 110 }}>
            {weeks.map((w, i) => {
              const isLast = i === weeks.length - 1;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 4 }}>
                  <div style={{ color: isLast ? BRAND.gold : BRAND.dim, fontSize: 10, fontWeight: 900 }}>{w.count}</div>
                  <div style={{ width: "100%", height: `${Math.max(3, (w.count / maxWeek) * 70)}%`, background: isLast ? BRAND.gold : BRAND.card2, borderRadius: "4px 4px 0 0" }} />
                  <div style={{ color: BRAND.dim, fontSize: 9, fontWeight: 800 }}>{isLast ? "Now" : `-${weeks.length - 1 - i}`}</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
      <div>
        <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8 }}>Adherence by client · lowest first</div>
        <Card style={{ padding: 16 }}>
          {rows.length === 0 && <div style={{ color: BRAND.muted, fontSize: 13 }}>No clients yet.</div>}
          {rows.map(({ client, adherence: a, last }, i) => {
            const pct = a.total ? a.pct : 0;
            const days = last ? daysSince(last) : null;
            const warn = pct < 70 || (days !== null && days >= 7);
            return (
              <div key={client.id} onClick={() => selectClient(client)} style={{ padding: "10px 0", borderTop: i === 0 ? "none" : `1px solid ${BRAND.card2}`, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: 13 }}>{client.name}</span>
                  <span style={{ color: warn ? BRAND.red : BRAND.muted, fontSize: 12, fontWeight: 800 }}>
                    {a.total ? `${pct}%` : "No program"}{days !== null ? ` · ${days}d ago` : ""}
                  </span>
                </div>
                <div style={{ height: 4, background: BRAND.card2, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: warn ? BRAND.red : BRAND.gold }} />
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
function CoachSettingsTab({ user, trainer, onEditProfile, clientsCount, syncStatus }) {
  const [busy, setBusy] = useState(false);
  async function logout() { setBusy(true); await supabase.auth.signOut(); }
  const Section = ({ t }) => <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.7, marginTop: 10, marginBottom: 2 }}>{t}</div>;
  const Row = ({ k, v, onClick, last }) => <div onClick={onClick} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: last ? "none" : `1px solid ${BRAND.line}`, cursor: onClick ? "pointer" : "default" }}><span style={{ fontWeight: 800, fontSize: 14 }}>{k}</span><span style={{ color: BRAND.muted, fontWeight: 900, fontSize: 12, whiteSpace: "nowrap" }}>{v}</span></div>;
  const syncLabel = syncStatus === "offline" ? "Offline" : syncStatus === "syncing" ? "Syncing" : "Synced";
  return <div style={{ display: "grid", gap: 12 }}>
    <div><div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 1000, letterSpacing: 1.5, textTransform: "uppercase" }}>Coach</div><div style={{ fontSize: 26, fontWeight: 900 }}>Settings</div></div>
    <Card onClick={onEditProfile} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 54, height: 54, borderRadius: "50%", background: BRAND.card2, border: `1px solid ${BRAND.line}`, overflow: "hidden", display: "grid", placeItems: "center", color: BRAND.gold, fontWeight: 1000, flexShrink: 0 }}>{trainer?.photo ? <img src={trainer.photo} alt="Coach" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(trainer?.name || user.email)}</div>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 900, fontSize: 17 }}>{trainer?.name || user.email?.split("@")[0]}</div><div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 600, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div><div style={{ color: BRAND.gold, fontSize: 12, fontWeight: 800, marginTop: 4 }}>Edit profile ›</div></div>
    </Card>
    <Section t="Brand" />
    <Card style={{ padding: "4px 16px" }}>
      <Row k="Business name" v={`${trainer?.name || "Set"} ›`} onClick={onEditProfile} />
      <Row k="Coach photo / logo" v={trainer?.photo ? "Set ›" : "Add ›"} onClick={onEditProfile} last />
    </Card>
    <Section t="Notifications" />
    <Card style={{ padding: "4px 16px" }}>
      <Row k="Automations & reminders" v="In Tools ›" last />
    </Card>
    <Section t="Payments" />
    <Card style={{ padding: "4px 16px" }}>
      <Row k="Provider" v="PayPal" />
      <Row k="Client payments" v="Per client ›" last />
    </Card>
    <Section t="Account" />
    <Card style={{ padding: "4px 16px" }}>
      <Row k="Active clients" v={String(clientsCount)} />
      <Row k="Sync" v={syncLabel} last />
    </Card>
    <Button variant="red" disabled={busy} onClick={logout} style={{ width: "100%", marginTop: 6 }}>{busy ? "Logging out..." : "Log Out"}</Button>
  </div>;
}

function CoachDashboard({ user, trainer, setTrainer, clients, setClients, selectClient, refresh, syncStatus = "online" }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tab, setTab] = useState("home");
  const [clientTypeFilter, setClientTypeFilter] = useState("1:1"); // In-Person by default
  const [screen, setScreen] = useState(null); // templates | calendar | analytics | trials
  const [toolOrigin, setToolOrigin] = useState("tools");
  const [query, setQuery] = useState("");
  const [templatesCount, setTemplatesCount] = useState(0);
  const [trialsCount, setTrialsCount] = useState(0);
  const isMobile = useIsMobile(520);
  const isTablet = useIsMobile(1180) && !isMobile;
  const filtered = clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) && (c.clientType || "1:1") === clientTypeFilter);
  const notifications = computeNotifications(clients);
  useEffect(() => {
    let active = true;
    loadTrainerTemplates(user.id).then((list) => { if (active) setTemplatesCount(list.length); });
    supabase.from("trainer_data").select("data").eq("trainer_id", user.id).eq("section", "trials").maybeSingle()
      .then(({ data }) => { if (active) setTrialsCount((data?.data?.trials || []).length); });
    return () => { active = false; };
  }, [user.id, screen]);
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
  function goHome() { setScreen(null); setTab(toolOrigin); }
  let body;
  if (screen === "templates") body = <CoachTemplates user={user} clients={clients} onBack={goHome} />;
  else if (screen === "calendar") body = <><Button variant="ghost" onClick={goHome} style={{ padding: "8px 14px", marginBottom: 12 }}>‹ Back</Button><Calendar clients={clients} refresh={refresh} user={user} /></>;
  else if (screen === "analytics") body = <CoachAnalytics clients={clients} selectClient={selectClient} onBack={goHome} />;
  else if (screen === "trials") body = <><Button variant="ghost" onClick={goHome} style={{ padding: "8px 14px", marginBottom: 12 }}>‹ Back</Button><Trials user={user} onConvert={convertTrialToClient} /></>;
  else if (screen === "exercise_library") body = <ExerciseLibraryScreen trainerId={user.id} onBack={goHome} />;
  else if (screen === "content") body = <CoachContentScreen user={user} onBack={goHome} />;
  else if (screen === "payments") body = <CoachPaymentsScreen clients={clients} selectClient={selectClient} onBack={goHome} />;
  else if (screen === "forms") body = <CoachIntakeFormsScreen user={user} onBack={goHome} />;
  else if (tab === "home") body = (
    <CoachHome
      trainer={trainer} user={user} clients={clients} notifications={notifications}
      templatesCount={templatesCount} trialsCount={trialsCount}
      onTile={(k) => { setToolOrigin("home"); setScreen(k); }} onOpenClients={() => setTab("clients")}
    />
  );
  else if (tab === "clients") body = (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontSize: 26, fontWeight: 900 }}>Clients</div>
        <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginTop: 3 }}>{filtered.length} {clientTypeFilter === "1:1" ? "in-person" : "online"}</div>
      </div>
      <div style={{ display: "flex", gap: 8, background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 999, padding: 4 }}>
        <button onClick={() => setClientTypeFilter("1:1")} style={{ flex: 1, padding: "10px 0", borderRadius: 999, border: "none", background: clientTypeFilter === "1:1" ? BRAND.gold : "transparent", color: clientTypeFilter === "1:1" ? "#000" : BRAND.muted, fontWeight: 900, fontSize: 13, cursor: "pointer" }}>In-Person</button>
        <button onClick={() => setClientTypeFilter("Online")} style={{ flex: 1, padding: "10px 0", borderRadius: 999, border: "none", background: clientTypeFilter === "Online" ? BRAND.gold : "transparent", color: clientTypeFilter === "Online" ? "#000" : BRAND.muted, fontWeight: 900, fontSize: 13, cursor: "pointer" }}>Online</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 10 }}>
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
      {filtered.length === 0 && <Card><div style={{ color: BRAND.muted }}>No {clientTypeFilter === "1:1" ? "in-person" : "online"} clients{query ? " match that search" : " yet"}.</div></Card>}
    </div>
  );
  else if (tab === "tools") body = <CoachToolsTab onOpen={(k) => { setToolOrigin("tools"); setScreen(k); }} />;
  else if (tab === "alerts") body = (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontSize: 26, fontWeight: 900 }}>Alerts</div>
        <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginTop: 3 }}>{notifications.length ? `${notifications.length} need${notifications.length === 1 ? "s" : ""} a look` : "All caught up"}</div>
      </div>
      <NotificationsTab notifications={notifications} selectClient={selectClient} />
    </div>
  );
  else body = <CoachSettingsTab user={user} trainer={trainer} onEditProfile={() => setShowSettings(true)} clientsCount={clients.length} syncStatus={syncStatus} />;
  return (
    <div style={{ minHeight: "100vh", background: BRAND.bg, color: BRAND.text, paddingBottom: 96 }}>
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(7,7,7,.93)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${BRAND.line}`, padding: isMobile ? "10px 12px" : "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: isMobile ? 38 : 44, height: isMobile ? 38 : 44, borderRadius: "50%", background: BRAND.card2, border: `1px solid ${BRAND.line}`, overflow: "hidden", display: "grid", placeItems: "center", color: BRAND.gold, fontWeight: 1000 }}>
            {trainer?.photo ? <img src={trainer.photo} alt="Coach" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(trainer?.name || user.email)}
          </div>
          <div>
            <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 1000, color: BRAND.gold, lineHeight: 1 }}>FORGE</div>
            <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900 }}>COACH {trainer?.name || user.email?.split("@")[0]}</div>
          </div>
        </div>
        <span style={{ color: syncStatus === "offline" ? BRAND.red : syncStatus === "syncing" ? BRAND.gold : BRAND.green, fontSize: 12, fontWeight: 1000 }}>
          {syncStatus === "offline" ? "Offline" : syncStatus === "syncing" ? "Syncing" : "Synced"}
        </span>
      </header>
      <main style={{ width: "100%", maxWidth: isMobile ? 480 : isTablet ? 960 : 1180, margin: "0 auto", padding: isMobile ? 12 : 16, boxSizing: "border-box", overflowX: "hidden" }}>
        {body}
      </main>
      <CoachBottomNav tab={screen ? toolOrigin : tab} setTab={(t) => { setScreen(null); setTab(t); }} unread={notifications.length} />
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
function LearnTab({ client }) {
  const CATS = { Training: BRAND.orange, Nutrition: BRAND.green, Mindset: BRAND.purple, Recovery: BRAND.blue };
  const cats = ["All", "Training", "Nutrition", "Mindset", "Recovery"];
  const [articles, setArticles] = useState(null);
  const [cat, setCat] = useState("All");
  const [open, setOpen] = useState(null);
  useEffect(() => { loadArticles(client.trainer_id).then(setArticles); }, [client.trainer_id]);
  const header = <div><div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 1.5 }}>Forge Academy</div><div style={{ fontSize: 24, fontWeight: 1000 }}>Learn</div></div>;
  if (open) {
    return <div style={{ display: "grid", gap: 12 }}><Card>
      <button onClick={() => setOpen(null)} style={{ background: "transparent", border: "none", color: BRAND.gold, fontWeight: 900, fontSize: 12, cursor: "pointer", padding: 0 }}>{"< Back"}</button>
      <div style={{ color: CATS[open.cat] || BRAND.muted, fontSize: 11, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 14 }}>{open.cat} · {open.read} read</div>
      <div style={{ fontSize: 22, fontWeight: 1000, marginTop: 8, lineHeight: 1.2 }}>{open.title}</div>
      <div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 800, marginTop: 6 }}>The Forge Method · {open.date}</div>
      <div style={{ color: "#d8d8d8", fontSize: 14, lineHeight: 1.65, marginTop: 16, whiteSpace: "pre-line", fontWeight: 600 }}>{open.body}</div>
    </Card></div>;
  }
  if (articles === null) return <div style={{ display: "grid", gap: 12 }}>{header}<Card><div style={{ color: BRAND.muted }}>Loading...</div></Card></div>;
  const src = articles.length ? articles : DEFAULT_ARTICLES;
  const list = cat === "All" ? src : src.filter((a) => a.cat === cat);
  return <div style={{ display: "grid", gap: 12 }}>
    {header}
    <>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>{cats.map((c) => <button key={c} onClick={() => setCat(c)} style={{ whiteSpace: "nowrap", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5, color: cat === c ? "#000" : BRAND.muted, background: cat === c ? BRAND.gold : BRAND.card2, border: `1px solid ${cat === c ? BRAND.gold : BRAND.line}`, borderRadius: 999, padding: "8px 13px", cursor: "pointer" }}>{c}</button>)}</div>
      {list.map((a) => <Card key={a.id} onClick={() => setOpen(a)} style={{ cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ color: CATS[a.cat] || BRAND.muted, fontSize: 11, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.5 }}>{a.cat}</div>{a.isNew && <span style={{ fontSize: 9, fontWeight: 1000, color: "#000", background: BRAND.gold, borderRadius: 999, padding: "3px 8px" }}>NEW</span>}</div>
        <div style={{ fontSize: 16, fontWeight: 1000, marginTop: 8, lineHeight: 1.25 }}>{a.title}</div>
        <div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 800, marginTop: 8 }}>{a.read} read · {a.date}</div>
      </Card>)}
      {list.length === 0 && <Card><div style={{ color: BRAND.muted }}>Nothing in {cat} yet.</div></Card>}
    </>
  </div>;
}

const INTAKE_FORM = [
  { name: "About you", lede: "Welcome to The Forge Method. This takes about four minutes and gives me everything I need to build your plan. The more honest you are here, the sharper it gets.", fields: [
    { id: "name", q: "Full name", type: "text", req: true },
    { id: "email", q: "Email", type: "email", req: true },
    { id: "phone", q: "WhatsApp number", type: "tel", req: true, hint: "Include the country code. This is how I will reply.", ph: "+971 5X XXX XXXX" },
    { id: "age", q: "Age", type: "number", req: true },
    { id: "city", q: "City and country", type: "text", req: true, ph: "Dubai, UAE" },
    { id: "sex", q: "Sex", type: "choice", req: true, hint: "Used for calorie and programming calculations only.", options: ["Female", "Male", "Prefer not to say"] },
  ] },
  { name: "Your goal", lede: "Be specific. Get in shape tells me nothing. Drop 8kg before my wedding in March tells me everything.", fields: [
    { id: "goal", q: "Main goal", type: "choice", req: true, options: ["Lose body fat", "Build muscle and size", "Lose fat and build muscle at the same time", "Get stronger on the main lifts", "Health, energy and habits", "Performance for a sport or event"] },
    { id: "target", q: "Put a number on it", type: "textarea", req: true, hint: "Weight, size, a lift, a time. Whatever makes it measurable." },
    { id: "deadline", q: "Is there a deadline?", type: "text", hint: "A wedding, a holiday, a competition. Leave blank if there is none." },
    { id: "why", q: "Why now?", type: "textarea", req: true, hint: "What changed recently that made you fill this in today?" },
  ] },
  { name: "Where you are now", lede: "No judgement here. I need the truth, not the version that sounds good.", fields: [
    { id: "exp", q: "Training experience", type: "choice", req: true, options: ["Beginner. Under a year, or starting again", "Intermediate. One to three years", "Advanced. Three years or more"] },
    { id: "now", q: "How often are you training right now?", type: "choice", req: true, options: ["Not at all", "1 to 2 a week", "3 to 4 a week", "5 or more"] },
    { id: "where", q: "Where will you train?", type: "choice", req: true, options: ["Full commercial gym", "Building or hotel gym, limited kit", "Home setup", "Mixed, I travel a lot"] },
    { id: "prev", q: "Have you worked with a coach before?", type: "choice", req: true, options: ["No", "Yes, it worked", "Yes, it did not work"] },
    { id: "history", q: "Your training history so far", type: "textarea", hint: "A few lines on what you have done and how it went." },
    { id: "blocker", q: "What has stopped you before?", type: "textarea", req: true, hint: "The real reason. Consistency, travel, injury, motivation, life getting in the way." },
  ] },
  { name: "Body and health", lede: "I need this to programme safely. Everything here stays private and is never shared.", fields: [
    { id: "height", q: "Height", type: "text", req: true, ph: "175cm" },
    { id: "weight", q: "Current weight", type: "text", req: true, ph: "92kg" },
    { id: "injuries", q: "Any injuries, current or past?", type: "textarea", req: true, hint: "Back, knees, shoulders, anything that changes how you move. Write none if none." },
    { id: "medical", q: "Anything a doctor has told you to be careful about?", type: "textarea", req: true, hint: "Heart, blood pressure, joints, pregnancy or postpartum. Write none if none." },
    { id: "cleared", q: "Are you currently cleared for exercise?", type: "choice", req: true, options: ["Yes", "Not sure", "No"] },
  ] },
  { name: "Food and lifestyle", lede: "Training is the easy part. This section is where results are usually won or lost.", fields: [
    { id: "eating", q: "How would you describe your eating right now?", type: "choice", req: true, options: ["No structure, I eat whatever is around", "Mostly sensible, but it falls apart at weekends", "I have tracked before and know roughly what I am doing", "I am tracking calories or macros right now"] },
    { id: "diet", q: "Any food restrictions?", type: "textarea", hint: "Allergies, vegetarian, halal, things you will not eat. Write none if none." },
    { id: "cook", q: "Who does the cooking?", type: "choice", req: true, options: ["Me", "Partner or family", "Mostly eat out", "Meal prep service"] },
    { id: "sleep", q: "Average sleep a night", type: "choice", req: true, options: ["Under 5h", "5 to 6h", "6 to 7h", "7h or more"] },
    { id: "job", q: "How active is your job?", type: "choice", req: true, options: ["Desk bound", "Mixed", "On my feet all day", "Physically demanding"] },
  ] },
  { name: "Priorities", lede: "Rank what matters most to you. It tells me where to put the emphasis.", fields: [
    { id: "priFat", q: "Fat loss", type: "rating", req: true, hint: "1 = low priority, 5 = top priority" },
    { id: "priMuscle", q: "Muscle gain", type: "rating", req: true, hint: "1 = low priority, 5 = top priority" },
    { id: "priStrength", q: "Strength and endurance", type: "rating", req: true, hint: "1 = low priority, 5 = top priority" },
    { id: "priMobility", q: "Mobility and flexibility", type: "rating", req: true, hint: "1 = low priority, 5 = top priority" },
  ] },
  { name: "Commitment", lede: "I would rather build a plan around three honest days than five imaginary ones.", fields: [
    { id: "days", q: "Days a week you can realistically train", type: "choice", req: true, options: ["2", "3", "4", "5", "6"] },
    { id: "mins", q: "Time per session", type: "choice", req: true, options: ["30 min", "45 min", "60 min", "75 min", "90 min"] },
    { id: "anything", q: "Anything else I should know?", type: "textarea", hint: "Optional. Anything that helps me build the right plan for you." },
  ] },
];
function IntakeForm({ client, updateClient, goTo }) {
  const allFields = INTAKE_FORM.flatMap((s) => s.fields);
  const [step, setStep] = useState(0);
  const [resp, setResp] = useState(() => {
    const seed = {};
    (client.intake?.answers || []).forEach((a) => { const f = allFields.find((x) => x.q === a.question); if (f) seed[f.id] = a.answer; });
    if (!seed.name && client.name) seed.name = client.name;
    if (!seed.email && client.email) seed.email = client.email;
    return seed;
  });
  const [saving, setSaving] = useState(false);
  const [showErr, setShowErr] = useState(false);
  const steps = INTAKE_FORM;
  const total = steps.length + 1;
  const isReview = step >= steps.length;
  const set = (id, v) => setResp((r) => ({ ...r, [id]: v }));
  const stepValid = isReview || steps[step].fields.every((f) => !f.req || String(resp[f.id] || "").trim());
  function next() { if (!stepValid) { setShowErr(true); return; } setShowErr(false); setStep(step + 1); }
  async function submit() {
    setSaving(true);
    const answers = allFields.map((f) => ({ question: f.q, answer: resp[f.id] || "" }));
    const intake = { answers, completedAt: isoDate() };
    await upsertSection(client.id, "intake", intake);
    updateClient({ ...client, intake });
    setSaving(false);
    goTo("home");
  }
  function renderField(f) {
    const missing = showErr && f.req && !String(resp[f.id] || "").trim();
    return <div key={f.id} style={{ marginBottom: 18 }}>
      <div style={{ fontWeight: 900, fontSize: 15 }}>{f.q}{f.req && <span style={{ color: BRAND.gold, fontSize: 11, marginLeft: 6, fontWeight: 800 }}>required</span>}</div>
      {f.hint && <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 600, marginTop: 3 }}>{f.hint}</div>}
      <div style={{ marginTop: 8 }}>
        {f.type === "rating"
          ? <div style={{ display: "flex", gap: 6 }}>{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => set(f.id, String(n))} style={{ flex: 1, padding: "12px 0", borderRadius: 10, cursor: "pointer", fontSize: 15, fontWeight: 1000, color: String(resp[f.id]) === String(n) ? "#000" : BRAND.text, background: String(resp[f.id]) === String(n) ? BRAND.gold : BRAND.card2, border: `1px solid ${String(resp[f.id]) === String(n) ? BRAND.gold : BRAND.line}` }}>{n}</button>)}</div>
          : f.type === "choice"
          ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{f.options.map((o) => <button key={o} type="button" onClick={() => set(f.id, o)} style={{ padding: "11px 15px", borderRadius: 11, cursor: "pointer", fontSize: 14, fontWeight: 700, textAlign: "left", color: resp[f.id] === o ? "#000" : BRAND.text, background: resp[f.id] === o ? BRAND.gold : BRAND.card2, border: `1px solid ${resp[f.id] === o ? BRAND.gold : BRAND.line}` }}>{o}</button>)}</div>
          : f.type === "textarea"
            ? <textarea value={resp[f.id] || ""} onChange={(e) => set(f.id, e.target.value)} placeholder={f.ph || ""} style={inputStyle({ minHeight: 84, resize: "vertical", borderColor: missing ? BRAND.red : BRAND.line })} />
            : <input type={f.type} value={resp[f.id] || ""} onChange={(e) => set(f.id, e.target.value)} placeholder={f.ph || ""} style={inputStyle({ borderColor: missing ? BRAND.red : BRAND.line })} />}
      </div>
      {missing && <div style={{ color: BRAND.red, fontSize: 12, fontWeight: 700, marginTop: 6 }}>Please answer this.</div>}
    </div>;
  }
  return <div style={{ display: "grid", gap: 8 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 1000, letterSpacing: 1.2, textTransform: "uppercase" }}>Application</div>
      <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900 }}>{Math.min(step + 1, total)} / {total}</div>
    </div>
    <div style={{ height: 4, background: BRAND.card2, borderRadius: 999, overflow: "hidden" }}><div style={{ height: 4, width: `${((step + 1) / total) * 100}%`, background: BRAND.gold, borderRadius: 999, transition: "width .3s" }} /></div>
    {!isReview && <><div style={{ fontSize: 26, fontWeight: 1000, margin: "14px 0 6px", textTransform: "uppercase" }}>{steps[step].name}</div><div style={{ color: BRAND.muted, fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{steps[step].lede}</div></>}
    <Card style={{ marginTop: 8 }}>
      {isReview
        ? <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 1000 }}>Review and submit</div>
            {allFields.map((f) => <div key={f.id} style={{ borderTop: `1px solid ${BRAND.line}`, paddingTop: 8 }}><div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 900 }}>{f.q}</div><div style={{ fontSize: 13, fontWeight: 600, color: resp[f.id] ? BRAND.text : BRAND.dim }}>{resp[f.id] || "—"}</div></div>)}
          </div>
        : steps[step].fields.map(renderField)}
    </Card>
    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
      {step > 0 && <Button variant="dark" onClick={() => { setShowErr(false); setStep(step - 1); }} style={{ flex: 1 }}>Back</Button>}
      {!isReview ? <Button onClick={next} style={{ flex: 2 }}>Next</Button> : <Button onClick={submit} disabled={saving} style={{ flex: 2 }}>{saving ? "Submitting..." : "Submit application"}</Button>}
    </div>
  </div>;
}

const CLIENT_BOTTOM_NAV = [
  { key: "home", label: "Home", icon: "home", group: ["home", "learn"] },
  { key: "program", label: "Train", icon: "train", group: ["program", "train_hub"] },
  { key: "nutrition", label: "Fuel", icon: "food", group: ["nutrition"] },
  { key: "progress_hub", label: "Progress", icon: "progress", group: ["progress_hub", "progress", "photos", "checkins", "measurements"] },
  { key: "me_hub", label: "Me", icon: "me", group: ["me_hub", "payments", "profile"] },
];
const DEFAULT_ARTICLES = [
  { id: "seed1", cat: "Training", title: "Progressive overload beats chasing soreness", read: "4 min", date: "Starter", body: "Soreness tells you a movement was unfamiliar, not that it was effective.\n\nThe real driver of progress is doing a little more over time: more weight, more reps, or cleaner execution. Each week, aim to beat one number from last week, even by a single rep." },
  { id: "seed2", cat: "Nutrition", title: "Protein: how much you actually need", read: "3 min", date: "Starter", body: "For most people training hard, 1.6 to 2.2g per kg of bodyweight per day covers it.\n\nSpread it across three to four meals. Whole foods first; a shake is a top-up, not a foundation." },
  { id: "seed3", cat: "Recovery", title: "Sleep is your best recovery tool", read: "3 min", date: "Starter", body: "You cannot out-train poor sleep.\n\nUnder six hours and strength, appetite, and mood all take a hit. Aim for seven to nine, keep a consistent wake time, and cut screens before bed." },
  { id: "seed4", cat: "Mindset", title: "Consistency beats intensity", read: "2 min", date: "Starter", body: "The best programme is the one you actually follow.\n\nThree solid sessions every week for a year will out-build a perfect plan you abandon in a month. Show up, log it, repeat." },
];
const ART_COVER = { Training: ["#FFA94D", "#6b3d0e"], Nutrition: ["#3DD68C", "#0f5233"], Mindset: ["#A78BFA", "#382559"], Recovery: ["#38BDF8", "#0d4463"] };
const ART_ICON = { Training: "🏋", Nutrition: "🥗", Mindset: "🧠", Recovery: "😴" };
function ProgressHub({ client, updateClient, isCoach }) {
  const [sub, setSub] = useState("trends");
  const tabs = [["trends", "Trends"], ["photos", "Photos"], ["checkins", "Check-in"]];
  return <div style={{ display: "grid", gap: 14 }}>
    <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>{tabs.map(([k, l]) => <button key={k} onClick={() => setSub(k)} style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap", padding: "9px 15px", borderRadius: 999, cursor: "pointer", color: sub === k ? "#000" : BRAND.muted, background: sub === k ? BRAND.gold : BRAND.card2, border: `1px solid ${sub === k ? BRAND.gold : BRAND.line}` }}>{l}</button>)}</div>
    {sub === "trends" && <ProgressTab client={client} />}
    {sub === "photos" && <TransformPhotos client={client} updateClient={updateClient} isCoach={isCoach} />}
    {sub === "checkins" && <CheckInsTab client={client} updateClient={updateClient} isCoach={isCoach} />}
  </div>;
}
function HomeLearnStrip({ client, goTo }) {
  const [arts, setArts] = useState([]);
  const ref = useRef(null);
  useEffect(() => { loadArticles(client.trainer_id).then((a) => setArts(a || [])); }, [client.trainer_id]);
  const list = arts.length ? arts : DEFAULT_ARTICLES;
  useEffect(() => {
    if (list.length < 2) return;
    const el = ref.current; if (!el) return;
    const id = setInterval(() => { if (!el) return; if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 1) el.scrollLeft = 0; else el.scrollLeft += 1; }, 30);
    return () => clearInterval(id);
  }, [arts]);
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 1000, letterSpacing: 0.5, textTransform: "uppercase" }}>Learn</div>
      {goTo && <button onClick={() => goTo("learn")} style={{ background: "none", border: "none", color: BRAND.muted, fontWeight: 900, fontSize: 11, cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.5 }}>See all ›</button>}
    </div>
    <div ref={ref} style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2 }}>
      {list.map((a) => { const cov = ART_COVER[a.cat] || ["#333", "#111"]; return <div key={a.id} onClick={() => goTo && goTo("learn")} style={{ flex: "0 0 210px", cursor: "pointer", borderRadius: 14, overflow: "hidden", border: `1px solid ${BRAND.line}`, background: BRAND.card }}>
        <div style={{ height: 96, background: `linear-gradient(140deg, ${cov[0]}, ${cov[1]})`, display: "grid", placeItems: "center", position: "relative" }}><span style={{ fontSize: 30 }}>{ART_ICON[a.cat] || "📖"}</span><div style={{ position: "absolute", top: 8, left: 8, fontSize: 8, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.5, color: "#000", background: "rgba(255,255,255,0.88)", borderRadius: 6, padding: "3px 7px" }}>{a.cat}</div></div>
        <div style={{ padding: 11 }}><div style={{ fontWeight: 1000, fontSize: 13, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.title}</div><div style={{ color: BRAND.dim, fontSize: 10, fontWeight: 800, marginTop: 6, textTransform: "uppercase" }}>{a.read} read</div></div>
      </div>; })}
    </div>
  </div>;
}

function ClientBottomNav({ tab, setTab, unreadMessages }) {
  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 90, background: BRAND.panel, borderTop: `1px solid ${BRAND.line}`, display: "flex", justifyContent: "space-around", paddingTop: 10, paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
      {CLIENT_BOTTOM_NAV.map((item) => {
        const active = item.group.includes(tab);
        return (
          <button key={item.key} onClick={() => setTab(item.key)} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flex: 1, minWidth: 0, position: "relative", padding: 0 }}>
            <div style={{ width: 42, height: 28, borderRadius: 999, background: active ? `${BRAND.gold}22` : "transparent", display: "grid", placeItems: "center" }}>
              <NavIcon name={item.icon} color={active ? BRAND.gold : BRAND.dim} />
              {item.key === "me_hub" && unreadMessages > 0 && <div style={{ position: "absolute", top: -2, right: 6, width: 16, height: 16, borderRadius: "50%", background: BRAND.red, color: "#fff", fontSize: 9, fontWeight: 900, display: "grid", placeItems: "center", border: `2px solid ${BRAND.panel}` }}>{unreadMessages > 9 ? "9+" : unreadMessages}</div>}
            </div>
            <div style={{ fontSize: 9, fontWeight: 800, whiteSpace: "nowrap", color: active ? BRAND.gold : BRAND.dim }}>{item.label}</div>
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
  return <div style={{ width: size, height: size, borderRadius: "50%", display: "grid", placeItems: "center", background: client.photo ? BRAND.card2 : client.color, color: "#000", fontWeight: 900, fontSize: size * 0.4, overflow: "hidden", flexShrink: 0, border: `2px solid ${client.color}`, boxShadow: `0 0 0 3px ${client.color}22` }}>{client.photo ? <img src={client.photo} alt={client.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (client.avatar || (client.name ? client.name[0] : "?"))}</div>;
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
function InjuryBanner({ client }) {
  const text = (client.profile?.injuries || "").trim();
  if (!text || /^none\b/i.test(text) || /^no\b/i.test(text) || /^n\/a$/i.test(text)) return null;
  return (
    <div style={{ background: `${BRAND.red}18`, borderBottom: `1px solid ${BRAND.red}55`, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 26, height: 26, borderRadius: "50%", background: BRAND.red, color: "#000", fontWeight: 1000, fontSize: 14, display: "grid", placeItems: "center", flexShrink: 0 }}>!</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: BRAND.red, fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5 }}>Injury / Pain on file</div>
        <div style={{ color: BRAND.text, fontWeight: 700, fontSize: 13, lineHeight: 1.35 }}>{text}</div>
      </div>
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
    {tab === "progress_hub" && <ProgressHub client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "photos" && <TransformPhotos client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "schedule" && <ScheduleTab client={client} updateClient={updateClient} />}
    {tab === "packages" && <PackagesTab client={client} updateClient={updateClient} />}
    {tab === "checkins" && <CheckInsTab client={client} updateClient={updateClient} isCoach={isCoach} />}
    {tab === "learn" && <LearnTab client={client} />}
    {tab === "intake" && <IntakeForm client={client} updateClient={updateClient} goTo={setTab} />}
    {tab === "payments" && <PaymentsTab client={client} updateClient={updateClient} isCoach={isCoach} />}
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
        <InjuryBanner client={client} />
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
  const parentHub = ["payments", "profile"].includes(tab) ? "me_hub" : null;
  const parentHubLabel = "Me";
  const unreadMessages = (client.messages || []).filter((m) => m.from === "coach" && !m.read).length;
  const trainCards = [
    { key: "program", icon: "program", color: BRAND.gold, title: "Program", sub: client.program?.name ? `${client.program.name} · Week ${client.program.weeks?.[0]?.weekNum || 1}` : "No program yet" },
    { key: "progress", icon: "progress", color: BRAND.cyan, title: "Progress", sub: "See your trends and personal bests" },
    { key: "photos", icon: "photo", color: BRAND.purple, title: "Photos", sub: client.transformPhotos?.length ? `${client.transformPhotos.length} photo${client.transformPhotos.length === 1 ? "" : "s"} saved` : "No photos yet" },
  ];
  const meCards = [
    ...(isCoach ? [] : [{ key: "whatsapp", icon: "me", color: BRAND.green, title: "Message your coach", sub: "Opens WhatsApp" }]),
    { key: "profile", icon: "gear", color: BRAND.purple, title: "Profile", sub: "Your details & settings" },
    { key: "payments", icon: "card", color: BRAND.green, title: "Payments", sub: paymentStatus(client).label },
    { key: "settings", icon: "gear", color: BRAND.dim, title: "Settings", sub: "Change password & log out" },
  ];
  function handleMeOpen(key) { if (key === "settings") setShowSettings(true); else if (key === "whatsapp") window.open("https://wa.me/971567088638", "_blank"); else setTab(key); }
  return (
    <div style={{ minHeight: "100vh", width: "100%", maxWidth: "100vw", overflowX: "hidden", background: BRAND.bg, color: BRAND.text, paddingBottom: 90 }}>
      <main style={{ width: "100%", maxWidth: isMobile ? 430 : 760, margin: "0 auto", padding: isMobile ? "14px 10px 0" : "18px 16px 0", boxSizing: "border-box", overflowX: "hidden" }}>
        {parentHub && (
          <button onClick={() => setTab(parentHub)} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: BRAND.muted, fontWeight: 800, fontSize: 13, padding: "10px 4px", margin: "-10px 0 4px -4px", minHeight: 44 }}>
            <NavIcon name="back" size={15} /> Back to {parentHubLabel}
          </button>
        )}
        {tab === "train_hub" && <HubScreen title="Train" subtitle="Program, progress, and photos" cards={trainCards} onOpen={setTab} />}
        {tab === "me_hub" && <HubScreen title="Me" subtitle="Your coach, payments, and account" cards={meCards} onOpen={handleMeOpen} />}
        {tab !== "train_hub" && tab !== "me_hub" && content}
      </main>
      {showSettings && <ClientSettingsModal client={client} onClose={() => setShowSettings(false)} />}
      <ClientBottomNav tab={tab} setTab={setTab} unreadMessages={unreadMessages} />
    </div>
  );
}
function todaysNutritionStats(client, date = isoDate()) {
  const nutrition = normalizeNutrition(client.nutrition);
  const day = nutrition.days[date] || emptyNutriDay();
  const totals = nutriDayTotals(day);
  const calTarget = Number(nutrition.targets?.calories || 0);
  const proteinTarget = Number(nutrition.targets?.protein || 0);
  const stepsTarget = Number(nutrition.targets?.steps || 10000);
  const waterTarget = Number(nutrition.targets?.water || 3);
  const parts = [
    calTarget ? Math.min(totals.kcal / calTarget, 1) : 0,
    proteinTarget ? Math.min(totals.protein / proteinTarget, 1) : 0,
    waterTarget ? Math.min(Number(day.water || 0) / waterTarget, 1) : 0,
    stepsTarget ? Math.min(Number(day.steps || 0) / stepsTarget, 1) : 0,
  ];
  const score = Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
  return { nutrition, totals, daily: { steps: day.steps || 0, water: day.water || 0 }, score, calTarget, proteinTarget, stepsTarget, waterTarget };
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
  const todaysWorkout = client.program?.weeks?.[0]?.workouts?.[0]?.name || "Workout not assigned";
  const scoreSize = isMobile ? 80 : 118;
  const scoreColor = stats.score >= 75 ? BRAND.green : stats.score >= 50 ? BRAND.orange : BRAND.red;
  const w = client.program?.weeks?.[0]?.workouts?.[0];
  const exs = (w?.blocks?.flatMap((b) => b.entries || b.exercises || []) || w?.exercises || []);
  const chips = exs.slice(0, 3).map((e) => { const nm = e.substitutedName || e.name || e.exercise || ""; const sn = e.sets?.length; const rp = e.sets?.[0]?.targetReps || e.sets?.[0]?.reps || e.reps; return sn && rp ? `${nm} ${sn}×${rp}` : nm; }).filter(Boolean);
  const estMin = w ? Math.max(20, (exs.length || 4) * 12) : null;
  const habits = [
    { k: "Water", v: stats.daily.water || 0, t: stats.waterTarget || 3, c: BRAND.blue },
    { k: "Steps", v: stats.daily.steps || 0, t: stats.stepsTarget || 10000, c: BRAND.orange },
    { k: "Sleep", v: stats.daily.sleep || 0, t: 8, c: BRAND.purple },
    { k: "Protein", v: stats.totals.protein, t: stats.proteinTarget || 0, c: BRAND.green },
  ];
  const C = 2 * Math.PI * 22;
  return <div style={{ display: "grid", gap: 11, maxWidth: "100%", overflowX: "hidden" }}>
    <InstallPrompt color={client.color} />
    <Card style={{ padding: isMobile ? 16 : 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center" }}>
        <ClientAvatar client={client} size={isMobile ? 50 : 68} />
        <div style={{ minWidth: 0 }}>
          <div style={{ color: BRAND.gold, fontSize: 10, fontWeight: 1000, letterSpacing: 1.4, textTransform: "uppercase" }}>The Forge Method</div>
          <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 1000, lineHeight: 1.05, textTransform: "uppercase", marginTop: 5 }}>Welcome back,<br />{client.name}</div>
          <div style={{ color: BRAND.muted, fontWeight: 800, marginTop: 7, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client.goals?.join(" + ") || client.goal || ""}</div>
        </div>
        <div style={{ width: scoreSize, height: scoreSize, borderRadius: "50%", display: "grid", placeItems: "center", background: `conic-gradient(${scoreColor} ${stats.score}%, ${BRAND.card2} ${stats.score}% 100%)`, flexShrink: 0 }}>
          <div style={{ width: scoreSize - 28, height: scoreSize - 28, borderRadius: "50%", background: BRAND.bg, display: "grid", placeItems: "center", textAlign: "center" }}>
            <div><div style={{ fontSize: isMobile ? 22 : 30, fontWeight: 1000, color: scoreColor }}>{stats.score}</div><div style={{ color: BRAND.muted, fontSize: 8, fontWeight: 1000, letterSpacing: 0.5 }}>FORGE SCORE</div></div>
          </div>
        </div>
      </div>
    </Card>
    {goTo && !client.intake?.completedAt && <Card onClick={() => goTo("intake")} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderColor: BRAND.cyan }}><div><div style={{ color: BRAND.cyan, fontWeight: 1000, fontSize: 12, letterSpacing: 0.5 }}>COMPLETE YOUR INTAKE</div><div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginTop: 3 }}>A few questions so your coach can tailor your plan</div></div><div style={{ color: BRAND.cyan, fontWeight: 1000, fontSize: 13, whiteSpace: "nowrap" }}>Start &rarr;</div></Card>}
    {goTo && <Card onClick={() => goTo("checkins")} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderColor: `${BRAND.gold}55` }}><div><div style={{ color: BRAND.gold, fontWeight: 1000, fontSize: 12, letterSpacing: 0.5 }}>WEEKLY CHECK-IN</div><div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 600, marginTop: 3 }}>Log your week for your coach</div></div><div style={{ color: BRAND.gold, fontWeight: 1000, fontSize: 13, whiteSpace: "nowrap" }}>Start &rarr;</div></Card>}
    <div>
      <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 1000, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>Today's session</div>
      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 1000, textTransform: "uppercase", lineHeight: 1.1 }}>{todaysWorkout}</div>
          {estMin && <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", letterSpacing: 1 }}>~{estMin} MIN</div>}
        </div>
        {chips.length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>{chips.map((c, i) => <div key={i} style={{ padding: "8px 13px", borderRadius: 999, border: `1px solid ${BRAND.line}`, background: BRAND.card2, fontSize: 12, fontWeight: 800, color: BRAND.muted, whiteSpace: "nowrap" }}>{c}</div>)}</div>}
        {goTo && <button onClick={() => goTo("program")} style={{ width: "100%", marginTop: 16, padding: "16px 0", borderRadius: 14, border: "none", background: "#fff", color: "#000", fontWeight: 1000, fontSize: 14, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}>Start session →</button>}
      </Card>
    </div>
    <div>
      <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 1000, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>Daily habits</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        {habits.map((h) => {
          const pct = h.t ? Math.min(100, Math.round(Number(h.v) / Number(h.t) * 100)) : 0;
          const disp = h.k === "Steps" ? (Number(h.v) >= 1000 ? (Number(h.v) / 1000).toFixed(1) + "K" : `${Math.round(Number(h.v))}`) : (h.k === "Water" ? `${h.v}` : `${Math.round(Number(h.v))}`);
          return <Card key={h.k} style={{ padding: "12px 6px", display: "grid", justifyItems: "center", gap: 8 }}>
            <div style={{ position: "relative", width: 58, height: 58 }}>
              <svg width="58" height="58" style={{ transform: "rotate(-90deg)" }}><circle cx="29" cy="29" r="24" fill="none" stroke={BRAND.card2} strokeWidth="6" /><circle cx="29" cy="29" r="24" fill="none" stroke={h.c} strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 24} strokeDashoffset={2 * Math.PI * 24 * (1 - pct / 100)} /></svg>
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 15, fontWeight: 1000 }}>{disp}</div>
            </div>
            <div style={{ color: h.c, fontSize: 9, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.5 }}>{h.k}</div>
          </Card>;
        })}
      </div>
    </div>
    <HomeLearnStrip client={client} goTo={goTo} />
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
  return <Card style={{ padding: isMobile ? 14 : 18 }}>{client.intake?.answers?.length ? <div style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 12, marginBottom: 14 }}><div style={{ color: BRAND.gold, fontWeight: 1000, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Intake answers</div>{client.intake.answers.map((a, i) => <div key={i} style={{ marginBottom: 8 }}><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800 }}>{a.question}</div><div style={{ fontSize: 13, fontWeight: 600 }}>{a.answer || "—"}</div></div>)}</div> : null}{isCoach ? <div style={{ marginBottom: 16, padding: 12, background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 14 }}><div style={{ color: BRAND.gold, fontWeight: 1000, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Coaching type</div><div style={{ display: "flex", gap: 8 }}>{["1:1", "Online"].map((t) => <button key={t} onClick={async () => { const np = { ...profile, clientType: t }; setProfile(np); await upsertSection(client.id, "profile", np); updateClient({ ...client, clientType: t, profile: np }); }} style={{ flex: 1, border: `1px solid ${(profile.clientType || "1:1") === t ? BRAND.gold : BRAND.line}`, background: (profile.clientType || "1:1") === t ? BRAND.gold : "transparent", color: (profile.clientType || "1:1") === t ? "#000" : BRAND.text, borderRadius: 999, padding: "10px 0", fontWeight: 900, cursor: "pointer" }}>{t === "1:1" ? "In-Person (1:1)" : "Online"}</button>)}</div><div style={{ color: BRAND.muted, fontSize: 11, marginTop: 8 }}>{(profile.clientType || "1:1") === "Online" ? "Online: gets Check-ins & Payments." : "In-person: gets Schedule & Packages."} Switches instantly.</div></div> : null}
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
function normalizeNutrition(raw) {
  const n = raw && typeof raw === "object" ? raw : {};
  return {
    targets: { calories: "", protein: "", carbs: "", fats: "", steps: 10000, water: 3, ...(n.targets || {}) },
    days: n.days && typeof n.days === "object" ? n.days : {},
    recents: Array.isArray(n.recents) ? n.recents : [],
  };
}
function emptyNutriDay() { return { meals: { Breakfast: [], Lunch: [], Dinner: [], Snacks: [] }, water: 0, steps: 0 }; }
function nutriDayTotals(day) {
  const M = ["Breakfast", "Lunch", "Dinner", "Snacks"];
  const sum = (arr, k) => (arr || []).reduce((a, x) => a + (Number(x[k]) || 0), 0);
  return M.reduce((acc, m) => { const it = day.meals?.[m] || []; return { kcal: acc.kcal + sum(it, "kcal"), protein: acc.protein + sum(it, "protein"), carbs: acc.carbs + sum(it, "carbs"), fats: acc.fats + sum(it, "fats") }; }, { kcal: 0, protein: 0, carbs: 0, fats: 0 });
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

async function searchFatSecret(query) {
  try {
    const { data, error } = await supabase.functions.invoke("forge-fatsecret", { body: { action: "search", q: query } });
    if (error || !data) return [];
    return Array.isArray(data.foods) ? data.foods : [];
  } catch { return []; }
}

const FATSECRET_FEATURES = { foodSearch: true, foodDetails: true, barcode: true, recipes: true, autocomplete: false, foodImages: false, nlp: false };
async function fsGetFood(foodId) {
  try { const { data, error } = await supabase.functions.invoke("forge-fatsecret", { body: { action: "get", food_id: foodId } }); if (error || !data) return null; return data; } catch { return null; }
}
async function fsSearchRecipes(q) {
  try { const { data, error } = await supabase.functions.invoke("forge-fatsecret", { body: { action: "recipes", q } }); if (error || !data || data.error) return { error: (data && data.error) || "unavailable", recipes: [] }; return { recipes: data.recipes || [] }; } catch { return { error: "unavailable", recipes: [] }; }
}
async function fsGetRecipe(id) {
  try { const { data, error } = await supabase.functions.invoke("forge-fatsecret", { body: { action: "recipe", recipe_id: id } }); if (error || !data || data.error) return null; return data.recipe || null; } catch { return null; }
}
function BarcodeScanner({ onCode, onClose, lookupMsg }) {
  const videoRef = useRef(null);
  const supported = typeof window !== "undefined" && "BarcodeDetector" in window;
  const [status, setStatus] = useState("");
  const [manual, setManual] = useState("");
  useEffect(() => {
    if (!supported) return;
    let stream, raf, cancelled = false;
    (async () => {
      try {
        const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try { const codes = await detector.detect(videoRef.current); if (codes && codes[0] && codes[0].rawValue) { onCode(codes[0].rawValue); return; } } catch {}
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch { setStatus("Camera unavailable. Enter the barcode number below."); }
    })();
    return () => { cancelled = true; if (raf) cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach((t) => t.stop()); };
  }, [supported]);
  return <>
    <button onClick={onClose} style={{ background: "none", border: "none", color: BRAND.gold, fontWeight: 900, fontSize: 13, cursor: "pointer", padding: 0 }}>{"‹ Back"}</button>
    <div style={{ fontSize: 20, fontWeight: 1000, margin: "12px 0" }}>Scan barcode</div>
    {supported ? <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#000", aspectRatio: "4 / 3" }}>
      <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <div style={{ position: "absolute", inset: "26% 12%", border: `2px solid ${BRAND.gold}`, borderRadius: 12, boxShadow: "0 0 0 999px rgba(0,0,0,.35)" }} />
    </div> : <div style={{ color: BRAND.muted, fontSize: 13 }}>Live scanning isn't supported in this browser. Enter the barcode number below.</div>}
    {status && <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 8 }}>{status}</div>}
    {lookupMsg && <div style={{ color: BRAND.gold, fontSize: 13, marginTop: 8, fontWeight: 700 }}>{lookupMsg}</div>}
    <div style={{ color: BRAND.muted, fontSize: 11, marginTop: 16, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 900 }}>Or enter barcode</div>
    <div style={{ display: "flex", gap: 8 }}>
      <input inputMode="numeric" placeholder="e.g. 049000000443" value={manual} onChange={(e) => setManual(e.target.value)} style={inputStyle()} />
      <Button onClick={() => manual.trim() && onCode(manual.trim())}>Look up</Button>
    </div>
  </>;
}

function FoodSearchModal({ client, meal, onClose, onAdd, onAddMany }) {
  const [tab, setTab] = useState("foods");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [detail, setDetail] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [savedMeals, setSavedMeals] = useState([]);
  const [builder, setBuilder] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recErr, setRecErr] = useState("");
  const [recipe, setRecipe] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  const [customName, setCustomName] = useState("");
  const [cm, setCm] = useState({ kcal: "", protein: "", carbs: "", fats: "" });
  const recents = (normalizeNutrition(client.nutrition).recents) || [];

  useEffect(() => {
    (async () => {
      try { const { data } = await supabase.from("client_data").select("data").eq("client_id", client.id).eq("section", "favorites").maybeSingle(); setFavorites(data?.data?.list || []); } catch {}
      try { const { data } = await supabase.from("client_data").select("data").eq("client_id", client.id).eq("section", "saved_meals").maybeSingle(); setSavedMeals(data?.data?.list || []); } catch {}
    })();
  }, [client.id]);
  useEffect(() => {
    if ((tab !== "foods" && !builder) || query.trim().length < 2) { setResults([]); setLoading(false); setErr(""); return; }
    setLoading(true); setErr("");
    const t = setTimeout(async () => {
      try { const foods = await searchFatSecret(query.trim()); setResults(foods); if (!foods.length) setErr("No foods found. Try another term."); }
      catch { setErr("Search failed. Check your connection and try again."); }
      setLoading(false);
    }, 450);
    return () => clearTimeout(t);
  }, [query, tab, !!builder]);
  useEffect(() => {
    if (tab !== "recipes" || query.trim().length < 2) { return; }
    setRecLoading(true); setRecErr("");
    const t = setTimeout(async () => {
      const r = await fsSearchRecipes(query.trim());
      if (r.error) { setRecipes([]); setRecErr("Recipes aren't available on your FatSecret plan yet."); }
      else { setRecipes(r.recipes); if (!r.recipes.length) setRecErr("No recipes found."); }
      setRecLoading(false);
    }, 450);
    return () => clearTimeout(t);
  }, [query, tab]);

  async function openDetail(food) {
    setDetail({ food, servings: null, si: 0, qty: "1", meal: meal || "Breakfast" });
    let servings = null;
    if (food.id) { const data = await fsGetFood(food.id); if (data?.servings?.length) servings = data.servings; }
    if (!servings) servings = [{ desc: food.serving || "1 serving", kcal: food.kcal, protein: food.protein, carbs: food.carbs, fats: food.fats }];
    setDetail((d) => (d && d.food === food ? { ...d, servings } : d));
  }
  function macrosFor(d) {
    const s = (d.servings || [])[d.si] || (d.servings || [])[0] || {};
    const q = Number(d.qty) > 0 ? Number(d.qty) : 1;
    return { kcal: Math.round((s.kcal || 0) * q), protein: Math.round((s.protein || 0) * q), carbs: Math.round((s.carbs || 0) * q), fats: Math.round((s.fats || 0) * q) };
  }
  function addDetail() {
    const m = macrosFor(detail); const item = { name: detail.food.name, ...m, qty: Number(detail.qty) || 1 };
    if (builder) { setBuilder({ ...builder, items: [...builder.items, item] }); setDetail(null); setTab("builder"); return; }
    onAdd(item, detail.meal); setDetail(null);
  }
  async function toggleFav(food) {
    const has = favorites.some((f) => f.name === food.name);
    const next = has ? favorites.filter((f) => f.name !== food.name) : [{ id: food.id || uid(), name: food.name, brand: food.brand || "", kcal: food.kcal, protein: food.protein, carbs: food.carbs, fats: food.fats, serving: food.serving || "" }, ...favorites].slice(0, 60);
    setFavorites(next); try { await upsertSection(client.id, "favorites", { list: next }); } catch {}
  }
  const isFav = (food) => favorites.some((f) => f.name === food.name);
  function addCustom() { if (!customName.trim()) return; const item = { name: customName.trim(), kcal: Number(cm.kcal || 0), protein: Number(cm.protein || 0), carbs: Number(cm.carbs || 0), fats: Number(cm.fats || 0), qty: 1 }; if (builder) { setBuilder({ ...builder, items: [...builder.items, item] }); setCustomName(""); setCm({ kcal: "", protein: "", carbs: "", fats: "" }); setTab("builder"); return; } onAdd(item, meal); onClose(); }
  function mealTotals(items) { return items.reduce((a, x) => ({ kcal: a.kcal + Number(x.kcal || 0), protein: a.protein + Number(x.protein || 0), carbs: a.carbs + Number(x.carbs || 0), fats: a.fats + Number(x.fats || 0) }), { kcal: 0, protein: 0, carbs: 0, fats: 0 }); }
  async function saveBuilder() {
    if (!builder.name.trim() || !builder.items.length) return;
    const tot = mealTotals(builder.items);
    const sm = { id: uid(), name: builder.name.trim(), items: builder.items, totals: tot };
    const next = [sm, ...savedMeals].slice(0, 60);
    setSavedMeals(next); try { await upsertSection(client.id, "saved_meals", { list: next }); } catch {}
    setBuilder(null); setTab("meals");
  }
  async function deleteMeal(id) { const next = savedMeals.filter((m) => m.id !== id); setSavedMeals(next); try { await upsertSection(client.id, "saved_meals", { list: next }); } catch {} }
  function addSavedMeal(sm) { (onAddMany || ((items, mm) => items.forEach((it) => onAdd(it, mm))))(sm.items, meal || "Breakfast"); onClose(); }
  async function openRecipe(r) {
    setRecipe({ ...r, full: null, loading: true, meal: meal || "Breakfast" });
    const full = await fsGetRecipe(r.id);
    setRecipe((x) => (x && x.id === r.id ? { ...x, full, loading: false } : x));
  }
  function addRecipe() { onAdd({ name: recipe.name, kcal: recipe.kcal, protein: recipe.protein, carbs: recipe.carbs, fats: recipe.fats, qty: 1 }, recipe.meal); setRecipe(null); onClose(); }

  async function handleBarcode(code) {
    setScanMsg("Looking up " + code + "...");
    try {
      const { data, error } = await supabase.functions.invoke("forge-fatsecret", { body: { action: "barcode", barcode: code } });
      if (error || !data || data.error) { setScanMsg(data && data.error === "barcode not found" ? "Barcode not found. Try searching by name." : "Barcode scanning isn't available yet."); return; }
      if (data.servings && data.servings.length) { setScanning(false); setScanMsg(""); setDetail({ food: { id: data.id, name: data.name, brand: data.brand || "" }, servings: data.servings, si: 0, qty: "1", meal: meal || "Breakfast" }); }
      else setScanMsg("Barcode not found. Try searching by name.");
    } catch { setScanMsg("Lookup failed. Try again."); }
  }
  const overlay = { position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.75)", display: "flex", alignItems: "flex-end", justifyContent: "center" };
  const panel = { width: "100%", maxWidth: 520, maxHeight: "92vh", background: BRAND.bg, border: `1px solid ${BRAND.line}`, borderRadius: "20px 20px 0 0", padding: 16, overflowY: "auto" };
  const foodRow = (f, onTap) => <div key={f.id || f.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <button onClick={() => onTap(f)} style={{ flex: 1, textAlign: "left", background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: 11, cursor: "pointer", color: BRAND.text }}>
      <div style={{ fontWeight: 900, fontSize: 14 }}>{f.name}{f.brand ? <span style={{ color: BRAND.dim, fontWeight: 700 }}> · {f.brand}</span> : ""}</div>
      <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 3 }}>{f.serving ? `${f.serving} · ` : ""}{Math.round(f.kcal || 0)} kcal · P {Math.round(f.protein || 0)} · C {Math.round(f.carbs || 0)} · F {Math.round(f.fats || 0)}</div>
    </button>
    <button onClick={() => toggleFav(f)} style={{ background: "none", border: "none", cursor: "pointer", color: isFav(f) ? BRAND.gold : BRAND.dim, fontSize: 20, flexShrink: 0 }}>{isFav(f) ? "★" : "☆"}</button>
  </div>;
  const wrap = (inner) => <div style={overlay} onClick={onClose}><div style={panel} onClick={(e) => e.stopPropagation()}>{inner}</div></div>;

  if (scanning) { return wrap(<BarcodeScanner onCode={handleBarcode} onClose={() => { setScanning(false); setScanMsg(""); }} lookupMsg={scanMsg} />); }
  if (recipe) {
    const r = recipe;
    return wrap(<>
      <button onClick={() => setRecipe(null)} style={{ background: "none", border: "none", color: BRAND.gold, fontWeight: 900, fontSize: 13, cursor: "pointer", padding: 0 }}>{"‹ Back"}</button>
      {r.image && <img src={r.image} alt={r.name} style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 14, marginTop: 12 }} />}
      <div style={{ fontSize: 20, fontWeight: 1000, marginTop: 12 }}>{r.name}</div>
      {r.description && <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 4 }}>{r.description}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, margin: "14px 0" }}>
        <Mini label="Calories" value={r.kcal} /><Mini label="Protein" value={`${r.protein}g`} color={BRAND.green} /><Mini label="Carbs" value={`${r.carbs}g`} color={BRAND.orange} /><Mini label="Fats" value={`${r.fats}g`} color={BRAND.purple} />
      </div>
      {r.loading && <div style={{ color: BRAND.muted, fontSize: 13 }}>Loading recipe...</div>}
      {r.full && <div style={{ color: BRAND.muted, fontSize: 12, marginBottom: 12 }}>Full ingredients and steps available from FatSecret.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 12 }}>{["Breakfast", "Lunch", "Dinner", "Snacks"].map((mm) => <button key={mm} onClick={() => setRecipe({ ...r, meal: mm })} style={{ padding: "9px 0", borderRadius: 10, fontSize: 11, fontWeight: 900, cursor: "pointer", color: r.meal === mm ? "#000" : BRAND.text, background: r.meal === mm ? BRAND.gold : BRAND.card2, border: `1px solid ${r.meal === mm ? BRAND.gold : BRAND.line}` }}>{mm}</button>)}</div>
      <Button onClick={addRecipe} style={{ width: "100%" }}>Add to {r.meal}</Button>
    </>);
  }

  if (builder) {
    const tot = mealTotals(builder.items);
    return wrap(<>
      <button onClick={() => setBuilder(null)} style={{ background: "none", border: "none", color: BRAND.gold, fontWeight: 900, fontSize: 13, cursor: "pointer", padding: 0 }}>{"‹ Back"}</button>
      <div style={{ fontSize: 20, fontWeight: 1000, margin: "12px 0" }}>Create meal</div>
      <input placeholder="Meal name (e.g. Chicken Rice Bowl)" value={builder.name} onChange={(e) => setBuilder({ ...builder, name: e.target.value })} style={{ ...inputStyle(), marginBottom: 12 }} />
      <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Ingredients</div>
      {builder.items.map((it, k) => <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: `1px solid ${BRAND.line}` }}>
        <div><div style={{ fontWeight: 800, fontSize: 13 }}>{it.name}</div><div style={{ color: BRAND.dim, fontSize: 10 }}>{it.kcal} kcal · P{it.protein} C{it.carbs} F{it.fats}</div></div>
        <button onClick={() => setBuilder({ ...builder, items: builder.items.filter((_, x) => x !== k) })} style={{ background: "none", border: "none", color: BRAND.red, fontWeight: 1000, cursor: "pointer", fontSize: 18 }}>{"×"}</button>
      </div>)}
      {builder.items.length === 0 && <div style={{ color: BRAND.dim, fontSize: 12 }}>Search below to add ingredients.</div>}
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 1000, fontSize: 13, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${BRAND.line}` }}><span>Total</span><span>{Math.round(tot.kcal)} kcal · P{Math.round(tot.protein)} C{Math.round(tot.carbs)} F{Math.round(tot.fats)}</span></div>
      <input placeholder="Search a food to add..." value={query} onChange={(e) => setQuery(e.target.value)} style={{ ...inputStyle(), margin: "12px 0" }} />
      <div style={{ display: "grid", gap: 7 }}>
        {loading && <div style={{ color: BRAND.gold, fontSize: 13 }}>Searching...</div>}
        {results.map((f) => foodRow(f, openDetail))}
      </div>
      <Button onClick={saveBuilder} disabled={!builder.name.trim() || !builder.items.length} style={{ width: "100%", marginTop: 14 }}>Save meal</Button>
    </>);
  }

  if (detail) {
    const m = macrosFor(detail);
    return wrap(<>
      <button onClick={() => setDetail(null)} style={{ background: "none", border: "none", color: BRAND.gold, fontWeight: 900, fontSize: 13, cursor: "pointer", padding: 0 }}>{"‹ Back"}</button>
      <div style={{ fontSize: 20, fontWeight: 1000, marginTop: 12 }}>{detail.food.name}</div>
      {detail.food.brand && <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 700 }}>{detail.food.brand}</div>}
      {!detail.servings && <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 12 }}>Loading serving sizes...</div>}
      {detail.servings && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, margin: "14px 0" }}>
          <Mini label="Calories" value={m.kcal} /><Mini label="Protein" value={`${m.protein}g`} color={BRAND.green} /><Mini label="Carbs" value={`${m.carbs}g`} color={BRAND.orange} /><Mini label="Fats" value={`${m.fats}g`} color={BRAND.purple} />
        </div>
        <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Serving size</div>
        <select value={detail.si} onChange={(e) => setDetail({ ...detail, si: Number(e.target.value) })} style={{ ...inputStyle(), marginBottom: 10 }}>{detail.servings.map((sv, k) => <option key={k} value={k}>{sv.desc || `Serving ${k + 1}`}</option>)}</select>
        <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Quantity</div>
        <input inputMode="decimal" value={detail.qty} onChange={(e) => setDetail({ ...detail, qty: e.target.value })} style={{ ...inputStyle(), marginBottom: 12 }} />
        {!builder && <><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Add to</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 14 }}>{["Breakfast", "Lunch", "Dinner", "Snacks"].map((mm) => <button key={mm} onClick={() => setDetail({ ...detail, meal: mm })} style={{ padding: "9px 0", borderRadius: 10, fontSize: 11, fontWeight: 900, cursor: "pointer", color: detail.meal === mm ? "#000" : BRAND.text, background: detail.meal === mm ? BRAND.gold : BRAND.card2, border: `1px solid ${detail.meal === mm ? BRAND.gold : BRAND.line}` }}>{mm}</button>)}</div></>}
        <Button onClick={addDetail} style={{ width: "100%" }}>{builder ? "Add to meal" : `Add to ${detail.meal}`}</Button>
      </>}
    </>);
  }

  const TABS = [["foods", "Foods"], ...(FATSECRET_FEATURES.recipes ? [["recipes", "Recipes"]] : []), ["recent", "Recent"], ["favorites", "Favorites"], ["meals", "Meals"], ["custom", "Custom"]];
  return wrap(<>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <div style={{ fontSize: 20, fontWeight: 1000 }}>Add Food{meal ? ` · ${meal}` : ""}</div>
      <button onClick={onClose} style={{ background: "none", border: "none", color: BRAND.muted, fontSize: 22, cursor: "pointer" }}>{"×"}</button>
    </div>
    {(tab === "foods" || tab === "recipes") && <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      <input autoFocus placeholder={tab === "recipes" ? "Search recipes..." : "Search foods..."} value={query} onChange={(e) => setQuery(e.target.value)} style={inputStyle()} />
      {tab === "foods" && FATSECRET_FEATURES.barcode && <button onClick={() => { setScanning(true); setScanMsg(""); }} style={{ width: 44, borderRadius: 12, background: BRAND.card2, border: `1px solid ${BRAND.line}`, color: BRAND.text, cursor: "pointer", fontSize: 18 }}>{"▤"}</button>}
    </div>}
    <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>{TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{ whiteSpace: "nowrap", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5, padding: "8px 13px", borderRadius: 999, cursor: "pointer", color: tab === k ? "#000" : BRAND.muted, background: tab === k ? BRAND.gold : BRAND.card2, border: `1px solid ${tab === k ? BRAND.gold : BRAND.line}` }}>{l}</button>)}</div>

    {tab === "foods" && <div style={{ display: "grid", gap: 7 }}>
      {loading && <div style={{ color: BRAND.gold, fontSize: 13, fontWeight: 800 }}>Searching FatSecret...</div>}
      {err && !loading && <div style={{ color: BRAND.muted, fontSize: 13 }}>{err}</div>}
      {query.trim().length < 2 && !loading && <div style={{ color: BRAND.dim, fontSize: 13 }}>Type at least 2 letters to search.</div>}
      {results.map((f) => foodRow(f, openDetail))}
    </div>}

    {tab === "recipes" && <div style={{ display: "grid", gap: 8 }}>
      {recLoading && <div style={{ color: BRAND.gold, fontSize: 13, fontWeight: 800 }}>Searching recipes...</div>}
      {recErr && !recLoading && <div style={{ color: BRAND.muted, fontSize: 13 }}>{recErr}</div>}
      {query.trim().length < 2 && !recLoading && <div style={{ color: BRAND.dim, fontSize: 13 }}>Search FatSecret recipes.</div>}
      {recipes.map((r) => <button key={r.id} onClick={() => openRecipe(r)} style={{ textAlign: "left", background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 0, cursor: "pointer", color: BRAND.text, overflow: "hidden" }}>
        {r.image && <img src={r.image} alt={r.name} style={{ width: "100%", height: 120, objectFit: "cover" }} />}
        <div style={{ padding: 12 }}><div style={{ fontWeight: 1000, fontSize: 14 }}>{r.name}</div><div style={{ color: BRAND.muted, fontSize: 12, marginTop: 3 }}>{r.kcal} kcal · P {r.protein} · C {r.carbs} · F {r.fats}</div></div>
      </button>)}
    </div>}

    {tab === "recent" && <div style={{ display: "grid", gap: 7 }}>
      {recents.length === 0 && <div style={{ color: BRAND.muted, fontSize: 13 }}>Foods you log will appear here.</div>}
      {recents.map((f) => foodRow(f, openDetail))}
    </div>}

    {tab === "favorites" && <div style={{ display: "grid", gap: 7 }}>
      {favorites.length === 0 && <div style={{ color: BRAND.muted, fontSize: 13 }}>Tap the star on any food to save it here.</div>}
      {favorites.map((f) => foodRow(f, openDetail))}
    </div>}

    {tab === "meals" && <div style={{ display: "grid", gap: 8 }}>
      <Button onClick={() => { setBuilder({ name: "", items: [] }); setQuery(""); }} style={{ width: "100%" }}>+ Create meal</Button>
      {savedMeals.length === 0 && <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 4 }}>Build a meal from multiple foods and reuse it in one tap.</div>}
      {savedMeals.map((sm) => <div key={sm.id} style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontWeight: 1000, fontSize: 14 }}>{sm.name}</div><div style={{ color: BRAND.muted, fontSize: 11, marginTop: 2 }}>{Math.round(sm.totals?.kcal || 0)} kcal · {sm.items.length} items</div></div><button onClick={() => deleteMeal(sm.id)} style={{ background: "none", border: "none", color: BRAND.red, cursor: "pointer", fontSize: 16 }}>{"×"}</button></div>
        <Button onClick={() => addSavedMeal(sm)} style={{ width: "100%", marginTop: 10 }}>Add to {meal || "diary"}</Button>
      </div>)}
    </div>}

    {tab === "custom" && <div style={{ display: "grid", gap: 10 }}>
      <div style={{ color: BRAND.muted, fontSize: 12 }}>For foods not in the database. Enter the values yourself.</div>
      <input placeholder="Food name" value={customName} onChange={(e) => setCustomName(e.target.value)} style={inputStyle()} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Field label="Calories" value={cm.kcal} onChange={(v) => setCm({ ...cm, kcal: v })} type="number" />
        <Field label="Protein g" value={cm.protein} onChange={(v) => setCm({ ...cm, protein: v })} type="number" />
        <Field label="Carbs g" value={cm.carbs} onChange={(v) => setCm({ ...cm, carbs: v })} type="number" />
        <Field label="Fats g" value={cm.fats} onChange={(v) => setCm({ ...cm, fats: v })} type="number" />
      </div>
      <Button onClick={addCustom} style={{ width: "100%" }}>Add to {meal || "meal"}</Button>
    </div>}
  </>);
}

function WeekAdherenceStrip({ nutrition, targets, color }) {
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return isoDate(d); });
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

function SavedMealsRow({ meal, savedMeals, onLog, onCreate }) {
  const forThisMeal = savedMeals.filter((m) => m.mealType === meal);
  if (forThisMeal.length === 0) {
    return <button onClick={onCreate} style={{ background: "transparent", border: `1px dashed ${BRAND.line}`, borderRadius: 12, padding: "10px 12px", color: BRAND.muted, fontWeight: 800, fontSize: 12, cursor: "pointer", marginBottom: 10, width: "100%", textAlign: "left" }}>+ Save a {meal.toLowerCase()} you eat often</button>;
  }
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: BRAND.dim, fontSize: 10, fontWeight: 800, textTransform: "uppercase", marginBottom: 6 }}>My Meals</div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
        {forThisMeal.map((m) => {
          const t = (m.items || []).reduce((a, i) => ({ kcal: a.kcal + Number(i.kcal || 0), protein: a.protein + Number(i.protein || 0) }), { kcal: 0, protein: 0 });
          return (
            <button key={m.id} onClick={() => onLog(m)} style={{ flexShrink: 0, width: 140, textAlign: "left", background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 12, cursor: "pointer" }}>
              <div style={{ color: BRAND.text, fontWeight: 800, fontSize: 13 }}>{m.name}</div>
              <div style={{ color: BRAND.dim, fontSize: 10, fontWeight: 600, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(m.items || []).map((i) => i.name).join(", ")}</div>
              <div style={{ color: BRAND.cyan, fontSize: 11, fontWeight: 800, marginTop: 8 }}>{t.kcal} kcal &middot; P{t.protein}</div>
              <div style={{ color: BRAND.gold, fontSize: 10, fontWeight: 800, marginTop: 4 }}>Tap to log &rarr;</div>
            </button>
          );
        })}
        <button onClick={onCreate} style={{ flexShrink: 0, width: 90, background: "transparent", border: `1px dashed ${BRAND.line}`, borderRadius: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: BRAND.dim, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
          <div style={{ fontSize: 18 }}>+</div>New Meal
        </button>
      </div>
    </div>
  );
}
function SaveMealModal({ client, mealType, onClose, onSave }) {
  const [name, setName] = useState("");
  const [items, setItems] = useState([]);
  const [pickingFood, setPickingFood] = useState(false);
  const [saving, setSaving] = useState(false);
  const totals = items.reduce((a, i) => ({ kcal: a.kcal + Number(i.kcal || 0), protein: a.protein + Number(i.protein || 0), carbs: a.carbs + Number(i.carbs || 0), fats: a.fats + Number(i.fats || 0) }), { kcal: 0, protein: 0, carbs: 0, fats: 0 });
  function addItem(item) { setItems((prev) => [...prev, item]); setPickingFood(false); }
  function removeItem(i) { setItems((prev) => prev.filter((_, idx) => idx !== i)); }
  async function save() {
    if (!name.trim()) { alert("Give this meal a name."); return; }
    if (items.length === 0) { alert("Add at least one food item."); return; }
    setSaving(true);
    await onSave({ id: uid(), name: name.trim(), mealType, items });
    setSaving(false);
  }
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 460, maxHeight: "88vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 19, fontWeight: 1000 }}>New {mealType} Meal</div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <div style={{ color: BRAND.muted, fontSize: 12, marginBottom: 14 }}>Save a combo you eat often so you can log it in one tap.</div>
        <Field label="Meal name" value={name} onChange={setName} placeholder="e.g. Oats + Eggs" />
        <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, margin: "14px 0 8px", textTransform: "uppercase" }}>Items in this meal</div>
        {items.length === 0 && <div style={{ color: BRAND.dim, fontSize: 13, marginBottom: 8 }}>No items yet.</div>}
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: BRAND.card2, borderRadius: 12, padding: "10px 12px", marginBottom: 6 }}>
            <div><div style={{ fontWeight: 800, fontSize: 13 }}>{it.name}</div><div style={{ color: BRAND.muted, fontSize: 11 }}>{it.kcal} kcal &middot; P{it.protein} C{it.carbs} F{it.fats}</div></div>
            <button onClick={() => removeItem(i)} style={{ background: "transparent", border: "none", color: BRAND.red, fontWeight: 900, fontSize: 15, cursor: "pointer" }}>x</button>
          </div>
        ))}
        <Button variant="dark" onClick={() => setPickingFood(true)} style={{ width: "100%", marginTop: 6 }}>+ Search &amp; add food</Button>
        {items.length > 0 && (
          <div style={{ background: BRAND.card2, borderRadius: 12, padding: 12, marginTop: 14, display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: BRAND.muted, fontSize: 12, fontWeight: 700 }}>Total</span>
            <span style={{ color: BRAND.gold, fontWeight: 800, fontSize: 13 }}>{totals.kcal} kcal &middot; P{totals.protein} C{totals.carbs} F{totals.fats}</span>
          </div>
        )}
        <Button onClick={save} disabled={saving} style={{ width: "100%", marginTop: 14 }}>{saving ? "Saving..." : "Save Meal"}</Button>
      </Card>
      {pickingFood && <FoodSearchModal client={client} onClose={() => setPickingFood(false)} onAdd={addItem} />}
    </div>
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
          <div><div style={{ fontWeight: 800 }}>{l.food}{l.qty !== 1 ? ` (x${l.qty})` : ""}</div><div style={{ color: BRAND.muted, fontSize: 12 }}>{l.kcal} kcal · P{l.protein} C{l.carbs} F{l.fats}{l.savedMealName ? ` · from "${l.savedMealName}"` : ""}</div></div>
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
  const todayIso = isoDate();
  function shiftWeek(deltaDays) {
    const d = new Date(date); d.setDate(d.getDate() + deltaDays);
    onSelect(isoDate(d));
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
          const iso = isoDate(d);
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
  const nutrition = normalizeNutrition(client.nutrition);
  const [date, setDate] = useState(isoDate());
  const [addingMeal, setAddingMeal] = useState(null);
  const [tf, setTf] = useState(nutrition.targets);
  const [showTargets, setShowTargets] = useState(false);
  const [savedMeals, setSavedMeals] = useState([]);
  const t = nutrition.targets;
  const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];
  const day = nutrition.days[date] || emptyNutriDay();
  const totals = nutriDayTotals(day);
  const calTarget = Number(t.calories) || 0;
  const calLeft = calTarget - totals.kcal;
  const overCal = calTarget && totals.kcal > calTarget;
  const calColor = overCal ? BRAND.red : BRAND.green;
  const calPct = calTarget ? Math.min(1, totals.kcal / calTarget) : 0;
  const today = isoDate();

  useEffect(() => { (async () => { try { const { data } = await supabase.from("client_data").select("data").eq("client_id", client.id).eq("section", "saved_meals").maybeSingle(); setSavedMeals(data?.data?.list || []); } catch {} })(); }, [client.id]);

  const clone = () => JSON.parse(JSON.stringify(nutrition));
  const ensureDay = (n) => { if (!n.days[date]) n.days[date] = emptyNutriDay(); if (!n.days[date].meals) n.days[date].meals = { Breakfast: [], Lunch: [], Dinner: [], Snacks: [] }; return n.days[date]; };
  async function persist(n) { updateClient({ ...client, nutrition: n }); await upsertSection(client.id, "nutrition", n); }
  async function addFood(meal, item) {
    const n = clone(); const d = ensureDay(n);
    const e = { id: uid(), name: item.name, kcal: Math.round(Number(item.kcal) || 0), protein: Math.round(Number(item.protein) || 0), carbs: Math.round(Number(item.carbs) || 0), fats: Math.round(Number(item.fats) || 0), qty: item.qty || 1 };
    d.meals[meal].push(e);
    n.recents = [{ name: e.name, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fats: e.fats }, ...(n.recents || []).filter((r) => r.name !== e.name)].slice(0, 24);
    await persist(n);
  }
  async function removeFood(meal, id) { const n = clone(); const d = ensureDay(n); d.meals[meal] = d.meals[meal].filter((x) => x.id !== id); await persist(n); }
  async function addFoods(meal, items) {
    const n = clone(); const d = ensureDay(n);
    items.forEach((item) => { const e = { id: uid(), name: item.name, kcal: Math.round(Number(item.kcal) || 0), protein: Math.round(Number(item.protein) || 0), carbs: Math.round(Number(item.carbs) || 0), fats: Math.round(Number(item.fats) || 0), qty: item.qty || 1 }; d.meals[meal].push(e); n.recents = [{ name: e.name, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fats: e.fats }, ...(n.recents || []).filter((r) => r.name !== e.name)]; });
    n.recents = (n.recents || []).slice(0, 24);
    await persist(n);
  }
  async function setWater(v) { const n = clone(); const d = ensureDay(n); d.water = Math.max(0, Math.round(v * 100) / 100); await persist(n); }
  async function setDayField(field, v) { const n = clone(); const d = ensureDay(n); d[field] = v === "" ? "" : Math.max(0, Number(v)); await persist(n); }
  async function saveTargets() { const n = clone(); n.targets = { ...tf }; await persist(n); setShowTargets(false); }
  const shiftDate = (delta) => { const dt = new Date(date + "T00:00:00"); dt.setDate(dt.getDate() + delta); setDate(dt.toISOString().slice(0, 10)); };

  const macros = [
    { k: "Protein", v: totals.protein, t: Number(t.protein) || 0, c: BRAND.green },
    { k: "Carbs", v: totals.carbs, t: Number(t.carbs) || 0, c: BRAND.orange },
    { k: "Fats", v: totals.fats, t: Number(t.fats) || 0, c: BRAND.purple },
  ];
  const ring = 2 * Math.PI * 34;

  // calendar day strip: last 14 days, dot on any day with logged food
  const strip = [];
  for (let k = 13; k >= 0; k--) { const dt = new Date(today + "T00:00:00"); dt.setDate(dt.getDate() - k); const iso = dt.toISOString().slice(0, 10); const dd = nutrition.days[iso]; const logged = dd && MEALS.some((m) => (dd.meals?.[m] || []).length); strip.push({ iso, dow: dt.toLocaleDateString(undefined, { weekday: "short" })[0], dom: dt.getDate(), logged }); }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <div style={{ color: BRAND.gold, fontSize: 10, fontWeight: 1000, letterSpacing: 1.2, textTransform: "uppercase" }}>Nutrition</div>
        <div style={{ fontSize: 28, fontWeight: 1000, textTransform: "uppercase", lineHeight: 1 }}>Fuel</div>
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
        {strip.map((d) => { const sel = d.iso === date; return <button key={d.iso} onClick={() => setDate(d.iso)} style={{ flex: "0 0 auto", width: 42, padding: "8px 0", borderRadius: 12, cursor: "pointer", background: sel ? BRAND.gold : BRAND.card2, border: `1px solid ${sel ? BRAND.gold : BRAND.line}`, color: sel ? "#000" : BRAND.text, display: "grid", justifyItems: "center", gap: 3 }}>
          <span style={{ fontSize: 9, fontWeight: 900, opacity: 0.7 }}>{d.dow}</span>
          <span style={{ fontSize: 15, fontWeight: 1000 }}>{d.dom}</span>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: d.logged ? (sel ? "#000" : BRAND.green) : "transparent" }} />
        </button>; })}
      </div>

      <Card style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ position: "relative", width: 92, height: 92, flexShrink: 0 }}>
            <svg width="92" height="92" style={{ transform: "rotate(-90deg)" }}><circle cx="46" cy="46" r="34" fill="none" stroke={BRAND.card2} strokeWidth="8" /><circle cx="46" cy="46" r="34" fill="none" stroke={calColor} strokeWidth="8" strokeLinecap="round" strokeDasharray={ring} strokeDashoffset={ring * (1 - calPct)} /></svg>
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}><div><div style={{ fontSize: 22, fontWeight: 1000, color: calColor }}>{calTarget ? Math.abs(Math.round(calLeft)) : Math.round(totals.kcal)}</div><div style={{ fontSize: 8, fontWeight: 1000, color: BRAND.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{!calTarget ? "kcal" : overCal ? "over" : "kcal left"}</div></div></div>
          </div>
          <div style={{ flex: 1, display: "grid", gap: 11, minWidth: 0 }}>
            <div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5 }}>Target {calTarget || "—"} kcal</div>
            {macros.map((m) => { const pct = m.t ? Math.min(1, m.v / m.t) : 0; return <div key={m.k}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 900, marginBottom: 4 }}><span style={{ color: m.c, textTransform: "uppercase", letterSpacing: 0.5 }}>{m.k}</span><span style={{ color: BRAND.muted }}>{Math.round(m.v)}/{m.t || "—"}G</span></div>
              <div style={{ height: 7, borderRadius: 999, background: BRAND.card2, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct * 100}%`, background: m.c, borderRadius: 999 }} /></div>
            </div>; })}
          </div>
        </div>
      </Card>

      {isCoach && <Card style={{ display: "grid", gap: 10 }}>
        <button onClick={() => { setTf(nutrition.targets); setShowTargets(!showTargets); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", color: BRAND.text, padding: 0 }}><span style={{ fontWeight: 1000, fontSize: 14 }}>Daily targets</span><span style={{ color: BRAND.gold, fontWeight: 900, fontSize: 12 }}>{showTargets ? "Close" : "Edit"}</span></button>
        {showTargets && <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="Calories" value={tf.calories} onChange={(v) => setTf({ ...tf, calories: v })} type="number" />
            <Field label="Protein g" value={tf.protein} onChange={(v) => setTf({ ...tf, protein: v })} type="number" />
            <Field label="Carbs g" value={tf.carbs} onChange={(v) => setTf({ ...tf, carbs: v })} type="number" />
            <Field label="Fats g" value={tf.fats} onChange={(v) => setTf({ ...tf, fats: v })} type="number" />
            <Field label="Water L" value={tf.water} onChange={(v) => setTf({ ...tf, water: v })} type="number" />
            <Field label="Steps" value={tf.steps} onChange={(v) => setTf({ ...tf, steps: v })} type="number" />
            <Field label="Sleep hrs" value={tf.sleep || ""} onChange={(v) => setTf({ ...tf, sleep: v })} type="number" />
          </div>
          <Button onClick={saveTargets}>Save targets</Button>
        </>}
      </Card>}

      <button onClick={() => setAddingMeal("Breakfast")} style={{ width: "100%", padding: "13px", borderRadius: 12, border: `1px dashed ${BRAND.line}`, background: BRAND.card2, color: BRAND.text, fontWeight: 1000, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer" }}>+ Search foods · Scan barcode · Saved meals</button>

      <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 1000, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 2 }}>{date === today ? "Today's log" : "Log"}</div>
      {MEALS.map((m) => {
        const items = day.meals?.[m] || [];
        const mk = items.reduce((a, x) => a + (Number(x.kcal) || 0), 0);
        return <Card key={m} style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 1000, fontSize: 15 }}>{m}</div>
            <div style={{ color: BRAND.muted, fontWeight: 900, fontSize: 13 }}>{Math.round(mk)} kcal</div>
          </div>
          {items.map((it) => <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: `1px solid ${BRAND.line}`, marginTop: 8 }}>
            <div style={{ minWidth: 0 }}><div style={{ fontWeight: 800, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</div><div style={{ color: BRAND.dim, fontSize: 10, fontWeight: 700, marginTop: 2 }}>{it.kcal} kcal · P{it.protein} C{it.carbs} F{it.fats}</div></div>
            <button onClick={() => removeFood(m, it.id)} style={{ background: "none", border: "none", color: BRAND.red, fontWeight: 1000, cursor: "pointer", fontSize: 18, flexShrink: 0, marginLeft: 8 }}>{"×"}</button>
          </div>)}
          <button onClick={() => setAddingMeal(m)} style={{ width: "100%", marginTop: 10, padding: "10px", borderRadius: 10, border: `1px dashed ${BRAND.line}`, background: "transparent", color: BRAND.gold, fontWeight: 1000, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer" }}>+ Add food{isCoach ? " for client" : ""}</button>
        </Card>;
      })}

      {savedMeals.length > 0 && <div>
        <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 1000, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>Your meals</div>
        <div style={{ display: "grid", gap: 8 }}>{savedMeals.map((sm) => <Card key={sm.id} style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ minWidth: 0 }}><div style={{ fontWeight: 1000, fontSize: 14 }}>{sm.name}</div><div style={{ color: BRAND.muted, fontSize: 11, marginTop: 2 }}>{Math.round(sm.totals?.kcal || 0)} kcal · {sm.items.length} items</div></div>
          <button onClick={() => addFoods("Snacks", sm.items)} style={{ padding: "9px 14px", borderRadius: 999, border: "none", background: BRAND.gold, color: "#000", fontWeight: 1000, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer", flexShrink: 0 }}>Add</button>
        </Card>)}</div>
      </div>}

      <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 1000, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 2 }}>Daily habits</div>
      <Card style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div><div style={{ fontWeight: 1000, fontSize: 14 }}>Water</div><div style={{ color: BRAND.blue, fontSize: 13, fontWeight: 900, marginTop: 2 }}>{day.water || 0} / {t.water || 3} L</div></div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setWater((Number(day.water) || 0) - 0.25)} style={{ width: 40, height: 40, borderRadius: 12, background: BRAND.card2, border: `1px solid ${BRAND.line}`, color: BRAND.text, fontWeight: 1000, fontSize: 18, cursor: "pointer" }}>{"−"}</button>
            <button onClick={() => setWater((Number(day.water) || 0) + 0.25)} style={{ width: 40, height: 40, borderRadius: 12, background: BRAND.blue, border: "none", color: "#000", fontWeight: 1000, fontSize: 18, cursor: "pointer" }}>+</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, borderTop: `1px solid ${BRAND.line}`, paddingTop: 12 }}>
          <div><div style={{ color: BRAND.orange, fontSize: 10, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>Steps {t.steps ? `/ ${t.steps}` : ""}</div><input inputMode="numeric" placeholder="0" value={day.steps || ""} onChange={(e) => setDayField("steps", e.target.value)} style={inputStyle()} /></div>
          <div><div style={{ color: BRAND.purple, fontSize: 10, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>Sleep hrs {t.sleep ? `/ ${t.sleep}` : ""}</div><input inputMode="decimal" placeholder="0" value={day.sleep || ""} onChange={(e) => setDayField("sleep", e.target.value)} style={inputStyle()} /></div>
        </div>
      </Card>

      {addingMeal && <FoodSearchModal client={client} meal={addingMeal} onClose={() => setAddingMeal(null)} onAdd={(item, m) => addFood(m || addingMeal, item)} onAddMany={(items, m) => addFoods(m || addingMeal, items)} />}
    </div>
  );
}

function PhotoUploadModal({ onClose, onSave }) {
  const [form, setForm] = useState({ image: "", type: "Progress", weight: "", notes: "", date: isoDate() });
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
    const wk = isoWeek(isoDate(cursor));
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
    labels.push(isoDate(d));
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
  return { text: parts.join(" — ") };
}
function ProgressTab({ client }) {
  const isMobile = useIsMobile(520);
  const logs = client.trainingLogs;
  const streak = currentStreakWeeks(logs);
  const volumeTrend = weeklyVolumeTrend(logs, 4);
  const pbs = recentPBsAcrossHistory(logs, 5);
  const adherence = overallAdherence(client.program, logs);
  const insight = buildProgressInsight(streak, volumeTrend, pbs);
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

    <Card style={{ background: BRAND.card2, padding: 14 }}>
      <div style={{ color: BRAND.text, fontWeight: 800, fontSize: 13 }}>Looking for past sessions?</div>
      <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 600, marginTop: 4, lineHeight: 1.5 }}>
        They live on the Program calendar now. Every completed day carries a tick — tap it to see exactly what was lifted, set by set.
      </div>
    </Card>
  </div>;
}
async function loadExerciseLibraryData(trainerId) {
  if (!trainerId) return [];
  const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", trainerId).eq("section", "custom_exercise_library").maybeSingle();
  return Array.isArray(data?.data?.items) ? data.data.items : [];
}
async function loadArticles(trainerId) {
  if (!trainerId) return [];
  const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", trainerId).eq("section", "articles").maybeSingle();
  return data?.data?.articles || [];
}
async function loadIntakeTemplate(trainerId) {
  if (!trainerId) return DEFAULT_INTAKE_QUESTIONS;
  const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", trainerId).eq("section", "intake_template").maybeSingle();
  return data?.data?.questions?.length ? data.data.questions : DEFAULT_INTAKE_QUESTIONS;
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
const PAYPAL_CLIENT_ID = "BAAd5BGOGHj3CeXA5Ys4xWIQf5Ok_zHxmC0vodSe3IU15-aTtq4UNW_PVyAb5y370D0xcGx04v9Xgplnp8"; // sandbox; swap for Live client id when going live
function PayPalCheckout({ client, amount, onPaid }) {
  const ref = useRef(null);
  const [status, setStatus] = useState("loading");
  const [err, setErr] = useState("");
  useEffect(() => {
    let cancelled = false;
    function render() {
      if (cancelled || !ref.current || !window.paypal) return;
      ref.current.innerHTML = "";
      try {
        window.paypal.Buttons({
          style: { layout: "vertical", color: "black", shape: "pill", label: "pay" },
          createOrder: async () => {
            const { data, error } = await supabase.functions.invoke("forge-paypal", { body: { action: "create", amount: String(amount), currency: "USD", description: `Coaching - ${client.name}` } });
            if (error || !data || !data.id) throw new Error("create failed");
            return data.id;
          },
          onApprove: async (d) => {
            setStatus("paying");
            const { data, error } = await supabase.functions.invoke("forge-paypal", { body: { action: "capture", orderId: d.orderID } });
            if (error || !data || data.status !== "COMPLETED") { setErr("Payment did not complete. Try again."); setStatus("ready"); return; }
            setStatus("done");
            if (onPaid) onPaid(data);
          },
          onError: () => { setErr("Payment error. Please try again."); setStatus("ready"); },
        }).render(ref.current);
        setStatus("ready");
      } catch (e) { setErr("Could not load checkout."); setStatus("error"); }
    }
    if (window.paypal) { render(); return () => { cancelled = true; }; }
    const id = "paypal-sdk";
    let script = document.getElementById(id);
    if (!script) {
      script = document.createElement("script");
      script.id = id;
      script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD&components=buttons&enable-funding=card`;
      script.onload = render;
      script.onerror = () => { if (!cancelled) { setErr("Could not load PayPal."); setStatus("error"); } };
      document.body.appendChild(script);
    } else { script.addEventListener("load", render); render(); }
    return () => { cancelled = true; };
  }, [amount]);
  if (status === "done") return <div style={{ background: `${BRAND.green}18`, border: `1px solid ${BRAND.green}`, borderRadius: 12, padding: 14, textAlign: "center" }}><div style={{ color: BRAND.green, fontWeight: 1000, fontSize: 16 }}>Payment received</div><div style={{ color: BRAND.muted, fontSize: 12, marginTop: 4 }}>Thanks, you are all set.</div></div>;
  return <div>
    {status === "loading" && <div style={{ color: BRAND.muted, fontSize: 13, marginBottom: 8 }}>Loading secure checkout...</div>}
    {status === "paying" && <div style={{ color: BRAND.gold, fontSize: 13, marginBottom: 8 }}>Confirming payment...</div>}
    <div ref={ref} />
    {err && <div style={{ color: BRAND.red, fontSize: 12, marginTop: 8 }}>{err}</div>}
  </div>;
}

function PaymentsTab({ client, updateClient, isCoach }) {
  const isMobile = useIsMobile(520);
  const [dueDate, setDueDate] = useState(client.paymentDueDate || "");
  const [price, setPrice] = useState(client.price || "");
  const [saving, setSaving] = useState(false);
  const status = paymentStatus(client);
  async function persist(next) {
    await upsertSection(client.id, "profile", { ...client.profile, ...next });
    updateClient({ ...client, ...next, profile: { ...client.profile, ...next } });
  }
  async function saveDueDate() { setSaving(true); await persist({ paymentDueDate: dueDate, paymentPaid: false }); setSaving(false); }
  async function markPaid() { await persist({ paymentPaid: true }); }
  async function renew30() { const next = new Date(); next.setDate(next.getDate() + 30); const nextDate = isoDate(next); setDueDate(nextDate); await persist({ paymentDueDate: nextDate, paymentPaid: false }); }
  async function savePrice() { setSaving(true); await persist({ price }); setSaving(false); }
  async function onPaid() { const next = new Date(); next.setDate(next.getDate() + 30); await persist({ paymentPaid: true, paymentDueDate: isoDate(next), lastPaidAt: new Date().toISOString() }); }
  return (
    <Card style={{ padding: isMobile ? 12 : 16 }}>
      <div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 10 }}>Payments</div>
      <div style={{ background: BRAND.card2, border: `1px solid ${status.color}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <div style={{ color: status.color, fontWeight: 1000, fontSize: 18 }}>{status.label}</div>
        {client.price && <div style={{ color: BRAND.text, fontSize: 15, fontWeight: 900, marginTop: 4 }}>${client.price} / month</div>}
        {client.paymentDueDate && <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 4 }}>Due date: {client.paymentDueDate}</div>}
      </div>
      {!isCoach && client.price && !client.paymentPaid && <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8, color: BRAND.muted }}>Pay ${client.price} — PayPal, card, Apple Pay or Google Pay</div>
        <PayPalCheckout client={client} amount={client.price} onPaid={onPaid} />
      </div>}
      {!isCoach && !client.price && <div style={{ color: BRAND.muted, fontSize: 13 }}>Your coach has not set a price yet.</div>}
      {!isCoach && client.paymentPaid && <div style={{ color: BRAND.green, fontWeight: 900, fontSize: 14 }}>You are paid up. Thank you.</div>}
      {isCoach && <>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 8, marginBottom: 12 }}>
          <Field label="Monthly price (USD)" value={price} onChange={setPrice} type="number" />
          <Button onClick={savePrice} disabled={saving} style={{ alignSelf: "end" }}>Set Price</Button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 8, marginBottom: 12 }}>
          <Field label="Payment due date" value={dueDate} onChange={setDueDate} type="date" />
          <Button onClick={saveDueDate} disabled={saving} style={{ alignSelf: "end" }}>{saving ? "Saving..." : "Set Due Date"}</Button>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="dark" onClick={markPaid}>Mark as Paid</Button>
          <Button variant="dark" onClick={renew30}>Mark Paid & Renew 30 Days</Button>
        </div>
        <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 12 }}>Set a monthly price so the client can pay in-app. Reminders go out 5 and 2 days before, and if overdue.</div>
      </>}
    </Card>
  );
}
function ClientWorkoutLog({ client, updateClient }) {
  const isMobile = useIsMobile(520);
  const [logs, setLogs] = useState(client.workoutLogs || []);
  const [form, setForm] = useState({ date: isoDate(), workout: "", weights: "", cardio: "", rpe: "", notes: "" });
  async function add() { const next = [{ id: uid(), ...form }, ...logs]; setLogs(next); await upsertSection(client.id, "workoutLogs", next); updateClient({ ...client, workoutLogs: next }); setForm({ ...form, workout: "", weights: "", cardio: "", rpe: "", notes: "" }); }
  return <Card style={{ padding: isMobile ? 12 : 16 }}><div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 1000 }}>Workout Log</div><div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}><Field label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} /><Field label="Workout done" value={form.workout} onChange={(v) => setForm({ ...form, workout: v })} /><Field label="Weights / reps" value={form.weights} onChange={(v) => setForm({ ...form, weights: v })} /><Field label="Cardio" value={form.cardio} onChange={(v) => setForm({ ...form, cardio: v })} /><label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 }}>RPE</div><select value={form.rpe || ""} onChange={(e) => setForm({ ...form, rpe: e.target.value })} style={inputStyle()}>{RPE_OPTIONS.map((r) => <option key={r} value={r}>{r || "RPE"}</option>)}</select></label></div><Field label="Notes" textarea value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} /><Button onClick={add} style={{ marginTop: 10 }}>Log Workout</Button>{logs.map((l) => <div key={l.id} style={{ borderTop: `1px solid ${BRAND.line}`, marginTop: 12, paddingTop: 12 }}><b>{l.date} - {l.workout}</b><div style={{ color: BRAND.muted }}>{l.weights} · {l.cardio} · RPE {l.rpe}</div><div>{l.notes}</div></div>)}</Card>;
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
  function autoBookings() { return autoBookingsFor(clients, weekStart); }
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
  const [tab, setTab] = useState("contact");
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
  const TRIAL_TABS = [
    { key: "contact", label: "Contact" },
    { key: "goals", label: "Goals" },
    { key: "health", label: "Health" },
    { key: "lifestyle", label: "Lifestyle" },
    { key: "priorities", label: "Priorities" },
    { key: "assessment", label: "Assessment" },
  ];
  return <div style={{ display: "grid", gap: 14 }}><Card><div style={{ fontSize: 24, fontWeight: 1000, color: BRAND.gold }}>Trials</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, margin: "12px 0" }}>
      {TRIAL_TABS.map((t) => <Button key={t.key} variant={tab === t.key ? "gold" : "dark"} onClick={() => setTab(t.key)}>{t.label}</Button>)}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
      {tab === "contact" && <><Field label="Name" value={form.name} onChange={(v) => set("name", v)} /><Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} /><Field label="Email" value={form.email} onChange={(v) => set("email", v)} /></>}
      {tab === "goals" && <><Field label="Goal" value={form.goal} onChange={(v) => set("goal", v)} textarea /><Field label="Fitness history" value={form.fitnessHistory} onChange={(v) => set("fitnessHistory", v)} textarea /><Field label="Barriers" value={form.barriers} onChange={(v) => set("barriers", v)} textarea /></>}
      {tab === "health" && <><Field label="Injuries" value={form.injuries} onChange={(v) => set("injuries", v)} textarea /><Field label="Medical issues" value={form.medicalIssues} onChange={(v) => set("medicalIssues", v)} textarea /></>}
      {tab === "lifestyle" && <><Field label="Nutrition" value={form.nutrition} onChange={(v) => set("nutrition", v)} textarea /><Field label="Sleep" value={form.sleep} onChange={(v) => set("sleep", v)} textarea /><Field label="NEAT / daily activity" value={form.neat} onChange={(v) => set("neat", v)} textarea /></>}
      {tab === "priorities" && <><div style={{ gridColumn: "1 / -1", color: BRAND.gold, fontWeight: 1000, marginBottom: 4 }}>On a scale of 1-5, rate how important these are to the client:</div><RatingSelect label="Fat loss" value={form.fatLossImportance} onChange={(v) => set("fatLossImportance", v)} /><RatingSelect label="Muscle gain" value={form.muscleGainImportance} onChange={(v) => set("muscleGainImportance", v)} /><RatingSelect label="Strength and endurance" value={form.strengthEnduranceImportance} onChange={(v) => set("strengthEnduranceImportance", v)} /><RatingSelect label="Mobility & flexibility" value={form.mobilityFlexibilityImportance} onChange={(v) => set("mobilityFlexibilityImportance", v)} /></>}
      {tab === "assessment" && <><Field label="Date" type="date" value={form.assessmentDate} onChange={(v) => set("assessmentDate", v)} /><Field label="Cardiovascular fitness" value={form.cardiovascular} onChange={(v) => set("cardiovascular", v)} /><Field label="Squat" value={form.squat} onChange={(v) => set("squat", v)} /><Field label="Push strength" value={form.pushStrength} onChange={(v) => set("pushStrength", v)} /><Field label="Pull strength" value={form.pullStrength} onChange={(v) => set("pullStrength", v)} /><Field label="Core strength" value={form.coreStrength} onChange={(v) => set("coreStrength", v)} /><Field label="Flexibility fitness" value={form.flexibilityFitness} onChange={(v) => set("flexibilityFitness", v)} /></>}
    </div>
    <Button onClick={saveTrial} style={{ marginTop: 12 }}>Save Trial</Button></Card><Card><div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 10 }}>Saved Trials</div>{trials.length === 0 && <div style={{ color: BRAND.muted }}>No saved trials yet.</div>}{trials.map((t) => <div key={t.id} onClick={() => setOpenTrial(t)} style={{ borderTop: `1px solid ${BRAND.line}`, paddingTop: 12, marginTop: 12, cursor: "pointer" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><b>{t.name}</b>{t.convertedClientId && <span style={{ background: BRAND.green, color: "#000", fontSize: 10, fontWeight: 1000, borderRadius: 999, padding: "2px 8px" }}>CLIENT</span>}</div><div style={{ color: BRAND.muted }}>{t.phone} · {t.email}</div><div style={{ color: BRAND.gold, fontSize: 12, fontWeight: 900 }}>Tap to open</div></div>)}</Card>{openTrial && <div style={modalBackdrop()}><Card style={{ width: "100%", maxWidth: 760, maxHeight: "90vh", overflow: "auto" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 12 }}><div><div style={{ fontSize: 24, fontWeight: 1000 }}>{openTrial.name}</div><div style={{ color: BRAND.muted }}>{openTrial.phone} · {openTrial.email}</div></div><Button variant="ghost" onClick={() => setOpenTrial(null)}>X</Button></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>{Object.entries(openTrial).filter(([k]) => !["id","savedAt"].includes(k)).map(([k,v]) => <Mini key={k} label={k.replace(/([A-Z])/g, " $1")} value={String(v || "-")} />)}</div>{openTrial.convertedClientId ? <div style={{ background: `${BRAND.green}18`, border: `1px solid ${BRAND.green}`, borderRadius: 12, padding: 10, marginTop: 12, color: BRAND.green, fontWeight: 800, fontSize: 13 }}>Converted to a client on {String(openTrial.convertedAt || "").slice(0, 10)}.</div> : null}<div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>{!openTrial.convertedClientId && <Button onClick={() => convertToClient(openTrial)} disabled={converting} style={{ flex: 1 }}>{converting ? "Converting..." : "Convert to Client (client has paid)"}</Button>}<Button variant="dark" disabled={pdfBusy} onClick={async () => { setPdfBusy(true); const { blob, filename } = await downloadTrialPDF(openTrial); downloadBlob(blob, filename); setPdfBusy(false); }}>{pdfBusy ? "..." : "Download PDF"}</Button>{typeof navigator !== "undefined" && navigator.share && <Button variant="dark" disabled={pdfBusy} onClick={async () => { setPdfBusy(true); const { blob, filename } = await downloadTrialPDF(openTrial); await sharePdfBlob(blob, filename, openTrial.name); setPdfBusy(false); }}>Share</Button>}<Button variant="dark" onClick={() => { setForm(openTrial); setOpenTrial(null); }}>Edit</Button><Button variant="red" onClick={() => { save(trials.filter((x) => x.id !== openTrial.id)); setOpenTrial(null); }}>Delete</Button></div></Card></div>}</div>;
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
  const recoveryModeRef = useRef(false);
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
    // exchange) or the older "#access_token=...&type=recovery" hash link. The "?code=" link
    // doesn't always carry a "type=recovery" param alongside it, so we treat the presence of
    // a bare "code" on the root landing page as a recovery link - this app has no other flow
    // that would legitimately land a stray code param here.
    const url = new URL(window.location.href);
    const hasRecoveryCode = !!url.searchParams.get("code");
    const hasRecoveryHash = window.location.hash.includes("type=recovery");
    if (hasRecoveryCode) {
      recoveryModeRef.current = true;
      setRecoveryMode(true);
      supabase.auth.exchangeCodeForSession(url.searchParams.get("code")).then(({ data }) => { if (data?.session) setSession(data.session); setLoading(false); });
    } else if (hasRecoveryHash) {
      recoveryModeRef.current = true;
      setRecoveryMode(true);
    } else {
      supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (data.session) boot(data.session.user); else setLoading(false); });
    }
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (_event === "PASSWORD_RECOVERY") { recoveryModeRef.current = true; setRecoveryMode(true); setLoading(false); return; }
      if (_event === "TOKEN_REFRESHED" || _event === "USER_UPDATED") return; // session stayed the same, just the token renewed - don't reload data mid-session
      if (recoveryModeRef.current) return; // don't auto-boot into the dashboard while someone is mid-way through setting a new password - use the ref, not the state, since this callback is created once and would otherwise see a permanently stale value
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
    if (email.toLowerCase() !== DENIS_EMAIL) return; // never auto-create a trainer row for anyone but the real coach - this is what a random login should NOT be able to grant itself
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
    const { data: trainerMatch } = await supabase.from("trainers").select("id").eq("id", user.id).maybeSingle();
    const isKnownCoach = !!trainerMatch || (user.email || "").toLowerCase() === DENIS_EMAIL;
    if (!isKnownCoach) {
      // Not an existing trainer, not the bootstrap coach email, and no client profile found (deleted, or never existed) - never fall through to the coach dashboard.
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
    : recoveryMode ? <ResetPasswordScreen onDone={() => { recoveryModeRef.current = false; setRecoveryMode(false); }} />
    : loading ? <div style={{ minHeight: "100vh", background: BRAND.bg, display: "grid", placeItems: "center" }}><div style={{ textAlign: "center" }}><div style={{ color: BRAND.gold, fontSize: isMobile ? 40 : 54, fontWeight: 900, letterSpacing: 1, lineHeight: 1 }}>FORGE</div></div></div>
    : !session ? <LoginScreen onReady={() => supabase.auth.getSession().then(({ data }) => data.session && boot(data.session.user))} />
    : clientPortal ? <ClientView client={clientPortal} updateClient={updateClient} isCoach={false} refresh={() => boot(session.user)} />
    : selected ? <ClientView client={selected} updateClient={updateClient} back={() => setSelected(null)} refresh={() => loadCoach(session.user)} isCoach />
    : <CoachDashboard user={session.user} trainer={trainer} setTrainer={setTrainer} clients={clients} setClients={setClients} selectClient={setSelected} refresh={() => loadCoach(session.user)} syncStatus={syncStatus} />}
  </>;
}
