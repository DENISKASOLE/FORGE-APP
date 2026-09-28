// Action handlers for /api/ai, ported from the v1 forge-ai router
// (supabase/functions/forge-ai/index.ts, `Deno.serve`). Each handler returns
// exactly the JSON object v1 returned on success; v1's 400 responses become
// HttpError(400, <same message>). Numeric/response logic is unchanged.
import { HttpError } from "../../http";
import { callGemini, callGeminiChat, callGeminiWithFile, type GeminiConfig } from "./gemini";
import {
  BODY_ANALYSIS_SCHEMA, CLIENT_CHAT_SCHEMA, CLIENT_SUMMARY_SCHEMA, COACH_PROGRAM_CREATE_SCHEMA,
  COACH_PROGRAM_EDIT_SCHEMA, DAILY_FEEDBACK_SCHEMA, ESTIMATE_FOOD_SCHEMA, NUTRITION_REPORT_SCHEMA,
  PROGRESSION_SUGGESTION_SCHEMA, REFINE_MEAL_SCHEMA, TRAINING_INSIGHT_SCHEMA,
  bodyAnalysisPrompt, clientChatSystemPrompt, clientSummaryPrompt, coachProgramCreatePrompt,
  coachProgramEditPrompt, dailyFeedbackPrompt, estimateFoodPrompt, nutritionReportPrompt,
  progressionSuggestionPrompt, refineMealPrompt, trainingInsightPrompt,
} from "./prompts";

type Handler = (cfg: GeminiConfig, body: any) => Promise<unknown>;

export const AI_ACTIONS: Record<string, Handler> = {
  async nutrition_report(cfg, body) {
    const draft = await callGemini(cfg, nutritionReportPrompt(body), NUTRITION_REPORT_SCHEMA);
    return { draft };
  },

  async client_summary(cfg, body) {
    const summary = await callGemini(cfg, clientSummaryPrompt(body), CLIENT_SUMMARY_SCHEMA);
    return { summary };
  },

  async daily_nutrition_feedback(cfg, body) {
    const feedback = await callGemini(cfg, dailyFeedbackPrompt(body), DAILY_FEEDBACK_SCHEMA);
    return { feedback };
  },

  async training_insight(cfg, body) {
    const insight = await callGemini(cfg, trainingInsightPrompt(body), TRAINING_INSIGHT_SCHEMA);
    return { insight };
  },

  async coach_program_create(cfg, body) {
    return await callGemini(cfg, coachProgramCreatePrompt(body), COACH_PROGRAM_CREATE_SCHEMA);
  },

  async coach_program_edit_suggest(cfg, body) {
    return await callGemini(cfg, coachProgramEditPrompt(body), COACH_PROGRAM_EDIT_SCHEMA);
  },

  async body_analysis_extract(cfg, body) {
    if (!body.fileBase64 || typeof body.fileBase64 !== "string") throw new HttpError(400, "No file was sent to read.", "bad_request");
    return await callGeminiWithFile(cfg, bodyAnalysisPrompt(), body.fileBase64, String(body.mimeType || "application/pdf"), BODY_ANALYSIS_SCHEMA);
  },

  async progression_suggestion(cfg, body) {
    return await callGemini(cfg, progressionSuggestionPrompt(body), PROGRESSION_SUGGESTION_SCHEMA);
  },

  async client_chat(cfg, body) {
    const { history = [], message, ...ctx } = body;
    if (!Array.isArray(history)) throw new HttpError(400, "Chat history must be a list.", "bad_request");
    const contents = [
      ...history.map((h: any) => ({ role: h?.role === "model" ? "model" : "user", parts: [{ text: h?.text }] })),
      { role: "user", parts: [{ text: message }] },
    ];
    return await callGeminiChat(cfg, clientChatSystemPrompt(ctx), contents, CLIENT_CHAT_SCHEMA);
  },

  async nutrition_estimate_food(cfg, body) {
    const text = String(body.text || "").slice(0, 300);
    if (!text.trim()) throw new HttpError(400, "No text was sent to estimate.", "bad_request");
    const result = await callGemini(cfg, estimateFoodPrompt(text), ESTIMATE_FOOD_SCHEMA);
    // Server validation per §8.1: clamp negatives (a model slip, not
    // something the client should have to defend against), flag (never
    // reject) a large total so the UI can ask "is this right?".
    const items = (result.items || []).map((it: any) => ({
      ...it,
      amount: Math.max(0, it.amount || 0), grams: Math.max(0, it.grams || 0),
      kcal: Math.max(0, it.kcal || 0), protein: Math.max(0, it.protein || 0), carbs: Math.max(0, it.carbs || 0), fat: Math.max(0, it.fat || 0),
    }));
    const totalKcal = items.reduce((s: number, i: any) => s + i.kcal, 0);
    return { items, not_food: !!result.not_food, warning: totalKcal > 3000 ? "large" : null };
  },

  async nutrition_refine_meal(cfg, body) {
    return await callGemini(cfg, refineMealPrompt(body), REFINE_MEAL_SCHEMA);
  },
};

export const AI_ACTION_NAMES = Object.freeze(Object.keys(AI_ACTIONS));

export function isAiAction(action: unknown): action is string {
  return typeof action === "string" && Object.hasOwn(AI_ACTIONS, action);
}
