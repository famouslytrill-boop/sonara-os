-- Whether a business may research a source, said in values the database will
-- hold to.
--
-- research_sources has carried `permission_status text not null default
-- 'needs_review'` since the platform redesign, and `crawl_status text not null
-- default 'disabled'` beside it. Neither had a check constraint, so the columns
-- accepted any string, and nothing in the application ever read them: the table
-- was named only in the generated tenant-scope inventory and one subsystem
-- listing. A permission gate was designed into the schema and never built.
--
-- /api/market-intelligence/fetch-source meanwhile takes any HTTPS URL from a
-- request body and has this server fetch it. No page calls that endpoint, so
-- there is no feature resting on the gap -- which is exactly why closing it now
-- costs nothing.
--
-- Three values, because two would lose the distinction that matters. A source
-- nobody has ruled on is not a source that was refused: the first is work
-- somebody has to do, the second is a decision they made. `needs_review` stays
-- the default so a row created without an answer carries the honest one.
update public.research_sources
  set permission_status = 'needs_review'
  where permission_status not in ('needs_review', 'approved', 'declined');

update public.research_sources
  set crawl_status = 'disabled'
  where crawl_status not in ('disabled', 'enabled');

alter table public.research_sources
  drop constraint if exists research_sources_permission_status_check;

alter table public.research_sources
  add constraint research_sources_permission_status_check
  check (permission_status in ('needs_review', 'approved', 'declined'));

alter table public.research_sources
  drop constraint if exists research_sources_crawl_status_check;

alter table public.research_sources
  add constraint research_sources_crawl_status_check
  check (crawl_status in ('disabled', 'enabled'));

comment on column public.research_sources.permission_status is
  'Whether this business has established it may research this source. needs_review is the default and means nobody has ruled on it, which is not the same as declined. /api/market-intelligence/fetch-source will only fetch a host covered by an approved row.';

comment on column public.research_sources.crawl_status is
  'Whether repeated crawling of this source is switched on. Disabled by default. Nothing in this application crawls on a schedule today, so this records an intention rather than driving one.';

create index if not exists research_sources_org_permission_idx
  on public.research_sources (organization_id, permission_status);
