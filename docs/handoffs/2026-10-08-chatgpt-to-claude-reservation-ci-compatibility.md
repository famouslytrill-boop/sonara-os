# ChatGPT → Claude Code | Follow-on CI repair
**October 8, 2026. Evidence from GitHub Actions, no completed Claude work claimed.**

Repo `famouslytrill-boop/sonara-os`. Main when this repair started: `31c77e701728a18eb1997359c6d1ccc6be1ead6b` (PR #461 merged, despite pending/failed exact-head tests). Branch: `codex/waitlist-ci-compat-20261008`. User wants full green, parallel industry growth, free-login parent/child social/market/storefront, legal templates and strict tenant-specific customer administration. Production Vercel must remain **OFFLINE/BLOCKED**; last Supabase check 161 applied migrations through `20261007130000`; no production changes in this repair.

### Exact evidence of remaining failures after #461
[Node 24 run #37741107105](https://github.com/famouslytrill-boop/sonara-os/actions/runs/37741107105) on #461 HEAD `cb14830c1f8b0f4e1eedce3d2721d6af9da7dc51`: 7013 Mocha tests passed, **8 failed**. The eight were:
1. Legacy real booking offer race error code changed `waitlist_entry_changed` → `waitlist_changed` (contract mismatch only; mutation correctly denied).
2-7. Older combined waitlist page had missing resource entry form/checkboxes, legacy browser `back=/business-builder/owner/waitlist` redirect/notice semantics, offer-no-notification copy, unreadable view. One test incorrectly expected invalid resource IDs to be *silently dropped and accepted*.
8. Plain-language crawl counted 124 protected/redirected pages; source documented 123 after a newly protected reservation resource page was added.
Browser run #37741107236 had **one** unrelated `ViewTransition opt-in disabled` pageerror on marketplace reconciliation desktop and 40/41 otherwise; previous head #37740910128 had all browser tests green, so investigate flaky browser transition and never suppress a legitimate pageerror.
PR #461's generated Mocha handoff now derives **509** matching files from `.mocharc.json` and exact tree, replacing stale 504. Its free-login policy and reservation forms remained source-only until actual release.
Issue #460 documents automatic/other-actor merges before exact-head green; cannot inspect branch protection (403).

### Changes in this branch
- `routes/sonara-operations-expansion-routes.cjs`: legacy manager-combined waitlist HTML and allowlisted back-to-waitlist redirects ONLY if no selected business workspace; preserved new separate workspaces' secure HTML; returns stable `waitlist_entry_changed` code on CAS conflict. No relaxation of tenant/resource checks and no money/sends.
- `tests/a-waiting-list-is-kept-on-a-page.test.js`: **strengthened** legacy JSON test to refuse invalid `resourceIds` 400 and then prove valid JSON POST remains 201, rather than accepting invalid and discarding input.
- `tests/plain-language.test.js`: updates auditable protected-route skipped count 123 → 124, with justification that manager-only reservation-resources page is purposely not readable by anonymous crawl. Other separate manager tests render its copy.
- Follow-on reciprocal handoffs. No migration or deployment.

### Immediate Claude review
Inspect exact current PR HEAD, Actions. Run `pnpm exec mocha tests/a-waiting-list-is-kept-on-a-page.test.js tests/a-waiting-customer-gets-a-recorded-offer.test.js tests/reservation-workflow-destinations.test.js`, full `pnpm test`, Node24/26, `pnpm run lint`, `pnpm run build`, native migration replay, browser desktop/mobile and generated docs check. Fail CI if any regress. Check overlapping route profile fallback, status 303 preservation only for trusted legacy internal page, malformed DB reads return 503, no accidental cross-tenant rows. A rejected malformed resource ID is a safety feature, never weaken again.

Keep issue #462 free ecosystem and #460 release governance open. Repo integration cannot enforce merge rules; authorized repository admin must. No live external social/payment/storage permissions activated or deployment performed.

Return to ChatGPT with actual SHA, PR, test pass/fail links, security/RLS/provider changes, Vercel offline confirmation, unresolved source failures and next safe slice.
