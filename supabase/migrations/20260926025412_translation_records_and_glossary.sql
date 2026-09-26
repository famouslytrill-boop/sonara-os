-- Tenant-scoped, human-editable translation source/target records and glossary.
-- General machine translation is deliberately not implied by these tables.
create table if not exists public.translation_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  message_key text not null,
  source_locale text not null,
  target_locale text not null,
  source_text text not null,
  target_text text not null,
  status text not null default 'draft' check (status in ('draft','review_required','approved','retired')),
  provenance text not null default 'human',
  revision integer not null default 1 check (revision > 0),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, message_key, source_locale, target_locale),
  check (source_locale <> target_locale)
);

create table if not exists public.translation_glossary_terms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_locale text not null,
  target_locale text not null,
  source_term text not null,
  target_term text not null,
  case_sensitive boolean not null default false,
  status text not null default 'active' check (status in ('active','retired')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, source_locale, target_locale, source_term),
  check (source_locale <> target_locale),
  check (length(trim(source_term)) > 0)
);

create index if not exists translation_records_org_locale_status_idx
  on public.translation_records (organization_id, target_locale, status);
create index if not exists translation_glossary_org_locale_status_idx
  on public.translation_glossary_terms (organization_id, source_locale, target_locale, status);

alter table public.translation_records enable row level security;
alter table public.translation_glossary_terms enable row level security;
revoke all on public.translation_records, public.translation_glossary_terms from public, anon;
grant select on public.translation_records, public.translation_glossary_terms to authenticated;
grant all on public.translation_records, public.translation_glossary_terms to service_role;

drop policy if exists "members read translation records" on public.translation_records;
create policy "members read translation records" on public.translation_records
  for select to authenticated using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = translation_records.organization_id
      and m.user_id = auth.uid()
      and coalesce(m.status, 'active') = 'active'
  ));
drop policy if exists "service role manages translation records" on public.translation_records;
create policy "service role manages translation records" on public.translation_records
  for all to service_role using (true) with check (true);

drop policy if exists "members read translation glossary" on public.translation_glossary_terms;
create policy "members read translation glossary" on public.translation_glossary_terms
  for select to authenticated using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = translation_glossary_terms.organization_id
      and m.user_id = auth.uid()
      and coalesce(m.status, 'active') = 'active'
  ));
drop policy if exists "service role manages translation glossary" on public.translation_glossary_terms;
create policy "service role manages translation glossary" on public.translation_glossary_terms
  for all to service_role using (true) with check (true);
