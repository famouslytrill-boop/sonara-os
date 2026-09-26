-- Keep translation RLS checks initplan-friendly and cover the user foreign keys.
create index if not exists translation_records_created_by_idx
  on public.translation_records (created_by);
create index if not exists translation_records_updated_by_idx
  on public.translation_records (updated_by);
create index if not exists translation_glossary_created_by_idx
  on public.translation_glossary_terms (created_by);

drop policy if exists "members read translation records" on public.translation_records;
create policy "members read translation records" on public.translation_records
  for select to authenticated using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = translation_records.organization_id
      and m.user_id = (select auth.uid())
      and coalesce(m.status, 'active') = 'active'
  ));

drop policy if exists "members read translation glossary" on public.translation_glossary_terms;
create policy "members read translation glossary" on public.translation_glossary_terms
  for select to authenticated using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = translation_glossary_terms.organization_id
      and m.user_id = (select auth.uid())
      and coalesce(m.status, 'active') = 'active'
  ));
