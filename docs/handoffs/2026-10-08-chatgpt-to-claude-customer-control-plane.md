# SONARA ChatGPT → Claude Code | Business Owner Operating Controls
**Written:** 2026-10-08 America/New_York. This is an exact known-source handoff, not a claim Claude has executed anything.

## Resume
Repository: `famouslytrill-boop/sonara-os`. GitHub main at branch creation: `f6586bffbcff2bb752d1430dbb0680a00a572d9c`. Working branch: `codex/customer-business-operations-readiness-20261008`. READ current heads on return; concurrent merges are common. User wants parallel scale across industry packs and customer-owned basic/advanced operating planes on SONARA Industries (parent), SONARA One (shared application OS), Business Builder™, Creator Studio™, Growth Studio™, with complete security, correctness and a simple accessible UI. Do not insist a fully paid customer funnel be finished before beginning additional industry architecture.

Production offline order: Vercel project `prj_QN8mHacmlaJWSieVbjMFV5D7fmuY` showed `live:false` and latest production deployment BLOCKED. DO NOT restart, promote, alias, redeploy or enable provider actions. Supabase `yqncsonkxgwhcxedgevk` had 161 applied migrations through `20261007130000`. No new migration, SQL, provider change or payment in this slice.

## Code changed
- NEW `lib/sonara-customer-business-operations.cjs`: pure business-specific read-only source/industry summary. Checks trusted organization/business match, exact owner ID, distinguishes source unreadable from 0 and capped reads, lists 17 allowed sector plans as `template_only`, denies escalation from a browser-supplied industry name. Approved customer messaging is still only *planned*, not run.
- MODIFIED `routes/sonara-business-control-plane-routes.cjs`: existing authenticated, scoped GET `/api/business-builder/businesses/:businessId` adds `operations` summary; existing business dashboard adds industry preview GET form, seven-source diagnostics and owner-only advanced settings/permissions links. Reuses existing organization-scoped `loadBusiness`, `permission("business.read")`, and resource/record querying. No new route or provider authority. The existing owner transfer UI was hidden from nonowners; check whether delegated business.update should still have profile access.
- MODIFIED `tests/business-control-plane.test.js`: five tests for no foreign org, no query privilege elevation, business API report on failed/capped reads, accessible owner console, member business.read denial/granted visibility.
- Research/architecture `docs/research/2026-10-08-sonara-customer-admin-operations-engineering-pass.md` covers future Creator/Growth owner planes, governance, schema reuse, sector analytics, deterministic methods, accessibility and truthful monetization.

## Sensitive engineering review checklist
1. Confirm owner-only UI controls cannot be emitted for an actor with only `business.read`, even if untrusted front-end/identity metadata says owner. Existing `permission()` trusts trusted `req.sonaraAccess`; recheck that authenticator verifies this for the right business and organization.
2. Non-owner access to business summary is intended only for a member with granted `business.read`; no customer contact/raw PII or secret is newly exposed in `operations`.
3. Verify source `rows=null` => count null/unavailable; hitting API page 25 => partial/lower bound; HTML 200 on readable source means *only* data can be read, not live provider/workflow correctness.
4. Verify 17 industry allowlist selector uses `?industry=` for preview only; does NOT persist business industry or run work; no external automations or paid generator billing.
5. Test HTML standard select and label, keyboard focus, owner-only links, safe escaping, 200%/400% reflow and real destinations; no “Run”/fake activation controls.
6. Existing repo issue #457 documents older 28 reservation/source test failures, five Playwright failures, duplicate route registry, generated Mocha file counts, etc. Fix them separately without weakening evidence. New source shifts may require `pnpm run capability-map:write`, `pnpm run fix:doc-counts`, `pnpm run verify:handoff` generators; never manually falsify values.
7. Pin Node 24, pnpm@12.7.0; run `pnpm install --frozen-lockfile`, `pnpm exec mocha tests/business-control-plane.test.js`, `pnpm test`, `pnpm run lint`, `pnpm run build`, `pnpm run verify:capability-map`, `pnpm run verify:gates`, browser tests, and workflow security. Every pass/fail must cite exact HEAD.
8. Validate Supabase RLS and eight warned privileged SECURITY DEFINER functions via read-only queries first; do not issue unreviewed production DDL.

## Customer-focused next P1
Move the same scoped *read-only* usage/test/proof/permissions pattern into Creator Studio and Growth Studio without replacing their route ownership or reusing another business's data. For durable workflow activation first map canonical DB, idempotency/approvals/usage, and tenant-specific role grants; separate PR with exact-head tests.

## Return fields
```
LATEST_MAIN_SHA:
BRANCH_HEAD_SHA:
PR_URL_AND_STATE:
FILES_MODIFIED:
CUSTOMER_OUTCOMES_AND_CONTROL_DESTINATIONS:
EXACT_HEAD_TESTS (target/full/browser/lint/build/schema/security):
REGRESSION_FAILING_TEST_NAMES / ROOT_CAUSE:
GENERATED_INVENTORY_COUNTS:
TENANT/OWNER GRANT NEGATIVE PROOF:
SIMULATED VS LIVE PROVIDER PROOF:
SUPABASE READS / MIGRATIONS APPLIED:
VERCEL ONLINE-OFFLINE AND DEPLOY ACTIONS:
SECURITY/LEGAL/ACCESSIBILITY REVIEW:
CHANGED OR NEW BLOCKERS:
NEXT SAFE PARALLEL WORK SLICE:
```
Do NOT say Claude has done anything until actual Claude output and GitHub evidence exist.
