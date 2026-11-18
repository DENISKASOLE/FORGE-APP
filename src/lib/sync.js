// Forge offline sync engine (Nov 2026).
//
// Every save goes into a durable on-device "outbox" FIRST (synchronously,
// in localStorage), then a background flush pushes it to Supabase. So:
//  - nothing is lost if the phone is offline, the signal is bad, or the app
//    is closed mid-save - the outbox survives restarts;
//  - the outbox is keyed per record (client + section), and only the latest
//    version of each record is kept and sent. An older version can never be
//    replayed over a newer one (the old queue appended every save and
//    re-sent all of them in order, which could undo the last sets of a
//    workout logged offline);
//  - an item is removed only once the exact version that was sent is
//    confirmed by the server; a newer save made during the upload stays
//    queued and goes next;
//  - network problems (offline, timeouts, expired login) are retried in the
//    background with backoff; a real rejection from the server is kept (never
//    dropped) and reported once to the caller.
import { useSyncExternalStore } from "react";
import { uid } from "./uid.js";

export const OUTBOX_KEY = "forge_outbox_v2";
export const LEGACY_QUEUE_KEY = "forge_v47_pending_sync";

// ---------- storage ----------
function load() {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" && parsed.items ? parsed : { items: {}, seq: 0 };
  } catch {
    return { items: {}, seq: 0 };
  }
}
let box = typeof localStorage === "undefined" ? { items: {}, seq: 0 } : load();
function persist() {
  const json = JSON.stringify(box);
  try {
    localStorage.setItem(OUTBOX_KEY, json);
  } catch {
    // Out of space: the old full-data snapshot lived in localStorage too.
    // It now lives in IndexedDB, so clear any leftovers and try again.
    try {
      Object.keys(localStorage).filter((k) => k.startsWith("forge_v47_cache_")).forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(OUTBOX_KEY, json);
    } catch { /* kept in memory for this session */ }
  }
}

