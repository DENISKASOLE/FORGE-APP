// Supabase Edge Function: forge-ai
// Single, action-routed entry point for every AI feature in Forge (mirrors
// the forge-fatsecret action-routing pattern) - one function, one deploy,
// one secret, rather than a new edge function per AI feature. Add a new
// `if (action === "...")` block for each new capability as it's built.
// Uses Google's Gemini API (free tier - see README below).
//
// Never a direct write to the database. Two actions (nutrition_report,
// client_summary) are coach-facing drafts reviewed by a human before a
// client ever sees them; two (daily_nutrition_feedback, training_insight)
// go straight to the client on-demand (they tapped a button asking for
// it), so their prompts are deliberately constrained to safe, generic
// advice - never a specific prescribed load/weight (that's
// trainingLogs.js's suggestProgression/suggestPlateauBump's job) and
// never anything resembling medical/diagnostic advice. Numeric math
// (averages, totals, trends) is always computed by the calling code in
// src/lib/ai.js and passed in pre-computed - the model is only ever
// asked to read numbers and write prose/recommendations around them,
// never to do arithmetic itself.
//
// ONE deliberate, scoped exception to "never a specific load": progression_
// suggestion. That request specifically asked AI to own the increment
// on a detected plateau (previously a flat, always-+2.5kg rule) so it can
// vary by the exercise's actual nature (small isolation moves vs heavy
// compounds vs bodyweight/timed work) - it's not a second system
// contradicting the deterministic one, it IS the deterministic plateau
// rule's number, now computed by AI instead of hardcoded. It never
// blocks or replaces the instant local suggestion in the UI - see
// useProgressionSuggestion.js's progressive-enhancement comment.
//
// Actions:
//   nutrition_report         - drafts a client's weekly nutrition report
//     (coach-reviewed; NutritionFlow.jsx's "Draft with AI" button)
//   client_summary            - drafts a 4-week training+nutrition+habits
//     summary for a coach (coach-only; ProgressTab.jsx "Generate AI Summary")
//   daily_nutrition_feedback - today's macro gaps + meal suggestions
//     (client-facing; MacroTracker.jsx "Get AI Feedback" button)
//   training_insight          - cross-exercise trend analysis, no specific
//     loads prescribed (client-facing; ProgressTab.jsx "AI Training Insight")
//   coach_program_create      - generates a full program from a coach's
//     instruction (coach-reviewed; CoachAssistantModal "Create a new
//     program" - the client never sees this until the coach opens it in
//     ProgramBuilder and explicitly clicks Save Program, exactly the same
//     save path as a hand-built program)
//   coach_program_edit_suggest - suggests exercise swaps against the
//     CURRENT program (e.g. "knee pain") as a reviewable list, never a
//     full-program rewrite - keeps every untouched field (sets/reps/tempo/
//     notes) byte-identical since only matched exercise names are swapped
//     client-side (see applyProgramSwaps in src/lib/ai.js)
//   client_chat                - open-ended, multi-turn client chatbot
//     grounded in that client's own real training/nutrition/program data;
//     constrained like training_insight to never prescribe a specific
//     new weight/load and to defer anything medical to their coach
//   progression_suggestion    - exercise-aware next-session increment for
//     a detected 2-session plateau (client-facing, automatic; see the
//     "ONE deliberate exception" note above)
//   body_analysis_extract     - reads an uploaded body-composition report
//     PDF (InBody/DEXA/etc) and returns what is literally printed on it as
//     structured data, so every other AI feature can be grounded in the
//     client's real body composition. Extraction only - it is prompted to
//     never estimate a value that is not on the page, and never to
//     diagnose (see BodyAnalysisCard + buildBodyAnalysisSummary)
//
// Secret required: GEMINI_API_KEY
//   1. Get a free key: https://aistudio.google.com/apikey (Google account,
//      no payment method needed).
//   2. Set it on this project: either
//        supabase secrets set GEMINI_API_KEY=your-key-here
//      or Supabase Dashboard -> Edge Functions -> Secrets.
//   3. Deploy this function: supabase functions deploy forge-ai
//      (or paste this file's contents into Dashboard -> Edge Functions ->
//      Deploy a new function, named exactly "forge-ai", if you'd rather
//      not use the CLI - NOT the Secrets page, that's a different tab).
//
// MODEL NOTE. gemini-2.5-flash is retired for new users - the API replies
// "no longer available to new users... use models/gemini-3.6-flash", so
// 3.6-flash is effectively the only choice on this key, and it works.
//
// Its free-tier quota is 20 requests per MINUTE (the 429s say "retry in
// ~9-50s"; a daily cap would quote hours). That's ample for real use - it
// was only ever tripped by rapid-fire test scripts - but bursts are
// handled by the retry logic below rather than shown to a client.
//
// GEMINI_MODEL overrides this without a code change, for when Google
// retires this one too.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-3.6-flash";

