# SONARA ChatGPT → Claude Code — Free Platform Identity Guard
Prepared October 8, 2026. This packet states **ChatGPT work only**, not completed Claude work.

## Scope and owner direction
SONARA Industries parent + Business Builder™, Creator Studio™, Growth Studio™ on shared SONARA One app OS. Social media, marketplaces, storefronts are free to participate with a login; public browse may be open. Content moderation, rights/terms, tenant permissions, merchant processor charges and owner approval still apply. Scale industries in parallel without skipping full CI. Vercel project remains **OFFLINE/BLOCKED** per explicit owner instruction.

## Latest known source and change
Main at branch start: `9b89404e2ec6b588f5a88a3683fa2e9b19afc9d1`. Research/docs/previous issue handoffs exist on main. Open draft PR #466 at initial inspection has complete Node compatibility, SONARA One Validation, security intelligence and migration replay checks green, but SONARA Industries CI failed; inspect current exact-head workflows. New branch `codex/free-social-platform-auth-hardening-20261008` changes `lib/sonara-free-platform-surface-policy.cjs`: exact PostgreSQL UUID formatting for user and server-scoped tenant; prior regex `[0-9a-f-]{36}` accepted malformed dash patterns. It **does not replace server authentication or RLS**. `tests/free-platform-surface-policy.test.js` adds negative tests for malformed values, foreign scope, string-vs-boolean permission and moderation spoofing.

## Claude action plan
1. Fetch current main and open PRs; avoid overwriting concurrent work. Run exact branch head `pnpm exec mocha tests/free-platform-surface-policy.test.js`, full Mocha, Node24/26, lint, typecheck, launch verifiers, Browser Quality and security. Record real CI results; if red, do not merge.
2. Separate `policy_only` from live surfaces. The 12 matrix entries are not twelve shipped feeds or stores. Validate real login, sourced org membership, public directory read path, owner-only settings, moderation review, reporting/appeal, rights/licensing and age/safety controls before changing labels.
3. Model free participation as **no platform subscription/post/listing fees**; sellers' items, third-party processors, taxes, compute, storage and approved optional premium services need transparent terms. Do not imply free merchant processing or waive legally required obligations.
4. Next P1: connect parent company cross-ecosystem aggregation through **public, owner-consented projections only**, with source `organization_id`, creator rights/visibility, takedown propagation, rate limits, non-custodial settlement. Reuse existing `growth_channels`, `merchant_storefronts`, `creator_marketplace_entries`; no unnecessary duplicate tables.
5. Next P1: Excel/CSV safe import (type/size/virus/formula injection) and Microsoft/Google/Apple OAuth connectors with per-tenant scopes, credential vault, provider approvals and idempotent background jobs. No unsupported live claims.
6. P0 complete CI and original issues #457 and #460; need exact-head green and audited main protection. Supabase latest 178 migrations through `20261007130000`. No SQL changes in this branch. Keep Vercel OFFLINE.

## Return exact evidence
`LATEST_MAIN_SHA, BRANCH_AND_PR, FILES_CHANGED, TEST_COMMANDS_AND_RESULTS, GREEN_AND_RED_CI_URLS, LEGAL_AND_PERMISSIONS_REVIEW, DB_MIGRATIONS, PROVIDER_ACTIONS, VERCEL_OFFLINE_STATUS, NEXT_SAFE_IMPLEMENTATION`.
