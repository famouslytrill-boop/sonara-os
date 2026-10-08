# Claude -> ChatGPT / Codex return handoff — SONARA capacity pass
Prepared by ChatGPT on 2026-10-08 as an **input template**, NOT a report that Claude has run these steps. Claude or the next engineer must replace every UNKNOWN below with cited GitHub/workflow/test/database evidence after executing.

## Required short return state
Repository: famouslytrill-boop/sonara-os
Work branch: engineering/industry-capacity-model-and-handoff-20261008
Actual branch head at return: UNKNOWN — retrieve on return.
Actual main head at return: UNKNOWN — retrieve on return.
GitHub PR URL, draft/open/merged: UNKNOWN.
Vercel project live/offline status and deployed commit: UNKNOWN — do not presume READY equals live.
Supabase connected project migration count/latest checksum: UNKNOWN — reread.
No production unpause, provider spend, migrations, merchant money movement, outbound marketing or public legal publishing is authorized by this handoff.

## Previously evidenced baseline (not fresh after handoff)
Main commit 9d141e68d1ec14c037f92d1eebb3c2718d583c0a; full test 7,083 pass / 1 fail because generated handoff said 513 instead of 516 test files. Native migration replay failed historical P1 fixture drift on 25 policies under Node 22/24/26 x PostgreSQL 16/17/18. CI runs: https://github.com/famouslytrill-boop/sonara-os/actions/runs/37815158957 and https://github.com/famouslytrill-boop/sonara-os/actions/runs/37815158798 . Draft repair overlap in #508/#519/#526. This baseline must never be repeated as latest without fresh verification.

## Changed source inventory to review
- scripts/simulate-industry-capacity.mjs — pure input-validated deterministic throughput/concurrency/backlog/cost scenario model.
- package.json — plan:industry-capacity and verify:capacity-model, added self-test to verify:gates.
- docs/architecture/2026-10-08-industry-capacity-control-plane-pass.md — verified baseline plus planned customer-admin, free public network and traffic control.
- docs/handoffs/2026-10-08-capacity-pass-chatgpt-to-claude.md — execution handoff.
- this document — reciprocal handoff request.
All changes should remain reviewable and isolated from other actors' P0 migrations/CI branches.

## Evidence to fill, without skipping
- New script self-test stdout and exit code: UNKNOWN.
- Inputs, numeric outputs and invalid-argument denial results: UNKNOWN.
- Node 24 and 26 full Mocha counts: UNKNOWN.
- TypeScript/ESLint/build and every gate: UNKNOWN.
- Native PG16/17/18 migration replay: UNKNOWN.
- Playwright/browser keyboard/mobile accessibility: UNKNOWN.
- OWASP/security advisories with false-positive classification and post-change diffs: UNKNOWN.
- Real tenant RLS: authenticated member A allowed, tenant B denied, expired membership denied, cross-company profile no privilege: UNKNOWN.
- Social/marketplace/storefront free login onboarding and authenticated business-owner admin proof: UNKNOWN.
- Exact-SHA preview, error rates, trace/metric cardinality, load and database saturation: UNKNOWN.

## Priority follow-through
1. Get current heads. Rebase safely onto verified main and inspect draft PR intersection, especially #508/#519/#526 for CI and #529–#536 for social/security/reliability. Do NOT choose fixes by PR title alone.
2. Run the new self-test and break the model with adversarial numeric inputs; test self-test command and optional costs. Keep assumption labels and never substitute synthetic output for observed p95/p99.
3. Validate package release-gate registration without weakening older requirements. Fix new code in this isolated branch; do not create new Mocha test files unless the generated inventory and verifier are intentionally updated.
4. Ask repository admin to enforce branch rules/review/status checks and Vercel protected-production reviewers. GitHub connection's branch protection GET 403 does not prove the protection is absent.
5. Map real tenant-owned admin settings and free shared public projections into source-controlled routes, worktables, database migrations and policy tests in independently reviewable increments. Preserve publication and legal consent workflows.
6. Return verified pass/fail and unresolved items to ChatGPT so the next chat continues from evidence, not memory, while production remains OFFLINE.

## Required response schema for Claude or next engineer
CURRENT_MAIN_SHA:
CURRENT_WORK_SHA:
PR_LINK_AND_STATUS:
FILES_CHANGED:
COMMANDS_RUN_AND_RESULTS:
CI_RUNS_AND_EXACT_HEAD:
DB_MIGRATION_POLICY_EVIDENCE:
VERCEL_PRODUCTION_OFFLINE_EVIDENCE:
SECURITY_AND_ACCESSIBILITY_EVIDENCE:
PROPOSED_NEXT_SAFE_PATCH:
OWNER_ACTIONS_REQUIRED:
EVIDENCE_LINKS:

## October 8 continuation — Claude must report on new additions
Read `scripts/plan-industry-portfolio.mjs` (25 aggregate assertions), updated `scripts/simulate-industry-capacity.mjs` (21 assertions, overflow protection), updated `package.json`, updated `.github/workflows/industry-capacity-model.yml`, and the **new** `docs/operations/2026-10-08-live-postgres-traffic-baseline.md`. Exact baseline evidence: PostgreSQL 17.6, configured max_connections 60, 18 sessions (1 active, 0 waiting on locks), 4,862 retained pg_stat_statements entries, 21 evictions; cumulative temp files 6,651 and 18,127,702,078 bytes, not a disk-usage or per-second claim. A high-cost normalized query recorded 4 calls and 50,726.54 ms total; route attribution UNKNOWN. Do not expose raw SQL, tenant identifiers, credentials or private rows to monitoring.
Fill new return fields:
PORTFOLIO_MODEL_NODE24_TEST:
PORTFOLIO_MODEL_NODE26_TEST:
COST_OVERFLOW_REGRESSION:
POSTGRES_SLOW_STATEMENT_TO_AUTHORIZED_QUERY_MAPPING:
BEFORE_AFTER_REAL_LOAD_EVIDENCE:
REVISED_INDUSTRY_POOL_BUDGETS:
All remain UNKNOWN until tested. **Never fill unknown with assumed green**.