// Free-tier limits are per-minute as well as per-day, so a couple of
// features firing at once (or a coach clicking twice) can trip a 429 that
// would have succeeded moments later. Google tells us how long to wait -
// honour it once or twice rather than surfacing a failure the user has to
// manually retry. Capped so nobody sits waiting on a dead request: a
// daily-quota 429 asks for far longer than we're willing to hold, and
// falls through to the error message instead.
const MAX_RETRIES = 2;
const MAX_RETRY_WAIT_MS = 12000;

function retryDelayMs(errorBody: any): number | null {
  const details = errorBody?.error?.details || [];
  for (const d of details) {
    const raw = d?.retryDelay;
    if (typeof raw === "string") {
      const seconds = parseFloat(raw.replace("s", ""));
      if (!isNaN(seconds)) return Math.ceil(seconds * 1000);
    }
  }
  const message = String(errorBody?.error?.message || "");
  const match = message.match(/retry in ([\d.]+)s/i);
  return match ? Math.ceil(parseFloat(match[1]) * 1000) : null;
}

async function geminiRequest(payload: any): Promise<any> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("AI features aren't set up yet - missing GEMINI_API_KEY secret.");

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json().catch(() => null);

    if (attempt < MAX_RETRIES) {
      // 429 = per-minute quota; Google tells us exactly how long to wait.
      if (res.status === 429) {
        const wait = retryDelayMs(data) ?? 3000;
        if (wait <= MAX_RETRY_WAIT_MS) {
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
      }
      // 500/503 = Gemini having a moment ("The service is currently
      // unavailable"), seen intermittently in testing. Nothing is wrong
      // with the request, so a short backoff usually clears it.
      if (res.status === 500 || res.status === 503) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
    }

    if (!res.ok) {
      const message = data?.error?.message || `Gemini request failed (${res.status})`;
      // The raw quota error is a wall of text with three URLs in it - not
      // something to put in front of a client mid-workout.
      if (res.status === 429) throw new Error(`Gemini rate limit reached (model ${GEMINI_MODEL}). ${message}`);
      throw new Error(message);
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned no content - it may have blocked the response.");
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Gemini returned malformed JSON.");
    }
  }
}

async function callGemini(prompt: string, responseSchema: any): Promise<any> {
  return await geminiRequest({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0.6 },
  });
}

// ---------- action: nutrition_report ----------

const NUTRITION_REPORT_SCHEMA = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING", description: "One encouraging-but-honest sentence summarizing the week, in a coach's voice." },
    targets: {
      type: "OBJECT",
      properties: { calories: { type: "INTEGER" }, protein: { type: "INTEGER" }, carbs: { type: "INTEGER" }, fats: { type: "INTEGER" } },
      required: ["calories", "protein", "carbs", "fats"],
    },
    working: { type: "ARRAY", items: { type: "STRING" }, description: "1-4 short bullet points on what's going well." },
    issues: { type: "ARRAY", items: { type: "STRING" }, description: "1-4 short bullet points on what's going wrong. Empty array if nothing's wrong." },
    swaps: {
      type: "ARRAY",
      description: "0-3 concrete food swaps.",
      items: { type: "OBJECT", properties: { from: { type: "STRING" }, to: { type: "STRING" }, why: { type: "STRING" } }, required: ["from", "to"] },
    },
    targetDay: {
      type: "OBJECT",
      properties: { meals: { type: "ARRAY", items: { type: "OBJECT", properties: { slot: { type: "STRING" }, description: { type: "STRING" }, time: { type: "STRING" } }, required: ["slot", "description"] } } },
      required: ["meals"],
    },
    supplementReview: { type: "STRING", description: "1-2 sentences, or empty string if no supplement stack was provided." },
    nextStep: { type: "STRING", description: "One clear, specific instruction for the client's next phase." },
  },
  required: ["verdict", "targets", "working", "issues", "swaps", "targetDay", "supplementReview", "nextStep"],
};

