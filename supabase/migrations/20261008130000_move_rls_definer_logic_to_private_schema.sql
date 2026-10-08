-- Remove privileged authorization logic from the exposed public API schema
-- without rewriting the hundreds of RLS policies that already depend on the
-- public helper signatures.
--
-- The public functions keep their names and OIDs. Their bodies become
-- SECURITY INVOKER wrappers, so existing policies and database contracts remain
-- stable. The table-reading logic moves into private SECURITY DEFINER helpers.
-- PostgREST does not expose the private schema, but authenticated policy
-- evaluation can execute the helpers through an explicit schema-qualified call.
--
-- Every privileged body keeps search_path empty and schema-qualifies all
-- relations. anon receives neither schema USAGE nor function EXECUTE.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema private to authenticated, service_role;

create or replace function private.has_entity_role(
  target_entity_id uuid,
  allowed_roles public.entity_member_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.entity_memberships memberships
    where memberships.entity_id = target_entity_id
      and memberships.user_id = (select auth.uid())
      and memberships.role = any(allowed_roles)
  );
$function$;

create or replace function private.can_manage_entity(target_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.has_entity_role(
    target_entity_id,
    array['owner','admin']::public.entity_member_role[]
  );
$function$;

create or replace function private.has_org_role(
  target_organization_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.organization_memberships memberships
    where memberships.organization_id = target_organization_id
      and memberships.user_id = (select auth.uid())
      and memberships.status = 'active'
      and memberships.role = any(allowed_roles)
  );
$function$;

create or replace function private.has_org_role(
  target_organization_id uuid,
  target_role text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.organization_memberships memberships
    where memberships.organization_id = target_organization_id
      and memberships.user_id = (select auth.uid())
      and memberships.status = 'active'
      and memberships.role = target_role
  );
$function$;

create or replace function private.is_entity_member(target_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.entity_memberships memberships
    where memberships.entity_id = target_entity_id
      and memberships.user_id = (select auth.uid())
  );
$function$;

create or replace function private.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.organization_memberships memberships
    where memberships.organization_id = target_organization_id
      and memberships.user_id = (select auth.uid())
      and memberships.status = 'active'
  );
$function$;

create or replace function private.is_org_owner_or_admin(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.has_org_role(target_organization_id, array['owner','admin']::text[]);
$function$;

create or replace function private.sonara_is_org_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.organization_memberships memberships
    where memberships.organization_id = org
      and memberships.user_id = (select auth.uid())
      and coalesce(memberships.status, 'active') = 'active'
  );
$function$;

-- Default function privileges are broad in PostgreSQL. Close every private
-- helper explicitly, then grant only the two roles whose policy/server paths
-- require execution.
revoke execute on function private.has_entity_role(uuid, public.entity_member_role[]) from public, anon;
revoke execute on function private.can_manage_entity(uuid) from public, anon;
revoke execute on function private.has_org_role(uuid, text[]) from public, anon;
revoke execute on function private.has_org_role(uuid, text) from public, anon;
revoke execute on function private.is_entity_member(uuid) from public, anon;
revoke execute on function private.is_org_member(uuid) from public, anon;
revoke execute on function private.is_org_owner_or_admin(uuid) from public, anon;
revoke execute on function private.sonara_is_org_member(uuid) from public, anon;

grant execute on function private.has_entity_role(uuid, public.entity_member_role[]) to authenticated, service_role;
grant execute on function private.can_manage_entity(uuid) to authenticated, service_role;
grant execute on function private.has_org_role(uuid, text[]) to authenticated, service_role;
grant execute on function private.has_org_role(uuid, text) to authenticated, service_role;
grant execute on function private.is_entity_member(uuid) to authenticated, service_role;
grant execute on function private.is_org_member(uuid) to authenticated, service_role;
grant execute on function private.is_org_owner_or_admin(uuid) to authenticated, service_role;
grant execute on function private.sonara_is_org_member(uuid) to authenticated, service_role;

