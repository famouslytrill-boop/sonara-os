-- Customer workspace bootstrap for a single-login, customer-ready onboarding flow.
-- Server-only: this RPC is callable exclusively with the Supabase service role.

create or replace function public.sonara_bootstrap_customer_workspace(
  p_user_id uuid,
  p_email text default null,
  p_organization_name text default null,
  p_product_path text default 'dashboard'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_existing_organization_id uuid;
  v_organization_id uuid;
  v_organization_name text;
  v_slug_base text;
  v_slug text;
  v_product_path text;
  v_suffix integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'valid auth user required' using errcode = '22023';
  end if;

  v_product_path := case
    when p_product_path in ('business-builder', 'creator-studio', 'growth-studio', 'dashboard') then p_product_path
    else 'dashboard'
  end;

  v_organization_name := nullif(btrim(coalesce(p_organization_name, '')), '');
  if v_organization_name is null then
    v_organization_name := case
      when nullif(split_part(coalesce(p_email, ''), '@', 1), '') is not null
        then initcap(replace(split_part(p_email, '@', 1), '.', ' ')) || '''s Workspace'
      else 'My SONARA Workspace'
    end;
  end if;
  v_organization_name := left(v_organization_name, 120);

  insert into public.profiles (id, email, display_name, metadata)
  values (
    p_user_id,
    nullif(lower(btrim(coalesce(p_email, ''))), ''),
    nullif(lower(btrim(coalesce(p_email, ''))), ''),
    jsonb_build_object('source', 'customer_workspace_bootstrap')
  )
  on conflict (id) do update
  set email = coalesce(excluded.email, public.profiles.email),
      display_name = coalesce(public.profiles.display_name, excluded.display_name),
      metadata = coalesce(public.profiles.metadata, '{}'::jsonb) || excluded.metadata,
      updated_at = now();

  select memberships.organization_id
  into v_existing_organization_id
  from public.organization_memberships memberships
  where memberships.user_id = p_user_id
    and memberships.status = 'active'
  order by memberships.created_at asc nulls last, memberships.organization_id asc
  limit 1;

  if v_existing_organization_id is not null then
    update public.organization_memberships
    set status = 'active', updated_at = now()
    where organization_id = v_existing_organization_id and user_id = p_user_id;

    return jsonb_build_object(
      'ok', true,
      'created', false,
      'organization_id', v_existing_organization_id,
      'product_path', v_product_path
    );
  end if;

  v_slug_base := lower(regexp_replace(v_organization_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug_base := trim(both '-' from v_slug_base);
  if v_slug_base = '' then v_slug_base := 'sonara-workspace'; end if;
  v_slug_base := left(v_slug_base, 72) || '-' || left(replace(p_user_id::text, '-', ''), 8);
  v_slug := v_slug_base;

  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := left(v_slug_base, 110) || '-' || v_suffix::text;
  end loop;

  insert into public.organizations (
    name,
    slug,
    owner_id,
    owner_user_id,
    metadata
  )
  values (
    v_organization_name,
    v_slug,
    p_user_id,
    p_user_id,
    jsonb_build_object(
      'source', 'customer_workspace_bootstrap',
      'product_path', v_product_path
    )
  )
  returning id into v_organization_id;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role,
    status
  )
  values (v_organization_id, p_user_id, 'owner', 'active')
  on conflict (organization_id, user_id) do update
  set role = 'owner', status = 'active', updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'created', true,
    'organization_id', v_organization_id,
    'product_path', v_product_path
  );
end;
$function$;

revoke all on function public.sonara_bootstrap_customer_workspace(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.sonara_bootstrap_customer_workspace(uuid, text, text, text) to service_role;

comment on function public.sonara_bootstrap_customer_workspace(uuid, text, text, text) is
  'Atomically creates or reuses the authenticated customer profile, organization, and owner membership. Service-role only; never callable from browser roles.';

notify pgrst, 'reload schema';