function nutritionReportPrompt(input: any): string {
  const { goal, weightKg, phase, weekSummary, hasNumericData, supplementStack, bodyAnalysis } = input;
  return `You are an experienced physique/performance nutrition coach writing a weekly check-in report for your client. Be direct, specific, and encouraging - never generic filler. Base every claim strictly on the data given below; if data is thin, say so plainly rather than inventing specifics.

CLIENT
- Goal: ${goal || "not specified"}
- Bodyweight: ${weightKg ? `${weightKg}kg` : "not specified"}
- Current nutrition phase: ${phase || "not specified"}
- Supplement stack: ${supplementStack || "none logged"}
${bodyAnalysis ? `\nBODY COMPOSITION (from the client's uploaded body analysis report - use lean mass, not just bodyweight, when setting protein and calorie targets)\n${bodyAnalysis}` : ""}

THIS WEEK'S LOGGED DATA
${weekSummary || "No food was logged this week."}
${hasNumericData ? "" : "\nNote: this client did not use the macro tracker this week (photo/description diary only, no precise numbers) - do not state precise calorie/macro claims about what they ate; base 'working'/'issues' on the food choices and consistency described, not exact numbers."}

TASK
Write the report as JSON matching the given schema:
- verdict: one honest, specific sentence.
- targets: propose calories/protein/carbs/fats for the NEXT phase, grounded in the client's goal and bodyweight (protein roughly 1.6-2.2g/kg bodyweight is a reasonable default absent other info). These are a coach's proposed starting point, not a diagnosis - the coach will review and can edit them.
- working: what's genuinely working, specifically (not "great job!").
- issues: what's genuinely a problem, specifically. Empty array if nothing stands out.
- swaps: concrete swaps only if something in the log clearly warrants one - otherwise return an empty array, don't invent swaps for their own sake.
- targetDay: a realistic one-day meal-by-meal plan (breakfast/lunch/dinner/snacks or similar) hitting the proposed targets, using foods similar to what this client already eats where the log gives you something to go on.
- supplementReview: comment on their actual stack if one was given, else return an empty string.
- nextStep: one clear, actionable instruction for what happens next.`;
}

// ---------- action: client_summary ----------

const CLIENT_SUMMARY_SCHEMA = {
  type: "OBJECT",
  properties: {
    headline: { type: "STRING", description: "One sentence, the single most important thing about this client's last few weeks." },
    trainingHighlights: { type: "ARRAY", items: { type: "STRING" }, description: "1-3 specific, data-grounded observations about training." },
    trainingConcerns: { type: "ARRAY", items: { type: "STRING" }, description: "0-3 specific concerns about training. Empty array if none." },
    nutritionHighlights: { type: "ARRAY", items: { type: "STRING" }, description: "1-3 specific, data-grounded observations about nutrition/habits." },
    nutritionConcerns: { type: "ARRAY", items: { type: "STRING" }, description: "0-3 specific concerns about nutrition/habits. Empty array if none." },
    recommendation: { type: "STRING", description: "One clear, specific recommendation for what the coach should do or discuss next with this client." },
  },
  required: ["headline", "trainingHighlights", "trainingConcerns", "nutritionHighlights", "nutritionConcerns", "recommendation"],
};

function clientSummaryPrompt(input: any): string {
  const { clientName, goal, periodLabel, trainingSummary, nutritionSummary, bodyAnalysis } = input;
  return `You are an experienced coach reviewing a client's recent progress before your next check-in call. Be direct and specific - reference actual numbers/patterns given below, never generic encouragement. If the data is too thin to say something specific, say that plainly instead of guessing.

CLIENT: ${clientName || "this client"}
GOAL: ${goal || "not specified"}
PERIOD: ${periodLabel}

TRAINING DATA
${trainingSummary || "No training sessions logged in this period."}

NUTRITION/HABITS DATA
${nutritionSummary || "No nutrition or habit data logged in this period."}
${bodyAnalysis ? `\nBODY COMPOSITION (from uploaded body analysis reports)\n${bodyAnalysis}\n` : ""}
TASK
Write a coach-facing summary as JSON matching the given schema - headline, 1-3 training highlights, 0-3 training concerns, 1-3 nutrition highlights, 0-3 nutrition concerns, and one specific recommendation for what to do or discuss next. This is for the coach's eyes only, not the client - be candid.`;
}

// ---------- action: daily_nutrition_feedback ----------

const DAILY_FEEDBACK_SCHEMA = {
  type: "OBJECT",
  properties: {
    feedback: { type: "STRING", description: "1-2 sentences, direct and specific, in a supportive coach voice." },
    gaps: {
      type: "ARRAY",
      description: "0-4 remaining gaps vs target for the rest of today. Empty array if no targets are set or nothing stands out.",
      items: { type: "OBJECT", properties: { label: { type: "STRING" }, amount: { type: "STRING" } }, required: ["label", "amount"] },
    },
    mealSuggestions: {
      type: "ARRAY",
      description: "1-3 specific meal/snack ideas that would help close the gaps, using foods similar to what they already log where possible.",
      items: { type: "OBJECT", properties: { name: { type: "STRING" }, description: { type: "STRING" } }, required: ["name", "description"] },
    },
  },
  required: ["feedback", "gaps", "mealSuggestions"],
};

function dailyFeedbackPrompt(input: any): string {
  const { goal, targets, totals, loggedToday } = input;
  return `You are a supportive nutrition coach giving a client quick, in-the-moment feedback on today's eating so far. This goes straight to the client - be encouraging but specific and honest, never generic ("great job!" alone is not acceptable), and never give medical advice.

CLIENT GOAL: ${goal || "not specified"}
TARGETS FOR TODAY: ${targets ? `${targets.calories}kcal, ${targets.protein}g protein, ${targets.carbs}g carbs, ${targets.fats}g fats` : "no targets set yet"}
LOGGED SO FAR TODAY: ${totals ? `${totals.kcal}kcal, ${totals.protein}g protein, ${totals.carbs}g carbs, ${totals.fats}g fats` : "nothing logged yet"}
FOODS LOGGED TODAY: ${loggedToday || "nothing logged yet"}

TASK: Write JSON matching the schema - one specific feedback sentence, the concrete remaining gaps for the rest of today (empty array if no targets exist or they're on track), and 1-3 realistic meal/snack suggestions that would help close those gaps using food similar to what they already eat.`;
}

// ---------- action: training_insight ----------

const TRAINING_INSIGHT_SCHEMA = {
  type: "OBJECT",
  properties: {
    insight: { type: "STRING", description: "One specific, data-grounded observation about a pattern across their recent training." },
    recommendation: { type: "STRING", description: "One safe, actionable strategy-level suggestion. NEVER a specific weight/load/rep number to lift next - only pattern-level advice (e.g. deload, vary rep range, address recovery, work a lagging pattern)." },
  },
  required: ["insight", "recommendation"],
};

function trainingInsightPrompt(input: any): string {
  const { goal, trainingSummary } = input;
  return `You are an experienced strength coach reviewing a client's recent training log for a pattern worth pointing out to them directly. This goes straight to the client.

CRITICAL RULE: Do NOT prescribe a specific weight, load, or rep number for their next session - Forge already has a separate deterministic system that handles exact load recommendations per set. Your job is pattern-level: is RPE creeping up while load stalls (possible plateau/overreach)? Is one movement pattern lagging? Is volume trending down? Etc. Recommend a strategy (deload a week, vary rep range, prioritize recovery, address a specific weak pattern), never a number.

CLIENT GOAL: ${goal || "not specified"}

RECENT TRAINING DATA (grouped by exercise, chronological)
${trainingSummary || "Not enough logged data to find a pattern yet."}

TASK: Write JSON matching the schema - one specific, data-grounded insight and one safe strategy-level recommendation. If there's genuinely not enough data for a real pattern, say so honestly in the insight rather than inventing one.`;
}

// ---------- document call (body_analysis_extract - reads an uploaded file) ----------

async function callGeminiWithFile(prompt: string, fileBase64: string, mimeType: string, responseSchema: any): Promise<any> {
  return await geminiRequest({
    contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: fileBase64 } }, { text: prompt }] }],
    // Low temperature: this is transcription of what's printed on a
    // document, not a creative task.
    generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0.1 },
  });
}

