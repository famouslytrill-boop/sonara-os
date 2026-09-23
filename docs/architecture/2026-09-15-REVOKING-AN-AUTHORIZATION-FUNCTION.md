# What revoking an authorization function actually does

Review by: 2026-12-15

`docs/SHIP_READINESS.md` item 3 records twelve `SECURITY DEFINER` authorization
functions reachable by the `authenticated` role over `/rest/v1/rpc/`, reported by
Supabase's security advisor. It says the advisor's remediation — revoking
`EXECUTE` — was deliberately not applied, because it

> "is exactly the change that could silently break every RLS policy that calls
> them: a policy evaluates as the calling role, so removing the grant can turn a
> working policy into a denial. Verifying that needs a database somebody can
> break — a preview branch — not a guess."

**That was right, and it is now measured rather than reasoned.**
`scripts/verify-migration-replay.mjs` arrived since it was written and builds
exactly such a database on every release. `pnpm run report:authorization-grants`
runs the experiment on one: a throwaway PostgreSQL cluster, the Supabase
primitives shimmed, all 129 migrations applied, and the reads attempted as the
`authenticated` role.

Everything below was measured on 15 September 2026 by that script.

---

## What was measured

| Read as `authenticated` | Baseline | `EXECUTE` on `is_org_member` revoked | Granted back |
|---|---|---|---|
| `public.activity_events` | reads | **refused** | reads |
| `public.intake_requests` | reads | **refused** | reads |

The refusal is `permission denied for function is_org_member`.

| Read as `authenticated` | Baseline | `EXECUTE` on `sonara_has_org_role` revoked |
|---|---|---|
| `public.intake_requests` | reads | reads |

Three things follow, and the third is the one that was not obvious.

**1. The caution was correct.** Revoking `EXECUTE` on a function a policy calls
breaks the read outright. Not a narrowed result set — a refused query.

**2. It is not silent, and it is reversible.** The error names the function, and
granting it back restores the read in the same session. An owner trialling this
would see the breakage immediately and could undo it.

**3. It fires on an empty table.** Both tables held no rows, so the policy
expression was evaluated for zero rows, and the query was still refused. So the
`EXECUTE` check is not per-row: revoking the grant breaks every read of every
policy-covered table at once, rather than intermittently depending on data. That
makes the failure easier to notice and much worse to ship.

---

## The blast radius is far smaller than "every RLS policy in the schema"

The sentence in `SHIP_READINESS.md` reads as though all 631 policies are at
stake. They are not, because `authenticated` cannot reach most of the tables
they govern.

`supabase/migrations/20260718064853_data_api_privilege_hardening.sql` revoked the
Data API defaults from `anon` and `authenticated` and re-granted **seventeen
tables by name**. A read of anything else refuses at the table grant, before RLS
is consulted at all.

Of those seventeen, **thirteen carry a policy calling one of these functions**
and four do not:

| Reachable by `authenticated` | Policy calls |
|---|---|
| `activity_events`, `billing_entitlements`, `billing_subscriptions`, `business_memberships`, `module_outputs`, `purchases`, `service_comments`, `service_deliverables`, `service_request_events`, `service_requests`, `stripe_customers` | `is_org_member` |
| `intake_requests` | `is_org_member`, `has_org_role`, `is_org_owner_or_admin` |
| `launch_checklist_items` | `is_org_member`, `has_org_role` |
| `huggingface_resource_catalog`, `service_catalog_items`, `user_notifications`, `user_roles` | none |

So the exposure to this change is thirteen tables, not the whole schema.

## Which of the twelve a policy actually calls

Counted over the 631 `create policy` statements in the migrations, with SQL line
comments stripped first:

| Function | Created by a migration | Policies calling it | Granted to `authenticated` |
|---|---|---|---|
| `is_org_member` | yes | **313** | yes |
| `is_entity_member` | yes | 25 | yes |
| `can_manage_entity` | yes | 15 | yes |
| `is_org_owner_or_admin` | yes | 9 | yes |
| `sonara_is_org_member` | yes | 9 | yes |
| `has_org_role` | yes | 7 | yes |
| `has_entity_role` | yes | 4 | yes |
| `sonara_has_org_role` | yes | **0** | yes |
| `is_admin` | **comment only** | 0 | — |
| `is_current_user_admin` | **comment only** | 0 | — |
| `has_scope` | **comment only** | 0 | — |
| `has_company_access` | **comment only** | 0 | — |

Two things in that table were wrong in my first pass and are worth stating so
nobody repeats them.

**Four of the twelve are not created by any migration.**
`20260819050000_record_undeclared_authorization_functions.sql` *records* them —
every line of their definition is prefixed `--`, deliberately, because their real
bodies live in the live database and writing a guess into version control would
be worse than the gap. My first scan matched `create function` inside those
comments and reported all twelve as created. Stripping SQL comments before
measuring is the same lesson `lib/sonara-comment-stripping.cjs` exists for, one
language over.

**`sonara_has_org_role` is created, granted, and called by nothing.** It is the
one function of the twelve where the recorded risk does not apply to anything in
this repository, and the experiment confirms revoking it changes nothing.

---

## What this does and does not license

**It does not license revoking anything in production.** Every figure here comes
from the migration history replayed to an empty database, and this repository
already knows production differs from it: four of these twelve functions exist
live and in no migration, and `product_modules` is a live table no migration
creates. A policy or a grant that exists only in production is invisible to this
measurement. `docs/owner/OWNER-STEPS.md` items 3 and 4 are still the owner's.

What it gives the owner is a narrower question than the one they had:

1. **`sonara_has_org_role` is the safe one to try first.** Created by a
   migration, granted to `authenticated`, called by no policy here. If
   production also has no policy calling it, revoking `EXECUTE` removes one RPC
   from the advisor's list at no risk. Confirming that needs the production
   policy list, which is a read.
2. **The other seven are a trade, not a bug.** Revoking them refuses reads on
   thirteen tables. Whether those thirteen are reached by `authenticated`
   directly at all is a separate question this repository can answer: the
   application serves its own reads with the service-role key, which is why
   `organization_id=eq.` filtering is the tenant boundary. If nothing a customer
   uses goes through PostgREST as `authenticated`, the grant can go — and if
   something does, it breaks loudly and reversibly.
3. **The four comment-only functions cannot be reasoned about from here at all.**
   Their definitions are recorded but not executable, so neither this experiment
   nor any check in this repository can say what calls them.

## Reproducing this

    pnpm run report:authorization-grants

About forty seconds, needs PostgreSQL binaries, and creates nothing outside a
temporary directory. It is not in the release chain: it answers a question rather
than guarding an invariant, and the answer does not change when the code does.
