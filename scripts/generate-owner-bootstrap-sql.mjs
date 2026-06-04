const ownerEmail = readEnv("OWNER_EMAIL", "<OWNER_EMAIL>");
const ownerOrgName = readEnv("OWNER_ORG_NAME", "SONARA Industries");
const ownerOrgSlug = readEnv("OWNER_ORG_SLUG", "sonara-industries");

const generatedAt = new Date().toISOString();

console.log(`-- Generated owner bootstrap SQL for local review only.
-- Generated at: ${generatedAt}
-- Do not commit a real owner email.
-- If auth.users has no matching email, Supabase will raise:
-- Create/login with this email first using Supabase Auth, then rerun owner bootstrap.

-- Owner email configured: ${ownerEmail === "<OWNER_EMAIL>" ? "placeholder" : "from OWNER_EMAIL env"}
-- Organization name: ${escapeSqlComment(ownerOrgName)}
-- Organization slug: ${escapeSqlComment(ownerOrgSlug)}

do $$
declare
  owner_email text := ${quoteSql(ownerEmail)};
  owner_org_name text := ${quoteSql(ownerOrgName)};
  owner_org_slug text := ${quoteSql(ownerOrgSlug)};
  auth_user_id uuid;
  target_organization_id uuid;
  membership_table text;
  membership_org_column text;
begin
  select users.id
    into auth_user_id
  from auth.users users
  where lower(users.email) = lower(owner_email)
  limit 1;

  if auth_user_id is null then
    raise exception 'Create/login with this email first using Supabase Auth, then rerun owner bootstrap.';
  end if;

  if to_regclass('public.user_profiles') is not null then
    insert into public.user_profiles (id, display_name, email)
    select auth_user_id, owner_org_name || ' Owner', owner_email
    where not exists (select 1 from public.user_profiles where id = auth_user_id);
  end if;

  if to_regclass('public.organizations') is null then
    raise exception 'public.organizations does not exist. Apply reviewed migrations before owner bootstrap.';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'organizations' and column_name = 'slug'
  ) then
    select id into target_organization_id
    from public.organizations
    where slug = owner_org_slug
    limit 1;
  end if;

  if target_organization_id is null then
    select id into target_organization_id
    from public.organizations
    where name = owner_org_name
    limit 1;
  end if;

  if target_organization_id is null then
    raise notice 'Review supabase/bootstrap/ensure_owner_membership.sql for schema-aware organization insert before running against production.';
    raise exception 'Organization does not exist yet. Run reviewed schema-aware bootstrap SQL after confirming required organization columns.';
  end if;

  if to_regclass('public.organization_members') is not null then
    membership_table := 'organization_members';
    membership_org_column := 'organization_id';
  elsif to_regclass('public.organization_memberships') is not null then
    membership_table := 'organization_memberships';
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'organization_memberships' and column_name = 'organization_id'
    ) then
      membership_org_column := 'organization_id';
    else
      membership_org_column := 'org_id';
    end if;
  else
    raise exception 'No organization membership table exists. Expected public.organization_members or public.organization_memberships.';
  end if;

  execute format(
    'insert into public.%I (%I, user_id, role, status) select $1, $2, ''owner'', ''active'' where not exists (select 1 from public.%I where %I = $1 and user_id = $2)',
    membership_table,
    membership_org_column,
    membership_table,
    membership_org_column
  )
  using target_organization_id, auth_user_id;

  execute format(
    'update public.%I set role = ''owner'', status = ''active'' where %I = $1 and user_id = $2',
    membership_table,
    membership_org_column
  )
  using target_organization_id, auth_user_id;
end $$;
`);

function readEnv(name, fallback) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function quoteSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function escapeSqlComment(value) {
  return String(value).replaceAll("\r", " ").replaceAll("\n", " ");
}