// ---------- action: body_analysis_extract ----------
// Deliberately a flexible metrics ARRAY rather than fixed named fields:
// body-composition reports vary enormously (InBody vs DEXA vs a smart
// scale printout vs a caliper sheet), and a fixed schema would either
// force the model to invent values the report doesn't have or silently
// drop ones it does. `key` maps a row to a canonical name when it
// recognises one, so trends/grounding can still find the important
// numbers without constraining what gets captured.

const BODY_ANALYSIS_SCHEMA = {
  type: "OBJECT",
  properties: {
    reportType: { type: "STRING", description: "e.g. 'InBody 770', 'DEXA scan', 'Bioimpedance scale'. Empty string if it isn't stated." },
    testDate: { type: "STRING", description: "The test/scan date printed on the report as YYYY-MM-DD. Empty string if not printed - do NOT guess or use today's date." },
    metrics: {
      type: "ARRAY",
      description: "Every measured value actually printed on the report, in the order they appear.",
      items: {
        type: "OBJECT",
        properties: {
          label: { type: "STRING", description: "The metric name as printed, e.g. 'Skeletal Muscle Mass'." },
          value: { type: "STRING", description: "The value exactly as printed." },
          unit: { type: "STRING", description: "e.g. 'kg', '%', 'kcal'. Empty string if unitless." },
          key: { type: "STRING", description: "Canonical name IF this row clearly is one of: weight, body_fat_percent, skeletal_muscle_mass, fat_mass, lean_mass, bmi, visceral_fat, bmr, body_water. Otherwise an empty string." },
          note: { type: "STRING", description: "Any range/rating printed alongside it (e.g. 'below normal'). Empty string if none." },
        },
        required: ["label", "value", "unit", "key", "note"],
      },
    },
    keyFindings: { type: "ARRAY", items: { type: "STRING" }, description: "2-5 short, factual observations grounded strictly in the printed numbers." },
    coachNotes: { type: "STRING", description: "What a strength/nutrition coach should take into account when programming for this person, based only on these numbers." },
    summary: { type: "STRING", description: "2-3 plain-language sentences summarizing this report." },
  },
  required: ["reportType", "testDate", "metrics", "keyFindings", "coachNotes", "summary"],
};

