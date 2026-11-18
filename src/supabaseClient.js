import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// On a weak gym signal a request can hang for minutes instead of failing.
// Database and login calls give up after 15 s so the app falls back to
// what's on the device (and the save outbox retries later). Photo uploads
// and edge functions are left alone - they can legitimately take longer.
const TIMEOUT_MS = 15000;
function fetchWithTimeout(input, init = {}) {
  const url = typeof input === "string" ? input : input?.url || "";
  if (!/\/(rest|auth)\/v1\//.test(url)) return fetch(input, init);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  if (init.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { fetch: fetchWithTimeout } });
export default supabase;
