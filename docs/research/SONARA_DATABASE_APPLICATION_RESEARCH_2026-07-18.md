# SONARA Database and Application Research — 2026-07-18

## Decision summary

SONARA already has a broad canonical schema: 71 application tables, 10 authorization/readiness functions, three required schemas, and seven private storage buckets. The immediate engineering need is not another speculative table expansion. The highest-value current work is to make active runtime queries deterministic, selective, indexed, testable, and safe under multi-tenant authorization.

## Findings

### 1. Tenant resolution

The root Express runtime selects one active organization membership with `limit=1`. Without an explicit ordering, PostgreSQL is free to return any matching row. The runtime should use a stable order and the schema should provide a matching partial index.

Decision:

- order active memberships by oldest non-null `created_at`, then organization UUID;
- retain existing compatibility fallbacks until live inventory proves they can be removed; and
- do not merge organization, business, and entity membership domains without the accepted compatibility process.

### 2. Paid-access verification

Paid access must continue to derive from persisted active entitlements or active/trialing subscriptions, never from a checkout redirect. The previous runtime fetched all organization subscription candidates and filtered them in Node.

Decision:

- push status and allowed-plan filters into PostgREST;
- limit the response to one qualifying row;
- return a fail-closed unmapped-product state before issuing an empty `in.()` filter; and
- retain owner/admin override behavior exactly as documented.

### 3. Operational indexes

Indexes were selected only for real runtime predicates and ordering:

- active organization membership resolution;
- Business Builder manager authorization;
- active/trialing billing lookup;
- active product catalog listing;
- tenant/product request and deliverable timelines;
- tenant/product/module output timelines; and
- pending employee invite queues.

General rules used:

- index foreign-key/filter columns used by actual queries;
- align composite column order with equality predicates followed by sort columns;
- use partial indexes for small active subsets where status is fixed by the runtime;
- avoid duplicate indexes when an existing unique index already supports the query; and
- avoid speculative indexes for hypothetical future pages.

### 4. Production migration safety

The operational index migration is append-only and uses `create index if not exists`. It does not modify RLS, grants, table definitions, storage policies, or customer data.

Operational caution:

- normal PostgreSQL index creation can hold locks; hosted application should occur during an approved maintenance window after table-size and index-advisor review;
- production remains unmodified until credentials are rotated and the pending migrations are applied in order; and
- index effectiveness must be confirmed later with hosted query statistics or `EXPLAIN (ANALYZE, BUFFERS)` against safe representative queries.

### 5. Application architecture

The current root Express/PostgREST MVP remains the accepted production runtime. This pass does not introduce a new ORM, framework migration, queue, cache, or external database dependency. Adding those systems before current authorization, billing, email, and production migration gates are proven would increase failure surface without improving the immediate launch path.

## Rejected changes

The following were intentionally not added:

- duplicate customer workspace or membership tables;
- speculative business, creator, or growth tables without active runtime use;
- public storage buckets;
- anonymous Data API grants;
- client-side provider secrets;
- automatic paid unlock from redirect state;
- RLS bypasses;
- destructive table consolidation; and
- autonomous agent execution.

## Next research after hosted migration approval

1. Measure actual table cardinalities and query frequency.
2. Review Supabase index and security advisors.
3. Inspect `pg_stat_statements` or equivalent hosted query telemetry.
4. Validate membership fallback usage before proposing normalization.
5. Validate Business Builder referential integrity before adding the deferred workspace foreign key.
6. Tighten generic OpenAPI payload schemas without changing deployed response shapes.
