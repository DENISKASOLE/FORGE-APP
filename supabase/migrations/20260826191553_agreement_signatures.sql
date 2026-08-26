-- Signed-agreement audit trail for the Program tab gate.
-- One row per signing event - never updated, never overwritten. A client
-- re-signing a new contract version inserts a new row; history stays intact.

create table if not exists public.agreement_signatures (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  contract_version text not null,
  signed_name text not null,
  signature_path text not null,
  pdf_path text not null,
  consents jsonb not null,
  signed_at timestamptz not null default now()
);

create index if not exists agreement_signatures_client_id_idx
  on public.agreement_signatures (client_id, signed_at desc);

alter table public.agreement_signatures enable row level security;

-- A client may insert only a row for their own client_id (or a client row
-- their trainer hasn't linked to an auth user yet has no client_user_id to
-- match, so unsigned/unlinked rows simply can't be inserted by anyone but
-- the eventual client - matches the ownership check already used on
-- client_data/clients).
create policy "agreement_signatures_insert_own"
on public.agreement_signatures for insert
with check (
  exists (
    select 1 from public.clients c
    where c.id = agreement_signatures.client_id
      and c.client_user_id = auth.uid()
  )
);

-- A client can read their own signatures; their trainer can also read them
-- (needed to confirm a client has signed before a session, and for the
-- coach's own liability records) - no update or delete policy exists, so
-- the audit trail is append-only for everyone including the coach.
create policy "agreement_signatures_select_own_or_trainer"
on public.agreement_signatures for select
using (
  exists (
    select 1 from public.clients c
    where c.id = agreement_signatures.client_id
      and (c.client_user_id = auth.uid() or c.trainer_id = auth.uid())
  )
);

-- Private bucket for signature PNGs + generated PDF copies.
insert into storage.buckets (id, name, public)
values ('agreement-documents', 'agreement-documents', false)
on conflict (id) do nothing;

-- Objects are keyed "{client_id}/{signature_id}/signature.png" and
-- ".../agreement.pdf" - same folder-prefix ownership check as client-photos.
create policy "agreement_documents_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'agreement-documents'
  and exists (
    select 1 from public.clients c
    where c.id::text = (storage.foldername(name))[1]
      and c.client_user_id = auth.uid()
  )
);

create policy "agreement_documents_select_own_or_trainer"
on storage.objects for select
using (
  bucket_id = 'agreement-documents'
  and exists (
    select 1 from public.clients c
    where c.id::text = (storage.foldername(name))[1]
      and (c.client_user_id = auth.uid() or c.trainer_id = auth.uid())
  )
);
