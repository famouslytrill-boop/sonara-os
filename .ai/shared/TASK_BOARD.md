# Shared Task Board

Updated: 2026-10-07 UTC during workflow convergence; current PR #441 validation is in progress.

## Current visual integration

- [x] Reconcile the visible homepage frame and cache-busted public assets with
  the latest `origin/main` baseline.
- [x] Keep the first viewport readable and actionable across desktop and mobile
  widths without introducing a WebGL or provider dependency.
- [x] Complete full local tests, smoke routes, and final diff review.
- [x] Open the review PR and merge it after all required checks passed.
- [ ] Keep production deployment owner-controlled; no provider-side deployment
  was triggered by this design integration.

## Convergence in progress — source snapshot 2026-10-07

- Main inspected: `a8890755d8bdfdcf8f899f7ab1b235f8461d8840` (merged #439). Source evidence records zero route/data-contract review gaps and 61 workspace-home destination fallbacks. The full route map remains the authoritative generated index.
- Codex, PR #441: Creator seller reconciliation, verified financial-reader roles, private licence snapshot guards and customer receipt clarification are implemented. 82 focused tests and the full 6,341-test suite passed at `deea8f80971878cf9cf620b5723cfada0608ba8d`. The inventory is regenerated and lists every remaining destination endpoint/source. Current release gates and desktop/mobile Chromium evidence are tracked on the PR. Real provider/customer transaction proof remains open.
- #436/#437/#439 commerce payments, webhook recovery and stock linkage are merged. Their production acceptance still requires current migrations, configured connected accounts, signed events, fulfilment and receipts; source tests are not a live transaction.
- #440 LinkedIn organization execution remains active and separate from the commerce work. #442 leasing/licensing legal review remains separate from runtime code.
- Next P0 convergence work: resolve the remaining 61 destination fallbacks against actual workflows; prove Creator purchase → settlement → exact licence → private delivery → receipt → refund/dispute; prove merchant paid order → held stock → fulfilment → receipt → reconciliation.
- P1/P2 items remain open unless their own provider, device or customer evidence proves completion. Connector catalogues, media planners, vertical packs and app shells alone do not close those priorities.
- Owner/provider dependencies: verify the current commerce migrations and connected payment setup, then run approved real transactions. Never put secret values in chat or source.

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

## Historical completed work

The following entries preserve earlier checkpoints; their counts and branch status are historical.

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

## Earlier deployment evidence — current deployment not reverified in this update

- Current audited source `main`: `fa9402a8671bae7934925c5c64f147a221bf4e16`.
- Latest READY Vercel production commit found: `f730d51c4b7f18aa594685e3e38e09e43a9e2eac`.
- Production remains behind source until an exact-SHA controlled deployment proves otherwise.

## Booking workflow convergence — PR #445 — 2026-10-07

- Creator PR #441 merged on main at `538fa5cd84e7725f8e99fa39ce105ec143f8a9f0`.
  This workflow branch includes that update and the latest scope PR #443 head
  `0dea677c377eab0b161cdaa16ba90e112ef21d39`.
- Adds resource and waitlist screens linked from bookings, native form saves,
  workspace-preserving redirects, and conditional offer writes that cannot
  revive or overwrite changed bookings. A recorded offer is not a message,
  time reservation or confirmed booking.
- Local verification: 24 focused tests pass. Six actual server cases and four
  desktop/mobile browser cases are included; full exact-head CI is pending.
- The intended destination closure is five endpoints. Check generated evidence
  before claiming a measured fallback reduction.
- Merge #443 first. #444 independently owns market/prompt screens, destination
  review evidence, and nested fake Supabase logical filters. Preserve those edits.
- No production deployment, migration, customer message or live transaction.
