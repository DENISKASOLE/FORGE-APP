import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeEnv, jsonRequest, jsonResponse, limiter, mount, sessionStub } from "./helpers";

vi.mock("../../worker/lib/session", () => sessionStub);

const { default: aiRoute, AI_RATE_LIMIT_MESSAGE } = await import("../../worker/routes/ai");
const { AI_ACTION_NAMES } = await import("../../worker/lib/services/ai/actions");
const { geminiRequest, retryDelayMs } = await import("../../worker/lib/services/ai/gemini");

const app = mount("/api/ai", aiRoute);
const post = (body: unknown, user: string | null = "user-1", env = fakeEnv(), headers: Record<string, string> = {}) =>
  app.request("/api/ai", jsonRequest(body, user ?? undefined, headers), env);

const geminiOk = (obj: unknown) => jsonResponse({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("/api/ai router", () => {
  it("returns 401 without a session", async () => {
    const res = await post({ action: "training_insight" }, null);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { message: "Not signed in", code: "unauthorized" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 429 with a friendly message when the per-user limiter trips", async () => {
    const env = fakeEnv({ AI_LIMITER: limiter(false) });
    const res = await post({ action: "training_insight" }, "user-1", env);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toEqual({ message: AI_RATE_LIMIT_MESSAGE, code: "rate_limited" });
    expect(env.AI_LIMITER.limit).toHaveBeenCalledWith({ key: "user-1" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown action with 400", async () => {
    const res = await post({ action: "drop_tables" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toEqual({ message: "Unknown action: drop_tables", code: "unknown_action" });
  });

  it("does not treat Object prototype keys as actions", async () => {
    const res = await post({ action: "constructor" });
    expect(res.status).toBe(400);
  });

  it("rejects bodies over the size cap with 413", async () => {
    const res = await post({ action: "training_insight" }, "user-1", fakeEnv(), { "Content-Length": String(16 * 1024 * 1024) });
    expect(res.status).toBe(413);
  });

  it("rejects invalid JSON with 400", async () => {
    const res = await post("{not json", "user-1");
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("bad_json");
  });

  it("knows all 11 v1 actions", () => {
    expect([...AI_ACTION_NAMES].sort()).toEqual([
      "body_analysis_extract", "client_chat", "client_summary", "coach_program_create", "coach_program_edit_suggest",
      "daily_nutrition_feedback", "nutrition_estimate_food", "nutrition_refine_meal", "nutrition_report",
      "progression_suggestion", "training_insight",
    ]);
  });

  it("wraps a v1-shaped result in the data envelope", async () => {
    fetchMock.mockResolvedValueOnce(geminiOk({ insight: "RPE creeping", recommendation: "Deload" }));
    const res = await post({ action: "training_insight", goal: "strength" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { insight: { insight: "RPE creeping", recommendation: "Deload" } } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/models/gemini-test:generateContent?key=test-gemini-key");
    expect(JSON.parse(init.body).contents[0].parts[0].text).toContain("CLIENT GOAL: strength");
  });

  it("keeps v1's 400 messages for missing inputs", async () => {
    const res = await post({ action: "body_analysis_extract" });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toBe("No file was sent to read.");
    const res2 = await post({ action: "nutrition_estimate_food", text: "   " });
    expect((await res2.json()).error.message).toBe("No text was sent to estimate.");
  });

  it("clamps negative estimates and flags large totals (nutrition_estimate_food)", async () => {
    fetchMock.mockResolvedValueOnce(geminiOk({
      items: [{ name: "x", amount: -1, unit: "g", grams: 10, kcal: 3200, protein: -5, carbs: 1, fat: 1, confidence: "low" }],
      not_food: false,
    }));
    const { data } = await (await post({ action: "nutrition_estimate_food", text: "a feast" })).json();
    expect(data.items[0]).toMatchObject({ amount: 0, protein: 0, kcal: 3200 });
    expect(data.warning).toBe("large");
  });

  it("sends a PDF as inline_data with an intact payload", async () => {
    fetchMock.mockResolvedValueOnce(geminiOk({ summary: "ok", metrics: [] }));
    await post({ action: "body_analysis_extract", fileBase64: "QUJD", mimeType: "application/pdf" });
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.contents[0].parts[0]).toEqual({ inline_data: { mime_type: "application/pdf", data: "QUJD" } });
    expect(payload.generationConfig.temperature).toBe(0.1);
  });

  it("builds multi-turn contents for client_chat", async () => {
    fetchMock.mockResolvedValueOnce(geminiOk({ reply: "hi" }));
    await post({ action: "client_chat", message: "next?", history: [{ role: "model", text: "a" }, { role: "user", text: "b" }] });
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.contents.map((m: any) => m.role)).toEqual(["model", "user", "user"]);
    expect(payload.systemInstruction.parts[0].text).toContain("Forge's in-app AI coach");
  });

  it("surfaces Gemini failures as 500 with the real message (v1 behaviour)", async () => {
    const res = await post({ action: "training_insight" }, "user-1", fakeEnv({ GEMINI_API_KEY: undefined }));
    expect(res.status).toBe(500);
    expect((await res.json()).error.message).toMatch(/missing GEMINI_API_KEY/);
  });
});

describe("gemini retry", () => {
  const cfg = (sleep = vi.fn(async () => {})) => ({ apiKey: "k", model: "m", sleep });

  it("retries a 503 then succeeds", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: "unavailable" } }, 503)).mockResolvedValueOnce(geminiOk({ ok: 1 }));
    const c = cfg();
    expect(await geminiRequest(c, {})).toEqual({ ok: 1 });
    expect(c.sleep).toHaveBeenCalledWith(1500);
  });

  it("honours Google's retryDelay on 429 and gives up after MAX_RETRIES", async () => {
    const quota = () => jsonResponse({ error: { message: "quota", details: [{ retryDelay: "2s" }] } }, 429);
    fetchMock.mockResolvedValueOnce(quota()).mockResolvedValueOnce(quota()).mockResolvedValueOnce(quota());
    const c = cfg();
    await expect(geminiRequest(c, {})).rejects.toThrow(/Gemini rate limit reached/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(c.sleep).toHaveBeenCalledTimes(2);
  });

  it("does not wait on a long (daily-quota) retry delay", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: "Please retry in 3600s" } }, 429));
    const c = cfg();
    await expect(geminiRequest(c, {})).rejects.toThrow(/rate limit/);
    expect(c.sleep).not.toHaveBeenCalled();
  });

  it("parses retry delays like v1", () => {
    expect(retryDelayMs({ error: { details: [{ retryDelay: "9.2s" }] } })).toBe(9200);
    expect(retryDelayMs({ error: { message: "Please retry in 4s." } })).toBe(4000);
    expect(retryDelayMs(null)).toBeNull();
  });
});

describe("verbatim port", () => {
  it("every prompt/schema block in prompts.ts appears unchanged in the v1 function", () => {
    const v1 = readFileSync(new URL("../../supabase/functions/forge-ai/index.ts", import.meta.url), "utf8");
    const ported = readFileSync(new URL("../../worker/lib/services/ai/prompts.ts", import.meta.url), "utf8");
    const blocks = ported.split(/\n(?=export |\/\/ ----------)/).slice(1).map((b) => b.replace(/^export /, "").trimEnd());
    expect(blocks.length).toBeGreaterThanOrEqual(27);
    for (const block of blocks) expect(v1.includes(block), block.slice(0, 60)).toBe(true);
  });
});
