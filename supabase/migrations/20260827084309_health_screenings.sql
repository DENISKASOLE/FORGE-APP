-- Replaces the agreement_signatures / agreement-documents pair from the
-- previous migration (20260826191553) - the Program-tab gate is now a
-- PAR-Q+ style health-readiness screening, not a legal agreement.
-- Nothing has ever signed the old table (no real client has used it yet),
-- so this drops it outright rather than leaving a dead duplicate around.
drop policy if exists "agreement_signatures_insert_own" on public.agreement_signatures;
drop policy if exists "agreement_signatures_select_own_or_trainer" on public.agreement_signatures;
drop table if exists public.agreement_signatures;

-- Direct deletion from storage.buckets is blocked by Supabase's own
-- protect_delete() trigger (must go through the Storage API instead). The
-- bucket is empty - nothing was ever uploaded to it - so it's left behind
-- as an orphaned, unused private bucket rather than scripting an API call
-- for an empty bucket with no security exposure.
drop policy if exists "agreement_documents_insert_own" on storage.objects;
drop policy if exists "agreement_documents_select_own_or_trainer" on storage.objects;

-- One row per completed screening - never updated, never overwritten. A
-- client re-screening a newer version inserts a new row; history stays
-- intact for liability/compliance purposes.
create table if not exists public.health_screenings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  screening_version text not null,
  answers jsonb not null,
  needs_clearance boolean not null default false,
  signed_name text not null,
  signature_path text not null,
  pdf_path text not null,
  consents jsonb not null,
  signed_at timestamptz not null default now()
);

create index if not exists health_screenings_client_id_idx
  on public.health_screenings (client_id, signed_at desc);

alter table public.health_screenings enable row level security;

-- A client may insert only a row for their own client_id.
create policy "health_screenings_insert_own"
on public.health_screenings for insert
with check (
  exists (
    select 1 from public.clients c
    where c.id = health_screenings.client_id
      and c.client_user_id = auth.uid()
  )
);

-- A client can read their own screenings; their own trainer can also read
-- them - scoped to their own clients, matching the pattern used everywhere
-- else in this app (client_data, client-photos), not a blanket "any
-- trainer reads everything." No update or delete policy exists, so the
-- audit trail is append-only for everyone.
create policy "health_screenings_select_own_or_trainer"
on public.health_screenings for select
using (
  exists (
    select 1 from public.clients c
    where c.id = health_screenings.client_id
      and (c.client_user_id = auth.uid() or c.trainer_id = auth.uid())
  )
);

-- Private bucket for signature PNGs + generated PDF copies.
insert into storage.buckets (id, name, public)
values ('screening-documents', 'screening-documents', false)
on conflict (id) do nothing;

-- Objects are keyed "{client_id}/{screening_id}/signature.png" and
-- ".../screening.pdf".
create policy "screening_documents_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'screening-documents'
  and exists (
    select 1 from public.clients c
    where c.id::text = (storage.foldername(name))[1]
      and c.client_user_id = auth.uid()
  )
);

create policy "screening_documents_select_own_or_trainer"
on storage.objects for select
using (
  bucket_id = 'screening-documents'
  and exists (
    select 1 from public.clients c
    where c.id::text = (storage.foldername(name))[1]
      and (c.client_user_id = auth.uid() or c.trainer_id = auth.uid())
  )
);
