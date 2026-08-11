// Supabase Edge Function: forge-fatsecret  (extended)
// Server-side proxy for the FatSecret Platform API. Holds the OAuth secret so it
// never reaches the browser. Extends the original search/get with barcode,
// autocomplete, and recipes — each of which may require FatSecret account
// entitlements. If an action isn't enabled, FatSecret returns an error and this
// function passes back { error } so the app can hide that feature.
//
// Secrets: FATSECRET_CLIENT_ID, FATSECRET_CLIENT_SECRET

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

let cachedToken: { token: string; exp: number } | null = null;
async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 30000) return cachedToken.token;
  const id = Deno.env.get("FATSECRET_CLIENT_ID");
  const secret = Deno.env.get("FATSECRET_CLIENT_SECRET");
  if (!id || !secret) throw new Error("Missing FATSECRET_CLIENT_ID / FATSECRET_CLIENT_SECRET");
  const res = await fetch("https://oauth.fatsecret.com/connect/token", {
    method: "POST",
    headers: { "Authorization": "Basic " + btoa(`${id}:${secret}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=basic",
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("FatSecret token error: " + JSON.stringify(data));
  cachedToken = { token: data.access_token, exp: Date.now() + (data.expires_in || 86400) * 1000 };
  return cachedToken.token;
}
async function fsApi(params: Record<string, string>): Promise<any> {
  const token = await getToken();
  const url = new URL("https://platform.fatsecret.com/rest/server.api");
  Object.entries({ ...params, format: "json" }).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: { "Authorization": "Bearer " + token } });
  return res.json();
}
const num = (v: any) => { const n = parseFloat(v); return isNaN(n) ? 0 : Math.round(n); };
const parseServings = (food: any) => {
  const s = food?.servings?.serving;
  const arr = Array.isArray(s) ? s : s ? [s] : [];
  return arr.map((v: any) => ({ desc: v.serving_description, kcal: num(v.calories), protein: num(v.protein), carbs: num(v.carbohydrate), fats: num(v.fat), amount: v.metric_serving_amount || "", unit: v.metric_serving_unit || "" }));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (o: any, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { ...CORS, "Content-Type": "application/json" } });
  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const p = (k: string) => url.searchParams.get(k) || body[k] || "";
    const action = p("action") || "search";

    if (action === "search") {
      const q = p("q"); if (!q.trim()) return json({ foods: [] });
      const data = await fsApi({ method: "foods.search", search_expression: q, max_results: "20" });
      const raw = data?.foods?.food || []; const arr = Array.isArray(raw) ? raw : [raw];
      const foods = arr.filter(Boolean).map((f: any) => {
        const d: string = f.food_description || "";
        const pick = (re: RegExp) => { const m = d.match(re); return m ? num(m[1]) : 0; };
        return { id: f.food_id, name: f.food_name, brand: f.brand_name || "", serving: (d.split(" - ")[0] || "").replace(/^Per\s*/i, ""), kcal: pick(/Calories:\s*([\d.]+)/i), fats: pick(/Fat:\s*([\d.]+)/i), carbs: pick(/Carbs:\s*([\d.]+)/i), protein: pick(/Protein:\s*([\d.]+)/i) };
      });
      return json({ foods });
    }

    if (action === "get") {
      const foodId = p("food_id"); if (!foodId) return json({ error: "missing food_id" }, 400);
      const data = await fsApi({ method: "food.get.v2", food_id: foodId });
      const food = data?.food;
      return json({ id: foodId, name: food?.food_name, brand: food?.brand_name || "", servings: parseServings(food) });
    }

    if (action === "autocomplete") {
      const q = p("q"); if (!q.trim()) return json({ suggestions: [] });
      const data = await fsApi({ method: "foods.autocomplete.v2", expression: q, max_results: "8" });
      if (data?.error) return json({ error: data.error?.message || "not enabled", suggestions: [] });
      const sug = data?.suggestions?.suggestion;
      return json({ suggestions: Array.isArray(sug) ? sug : sug ? [sug] : [] });
    }

    if (action === "barcode") {
      let code = p("barcode").replace(/\D/g, ""); if (!code) return json({ error: "missing barcode" }, 400);
      code = code.padStart(13, "0"); // FatSecret expects GTIN-13
      const idRes = await fsApi({ method: "food.find_id_for_barcode", barcode: code });
      if (idRes?.error) return json({ error: idRes.error?.message || "barcode not enabled" });
      const foodId = idRes?.food_id?.value || idRes?.food_id;
      if (!foodId || foodId === "0") return json({ error: "barcode not found" });
      const data = await fsApi({ method: "food.get.v2", food_id: String(foodId) });
      const food = data?.food;
      return json({ id: String(foodId), name: food?.food_name, brand: food?.brand_name || "", servings: parseServings(food) });
    }

    if (action === "recipes") {
      const q = p("q");
      const data = await fsApi({ method: "recipes.search.v3", search_expression: q, max_results: "20" });
      if (data?.error) return json({ error: data.error?.message || "recipes not enabled", recipes: [] });
      const raw = data?.recipes?.recipe || []; const arr = Array.isArray(raw) ? raw : [raw];
      const recipes = arr.filter(Boolean).map((r: any) => ({ id: r.recipe_id, name: r.recipe_name, description: r.recipe_description || "", image: r.recipe_image || "", kcal: num(r.recipe_nutrition?.calories), protein: num(r.recipe_nutrition?.protein), carbs: num(r.recipe_nutrition?.carbohydrate), fats: num(r.recipe_nutrition?.fat) }));
      return json({ recipes });
    }

    if (action === "recipe") {
      const recipeId = p("recipe_id"); if (!recipeId) return json({ error: "missing recipe_id" }, 400);
      const data = await fsApi({ method: "recipe.get.v2", recipe_id: recipeId });
      if (data?.error) return json({ error: data.error?.message || "recipes not enabled" });
      return json({ recipe: data?.recipe || null });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});