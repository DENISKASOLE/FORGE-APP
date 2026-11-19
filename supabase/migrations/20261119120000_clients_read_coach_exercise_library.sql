-- Clients can read their own coach's exercise library (Nov 19 2026).
-- Needed for coach-approved swaps, coaching cues and library videos in the
-- client workout screen. Read-only, only the custom_exercise_library section,
-- only for the coach the signed-in client belongs to.
drop policy if exists "clients read coach exercise library" on public.trainer_data;
create policy "clients read coach exercise library"
  on public.trainer_data
  for select
  to authenticated
  using (
    section = 'custom_exercise_library'
    and trainer_id in (select c.trainer_id from public.clients c where c.client_user_id = auth.uid())
  );
