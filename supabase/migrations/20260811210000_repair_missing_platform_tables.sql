-- Production is missing two tables that 010_sonara_platform_current_schema.sql
-- creates, and it has not been able to deploy since 5 August 2026 because of it.
--
-- ## What this is fixing
--
-- Every Controlled Production Deployment from run #111 to #124 -- fourteen in a
-- row, covering pull requests #192 to #205 -- failed on the first pending
-- migration:
--
--     Applying migration 20260811220000_customer_invoices_accounts_receivable.sql...
--     ERROR: relation "public.quotes" does not exist (SQLSTATE 42P01)
--
-- `customer_invoices` declares `quote_id uuid references public.quotes(id)`, and
-- production has no `public.quotes`. The repository does: it is created at line
-- 197 of `010_sonara_platform_current_schema.sql`, and
-- `pnpm run verify:migration-replay` builds a working schema from all 108
-- migrations on every release. Production's own migration history says `010` is
-- applied and the table is not there -- which is what happens when an existing
-- database is adopted into the Supabase CLI and its early migrations are marked
-- applied rather than run. The file name says so: "current schema" is what
-- somebody writes to describe a database that already exists.
--
-- ## Why this file and not a re-run of 010
--
-- Re-running `010` would be the obvious move and it would be wrong. Every
-- statement in it is `create table if not exists` or `enable row level
-- security`, so it is idempotent -- but it creates **`billing_customers`**,
-- which `20260805120000_retire_superseded_tables.sql` deliberately retired.
-- Replaying the whole file would resurrect a table somebody decided to remove.
--
-- So this creates only what is needed, and nothing that was retired.
--
-- ## Why these two tables
--
-- The 31 migrations pending on production reference four tables that `010`
-- creates and that are not on the retired list: `organizations`, `profiles`,
-- `customers` and `quotes`.
--
-- `organizations` and `profiles` are not in doubt. Every query this application
-- makes filters on `organization_id`, and the site has been serving customers
-- against this database for a month; if `organizations` were missing, nothing
-- would work at all.
--
-- `quotes` is the proven gap -- it is the table named in the error.
-- `customers` is here because `quotes` references it. If `customers` is also
-- missing, creating `quotes` alone would fail on the same class of error one
-- line later, and this file would have to be written twice.
--
-- Both are `create table if not exists`, so on a database that has them this
-- migration does nothing at all. That is the point: it cannot be wrong about a
-- table that is already there.
--
-- ## What this does not promise
--
-- It fixes the failure that has been observed fourteen times. It cannot promise
-- there is no second gap further down the pending list, because nothing in this
-- repository can read production's schema -- `verify-migration-replay` runs
-- against an empty database, which is exactly why it stayed green throughout.
-- `docs/owner/OWNER-STEPS.md` step 8 has the two queries that say what
-- production actually has.
--
-- The definitions below are copied verbatim from 010, columns and defaults
-- unchanged, so a database that applies both ends up in one state rather than
-- two.

create extension if not exists "pgcrypto";

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  status text not null default 'active',
  source text,
  tags text[] not null default '{}',
  communication_preference text not null default 'unknown',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  title text not null,
  amount_cents integer,
  status text not null default 'draft',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- Enabling row level security on a table that already has it is a no-op, so
-- this is safe on the database that has these tables and necessary on the one
-- that does not. Both tables are organization-scoped and every read this
-- application makes uses the service-role key, which bypasses RLS entirely --
-- so this is the second line of defence rather than the first, and leaving it
-- off on a freshly created table would be strictly worse than 010's own state.
alter table public.customers enable row level security;
alter table public.quotes enable row level security;
