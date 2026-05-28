-- Recreate Research Lab intake read policies after the membership foundation exists.
-- These policies keep organization-scoped research records private to active members.

do $$
begin
  if to_regclass('public.research_sources') is not null
     and to_regclass('public.organization_memberships') is not null
  then
    drop policy if exists "org members can read research sources" on public.research_sources;

    create policy "org members can read research sources"
      on public.research_sources
      for select
      using (
        exists (
          select 1
          from public.organization_memberships memberships
          where memberships.organization_id = research_sources.organization_id
            and memberships.user_id = auth.uid()
            and memberships.status = 'active'
        )
      );
  end if;
end $$;

do $$
begin
  if to_regclass('public.open_source_tools') is not null
     and to_regclass('public.organization_memberships') is not null
  then
    drop policy if exists "org members can read open source tools" on public.open_source_tools;

    create policy "org members can read open source tools"
      on public.open_source_tools
      for select
      using (
        exists (
          select 1
          from public.organization_memberships memberships
          where memberships.organization_id = open_source_tools.organization_id
            and memberships.user_id = auth.uid()
            and memberships.status = 'active'
        )
      );
  end if;
end $$;

do $$
begin
  if to_regclass('public.tool_reviews') is not null
     and to_regclass('public.organization_memberships') is not null
  then
    drop policy if exists "org members can read tool reviews" on public.tool_reviews;

    create policy "org members can read tool reviews"
      on public.tool_reviews
      for select
      using (
        exists (
          select 1
          from public.organization_memberships memberships
          where memberships.organization_id = tool_reviews.organization_id
            and memberships.user_id = auth.uid()
            and memberships.status = 'active'
        )
      );
  end if;
end $$;
