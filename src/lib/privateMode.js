// Private "Online" mode for the coach app (Nov 26 2026). Online clients are
// hidden everywhere in the coach app until Denis taps the "Clients" title 5
// times quickly. It lives only in memory, so it's locked again whenever the
// app is closed or reloaded, after 10 minutes in the background, or with the
// lock button. No PIN (Denis's choice) - it's meant to keep coworkers who
// pick up the phone from seeing the online business, not to be strong security.
import { useSyncExternalStore } from "react";

const BACKGROUND_LOCK_MS = 10 * 60 * 1000;
let unlocked = false;
let hiddenAt = 0;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export function setPrivateUnlocked(on) { unlocked = !!on; emit(); }
export function isPrivateUnlocked() { return unlocked; }

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") hiddenAt = Date.now();
    else if (unlocked && hiddenAt && Date.now() - hiddenAt > BACKGROUND_LOCK_MS) setPrivateUnlocked(false);
  });
}

export function usePrivateUnlocked() {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => unlocked, () => false);
}

export const isOnlineClient = (c) => (c?.clientType || "1:1") === "Online";
export const visibleClients = (clients, on) => (on ? clients : (clients || []).filter((c) => !isOnlineClient(c)));

// Five taps within 2.5 s toggles it.
export function makeSecretTap(onTrigger, needed = 5, windowMs = 2500) {
  let taps = [];
  return () => {
    const now = Date.now();
    taps = [...taps.filter((t) => now - t < windowMs), now];
    if (taps.length >= needed) { taps = []; onTrigger(); }
  };
}
