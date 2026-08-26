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
import { ageFromBirthday, daysUntil, nextBirthdayDaysAway, daysSince, initials, getClientColor, normalizeGoals, normalizeInjuries, timeLabel, moneyAED, paymentStatus, makeInviteCode, emptyProfile, emptyNutrition, mapClient, upsertSection, upsertTrainerData, loadTrainerTemplates, safeSelect } from "./lib/clientData.js";
import { buildPdfDoc, downloadBlob, sharePdfBlob, safeFilename } from "./lib/pdf.js";
import { AccountNotActiveScreen } from "./features/auth/AccountNotActiveScreen.jsx";
import { ResetPasswordScreen } from "./features/auth/ResetPasswordScreen.jsx";
import { LoginScreen } from "./features/auth/LoginScreen.jsx";
import { CheckInsTab } from "./features/checkin/CheckInsTab.jsx";
import { Mini } from "./components/ui/Mini.jsx";
import { MessagesTab } from "./features/messages/MessagesTab.jsx";
import { ScheduleTab, InviteTab } from "./features/scheduling/ScheduleTab.jsx";
import { PackagesTab } from "./features/scheduling/PackagesTab.jsx";
import { PaymentsTab } from "./features/payments/PaymentsTab.jsx";
import { CoachContentScreen, LearnTab, HomeLearnStrip } from "./features/learn/LearnTab.jsx";
import { ProfileTab } from "./features/profile/ProfileTab.jsx";
import { IntakeForm, INTAKE_FORM } from "./features/profile/IntakeForm.jsx";
import { fmtLoad, fmtSetTarget, fmtExerciseSummary, blockTitle, exerciseTag, parseSeconds, fmtClock, emptyTrainingLogs, startSession, sessionForWorkout, upsertSessionInLogs, setScoreV2, fmtLoggedSet, suggestProgression, lastSessionSetsFor, exerciseHistoryV2, sessionStatsV2, detectSessionPBs } from "./lib/trainingLogs.js";
import { ProgressHub, ProgressTab, clampPercent, overallAdherence, recentPBsAcrossHistory } from "./features/progress/ProgressTab.jsx";
import { TransformPhotos } from "./features/progress/TransformPhotos.jsx";
import { getVideoThumb, DEFAULT_EXERCISE_VIDEOS } from "./lib/exerciseVideos.js";
import { VideoPlayerModal } from "./components/ui/VideoPlayerModal.jsx";
import { ExerciseLibraryScreen, ProgramBuilder, ProgramTab } from "./features/train/TrainScreens.jsx";
import { buildProgramDays } from "./lib/programModel.js";
import { InjuryBanner } from "./components/ui/InjuryBanner.jsx";
import { ClientWorkoutLog } from "./features/scheduling/ClientWorkoutLog.jsx";
import { Calendar } from "./features/coach/Calendar.jsx";
import { Trials } from "./features/coach/Trials.jsx";
import { countTodaysCalendarSessions } from "./features/coach/coachHelpers.js";
import { ScheduledView, ClientCard, CLIENT_BOTTOM_NAV, ClientBottomNav, HubScreen, ClientAvatar, ClientSettingsModal } from "./features/client-shell/ClientShellUI.jsx";
import { CoachDashboard } from "./features/coach/CoachDashboard.jsx";
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
// ================= PROGRAM SYSTEM (V2 — fresh design) =================
// Model: Program { weeks: [{ workouts: [{ blocks: [{ exercises: [{ sets: [] }] }] }] }] }
// Logs are separate from the program so editing a program never touches history.

// ---------------- Real PDF generation (pdf-lib) + download/share ----------------

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

async function loadExerciseLibraryData(trainerId) {
  if (!trainerId) return [];
  const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", trainerId).eq("section", "custom_exercise_library").maybeSingle();
  return Array.isArray(data?.data?.items) ? data.data.items : [];
}
async function loadIntakeTemplate(trainerId) {
  if (!trainerId) return DEFAULT_INTAKE_QUESTIONS;
  const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", trainerId).eq("section", "intake_template").maybeSingle();
  return data?.data?.questions?.length ? data.data.questions : DEFAULT_INTAKE_QUESTIONS;
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
