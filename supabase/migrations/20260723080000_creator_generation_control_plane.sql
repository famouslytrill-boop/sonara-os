-- SONARA Creator Studio generation control plane.
-- Additive, tenant-scoped, private-output-first, consent-aware, and provider-neutral.

create extension if not exists pgcrypto;

create table if not exists public.creator_voice_consents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_type text not null check (subject_type in ('self','authorized_person','synthetic_voice','licensed_voice')),
  subject_name text,
  consent_scope text not null check (consent_scope in ('text_to_speech','speech_to_speech','voice_clone','singing_voice','all_voice_generation')),
  evidence_type text not null check (evidence_type in ('self_attestation','signed_release','provider_voice_id','license_record','other')),
  evidence_reference text,
  consent_attested boolean not null default false,
  expires_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid,
  capability text not null check (capability in (
    'text_to_speech','speech_to_speech','voice_clone','singing_voice','sound_effects','text_to_audio',
    'text_to_music','music_plan','video_to_music','song_cover','song_mashup','music_voice_profile',
    'text_to_video','image_to_video','video_to_video','video_extend','first_last_frame_video','native_audio_video',
    'talking_avatar','explainer_video','ad_video','scene_orchestration','reference_analysis'
  )),
  provider_key text not null,
  provider_job_id text,
  title text,
  prompt text not null default '',
  negative_prompt text,
  input_assets jsonb not null default '[]'::jsonb,
  parameters jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in (
    'queued','submitted','running','completed','failed','cancelled','setup_required','review_required','manual_required'
  )),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  rights_attested boolean not null default false,
  consent_attested boolean not null default false,
  voice_consent_id uuid references public.creator_voice_consents(id) on delete set null,
  policy_status text not null default 'pending' check (policy_status in ('pending','approved','review_required','rejected')),
  policy_reasons jsonb not null default '[]'::jsonb,
  provider_response jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  submitted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_generation_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.creator_generation_jobs(id) on delete cascade,
  asset_role text not null default 'output' check (asset_role in ('input','reference','output','preview','stem','transcript','metadata')),
  media_type text not null check (media_type in ('audio','music','voice','video','image','json','text','other')),
  bucket_id text not null check (bucket_id in ('creator-assets','music-stems','release-packages','exports')),
  object_path text not null,
  mime_type text,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  checksum_sha256 text,
  provider_asset_id text,
  provenance jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (bucket_id, object_path)
);

create table if not exists public.creator_reference_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.creator_generation_jobs(id) on delete set null,
  source_asset_id uuid references public.creator_generation_assets(id) on delete set null,
  source_rights_attested boolean not null default false,
  analysis_type text not null check (analysis_type in ('audio_structure','music_theory','voice_characteristics','video_structure','shot_language','visual_style','mixed_media')),
  structural_features jsonb not null default '{}'::jsonb,
  originality_constraints jsonb not null default '{}'::jsonb,
  prohibited_identity_targets jsonb not null default '[]'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','review_required')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_generation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  job_id uuid references public.creator_generation_jobs(id) on delete cascade,
  event_type text not null,
  event_status text not null default 'recorded' check (event_status in ('recorded','success','failed','denied','review_required')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists creator_generation_jobs_org_status_idx
  on public.creator_generation_jobs (organization_id, status, created_at desc);
create index if not exists creator_generation_jobs_user_idx
  on public.creator_generation_jobs (user_id, created_at desc);
create index if not exists creator_generation_assets_job_idx
  on public.creator_generation_assets (job_id, created_at desc);
create index if not exists creator_voice_consents_lookup_idx
  on public.creator_voice_consents (organization_id, user_id, consent_scope, revoked_at, expires_at);
create index if not exists creator_reference_analyses_org_idx
  on public.creator_reference_analyses (organization_id, created_at desc);
create index if not exists creator_generation_events_job_idx
  on public.creator_generation_events (job_id, created_at desc);

alter table public.creator_voice_consents enable row level security;
alter table public.creator_generation_jobs enable row level security;
alter table public.creator_generation_assets enable row level security;
alter table public.creator_reference_analyses enable row level security;
alter table public.creator_generation_events enable row level security;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'creator_voice_consents',
    'creator_generation_jobs',
    'creator_generation_assets',
    'creator_reference_analyses',
    'creator_generation_events'
  ]
  loop
    execute format('drop policy if exists "creator members read %1$s" on public.%1$I', relation_name);
    execute format(
      'create policy "creator members read %1$s" on public.%1$I for select to authenticated using (public.sonara_is_org_member(organization_id))',
      relation_name
    );

    execute format('drop policy if exists "creator users create %1$s" on public.%1$I', relation_name);
    execute format(
      'create policy "creator users create %1$s" on public.%1$I for insert to authenticated with check (auth.uid() = user_id and public.sonara_is_org_member(organization_id))',
      relation_name
    );

    execute format('drop policy if exists "creator users update own %1$s" on public.%1$I', relation_name);
    execute format(
      'create policy "creator users update own %1$s" on public.%1$I for update to authenticated using (auth.uid() = user_id and public.sonara_is_org_member(organization_id)) with check (auth.uid() = user_id and public.sonara_is_org_member(organization_id))',
      relation_name
    );

    execute format('drop policy if exists "service role manages %1$s" on public.%1$I', relation_name);
    execute format(
      'create policy "service role manages %1$s" on public.%1$I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')',
      relation_name
    );
  end loop;
end $$;

-- Job/event records are retained for audit; customer-facing routes cancel or soft-transition jobs instead of deleting them.
revoke delete on public.creator_generation_jobs from anon, authenticated;
revoke delete on public.creator_generation_events from anon, authenticated;

-- identity_imitation_prohibited: reference analysis may extract structure, timing, harmony, or shot language only.
comment on table public.creator_generation_jobs is 'Tenant-scoped generation jobs routed to governed cloud or isolated worker adapters.';
comment on table public.creator_generation_assets is 'Private Supabase Storage references for Creator Studio generation inputs and outputs.';
comment on table public.creator_voice_consents is 'Consent and rights evidence required before voice conversion, cloning, or singing-voice generation.';
comment on table public.creator_reference_analyses is 'Structural analysis of owned or licensed references; identity imitation is prohibited.';
comment on table public.creator_generation_events is 'Append-only operational and policy evidence for generation jobs.';
