import { supabase } from "../supabaseClient.js";

async function callFatSecret(body) {
  const { data, error } = await supabase.functions.invoke("forge-fatsecret", { body });
  if (error) throw new Error(error.message || "FatSecret request failed");
  if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "FatSecret request failed");
  return data;
}

export async function searchFoods(q) {
  if (!q || !q.trim()) return [];
  const data = await callFatSecret({ action: "search", q: q.trim() });
  return data.foods || [];
}

export async function getFoodServings(foodId) {
  const data = await callFatSecret({ action: "get", food_id: foodId });
  return { id: data.id, name: data.name, brand: data.brand || "", servings: data.servings || [] };
}
