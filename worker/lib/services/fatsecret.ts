// FatSecret Platform API proxy for /api/food. Ported from the v1
// `forge-fatsecret` Edge Function: same 6 actions, same parsing, same
// response objects. Some actions (barcode, autocomplete, recipes) need
// FatSecret account entitlements; when one isn't enabled FatSecret returns
// an error and we pass back `{ error }` with a 200 (as v1 did) so the app
// can hide that feature. v1's 400s become HttpError(400).
import { HttpError } from "../http";

export interface FatSecretCreds {
  clientId?: string;
  clientSecret?: string;
}

// Module scope, as in v1: survives for the life of the isolate.
let cachedToken: { token: string; exp: number } | null = null;

export function resetFatSecretTokenCache() {
  cachedToken = null;
}

async function getToken(creds: FatSecretCreds): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 30000) return cachedToken.token;
  const id = creds.clientId;
  const secret = creds.clientSecret;
  if (!id || !secret) throw new Error("Missing FATSECRET_CLIENT_ID / FATSECRET_CLIENT_SECRET");
  const res = await fetch("https://oauth.fatsecret.com/connect/token", {
    method: "POST",
    headers: { "Authorization": "Basic " + btoa(`${id}:${secret}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=basic",
  });
  const data: any = await res.json().catch(() => ({}));
  // v1 put the whole token response in this message; keep it server-side.
  if (!data.access_token) {
    console.error("FatSecret token error", res.status, data?.error);
    throw new Error("FatSecret token error");
  }
  cachedToken = { token: data.access_token, exp: Date.now() + (data.expires_in || 86400) * 1000 };
  return cachedToken.token;
}

async function fsApi(creds: FatSecretCreds, params: Record<string, string>): Promise<any> {
  const token = await getToken(creds);
  const url = new URL("https://platform.fatsecret.com/rest/server.api");
  Object.entries({ ...params, format: "json" }).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: { "Authorization": "Bearer " + token } });
  return res.json();
}

export const num = (v: any) => { const n = parseFloat(v); return isNaN(n) ? 0 : Math.round(n); };

export const parseServings = (food: any) => {
  const s = food?.servings?.serving;
  const arr = Array.isArray(s) ? s : s ? [s] : [];
  return arr.map((v: any) => ({ desc: v.serving_description, kcal: num(v.calories), protein: num(v.protein), carbs: num(v.carbohydrate), fats: num(v.fat), amount: v.metric_serving_amount || "", unit: v.metric_serving_unit || "" }));
};

export const parseSearchFoods = (data: any) => {
  const raw = data?.foods?.food || []; const arr = Array.isArray(raw) ? raw : [raw];
  return arr.filter(Boolean).map((f: any) => {
    const d: string = f.food_description || "";
    const pick = (re: RegExp) => { const m = d.match(re); return m ? num(m[1]) : 0; };
    return { id: f.food_id, name: f.food_name, brand: f.brand_name || "", serving: (d.split(" - ")[0] || "").replace(/^Per\s*/i, ""), kcal: pick(/Calories:\s*([\d.]+)/i), fats: pick(/Fat:\s*([\d.]+)/i), carbs: pick(/Carbs:\s*([\d.]+)/i), protein: pick(/Protein:\s*([\d.]+)/i) };
  });
};

export const parseRecipes = (data: any) => {
  const raw = data?.recipes?.recipe || []; const arr = Array.isArray(raw) ? raw : [raw];
  return arr.filter(Boolean).map((r: any) => ({ id: r.recipe_id, name: r.recipe_name, description: r.recipe_description || "", image: r.recipe_image || "", kcal: num(r.recipe_nutrition?.calories), protein: num(r.recipe_nutrition?.protein), carbs: num(r.recipe_nutrition?.carbohydrate), fats: num(r.recipe_nutrition?.fat) }));
};

export const toList = (v: any) => (Array.isArray(v) ? v : v ? [v] : []);

// GTIN-13, as FatSecret expects. Returns "" when there are no digits.
export const normaliseBarcode = (raw: string) => {
  const code = String(raw || "").replace(/\D/g, "");
  return code ? code.padStart(13, "0") : "";
};

export const FOOD_ACTIONS = ["search", "get", "autocomplete", "barcode", "recipes", "recipe"] as const;

const MAX_QUERY_LEN = 200;

// `p(k)` reads a parameter from the query string or JSON body, as v1 did.
export async function handleFoodAction(creds: FatSecretCreds, p: (k: string) => string): Promise<unknown> {
  const action = p("action") || "search";
  const q = () => p("q").slice(0, MAX_QUERY_LEN);

  if (action === "search") {
    const query = q(); if (!query.trim()) return { foods: [] };
    const data = await fsApi(creds, { method: "foods.search", search_expression: query, max_results: "20" });
    return { foods: parseSearchFoods(data) };
  }

  if (action === "get") {
    const foodId = p("food_id"); if (!foodId) throw new HttpError(400, "missing food_id", "bad_request");
    const data = await fsApi(creds, { method: "food.get.v2", food_id: foodId });
    const food = data?.food;
    return { id: foodId, name: food?.food_name, brand: food?.brand_name || "", servings: parseServings(food) };
  }

  if (action === "autocomplete") {
    const query = q(); if (!query.trim()) return { suggestions: [] };
    const data = await fsApi(creds, { method: "foods.autocomplete.v2", expression: query, max_results: "8" });
    if (data?.error) return { error: data.error?.message || "not enabled", suggestions: [] };
    return { suggestions: toList(data?.suggestions?.suggestion) };
  }

  if (action === "barcode") {
    const code = normaliseBarcode(p("barcode")); if (!code) throw new HttpError(400, "missing barcode", "bad_request");
    const idRes = await fsApi(creds, { method: "food.find_id_for_barcode", barcode: code });
    if (idRes?.error) return { error: idRes.error?.message || "barcode not enabled" };
    const foodId = idRes?.food_id?.value || idRes?.food_id;
    if (!foodId || foodId === "0") return { error: "barcode not found" };
    const data = await fsApi(creds, { method: "food.get.v2", food_id: String(foodId) });
    const food = data?.food;
    return { id: String(foodId), name: food?.food_name, brand: food?.brand_name || "", servings: parseServings(food) };
  }

  if (action === "recipes") {
    const data = await fsApi(creds, { method: "recipes.search.v3", search_expression: q(), max_results: "20" });
    if (data?.error) return { error: data.error?.message || "recipes not enabled", recipes: [] };
    return { recipes: parseRecipes(data) };
  }

  if (action === "recipe") {
    const recipeId = p("recipe_id"); if (!recipeId) throw new HttpError(400, "missing recipe_id", "bad_request");
    const data = await fsApi(creds, { method: "recipe.get.v2", recipe_id: recipeId });
    if (data?.error) return { error: data.error?.message || "recipes not enabled" };
    return { recipe: data?.recipe || null };
  }

  throw new HttpError(400, "unknown action", "unknown_action");
}
