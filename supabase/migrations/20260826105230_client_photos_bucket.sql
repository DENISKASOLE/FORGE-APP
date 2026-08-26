-- Private storage bucket for client photos (profile, transformation, nutrition
-- meal photos), replacing base64-in-JSON storage. Objects are keyed by path
-- "{client_id}/{...}", and RLS matches the client_id folder against the same
-- trainer_id/client_user_id ownership check already used on client_data.

insert into storage.buckets (id, name, public)
values ('client-photos', 'client-photos', false)
on conflict (id) do nothing;

create policy "client_photos_select"
on storage.objects for select
using (
  bucket_id = 'client-photos'
  and exists (
    select 1 from public.clients c
    where c.id::text = (storage.foldername(name))[1]
      and (c.trainer_id = auth.uid() or c.client_user_id = auth.uid() or c.trainer_id is null)
  )
);

create policy "client_photos_insert"
on storage.objects for insert
with check (
  bucket_id = 'client-photos'
  and exists (
    select 1 from public.clients c
    where c.id::text = (storage.foldername(name))[1]
      and (c.trainer_id = auth.uid() or c.client_user_id = auth.uid() or c.trainer_id is null)
  )
);

create policy "client_photos_update"
on storage.objects for update
using (
  bucket_id = 'client-photos'
  and exists (
    select 1 from public.clients c
    where c.id::text = (storage.foldername(name))[1]
      and (c.trainer_id = auth.uid() or c.client_user_id = auth.uid() or c.trainer_id is null)
  )
);

create policy "client_photos_delete"
on storage.objects for delete
using (
  bucket_id = 'client-photos'
  and exists (
    select 1 from public.clients c
    where c.id::text = (storage.foldername(name))[1]
      and (c.trainer_id = auth.uid() or c.client_user_id = auth.uid() or c.trainer_id is null)
  )
);
