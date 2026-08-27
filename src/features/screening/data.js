import { supabase } from "../../supabaseClient.js";
import { SCREENING_VERSION } from "./screeningText.js";

// Most recent screening of any version, so the gate can tell "never
// screened" apart from "screened an older version" if that distinction is
// ever needed.
export async function fetchLatestScreening(clientId) {
  const { data, error } = await supabase
    .from("health_screenings")
    .select("*")
    .eq("client_id", clientId)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export function isCurrentScreening(screening) {
  return !!screening && screening.screening_version === SCREENING_VERSION;
}

export async function insertScreening(record) {
  const { data, error } = await supabase.from("health_screenings").insert(record).select("*").single();
  if (error) throw error;
  return data;
}
