import { supabase } from "../supabaseClient.js";
import { idbGet, idbSet } from "./idb.js";
import { queueWrite, saveAndWait, flush, setSender, migrateLegacyQueue, pendingCount, LEGACY_QUEUE_KEY } from "./sync.js";

// Kept for older imports; the queue itself now lives in sync.js.
export const FORGE_SYNC_QUEUE_KEY = LEGACY_QUEUE_KEY;
const FORGE_CACHE_PREFIX = "forge_v47_cache_";
const SNAPSHOT_PREFIX = "snapshot_";

// How each queued item reaches Supabase. Returns { error, status } and
// never throws (sync.js classifies the error as retryable or not).
setSender(async (item) => {
  if (item.type === "client_data") {
    return supabase.from("client_data").upsert({ client_id: item.clientId, section: item.section, data: item.data }, { onConflict: "client_id,section" });
  }
  if (item.type === "trainer_data") {
    return supabase.from("trainer_data").upsert({ trainer_id: item.trainerId, section: item.section, data: item.data }, { onConflict: "trainer_id,section" });
  }
  if (item.type === "clients_update") {
    return supabase.from("clients").update(item.patch).eq("id", item.clientId);
  }
  return { error: null };
});
migrateLegacyQueue();

export function cacheKey(userId) {
  return `${FORGE_CACHE_PREFIX}${userId || "guest"}`;
}
export function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}
export function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {}
}
function stripPhotosForCache(clients) {
  return (clients || []).map((c) => (c.transformPhotos?.length ? { ...c, transformPhotos: [] } : c));
}

// ---------- the on-device snapshot the app opens from ----------
// Saved to IndexedDB (no 5 MB cap), debounced so logging a set doesn't
// rewrite everything on every tap; flushed immediately when the app is
// hidden so a closed app never loses its last state.
const pendingSnapshots = new Map();
let snapTimer = null;
function writeSnapshots() {
  clearTimeout(snapTimer);
  snapTimer = null;
  const entries = [...pendingSnapshots.entries()];
  pendingSnapshots.clear();
  entries.forEach(([userId, snap]) => {
    idbSet(SNAPSHOT_PREFIX + userId, snap).then((ok) => {
      if (ok) { try { localStorage.removeItem(cacheKey(userId)); } catch { /* ignore */ } }
      else writeJson(cacheKey(userId), snap); // no IndexedDB (private mode)
    });
  });
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && pendingSnapshots.size) writeSnapshots(); });
}
export function saveForgeCache(userId, snapshot) {
  if (!userId) return;
  const lightweight = {
    ...snapshot,
    clients: stripPhotosForCache(snapshot.clients),
    clientPortal: snapshot.clientPortal?.transformPhotos?.length ? { ...snapshot.clientPortal, transformPhotos: [] } : snapshot.clientPortal,
    savedAt: new Date().toISOString(),
  };
  pendingSnapshots.set(userId, lightweight);
  if (!snapTimer) snapTimer = setTimeout(writeSnapshots, 400);
}
export async function readForgeCache(userId) {
  if (!userId) return null;
  if (pendingSnapshots.has(userId)) return pendingSnapshots.get(userId);
  const fromIdb = await idbGet(SNAPSHOT_PREFIX + userId);
  return fromIdb || readJson(cacheKey(userId), null);
}

// ---------- saving ----------
export function enqueueSync(item) { queueWrite(item); }
export async function flushSyncQueue() { await flush(); }
export function pendingSyncCount() { return pendingCount(); }
export function updateClientRow(clientId, patch) {
  return saveAndWait({ type: "clients_update", clientId, patch });
}
