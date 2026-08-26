-- Extend the client-photos bucket policies to also cover a trainers/{trainer_id}/...
-- path prefix, for the coach's own profile photo (which has no corresponding
-- row in public.clients). Client photos now live under clients/{client_id}/...
-- Superseding no live data yet - the bucket was created moments ago in the
-- previous migration and nothing has been uploaded to it.

drop policy if exists "client_photos_select" on storage.objects;
drop policy if exists "client_photos_insert" on storage.objects;
drop policy if exists "client_photos_update" on storage.objects;
drop policy if exists "client_photos_delete" on storage.objects;

create policy "client_photos_select"
on storage.objects for select
using (
  bucket_id = 'client-photos'
  and (
    (
      (storage.foldername(name))[1] = 'clients'
      and exists (
        select 1 from public.clients c
        where c.id::text = (storage.foldername(name))[2]
          and (c.trainer_id = auth.uid() or c.client_user_id = auth.uid() or c.trainer_id is null)
      )
    )
    or (
      (storage.foldername(name))[1] = 'trainers'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);

create policy "client_photos_insert"
on storage.objects for insert
with check (
  bucket_id = 'client-photos'
  and (
    (
      (storage.foldername(name))[1] = 'clients'
      and exists (
        select 1 from public.clients c
        where c.id::text = (storage.foldername(name))[2]
          and (c.trainer_id = auth.uid() or c.client_user_id = auth.uid() or c.trainer_id is null)
      )
    )
    or (
      (storage.foldername(name))[1] = 'trainers'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);

create policy "client_photos_update"
on storage.objects for update
using (
  bucket_id = 'client-photos'
  and (
    (
      (storage.foldername(name))[1] = 'clients'
      and exists (
        select 1 from public.clients c
        where c.id::text = (storage.foldername(name))[2]
          and (c.trainer_id = auth.uid() or c.client_user_id = auth.uid() or c.trainer_id is null)
      )
    )
    or (
      (storage.foldername(name))[1] = 'trainers'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);

create policy "client_photos_delete"
on storage.objects for delete
using (
  bucket_id = 'client-photos'
  and (
    (
      (storage.foldername(name))[1] = 'clients'
      and exists (
        select 1 from public.clients c
        where c.id::text = (storage.foldername(name))[2]
          and (c.trainer_id = auth.uid() or c.client_user_id = auth.uid() or c.trainer_id is null)
      )
    )
    or (
      (storage.foldername(name))[1] = 'trainers'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);
