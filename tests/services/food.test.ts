import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeEnv, jsonRequest, jsonResponse, limiter, mount, sessionStub } from "./helpers";

vi.mock("../../worker/lib/session", () => sessionStub);

const { default: foodRoute } = await import("../../worker/routes/food");
const fs = await import("../../worker/lib/services/fatsecret");

const app = mount("/api/food", foodRoute);
const post = (body: unknown, user: string | null = "user-1", env = fakeEnv()) =>
  app.request("/api/food", jsonRequest(body, user ?? undefined), env);

// Routes FatSecret calls by `method=` so each test declares only the API replies it needs.
function fatSecret(replies: Record<string, unknown>) {
  return vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    if (url.hostname === "oauth.fatsecret.com") return jsonResponse({ access_token: "tok", expires_in: 86400 });
    const method = url.searchParams.get("method") || "";
    return jsonResponse(replies[method] ?? {});
  });
}

let fetchMock: ReturnType<typeof fatSecret>;
beforeEach(() => fs.resetFatSecretTokenCache());
afterEach(() => vi.unstubAllGlobals());
const useFetch = (replies: Record<string, unknown>) => {
  fetchMock = fatSecret(replies);
  vi.stubGlobal("fetch", fetchMock);
};

describe("fatsecret parsers", () => {
  it("parses search descriptions into macros", () => {
    const foods = fs.parseSearchFoods({
      foods: { food: { food_id: "1", food_name: "Oats", food_description: "Per 100g - Calories: 389kcal | Fat: 6.90g | Carbs: 66.27g | Protein: 16.89g" } },
    });
    expect(foods).toEqual([{ id: "1", name: "Oats", brand: "", serving: "100g", kcal: 389, fats: 7, carbs: 66, protein: 17 }]);
  });

  it("handles a missing or empty food list", () => {
    expect(fs.parseSearchFoods({})).toEqual([]);
    expect(fs.parseSearchFoods({ foods: { food: [null] } })).toEqual([]);
  });

  it("normalises single and multiple servings", () => {
    const one = fs.parseServings({ servings: { serving: { serving_description: "1 cup", calories: "150.4", protein: "5", carbohydrate: "27", fat: "2.5", metric_serving_amount: "40", metric_serving_unit: "g" } } });
    expect(one).toEqual([{ desc: "1 cup", kcal: 150, protein: 5, carbs: 27, fats: 3, amount: "40", unit: "g" }]);
    expect(fs.parseServings({ servings: { serving: [{}, {}] } })).toHaveLength(2);
    expect(fs.parseServings(undefined)).toEqual([]);
  });

  it("parses recipes and coerces bad numbers to 0", () => {
    const [r] = fs.parseRecipes({ recipes: { recipe: { recipe_id: "9", recipe_name: "Bowl", recipe_nutrition: { calories: "abc", protein: "30.6" } } } });
    expect(r).toMatchObject({ id: "9", name: "Bowl", description: "", image: "", kcal: 0, protein: 31, carbs: 0, fats: 0 });
  });

  it("pads barcodes to GTIN-13", () => {
    expect(fs.normaliseBarcode("0-12345 67890")).toBe("0001234567890");
    expect(fs.normaliseBarcode("abc")).toBe("");
  });
});

describe("/api/food route", () => {
  it("requires a session", async () => {
    expect((await post({ action: "search", q: "oats" }, null)).status).toBe(401);
  });

  it("applies API_LIMITER per user", async () => {
    const env = fakeEnv({ API_LIMITER: limiter(false) });
    const res = await post({ action: "search", q: "oats" }, "user-9", env);
    expect(res.status).toBe(429);
    expect(env.API_LIMITER.limit).toHaveBeenCalledWith({ key: "user-9" });
  });

  it("searches and caches the OAuth token across requests", async () => {
    useFetch({ "foods.search": { foods: { food: [{ food_id: "1", food_name: "Oats", food_description: "Per 1 cup - Calories: 300kcal" }] } } });
    const res = await post({ action: "search", q: "oats" });
    expect(await res.json()).toEqual({ data: { foods: [{ id: "1", name: "Oats", brand: "", serving: "1 cup", kcal: 300, fats: 0, carbs: 0, protein: 0 }] } });
    await post({ action: "search", q: "rice" });
    const tokenCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes("oauth.fatsecret.com"));
    expect(tokenCalls).toHaveLength(1);
  });

  it("returns empty results for a blank query without calling FatSecret", async () => {
    useFetch({});
    expect(await (await post({ action: "search", q: "  " })).json()).toEqual({ data: { foods: [] } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps v1's 400s for missing ids", async () => {
    useFetch({});
    for (const action of ["get", "recipe", "barcode"]) {
      const res = await post({ action });
      expect(res.status).toBe(400);
    }
    expect((await (await post({ action: "nope" })).json()).error.message).toBe("unknown action");
  });

  it("passes 'not enabled' errors back as data.error with 200, like v1", async () => {
    useFetch({ "food.find_id_for_barcode": { error: { message: "Unknown method" } } });
    const res = await post({ action: "barcode", barcode: "5012345678900" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { error: "Unknown method" } });
  });

  it("looks up a barcode then the food", async () => {
    useFetch({ "food.find_id_for_barcode": { food_id: { value: "42" } }, "food.get.v2": { food: { food_name: "Bar", servings: { serving: { serving_description: "1 bar", calories: "200" } } } } });
    const { data } = await (await post({ action: "barcode", barcode: "123" })).json();
    expect(data).toMatchObject({ id: "42", name: "Bar", brand: "", servings: [{ desc: "1 bar", kcal: 200 }] });
    const barcodeCall = fetchMock.mock.calls.find(([u]) => String(u).includes("find_id_for_barcode"));
    expect(new URL(String(barcodeCall![0])).searchParams.get("barcode")).toBe("0000000000123");
  });

  it("supports GET with query parameters", async () => {
    useFetch({ "foods.autocomplete.v2": { suggestions: { suggestion: "oat milk" } } });
    const res = await app.request("/api/food?action=autocomplete&q=oat", { headers: { "x-test-user": "u" } }, fakeEnv());
    expect(await res.json()).toEqual({ data: { suggestions: ["oat milk"] } });
  });

  it("reports missing credentials as a 500", async () => {
    useFetch({});
    const res = await post({ action: "get", food_id: "1" }, "u", fakeEnv({ FATSECRET_CLIENT_ID: undefined }));
    expect(res.status).toBe(500);
  });
});
