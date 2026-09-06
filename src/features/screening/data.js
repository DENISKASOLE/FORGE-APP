import { supabase } from "../../supabaseClient.js";
import { readJson, writeJson } from "../../lib/cache.js";
import { SCREENING_VERSION } from "./screeningText.js";

const SCREENING_CACHE_PREFIX = "forge_screening_ok_";

// Last known screening result, so a client who has already passed this
// once isn't re-blocked by a network error (including simply being
// offline) every time they open their program - see ScreeningGate for how
// this is used to fail open on a *repeat* check but still fail closed on
// a client's very first one.
export function readCachedScreeningOk(clientId) {
  return readJson(`${SCREENING_CACHE_PREFIX}${clientId}`, false);
}
export function cacheScreeningOk(clientId, isCurrent) {
  writeJson(`${SCREENING_CACHE_PREFIX}${clientId}`, !!isCurrent);
}

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