function bodyAnalysisPrompt(): string {
  return `You are reading a client's body composition / body analysis report that their coach has uploaded (e.g. an InBody printout, a DEXA scan, a bioimpedance scale report, or a manual measurement sheet). Your job is careful, literal EXTRACTION so the coaching app can use these numbers.

CRITICAL RULES
- Transcribe ONLY what is actually printed in the document. Never estimate, infer, average, or fill in a "typical" value for anything that isn't there. A missing value must simply be left out of the metrics list.
- Do not convert units or recalculate anything - copy values as printed.
- If the testDate isn't printed on the document, return an empty string for it. Do NOT substitute today's date.
- If this document is NOT a body composition/analysis report at all, return an empty metrics array and say plainly what the document appears to be in the summary.
- You are NOT a doctor: describe and contextualize for training/nutrition purposes, never diagnose. If a value looks clinically concerning, note in coachNotes that it's worth review by a medical professional - don't interpret it medically yourself.

TASK: Return JSON matching the schema - the report type, the test date, every printed metric, 2-5 factual key findings, coach-relevant notes for programming, and a short plain-language summary.`;
}

// ---------- multi-turn chat call (client_chat only - the other actions are single-turn) ----------

async function callGeminiChat(systemPrompt: string, contents: any[], responseSchema: any): Promise<any> {
  return await geminiRequest({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0.7 },
  });
}

// ---------- action: coach_program_create ----------
// Full nested schema, fixed depth (program -> weeks -> workouts -> blocks ->
// exercises -> sets) - not recursive, so an explicit nested schema is safe
// and Gemini's structured-output mode enforces it exactly, no partial/
// malformed shapes to guard against client-side beyond sane defaults.

