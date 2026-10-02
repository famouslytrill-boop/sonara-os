-- A profile a person can actually set, and a permission nobody granted.
--
-- ## What this adds, and what was already here
--
-- Measured 3 October 2026. `public.profiles` has existed since migration 011
-- with `full_name`, and `/account/profile` has been served and signed-in for
-- months showing the account's email beside the sentence "This feature works,
-- but saving needs your records connected by an administrator first." There was
-- no form. No route has ever written `full_name`.
--
-- An `avatars` storage bucket is declared in lib/sonara-ecosystem-manifest.cjs
-- and asserted by scripts/verify-production-schema.mjs, and nothing wrote to it.
-- A gate reported it present, every release, truthfully.
--
-- So: three columns on `profiles`, and one new table.
--
-- ## device_permission_grants: a row per decision, not a column per capability
--
-- `public.device_capability_profiles` (migration 015) holds `supports_audio
-- boolean default false` and five more of that shape. The shape cannot express
-- what it is about:
--
--   the person said no   ->  false
--   nobody ever asked    ->  false
--
-- Different facts. "Never asked" is a prompt to show once; "said no" is a prompt
-- never to show again. A column with a default collapses them, and the collapse
-- is silent.
--
-- A grant is a row here. The row says `granted` or `denied`, constrained to
-- exactly those two. **No row means nobody has been asked**, which is the one
-- encoding of three states that cannot decay into two when the next person adds
-- a column with a default. AGENTS.md requires these off by default; absence is
-- the strongest form of off there is.
--
-- The table is keyed on `user_id` and carries no `organization_id`, deliberately.
-- A person's camera is theirs and not their employer's: scoping it to an
-- organization would mean a decision made in one workspace silently applying in
-- another, or being lost on leaving one.

-- ---------------------------------------------------------------------------
-- profiles: the fields a person can set about themselves
-- ---------------------------------------------------------------------------

-- All nullable, all without defaults. "Has not set a name" and "set their name
-- to the empty string" are the same thing to a reader and should be the same
-- thing in the column, so lib/sonara-user-profile.cjs writes null rather than ''
-- and this adds no default that would make an untouched row look answered.
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists headline text,
  add column if not exists bio text,
  add column if not exists avatar_path text;

comment on column public.profiles.display_name is
  'What this person is shown as. Null means they have not set one, which is not the same as blank -- lib/sonara-user-profile.cjs falls back to the email local part and reports which of the two it did.';
comment on column public.profiles.avatar_path is
  'Path inside the avatars bucket, always under person/<user id>/. Never an organization folder: a profile picture belongs to the person, not to a workspace they might leave.';

-- ---------------------------------------------------------------------------
-- device_permission_grants
-- ---------------------------------------------------------------------------

create table if not exists public.device_permission_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  capability text not null,
  -- Two values, and no default. A grant row exists because somebody decided;
  -- there is no third value here because the third state is the absence of the
  -- row. A default would create rows that look like decisions.
  state text not null,
  -- Which device the person was on when they decided. Informational: the
  -- decision applies to the account, because a person who says "no camera"
  -- means it, and asking again on their other phone is the behaviour this table
  -- exists to prevent.
  device_label text,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint device_permission_grants_state_check
    check (state in ('granted', 'denied')),
  constraint device_permission_grants_capability_check
    check (capability in ('camera', 'microphone', 'contacts', 'location', 'local_compute', 'local_storage'))
);

comment on table public.device_permission_grants is
  'One row per decision a person made about one device capability. No row means nobody has asked them, which is a third state and the reason this is not booleans on a profile row.';
comment on column public.device_permission_grants.state is
  'granted or denied only. not_recorded is the absence of a row and is never stored; see lib/sonara-device-permissions.cjs.';

create index if not exists device_permission_grants_user_capability_idx
  on public.device_permission_grants (user_id, capability, decided_at desc);

alter table public.device_permission_grants enable row level security;

-- A person reads and writes their own decisions and nobody else's. There is no
-- organization-wide read: an employer has no business knowing whether somebody
-- turned their microphone off.
drop policy if exists device_permission_grants_self_read on public.device_permission_grants;
create policy device_permission_grants_self_read
  on public.device_permission_grants
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists device_permission_grants_self_insert on public.device_permission_grants;
create policy device_permission_grants_self_insert
  on public.device_permission_grants
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- No update and no delete policy, on purpose. A decision is not edited; a new
-- decision is a new row, and the newest wins. That keeps "they turned it off,
-- then on again" readable instead of overwriting the history of consent, which
-- is the one history worth keeping when somebody later asks why their camera was
-- used.
grant select, insert on public.device_permission_grants to authenticated;

-- And to the service role, which is what the server actually reads with.
--
-- Required because of the Data API hardening: since 18 July 2026 a newly created
-- public table has no legacy grant, so the server cannot read it unless a
-- migration says so. tests/a-table-created-after-the-data-api-hardening-declares-its-surface.test.js
-- caught this one -- without this line routes/sonara-account-profile-routes.cjs
-- would have read an empty list of grants in production and every permission
-- would have read as not_recorded, which is the "absent read as a value" defect
-- arriving through the grant table instead of the column.
--
-- No delete, matching the policies above: a decision is superseded by a newer
-- row, never erased.
grant select, insert on table public.device_permission_grants to service_role;

-- ---------------------------------------------------------------------------
-- Assertions, against the live catalogue
-- ---------------------------------------------------------------------------

do $$
declare
  nullable_count integer;
  state_default text;
  has_org_column boolean;
  stored_states text;
begin
  -- 1. Every new profile column stays nullable. A not-null default here would
  -- make every existing row look like somebody had filled it in.
  select count(*) into nullable_count
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'profiles'
     and column_name in ('display_name', 'headline', 'bio', 'avatar_path')
     and is_nullable = 'YES';
  if nullable_count <> 4 then
    raise exception
      'profiles gained a non-nullable profile column (% of 4 nullable). An unset field must read as unset, not as answered.',
      nullable_count;
  end if;

  -- 2. `state` has no default. A default would let an insert that named no
  -- decision create a row that reads as one.
  select column_default into state_default
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'device_permission_grants'
     and column_name = 'state';
  if state_default is not null then
    raise exception
      'device_permission_grants.state has default %. A grant with a default is a decision nobody made.',
      state_default;
  end if;

  -- 3. No organization_id. A person's camera decision is theirs.
  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'device_permission_grants'
       and column_name = 'organization_id'
  ) into has_org_column;
  if has_org_column then
    raise exception
      'device_permission_grants gained an organization_id. A person''s microphone is not their employer''s to decide.';
  end if;

  -- 4. The check constraint still admits exactly granted and denied. Asserted
  -- against the stored definition rather than trusting the CREATE above, because
  -- `create table if not exists` is a no-op on an existing table -- so on any
  -- database where this table already exists, everything above this line did
  -- nothing and only this block would notice.
  select pg_get_constraintdef(oid) into stored_states
    from pg_constraint
   where conrelid = 'public.device_permission_grants'::regclass
     and conname = 'device_permission_grants_state_check';
  if stored_states is null then
    raise exception 'device_permission_grants has no state check constraint, so state accepts anything.';
  end if;
  if stored_states not like '%granted%' or stored_states not like '%denied%' then
    raise exception 'device_permission_grants state check is now %, which no longer names both decisions.', stored_states;
  end if;
  if stored_states like '%not_recorded%' then
    raise exception
      'device_permission_grants state check admits not_recorded. The absence of a row is how that state is stored; a value for it means two encodings of the same fact and a reader that has to guess.';
  end if;
end $$;
