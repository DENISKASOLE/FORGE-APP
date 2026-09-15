import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";

const supabase = createClient("https://rjzfyfgymkcaffazzpff.supabase.co", "sb_publishable_Qdb11LbLJGIC4vr323_PgQ_6QEx5rtV");
let pass = 0, fail = 0;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let first = true;

async function check(name, body, validate) {
  // 20 req/min free-tier cap - space calls so the suite itself does not trip it.
  if (!first) await sleep(4000); first = false;
  const { data, error } = await supabase.functions.invoke("forge-ai", { body });
  if (error) {
    let real = error.message;
    try { real = (await error.context.json())?.error || real; } catch {}
    console.log(`❌ ${name}: ${real}`); fail++; return null;
  }
  const problem = validate(data);
  if (problem) { console.log(`❌ ${name}: ${problem}\n   ${JSON.stringify(data).slice(0,250)}`); fail++; return data; }
  console.log(`✅ ${name}`); pass++; return data;
}

const client = { goal: "Hypertrophy", clientName: "Alex" };

const chat = await check("client_chat", { action: "client_chat", ...client,
  trainingSummary: "2026-09-01: Push - 12/12 sets, 3200kg, avg RPE 8.0\n2026-09-08: Push - 12/12 sets, 3250kg, avg RPE 8.5",
  nutritionSummary: "Logged 5/7 days. Avg 2100kcal, 140p/200c/70f.",
  programOverview: "Week 1:\n  Push Day: Bench Press, Overhead Press",
  bodyAnalysis: "Latest body analysis — 2026-09-01 (InBody 770): Weight: 82kg, Percent Body Fat: 17.1%",
  history: [], message: "Am I gaining muscle or just weight?" },
  (d) => typeof d?.reply === "string" && d.reply.length > 20 ? null : "missing reply");
if (chat) console.log(`   → ${chat.reply.slice(0,200)}\n`);

const prog = await check("progression_suggestion", { action: "progression_suggestion",
  exerciseName: "Dumbbell Lateral Raise", muscleGroup: "Shoulders", movementPattern: "Isolation",
  workingWeight: 8, timed: false, recentSets: [{load:"8",reps:"12",rpe:"8"},{load:"8",reps:"12",rpe:"8"}] },
  (d) => d?.suggestion && d?.reasoning ? null : "missing suggestion/reasoning");
if (prog) console.log(`   → ${prog.suggestion} — ${prog.reasoning}\n`);

const ins = await check("training_insight", { action: "training_insight", goal: "Hypertrophy",
  trainingSummary: "Bench Press — 2026-08-01: 80kg@RPE7, 2026-08-08: 80kg@RPE8, 2026-08-15: 80kg@RPE9" },
  (d) => d?.insight?.insight && d?.insight?.recommendation ? null : "missing insight/recommendation");
if (ins) console.log(`   → ${ins.insight.insight}\n`);

const fb = await check("daily_nutrition_feedback", { action: "daily_nutrition_feedback", goal: "Fat loss",
  targets: {calories:2000,protein:150,carbs:200,fats:60}, totals: {kcal:900,protein:60,carbs:90,fats:30},
  loggedToday: "breakfast: oats, whey" },
  (d) => d?.feedback?.feedback && Array.isArray(d?.feedback?.gaps) ? null : "missing feedback/gaps");
if (fb) console.log(`   → ${fb.feedback.feedback}\n`);

const rep = await check("nutrition_report", { action: "nutrition_report", goal: "Fat loss", weightKg: 82,
  phase: "Cut", hasNumericData: true, supplementStack: "Creatine (5g, daily)",
  weekSummary: "2026-09-01: Breakfast: oats | Lunch: chicken rice [tracked: 2100kcal, 140p/200c/70f]",
  bodyAnalysis: "Latest body analysis — (InBody 770): Weight: 82kg, Skeletal Muscle Mass: 38.2kg, Percent Body Fat: 17.1%" },
  (d) => d?.draft?.verdict && d?.draft?.targets?.protein && Array.isArray(d?.draft?.working) ? null : "missing draft fields");