const SET_SCHEMA = {
  type: "OBJECT",
  properties: {
    targetReps: { type: "STRING", description: "e.g. '8-10' or '5'." },
    targetLoad: { type: "STRING", description: "e.g. '60' (kg) or '' if load type isn't kg or is coach's-discretion." },
    targetRpe: { type: "STRING", description: "e.g. '8', or '' if not prescribing by RPE." },
  },
  required: ["targetReps", "targetLoad", "targetRpe"],
};
const EXERCISE_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING", description: "A real, specific gym exercise name." },
    loadType: { type: "STRING", enum: ["kg", "%1RM", "RPE", "BW"] },
    tempo: { type: "STRING", description: "e.g. '3-1-1', or '' if not prescribing tempo." },
    rest: { type: "STRING", description: "e.g. '90s', or '' if not specified." },
    note: { type: "STRING", description: "Short coaching cue, or '' if none." },
    sets: { type: "ARRAY", items: SET_SCHEMA, description: "Typically 2-5 sets." },
  },
  required: ["name", "loadType", "tempo", "rest", "note", "sets"],
};
const BLOCK_SCHEMA = {
  type: "OBJECT",
  properties: {
    type: { type: "STRING", enum: ["straight", "superset", "circuit"] },
    rounds: { type: "INTEGER", description: "1 for straight/superset; 2-5 for circuit." },
    exercises: { type: "ARRAY", items: EXERCISE_SCHEMA, description: "1 exercise for 'straight', 2+ for 'superset'/'circuit'." },
  },
  required: ["type", "rounds", "exercises"],
};
const WORKOUT_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING", description: "e.g. 'Upper Body', 'Push Day'." },
    note: { type: "STRING", description: "Warm-up or session intent, or '' if none." },
    dayOfWeek: { type: "INTEGER", description: "1=Monday..7=Sunday, spread sensibly across the week for the number of training days requested." },
    blocks: { type: "ARRAY", items: BLOCK_SCHEMA, description: "Typically 3-8 blocks." },
  },
  required: ["name", "note", "dayOfWeek", "blocks"],
};
const WEEK_SCHEMA = {
  type: "OBJECT",
  properties: {
    weekNum: { type: "INTEGER" },
    label: { type: "STRING", description: "Phase label, e.g. 'Base', 'Deload', or '' if none." },
    focus: { type: "STRING", description: "e.g. 'Hypertrophy - moderate volume', or '' if none." },
    targetRpe: { type: "STRING", description: "e.g. '7-8', or '' if not specified." },
    workouts: { type: "ARRAY", items: WORKOUT_SCHEMA },
  },
  required: ["weekNum", "label", "focus", "targetRpe", "workouts"],
};
const COACH_PROGRAM_CREATE_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING", description: "1-2 sentences describing what was built, for the coach to read before opening it." },
    program: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING" },
        goal: { type: "STRING" },
        weeks: { type: "ARRAY", items: WEEK_SCHEMA },
      },
      required: ["name", "goal", "weeks"],
    },
  },
  required: ["summary", "program"],
};

function coachProgramCreatePrompt(input: any): string {
  const { clientName, goal, injuries, instruction } = input;
  return `You are an experienced strength & conditioning coach building a training program for a real client, to hand to their coach for review before anything is saved or shown to the client.

CLIENT: ${clientName || "this client"}
GOAL: ${goal || "not specified"}
KNOWN INJURIES/LIMITATIONS: ${injuries || "none logged"}

COACH'S INSTRUCTION: "${instruction}"

TASK: Design a complete, sensible program as JSON matching the given schema.
- Read the instruction for the number of training days per week and total program length; if either isn't stated, default to 4 weeks and a day-split that fits the client's goal (e.g. full body 3x/week for general fitness).
- If injuries/limitations are given, actively avoid or substitute movements that would aggravate them - never include a contraindicated exercise.
- Give every exercise real, specific set/rep/rest prescriptions appropriate to the goal (e.g. lower reps + more rest for strength, moderate reps + shorter rest for hypertrophy).
- Vary week-to-week (label/focus/targetRpe) to show sensible progression across the program rather than repeating one week verbatim.
- Spread workouts across dayOfWeek sensibly (e.g. don't stack two leg-dominant days back to back) with rest days between where appropriate.
- This is a first draft the coach will review and can edit before saving - make it good enough to need only minor tweaks, not a placeholder.`;
}

// ---------- action: coach_program_edit_suggest ----------

