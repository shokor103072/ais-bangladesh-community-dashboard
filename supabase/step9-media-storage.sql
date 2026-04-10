insert into storage.buckets (id, name, public)
values ('community-media', 'community-media', true)
on conflict (id) do nothing;

drop policy if exists "community_media_public_read" on storage.objects;
create policy "community_media_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'community-media');

drop policy if exists "community_media_public_upload" on storage.objects;
create policy "community_media_public_upload"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'community-media');