if (rep) console.log(`   → targets: ${rep.draft.targets.calories}kcal ${rep.draft.targets.protein}p\n`);

const sum = await check("client_summary", { action: "client_summary", clientName: "Alex", goal: "Hypertrophy",
  periodLabel: "Last 28 days",
  trainingSummary: "8 completed sessions: steady volume, avg RPE 8",
  nutritionSummary: "Logged food 20/28 days. Avg 2400kcal, 150p.",
  bodyAnalysis: "Latest — Weight: 82kg, Percent Body Fat: 17.1%" },
  (d) => d?.summary?.headline && d?.summary?.recommendation ? null : "missing summary fields");
if (sum) console.log(`   → ${sum.summary.headline}\n`);

const swaps = await check("coach_program_edit_suggest", { action: "coach_program_edit_suggest",
  goal: "Hypertrophy", injuries: "Left knee pain on deep flexion", instruction: "Modify because of knee pain",
  programSummary: "Week 1:\n  Leg Day: Back Squat, Leg Press, Walking Lunge, Leg Curl" },
  (d) => Array.isArray(d?.swaps) ? null : "swaps not an array");
if (swaps) console.log(`   → ${swaps.swaps.map(s=>`${s.exerciseName}→${s.suggestedReplacement}`).join(", ")||"none"}\n`);

const created = await check("coach_program_create", { action: "coach_program_create", clientName: "Alex",
  goal: "Hypertrophy", injuries: "Mild left knee pain on deep flexion",
  instruction: "Create a 3-day full body program for hypertrophy, avoid deep knee flexion" },
  (d) => {
    const p = d?.program;
    if (!p?.weeks?.length) return "no weeks";
    if (!p.weeks[0].workouts?.length) return "no workouts";
    const b = p.weeks[0].workouts[0].blocks;
    if (!b?.length || !b[0].exercises?.length || !b[0].exercises[0].sets?.length) return "incomplete block/exercise/sets";
    return null;
  });
if (created) {
  const p = created.program;
  console.log(`   → "${p.name}" ${p.weeks.length} weeks, ${p.weeks[0].workouts.length} workouts/wk`);
  console.log(`   → W1D1: ${p.weeks[0].workouts[0].blocks.flatMap(b=>b.exercises.map(e=>e.name)).join(", ")}\n`);
}

// Synthetic InBody-style report. NO test date on purpose - the prompt says
// never invent one, so an empty testDate is the correct answer.
const pdf = await PDFDocument.create();
const page = pdf.addPage([595, 842]);
const font = await pdf.embedFont(StandardFonts.Helvetica);
[ "BODY COMPOSITION ANALYSIS", "Device: InBody 770", "", "Weight: 82.4 kg",
  "Skeletal Muscle Mass: 38.2 kg", "Body Fat Mass: 14.1 kg", "Percent Body Fat: 17.1 %",
  "BMI: 24.6", "Visceral Fat Level: 7", "Basal Metabolic Rate: 1802 kcal",
].forEach((line, i) => page.drawText(line, { x: 50, y: 760 - i * 28, size: 14, font }));
const fileBase64 = await pdf.saveAsBase64();

const body = await check("body_analysis_extract", { action: "body_analysis_extract", fileBase64, mimeType: "application/pdf" },
  (d) => {
    if (!d?.summary || !Array.isArray(d?.metrics)) return "missing summary/metrics";
    const bf = d.metrics.find(m => m.key === "body_fat_percent");
    if (!bf) return "did not find body fat metric";
    if (!String(bf.value).includes("17.1")) return `body fat value wrong: ${bf.value}`;
    return null;
  });
if (body) {
  console.log(`   → ${body.reportType} | ${body.metrics.length} metrics captured`);
  console.log(`   → testDate: ${JSON.stringify(body.testDate)} ${body.testDate === "" ? "(correctly not invented ✓)" : "(⚠ INVENTED — none was on the page)"}`);
  console.log(`   → ${body.metrics.map(m=>`${m.label}=${m.value}${m.unit}`).join(", ").slice(0,260)}\n`);
}

console.log(`\n${pass} passed, ${fail} failed`);
