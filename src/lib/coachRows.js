// Coach data sync that only downloads what changed (Nov 21 2026).
//
// Before: every app open, and every return to the app after a minute,
// downloaded every client_data row for every client (~20 MB), which used up
// the Supabase free plan's egress. Now the rows are kept on the device and
// a refresh only asks for rows whose updated_at moved since the last sync.
// A full download still happens on the first load on a device, for clients
// we haven't seen before, once a day as a safety net, and whenever the
// database can't answer the "what changed" question.
import { supabase } from "../supabaseClient.js";
import { idbGet, idbSet } from "./idb.js";
import { uploadClientPhoto } from "./storage.js";

const STORE_PREFIX = "coach_rows_v1_";
const FULL_EVERY_MS = 24 * 60 * 60 * 1000;
// Re-ask for a few minutes before the newest change we saw, so a save that
// committed slightly out of order is never missed.
const OVERLAP_MS = 5 * 60 * 1000;
const COLUMNS = "client_id,section,data,updated_at";

const rowKey = (r) => `${r.client_id}|${r.section}`;
// Sections never downloaded in bulk: progress photos load per client when
// opened; "details" is a legacy section nothing in the app reads (3.7 MB of
// old photos, Nov 2026).
const SKIP = "(transformPhotos,details)";

// Pure: merge fetched rows into the stored map, drop clients that are gone,
// and work out the new sync point from the server's own timestamps.
export function mergeRows(store, fetched, clientIds, { full = false, now = Date.now() } = {}) {
  const keep = new Set(clientIds);
  const rows = {};
  Object.entries(store?.rows || {}).forEach(([k, r]) => { if (keep.has(r.client_id)) rows[k] = r; });
  (fetched || []).forEach((r) => { rows[rowKey(r)] = r; });
  let newest = store?.syncedAt || null;
  (fetched || []).forEach((r) => { if (r.updated_at && (!newest || r.updated_at > newest)) newest = r.updated_at; });
  return {
    rows,
    syncedAt: newest,
    clientIds: [...keep],
    fullAt: full ? now : store?.fullAt || 0,
  };
}

// The `since` timestamp to ask for, or null when a full download is due.
export function sinceFor(store, clientIds, now = Date.now()) {
  if (!store?.syncedAt || !store.fullAt || now - store.fullAt > FULL_EVERY_MS) return null;
  const known = new Set(store.clientIds || []);
  if (clientIds.some((id) => !known.has(id))) return null; // a new client: fetch everything once
  return new Date(new Date(store.syncedAt).getTime() - OVERLAP_MS).toISOString();
}

export async function loadCoachRows(userId, clientIds) {
  if (!clientIds.length) return [];
  const key = STORE_PREFIX + userId;
  const store = await idbGet(key).catch(() => null);
  const since = sinceFor(store, clientIds);
  let fetched = null;
  let full = !since;
  if (since) {
    const res = await supabase.from("client_data").select(COLUMNS).in("client_id", clientIds).not("section", "in", SKIP).gt("updated_at", since);
    if (res.error) {
      // No updated_at column (or any other surprise): fall back to the old full download.
      if (!res.error.code || res.error.code === "PGRST301") throw res.error; // offline / auth: let the caller retry later
      full = true;
    } else {
      fetched = res.data || [];
    }
  }
  if (full) {
    let res = await supabase.from("client_data").select(COLUMNS).in("client_id", clientIds).not("section", "in", SKIP);
    if (res.error && res.error.code === "42703") {
      // The table has no updated_at: old behaviour, nothing stored.
      res = await supabase.from("client_data").select("*").in("client_id", clientIds).not("section", "in", SKIP);
      if (res.error) throw res.error;
      return res.data || [];
    }
    if (res.error) throw res.error;
    fetched = res.data || [];
  }
  const next = mergeRows(full ? null : store, fetched, clientIds, { full });
  await idbSet(key, next).catch(() => {});
  return Object.values(next.rows);
}

// One-time clean-up (Nov 21 2026): older versions saved client profile
// photos as text inside the profile row (~240 KB each, 7.7 MB in total),
// so every sync downloaded them. Move each one to file storage, like new
// photos, and keep only the short storage path in the row. Runs quietly in
// the background; anything that fails is simply tried again next time.
export function legacyPhotoRows(rows) {
  return (rows || []).filter((r) => r.section === "profile" && typeof r.data?.photo === "string" && r.data.photo.startsWith("data:image"));
}
export async function moveLegacyProfilePhotos(rows) {
  for (const row of legacyPhotoRows(rows)) {
    try {
      const blob = await (await fetch(row.data.photo)).blob();
      const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const path = await uploadClientPhoto(row.client_id, "profile", blob, ext);
      const { error } = await supabase.from("client_data").upsert({ client_id: row.client_id, section: "profile", data: { ...row.data, photo: path } }, { onConflict: "client_id,section" });
      if (error) throw error;
    } catch (error) {
      console.warn("Forge: couldn't move an old profile photo yet", error?.message || error);
    }
  }
}