-- Keep the long-lived public signatures as non-privileged compatibility
-- wrappers. Existing RLS policies reference these function OIDs, so no policy
-- rewrite is required and a failed wrapper/private transition is caught by the
-- existing two-user native RLS matrix.
create or replace function public.has_entity_role(
  target_entity_id uuid,
  allowed_roles public.entity_member_role[]
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.has_entity_role(target_entity_id, allowed_roles);
$function$;

create or replace function public.can_manage_entity(target_entity_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.can_manage_entity(target_entity_id);
$function$;

create or replace function public.has_org_role(
  target_organization_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.has_org_role(target_organization_id, allowed_roles);
$function$;

create or replace function public.has_org_role(
  target_organization_id uuid,
  target_role text
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.has_org_role(target_organization_id, target_role);
$function$;

create or replace function public.is_entity_member(target_entity_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.is_entity_member(target_entity_id);
$function$;

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.is_org_member(target_organization_id);
$function$;

create or replace function public.is_org_owner_or_admin(target_organization_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.is_org_owner_or_admin(target_organization_id);
$function$;

create or replace function public.sonara_is_org_member(org uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.sonara_is_org_member(org);
$function$;

revoke execute on function public.has_entity_role(uuid, public.entity_member_role[]) from public, anon;
revoke execute on function public.can_manage_entity(uuid) from public, anon;
revoke execute on function public.has_org_role(uuid, text[]) from public, anon;
revoke execute on function public.has_org_role(uuid, text) from public, anon;
revoke execute on function public.is_entity_member(uuid) from public, anon;
revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.is_org_owner_or_admin(uuid) from public, anon;
revoke execute on function public.sonara_is_org_member(uuid) from public, anon;

grant execute on function public.has_entity_role(uuid, public.entity_member_role[]) to authenticated, service_role;
grant execute on function public.can_manage_entity(uuid) to authenticated, service_role;
grant execute on function public.has_org_role(uuid, text[]) to authenticated, service_role;
grant execute on function public.has_org_role(uuid, text) to authenticated, service_role;
grant execute on function public.is_entity_member(uuid) to authenticated, service_role;
grant execute on function public.is_org_member(uuid) to authenticated, service_role;
grant execute on function public.is_org_owner_or_admin(uuid) to authenticated, service_role;
grant execute on function public.sonara_is_org_member(uuid) to authenticated, service_role;

do $verify_private_authorization_helpers$
declare
  signature text;
  public_oid oid;
  private_oid oid;
  public_is_definer boolean;
  private_is_definer boolean;
  public_config text[];
  private_config text[];
begin
  if has_schema_privilege('anon', 'private', 'usage') then
    raise exception 'anon unexpectedly has USAGE on private schema';
  end if;
  if not has_schema_privilege('authenticated', 'private', 'usage')
     or not has_schema_privilege('service_role', 'private', 'usage') then
    raise exception 'authorized roles cannot resolve private RLS helpers';
  end if;

  foreach signature in array array[
    'has_entity_role(uuid,public.entity_member_role[])',
    'can_manage_entity(uuid)',
    'has_org_role(uuid,text[])',
    'has_org_role(uuid,text)',
    'is_entity_member(uuid)',
    'is_org_member(uuid)',
    'is_org_owner_or_admin(uuid)',
    'sonara_is_org_member(uuid)'
  ]
  loop
    public_oid := to_regprocedure('public.' || signature);
    private_oid := to_regprocedure('private.' || signature);

    if public_oid is null or private_oid is null then
      raise exception 'authorization helper pair is incomplete for %', signature;
    end if;

    select p.prosecdef, p.proconfig
      into public_is_definer, public_config
    from pg_proc p
    where p.oid = public_oid;

    select p.prosecdef, p.proconfig
      into private_is_definer, private_config
    from pg_proc p
    where p.oid = private_oid;

    if public_is_definer then
      raise exception 'public authorization helper remains SECURITY DEFINER: %', signature;
    end if;
    if not private_is_definer then
      raise exception 'private authorization helper is not SECURITY DEFINER: %', signature;
    end if;
    if not ('search_path=""' = any(coalesce(public_config, array[]::text[])))
       or not ('search_path=""' = any(coalesce(private_config, array[]::text[]))) then
      raise exception 'authorization helper does not pin an empty search_path: %', signature;
    end if;

    if has_function_privilege('anon', public_oid, 'execute')
       or has_function_privilege('anon', private_oid, 'execute') then
      raise exception 'anon can execute authorization helper %', signature;
    end if;
    if not has_function_privilege('authenticated', public_oid, 'execute')
       or not has_function_privilege('authenticated', private_oid, 'execute')
       or not has_function_privilege('service_role', public_oid, 'execute')
       or not has_function_privilege('service_role', private_oid, 'execute') then
      raise exception 'required authorization helper execution grant missing for %', signature;
    end if;
  end loop;
end
$verify_private_authorization_helpers$;

notify pgrst, 'reload schema';

commit;
