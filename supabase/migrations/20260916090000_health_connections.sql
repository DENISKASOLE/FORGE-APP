-- Wearable connections: Fitbit / Oura (and later Garmin / Whoop) linked by
-- a client so their steps and sleep flow into Forge automatically instead
-- of being typed in by hand.
--
-- SECURITY NOTE - read before adding any policy to these tables.
-- Both tables hold OAuth credentials, which are bearer tokens to a
-- client's health account on a third-party service. They are deliberately
-- readable by NOBODY through the API: RLS is enabled and NO policies are
-- created, so every normal request (client, coach, anon) is denied. Only
-- the service role - i.e. the forge-health edge function, which bypasses
-- RLS - can read or write them. The app never sees a token; it asks the
-- edge function for connection *status* instead.
-- If you ever add a "select" policy here, you are handing a client's
-- Fitbit/Oura account credentials to whoever matches that policy.

create table if not exists public.client_health_connections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  provider text not null check (provider in ('fitbit', 'oura', 'garmin', 'whoop')),
  provider_user_id text,
  access_token text not null,
  refresh_token text,
  -- When the access token dies. The edge function refreshes ahead of this
  -- rather than waiting for a 401.
  expires_at timestamptz,
  scopes text,
  last_synced_at timestamptz,
  -- Surfaced to the client as "couldn't sync" so a silently-dead
  -- connection doesn't look healthy for weeks.
  last_sync_error text,
  connected_at timestamptz not null default now(),
  -- One connection per provider per client. Re-connecting the same
  -- provider updates the row (see the upsert in forge-health).
  unique (client_id, provider)
);

create index if not exists client_health_connections_client_idx
  on public.client_health_connections (client_id);

alter table public.client_health_connections enable row level security;
-- Intentionally no policies. See SECURITY NOTE above.

-- Short-lived CSRF/correlation state for the OAuth round trip. The
-- provider redirects back with only `code` and `state`, so this is what
-- maps a callback to the client who started it - it cannot be passed in
-- the URL without letting anyone attach their wearable to any client.
create table if not exists public.client_health_oauth_states (
  state text primary key,
  client_id uuid not null references public.clients(id) on delete cascade,
  provider text not null,
  -- Where to send the browser once the exchange is done, so the client
  -- lands back on the screen they started from.
  return_to text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes')
);

create index if not exists client_health_oauth_states_expiry_idx
  on public.client_health_oauth_states (expires_at);

alter table public.client_health_oauth_states enable row level security;
-- Intentionally no policies. See SECURITY NOTE above.
