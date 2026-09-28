// Gemini REST client for /api/ai. Ported from v1 forge-ai (geminiRequest,
// callGemini, callGeminiWithFile, callGeminiChat). Changes from v1:
//  - the API key and model come from a config object (Worker env) instead
//    of Deno.env;
//  - the retry loop has an overall deadline (RETRY_DEADLINE_MS) and each
//    attempt a timeout, so a burst of 429s/503s can't hold a request open
//    indefinitely;
//  - callGeminiWithFile serialises its payload by string concatenation so
//    a multi-MB base64 PDF isn't re-stringified (CPU budget on Workers Free).
// Gemini time is I/O wait, not CPU, so long generations are fine on Free.

export interface GeminiConfig {
  apiKey?: string;
  model: string;
  /** Test hook: replaces setTimeout-based waiting. */
  sleep?: (ms: number) => Promise<void>;
}

export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

// Free-tier limits are per-minute as well as per-day, so a couple of
// features firing at once (or a coach clicking twice) can trip a 429 that
// would have succeeded moments later. Google tells us how long to wait -
// honour it once or twice rather than surfacing a failure the user has to
// manually retry. Capped so nobody sits waiting on a dead request: a
// daily-quota 429 asks for far longer than we're willing to hold, and
// falls through to the error message instead.
const MAX_RETRIES = 2;
const MAX_RETRY_WAIT_MS = 12000;
// v2 addition: never start a retry wait that would push the whole request
// past this, and never let one Gemini call hang longer than ATTEMPT_TIMEOUT_MS.
const RETRY_DEADLINE_MS = 25000;
const ATTEMPT_TIMEOUT_MS = 90000;

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function retryDelayMs(errorBody: any): number | null {
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

// `payload` is either an object (serialised here) or an already-serialised
// JSON string (the large-file path).
export async function geminiRequest(cfg: GeminiConfig, payload: any): Promise<any> {
  const apiKey = cfg.apiKey;
  if (!apiKey) throw new Error("AI features aren't set up yet - missing GEMINI_API_KEY secret.");
  const GEMINI_MODEL = cfg.model || DEFAULT_GEMINI_MODEL;
  const sleep = cfg.sleep || defaultSleep;
  const requestBody = typeof payload === "string" ? payload : JSON.stringify(payload);
  const started = Date.now();
  const canWait = (ms: number) => Date.now() - started + ms <= RETRY_DEADLINE_MS;

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody,
          signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
        }
      );
    } catch (e: any) {
      if (e?.name === "TimeoutError") throw new Error("The AI took too long to respond - please try again.");
      throw new Error("Couldn't reach the AI service - please try again.");
    }
    const data: any = await res.json().catch(() => null);

    if (attempt < MAX_RETRIES) {
      // 429 = per-minute quota; Google tells us exactly how long to wait.
      if (res.status === 429) {
        const wait = retryDelayMs(data) ?? 3000;
        if (wait <= MAX_RETRY_WAIT_MS && canWait(wait)) {
          await sleep(wait);
          continue;
        }
      }
      // 500/503 = Gemini having a moment ("The service is currently
      // unavailable"), seen intermittently in testing. Nothing is wrong
      // with the request, so a short backoff usually clears it.
      if (res.status === 500 || res.status === 503) {
        const wait = 1500 * (attempt + 1);
        if (canWait(wait)) {
          await sleep(wait);
          continue;
        }
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

export async function callGemini(cfg: GeminiConfig, prompt: string, responseSchema: any): Promise<any> {
  return await geminiRequest(cfg, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0.6 },
  });
}

// ---------- document call (body_analysis_extract - reads an uploaded file) ----------

export async function callGeminiWithFile(cfg: GeminiConfig, prompt: string, fileBase64: string, mimeType: string, responseSchema: any): Promise<any> {
  // Same payload as v1:
  //   { contents: [{ parts: [{ inline_data: { mime_type, data } }, { text }] }],
  //     generationConfig: { responseMimeType, responseSchema, temperature: 0.1 } }
  // built by concatenation so the base64 string is copied, not re-escaped.
  // Base64 never contains `"` or `\`; anything that does isn't a file.
  if (fileBase64.includes('"') || fileBase64.includes("\\")) throw new Error("That file couldn't be read.");
  // Low temperature: this is transcription of what's printed on a
  // document, not a creative task.
  const generationConfig = { responseMimeType: "application/json", responseSchema, temperature: 0.1 };
  const payload =
    `{"contents":[{"parts":[{"inline_data":{"mime_type":${JSON.stringify(mimeType)},"data":"` +
    fileBase64 +
    `"}},{"text":${JSON.stringify(prompt)}}]}],"generationConfig":${JSON.stringify(generationConfig)}}`;
  return await geminiRequest(cfg, payload);
}

// ---------- multi-turn chat call (client_chat only - the other actions are single-turn) ----------

export async function callGeminiChat(cfg: GeminiConfig, systemPrompt: string, contents: any[], responseSchema: any): Promise<any> {
  return await geminiRequest(cfg, {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0.7 },
  });
}
