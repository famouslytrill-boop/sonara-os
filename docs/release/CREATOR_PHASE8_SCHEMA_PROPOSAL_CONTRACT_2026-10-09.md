# Creator Studio — Phase 8: Proposal-Only Schema Contract
**2026-10-09 · Draft, stacked on PR #595 · No production migration or feature activation**

## Verified problem

CI on PR #595 head `82b49719ad427f01d6240dde9ddcbca5159b069c` reported:
- Native PostgreSQL replay, Node compatibility, Docker and dependency-scan **passed**.
- SONARA Industries CI **failed** at `Verify database and storage contracts`.
- `scripts/verify-supabase-contract.mjs` had three false negatives for default-off flags because `proposalExample.split("\\n")` split on the *two characters* backslash and `n`, not the environment file's actual line endings.

Replacing one spelling is necessary but not sufficient for a security-sensitive verifier: a future mistake could classify an unapplied SQL proposal as a live production table and green-light broken functionality.

## Implementation

`lib/sonara-pending-creator-schema-contract.cjs` is a pure verifier with an **exact three-table allowlist**:

| Proposed table | Proposal | Gate |
|---|---|---|
| `creator_world_bibles` | `docs/sql-proposals/creator-world-bibles-2026-10-09.sql` | `SONARA_CREATOR_WORLD_BIBLE_PERSISTENCE_ENABLED=false` |
| `creator_story_drafts` | `docs/sql-proposals/creator-story-draft-revisions-2026-10-09.sql` | `SONARA_STORY_REVISION_PERSISTENCE_ENABLED=false` |
| `creator_story_draft_revisions` | same revision proposal | same story flag |

For each proposed table, it validates that:

1. The environment example declares **exactly one** literal `FLAG=false` line. Both LF and CRLF are handled. Duplicate, `true`, empty or missing declarations fail.
2. The project route source actually checks `process.env.FLAG`; an unrelated README mention does not count.
3. The SQL proposal contains a matching `CREATE TABLE public.table`, `ENABLE ROW LEVEL SECURITY`, and an explicit `REVOKE ALL ... FROM public, anon, authenticated, service_role`.
4. The corresponding server adapter contains the exact table name. This includes the revision-history `HISTORY` constant, which the generic `*_TABLE` scanner would otherwise miss.
5. **No actual migration** contains the proposed `CREATE TABLE`. If it does, the build fails until a reviewed migration-bound contract replaces the temporary proposal-only designation.

`scripts/verify-supabase-contract.mjs` retains its independent unknown-table and canonical-migration checks. The pending names are neither added to `DATABASE_TABLES` nor to the reviewed extension inventory. A proposal only passes a separate review-stage test; it is never reported as deployed, callable, billable, or active.

`tests/sonara-pending-creator-schema-contract.test.js` uses source fixtures and mutation tests to demonstrate that the gate fails when any key security property is removed. All five test groups passed in an isolated JavaScript harness; **real Node and full repository CI results are pending**.

## Database and security research

Supabase distinguishes two separate layers: table privileges decide who can reach tables via the Data API; RLS decides which rows may be returned or modified once privileges allow access. SQL scripts in the proposed `public` schema must therefore prove *both*, and server secret keys must never be exposed to browser code. References:

- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/local-development/cli-workflows
- https://www.postgresql.org/docs/current/sql-revoke.html

**Not covered by this contract:** applying any migration, exercising real RLS role isolation, validating the proposed RPC under PostgreSQL, preserving existing data, testing concurrent save/archive conflicts, session-bound CSRF, quota economics, and verifying a live tenant canary. These remain mandatory subsequent release gates.

## Remaining ship gate

- Exact-head Node 22/24/26 CI, Mocha, typecheck, static analysis, dependency and container scan, OpenAPI and route coverage.
- Native PostgreSQL 16/17/18 replay including P0 tenant-denial and P1 exact policy checks.
- Independently reviewed, uniquely numbered Creator World Bible and story-draft migrations applied **first to disposable/staging databases**, with RLS/grants and transaction-race tests.
- Explicit owner approval, controlled one-tenant canary, deploy verification, monitoring and rollback. Leave all new Creator flags `false` until positive evidence exists.

**Commercial implication:** failing closed on uncreated tables is preferable to charging customers for a save action that cannot persist their writing. No customer release claims are made by this PR.
