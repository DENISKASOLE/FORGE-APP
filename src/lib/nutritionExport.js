import JSZip from "jszip";
import { supabase } from "../supabaseClient.js";
import { isStoragePath } from "./storage.js";
import { downloadBlob, safeFilename } from "./pdf.js";

const PHOTO_BUCKET = "client-photos";

export function buildNutritionExportData(client, nutrition) {
  const dates = [...new Set([...Object.keys(nutrition.food_log || {}), ...Object.keys(nutrition.habits || {})])].sort();
  const days = [];
  const photoJobs = [];

  function pushMeal(meals, date, slot, entry, index) {
    if (!entry) return;
    let photoFilename = "";
    if (isStoragePath(entry.photo)) {
      const ext = entry.photo.split(".").pop() || "jpg";
      photoFilename = `${date}_${slot}${index != null ? `_${index + 1}` : ""}.${ext}`;
      photoJobs.push({ path: entry.photo, filename: photoFilename });
    }
    meals.push({
      slot,
      time: entry.time || "",
      photo: photoFilename,
      description: entry.description || "",
      method: entry.method || "none",
      packaged: !!entry.packaged,
      ingredients: entry.ingredients || [],
    });
  }

  dates.forEach((date) => {
    const dayLog = nutrition.food_log[date];
    const meals = [];
    if (dayLog) {
      pushMeal(meals, date, "breakfast", dayLog.breakfast);
      pushMeal(meals, date, "lunch", dayLog.lunch);
      pushMeal(meals, date, "dinner", dayLog.dinner);
      (dayLog.snacks || []).forEach((s, i) => pushMeal(meals, date, "snack", s, i));
    }
    const habitLog = nutrition.habits?.[date];
    const habits = habitLog && (habitLog.steps || habitLog.sleep || habitLog.water)
      ? { steps: habitLog.steps || "", sleep_hours: habitLog.sleep || "", water_liters: habitLog.water || "" }
      : null;
    if (meals.length || habits) days.push({ date, meals, habits });
  });

  const data = {
    client: client.name || "",
    phase: nutrition.phase,
    week_of: nutrition.week_of,
    goal: client.goal || "",
    bodyweight_kg: Number(client.weight) || 0,
    supplements: nutrition.supplement_stack || [],
    days,
  };
  return { data, photoJobs };
}

export async function downloadNutritionExport(client, nutrition) {
  const { data, photoJobs } = buildNutritionExportData(client, nutrition);
  const base = `${safeFilename(client.name)}_nutrition_${nutrition.phase}`;

  const zip = new JSZip();
  zip.file(`${base}.json`, JSON.stringify(data, null, 2));
  for (const job of photoJobs) {
    const { data: blob, error } = await supabase.storage.from(PHOTO_BUCKET).download(job.path);
    if (!error && blob) zip.file(job.filename, blob);
  }
  const zipBlob = await zip.generateAsync({ type: "blob" });
  downloadBlob(zipBlob, `${base}.zip`);
}
