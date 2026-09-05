# Shared Task Board

Updated: 2026-07-26 UTC after Claude/Codex reconciliation.

## In progress

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
