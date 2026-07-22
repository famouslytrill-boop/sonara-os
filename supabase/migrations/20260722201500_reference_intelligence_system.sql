-- Governed external-reference intake for SONARA Industries.
-- Sources remain unverified until a human can inspect the original content or
-- attach an owner-supplied transcript. No source is automatically converted
-- into product behavior, marketing claims, campaigns, or copied creative work.

create table if not exists public.reference_intelligence_sources (
  id uuid primary key default gen_random_uuid(),
  source_platform text not null,
  source_type text not null,
  external_id text,
  source_url text not null unique,
  title text,
  creator_name text,
  transcript text,
  factual_summary text,
  owner_notes text,
  verification_status text not null default 'requires_authenticated_source_review'
    check (verification_status in ('requires_authenticated_source_review','transcript_required','review_in_progress','verified','rejected','archived')),
  access_status text not null default 'public_fetch_blocked'
    check (access_status in ('public_fetch_blocked','accessible','owner_supplied','removed','unknown')),
  rights_status text not null default 'unknown'
    check (rights_status in ('unknown','reference_only','permission_granted','licensed','public_domain','blocked')),
  candidate_products text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reference_intelligence_insights (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.reference_intelligence_sources(id) on delete cascade,
  insight_kind text not null,
  factual_basis text not null,
  interpretation text,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  product_scopes text[] not null default '{}'::text[],
  expected_impact text,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'review_required'
    check (status in ('draft','review_required','approved','rejected','archived')),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reference_intelligence_actions (
  id uuid primary key default gen_random_uuid(),
  insight_id uuid not null references public.reference_intelligence_insights(id) on delete cascade,
  target_product text not null
    check (target_product in ('business_builder','creator_studio','growth_studio','sonara_nexus')),
  target_module text,
  action_type text not null,
  proposed_change text not null,
  expected_impact text,
  approval_required boolean not null default true,
  status text not null default 'proposed'
    check (status in ('proposed','review_required','approved','implemented','rejected','archived')),
  implementation_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reference_intelligence_sources_status_created_idx
  on public.reference_intelligence_sources(verification_status, created_at desc);
create index if not exists reference_intelligence_sources_platform_external_idx
  on public.reference_intelligence_sources(source_platform, external_id);
create index if not exists reference_intelligence_insights_source_status_idx
  on public.reference_intelligence_insights(source_id, status, created_at desc);
create index if not exists reference_intelligence_actions_product_status_idx
  on public.reference_intelligence_actions(target_product, status, created_at desc);

alter table public.reference_intelligence_sources enable row level security;
alter table public.reference_intelligence_insights enable row level security;
alter table public.reference_intelligence_actions enable row level security;

revoke all on table public.reference_intelligence_sources from public, anon, authenticated;
revoke all on table public.reference_intelligence_insights from public, anon, authenticated;
revoke all on table public.reference_intelligence_actions from public, anon, authenticated;
grant select, insert, update, delete on table public.reference_intelligence_sources to service_role;
grant select, insert, update, delete on table public.reference_intelligence_insights to service_role;
grant select, insert, update, delete on table public.reference_intelligence_actions to service_role;

create policy "service role manages reference intelligence sources"
  on public.reference_intelligence_sources for all to service_role using (true) with check (true);
create policy "service role manages reference intelligence insights"
  on public.reference_intelligence_insights for all to service_role using (true) with check (true);
create policy "service role manages reference intelligence actions"
  on public.reference_intelligence_actions for all to service_role using (true) with check (true);

drop trigger if exists reference_intelligence_sources_set_updated_at on public.reference_intelligence_sources;
create trigger reference_intelligence_sources_set_updated_at
  before update on public.reference_intelligence_sources
  for each row execute function public.set_updated_at();
drop trigger if exists reference_intelligence_insights_set_updated_at on public.reference_intelligence_insights;
create trigger reference_intelligence_insights_set_updated_at
  before update on public.reference_intelligence_insights
  for each row execute function public.set_updated_at();
drop trigger if exists reference_intelligence_actions_set_updated_at on public.reference_intelligence_actions;
create trigger reference_intelligence_actions_set_updated_at
  before update on public.reference_intelligence_actions
  for each row execute function public.set_updated_at();

insert into public.reference_intelligence_sources
  (source_platform, source_type, external_id, source_url, candidate_products, metadata)
values
  ('facebook','shared_reel','1KQxNqHHtk','https://www.facebook.com/share/r/1KQxNqHHtk/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','shared_reel','18kbRrGnSF','https://www.facebook.com/share/r/18kbRrGnSF/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','shared_reel','1Ew8qgjUUD','https://www.facebook.com/share/r/1Ew8qgjUUD/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','shared_reel','1D7gsWoezN','https://www.facebook.com/share/r/1D7gsWoezN/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','shared_reel','1Euj21Yaxr','https://www.facebook.com/share/r/1Euj21Yaxr/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','shared_reel','1DEMLpuhCs','https://www.facebook.com/share/r/1DEMLpuhCs/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','shared_reel','1HK1qH15UX','https://www.facebook.com/share/r/1HK1qH15UX/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','shared_reel','18xkkdkPNU','https://www.facebook.com/share/r/18xkkdkPNU/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','shared_reel','1EtExfWGPN','https://www.facebook.com/share/r/1EtExfWGPN/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','shared_reel','1Gs9aQeZq9','https://www.facebook.com/share/r/1Gs9aQeZq9/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','shared_reel','17mMTqcYoU','https://www.facebook.com/share/r/17mMTqcYoU/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','shared_reel','1EqZRWp51h','https://www.facebook.com/share/r/1EqZRWp51h/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','shared_reel','1E5YwdPppB','https://www.facebook.com/share/r/1E5YwdPppB/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','shared_reel','1QD5UwYLxA','https://www.facebook.com/share/r/1QD5UwYLxA/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','shared_reel','1DFgNvc4gG','https://www.facebook.com/share/r/1DFgNvc4gG/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','shared_reel','195brCwjHS','https://www.facebook.com/share/r/195brCwjHS/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','reel','1033494375776634','https://www.facebook.com/reel/1033494375776634',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','shared_video','14hzwD6CB2L','https://www.facebook.com/share/v/14hzwD6CB2L/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','shared_reel','1Ch3SDPZg3','https://www.facebook.com/share/r/1Ch3SDPZg3/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','shared_reel','1cGzn1P6BP','https://www.facebook.com/share/r/1cGzn1P6BP/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','shared_reel','1E9GP6KV1T','https://www.facebook.com/share/r/1E9GP6KV1T/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','shared_reel','1E1DwZDnfu','https://www.facebook.com/share/r/1E1DwZDnfu/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','shared_reel','18k6PECJRF','https://www.facebook.com/share/r/18k6PECJRF/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','shared_reel','14hrZWWnzip','https://www.facebook.com/share/r/14hrZWWnzip/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','shared_reel','18tsiNz2fq','https://www.facebook.com/share/r/18tsiNz2fq/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','reel','1660071461709500','https://www.facebook.com/reel/1660071461709500',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb),
  ('facebook','shared_reel','1Jb4MMAGHV','https://www.facebook.com/share/r/1Jb4MMAGHV/',ARRAY['business_builder','creator_studio','growth_studio']::text[],'{"requested_at":"2026-07-22","content_verified":false}'::jsonb)
on conflict (source_url) do update set
  external_id = excluded.external_id,
  candidate_products = excluded.candidate_products,
  metadata = public.reference_intelligence_sources.metadata || excluded.metadata,
  updated_at = now();

notify pgrst, 'reload schema';
