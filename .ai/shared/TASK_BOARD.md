# Shared Task Board

Updated: 2026-10-06 UTC during connected-account commerce convergence.

## Current visual integration

- [x] Reconcile the visible homepage frame and cache-busted public assets with
  the latest `origin/main` baseline.
- [x] Keep the first viewport readable and actionable across desktop and mobile
  widths without introducing a WebGL or provider dependency.
- [x] Complete full local tests, smoke routes, and final diff review.
- [x] Open the review PR and merge it after all required checks passed.
- [ ] Keep production deployment owner-controlled; no provider-side deployment
  was triggered by this design integration.

## In progress

- Claude, PR #439: stock moves with orders and jobs (done), and route data
  contracts 300 -> 0 with `routesWithoutDataContract` held at zero by the
  generator. Next: the 93 workspace-home destination fallbacks.
- Claude, PR #436: connected-account commerce -- marketplace sale chain (done,
  awaiting owner migration + review), storefront payment and reconciliation (in
  progress on the same branch). Locked in LOCKS.md; Codex please avoid those
  files until it merges.
- Owner: apply `20261005010000_a_sale_is_a_licence_delivered.sql` (and the
  storefront payment migration once it lands), create a Stripe Connect webhook
  endpoint for `/api/webhooks/stripe-connect`, set `STRIPE_CONNECT_WEBHOOK_SECRET`.


- Review, merge, and run the controlled production deployment for deterministic
  operations, Free Launch Stack, provider governance, and procurement approval.
- Apply `20260913190000_purchase_order_approval_controls.sql` through the
  protected migration workflow and verify manager/owner/cross-tenant behavior.
- Configure and prove an isolated media worker before enabling Creator Studio
  music or video processing; workflow planning alone is not execution.

- Merge the hosted-schema compatibility repair and rerun the controlled production deployment from the resulting `main` commit.
- Confirm exact-SHA production aliases and post-deploy health after the compatibility repair completes the controlled workflow.
- Obtain network repository-health evidence and CI migration replay for the current branch.
- Reconcile all Claude-authored development into the current source baseline and protect it with automated checks.
- Verify the next controlled production deployment reaches current `main` rather than the older deployed commit.
- Verify production migrations, catalog records, lifecycle restrictions, and paid entitlements after deployment.

## Blocked / owner-dependent

- Add or confirm the protected GitHub `production` environment secret named exactly `SUPABASE_SERVICE_ROLE_KEY`. Never paste its value into chat or source.
- Re-run or trigger the controlled production deployment after the secret exists.
- Complete an authenticated organization-creation smoke test against the deployed hosted-compatible schema.
- Configure an isolated non-production backend for complete Preview account testing.
- Complete one authenticated billing lifecycle and confirm access relock.
- Complete positive and negative production paid-entitlement tests for actual plan floors.
- Complete one approved production email delivery and verify persistence.
- Run authenticated tenant-isolation and private-storage denial tests.
- Verify all 34 production catalog records and the 10/8/8/8 company distribution.
- Configure Google sign-in after an approved redirect URI is available.
- Obtain qualified legal review.
- Complete PWA/browser and physical-device verification.

## Done

- Reconciled the latest main baseline with deterministic reservations, employee
  access, analytics, privacy-aware mapping, automation planning, and Creator
  music/video workflow work.
- Added fail-closed commercial terms, rate-limit, organization, operator, and
  optional-AI validation before provider connections can become active.
- Added role-separated purchase-order approval with a service-only atomic RPC,
  audit event, and fulfillment gate.
- Updated OpenAPI to 300 verified operations across 221 paths and passed the
  repository Supabase contract at 118 migrations and 146 canonical tables.

