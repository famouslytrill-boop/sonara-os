# Post-consolidation engineering repair — 2026-10-10

Base: main `6044be8e994f28c81001895f749b776055dc3b23`, after the owner merged #619.

## Research and implementation

OpenTelemetry requires `http.route` to represent a low-cardinality declared route template, never a raw URI. The shared SONARA helper intentionally rejects unknown resolved mounts. Keep that boundary: structured logs use the bounded `unmatched` diagnostic, while metrics now omit `http.route` entirely when no trusted template is available. Existing tests expecting child templates from rejected mounts were reconciled with the canonical stricter helper. A real Express request and instrument capture assert both instruments receive each request and never include customer identifiers.

Primary source: https://opentelemetry.io/docs/specs/semconv/http/http-metrics/

Main CI native replay failed in all nine Node/PostgreSQL lanes at the frozen closed-RLS browser-grant revocation migration. Inspected Node 26/PostgreSQL 18 job log: run https://github.com/famouslytrill-boop/sonara-os/actions/runs/38078655088 . Error: `closed-RLS browser hardening matched zero tables; refusing vacuous success`. The replay supplied bare PostgreSQL role/schema primitives but omitted existing-project Supabase default table DML grants. Supabase documents these defaults and distinguishes newer opt-in projects. The isolated replay setup now supplies exactly SELECT/INSERT/UPDATE/DELETE defaults for postgres-created public tables and schema usage for the three Data API roles before replay. It creates no SONARA object, rewrites no migration and does not grant all privileges to existing tables. This is a proposed existing-project replay correction; native PostgreSQL execution remains mandatory before claiming the CI failure fixed. New-project opt-in behavior is a separate compatibility requirement.

Primary sources: https://supabase.com/docs/guides/api/securing-your-api ; https://github.com/orgs/supabase/discussions/45329 ; https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html . Supabase changelog markdown was attempted but the retrieval service rejected its content type; official current documentation and the upstream platform discussion supplied the specific relevant behavior.

Campaign fixtures now distinguish a single-message receipt from a batch receipt and assert incomplete receipts stop after one provider call, record uncertainty, withhold charging and prevent automatic remainder sends. Both durable-record success and failure preserve the reconciliation requirement. No campaign was sent; provider responses are injected test fixtures.

The event claim fixture returns the actual RPC fencing owner rather than a row missing claimed_by. Foreign tenant/kind/producer tests retain zero-handler and zero-settlement assertions with the canonical claim_scope_mismatch outcome. Stripe generation-period fixtures include the configured Price, exact quantity and bounded item list, and assert the provider event-created stamp on both writes. The static ordering check anchors on the upsert request, not the earlier cancellation read. Checkout redirect tests retain the success discriminator from the hardened API.

## Verification

- 230 focused telemetry/campaign/event/billing tests passed, including existing outbox fencing tests.
- 33 focused replay/ownership static tests passed.
- Reintroduced unconditional unknown metric route: the new behavioral test failed, then passed after restoration.
- Removed documented legacy table DML defaults: the new static guard failed, then passed after restoration.
- Frozen pnpm install, moderate audit, lint, typecheck and build passed. No known vulnerabilities reported.
- Action-pin policy and environment classification passed. All 175 frozen migrations unchanged; 3 generator-owned.
- Final full-suite results are recorded in post-consolidation-failures.json.
- Local PostgreSQL binaries are absent. Native replay and real-browser execution are not verified by these static/unit checks.

## Remaining engineering order

1. Execute native replay on the corrected candidate; inspect the first remaining SQL/probe failure before rerunning all matrix lanes. Do not alter frozen migrations or fabricate public schema objects to make replay pass.
2. Reconcile paid-workspace/auth fixtures with authoritative plan and tenant state, preserving free-user denial tests. Reproduce actual customer-route failures independently before changing permissions.
3. Repair route/table inventory tracing and stale exemptions from actual source/migration definitions; retain negative probes for undiscovered/orphan resources.
4. Reconcile release-governance exact-head checks with current workflow structure; preserve fail-closed production protection and secret scoping.
5. Resolve contact, social disabled-schema, Search Console scope and plain-language contracts; rerun full suite and browser matrix.

This patch is not a release approval. Existing full-suite failures and pending native/browser evidence remain merge blockers. No production database, deployment, credential, entitlement or provider configuration changed.
