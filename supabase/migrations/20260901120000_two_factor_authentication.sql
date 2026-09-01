-- A second factor, and the thing that makes it one.
--
-- Until now this application had no second factor of any kind. A password was
-- the whole of the credential, and `lib/sonara-otp.cjs` -- HOTP and TOTP built
-- from RFC 4226 and RFC 6238, with the specifications' own test vectors under
-- it -- is the arithmetic that changes that.
--
-- Three tables, and the third is the one that makes the feature real rather
-- than decorative.
--
-- ## Why a pending challenge table exists at all
--
-- Sign-in here exchanges an email and password with Supabase for an access
-- token, and `sendEmailAuthResult` sets that token as a session cookie the
-- moment it comes back. A second factor asked for **after** that point is a
-- form somebody can navigate away from: they already hold a working session.
--
-- So when an account has a confirmed factor, the tokens are not given to the
-- browser. They are sealed and parked here, and the browser is handed an opaque
-- id. Only a correct code -- or a recovery code -- exchanges that id for the
-- session. The row is single use, expires in minutes, and counts its own failed
-- attempts, none of which a cookie held by the person being challenged could do.
--
-- ## What is not stored in the clear
--
-- **Not the TOTP secret.** It is sealed by `lib/sonara-secret-box.cjs` under a
-- key that lives in the environment, so reading this table gives an attacker
-- ciphertext and nothing they can produce codes with. The service role key
-- bypasses row level security, so "the database is readable by the server" is
-- the normal case rather than the breach -- which is the reason sealing is
-- worth doing at all.
--
-- **Not the recovery codes.** HMAC-SHA-256 under a pepper derived from the same
-- environment key, with a per-code salt.
--
-- **Not the session tokens.** Sealed the same way, and the challenge id the
-- browser holds is stored as a digest, so this table cannot be read to obtain
-- a live challenge either.

-- ---------------------------------------------------------------------------
-- The enrolled factor.
-- ---------------------------------------------------------------------------

create table if not exists public.user_auth_factors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- One kind today. The check constraint is what makes a second kind arrive as
  -- a migration rather than as an unrecognised string nothing validates.
  factor_type text not null default 'totp' check (factor_type in ('totp')),

  -- The shared secret, sealed. Never the raw bytes, and never base32: the
  -- encoding belongs to the URI handed to the phone, not to storage.
  sealed_secret text not null,

  -- Null until the person has proved the phone works by typing a code from it.
  -- An unconfirmed factor must never be able to lock somebody out, which is why
  -- this is a timestamp rather than the row's existence.
  confirmed_at timestamptz,

  -- The last time step accepted for this factor.
  --
  -- RFC 6238 section 5.2: a validator must not accept the same code twice
  -- inside its window. Without this column a code read over somebody's shoulder
  -- -- or out of a screenshot, or a support screen share -- is good for the
  -- rest of its thirty seconds.
  last_used_step bigint,

  created_at timestamptz not null default now(),
  disabled_at timestamptz
);

-- One live factor per person.
--
-- Partial, on purpose: a disabled factor stays as a row, so turning two-factor
-- off and on again does not lose the record that it was once on, and a person
-- can still only have one authenticator at a time.
create unique index if not exists user_auth_factors_one_live_idx
  on public.user_auth_factors (user_id, factor_type)
  where disabled_at is null;

-- ---------------------------------------------------------------------------
-- Recovery codes.
-- ---------------------------------------------------------------------------

create table if not exists public.user_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  factor_id uuid references public.user_auth_factors(id) on delete cascade,

  -- Per code, so two people with the same code -- which cannot happen, but the
  -- construction should not depend on that -- do not share a hash.
  salt text not null,
  hash text not null,

  -- Single use. Kept as a timestamp rather than deleted, so somebody looking at
  -- their account can be told how many are left and when the others went.
  used_at timestamptz,

  created_at timestamptz not null default now()
);

create index if not exists user_recovery_codes_user_idx
  on public.user_recovery_codes (user_id, used_at);

-- ---------------------------------------------------------------------------
-- The sign-in held back until the second factor is proved.
-- ---------------------------------------------------------------------------

create table if not exists public.pending_auth_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- The digest of the id the browser holds, never the id itself. A read of this
  -- table is then not a way to continue somebody else's half-finished sign-in.
  token_hash text not null unique,

  -- The Supabase access and refresh tokens, sealed. These are what the browser
  -- would have been given straight away without a second factor, and parking
  -- them here rather than in a cookie is the whole point: an unfinished
  -- challenge grants nothing.
  sealed_session text not null,

  -- Minutes, not hours. A challenge that outlives the person's patience is a
  -- window somebody else can walk through.
  expires_at timestamptz not null,

  -- Counted server side, because a counter the browser holds is a counter the
  -- browser can reset. RFC 4226 section 7.3 asks a validator to throttle.
  attempts integer not null default 0,

  -- Single use, and recorded rather than deleted so a replayed id is refused
  -- as spent rather than as unknown.
  consumed_at timestamptz,

  created_at timestamptz not null default now()
);

create index if not exists pending_auth_challenges_expiry_idx
  on public.pending_auth_challenges (expires_at);

-- ---------------------------------------------------------------------------
-- Row level security.
-- ---------------------------------------------------------------------------
--
-- Enabled with no policies, matching push_subscriptions, call_sessions and
-- record_change_log. Every route reading these goes through the service role
-- and filters on the signed-in person's own id.
--
-- There must never be a policy that lets a signed-in user select from
-- user_auth_factors. Even sealed, a person's own row is not something the
-- browser needs, and a table holding every second factor on the system is the
-- last one to widen.
alter table public.user_auth_factors enable row level security;
alter table public.user_recovery_codes enable row level security;
alter table public.pending_auth_challenges enable row level security;

comment on table public.user_auth_factors is
  'One enrolled second factor per person. The TOTP shared secret is sealed by lib/sonara-secret-box.cjs under an environment key and is never stored in the clear. last_used_step is what stops a code being accepted twice, as RFC 6238 section 5.2 requires.';

comment on table public.user_recovery_codes is
  'Single-use codes for somebody who has lost their authenticator. Stored as HMAC-SHA-256 under a pepper held outside the database, with a per-code salt; never in the form they were shown.';

comment on table public.pending_auth_challenges is
  'A sign-in whose password was correct and whose session has not been granted yet. Holds the Supabase tokens sealed, keyed by the digest of an opaque id the browser holds, so an unfinished second-factor challenge grants nothing.';
