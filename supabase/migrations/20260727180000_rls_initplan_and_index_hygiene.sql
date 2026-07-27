-- HIGH-1: RLS initplan rewrite, duplicate index removal, and cascade foreign
-- key indexing.
--
-- WHY NOW, AND WHAT THIS IS NOT
--
-- Production currently holds 200 live rows across 346 tables; 14 tables have
-- any rows at all and the largest has 34. So none of this fixes a measured
-- bottleneck -- there is no load to be slow under yet.
--
-- It is done now because this is the cheapest and safest moment to do it:
-- altering 300+ policies and building indexes is instant and risk-free on empty
-- tables, and becomes a scheduled change-management exercise (CONCURRENTLY,
-- lock windows, rehearsal) once real data lands. The benefit is realised later;
-- the cost of doing it is lowest today.
--
-- Scope was set from evidence, not from the advisor's raw output:
--   * 511 foreign keys lack a covering index, but only 5 are on tables with any
--     rows. Indexing all 511 would add write amplification across 346 tables to
--     serve queries that do not exist, and the same database already carries
--     191 indexes the advisor reports as unused. This migration indexes the
--     218 ON DELETE CASCADE keys instead -- those cause a sequential scan of
--     every child table on parent delete regardless of table size, which is a
--     structural footgun rather than a speculative optimisation -- plus the 5
--     on tables that hold rows.
--   * The remaining ~288 non-cascade foreign keys are deliberately deferred
--     until query evidence justifies them.
--
-- No customer data is modified by this migration.

-- ---------------------------------------------------------------------------
-- 1. auth_rls_initplan: evaluate auth.*() once per query, not once per row.
-- ---------------------------------------------------------------------------
--
-- The Supabase linter reports 312 policies across 228 tables that re-evaluate
-- auth.uid()/auth.role()/auth.jwt() for every row scanned. Wrapping the call in
-- a scalar subquery lets the planner fold it into an InitPlan evaluated once.
-- The codebase already does this correctly in is_admin_or_founder(); this
-- applies the same pattern uniformly.
--
-- Rewriting is textual, so already-wrapped calls are protected first: 18
-- policies are already in the "( SELECT auth.uid() AS uid)" form, and a naive
-- replace would nest them. PostgreSQL regex has no lookbehind, hence the
-- placeholder swap rather than a negative-lookbehind pattern.
--
-- Verified before writing: zero policies in this schema use current_setting(),
-- so only the auth.* helpers need handling.

-- The rewrite is expressed in the driving query rather than a helper function,
-- so the migration creates no temporary objects and the transformation is
-- visible in one place. The three placeholder swaps protect calls that are
-- already inside a scalar subquery -- 18 policies are already in the
-- "( SELECT auth.uid() AS uid)" form, and a naive replace would nest them.
-- PostgreSQL regex has no lookbehind, hence placeholders rather than a
-- negative-lookbehind pattern. replace() propagates NULL, so a policy with no
-- USING or no WITH CHECK keeps that side NULL.
do $$
declare
  policy_record record;
  new_qual text;
  new_check text;
  rewritten integer := 0;
begin
  for policy_record in
    select
      p.schemaname,
      p.tablename,
      p.policyname,
      p.qual,
      p.with_check,
      replace(replace(replace(
        replace(replace(replace(
          replace(replace(replace(p.qual,
            'SELECT auth.uid()', '@@U@@'), 'SELECT auth.role()', '@@R@@'), 'SELECT auth.jwt()', '@@J@@'),
          'auth.uid()', '(select auth.uid())'), 'auth.role()', '(select auth.role())'), 'auth.jwt()', '(select auth.jwt())'),
        '@@U@@', 'SELECT auth.uid()'), '@@R@@', 'SELECT auth.role()'), '@@J@@', 'SELECT auth.jwt()') as rewritten_qual,
      replace(replace(replace(
        replace(replace(replace(
          replace(replace(replace(p.with_check,
            'SELECT auth.uid()', '@@U@@'), 'SELECT auth.role()', '@@R@@'), 'SELECT auth.jwt()', '@@J@@'),
          'auth.uid()', '(select auth.uid())'), 'auth.role()', '(select auth.role())'), 'auth.jwt()', '(select auth.jwt())'),
        '@@U@@', 'SELECT auth.uid()'), '@@R@@', 'SELECT auth.role()'), '@@J@@', 'SELECT auth.jwt()') as rewritten_check
    from pg_policies p
    where p.schemaname = 'public'
    order by p.tablename, p.policyname
  loop
    new_qual := policy_record.rewritten_qual;
    new_check := policy_record.rewritten_check;

    -- Only touch policies that actually change.
    if new_qual is not distinct from policy_record.qual
       and new_check is not distinct from policy_record.with_check then
      continue;
    end if;

    -- USING and WITH CHECK must be supplied only where the policy already has
    -- them: a SELECT/DELETE policy has no WITH CHECK, and an INSERT policy has
    -- no USING (29 such policies exist here).
    if new_qual is not null and new_check is not null then
      execute format(
        'alter policy %I on %I.%I using (%s) with check (%s)',
        policy_record.policyname, policy_record.schemaname, policy_record.tablename, new_qual, new_check
      );
    elsif new_qual is not null then
      execute format(
        'alter policy %I on %I.%I using (%s)',
        policy_record.policyname, policy_record.schemaname, policy_record.tablename, new_qual
      );
    else
      execute format(
        'alter policy %I on %I.%I with check (%s)',
        policy_record.policyname, policy_record.schemaname, policy_record.tablename, new_check
      );
    end if;

    rewritten := rewritten + 1;
  end loop;

  raise notice 'Wrapped per-row auth calls in % policies.', rewritten;
