-- Kitapp: кітаптарды Life Hub аккаунтының бұлтына сақтау.
-- Жабық бакет; әр пайдаланушы тек өз қалтасын (<user id>/...) көреді, және тек Hub иесі.
insert into storage.buckets (id, name, public, file_size_limit)
values ('kitapp', 'kitapp', false, 52428800)
on conflict (id) do nothing;

create policy "kitapp owner reads own files"
  on storage.objects for select to authenticated
  using (bucket_id = 'kitapp' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_hub_owner()));

create policy "kitapp owner adds own files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'kitapp' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_hub_owner()));

create policy "kitapp owner updates own files"
  on storage.objects for update to authenticated
  using (bucket_id = 'kitapp' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_hub_owner()))
  with check (bucket_id = 'kitapp' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_hub_owner()));

create policy "kitapp owner deletes own files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'kitapp' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_hub_owner()));
