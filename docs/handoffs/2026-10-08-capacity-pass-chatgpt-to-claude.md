# ChatGPT -> Claude engineering handoff — SONARA capacity and cross-suite expansion
Prepared October 8, 2026 (America/New_York). This is an actual ChatGPT research and GitHub-write handoff, NOT a claim of Claude execution, production deployment, full suite green, legal acceptance or live payments.

## Read first, in order
1. Repository AGENTS.md and .ai/shared/PROJECT_MEMORY.md; source-of-truth current package.json takes precedence over stale memory text.
2. docs/HANDOFF_PROMPT.md and .ai/shared/HANDOFF_LOG.md; recognize some entries are historical.
3. docs/architecture/2026-10-08-industry-capacity-control-plane-pass.md.
4. scripts/simulate-industry-capacity.mjs and package.json scripts plan:industry-capacity, verify:capacity-model.
5. Open P0 issue #460 (branch protections) and issue #457 (suite) before touching release logic.

## Continuation source
Repository: https://github.com/famouslytrill-boop/sonara-os
This branch: engineering/industry-capacity-model-and-handoff-20261008
Starting main: 9d141e68d1ec14c037f92d1eebb3c2718d583c0a. Refresh exact SHA, PR file diffs, CI and live schema before doing ANY merge or writing.
This branch is an isolated review candidate; never treat code being present in a branch as production deployment.

## Confirmed release blockers
- Main full-suite CI run 37815158957 reported 7,083 passed, one failing count 513 != 516.
- Node 24/26 compatibility run 37815158721 failed same Mocha assertion.
- Native PostgreSQL replay run 37815158798 failed 25 historical P1 policy-drift assertions in all nine Node x Postgres lanes.
- Draft PRs #508, #519 and #526 provide mutually different repair strategies for those same P0 failures. Examine changed SQL and proof ordering, choose ONE coherent approach that preserves hardening semantics and immutable applied migrations, retest exact head.
- Production Vercel recent two BLOCKED, previous READY only historic. Owner-directed SONARA site remains OFFLINE; do not unpause, redeploy or promote.
- Supabase was ACTIVE_HEALTHY with 178 migrations; performance adviser 468 overlap WARN, security adviser 8 privileged helper WARN + public extension and password-protection WARN. No blanket mass migration.
- GitHub rulesets GET returned []; branch protection GET was 403 for connector. Human-admin verified enforcement and intentionally failing test PR required before any release.

## What this branch adds
1. Pure, side-effect-free multi-tenant fluid-capacity planning script, with strict finite input validation, optional explicit provider/egress cost and internal deterministic assertions. No real provider access or tenant data.
2. New package entry points with self-test in verify:gates. Avoid adding new Mocha files or modifying generated test file counts.
3. Research/specification mapping all four brands, industry workloads, free shared social/storefront/marketplace, business-specific admin and read/write security boundaries.
4. Reciprocal handoff files for human/agent continuation.

## Next execution lane (nonproduction only)
A. Fetch latest branch and main SHA; run corepack/pnpm install --frozen-lockfile; node --version; pnpm run verify:capacity-model; pnpm run plan:industry-capacity; pnpm run typecheck; pnpm run lint; pnpm test; pnpm run build; pnpm run verify:gates. Record failures verbatim. Don't erase failing tests.
B. Compare PR #508/#519/#526 side by side and select a single correct P1 RLS rollback probe ordering. Validate native PG16/17/18 replay. Do not apply production DDL to 'make the tests pass'.
C. Independently audit #529 free-surface policy vs actual route and tenant/RLS enforcement; #531 rate-limit durability; #532 paid entitlements; #533 Resend uncertainty; #534 source-read concurrency; #535 HTTP outcome; #536 telemetry privacy. No force-merging conflicting drafts.
D. Implement customer organization admin route authority and consent/review data only after exact current database inspection. Keep free login as the only SONARA subscription requirement for basic social/listings/stores; preserve optional checkout/provider fees and rights controls.
E. Validate real capacity assumptions via staging OpenTelemetry, k6, logs, DB query profiles and queue/outbox replays. Do not interpret the new calculator as a load test.
F. Coordinate AI-integrations, Microsoft, Google and Apple OAuth through provider-scoped consent and terms. No owner/provider creds copied into source.

## Required return packet Claude -> ChatGPT
Return exact branch SHA, changed file list, tests actually executed and raw pass/fail counts; CI run URLs, any Postgres replay proof; targeted before/after behavior, schema and RLS evidence, remaining blockers, open PR status, production offline confirmation and explicit owner actions needed. Never say green without a recorded fully passing exact-head matrix. If blocked, give a reproducible command and failing assertion.

## Hard guardrails
Owner explicitly bypassed making ONE complete customer workflow the current priority; prioritize broad industry foundation and admin planes. Continue writing safe isolated code, not claims. No live email/sms, payments, production migration, unpause, force-push, credential changes or legal publication. Use pnpm only; no fabricated metrics. Apply copyright, performer-rights and advertising disclosures, explicit consent, accessibility and moderation review.

## October 8 engineering continuation — added after original packet
A SECOND executable aggregate model, `scripts/plan-industry-portfolio.mjs`, is now on this same review branch, **not in production**. It models simultaneous per-suite/per-industry peak demand over one shared DB concurrency pool, calculates weighted mean operation time, total work units, backlog growth and incomplete (null) optional egress/provider costs. Includes 25 deterministic assertions (isolated V8 logic was checked; hosted Node24/26 CI remains unconfirmed). New pnpm scripts: `plan:industry-portfolio` and `verify:industry-portfolio`; the latter is in the existing release gate and Node24/26 capacity workflow. The single-industry model now refuses provider-cost numerical overflow rather than returning imprecise projections (21 assertions).
New source-of-truth read-only performance evidence: `docs/operations/2026-10-08-live-postgres-traffic-baseline.md`, including allowed SQL, cautious interpretation and non-leaking observations. PG 17.6 reported max_connections=60, 18 pg_stat_activity sessions, 1 active, 0 lock waits; the extension recorded 4,862 normalized statement entries and 21 evictions since October 5. Historial counters are not RPS. No real customer peak latency proof; the live site remains OFFLINE. A slow 4-call statement averaged 12,681.63 ms but is not yet mapped to a real user route. Do not add indexes or increase capacity from synthetic formulas alone.
Continue to refresh the exact PR head and do the scheduled Node24/26+PG16/17/18 verification; no CI green proof yet. Research corroboration: https://www.postgresql.org/docs/17/pgstatstatements.html, https://supabase.com/docs/guides/observability/inspect, https://opentelemetry.io/docs/specs/semconv/general/metrics/ .
