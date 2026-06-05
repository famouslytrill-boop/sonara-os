-- Verify SONARA owner bootstrap.
-- Replace OWNER_EMAIL_HERE before running in Supabase SQL editor.

with owner_user as (
  select id, email
    from auth.users
   where lower(email) = lower('OWNER_EMAIL_HERE')
   limit 1
),
sonara_org as (
  select id, name, slug
    from public.organizations organizations
   where slug = 'sonara-industries'
      or (
        exists (
          select 1 from information_schema.columns
           where table_schema = 'public'
             and table_name = 'organizations'
             and column_name = 'company_key'
        )
        and to_jsonb(organizations) ->> 'company_key' = 'sonara'
      )
   order by created_at asc nulls last
   limit 1
),
owner_membership as (
  select memberships.id,
         memberships.organization_id,
         memberships.user_id,
         memberships.role,
         memberships.status
    from public.organization_memberships memberships
    join owner_user on owner_user.id = memberships.user_id
    join sonara_org on sonara_org.id = memberships.organization_id
   limit 1
)
select
  exists(select 1 from owner_user) as auth_user_exists,
  exists(select 1 from sonara_org) as organization_exists,
  exists(select 1 from owner_membership) as owner_membership_exists,
  coalesce((select status from owner_membership), 'missing') as membership_status,
  coalesce((select role from owner_membership), 'missing') as membership_role,
  case
    when not exists(select 1 from owner_user) then 'missing_auth_user'
    when not exists(select 1 from sonara_org) then 'missing_organization'
    when not exists(select 1 from owner_membership) then 'missing_owner_membership'
    when (select status from owner_membership) <> 'active' then 'membership_not_active'
    when (select role from owner_membership) not in ('owner', 'platform_owner') then 'membership_not_owner'
    else 'ready'
  end as bootstrap_status;
