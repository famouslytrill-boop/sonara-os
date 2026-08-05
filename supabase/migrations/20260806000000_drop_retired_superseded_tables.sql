-- Drop the thirteen superseded tables, if they are empty.
--
-- 20260805120000_retire_superseded_tables.sql moved them out of public into the
-- `retired` schema rather than dropping them, because nothing in this repository
-- could establish whether they held rows and a migration that assumes they are
-- empty destroys data if they are not. It recorded the count it found in each
-- table's comment.
--
-- This reads that back. A table that was empty when it moved is dropped. A table
-- that held rows is left alone and named in a notice, because "drop the thirteen"
-- was a decision about tables believed to be dead duplicates, not a decision to
-- destroy rows nobody has looked at. If one of them does hold data, that is worth
-- knowing before it goes: something wrote to a table the application never reads.
--
-- To drop them anyway, once the counts have been seen:
--
--   set sonara.drop_retired_with_rows = 'yes';
--
-- before running. It defaults to unset, so the safe path is the one that happens
-- without anybody choosing it.
--
-- Replay-safe: a table already dropped is skipped, and so is one that was never
-- created.

do $$
declare
  superseded constant text[] := array[
    'audit_events',
    'permission_audit_logs',
    'billing_customers',
    'sonara_billing_customers',
    'sonara_subscriptions',
    'contact_records',
    'contact_import_batches',
    'communication_preferences',
    'permission_grants',
    'sonara_permission_matrix',
    'open_source_tools',
    'organization_integrations',
    'integration_statuses'
  ];
  source_table text;
  live_rows bigint;
  force_drop boolean := coalesce(current_setting('sonara.drop_retired_with_rows', true), '') = 'yes';
  dropped integer := 0;
  kept integer := 0;
begin
  foreach source_table in array superseded loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'retired' and table_name = source_table
    ) then
      raise notice 'drop: retired.% is not present, skipping', source_table;
      continue;
    end if;

    -- Counted now rather than trusted from the comment. The comment records what
    -- was there when it moved; this is what is there at the moment of dropping,
    -- and that is the number that matters.
    execute format('select count(*) from retired.%I', source_table) into live_rows;

    if live_rows > 0 and not force_drop then
      kept := kept + 1;
      raise warning 'drop: retired.% holds % rows and was NOT dropped. Something wrote to a table the application never reads. Review it, then set sonara.drop_retired_with_rows to ''yes'' to drop anyway.', source_table, live_rows;
      continue;
    end if;

    execute format('drop table retired.%I cascade', source_table);
    dropped := dropped + 1;
    raise notice 'drop: retired.% dropped (% rows)', source_table, live_rows;
  end loop;

  raise notice 'drop: % dropped, % kept because they hold rows', dropped, kept;

  -- Only when nothing is left. A schema kept around empty is a place for the
  -- next retirement to land; a schema dropped while still holding a table would
  -- take that table with it.
  if not exists (select 1 from information_schema.tables where table_schema = 'retired') then
    raise notice 'drop: retired schema is empty and stays, ready for the next retirement';
  end if;
end
$$;
