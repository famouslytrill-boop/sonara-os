-- Which tools an organization's agents may use, on the tenant axis that runs them.
--
-- ## Why this is not entity_agent_tool_registry
--
-- Migration 008 created `public.entity_agent_tool_registry`, and it looks like
-- the answer: it has `tool_name`, `enabled boolean not null default false` and
-- `requires_approval boolean not null default true`. Safe defaults, the right
-- two columns, already in the database.
--
-- Nothing reads them. Measured 1 October 2026: every reference to that table in
-- this repository is a contract list, a subsystem registry or a planning
-- document -- `lib/sonara-database-contract.cjs`,
-- `lib/sonara-tenant-scoped-tables.cjs`, `lib/sonara-subsystem-registry.cjs`,
-- `lib/sonara-market-expansion-registry.cjs`,
-- `lib/sonara-market-expansion-schema-plan.cjs` -- plus
-- `routes/sonara-subsystem-routes.cjs`, whose own comment says "Adding a row to
-- entity_agent_tool_registry registers a tool; it does not run one".
--
-- The reason it cannot simply be wired up is tenancy, and it is the same reason
-- migration 20260813120000 already records for `agent_pending_actions`: the
-- nineteen entity_* tables from 008 key on `entity_id`, and `public.entities`
-- has no `organization_id` column -- read at 008 line 32, it is
-- (id, slug, name, entity_type, description, status, is_public, timestamps).
--
-- `lib/sonara-agent-runner.cjs` runs an action for an `organizationId`. Reading
-- a permission row keyed by `entity_id` to decide whether THAT organization's
-- agent may act would be a cross-tenant authorization read: a check consulting
-- one tenant's row to authorise another's work. That is worse than having no
-- check, because it looks like one. So the registry stays what it is -- an
-- operator-facing research record under /research-lab, admin-gated because it
-- crosses every organization -- and permission lives here, keyed on the tenant
-- the runner actually has.
--
-- ## The defaults, and why absent is not allowed
--
-- `allowed` defaults false and `requires_approval` defaults true, so a row that
-- somebody half-filled grants nothing. AGENTS.md: "Unknown sensitive actions
-- default to owner review."
--
-- An organization with NO rows is a separate state from an organization whose
-- row says no, and `lib/sonara-agent-tool-permissions.cjs` keeps them separate.
-- Treating "no rows" as "deny everything" would turn this migration into an
-- outage for every existing deployment the moment it applied; treating it as
-- "allow everything" would make the table decorative. It means the model is not
-- in force for that organization yet, it is reported rather than assumed, and
-- the authority module continues to govern -- and once an organization has any
-- row at all, a tool with no row is denied.

create table if not exists public.agent_tool_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tool_name text not null,
  allowed boolean not null default false,
  requires_approval boolean not null default true,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, tool_name),
  constraint agent_tool_permissions_tool_name_shape
    check (tool_name = lower(btrim(tool_name)) and length(tool_name) between 1 and 120)
);

create index if not exists agent_tool_permissions_organization_id_idx
  on public.agent_tool_permissions (organization_id);

alter table public.agent_tool_permissions enable row level security;

-- Migration 20260727190000 revoked default privileges on new public objects, so
-- this table is unreachable by every role until it says who may touch it.
--
-- anon and authenticated are deliberately absent: row level security is on with
-- no policy, so those roles are already closed out, and this is the second half
-- of the same decision. A permission table readable by a browser role would
-- publish which tools an organization has turned on.
--
-- No delete. Withdrawing a permission is setting `allowed` to false, which keeps
-- the record of what was once granted and by whom; deleting the row would erase
-- that. Changing a security setting is an owner-approval category in AGENTS.md,
-- and a destructive path should not arrive as a side effect of a grant written
-- today.
grant select, insert, update on table public.agent_tool_permissions to service_role;

