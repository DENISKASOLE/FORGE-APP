-- Client "Delete my account" (Nov 19 2026).
--
-- Called by a signed-in CLIENT from the app. Removes everything Forge holds
-- for them and their login itself, in one transaction:
--   client_data rows, the clients row (agreement_signatures, health_screenings
--   and buddy_members cascade from it), and the auth user.
-- Progress photos in Storage are removed by the app first through the
-- Storage API (Supabase doesn't allow deleting Storage files from SQL).
--
-- Coach accounts are refused: a coach deleting their login would orphan every
-- client they manage.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  if exists (select 1 from public.trainers where id = uid) then
    raise exception 'Coach accounts can''t be deleted from the app';
  end if;

  delete from public.client_data
  where client_id in (select id from public.clients where client_user_id = uid);

  delete from public.clients where client_user_id = uid;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
