import { supabase } from "../supabaseClient.js";
import { uid } from "./uid.js";

const FORGE_CACHE_PREFIX = "forge_v47_cache_";
export const FORGE_SYNC_QUEUE_KEY = "forge_v47_pending_sync";

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
export function saveForgeCache(userId, snapshot) {
  if (!userId) return;
  const lightweight = {
    ...snapshot,
    clients: stripPhotosForCache(snapshot.clients),
    clientPortal: snapshot.clientPortal?.transformPhotos?.length ? { ...snapshot.clientPortal, transformPhotos: [] } : snapshot.clientPortal,
  };
  writeJson(cacheKey(userId), { ...lightweight, savedAt: new Date().toISOString() });
}
export function readForgeCache(userId) {
  if (!userId) return null;
  return readJson(cacheKey(userId), null);
}
export function enqueueSync(item) {
  const queue = readJson(FORGE_SYNC_QUEUE_KEY, []);
  queue.push({ id: uid(), createdAt: new Date().toISOString(), ...item });
  writeJson(FORGE_SYNC_QUEUE_KEY, queue);
}
export async function flushSyncQueue() {
  const queue = readJson(FORGE_SYNC_QUEUE_KEY, []);
  if (!queue.length) return;
  const remaining = [];
  for (const item of queue) {
    try {
      if (item.type === "client_data") {
        const { error } = await supabase.from("client_data").upsert(
          { client_id: item.clientId, section: item.section, data: item.data },
          { onConflict: "client_id,section" }
        );
        if (error) throw error;
      }
      if (item.type === "trainer_data") {
        const { error } = await supabase.from("trainer_data").upsert(
          { trainer_id: item.trainerId, section: item.section, data: item.data },
          { onConflict: "trainer_id,section" }
        );
        if (error) throw error;
      }
      if (item.type === "clients_update") {
        const { error } = await supabase.from("clients").update(item.patch).eq("id", item.clientId);
        if (error) throw error;
      }
    } catch (e) {
      remaining.push(item);
    }
  }
  writeJson(FORGE_SYNC_QUEUE_KEY, remaining);
}
export async function updateClientRow(clientId, patch) {
  try {
    const { error } = await supabase.from("clients").update(patch).eq("id", clientId);
    if (error) throw error;
    await flushSyncQueue();
    return { queued: false };
  } catch (error) {
    enqueueSync({ type: "clients_update", clientId, patch });
    return { queued: true, error };
  }
}
