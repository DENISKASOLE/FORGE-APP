import { useEffect, useState } from "react";
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

// Debounced FatSecret search, used by the nutrition-v2 food-add flows
// (DECISIONS.md) underneath the coach's own, usually much shorter, local
// food library - that library was never meant to cover every food a
// client might log, which is why "no foods match" used to be a dead end
// (nothing ever called this function from the live UI before). Same file
// as the plain searchFoods/getFoodServings it wraps, not the component
// file that renders results - same "a hook belongs with the functions it
// wraps, not with the components that call it" convention as
// lib/storage.js's usePhotoUrl.
export function useFatSecretResults(query) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const q = (query || "").trim();
  useEffect(() => {
    if (!q) return; // masked by the hook's own return below, not reset here
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      searchFoods(q)
        .then((foods) => { if (!cancelled) { setResults(foods); setLoading(false); } })
        .catch(() => { if (!cancelled) { setResults([]); setLoading(false); } });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);
  return q ? { results, loading } : { results: [], loading: false };
}
