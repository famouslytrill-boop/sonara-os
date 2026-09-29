# SONARA Platform Reconciliation — 2026-09-29

## Decision

Treat the GitHub `main` commit `c4b96cd21b1c28f2a87073cb7f6aa172a5da8994` as the current application baseline. Do not merge the selected local June checkout directly: it is 2,695 commits behind and contains 44 pre-existing worktree changes. The current GitHub main has no open pull requests; PR #387 is merged.

An isolated worktree based on current main is being used for the reconciliation. It preserves the selected local tree and keeps its uncommitted changes out of this review.

## Verified repository state

- Current main is the Express/Vercel service with Node.js 24.x, pnpm 12.7.0, PostgreSQL/Supabase, Stripe, and optional provider adapters. Current dependency install used `pnpm install --frozen-lockfile`; 378 locked packages were linked, with no downloads.
- The existing architecture and research already cover deterministic workflows and formula validation, route/button completeness, tenant-scoped tables, media fallbacks, maps, notifications, observability, licensed repository intake, and cross-industry product positioning. This includes the 2026-09-23 Platform Advancement Wave, 2026-09-25 Market Expansion Execution Plan, and 2026-09-27 Platform Completeness and Market Convergence.
- The newest merged PR stack includes capability mapping, setup and navigation work, deterministic media exports, route completeness, and rejection of invalid formula inputs. These features are in current main; they are absent from the selected stale checkout.
- The declared `verify:all` gate passed after correcting malformed formula test and inventory-generator fixtures for the list-valued `ingredients` input. Both now exercise the recipe formula with a valid ingredient record. The generated inventory verifies at 47/47 formula evaluators, with no generated-map diff. The focused formula test and full suite pass; six tests are explicitly pending.
- Live Stripe prices, hosted provider credentials, deployment health, actual production database performance/advisors, and user-device audio/video/GPU output are not established by local tests. The gate also skips migration replay unless explicitly enabled, does not perform open-source network checks, and could not measure 21 Python files whose suites require packages absent from this environment. Report these as setup or live-evidence requirements, not as running capabilities.

## Evidence and platform implications

| Verified fact | Source | Engineering implication |
| --- | --- | --- |
| Supabase recommends grants and row-level policies for exposed tables, with operation-specific policy tests. Policies alone do not revoke broad grants. | [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) | Keep authorization in migrations and test allow/deny behavior for each operation and role. Do not add tables to solve navigation or presentation gaps. |
| Supabase recommends version-controlled migrations and staging/production separation; production migrations should run through controlled CI/CD. | [Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations), [Managing environments](https://supabase.com/docs/guides/deployment/managing-environments) | No remote dashboard schema edits or production migration in this local research wave. Confirm backups, staging replay, and release evidence first. |
| Stripe test clocks advance test-mode time to exercise subscription transitions and webhooks. | [Stripe Test Clocks](https://docs.stripe.com/api/test_clocks) | Expand deterministic billing lifecycle tests in test mode; a local pass does not verify live price IDs or live webhook delivery. |
| Vercel Web Analytics collects anonymized, cookie-free usage data, while usage limits and event charges vary by plan. | [Vercel Web Analytics](https://vercel.com/docs/analytics), [Usage and pricing](https://vercel.com/docs/manage-and-optimize-observability) | Prefer existing server-side, consent-aware analytics unless the owner accepts the data flow and cost for this project. |
| Node.js lists 24.21.0 as the latest 24.x LTS patch checked for this review; 26.x is Current. | [Node.js release index](https://nodejs.org/en/blog/release) | Keep production on the tested Node 24 line; treat a major/runtime migration as a separate compatibility change. |

## Fact, inference, recommendation, unknown

**Fact:** The canonical current repository already has a broad capability map, route registry, 269-record open-source register, generated integration map, deterministic formula/media contracts, and thousands of test cases. The full local verification gate currently exposes stale derived data and a test-fixture defect, not evidence that every hosted integration or user device is ready.

**Inference:** The largest near-term risk is release drift between the selected June checkout and current September main, followed by unverified live service configuration. Adding more frameworks or industry-specific systems before reconciling those states would increase maintenance and tenant/security surface without establishing customer value.

**Recommendation:** Advance in small, measurable increments from current main. Pick one customer segment and one end-to-end workflow; prove its UI path, tenant boundary, state transitions, external adapter setup, deterministic fallback, and completion metric before expanding the catalog. Keep optional AI outside the authority path for payments, access, scheduling, formula results, and irreversible actions.

**Unknown:** The exact front-end issue the owner is seeing; which hosted services and credentials are configured; production error/latency and customer-task data; supported target phones, browsers, codecs, and GPU budgets; and which manual setup steps the owner has already completed.

## Candidate next work — choose a bounded first slice

These are alternatives for the next product wave, not claims that every vertical or provider is ready. All reuse current platform foundations.

1. **Release and environment reconciliation:** document and automate the safe path from the selected stale checkout to current main, with clean-tree evidence, runtime checks, and a manual recovery guide.
2. **Home-service/trades work loop:** inquiry → customer → quote → booking/work order → completion evidence → invoice/payment status → follow-up.
3. **Restaurant ordering and operations:** menu/catalog → order → preparation/status → pickup/delivery handoff → payment reconciliation; POS hardware and tax integrations remain explicit adapters.
4. **Creator publishing and rights:** brief → asset provenance/consent → deterministic export → approval → publish record → campaign measurement.
5. **Privacy-safe growth marketing:** consented lead capture → suppression/opt-out → approved campaign → delivery receipt → conversion attribution, with human approval before send.
6. **Location and dispatch:** opt-in coordinates → geocoding/routing adapter → dispatcher review → job timeline; address-list and manual dispatch fallback when providers fail.
7. **Deterministic media studio:** user-owned inputs → pinned render profile → queued job → accessible progress/cancel/retry → validated audio/video/image exports and text fallback.
8. **Business analytics and forecasting:** audited source tables → explicit missing-data treatment → reproducible formulas → confidence and provenance → export; predictive AI remains advisory.
9. **Unified notification center:** preference and quiet-hour rules → deduped event → user-selected channels → receipt and retry status; sound and haptics opt-in.
10. **Open-source adapter portfolio:** select only one measured capability gap from the existing governed repository register; verify exact upstream, license, maintenance/security state, data egress, and cost before building an isolated adapter.

## Manual owner setup still required

1. In GitHub, review and merge the prepared reconciliation PR after its exact-head checks pass. Current PRs are already merged; this work creates a new, bounded PR.
2. In Vercel/Supabase/Stripe, confirm the intended project/environment, real provider setup, backups, and verified price/webhook records. Keep secrets in their approved secret stores; do not paste them into chat or source.
3. For any production database change, review its migration, restore evidence, staging replay, and release workflow before approval.
4. Reproduce the reported front-end problem on its target browser/device and provide the route or screenshot so the implementation can fix that exact behavior.
5. Install OS-level tools only for a selected capability (for example, a pinned isolated media worker). The current main dependencies install cleanly; no OS replacement, database upgrade, GPU/model download, or optional-service runtime is justified by this review.

## Stop conditions

Do not switch repository visibility, delete legacy files or data, upgrade a hosted database major, alter production credentials, enable a provider, run a production migration, send campaigns, publish, or deploy from this worktree without the corresponding owner approval and passing release evidence. User-facing sounds, vibration, recording, GPS, and notifications remain off or user-controlled by default.
