-- Fixes a real bug: claim_invite(code, email) (added in the migration that
-- replaced the old open "Allow public *" policies on `clients`) links a new
-- client account by setting client_user_id = auth.uid() from inside a
-- SECURITY DEFINER function. That's correct and safe, but this project
-- requires email confirmation before a session exists, so the app was
-- calling claim_invite() immediately after signUp() - before the user had
-- clicked their confirmation link, while auth.uid() was still empty. The
-- link silently never happened; invite_status flipped to 'accepted' (that
-- part of the same UPDATE matched fine) but client_user_id stayed null
-- forever, and the client's next real login found no client row and got
-- signed out to "this account is no longer active".
--
-- Fix: a second, simpler claim function keyed only by the caller's own
-- verified JWT email (never a client-supplied value, so it can only ever
-- claim the row matching the account that's actually logged in right now)
-- - called from App.jsx's loadRole() as a self-heal fallback whenever a
-- logged-in user has no client row yet. Login always has an active
-- session, so this works regardless of the confirm-email timing gap that
-- broke the original signup-time claim.
create or replace function public.claim_invite_by_email()
returns table(id uuid) as $$
  update public.clients
  set client_user_id = auth.uid(), invite_status = 'accepted'
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and email <> ''
    and client_user_id is null
  returning id;
$$ language sql security definer set search_path = public;

grant execute on function public.claim_invite_by_email() to authenticated;

-- One-time data fix for the three clients already stuck by this bug before
-- the code fix shipped (confirmed by matching each client's email to an
-- already-email-confirmed auth user with no other clients row claiming
-- that auth id): Rameez, Manasi, Sumy.
update public.clients c
set client_user_id = u.id, invite_status = 'accepted'
from auth.users u
where lower(u.email) = lower(c.email)
  and c.client_user_id is null
  and c.invite_status = 'accepted'
  and not exists (select 1 from public.clients c2 where c2.client_user_id = u.id);