const COACH_PROGRAM_EDIT_SCHEMA = {
  type: "OBJECT",
  properties: {
    note: { type: "STRING", description: "1-2 sentences on the overall approach taken. If nothing needs changing, say so here and return an empty swaps array." },
    swaps: {
      type: "ARRAY",
      description: "0-8 suggested exercise swaps. Only suggest a swap where the instruction genuinely warrants one.",
      items: {
        type: "OBJECT",
        properties: {
          workoutName: { type: "STRING", description: "Must exactly match a workout name from the program summary given." },
          exerciseName: { type: "STRING", description: "Must exactly match an exercise name from that workout in the program summary given - copy it verbatim, do not paraphrase." },
          suggestedReplacement: { type: "STRING", description: "A real, specific replacement exercise name." },
          reason: { type: "STRING", description: "One short sentence, specific to this client's instruction." },
        },
        required: ["workoutName", "exerciseName", "suggestedReplacement", "reason"],
      },
    },
  },
  required: ["note", "swaps"],
};

function coachProgramEditPrompt(input: any): string {
  const { goal, injuries, instruction, programSummary } = input;
  return `You are an experienced strength & conditioning coach reviewing a client's CURRENT program and deciding which exercises, if any, need to be swapped out based on a specific instruction from their coach. This produces a reviewable list of suggestions only - you are not rewriting the program, only proposing individual exercise substitutions.

CLIENT GOAL: ${goal || "not specified"}
KNOWN INJURIES/LIMITATIONS: ${injuries || "none logged"}

CURRENT PROGRAM (workout: exercise names)
${programSummary}

COACH'S INSTRUCTION: "${instruction}"

TASK: Write JSON matching the schema.
- Only suggest swapping an exercise that the instruction genuinely calls for changing (e.g. a movement that would aggravate a stated injury, or is off-goal). Do not touch exercises the instruction gives no reason to change.
- exerciseName and workoutName must be copied EXACTLY, character-for-character, from the program summary above - the app matches on this string to apply your suggestion, so a mismatch means nothing happens.
- suggestedReplacement should train a similar pattern/muscle group where reasonable, adjusted for the stated reason.
- If nothing in the current program actually needs changing for this instruction, return an empty swaps array and say so in note - do not invent swaps just to have something to suggest.`;
}

// ---------- action: client_chat ----------

const CLIENT_CHAT_SCHEMA = {
  type: "OBJECT",
  properties: { reply: { type: "STRING", description: "A conversational reply, 1-4 sentences unless the question genuinely needs more." } },
  required: ["reply"],
};

function clientChatSystemPrompt(input: any): string {
  const { clientName, goal, trainingSummary, nutritionSummary, programOverview, bodyAnalysis } = input;
  return `You are Forge's in-app AI coach, chatting directly with ${clientName || "a client"} inside their training app. Be warm, direct, and specific - ground every answer in the real data given below, never generic filler. Keep replies conversational and short unless the question needs more.

CLIENT GOAL: ${goal || "not specified"}

CURRENT PROGRAM
${programOverview || "No program assigned yet."}

RECENT TRAINING (last ~4 weeks)
${trainingSummary || "No completed sessions logged recently."}

RECENT NUTRITION (last ~7 days)
${nutritionSummary || "No nutrition data logged recently."}
${bodyAnalysis ? `\nBODY COMPOSITION (from their own uploaded body analysis report - you may reference these numbers directly)\n${bodyAnalysis}\n` : ""}
HARD RULES - never break these:
1. NEVER prescribe a specific new weight/load/rep number for an exercise - Forge has a separate deterministic system for that (tell them to check their next logged set if they ask "what weight should I lift"). You CAN discuss patterns, trends, and general training principles.
2. NEVER give medical or injury-diagnosis advice - if they mention pain, injury, or a medical concern, say plainly that this needs their coach or a medical professional, don't try to diagnose or treat it.
3. If the data above is too thin to answer specifically, say that honestly rather than inventing numbers or history that wasn't given to you.
4. You're a supplement to their coach, not a replacement - for anything about changing their actual program or serious concerns, point them to message their coach.

Respond to their message as JSON matching the schema.`;
}

// ---------- action: progression_suggestion ----------

const PROGRESSION_SUGGESTION_SCHEMA = {
  type: "OBJECT",
  properties: {
    suggestion: { type: "STRING", description: "A short, concrete, actionable instruction for next session, e.g. '+2.5kg' or '+1kg per dumbbell' or 'Hold the weight, add 1-2 reps per set'." },
    reasoning: { type: "STRING", description: "One short clause explaining why this fits this specific exercise - not generic filler." },
  },
  required: ["suggestion", "reasoning"],
};

