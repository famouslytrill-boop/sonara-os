-- SONARA Data API privilege and authorization-function hardening.
--
-- Existing objects retain their current explicit/legacy grants. New public
-- objects become opt-in so a future migration must declare its Data API
-- surface alongside RLS. No customer data is modified by this migration.

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from public;

-- This legacy helper previously treated an owner/admin membership in any
-- customer organization as platform-wide administrator access. Platform-wide
-- access belongs to the dedicated user_roles source instead.
create or replace function public.is_admin_or_founder()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles roles
    where roles.user_id = (select auth.uid())
      and roles.role in ('owner', 'admin')
  );
$$;

-- Lock the lookup environment for every existing authorization helper. Their
-- bodies already schema-qualify application relations and auth.uid().
alter function public.set_updated_at() set search_path = '';
alter function public.is_org_member(uuid) set search_path = '';
alter function public.has_org_role(uuid, text[]) set search_path = '';
alter function public.is_admin_or_founder() set search_path = '';
alter function public.is_org_owner_or_admin(uuid) set search_path = '';
alter function public.sonara_is_org_member(uuid) set search_path = '';
alter function public.sonara_has_org_role(uuid, text[]) set search_path = '';
alter function public.is_entity_member(uuid) set search_path = '';
alter function public.has_entity_role(uuid, public.entity_member_role[]) set search_path = '';
alter function public.can_manage_entity(uuid) set search_path = '';

-- Trigger helpers are not public RPC endpoints.
revoke execute on function public.set_updated_at() from public, anon, authenticated, service_role;

-- RLS authorization helpers must remain executable by signed-in callers whose
-- policies invoke them. Anonymous Data API clients receive no RPC access.
revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.has_org_role(uuid, text[]) from public, anon;
revoke execute on function public.is_admin_or_founder() from public, anon;
revoke execute on function public.is_org_owner_or_admin(uuid) from public, anon;
revoke execute on function public.sonara_is_org_member(uuid) from public, anon;
revoke execute on function public.sonara_has_org_role(uuid, text[]) from public, anon;
revoke execute on function public.is_entity_member(uuid) from public, anon;
revoke execute on function public.has_entity_role(uuid, public.entity_member_role[]) from public, anon;
revoke execute on function public.can_manage_entity(uuid) from public, anon;

grant execute on function public.is_org_member(uuid) to authenticated, service_role;
grant execute on function public.has_org_role(uuid, text[]) to authenticated, service_role;
grant execute on function public.is_admin_or_founder() to authenticated, service_role;
grant execute on function public.is_org_owner_or_admin(uuid) to authenticated, service_role;
grant execute on function public.sonara_is_org_member(uuid) to authenticated, service_role;
grant execute on function public.sonara_has_org_role(uuid, text[]) to authenticated, service_role;
grant execute on function public.is_entity_member(uuid) to authenticated, service_role;
grant execute on function public.has_entity_role(uuid, public.entity_member_role[]) to authenticated, service_role;
grant execute on function public.can_manage_entity(uuid) to authenticated, service_role;

-- Fail the migration if the intended negative/positive execution boundary did
-- not take effect. These checks expose no secret or customer values.
do $$
declare
  helper regprocedure;
begin
  foreach helper in array array[
    'public.is_org_member(uuid)'::regprocedure,
    'public.has_org_role(uuid,text[])'::regprocedure,
    'public.is_admin_or_founder()'::regprocedure,
    'public.is_org_owner_or_admin(uuid)'::regprocedure,
    'public.sonara_is_org_member(uuid)'::regprocedure,
    'public.sonara_has_org_role(uuid,text[])'::regprocedure,
    'public.is_entity_member(uuid)'::regprocedure,
    'public.has_entity_role(uuid,public.entity_member_role[])'::regprocedure,
    'public.can_manage_entity(uuid)'::regprocedure
  ]
  loop
    if has_function_privilege('anon', helper, 'execute') then
      raise exception 'anonymous execute privilege remains on %', helper;
    end if;
    if not has_function_privilege('authenticated', helper, 'execute') then
      raise exception 'authenticated execute privilege missing on %', helper;
    end if;
    if not has_function_privilege('service_role', helper, 'execute') then
      raise exception 'service-role execute privilege missing on %', helper;
    end if;
  end loop;

  if has_function_privilege('anon', 'public.set_updated_at()'::regprocedure, 'execute')
    or has_function_privilege('authenticated', 'public.set_updated_at()'::regprocedure, 'execute')
    or has_function_privilege('service_role', 'public.set_updated_at()'::regprocedure, 'execute') then
    raise exception 'trigger helper public.set_updated_at() remains directly executable by a Data API role';
  end if;
end $$;

comment on function public.is_admin_or_founder() is
  'Returns platform owner/admin status from public.user_roles for the current auth.uid(); never derives global access from organization membership.';
