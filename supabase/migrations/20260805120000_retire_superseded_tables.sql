-- Retire the thirteen tables superseded by a live table under another name.
--
-- lib/sonara-orphan-tables.cjs classifies every table the application never
-- queries. Thirteen of them are earlier generations of tables that are live
-- under a different name, and they are the ones that actively mislead: open the
-- database, look for the workspace you expect, and the table with the obvious
-- name is there and empty -- and always will be, because the application writes
-- somewhere else.
--
-- This moves them to a `retired` schema rather than dropping them.
--
-- Dropping is what the audit proposed and it is the wrong first step. Nothing in
-- this repository can establish whether these tables hold rows -- the production
-- project is not reachable from here, and a migration that assumes they are
-- empty is a migration that silently destroys data if they are not. Moving them
-- achieves everything the retirement was for:
--
--   they leave `public`, so PostgREST stops exposing them entirely;
--   the schema stops offering a `customers` table beside `customer_records`;
--   every row is still there, under the same table name, one rename from being
--     restored.
--
-- Each table records what replaced it in a comment, so somebody who finds a
-- retired table knows where its data lives now.
--
-- Dropping them for real is a second migration, written once somebody has looked
-- at the row counts this one records. That is a deliberate two-step: the
-- reversible half is safe to run unattended, and the irreversible half should
-- never be.

create schema if not exists retired;
comment on schema retired is
  'Tables superseded by a live table under another name. Moved out of public rather than dropped, so PostgREST stops exposing them and no data is lost. See lib/sonara-orphan-tables.cjs.';

-- Nothing reads this schema. Row level security stays enabled on whatever moves
-- here, and no policy is granted, so the service key is the only way in.
revoke all on schema retired from anon, authenticated;

do $$
declare
  -- table name, what replaced it
  superseded constant text[][] := array[
    ['audit_events', 'admin_audit_logs'],
    ['permission_audit_logs', 'admin_audit_logs'],
    ['billing_customers', 'stripe_customers'],
    ['sonara_billing_customers', 'stripe_customers'],
    ['sonara_subscriptions', 'billing_subscriptions'],
    ['contact_records', 'customer_records'],
    ['contact_import_batches', 'growth_leads'],
    ['communication_preferences', 'user_preferences'],
    ['permission_grants', 'user_roles'],
    ['sonara_permission_matrix', 'user_roles'],
    ['open_source_tools', 'data/open-source-tools.ts, rendered at /research-lab/open-source'],
    ['organization_integrations', 'integration_providers'],
    ['integration_statuses', 'integration_jobs']
  ];
  entry text[];
  source_table text;
  successor text;
  row_count bigint;
begin
  foreach entry slice 1 in array superseded loop
    source_table := entry[1];
    successor := entry[2];

    -- Skip anything already moved or never created. This migration has to be
    -- safe to replay, like every other one here.
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = source_table
    ) then
      raise notice 'retire: public.% is not present, skipping', source_table;
      continue;
    end if;

    if exists (
      select 1 from information_schema.tables
      where table_schema = 'retired' and table_name = source_table
    ) then
      raise notice 'retire: retired.% already exists, leaving public.% alone', source_table, source_table;
      continue;
    end if;

    -- Recorded so the follow-up drop is a decision about a known quantity
    -- rather than a guess. A superseded table holding rows is the interesting
    -- case: it means something wrote to it, and that is worth understanding
    -- before anybody deletes it.
    execute format('select count(*) from public.%I', source_table) into row_count;
    raise notice 'retire: moving public.% (% rows) -- superseded by %', source_table, row_count, successor;

    execute format('alter table public.%I set schema retired', source_table);
    execute format(
      'comment on table retired.%I is %L',
      source_table,
      format('Retired %s. Superseded by %s. Held %s rows when moved out of public. Nothing reads this table.',
             to_char(now(), 'YYYY-MM-DD'), successor, row_count)
    );
  end loop;
end
$$;
