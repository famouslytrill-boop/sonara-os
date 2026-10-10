# SONARA | ChatGPT -> Claude Code: Parallel Industry Scale Handoff
**Time:** 2026-10-08 America/New_York. **Type:** evidence-and-action packet, not a background job or claim of Claude work.

## Required operating context
Repository `famouslytrill-boop/sonara-os`; parent SONARA Industries, shared SONARA One application OS and three child products Business Builder™, Creator Studio™, Growth Studio™. User's updated priority: **develop multiple industry packs in parallel**, while all workflows are validated and reliable. **Do not insist that one end-to-end paid-customer workflow is a prerequisite to beginning industry work.** But do not confuse source implementation with production/customer proof.

**Production owner instruction:** keep public SONARA website temporarily offline. Vercel `prj_QN8mHacmlaJWSieVbjMFV5D7fmuY` last reported `live:false`, latest production deployment BLOCKED. Do NOT resume, alias, deploy, change settings or trigger customer actions without separate owner approval.

## Source and current evidence
- Initial `main`: `a790379fff300deacdafed31a8c99c1a9c5a3c86`. PR #455 was authored from that SHA and **merged by another actor while source/head CI was still running**. Resulting inspected `main`: `e64176a46f569ecf8c642626ce7fd93d0362053b`.
- #445, #446, #454 already merged before this pass; #453 previously merged. No open PRs before #455 was opened. Re-fetch latest branches and open PRs; do not assume old conflicted PRs are still open.
- PR #455 https://github.com/famouslytrill-boop/sonara-os/pull/455 (merged) added **17 declarative Business Builder industry templates** to `lib/sonara-workflow-planner.cjs` via the EXISTING allowlisted action grammar, and five tests to `tests/operations-automation-media-expansion.test.js`. `docs/business-builder/BUSINESS_TEMPLATE_SYSTEM.md` expanded to describe them.
- Pack labels: restaurant, food truck, trades, trucking, cleaning, retail, rentals, venues, manufacturing, real estate, professional services, delivery, salon, e-commerce, nonprofit, construction and facilities. Each includes `key`, `industry`, `trigger`, `steps`, `requiredRecords`, `disclosure`, `launchState:"template_only"`. The existing authenticated `GET /api/business/automations/templates` lists them; no new route.
- `validateWorkflow` continues to require known triggers/actions, max 20 steps and higher effective approval for sensitive outbound steps. Tests check sector coverage, uniqueness, every template valid, owner approvals, spoofed lower autonomy, forbidden actions and route behind `requireBusinessManager`.
- The #455 head `f49c96436a7861a1466d94519821f5a720b670de` showed Docker Image CI success and other workflows **pending/in progress** when last inspected. Because it merged before completion, **do not claim full suite passed**. Check current GitHub Actions on exact SHA and read failure logs. If failures, issue a follow-on review PR; do not manually weaken assertions.
- Documentation branch `codex/industry-scale-research-handoff-20261008` starts from `e64176a46f569ecf8c642626ce7fd93d0362053b` and adds `docs/research/2026-10-08-parallel-industry-engineering-marketing-pass.md` plus these handoffs. Read research before changing strategy.

## Supabase and security
Supabase `yqncsonkxgwhcxedgevk` ACTIVE_HEALTHY, 161 applied migrations through `20261007130000` (from #446); no SQL write, migration or provider activation in this pass. Security advisors at inspection: 66 RLS-enabled/no-policy informational findings, 8 authenticated-executable SECURITY DEFINER function warnings, one leaked-password-protection warning, one extension in public. No mass grants/index changes. Analyze effective function permissions, `search_path`, tenant read/write and role before a reversible migration.

Generated `docs/CAPABILITY_MAP.md` at inspected main: 957 registered HTTP operations, 303 pages, 338 matched OpenAPI API ops, 15 destination fallbacks, 59 formula evaluators, 178 migrations. These are source counts, not validation of the live experience.

## Claude next engineering tasks
1. Fetch current `main`, #455 merged head, any new PR/working branch and exact-head Actions. Check `AGENTS.md`, `CLAUDE.md`, `docs/HANDOFF_PROMPT.md`, `.ai/shared/HANDOFF_LOG.md`, `.ai/shared/TASK_BOARD.md`. Coordinate concurrent branch ownership.
2. Run Node 24 and pinned `pnpm@12.7.0`: `pnpm install --frozen-lockfile`, `pnpm exec mocha tests/operations-automation-media-expansion.test.js`, `pnpm test`, `pnpm run lint`, `pnpm run build`, `pnpm run verify:capability-map`, `pnpm run verify:gates`, and Browser Quality. Capture SHA+logs, do not claim green if check not completed.
3. If the new templates caused any failure, fix in a separate PR, keeping provenance, licence notices and generated inventory. No blanket skip of tests.
4. For parallel sector UI, build a **real industry selector with accessible labels, preview-only status and one visible primary action**, using existing auth and route registry. Do not render an enabled “Execute” button for template-only packs.
5. For durable activation, map existing table and membership boundaries, define workflow run/outbox/approval and provider authority. Prove cross-tenant denials, provider event idempotency, offline replay and budget exceptions in code before enabling any automatic dispatch/contact/payment.
6. Independently review merged #445 waitlist/booking and #446 checkout/campaign changes, migration 20261007130000, provider webhook configuration; do not assume all external integrations are live just because the migration is applied.
7. Maintain same standard across Creator Studio and Growth Studio, prioritizing accessible captions/audio/media rights, approved campaigns, verified customer receipts and no customer data leaks.

## Return packet to ChatGPT (fill ONLY after execution)
```
CLAUDE_ACTUAL_DATE_TIME_TZ:
LATEST_MAIN_SHA:
PR_455_WORKFLOW_SUITE_RESULT_AND_RUN_LINKS:
NEW_BRANCH_OR_PR_URL / HEAD_SHA:
FILES_MODIFIED_AND_USER_VISIBLE_CHANGE:
SECTORS_ADDED_OR_CORRECTED:
TESTS_PASSED / FAILED / NOT_RUN (exact command and SHA):
TENANT_AUTHORIZATION_AND_APPROVAL_NEGATIVE_TESTS:
SOURCE_INVENTORY_STATUS / REGENERATED:
SUPABASE_READS / WRITES / MIGRATION_IDS:
VERCEL_STATUS / DEPLOYMENT_ACTIONS:
PROVIDER_CONNECTIONS_AND_CUSTOMER_ACTIONS:
PRODUCTION_STILL_OFFLINE:
NEW_KNOWN_BLOCKERS:
REVIEW_OWNER_REQUIRED_FOR:
NEXT_HIGHEST_VALUE_SAFE_SLICE:
```
Never represent this prewritten handoff as work Claude has already completed.
