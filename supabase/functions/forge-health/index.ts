// Supabase Edge Function: forge-health
// Connects a client's wearable (Fitbit / Oura) and pulls their daily steps
// and sleep into Forge, so the habit numbers the AI already reads stop
// depending on the client remembering to type them in.
//
// WHY SERVER-SIDE: OAuth client secrets and refresh tokens can never touch
// the browser. The PWA only ever asks this function for a connect URL or a
// status; tokens live in client_health_connections, which has RLS on and
// no policies, so only this function (service role) can read them.
//
// WHY NOT APPLE HEALTH / HEALTH CONNECT: both are on-device APIs with no
// server API - they need a native app wrapper, which this project has
// deliberately not taken on. Clients whose data only lives there keep
// entering steps/sleep by hand. Wearables with a cloud API don't need that.
//
// Secrets required (Supabase Dashboard -> Edge Functions -> Secrets):
//   FITBIT_CLIENT_ID / FITBIT_CLIENT_SECRET   - dev.fitbit.com
//   OURA_CLIENT_ID   / OURA_CLIENT_SECRET     - cloud.ouraring.com
//   (only the pair for a provider you actually want needs to exist)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// The OAuth redirect URI to register with BOTH providers is this function's
// own callback - stable, and it keeps the exchange server-side:
//   https://<project>.supabase.co/functions/v1/forge-health/callback

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const FUNCTION_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/forge-health`;
const REDIRECT_URI = `${FUNCTION_URL}/callback`;

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

// ---------- providers ----------
// Each provider is just these five things, so adding Garmin or Whoop later
// (both need partner approval, which is why they're not here yet) is a new
// entry rather than new plumbing.

type DailyMetrics = { date: string; steps?: number; sleepHours?: number };

type Provider = {
  authUrl: (state: string) => string;
  exchange: (code: string) => Promise<TokenSet>;
  refresh: (refreshToken: string) => Promise<TokenSet>;
  fetchDaily: (accessToken: string, days: number) => Promise<DailyMetrics[]>;
};

type TokenSet = { accessToken: string; refreshToken?: string; expiresAt?: string; providerUserId?: string; scopes?: string };

function creds(provider: string) {
  const id = Deno.env.get(`${provider.toUpperCase()}_CLIENT_ID`);
  const secret = Deno.env.get(`${provider.toUpperCase()}_CLIENT_SECRET`);
  if (!id || !secret) throw new Error(`${provider} isn't set up yet - missing ${provider.toUpperCase()}_CLIENT_ID/SECRET secret.`);
  return { id, secret };
}

