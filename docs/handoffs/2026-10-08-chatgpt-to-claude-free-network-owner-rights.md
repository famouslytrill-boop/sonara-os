# SONARA ChatGPT → Claude Code — Free Network Rights, UGC and Owner Administration
**Prepared 2026-10-08**. This documents code performed by ChatGPT; **not** a claim that Claude has run any tests or implemented anything.

## Latest baseline at branch start
Repository: `famouslytrill-boop/sonara-os`; exact starting `main` `9d141e68d1ec14c037f92d1eebb3c2718d583c0a`. Branch `codex/free-network-owner-rights-guards-20261008`. The owner wants free login-based SONARA parent/Business Builder/Creator Studio/Growth Studio social network, marketplace and storefront participation; customer-scoped basic and advanced administration; research/implementation of SQL/API/media/marketing/legal and full passing tests. Existing 19 open PRs at time of inspection include RLS, production-gate, outbox, cross-browser CI and migration-replay work. **Refresh all current heads, claims and ownership before edits.** Do not overwrite active PR #526's handoff/Mocha-count work, #524/#522/#520 database hardening, #525/#521 release attestation or other active branches.

Production owner has **not** authorized bringing public site back online. Vercel `prj_QN8mHacmlaJWSieVbjMFV5D7fmuY` was `live:false`, latest production BLOCKED. Supabase `yqncsonkxgwhcxedgevk` 163 applied migrations through `20261008100000`; **none were added or run here**.

## Actual changes in branch
- `lib/sonara-free-platform-surface-policy.cjs`: `manage` on any of the 12 free surfaces requires independent strict-Boolean `actorCanManage` in addition to actor permission and exact tenant. `publish` and `comment` require a strict Boolean `termsAcceptanceVerified` from a current-version durable server acceptance receipt. Marketplace `publish` requires separate strict `rightsCleared` evidence plus moderation; basic drafting/create remains free. No provider, payment, UGC post or signed contract is generated.
- `tests/free-platform-surface-policy.test.js`: updated old marketplace publish passing fixture to require rights + terms and added 4 test cases for owner grant boundaries, cross-brand rights checks, all 12 brands' UGC terms and free reporting, and continued ordinary drafts/social free access.
- `docs/research/2026-10-08-free-network-owner-rights-ugc-hardening.md`: source-vs-live truth table, legal terms/rights receipt fields, future RLS migration design (NOT APPLIED), moderation/age safeguards, CSV/Excel + Microsoft/Google/Apple permissions, Stripe cost distinction, deterministic profitability and tenant read scopes.
- The reciprocal handoffs are under `docs/handoffs/`. Links and exact SHA must be verified.

## High-risk review requirements
- Existing `surfacePolicy` is pure **policy only** and currently only Growth's UI uses its static CATALOG for free text. Do not state new checks are enforced by all POST routes without actually wiring a trusted actor/tenant+versioned consent+rights adapter into those routes. Browser-supplied booleans are NEVER accepted as authority.
- Distinguish `actorHasPermission` for a business write from separate `actorCanManage` or `actorCanModerate`; both must derive from database/session authoritative claims.
- Marketplace rights require asset-specific source hashes, ownership/licence, effective rights in territory/time/medium and listing version, not an unchecked form. Legal drafts still need counsel and affirmative contract acceptance.
- Production UGC app requires block/report/mute, moderator handling, appeal and minor protections: https://support.google.com/googleplay/android-developer/answer/9876937?hl=en
- Any public parent-feed candidate must be a specifically approved/rights-cleared projection, not private tenant rows.
- Payments remain seller/processor-controlled according to reviewed Stripe Connect model; zero platform membership/listing fee does NOT imply zero item or payment-processing costs.
- Existing CI and database changes overlap heavily; keep this branch isolated; no SQL/grants, migrations, token reading, unpause or live customer action.

## Required exact-head verification
1. `pnpm exec mocha tests/free-platform-surface-policy.test.js`; Node 24 + Node 26 compatibility; `pnpm test`; `pnpm run lint`, build/route/generator checks; browser Chromium/Firefox/WebKit, migration replay/tenant RLS, CodeQL/supply-chain.
2. Examine actual GitHub Actions exact SHA. Record all red tests as blockers, not `passed`. If fixture updates cause real failure, fix the policy logic and tests only when preserving user security.
3. After review, in a different PR wire trusted terms receipts and rights evidence to live Growth/Creator/Business routes; do not blindly expose a new public root feed or create redundant tables.
4. Do not release; owner says website OFFLINE.

## Claude → ChatGPT return data, if Claude proceeds
```text
CURRENT_UTC_AND_LOCAL_TIMESTAMP:
MAIN_SHA / PR_HEAD_SHA:
PR_LINK / OWNERSHIP / STATE / REQUIRED_CI:
CODE_DIFF_AND_DECLARED_RUNTIME_EFFECTS:
TYPED_TENANT_AND_ROLE_AUTHZ_NEGATIVE_TESTS:
TERMS_ACCEPTANCE_VERSION_AND_HASH_VALIDATION:
MARKETPLACE_LISTING_RIGHTS_VERSION_AND_EXPIRY_PROOF:
TARGETED_TEST_RUN / ALL_TESTS / NODE_COMPAT / BROWSER / LINT / BUILD / MIGRATION_REPLAY:
PROVIDER_ACTIONS / REAL_USER_ACTIONS / SQL_CHANGES:
VERCEL_SITE_OFFLINE_VERIFIED:
KNOWN_PREEXISTING_VS_NEW_BLOCKERS:
NEXT_BOUNDED_SAFE_IMPLEMENTATION:
```
Never present this handoff as a record of work not executed by Claude.
