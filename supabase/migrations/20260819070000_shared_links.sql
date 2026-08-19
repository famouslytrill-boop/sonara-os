-- One place that says what has been shared, for every kind of thing that can be.
--
-- Four days ago the answer was two columns on module_outputs -- share_token and
-- shared_at, added by 20260819060000. That was right for one shareable type and
-- wrong the moment there were four: a quote, an invoice and an appointment are
-- also things a business sends to somebody outside the workspace, and repeating
-- the columns on each would mean four places to revoke from, four indexes, and
-- a /shared/:token route that has to guess which table to look in. This
-- migration replaces that decision rather than adding to it, and the columns it
-- created are dropped below.
--
-- Nothing is lost. Those columns were added on this branch and have never been
-- applied to production, so no row anywhere carries a token to migrate. The
-- statement that copies them across is written anyway, because a preview branch
-- may have them and a migration that only works on an empty table is a migration
-- that fails the first time it meets a full one.
--
-- ## What a shared link is allowed to be
--
-- resource_type is a check constraint, not free text. A token that resolved to
-- an arbitrary table name would be a token that could name any table in the
-- database, and the whole point of this row is that it names exactly one thing
-- a customer chose to publish.
--
-- organization_id is here even though the token alone finds the row. It is what
-- lets the owner's own pages list and revoke their links with the same
-- organization filter every other query uses -- the service key bypasses row
-- level security, so that filter is the only tenant boundary there is. The
-- public read does not use it and must not: a public page that had to be told
-- which organization to trust is a public page that could be told the wrong one.
--
-- revoked_at rather than deleting the row. A customer who unshares something and
-- wonders later whether it was ever public is owed an answer, and a deleted row
-- cannot give one.

create table if not exists public.shared_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resource_type text not null
    check (resource_type in ('module_output', 'quote', 'customer_invoice', 'business_booking')),
  resource_id uuid not null,
  token text not null,
  shared_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

-- Tokens are unique across everything, revoked or not. A revoked token must
-- never come back attached to something else -- somebody still holding the old
-- link would open a document they were never sent.
create unique index if not exists shared_links_token_key on public.shared_links(token);

-- At most one live link per thing. Without this, pressing Share twice races into
-- two tokens for one invoice, and revoking would then only stop one of them.
create unique index if not exists shared_links_live_resource_key
  on public.shared_links(resource_type, resource_id)
  where revoked_at is null;

create index if not exists shared_links_organization_idx
  on public.shared_links(organization_id, shared_at desc);

alter table public.shared_links enable row level security;

drop policy if exists "service role can manage shared_links" on public.shared_links;
create policy "service role can manage shared_links" on public.shared_links
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

comment on table public.shared_links is
  'Things a customer chose to publish at an unguessable link. One row per share, across every shareable record type. revoked_at set means the link no longer opens; the row is kept so the customer can be told it was public once.';

-- Carry across anything the previous shape had. Guarded on the column still
-- existing, so this runs correctly whether or not 20260819060000 reached this
-- database first.
do $migrate$
declare
  carried bigint := 0;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'module_outputs' and column_name = 'share_token'
  ) then
    insert into public.shared_links (organization_id, resource_type, resource_id, token, shared_at)
    select m.organization_id, 'module_output', m.id, m.share_token, coalesce(m.shared_at, now())
    from public.module_outputs m
    where m.share_token is not null
      and m.organization_id is not null
      and not exists (select 1 from public.shared_links s where s.token = m.share_token);
    get diagnostics carried = row_count;
  end if;
  raise notice 'shared_links ready. Module-output links carried across: %', carried;
end
$migrate$;

drop index if exists public.module_outputs_share_token_key;

alter table public.module_outputs
  drop column if exists share_token,
  drop column if exists shared_at;