function expiryFrom(seconds?: number): string | undefined {
  return seconds ? new Date(Date.now() + seconds * 1000).toISOString() : undefined;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Fitbit: Basic-auth token endpoint, per-day summary endpoints.
const fitbit: Provider = {
  authUrl: (state) => {
    const { id } = creds("fitbit");
    const params = new URLSearchParams({
      client_id: id, response_type: "code", scope: "activity sleep profile",
      redirect_uri: REDIRECT_URI, state,
    });
    return `https://www.fitbit.com/oauth2/authorize?${params}`;
  },
  exchange: async (code) => {
    const { id, secret } = creds("fitbit");
    const res = await fetch("https://api.fitbit.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${btoa(`${id}:${secret}`)}` },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d?.errors?.[0]?.message || "Fitbit rejected the connection.");
    return { accessToken: d.access_token, refreshToken: d.refresh_token, expiresAt: expiryFrom(d.expires_in), providerUserId: d.user_id, scopes: d.scope };
  },
  refresh: async (refreshToken) => {
    const { id, secret } = creds("fitbit");
    const res = await fetch("https://api.fitbit.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${btoa(`${id}:${secret}`)}` },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d?.errors?.[0]?.message || "Fitbit connection expired - reconnect needed.");
    return { accessToken: d.access_token, refreshToken: d.refresh_token, expiresAt: expiryFrom(d.expires_in) };
  },
  fetchDaily: async (accessToken, days) => {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const end = isoDay(new Date());
    const start = isoDay(new Date(Date.now() - (days - 1) * 86400000));
    const out = new Map<string, DailyMetrics>();

    const stepsRes = await fetch(`https://api.fitbit.com/1/user/-/activities/steps/date/${start}/${end}.json`, { headers });
    if (stepsRes.ok) {
      const d = await stepsRes.json();
      for (const row of d["activities-steps"] || []) {
        const steps = Number(row.value) || 0;
        if (steps > 0) out.set(row.dateTime, { ...(out.get(row.dateTime) || { date: row.dateTime }), date: row.dateTime, steps });
      }
    }

    const sleepRes = await fetch(`https://api.fitbit.com/1.2/user/-/sleep/date/${start}/${end}.json`, { headers });
    if (sleepRes.ok) {
      const d = await sleepRes.json();
      for (const row of d.sleep || []) {
        // dateOfSleep is the morning you woke up, which is the day the
        // sleep belongs to from a coaching point of view.
        const date = row.dateOfSleep;
        const hours = Math.round(((row.minutesAsleep || 0) / 60) * 10) / 10;
        if (hours > 0) out.set(date, { ...(out.get(date) || { date }), date, sleepHours: hours });
      }
    }
    return [...out.values()];
  },
};

// Oura: standard OAuth2 + v2 daily endpoints.
const oura: Provider = {
  authUrl: (state) => {
    const { id } = creds("oura");
    const params = new URLSearchParams({
      client_id: id, response_type: "code", scope: "daily personal",
      redirect_uri: REDIRECT_URI, state,
    });
    return `https://cloud.ouraring.com/oauth/authorize?${params}`;
  },
  exchange: async (code) => {
    const { id, secret } = creds("oura");
    const res = await fetch("https://api.ouraring.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI, client_id: id, client_secret: secret }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d?.error_description || d?.error || "Oura rejected the connection.");
    return { accessToken: d.access_token, refreshToken: d.refresh_token, expiresAt: expiryFrom(d.expires_in) };
  },
  refresh: async (refreshToken) => {
    const { id, secret } = creds("oura");
    const res = await fetch("https://api.ouraring.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: id, client_secret: secret }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d?.error_description || "Oura connection expired - reconnect needed.");
    return { accessToken: d.access_token, refreshToken: d.refresh_token, expiresAt: expiryFrom(d.expires_in) };
  },
  fetchDaily: async (accessToken, days) => {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const end = isoDay(new Date());
    const start = isoDay(new Date(Date.now() - (days - 1) * 86400000));
    const out = new Map<string, DailyMetrics>();

    const actRes = await fetch(`https://api.ouraring.com/v2/usercollection/daily_activity?start_date=${start}&end_date=${end}`, { headers });
    if (actRes.ok) {
      const d = await actRes.json();
      for (const row of d.data || []) {
        const steps = Number(row.steps) || 0;
        if (steps > 0) out.set(row.day, { ...(out.get(row.day) || { date: row.day }), date: row.day, steps });
      }
    }

    const sleepRes = await fetch(`https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${start}&end_date=${end}`, { headers });
    if (sleepRes.ok) {
      const d = await sleepRes.json();
      for (const row of d.data || []) {
        // daily_sleep carries a score; total sleep duration lives on the
        // contributors-bearing sleep endpoint, so fall back gracefully.
        const seconds = Number(row.total_sleep_duration ?? row.contributors?.total_sleep) || 0;
        const hours = Math.round((seconds / 3600) * 10) / 10;
        if (hours > 0) out.set(row.day, { ...(out.get(row.day) || { date: row.day }), date: row.day, sleepHours: hours });
      }
    }
    return [...out.values()];
  },
};

const PROVIDERS: Record<string, Provider> = { fitbit, oura };

// ---------- token handling ----------

async function validAccessToken(db: any, row: any): Promise<string> {
  const provider = PROVIDERS[row.provider];
  const expiresSoon = row.expires_at && new Date(row.expires_at).getTime() - Date.now() < 120000;
  if (!expiresSoon || !row.refresh_token) return row.access_token;

  const next = await provider.refresh(row.refresh_token);
  await db.from("client_health_connections").update({
    access_token: next.accessToken,
    // Providers rotate refresh tokens; keeping the old one on a response
    // that omits it would silently break the next refresh.
    refresh_token: next.refreshToken || row.refresh_token,
    expires_at: next.expiresAt,
  }).eq("id", row.id);
  return next.accessToken;
}

// ---------- sync ----------
// Writes into the SAME nutrition.habits shape the food diary already uses,
// so every downstream consumer (the weekly report, the client summary, the
// AI chat's grounding) picks this up with no changes at all.
async function syncConnection(db: any, row: any, days: number) {
  const provider = PROVIDERS[row.provider];
  const token = await validAccessToken(db, row);
  const metrics = await provider.fetchDaily(token, days);

  const { data: section } = await db.from("client_data")
    .select("data").eq("client_id", row.client_id).eq("section", "nutrition").maybeSingle();

  const nutrition = section?.data || {};
  const habits = { ...(nutrition.habits || {}) };
  let written = 0;

  for (const m of metrics) {
    const existing = habits[m.date] || {};
    const next = { ...existing };
    // Device numbers win over a hand-typed value - they're measured, and a
    // client who connected a wearable is telling us to trust it. Water is
    // never touched: no wearable reports it, so a manual entry is all there is.
    if (m.steps != null) next.steps = m.steps;
    if (m.sleepHours != null) next.sleep = m.sleepHours;
    if (m.steps != null || m.sleepHours != null) {
      next.source = row.provider;
      habits[m.date] = next;
      written += 1;
    }
  }

  await db.from("client_data").upsert(
    { client_id: row.client_id, section: "nutrition", data: { ...nutrition, habits } },
    { onConflict: "client_id,section" }
  );
  await db.from("client_health_connections")
    .update({ last_synced_at: new Date().toISOString(), last_sync_error: null })
    .eq("id", row.id);

  return { provider: row.provider, days: written };
}

// ---------- router ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (o: any, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { ...CORS, "Content-Type": "application/json" } });
  const url = new URL(req.url);
  const db = admin();

  try {
    // OAuth redirect lands here as a GET from the provider, not from our app.
    if (url.pathname.endsWith("/callback")) {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const denied = url.searchParams.get("error");

      const { data: stateRow } = await db.from("client_health_oauth_states").select("*").eq("state", state || "").maybeSingle();
      const returnTo = stateRow?.return_to || "/";
      const back = (msg: string) => new Response(null, { status: 302, headers: { Location: `${returnTo}${returnTo.includes("?") ? "&" : "?"}health=${encodeURIComponent(msg)}` } });

      if (!stateRow) return back("expired");
      await db.from("client_health_oauth_states").delete().eq("state", state);
      if (new Date(stateRow.expires_at).getTime() < Date.now()) return back("expired");
      if (denied || !code) return back("cancelled");

      const provider = PROVIDERS[stateRow.provider];
      if (!provider) return back("unsupported");

      const tokens = await provider.exchange(code);
      await db.from("client_health_connections").upsert({
        client_id: stateRow.client_id,
        provider: stateRow.provider,
        provider_user_id: tokens.providerUserId || null,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken || null,
        expires_at: tokens.expiresAt || null,
        scopes: tokens.scopes || null,
        connected_at: new Date().toISOString(),
        last_sync_error: null,
      }, { onConflict: "client_id,provider" });

      // Pull a fortnight immediately so the client sees data straight away
      // rather than an empty "connected" state until tomorrow.
      const { data: fresh } = await db.from("client_health_connections")
        .select("*").eq("client_id", stateRow.client_id).eq("provider", stateRow.provider).maybeSingle();
      if (fresh) await syncConnection(db, fresh, 14).catch(() => {});

      return back("connected");
    }

    const body = await req.json().catch(() => ({}));
    const { action, clientId } = body;
    if (!clientId) return json({ error: "No client specified." }, 400);

    if (action === "status") {
      const { data } = await db.from("client_health_connections")
        .select("provider, last_synced_at, last_sync_error, connected_at").eq("client_id", clientId);
      return json({
        connections: data || [],
        available: Object.keys(PROVIDERS).filter((p) => Deno.env.get(`${p.toUpperCase()}_CLIENT_ID`)),
      });
    }

    if (action === "connect") {
      const provider = PROVIDERS[body.provider];
      if (!provider) return json({ error: "That device isn't supported yet." }, 400);
      const state = crypto.randomUUID();
      await db.from("client_health_oauth_states").insert({
        state, client_id: clientId, provider: body.provider, return_to: body.returnTo || null,
      });
      return json({ url: provider.authUrl(state) });
    }

    if (action === "sync") {
      const { data: rows } = await db.from("client_health_connections").select("*").eq("client_id", clientId);
      if (!rows?.length) return json({ error: "No device connected." }, 400);
      const results = [];
      for (const row of rows) {
        try {
          results.push(await syncConnection(db, row, Number(body.days) || 7));
        } catch (e: any) {
          const message = String(e?.message || e);
          await db.from("client_health_connections").update({ last_sync_error: message }).eq("id", row.id);
          results.push({ provider: row.provider, error: message });
        }
      }
      return json({ results });
    }

    if (action === "disconnect") {
      await db.from("client_health_connections").delete().eq("client_id", clientId).eq("provider", body.provider);
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
