# SONARA Database Query Contract Report

Date: 2026-07-18  
Owner: Codex (Agent A)  
Branch: `codex/database-query-contract`

## Scope

This change is a bounded operational database and server-query hardening pass. It does not add speculative product tables, alter customer rows, weaken RLS, expose provider credentials, or apply migrations to hosted production.

## Repository research performed

The runtime and existing migrations were traced for the active PostgREST paths used by:

- primary organization membership resolution;
- Business Builder owner/manager authorization;
- active/trialing paid-access checks;
- product service catalog listing;
- service request history;
- deliverable history;
- module-output history; and
- pending Business Builder employee invites.

The schema approach follows the repository's accepted Supabase/Postgres contract: append-only migrations, least privilege, RLS preservation, deterministic tenant resolution, server-side filtering, and indexes aligned to real `WHERE`, `JOIN`, and `ORDER BY` paths.

## Source-code changes

A required, idempotent runtime patch now:

- resolves active organization memberships deterministically with `created_at` and UUID ordering;
- resolves the compatibility Business Builder membership fallback deterministically;
- orders Business Builder manager lookup deterministically;
- rejects unmapped paid-product entitlement checks before issuing a malformed Data API query;
- filters billing entitlements server-side by active status and permitted entitlement key; and
- filters subscriptions server-side by active/trialing status and permitted plan key.

This reduces over-fetching and avoids deriving paid access from unrelated subscription rows.

## Database migration

`20260718193000_operational_query_index_contract.sql` adds eight evidence-backed indexes:

1. active organization membership lookup by user and creation order;
2. active Business Builder manager lookup by user and creation order;
3. active/trialing subscription lookup by organization and plan;
4. active service catalog listing by product and name;
5. service request history by organization, product, and newest creation time;
6. deliverable history by organization, product, and latest update;
7. module output history by organization, product, module, and newest creation time; and
8. pending employee invite history by workspace and newest creation time.

The migration adds no table, grant, public bucket, RLS bypass, seed row, user, provider, or autonomous executor. It asserts that every index exists and is valid/ready after creation.

## Verification added

`tests/database-query-contract.test.js` verifies:

- the runtime patch is idempotent;
- membership and manager lookups are deterministic;
- paid-access filtering is pushed into PostgREST;
- unknown product entitlement mappings fail closed;
- the canonical index list is unique and references canonical tables;
- the migration declares and asserts every index; and
- the migration does not create tables, grant privileges, or disable RLS.

The existing production-schema and Supabase-contract verifiers now include the operational index contract.

## Production status

This migration is repository-only until owner-approved hosted execution. Production was previously recorded at 39 applied migrations. Apply the pending database migrations in strict timestamp order, rotate the disclosed Supabase server credential first, then rerun:

- Supabase database and security advisors;
- schema/readiness RPC checks;
- positive member/owner authorization tests;
- negative anonymous and cross-tenant tests; and
- query/index inspection against actual table cardinalities.

No claim of hosted application is made by this report.