do $$
begin
  if to_regclass('public.agent_tool_permissions') is null then
    raise exception 'public.agent_tool_permissions was not created';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_class
    where oid = 'public.agent_tool_permissions'::regclass and relrowsecurity
  ) then
    raise exception 'public.agent_tool_permissions exists without row level security enabled';
  end if;

  -- RLS with no policy is the posture. A policy appearing here is somebody
  -- opening the table to a browser role; fail rather than allow it.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agent_tool_permissions'
  ) then
    raise exception 'public.agent_tool_permissions has a row level security policy; it is meant to be reachable only by the service role';
  end if;

  if not pg_catalog.has_table_privilege('service_role', 'public.agent_tool_permissions', 'SELECT') then
    raise exception 'service_role cannot read public.agent_tool_permissions; the runner could not evaluate tool permissions and every unattended action would report the model as unreadable';
  end if;

  if not pg_catalog.has_table_privilege('service_role', 'public.agent_tool_permissions', 'INSERT') then
    raise exception 'service_role cannot write public.agent_tool_permissions; no permission could ever be granted';
  end if;

  if not pg_catalog.has_table_privilege('service_role', 'public.agent_tool_permissions', 'UPDATE') then
    raise exception 'service_role cannot update public.agent_tool_permissions; a granted permission could never be withdrawn';
  end if;

  -- Stated as an assertion rather than trusted to the revoke above, because a
  -- later migration granting broadly across public would reopen this quietly.
  if pg_catalog.has_table_privilege('anon', 'public.agent_tool_permissions', 'SELECT')
     or pg_catalog.has_table_privilege('authenticated', 'public.agent_tool_permissions', 'SELECT') then
    raise exception 'public.agent_tool_permissions is readable by a browser role; which tools an organization has enabled is not public';
  end if;

  -- Checked rather than assumed: a delete privilege arriving later would make
  -- the "withdrawing is an update" claim in the comment above false while the
  -- comment still read as current.
  if pg_catalog.has_table_privilege('service_role', 'public.agent_tool_permissions', 'DELETE') then
    raise exception 'service_role can delete from public.agent_tool_permissions; withdrawing a permission is an update and no delete path was meant to exist';
  end if;

  -- The organization column is the tenant boundary and the entire reason this
  -- table exists rather than entity_agent_tool_registry being wired up. With no
  -- policy on the table, a null here would be a permission row no organization
  -- owns, and every read filters by organization_id.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agent_tool_permissions'
      and column_name = 'organization_id' and is_nullable = 'YES'
  ) then
    raise exception 'public.agent_tool_permissions.organization_id is nullable; a permission row with no organization is a row nothing can scope';
  end if;

  -- Both defaults are the safe direction, and both are asserted because a later
  -- migration altering either would silently turn a half-filled row into a
  -- grant. `allowed` false and `requires_approval` true mean an inserted row
  -- that nobody finished permits nothing.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agent_tool_permissions'
      and column_name = 'allowed' and column_default = 'false'
  ) then
    raise exception 'public.agent_tool_permissions.allowed does not default to false; a half-filled row would grant a tool';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agent_tool_permissions'
      and column_name = 'requires_approval' and column_default = 'true'
  ) then
    raise exception 'public.agent_tool_permissions.requires_approval does not default to true; a half-filled row would run unattended';
  end if;

  -- One tool name per organization. Without this, two rows could disagree about
  -- the same tool and which one the runner read would depend on row order.
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.agent_tool_permissions'::regclass
      and contype = 'u'
      and conkey @> array[
        (select attnum from pg_catalog.pg_attribute where attrelid = 'public.agent_tool_permissions'::regclass and attname = 'organization_id'),
        (select attnum from pg_catalog.pg_attribute where attrelid = 'public.agent_tool_permissions'::regclass and attname = 'tool_name')
      ]::smallint[]
  ) then
    raise exception 'public.agent_tool_permissions has no unique constraint on (organization_id, tool_name); two rows could disagree about the same tool';
  end if;
end $$;