end $$;

-- Assert the rewrite is complete: no policy may still call auth.*() outside a
-- scalar subquery. Any bare call left here would keep its per-row cost.
do $$
declare
  offending text;
begin
  select string_agg(tablename || '.' || policyname, ', ' order by tablename, policyname)
    into offending
  from pg_policies
  where schemaname = 'public'
    and replace(
          replace(
            replace(coalesce(qual, '') || ' ' || coalesce(with_check, ''),
              'SELECT auth.uid()', ''),
            'SELECT auth.role()', ''),
          'SELECT auth.jwt()', '')
        ~ 'auth\.(uid|role|jwt)\(\)';

  if offending is not null then
    raise exception 'Policies still evaluate auth.*() per row: %', offending;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Duplicate indexes.
-- ---------------------------------------------------------------------------
--
-- Four identical index pairs, each costing a second write on every insert and
-- update for no read benefit. The surviving name in each pair is the one the
-- schema's own migrations create; the dropped name is the redundant alias.
-- business_memberships_workspace_id_user_id_key backs a unique constraint, so
-- the plain index is the one to drop.

drop index if exists public.business_memberships_workspace_user_key;
drop index if exists public.sonara_user_subscriptions_customer_idx;
drop index if exists public.sonara_user_subscriptions_subscription_idx;
drop index if exists public.sonara_user_subscriptions_user_idx;

-- ---------------------------------------------------------------------------
-- 3. Covering indexes for ON DELETE CASCADE foreign keys.
-- ---------------------------------------------------------------------------
--
-- Without a covering index, deleting one parent row forces a sequential scan of
-- every child table to find rows to cascade. With organizations as the parent
-- of dozens of child tables, a single organization delete degrades into a full
-- scan of each one. That is true at any table size, which is why these are
-- indexed now and the non-cascade keys are not.
--
-- Generated from the catalog rather than hand-listed: 218 constraints is beyond
-- what a reviewer can meaningfully check line by line, and a generated loop
-- cannot drift from the constraints actually present.

do $$
declare
  fk record;
  index_name text;
  column_list text;
  created integer := 0;
begin
  for fk in
    select
      c.conname,
      t.relname as table_name,
      (
        select array_agg(a.attname order by k.ord)
        from unnest(c.conkey) with ordinality k(attnum, ord)
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
      ) as columns,
      c.confdeltype,
      coalesce(st.n_live_tup, 0) as live_rows,
      c.conrelid
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    left join pg_stat_user_tables st on st.relid = c.conrelid
    where c.contype = 'f'
      and n.nspname = 'public'
    order by t.relname, c.conname
  loop
    -- Scope: cascade deletes, plus anything on a table that already holds rows.
    if fk.confdeltype <> 'c' and fk.live_rows = 0 then
      continue;
    end if;

    -- Skip when an existing index already covers the key as a leading prefix.
    if exists (
      select 1
      from pg_index i
      where i.indrelid = fk.conrelid
        and i.indnkeyatts >= array_length(fk.columns, 1)
        and (
          select array_agg(a.attname order by k.ord)
          from unnest(i.indkey[0:array_length(fk.columns, 1) - 1]) with ordinality k(attnum, ord)
          join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
        ) = fk.columns
    ) then
      continue;
    end if;

    -- Index names are capped at 63 bytes; derive from the constraint name and
    -- truncate, which keeps them unique because constraint names are unique.
    index_name := left(fk.conname, 59) || '_idx';
    column_list := (select string_agg(quote_ident(col), ', ') from unnest(fk.columns) as col);

    execute format('create index if not exists %I on public.%I (%s)', index_name, fk.table_name, column_list);
    created := created + 1;
  end loop;

  raise notice 'Created % covering indexes for cascade/populated foreign keys.', created;
end $$;

-- Assert no ON DELETE CASCADE foreign key is left without a covering index.
do $$
declare
  offending text;
begin
  select string_agg(c.conname, ', ' order by c.conname)
    into offending
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where c.contype = 'f'
    and n.nspname = 'public'
    and c.confdeltype = 'c'
    and not exists (
      select 1
      from pg_index i
      where i.indrelid = c.conrelid
        and i.indnkeyatts >= array_length(c.conkey, 1)
        and (
          select array_agg(a.attname order by k.ord)
          from unnest(i.indkey[0:array_length(c.conkey, 1) - 1]) with ordinality k(attnum, ord)
          join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
        ) = (
          select array_agg(a.attname order by k.ord)
          from unnest(c.conkey) with ordinality k(attnum, ord)
          join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
        )
    );

  if offending is not null then
    raise exception 'Cascade foreign keys still lack a covering index: %', offending;
  end if;
end $$;