- Merged PR #216 as `7aa68a06`; every PR check passed. The automatic controlled deployment stopped safely before Vercel deployment when the hosted legacy `customers` table lacked the generated policy's `organization_id` column.
- Added a generator-level required-column guard so a legacy-shaped table is not altered and cannot abort the remaining production migration sequence.
- Passed the compatibility branch's complete local release gate with 3,802 tests and 6 explicitly pending.
- Passed the complete local release gate with 3,801 tests passing, 6 explicitly pending, and all build, lint, client-secret, route, schema, policy, catalog, registry, JavaScript coverage, Python coverage, and documentation checks green.
- Made the release gate portable on Windows without weakening it: path/EOL-sensitive assertions are normalized, Python discovery is cross-platform, and V8 coverage is reused only for an identical fingerprinted source tree after a successful test run.
- Added 32 non-duplicate governed repository records to the latest branch without replacing newer records or reviving retired URLs.
- Added a public Technology Radar and protected Business Builder, Creator Studio, and Growth Studio technology-reference modules.
- Preserved 50 social-source evidence records, mapped 35 verified repositories, and left 17 unresolved or service-only sources unguessed.
- Added cross-platform ZIP validation, deterministic UTC saved dates, path-normalized security tests, and EOL-stable applied-migration verification.
- Confirmed `claude/fix-deploy-service-role-secret` was merged as PR #101.
- Confirmed Claude head `375a2ef1b3809be76ccd4f3a00a107d8d9f788a9` is contained in current `main`.
- Confirmed there are no open Claude-generated PRs or live `claude/*` branches in the accessible SONARA repository.
- Confirmed PR #101's service-role secret remains step-scoped and absent from job-level environment variables.
- Confirmed PR #100's recommended-product-catalog apply script remains idempotent.
- Confirmed the Claude dependency override pins vulnerable `brace-expansion` versions to `5.0.8`.
- Merged PR #102 with the explicit recommended-catalog production boundary.
- Merged PR #103 with the premium conversion and mobile experience.
- Merged PR #104 with the v3 SVG identity, light/dark startup and loading system, reduced-motion behavior, and PWA updates.
- Added a Claude development inventory and refreshed shared current-state and handoff records.
- Added automated verification for secret scoping, catalog idempotency, dependency hardening, and shared-state synchronization.
- Expanded main CI to run complete build, test, lint, typecheck, client-secret, route, database/storage, configuration, registry, OpenAPI, and documentation checks.
- Added scheduled and post-main production connectivity verification with exact-SHA deployment waiting.
- Released organization setup compatibility, payload-size handling, production database groundwork, and paid-launch fail-closed controls.

## Current deployment evidence

- Current audited source `main`: `fa9402a8671bae7934925c5c64f147a221bf4e16`.
- Latest READY Vercel production commit found: `f730d51c4b7f18aa594685e3e38e09e43a9e2eac`.
- Production remains behind source until an exact-SHA controlled deployment proves otherwise.

## Convergence scope prerequisite — 2026-10-07

- [x] Inspect merged Claude #439 and keep active #440/#442 work separate.
- [x] Implement request-local scope binding from the management membership already verified by the server. Primary staff membership in another organization cannot select its records during that management request.
- [x] Pass 13 focused cases for actual resolver behavior, same-user workspace concurrency, actor mismatch and cleanup after errors.
- [ ] Pass the 10 real-server regressions and all release checks on the published scope branch.
- [ ] Add usable booking/resource/waitlist destination screens after their record scope is verified. The current 61 destination fallbacks remain open.
- [ ] Prove actual provider/customer commerce and physical-device execution; the scope fix and #441 source checks do not establish that evidence.

## Booking workflow convergence — 2026-10-07

- Creator PR #441 is ready: 6,341 tests and 34 Chromium cases passed at
  `cc629ed12097fea6b77d4ae8166b5d5bb9c0223c`.
- Management scope PR #443 is ready: 6,320 tests passed at
  `3ba58318eb91969ed8cb0e4c007d871048b15fa7`.
- This branch adds resource and waitlist screens linked from bookings, native
  form saves, workspace-preserving redirects and a conditional offer update
  that cannot revive or overwrite a changed booking. A recorded offer is not
  a customer notification or confirmed booking.
- Local checks: 24 focused controller/JSON equality tests pass. Six actual
  server workflow cases and four desktop/mobile browser cases await full CI.
- The intended destination closure is five existing endpoints. Regenerate and
  inspect the measured inventory before claiming any fallback reduction.
- Based on PR #443; merge that prerequisite first. PR #444 independently owns
  market-intelligence/prompt destinations and the destination evidence register.
  Do not replace its generator or fake Supabase nested logical-filter work.
- No production deployment, migration, customer message or live transaction.
