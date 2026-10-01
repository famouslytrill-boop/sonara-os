-- The management passcode: one credential per business, hashed, never readable.
--
-- ## What it is for
--
-- `requireBusinessManager` in server.js proves a valid customer session plus an
-- active `owner` or `manager` row in `business_memberships`. Both are
-- properties of the browser. The session cookie lives an hour and the refresh
-- cookie renews it for thirty days, so for up to a month whoever holds the
-- browser holds every employee record, wage rate, pay statement and the time
-- clock, with nothing further to know.
--
-- This table holds the thing that is not in the browser.
--
-- ## Hashed, not encrypted
--
-- `passcode_hash` is a scrypt digest of an HMAC taken under a pepper that
-- lives in `SONARA_TOTP_KEY` -- in the deployment environment, never in this
-- database. Two consequences worth stating because both are the point:
--
--   * Nobody can read a passcode back out of this table, including SONARA.
--     There is no recovery, only replacement. The owner sets a new one.
--   * A disclosure of this database alone yields nothing usable. Guessing
--     needs the environment too, which is a second and different compromise.
--
-- See lib/sonara-business-passcode.cjs for the construction and why scrypt is
-- right here when lib/sonara-secret-box.cjs rejected it for recovery codes:
-- a recovery code is ninety-six random bits and slow hashing buys nothing; a
-- passcode is chosen by a person and slow hashing is the whole defence.

create table if not exists public.business_management_credentials (
  id uuid primary key default gen_random_uuid(),
  -- One per business, enforced here rather than by the route remembering to
  -- check. Two credential rows for one organization is a state where which
  -- passcode works depends on row order.
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  passcode_hash text not null,
  -- Counted up by a wrong answer and reset by a right one. Five wrong answers
  -- sets locked_until; see MAXIMUM_FAILURES in lib/sonara-business-passcode.cjs.
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  last_verified_at timestamptz,
  -- Who set it. Not who may use it: every active owner or manager of the
  -- organization unlocks with the same passcode, which is what makes it the
  -- business's credential rather than one person's.
  set_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Moved on every change of the passcode. lib/sonara-business-passcode.cjs
  -- signs each unlock token over this value, so changing the passcode stops
  -- every unlock already handed out from verifying -- on every device, at
  -- once. That is what makes a change a way to remove somebody's access
  -- rather than a note that takes effect whenever they next sign in.
  updated_at timestamptz not null default now()
);

create index if not exists business_management_credentials_org_idx
  on public.business_management_credentials (organization_id);

alter table public.business_management_credentials enable row level security;

-- No policy is created, deliberately. Every read and write goes through the
-- server with the service role, which is the only context that holds the
-- pepper the hash is useless without. Row level security on with no policy
-- means an anon or authenticated client reading this table directly gets
-- nothing -- which is the correct answer for a table of credential material.

comment on table public.business_management_credentials is
  'One management passcode per business, scrypt-hashed under an environment-held pepper. Gates employee, time-clock and payroll operations behind something the owner knows rather than something the browser holds. Not recoverable -- see lib/sonara-business-passcode.cjs.';

comment on column public.business_management_credentials.passcode_hash is
  'scrypt(HMAC(pepper, passcode), salt), formatted v1.scrypt.<N>.<r>.<p>.<salt>.<hash> in base64url. The parameters travel with the row so raising the cost later leaves existing rows verifiable instead of locking their owners out.';

comment on column public.business_management_credentials.updated_at is
  'Also the unlock-token version. Every outstanding unlock is signed over this value and stops verifying when it moves.';

-- Declare the Data API surface.
--
-- Migration 20260727190000 revoked default privileges on new public objects, so
-- a table created after it is unreachable by every role until it says who may
-- touch it. Without these grants the server could not read its own credential
-- table, and the gate in routes/sonara-business-security-routes.cjs would refuse
-- every unlock with `credential_unreadable` -- failing closed, which is the
-- right direction and still completely broken.
--
-- anon and authenticated are deliberately absent. Row level security is on with
-- no policy, so those roles are already closed out, and this is the second half
-- of the same decision: a passcode hash has no browser-readable use, and no
-- client should be able to write one.
--
-- No delete. Removing a business's credential row would silently reopen the
-- protected surfaces, because the gate reads an absent row as "no passcode set".
-- Replacing a passcode is an update; withdrawing one is a decision with a
-- consequence, and when it is built it gets its own reviewed path rather than
-- arriving as a side effect of a grant written today.
grant select, insert, update on table public.business_management_credentials to service_role;

do $$
begin
  if to_regclass('public.business_management_credentials') is null then
    raise exception 'public.business_management_credentials was not created';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_class
    where oid = 'public.business_management_credentials'::regclass and relrowsecurity
  ) then
    raise exception 'public.business_management_credentials exists without row level security enabled';
  end if;

  -- RLS with no policy is the posture, so a policy appearing here is somebody
  -- opening a credential table to a browser role. Fail rather than allow it.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'business_management_credentials'
  ) then
    raise exception 'public.business_management_credentials has a row level security policy; it is meant to be reachable only by the service role';
  end if;

  if not pg_catalog.has_table_privilege('service_role', 'public.business_management_credentials', 'SELECT') then
    raise exception 'service_role cannot read public.business_management_credentials; the Data API surface was not declared and no passcode could be verified';
  end if;

  if not pg_catalog.has_table_privilege('service_role', 'public.business_management_credentials', 'INSERT') then
    raise exception 'service_role cannot write public.business_management_credentials; no passcode could be set';
  end if;

  if not pg_catalog.has_table_privilege('service_role', 'public.business_management_credentials', 'UPDATE') then
    raise exception 'service_role cannot update public.business_management_credentials; a wrong answer could not be counted and the lockout would never engage';
  end if;

  -- anon and authenticated must stay out. Stated as an assertion rather than
  -- trusted to the revoke above, because a later migration granting broadly
  -- across public would reopen this one quietly.
  if pg_catalog.has_table_privilege('anon', 'public.business_management_credentials', 'SELECT')
     or pg_catalog.has_table_privilege('authenticated', 'public.business_management_credentials', 'SELECT') then
    raise exception 'public.business_management_credentials is readable by a browser role; passcode hashes must not be on the Data API surface';
  end if;

  -- The uniqueness that stops a business having two passcodes, where which one
  -- works depends on row order.
  if not exists (
    select 1 from pg_catalog.pg_indexes
    where schemaname = 'public' and tablename = 'business_management_credentials'
      and indexdef ilike '%unique%' and indexdef ilike '%organization_id%'
  ) then
    raise exception 'public.business_management_credentials has no unique index on organization_id';
  end if;
end $$;
