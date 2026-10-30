import { supabase } from "../../supabaseClient.js";

// Most recent screening of any version. PAR-Q used to gate the Training
// tab (ScreeningGate.jsx, removed - DECISIONS.md "PAR-Q moved to
// Profile") and re-checked version currency on every visit; it's now a
// one-time, non-blocking thing a client signs from Profile, so this is
// just "do they have one on file" - no version-matching, no offline
// caching needed (HealthScreeningSection.jsx stays silent on a fetch
// error instead).
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

export async function insertScreening(record) {
  const { data, error } = await supabase.from("health_screenings").insert(record).select("*").single();
  if (error) throw error;
  return data;
}
