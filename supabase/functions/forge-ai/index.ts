// Supabase Edge Function: forge-ai
// Single, action-routed entry point for every AI feature in Forge (mirrors
// the forge-fatsecret action-routing pattern) - one function, one deploy,
// one secret, rather than a new edge function per AI feature. Add a new
// `if (action === "...")` block for each new capability as it's built.
// Uses Google's Gemini API (free tier - see README below).
//
// Every action here is a DRAFT/ANALYSIS for a human (coach) to review,
// never a direct write to the database and never something shown to a
// client without a coach seeing it first. Numeric math (averages, totals,
// trends) is always computed by the calling code in src/lib/ai.js and
// passed in pre-computed - the model is only ever asked to read numbers
// and write prose/recommendations around them, never to do arithmetic
// itself.
//
// Actions:
//   nutrition_report - drafts a client's weekly nutrition report
//     (NutritionFlow.jsx's "Draft with AI" button)
//   client_summary   - drafts a 4-week training+nutrition+habits summary
//     for a coach (ProgressTab.jsx's "Generate AI Summary" button)
//
// Secret required: GEMINI_API_KEY
//   1. Get a free key: https://aistudio.google.com/apikey (Google account,
//      no payment method needed - the free tier is generous: as of writing,
//      ~15 requests/minute and 1,500 requests/day on gemini-2.0-flash).
//   2. Set it on this project: either
//        supabase secrets set GEMINI_API_KEY=your-key-here
//      or Supabase Dashboard -> Edge Functions -> Secrets.
//   3. Deploy this function: supabase functions deploy forge-ai
//      (or paste this file's contents into Dashboard -> Edge Functions ->
//      Deploy a new function, named exactly "forge-ai", if you'd rather
//      not use the CLI - NOT the Secrets page, that's a different tab).

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_MODEL = "gemini-2.0-flash";

async function callGemini(prompt: string, responseSchema: any): Promise<any> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("AI features aren't set up yet - missing GEMINI_API_KEY secret.");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0.6 },
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Gemini request failed (${res.status})`);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content - it may have blocked the response.");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Gemini returned malformed JSON.");
  }
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
  const { goal, weightKg, phase, weekSummary, hasNumericData, supplementStack } = input;
  return `You are an experienced physique/performance nutrition coach writing a weekly check-in report for your client. Be direct, specific, and encouraging - never generic filler. Base every claim strictly on the data given below; if data is thin, say so plainly rather than inventing specifics.

CLIENT
- Goal: ${goal || "not specified"}
- Bodyweight: ${weightKg ? `${weightKg}kg` : "not specified"}
- Current nutrition phase: ${phase || "not specified"}
- Supplement stack: ${supplementStack || "none logged"}

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
  const { clientName, goal, periodLabel, trainingSummary, nutritionSummary } = input;
  return `You are an experienced coach reviewing a client's recent progress before your next check-in call. Be direct and specific - reference actual numbers/patterns given below, never generic encouragement. If the data is too thin to say something specific, say that plainly instead of guessing.

CLIENT: ${clientName || "this client"}
GOAL: ${goal || "not specified"}
PERIOD: ${periodLabel}

TRAINING DATA
${trainingSummary || "No training sessions logged in this period."}

NUTRITION/HABITS DATA
${nutritionSummary || "No nutrition or habit data logged in this period."}

TASK
Write a coach-facing summary as JSON matching the given schema - headline, 1-3 training highlights, 0-3 training concerns, 1-3 nutrition highlights, 0-3 nutrition concerns, and one specific recommendation for what to do or discuss next. This is for the coach's eyes only, not the client - be candid.`;
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

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
