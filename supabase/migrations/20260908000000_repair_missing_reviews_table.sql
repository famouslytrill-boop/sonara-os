-- Production is missing public.reviews, which 010_sonara_platform_current_schema
-- creates and lib/sonara-customer-journey.cjs reads.
--
-- Deployment #132 -- the first to get past the catalog boundary and the
-- retirement contract -- reported exactly one remaining fault:
--
--     Supabase deep verification failed (1):
--     - active application table is missing from production: public.reviews
--
-- ## The same root cause as 20260811210000, and the same reason it was missed
--
-- That migration's own comment records why production lacks tables its history
-- says it has:
--
--   "Production's own migration history says `010` is applied and the table is
--    not there -- which is what happens when an existing database is adopted
--    into the Supabase CLI and its early migrations are marked applied rather
--    than run."
--
-- It then repaired only the tables that *other pending migrations referenced* --
-- `quotes` and the rest, found by scanning for names that later migrations
-- alter, index or point a foreign key at without creating. Nothing in the
-- repository references `public.reviews`. No later migration touches it at all;
-- 010 is the only file that names it. So it fell outside that search and stayed
-- missing, and no deployment could say so until the eight faults ahead of it in
-- the report were cleared.
--
-- ## Not cosmetic
--
-- `lib/sonara-customer-journey.cjs` reads `reviews` through the service-role
-- client, and `lib/sonara-tenant-scoped-tables.cjs` lists it as tenant-scoped.
-- A table the runtime queries and the database does not have is a 42P01 waiting
-- for the first customer who reaches that path.
--
-- ## Why not re-run 010
--
-- The same reason 20260811210000 gave: 010 also creates `billing_customers`,
-- which 20260805120000 deliberately retired, and replaying the file would
-- resurrect a table somebody decided to remove. This creates one table.
--
-- The definition is copied from 010 lines 235-247 unchanged, so a database
-- repaired here and a database built by replay agree. `create table if not
-- exists` because a database that already has it -- every replay, every preview
-- branch -- must be left alone.
--
-- The grant is not optional and not decoration: this migration is dated after
-- 20260718064853_data_api_privilege_hardening, which revoked default privileges
-- so new public objects are opt-in. A table created here without a declared
-- surface lands unreadable by the server, which is the fault that took five
-- tables down in deployment #131.
-- tests/a-new-table-declares-its-data-api-surface.test.js enforces that offline.
--
-- No customer data is modified by this migration.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  source text,
  status text not null default 'draft',
  rating integer,
  body text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.reviews enable row level security;

-- Declare the Data API surface. anon and authenticated are deliberately not
-- granted: RLS is on with no policy, so the table stays closed to every
-- non-bypass role, which is what 010 intended.
grant select, insert, update, delete on table public.reviews to service_role;

comment on table public.reviews is
  'Customer reviews, organization-scoped. Created by 010 and absent from production until this repair; read by lib/sonara-customer-journey.cjs through the service role.';

do $$
begin
  if to_regclass('public.reviews') is null then
    raise exception 'public.reviews was not created; the repair did not take';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_class
    where oid = 'public.reviews'::regclass and relrowsecurity
  ) then
    raise exception 'public.reviews exists without row level security enabled';
  end if;
  if not pg_catalog.has_table_privilege('service_role', 'public.reviews', 'SELECT') then
    raise exception 'service_role cannot read public.reviews after the grant';
  end if;
end $$;

NOTIFY pgrst, 'reload schema';
