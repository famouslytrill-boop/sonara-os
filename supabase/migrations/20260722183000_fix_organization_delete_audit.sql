-- Keep organization deletion auditable without retaining a foreign key to a deleted tenant.
-- This is conditional because fresh installations may use the canonical audit_logs shape
-- without the legacy org_id/company_key trigger contract present in production.

do $migration$
begin
  if to_regprocedure('public.audit_row_change()') is not null
     and to_regclass('public.audit_logs') is not null
     and (
       select count(*) = 7
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'audit_logs'
         and column_name = any (array[
           'org_id',
           'company_key',
           'user_id',
           'action',
           'target_table',
           'target_id',
           'metadata'
         ]::text[])
     ) then
    execute $audit_function$
      create or replace function public.audit_row_change()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $function$
      declare
        row_data jsonb;
        target_org_id uuid;
        target_company_key text;
        target_id uuid;
        deleted_organization_id uuid;
      begin
        if tg_op = 'DELETE' then
          row_data := to_jsonb(old);
        else
          row_data := to_jsonb(new);
        end if;

        target_id := nullif(row_data->>'id', '')::uuid;
        target_org_id := nullif(row_data->>'org_id', '')::uuid;

        if tg_table_name = 'organizations' then
          if tg_op = 'DELETE' then
            deleted_organization_id := target_id;
            target_org_id := null;
          elsif target_org_id is null then
            target_org_id := target_id;
          end if;
        end if;

        target_company_key := coalesce(nullif(row_data->>'company_key', ''), 'parent_admin');

        insert into public.audit_logs(
          org_id,
          company_key,
          user_id,
          action,
          target_table,
          target_id,
          metadata
        )
        values (
          target_org_id,
          target_company_key,
          auth.uid(),
          tg_op,
          tg_table_name,
          target_id,
          jsonb_strip_nulls(jsonb_build_object(
            'source', 'trigger',
            'deleted_organization_id', deleted_organization_id
          ))
        );

        if tg_op = 'DELETE' then
          return old;
        end if;

        return new;
      end;
      $function$
    $audit_function$;

    revoke all on function public.audit_row_change() from public, anon, authenticated;
    grant execute on function public.audit_row_change() to service_role;
    comment on function public.audit_row_change() is
      'Writes row-change audit records. Organization deletes retain the removed ID in metadata and clear org_id so the audit row cannot violate the deleted tenant foreign key.';
  else
    raise notice 'Legacy audit_row_change contract is absent; no organization-delete audit repair is required.';
  end if;
end
$migration$;

notify pgrst, 'reload schema';