function progressionSuggestionPrompt(input: any): string {
  const { exerciseName, muscleGroup, movementPattern, workingWeight, timed, recentSets } = input;
  const setsText = (recentSets || [])
    .map((s: any, i: number) => `Set ${i + 1}: ${s.load ? `${s.load}kg` : ""}${s.reps ? ` x ${s.reps} reps` : ""}${s.duration ? `${s.duration}` : ""}${s.rpe ? ` @RPE${s.rpe}` : ""}`.trim())
    .join("; ");
  return `You are an experienced strength coach. A client has logged the exact same working weight on this exercise for two sessions running - it's time to recommend a specific, concrete next-session progression suited to THIS exercise's nature, not a flat generic rule.

EXERCISE: ${exerciseName}
MUSCLE GROUP: ${muscleGroup || "not tagged"}
MOVEMENT PATTERN: ${movementPattern || "not tagged"}
${timed ? "This is a timed/duration-based exercise, not a loaded one." : `CURRENT WORKING WEIGHT: ${workingWeight}kg`}
MOST RECENT SESSION'S SETS: ${setsText || "not available"}

TASK: Recommend the next-session progression as JSON matching the schema.
- Small isolation movements (curls, lateral raises, cable/machine isolation work, etc.) should get a small increment (0.5-2kg) - a full 2.5kg jump is too aggressive for something like a lateral raise.
- Large compound bilateral barbell lifts (squat, deadlift, bench press, barbell row) can typically take a full 2.5-5kg jump.
- Unilateral or dumbbell work: specify the increment PER hand/side, not combined (e.g. "+1kg per dumbbell").
- Bodyweight or timed/duration exercises: there's no weight to add - recommend adding reps, adding a pause/tempo constraint, or increasing duration instead.
- Be concrete and specific ("+2.5kg", not "a bit more weight"), and give one short, specific reason grounded in this exercise's actual demands (joint stress, typical load jumps for this movement pattern, etc.), not a generic platitude.`;
}

// ---------- router ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (o: any, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { ...CORS, "Content-Type": "application/json" } });
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "nutrition_report") {
      const draft = await callGemini(nutritionReportPrompt(body), NUTRITION_REPORT_SCHEMA);
      return json({ draft });
    }

    if (action === "client_summary") {
      const summary = await callGemini(clientSummaryPrompt(body), CLIENT_SUMMARY_SCHEMA);
      return json({ summary });
    }

    if (action === "daily_nutrition_feedback") {
      const feedback = await callGemini(dailyFeedbackPrompt(body), DAILY_FEEDBACK_SCHEMA);
      return json({ feedback });
    }

    if (action === "training_insight") {
      const insight = await callGemini(trainingInsightPrompt(body), TRAINING_INSIGHT_SCHEMA);
      return json({ insight });
    }

    if (action === "coach_program_create") {
      const result = await callGemini(coachProgramCreatePrompt(body), COACH_PROGRAM_CREATE_SCHEMA);
      return json(result);
    }

    if (action === "coach_program_edit_suggest") {
      const result = await callGemini(coachProgramEditPrompt(body), COACH_PROGRAM_EDIT_SCHEMA);
      return json(result);
    }

    if (action === "body_analysis_extract") {
      if (!body.fileBase64) return json({ error: "No file was sent to read." }, 400);
      const result = await callGeminiWithFile(bodyAnalysisPrompt(), body.fileBase64, body.mimeType || "application/pdf", BODY_ANALYSIS_SCHEMA);
      return json(result);
    }

    if (action === "progression_suggestion") {
      const result = await callGemini(progressionSuggestionPrompt(body), PROGRESSION_SUGGESTION_SCHEMA);
      return json(result);
    }

    if (action === "client_chat") {
      const { history = [], message, ...ctx } = body;
      const contents = [
        ...history.map((h: any) => ({ role: h.role === "model" ? "model" : "user", parts: [{ text: h.text }] })),
        { role: "user", parts: [{ text: message }] },
      ];
      const result = await callGeminiChat(clientChatSystemPrompt(ctx), contents, CLIENT_CHAT_SCHEMA);
      return json(result);
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
