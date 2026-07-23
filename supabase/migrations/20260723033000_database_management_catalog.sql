-- Founder-only, read-only PostgreSQL and Supabase metadata catalog.
-- This function intentionally exposes no secrets, SQL executor, mutation controls,
-- backup deletion controls, or replication mutation controls.

create or replace function public.sonara_database_management_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
set statement_timeout = '10s'
as $function$
declare
  v_migrations jsonb := '[]'::jsonb;
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute $migration_query$
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'version', migration_row ->> 'version',
            'name', migration_row ->> 'name'
          )
          order by migration_row ->> 'version'
        ),
        '[]'::jsonb
      )
      from (
        select to_jsonb(migration_record) as migration_row
        from supabase_migrations.schema_migrations as migration_record
      ) as migration_rows
    $migration_query$
    into v_migrations;
  end if;

  return jsonb_build_object(
    'generatedAt', clock_timestamp(),

    'platform', jsonb_build_object(
      'database', current_database(),
      'serverVersion', current_setting('server_version', true),
      'serverVersionNumber', current_setting('server_version_num', true),
      'timeZone', current_setting('TimeZone', true),
      'defaultTransactionReadOnly', current_setting('default_transaction_read_only', true),
      'databaseSizeBytes', pg_database_size(current_database()),
      'databaseSize', pg_size_pretty(pg_database_size(current_database())),
      'catalogMode', 'live_read_only',
      'provider', 'supabase_postgresql'
    ),

    'schemas', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'name', namespace.nspname,
            'owner', pg_get_userbyid(namespace.nspowner),
            'managed', namespace.nspname <> 'public'
          )
          order by namespace.nspname
        ),
        '[]'::jsonb
      )
      from pg_namespace as namespace
      where namespace.nspname !~ '^pg_'
        and namespace.nspname <> 'information_schema'
    ),

    'schemaGraph', jsonb_build_object(
      'nodes', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'schema', namespace.nspname,
              'name', relation.relname,
              'kind', case relation.relkind
                when 'r' then 'table'
                when 'p' then 'partitioned_table'
                when 'v' then 'view'
                when 'm' then 'materialized_view'
                when 'f' then 'foreign_table'
                else relation.relkind::text
              end,
              'columnCount', (
                select count(*)
                from pg_attribute as attribute
                where attribute.attrelid = relation.oid
                  and attribute.attnum > 0
                  and not attribute.attisdropped
              ),
              'rlsEnabled', relation.relrowsecurity
            )
            order by namespace.nspname, relation.relname
          ),
          '[]'::jsonb
        )
        from pg_class as relation
        join pg_namespace as namespace on namespace.oid = relation.relnamespace
        where relation.relkind in ('r', 'p', 'v', 'm', 'f')
          and namespace.nspname !~ '^pg_'
          and namespace.nspname <> 'information_schema'
      ),
      'edges', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'name', constraint_record.conname,
              'sourceSchema', source_namespace.nspname,
              'sourceTable', source_table.relname,
              'sourceColumns', (
                select coalesce(jsonb_agg(source_attribute.attname order by key_column.ordinality), '[]'::jsonb)
                from unnest(constraint_record.conkey) with ordinality as key_column(attnum, ordinality)
                join pg_attribute as source_attribute
                  on source_attribute.attrelid = constraint_record.conrelid
                 and source_attribute.attnum = key_column.attnum
              ),
              'targetSchema', target_namespace.nspname,
              'targetTable', target_table.relname,
              'targetColumns', (
                select coalesce(jsonb_agg(target_attribute.attname order by key_column.ordinality), '[]'::jsonb)
                from unnest(constraint_record.confkey) with ordinality as key_column(attnum, ordinality)
                join pg_attribute as target_attribute
                  on target_attribute.attrelid = constraint_record.confrelid
                 and target_attribute.attnum = key_column.attnum
              ),
              'deleteAction', constraint_record.confdeltype::text,
              'updateAction', constraint_record.confupdtype::text,
              'deferrable', constraint_record.condeferrable,
              'deferred', constraint_record.condeferred
            )
            order by source_namespace.nspname, source_table.relname, constraint_record.conname
          ),
          '[]'::jsonb
        )
        from pg_constraint as constraint_record
        join pg_class as source_table on source_table.oid = constraint_record.conrelid
        join pg_namespace as source_namespace on source_namespace.oid = source_table.relnamespace
        join pg_class as target_table on target_table.oid = constraint_record.confrelid
        join pg_namespace as target_namespace on target_namespace.oid = target_table.relnamespace
        where constraint_record.contype = 'f'
          and source_namespace.nspname !~ '^pg_'
          and source_namespace.nspname <> 'information_schema'
      )
    ),

    'tables', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'schema', namespace.nspname,
            'name', relation.relname,
            'kind', case relation.relkind
              when 'r' then 'table'
              when 'p' then 'partitioned_table'
              when 'v' then 'view'
              when 'm' then 'materialized_view'
              when 'f' then 'foreign_table'
              else relation.relkind::text
            end,
            'owner', pg_get_userbyid(relation.relowner),
            'rlsEnabled', relation.relrowsecurity,
            'rlsForced', relation.relforcerowsecurity,
            'estimatedRows', greatest(relation.reltuples, 0)::bigint,
            'sizeBytes', case when relation.relkind in ('r', 'p', 'm') then pg_total_relation_size(relation.oid) else 0 end,
            'size', case when relation.relkind in ('r', 'p', 'm') then pg_size_pretty(pg_total_relation_size(relation.oid)) else '0 bytes' end
          )
          order by namespace.nspname, relation.relname
        ),
        '[]'::jsonb
      )
      from pg_class as relation
      join pg_namespace as namespace on namespace.oid = relation.relnamespace
      where relation.relkind in ('r', 'p', 'v', 'm', 'f')
        and namespace.nspname !~ '^pg_'
        and namespace.nspname <> 'information_schema'
    ),

    'functions', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'schema', namespace.nspname,
            'name', procedure_record.proname,
            'kind', case procedure_record.prokind
              when 'f' then 'function'
              when 'p' then 'procedure'
              when 'a' then 'aggregate'
              when 'w' then 'window'
              else procedure_record.prokind::text
            end,
            'identityArguments', pg_get_function_identity_arguments(procedure_record.oid),
            'result', pg_get_function_result(procedure_record.oid),
            'language', language_record.lanname,
            'volatility', case procedure_record.provolatile
              when 'i' then 'immutable'
              when 's' then 'stable'
              when 'v' then 'volatile'
              else procedure_record.provolatile::text
            end,
            'securityDefiner', procedure_record.prosecdef,
            'owner', pg_get_userbyid(procedure_record.proowner)
          )
          order by namespace.nspname, procedure_record.proname, pg_get_function_identity_arguments(procedure_record.oid)
        ),
        '[]'::jsonb
      )
      from pg_proc as procedure_record
      join pg_namespace as namespace on namespace.oid = procedure_record.pronamespace
      join pg_language as language_record on language_record.oid = procedure_record.prolang
      where namespace.nspname !~ '^pg_'
        and namespace.nspname <> 'information_schema'
    ),

    'triggers', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'schema', namespace.nspname,
            'table', relation.relname,
            'name', trigger_record.tgname,
            'enabled', case trigger_record.tgenabled
              when 'O' then 'origin'
              when 'D' then 'disabled'
              when 'R' then 'replica'
              when 'A' then 'always'
              else trigger_record.tgenabled::text
            end,
            'definition', pg_get_triggerdef(trigger_record.oid, true)
          )
          order by namespace.nspname, relation.relname, trigger_record.tgname
        ),
        '[]'::jsonb
      )
      from pg_trigger as trigger_record
      join pg_class as relation on relation.oid = trigger_record.tgrelid
      join pg_namespace as namespace on namespace.oid = relation.relnamespace
      where not trigger_record.tgisinternal
        and namespace.nspname !~ '^pg_'
        and namespace.nspname <> 'information_schema'
    ),

    'enumTypes', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'schema', namespace.nspname,
            'name', type_record.typname,
            'labels', (
              select coalesce(jsonb_agg(enum_record.enumlabel order by enum_record.enumsortorder), '[]'::jsonb)
              from pg_enum as enum_record
              where enum_record.enumtypid = type_record.oid
            )
          )
          order by namespace.nspname, type_record.typname
        ),
        '[]'::jsonb
      )
      from pg_type as type_record
      join pg_namespace as namespace on namespace.oid = type_record.typnamespace
      where type_record.typtype = 'e'
        and namespace.nspname !~ '^pg_'
        and namespace.nspname <> 'information_schema'
    ),

    'extensions', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'name', extension_record.extname,
            'version', extension_record.extversion,
            'schema', namespace.nspname,
            'relocatable', extension_record.extrelocatable
          )
          order by extension_record.extname
        ),
        '[]'::jsonb
      )
      from pg_extension as extension_record
      join pg_namespace as namespace on namespace.oid = extension_record.extnamespace
    ),

    'indexes', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'schema', namespace.nspname,
            'table', table_relation.relname,
            'name', index_relation.relname,
            'unique', index_record.indisunique,
            'primary', index_record.indisprimary,
            'valid', index_record.indisvalid,
            'ready', index_record.indisready,
            'live', index_record.indislive,
            'sizeBytes', pg_relation_size(index_relation.oid),
            'size', pg_size_pretty(pg_relation_size(index_relation.oid)),
            'definition', pg_get_indexdef(index_relation.oid)
          )
          order by namespace.nspname, table_relation.relname, index_relation.relname
        ),
        '[]'::jsonb
      )
      from pg_index as index_record
      join pg_class as index_relation on index_relation.oid = index_record.indexrelid
      join pg_class as table_relation on table_relation.oid = index_record.indrelid
      join pg_namespace as namespace on namespace.oid = table_relation.relnamespace
      where namespace.nspname !~ '^pg_'
        and namespace.nspname <> 'information_schema'
    ),

    'publications', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'name', publication_record.pubname,
            'owner', pg_get_userbyid(publication_record.pubowner),
            'allTables', publication_record.puballtables,
            'publishInsert', publication_record.pubinsert,
            'publishUpdate', publication_record.pubupdate,
            'publishDelete', publication_record.pubdelete,
            'publishTruncate', publication_record.pubtruncate,
            'tables', (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object(
                    'schema', publication_table.schemaname,
                    'table', publication_table.tablename
                  )
                  order by publication_table.schemaname, publication_table.tablename
                ),
                '[]'::jsonb
              )
              from pg_publication_tables as publication_table
              where publication_table.pubname = publication_record.pubname
            )
          )
          order by publication_record.pubname
        ),
        '[]'::jsonb
      )
      from pg_publication as publication_record
    ),

    'accessControl', jsonb_build_object(
      'tableGrants', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'grantor', privilege.grantor,
              'grantee', privilege.grantee,
              'tableSchema', privilege.table_schema,
              'tableName', privilege.table_name,
              'privilege', privilege.privilege_type,
              'grantable', privilege.is_grantable = 'YES'
            )
            order by privilege.table_schema, privilege.table_name, privilege.grantee, privilege.privilege_type
          ),
          '[]'::jsonb
        )
        from information_schema.table_privileges as privilege
        where privilege.table_schema !~ '^pg_'
          and privilege.table_schema <> 'information_schema'
      ),
      'schemaGrants', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'schema', namespace.nspname,
              'grantor', pg_get_userbyid(grant_record.grantor),
              'grantee', case when grant_record.grantee = 0 then 'PUBLIC' else pg_get_userbyid(grant_record.grantee) end,
              'privilege', grant_record.privilege_type,
              'grantable', grant_record.is_grantable
            )
            order by namespace.nspname, grant_record.grantee, grant_record.privilege_type
          ),
          '[]'::jsonb
        )
        from pg_namespace as namespace
        cross join lateral aclexplode(coalesce(namespace.nspacl, acldefault('n', namespace.nspowner))) as grant_record
        where namespace.nspname !~ '^pg_'
          and namespace.nspname <> 'information_schema'
      ),
      'defaultPrivileges', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'owner', pg_get_userbyid(default_acl.defaclrole),
              'schema', namespace.nspname,
              'objectType', default_acl.defaclobjtype::text,
              'acl', coalesce(default_acl.defaclacl::text, '')
            )
            order by pg_get_userbyid(default_acl.defaclrole), namespace.nspname, default_acl.defaclobjtype
          ),
          '[]'::jsonb
        )
        from pg_default_acl as default_acl
        left join pg_namespace as namespace on namespace.oid = default_acl.defaclnamespace
      )
    ),

    'policies', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'schema', policy_record.schemaname,
            'table', policy_record.tablename,
            'name', policy_record.policyname,
            'permissive', policy_record.permissive,
            'roles', to_jsonb(policy_record.roles),
            'command', policy_record.cmd,
            'using', policy_record.qual,
            'withCheck', policy_record.with_check
          )
          order by policy_record.schemaname, policy_record.tablename, policy_record.policyname
        ),
        '[]'::jsonb
      )
      from pg_policies as policy_record
      where policy_record.schemaname !~ '^pg_'
        and policy_record.schemaname <> 'information_schema'
    ),

    'roles', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'role', role_record.rolname,
            'superuser', role_record.rolsuper,
            'inherit', role_record.rolinherit,
            'createRole', role_record.rolcreaterole,
            'createDatabase', role_record.rolcreatedb,
            'canLogin', role_record.rolcanlogin,
            'replication', role_record.rolreplication,
            'bypassRls', role_record.rolbypassrls,
            'connectionLimit', role_record.rolconnlimit,
            'validUntil', role_record.rolvaliduntil
          )
          order by role_record.rolname
        ),
        '[]'::jsonb
      )
      from pg_roles as role_record
    ),

    'configuration', jsonb_build_object(
      'rowLevelSecurity', jsonb_build_object(
        'enabledTableCount', (
          select count(*)
          from pg_class as relation
          join pg_namespace as namespace on namespace.oid = relation.relnamespace
          where relation.relkind in ('r', 'p')
            and relation.relrowsecurity
            and namespace.nspname !~ '^pg_'
            and namespace.nspname <> 'information_schema'
        ),
        'disabledTableCount', (
          select count(*)
          from pg_class as relation
          join pg_namespace as namespace on namespace.oid = relation.relnamespace
          where relation.relkind in ('r', 'p')
            and not relation.relrowsecurity
            and namespace.nspname !~ '^pg_'
            and namespace.nspname <> 'information_schema'
        )
      ),
      'searchPath', current_setting('search_path', true),
      'transactionIsolation', current_setting('transaction_isolation', true),
      'standardConformingStrings', current_setting('standard_conforming_strings', true),
      'passwordEncryption', current_setting('password_encryption', true)
    ),

    'settings', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'name', setting_record.name,
            'setting', setting_record.setting,
            'unit', setting_record.unit,
            'category', setting_record.category,
            'source', setting_record.source,
            'pendingRestart', setting_record.pending_restart
          )
          order by setting_record.name
        ),
        '[]'::jsonb
      )
      from pg_settings as setting_record
      where setting_record.name in (
        'TimeZone',
        'default_transaction_isolation',
        'default_transaction_read_only',
        'idle_in_transaction_session_timeout',
        'lock_timeout',
        'log_min_duration_statement',
        'max_connections',
        'max_replication_slots',
        'max_wal_senders',
        'password_encryption',
        'shared_buffers',
        'statement_timeout',
        'track_activity_query_size',
        'wal_level',
        'work_mem'
      )
    ),

    'replication', jsonb_build_object(
      'walLevel', current_setting('wal_level', true),
      'maxWalSenders', current_setting('max_wal_senders', true),
      'maxReplicationSlots', current_setting('max_replication_slots', true),
      'senders', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'applicationName', replication_record.application_name,
              'clientAddress', replication_record.client_addr,
              'state', replication_record.state,
              'syncState', replication_record.sync_state,
              'writeLag', replication_record.write_lag,
              'flushLag', replication_record.flush_lag,
              'replayLag', replication_record.replay_lag
            )
            order by replication_record.application_name, replication_record.client_addr
          ),
          '[]'::jsonb
        )
        from pg_stat_replication as replication_record
      ),
      'slots', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'name', slot_record.slot_name,
              'plugin', slot_record.plugin,
              'type', slot_record.slot_type,
              'database', slot_record.database,
              'active', slot_record.active,
              'walStatus', slot_record.wal_status,
              'safeWalSize', slot_record.safe_wal_size
            )
            order by slot_record.slot_name
          ),
          '[]'::jsonb
        )
        from pg_replication_slots as slot_record
      ),
      'subscriptions', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'name', subscription_record.subname,
              'enabled', subscription_record.subenabled,
              'owner', pg_get_userbyid(subscription_record.subowner)
            )
            order by subscription_record.subname
          ),
          '[]'::jsonb
        )
        from pg_subscription as subscription_record
      )
    ),

    'backups', jsonb_build_object(
      'status', 'provider_managed_verification_required',
      'provider', 'supabase',
      'sqlIntrospectionAvailable', false,
      'mutationAvailableInApplication', false,
      'message', 'Backup schedules, retention, restore points, and point-in-time recovery are provider-managed and are not exposed through the PostgreSQL catalog. Verify them in the protected Supabase platform before treating backups as ready.'
    ),

    'migrations', jsonb_build_object(
      'applied', v_migrations,
      'source', 'supabase_migrations.schema_migrations',
      'mutationAvailableInApplication', false
    )
  );
end;
$function$;

revoke all on function public.sonara_database_management_snapshot() from public;
revoke all on function public.sonara_database_management_snapshot() from anon;
revoke all on function public.sonara_database_management_snapshot() from authenticated;
grant execute on function public.sonara_database_management_snapshot() to service_role;

comment on function public.sonara_database_management_snapshot() is
  'Founder-only read-only database metadata snapshot for the SONARA Database Management console. No secrets or mutating controls are returned.';