// ---------- status (for the sync pill / coach settings) ----------
const listeners = new Set();
let networkDown = typeof navigator !== "undefined" && navigator.onLine === false;
let syncing = false;
let status = computeStatus();
function computeStatus() {
  const items = Object.values(box.items);
  return {
    pending: items.length,
    failed: items.filter((i) => i.failed).length,
    syncing,
    offline: networkDown,
  };
}
function notify() {
  status = computeStatus();
  listeners.forEach((fn) => { try { fn(status); } catch { /* ignore */ } });
}
export function getSyncStatus() { return status; }
export function subscribeSync(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function useSyncStatus() { return useSyncExternalStore(subscribeSync, getSyncStatus, getSyncStatus); }

// ---------- keys ----------
export function itemKey(item) {
  if (item.type === "client_data") return `cd:${item.clientId}:${item.section}`;
  if (item.type === "trainer_data") return `td:${item.trainerId}:${item.section}`;
  if (item.type === "clients_update") return `cu:${item.clientId}`;
  return `x:${item.type}:${uid()}`;
}

// ---------- waiters: a caller can await "did my save reach the server" ----------
const waiters = new Map(); // version -> [resolve]
function resolveWaiters(v, result) {
  const list = waiters.get(v);
  if (!list) return;
  waiters.delete(v);
  list.forEach((r) => r(result));
}

// ---------- queue ----------
export function queueWrite(item, { kick = true } = {}) {
  const key = itemKey(item);
  const prev = box.items[key];
  const v = uid();
  box.seq = (box.seq || 0) + 1;
  const next = { ...item, key, v, seq: box.seq, at: new Date().toISOString() };
  // Patches to the same clients row merge, so two quick edits both land.
  if (item.type === "clients_update" && prev?.patch) next.patch = { ...prev.patch, ...item.patch };
  box.items[key] = next;
  persist();
  // Anyone waiting on the superseded version now waits on this one.
  if (prev && waiters.has(prev.v)) {
    const list = waiters.get(prev.v);
    waiters.delete(prev.v);
    waiters.set(v, [...(waiters.get(v) || []), ...list]);
  }
  notify();
  if (kick) flush();
  return { key, v };
}

// Save and wait briefly for the server. The data is already safe on the
// device either way; this only decides what the caller is told:
//  { queued: false }            reached the server
//  { queued: true, error: null } offline / slow - will sync in background
//  { queued: true, error }       the server rejected it (kept, retried later)
export function saveAndWait(item, waitMs = 4000) {
  const { v } = queueWrite(item, { kick: false });
  const p = new Promise((resolve) => {
    waiters.set(v, [...(waiters.get(v) || []), resolve]);
    setTimeout(() => resolveWaiters(v, { queued: true, error: null }), waitMs);
  });
  flush();
  return p;
}

// ---------- sending ----------
let sender = null;
export function setSender(fn) { sender = fn; }

export function isRetryable(error, httpStatus) {
  if (!error) return false;
  const s = Number(httpStatus ?? error.status ?? 0);
  if (s === 0 || s === 401 || s === 408 || s === 429 || s >= 500) return true;
  const msg = `${error.name || ""} ${error.message || ""} ${error.code || ""}`;
  return /AbortError|TypeError|fetch|network|load failed|timeout|timed out|JWT|PGRST301|offline/i.test(msg);
}

let flushing = null;
let again = false;
let retryTimer = null;
let backoff = 0;
function scheduleRetry() {
  clearTimeout(retryTimer);
  const delays = [3000, 8000, 20000, 45000, 90000];
  const d = delays[Math.min(backoff, delays.length - 1)];
  backoff += 1;
  retryTimer = setTimeout(() => flush(), d);
}

export function flush() {
  // Called again while a flush is running: run once more after it, so a
  // trigger (back online, app reopened) is never swallowed by a flush that
  // is about to stop on a network error.
  if (flushing) { again = true; return flushing.then(() => (Object.keys(box.items).length && !flushing ? flush() : undefined)); }
  if (!sender || !Object.keys(box.items).length) return Promise.resolve();
  syncing = true;
  notify();
  flushing = (async () => {
    do {
      again = false;
      const stop = await flushOnce();
      if (stop) break;
    } while (again && Object.keys(box.items).length);
  })().finally(() => {
    flushing = null;
    syncing = false;
    notify();
  });
  return flushing;
}

async function flushOnce() {
  const items = Object.values(box.items).sort((a, b) => a.seq - b.seq);
  for (const item of items) {
    const current = box.items[item.key];
    if (!current || current.v !== item.v) { again = true; continue; }
    let res;
    try {
      res = await sender(item);
    } catch (e) {
      res = { error: e, status: 0 };
    }
    const { error, status: httpStatus } = res || {};
    if (!error) {
      backoff = 0;
      if (networkDown) networkDown = false;
      if (box.items[item.key]?.v === item.v) delete box.items[item.key];
      else again = true; // a newer version arrived while this one was uploading
      persist();
      resolveWaiters(item.v, { queued: false });
      notify();
      continue;
    }
    if (isRetryable(error, httpStatus)) {
      networkDown = true;
      // Everyone waiting gets "saved on device, will sync".
      Object.values(box.items).forEach((i) => resolveWaiters(i.v, { queued: true, error: null }));
      notify();
      scheduleRetry();
      return true; // stop: the network is the problem, not this item
    }
    // A real rejection: keep the data, mark it, tell the caller once.
    if (box.items[item.key]?.v === item.v) {
      box.items[item.key] = { ...item, failed: String(error.message || error.code || "rejected"), failCount: (item.failCount || 0) + 1 };
      persist();
    }
    resolveWaiters(item.v, { queued: true, error });
    notify();
  }
  return false;
}

// ---------- reading what's still waiting (so fresh server data never
// overwrites local work that hasn't uploaded yet) ----------
export function pendingClientSections(clientId) {
  const out = {};
  Object.values(box.items).forEach((i) => { if (i.type === "client_data" && i.clientId === clientId) out[i.section] = i.data; });
  return out;
}
export function pendingClientPatch(clientId) {
  return box.items[`cu:${clientId}`]?.patch || null;
}
export function hasPending(clientId) {
  return Object.values(box.items).some((i) => i.clientId === clientId);
}
export function pendingCount() { return Object.keys(box.items).length; }

// Old queue format (an append-only array) -> outbox, oldest first so the
// newest save of each record wins.
export function migrateLegacyQueue() {
  try {
    const raw = localStorage.getItem(LEGACY_QUEUE_KEY);
    if (!raw) return;
    const list = JSON.parse(raw);
    if (Array.isArray(list)) list.forEach((item) => queueWrite(item, { kick: false }));
    localStorage.removeItem(LEGACY_QUEUE_KEY);
  } catch { /* ignore */ }
}

// Network change signals.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => { networkDown = false; backoff = 0; notify(); flush(); });
  window.addEventListener("offline", () => { networkDown = true; notify(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") flush(); });
}

// Test helper.
export function __resetForTests() {
  box = { items: {}, seq: 0 };
  waiters.clear();
  flushing = null; again = false; backoff = 0; networkDown = false; syncing = false;
  clearTimeout(retryTimer);
  notify();
}
