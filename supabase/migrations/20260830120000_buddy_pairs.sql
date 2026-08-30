-- Buddy pairs: two clients who share one 1:1 slot and one payment, but
-- keep entirely separate programs, logs, and check-ins. These two tables
-- are pure grouping metadata layered on top of the existing clients /
-- client_data model - nothing about how programs or training logs work
-- changes, and no existing table is altered.
--
-- Schema note: the brief this was built from assumed a `profiles(id)`
-- table for both coach and client references. This project already has a
-- `profiles` table, but it's a vestigial leftover (one row, keyed by
-- user_id, unused by the app) - the real "one row per coach" / "one row
-- per client" tables here are `trainers` and `clients`. buddy_pairs.coach_id
-- and buddy_members.client_id reference those instead, matching every
-- other table added to this project (see health_screenings above).

create table if not exists public.buddy_pairs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.trainers(id) on delete cascade,
  name text,
  slot_label text,
  -- Shared monthly price for the pair's one package. This is new metadata
  -- inherent to the pair (somebody has to hold the shared amount before a
  -- payment request can go out) - it is NOT a duplicate of the per-client
  -- paid flag. Paid/unpaid status itself is never stored here; it stays
  -- exactly where it already lives, on each member's own client profile
  -- (client_data.profile.paymentPaid / paymentDueDate / lastPaidAt), and
  -- this table never mirrors or overrides it.
  price numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists buddy_pairs_coach_id_idx
  on public.buddy_pairs (coach_id);

create table if not exists public.buddy_members (
  pair_id uuid not null references public.buddy_pairs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (pair_id, client_id),
  -- A client can only ever be in one pair at a time. This is the low-risk
  -- DB guard the brief asked for in addition to the UI check: a single
  -- unique index, not a trigger, since "at most one row per client_id" is
  -- exactly what a unique constraint is for.
  unique (client_id)
);

create index if not exists buddy_members_pair_id_idx
  on public.buddy_members (pair_id);

-- updated_at trigger, mirroring set_client_data_updated_at / set_trainer_data_updated_at.
create or replace function public.set_buddy_pairs_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_buddy_pairs_updated_at on public.buddy_pairs;
create trigger set_buddy_pairs_updated_at
before update on public.buddy_pairs
for each row execute function public.set_buddy_pairs_updated_at();

-- Hard guard: a pair can never hold more than two members. Postgres has no
-- native "max N rows per group" constraint - a CHECK constraint can only
-- see the row being written, not its siblings - so this is enforced with a
-- BEFORE INSERT row-level trigger that counts existing members for the
-- target pair_id and rejects the insert if it would be the third. This is
-- the standard, reliable way to enforce a per-group row cap in Postgres.
create or replace function public.enforce_buddy_pair_max_two()
returns trigger as $$
begin
  if (select count(*) from public.buddy_members where pair_id = new.pair_id) >= 2 then
    raise exception 'A buddy pair can have at most two members';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists buddy_members_max_two on public.buddy_members;
create trigger buddy_members_max_two
before insert on public.buddy_members
for each row execute function public.enforce_buddy_pair_max_two();

alter table public.buddy_pairs enable row level security;
alter table public.buddy_members enable row level security;

-- Coach-only in this iteration: nothing in the client app surfaces buddy
-- pairs, so there is no client-side read requirement to design RLS around
-- yet. If a client-facing view is added later, add a narrowly-scoped
-- SELECT policy then rather than opening this up preemptively.
create policy "buddy_pairs_owner"
on public.buddy_pairs for all
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

-- Mirrors the client_data_trainer_or_client EXISTS-subquery style: a coach
-- may only manage members of pairs they own, and (on insert/update) only
-- add clients that are actually theirs - preventing a coach from pairing
-- in another coach's client even if they guessed the id.
create policy "buddy_members_via_pair_owner"
on public.buddy_members for all
using (
  exists (
    select 1 from public.buddy_pairs p
    where p.id = buddy_members.pair_id and p.coach_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.buddy_pairs p
    where p.id = buddy_members.pair_id and p.coach_id = auth.uid()
  )
  and exists (
    select 1 from public.clients c
    where c.id = buddy_members.client_id and c.trainer_id = auth.uid()
  )
);
