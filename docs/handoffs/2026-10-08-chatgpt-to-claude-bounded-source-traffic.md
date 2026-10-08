# SONARA ChatGPT → Claude Code: Bounded Data Fanout + Free Network Architecture
**Prepared 2026-10-08, America/New_York; authored by ChatGPT, not a record of Claude execution.**

## Important order of work
Maintain the owner's OFFLINE production website state. Continue parallel industry scale while repairing failing test/release gates; do not require one complete paid-customer workflow as a precondition to all other engineering. Legal, payment, provider, tenant/RLS and destructive actions need explicit owner review and verified authorization. Current parent is SONARA Industries, shared application platform SONARA One, child apps Business Builder™, Creator Studio™ and Growth Studio™.

## Connected evidence at start
- GitHub `famouslytrill-boop/sonara-os` main base `9d141e68d1ec14c037f92d1eebb3c2718d583c0a` (merge #507, consolidation of 18 PRs). **23 existing open PRs** were seen at start, including #508–#530; do not overwrite/merge/conflict with overlapping PRs, especially #519/#526 migration and handoff CI fixes, #529 free UGC/platform rights, #524/#520 RLS hardening, #525/#521 release browser attestations. Re-fetch each head.
- Vercel project `prj_QN8mHacmlaJWSieVbjMFV5D7fmuY` reported live=false, latest production BLOCKED. No production deploy or unpause.
- Supabase project `yqncsonkxgwhcxedgevk` had 163 applied migrations, ending `20261008100000_tighten_service_role_rls_policies`. No migrations were applied in this traffic pass.
- Main had no workflow_runs in the GitHub commit-run API snapshot at inspection; this is **no evidence of green tests**, not proof of a red or passing build.

## Source on branch `codex/bounded-business-read-fanout-20261008`
1. New `lib/sonara-bounded-source-reads.cjs`: `settledMapBounded(items, read, {concurrency:3})`, validates 1–8 integer cap, preserves input order, catches individual thrown reads without disclosing exception payloads, no request-wide failure if one source rejects. It is a PER-FANOUT limiter, not cross-request throttling or distributed rate limiting.
2. Modified `routes/sonara-business-control-plane-routes.cjs`: business owner dashboard seven source reads and scoped `GET /api/business-builder/businesses/:businessId` 11+ source reads now use three at a time. Existing business scope, auth, JSON HTML, source-null vs zero semantics and partial page bounds preserved.
3. Modified `routes/growth-studio-control-routes.cjs`: nine exact-count queries in campaign reporting now use bounded threes; campaign customer-payment list reads in 100-ID chunks now use bounded threes per batch operation, fail closed on malformed/failing sources; preserves per-currency/first-campaign payment attribution semantics.
4. Modified `tests/business-control-plane.test.js`: two new Business Builder tests for max-in-flight <=3, ordered results, provider error isolation, disallowed concurrency, honest nil counts, dashboard/API behavior and existing owner data scope.
5. `docs/research/2026-10-08-sonara-shared-network-traffic-and-contract-engineering.md`: parent free social + marketplace + storefront direction, pricing vs provider fees, moderation/licences/creator releases, customer-owned administrative controls, Excel/Google/Microsoft/Apple integration path, performance model and legal review gates. Research/requirements, not live feature proof.
6. Two-way handoff files (this and Claude return template). No runtime schema/route/provider, billing or permission mutation introduced.

## Verification (fill with actual exact-head CI, never infer)
Run pinned Node24 / pnpm frozen lock. Required focused:
```sh
pnpm exec mocha tests/business-control-plane.test.js tests/a-campaign-is-judged-on-what-its-customers-paid.test.js tests/a-campaign-says-whether-it-paid-for-itself.test.js
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm test
pnpm run verify:capability-map
pnpm run verify:gates
```
Also Chrome/Firefox/WebKit browser quality, supply chain scans, native migration replay, tenant adversarial and exact SHA CI. Diff routes for perf side effects. If read batching raises p95 latency, tune after measurement; do not claim a speedup from a concurrency cap alone. If tests fail, distinguish PR-head regression vs pre-existing consolidated main failures and repair on a new small PR, no weakening assertions or fake test counts.

## Free-market/social product boundaries
User's requirement: free login-based social media, marketplaces and storefronts across SONARA Industries and children. This is a future feature/entitlement policy, not permission to make Stripe fees, shipping, paid external media APIs or legal obligations free. #529 is already reviewing grants and UGC rights; coordinate there, don't create duplicate roles/tables in this performance branch. Separate user-controlled public visibility and private tenant data. Legal terms, UGC creator licences, media/voice releases and consent need human-reviewed versioned templates before publication.

## Next safe engineering
1. Confirm this branch's exact SHA, PR, checkout and CI jobs; repair any new regression.
2. Compare the Growth count/batch family on large datasets and provider 429/503, with privacy-safe OpenTelemetry spans. Per-request limit <=3 does **not** cap multiple simultaneous requests; design shared provider/tenant quota and async durable work in separate reviewed PR.
3. Fix upstream red release/migrations via the owned PRs #519/#526/#525 and the release-attestation chain. No unsafe merge storm.
4. Model shared free marketplace and social auth in PR #529; build UX only once hard role/consent rules prove correct.
5. Continue Creator/Growth per-organization admin settings, proof-based diagnostics and data ownership using existing consent/rights records.
6. Preserve Vercel OFFLINE state until owner separately approves a release after green exact-head testing.

## Return schema to ChatGPT (Claude fill with actual evidence)
```
CLAUDE_UTC_AND_LOCAL_TIMESTAMP:
MAIN_SHA:
BRANCH_SHA / PR_URL / REVIEW_STATE:
CHANGED_FILES_AND_DIFF:
TARGET_MOCHA_RESULT (exact SHA):
GROWTH_ATTRIBUTION_REGRESSION_PROOF:
FULL_NODE_24_26_MATRIX:
BROWSER_CHROME_FIREFOX_WEBKIT:
LINT_TYPECHECK_BUILD:
SCA_SECURITY_DB_MIGRATION_REPLAY:
MEASURED_P50_P95_P99_AND_MAX_CONCURRENCY:
TENANT_DENIAL / PROVIDER_NO_SIDE_EFFECTS:
ANY_SQL_OR_SCHEMA_CHANGES:
VERCEL_OFFLINE_CHECK:
SOCIAL_MARKETPLACE_PR_COORDINATION:
OPEN_CI_FAILURES:
NEXT_OWNER-APPROVED_TASK:
```
Do not represent this template as actual Claude work.
