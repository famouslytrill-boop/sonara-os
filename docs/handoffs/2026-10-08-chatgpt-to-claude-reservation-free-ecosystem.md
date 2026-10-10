# ChatGPT → Claude Code | SONARA Reservation CI + Free Login Ecosystem Handoff
**Prepared 2026-10-08 America/New_York. Never treat this handoff as automated Claude execution.**

## User authority & constraints
SONARA Industries parent, SONARA One shared application OS, Business Builder™, Creator Studio™, Growth Studio™. Owner expressly wants **parallel industry scaling** (not one paid workflow first), full-suite source correctness, customer-specific admin planes and a **free social/marketplace/storefront account service** for parent and each child. Login is enough for **ordinary participation**; paid seller products, independent processors, delivery or optional premium services may still cost money. Free participation is NOT permission to bypass moderation, tenant RLS, licence/copyright or financial controls. Vercel production **MUST REMAIN OFFLINE** until separate owner release authorization.

Repo `famouslytrill-boop/sonara-os`; branch created from main `3746b492e316dc0ad8e52cb8f5844227ee2a298d`, named `codex/strict-reservation-ci-and-free-platform-policy-20261008`. Refresh current heads and open PRs; other actors have repeatedly merged code before full CI passed. Github issues #457 (was closed but errors remained in older head) and #460 (branch protection) are important.

## Source changes in current branch
1. `routes/sonara-operations-expansion-routes.cjs` has stricter PostgREST malformed-read handling, paging truth on APIs, shared reservation/waitlist HTML renderer, native POST→303 return to VERIFIED membership workspace, HTML failed draft with 400/502 status and warning; strict capacity integer, owned location 404; waitlist contact/party/time/resource and tenant-owned service/customer/employee/location reference checks; UTC date-only input normalization; unconfirmed saves are not silently called success; offer mark CAS on BOTH booking status and original metadata, early already-offered idempotency, no customer notification claim, concurrent race yields 409. No new SQL or provider sends.
2. `lib/sonara-free-platform-surface-policy.cjs`: 12 declarative policy entries, 4 brands × 3 surfaces (social, marketplace, storefront), platform subscription/listing/posting fee ZERO, public browse possible, logged-in scoped member authority for writes, extra moderated public posting; never grants tool authority or checkout.
3. `tests/free-platform-surface-policy.test.js`: five policy/denial tests. Existing `tests/reservation-workflow-destinations.test.js` and `browser-tests/reservation-workflows.spec.js` are unchanged and are mandatory exact-head acceptance.
4. `docs/research/2026-10-08-free-sonara-social-marketplace-storefront-platform-engineering.md`: free platform, shared parent hub, optional commerce fees, existing SQL table map, reviewed future projection tables, legal terms/release form **draft schema** with owner/counsel review, scale/traffic and marketing plan. Nothing claims the planned composite parent feed is live.

## Live read-only facts
Vercel `prj_QN8mHacmlaJWSieVbjMFV5D7fmuY` live:false, latest BLOCKED. Supabase `yqncsonkxgwhcxedgevk` 178 migrations through 20261007130000. Public schema verified to contain `business_workspaces`, `growth_channels`, `growth_channel_posts`, `creator_listings`, `creator_marketplace_entries`, `merchant_storefronts`, `merchant_products`, `customers`, `customer_records`, `business_bookings`, `business_assets`, `business_locations`, `business_service_catalog`, `business_employee_profiles`. 8 Supabase authenticated-executable SECURITY DEFINER WARN remain; no SQL writes in this turn.

Prior main CI still failed reservation and browser tests + handoff Mocha count (504 stated vs 508 actual); the duplicate route registry bug **was fixed** by PR #459 and exact-head targeted Node24 tests passed. Full green still unproven. Main branch protection read denied (403) so owner needs to enforce and verify required status checks.

## Critical immediate QA
- Run exact head pinned Node24 / compatible Node26 `pnpm exec mocha tests/reservation-workflow-destinations.test.js`, `pnpm exec mocha tests/free-platform-surface-policy.test.js`, `pnpm test`, `pnpm run lint`, `pnpm run build` and `pnpm run verify:launch`; Playwright reservation desktop/mobile and security jobs. Refresh actual package scripts before execution.
- If native forms regress, match the **existing** unchanged reservation test (303 saved=resource/waitlist, workspaceId trusted, safe failed draft input) and browser fixture. Check error page 503 for malformed JSON, page limit 201/200 evidence, unknown vs no records, HTML escaping and full status display.
- Verify actual role/RLS guards remain `requireBusinessManager` and every reference query includes resolved organization_id. Race tests mutate booking metadata/status concurrently and require 409 + no overwrite. Audit newly introduced route code against fake Supabase and actual REST schemas.
- Existing `docs/HANDOFF_PROMPT.md` generator count drift must be fixed by running `scripts/generate-handoff-prompt.mjs`, not falsifying test.
- NEVER weaken booking, paid processing or RLS tests just to obtain green. If unresolved, keep PR draft/closed until proven. Do not merge failing exact-head.
- Original user wants Microsoft/Apple/Google/Excel and provider integrations; only plan read-only/OAuth scoped server-granted adapters until reviewed credentials, privacy and capabilities. No credentials or secrets in source/handoff.

## Recommended next simultaneous lanes
P0 release/CI: fix remaining native resource/waitlist, generated docs and route issues, restore full suite and enforce protections. P1 free market infrastructure: map existing growth channel + creator listing + merchant storefront into optional parent public projection with moderation, RLS, no new payment custody and owner-controlled source unpublish. P1 creator/growth customer admin control planes (tenant-scoped health, access, analytics, settings). P1 legal versioned terms/release receipts with counsel-reviewed jurisdiction registry and actual affirmative acceptance UI; avoid blanket assumed assent.

## Return actual work evidence (fill by Claude)
LATEST_MAIN_SHA / BRANCH / PR:
COMPLETE_LIST_OF_CHANGED_FILES:
NODE24_TARGET_TESTS / NODE26 / FULL SUITE / BROWSER:
EXACT_HEAD_ACTION_RUN_URLS:
RESERVATION_NEGATIVE_TESTS + CONCURRENCY:
FREE_LOGIN_SURFACE_POLICY_TESTS:
CURRENT_PRODUCTION_VERCEL_OFFLINE_STATUS:
SUPABASE_MIGRATIONS/APPLIED/ADVISORS:
LIVE_PROVIDER, EMAIL, PAYMENT ACTIONS:
NEW LEGAL/SECURITY BLOCKERS:
NEXT MOST VALUABLE SAFE STEP:
