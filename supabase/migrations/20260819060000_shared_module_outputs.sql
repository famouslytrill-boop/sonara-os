-- A saved tool result a customer chooses to show somebody outside the workspace.
--
-- module_outputs has been readable only by members of the owning organization,
-- which is right by default and is why a customer who worked out their
-- break-even could not send it to a business partner without a screenshot. The
-- product has no distribution loop at all; this is the smallest honest one.
--
-- Two columns, both null by default:
--
--   share_token  the unguessable half of the link. NULL means not shared, which
--                is what every existing row is and stays. Unique, so a token
--                names at most one result.
--   shared_at    when the customer turned it on. Kept separately from the token
--                rather than inferred from it, because "has a token" and "is
--                shared" must be able to disagree: revoking clears the token and
--                leaves shared_at as the record that it once was public, which
--                is the honest thing to show a customer who is deciding whether
--                to share again.
--
-- Deliberately NOT a policy change. RLS is not what is protecting these rows --
-- the application reads module_outputs with the service-role key, which bypasses
-- RLS, so the only boundary is the organization_id filter in the query. The
-- shared page therefore does its own filtering: it selects by share_token and
-- NOTHING else, returns the output payload alone, and never joins to
-- organizations. A public page that had to be told which organization to trust
-- would be a public page that could be told the wrong one.

alter table public.module_outputs
  add column if not exists share_token text,
  add column if not exists shared_at timestamptz;

-- Partial: only shared rows are indexed, and NULL tokens do not collide. A
-- plain unique constraint would work in Postgres (NULLs are distinct) but would
-- index every row in the table to enforce a rule about the few that are shared.
create unique index if not exists module_outputs_share_token_key
  on public.module_outputs(share_token)
  where share_token is not null;

comment on column public.module_outputs.share_token is
  'Unguessable link segment for a result the customer chose to publish. NULL means private, which is the default and the state of every row created before this migration.';
comment on column public.module_outputs.shared_at is
  'When sharing was last turned on. Survives revocation on purpose, so the customer can be told the result was public until they revoked it.';

do $report$
declare
  shared_rows bigint;
begin
  if to_regclass('public.module_outputs') is null then
    raise exception 'module_outputs is missing; the share columns have nowhere to live';
  end if;
  select count(*) into shared_rows from public.module_outputs where share_token is not null;
  raise notice 'module_outputs share columns present. Rows currently shared: %', shared_rows;
end
$report$;
