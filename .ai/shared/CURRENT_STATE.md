# Current State

Updated: 2026-07-26 UTC after complete Claude/Codex reconciliation.

## Source baseline

- Current audited `main` is `fa9402a8671bae7934925c5c64f147a221bf4e16`, the merge of PR #104.
- PR #104 added the v3 SONARA SVG identity family, light/dark startup and loading experience, reduced-motion behavior, PWA updates, and regression coverage.
- PR #103 added the premium conversion homepage, mobile conversion behavior, truthful proof policy, and visible lifecycle restrictions.
- PR #102 clarified the remaining production boundary for the 34-product recommended catalog.
- PR #100 repaired the recommended-product-catalog runtime transform so repeated apply/build/verification passes remain idempotent.
- PR #101 merged Claude branch `claude/fix-deploy-service-role-secret`; its head `375a2ef1b3809be76ccd4f3a00a107d8d9f788a9` is an ancestor of current `main`, which is 45 commits ahead.
- No open Claude-generated pull request or live `claude/*` branch was found. Merged Claude branches have been deleted, but their commits remain in repository history.

## Deployment and secret boundary

- The controlled-production workflow still keeps `SUPABASE_SERVICE_ROLE_KEY` out of job scope.
- The service-role secret is bound only to the protected-credential guard and the production catalog database verifier.
- Dependency installation, builds, tests, Supabase CLI migration steps, and dynamically fetched Vercel CLI steps do not receive the service-role key.
- The temporary Vercel environment file is removed before deployment.
- GitHub does not expose protected secret values through this integration; secret existence must be proven by a successful workflow run.
- **Production lag:** the latest READY Vercel production deployment found reports commit `f730d51c4b7f18aa594685e3e38e09e43a9e2eac`, while current source `main` is `fa9402a8671bae7934925c5c64f147a221bf4e16`.
- No READY production deployment matching current `main` was found during this audit. Production must not be described as current until the controlled workflow completes exact-SHA alias verification.

## Catalog and entitlement boundary

- The recommended product catalog code and production controls are in source.
- Production still requires evidence that migrations `20260725180000_recommended_product_catalog.sql` and `20260725193000_product_catalog_production_boundary.sql` were applied successfully.
- Production must contain exactly 34 software-product records with the 10/8/8/8 company distribution.
- Paid product access remains restricted until real entitled-versus-unpaid or lower-plan production tests pass.
- `planned`, `validation_required`, and `setup_required` products must remain non-executable until their workflows and controls are operational.

## Security and dependency hardening

- The Claude-authored `brace-expansion@<=5.0.7` override to `5.0.8` remains present.
- Client-secret scanning, dependency audit, route verification, database/storage verification, OpenAPI checks, Docker validation, production connectivity, and external repository health checks remain part of the release system.
- Service-role values, provider secrets, and database passwords must never be copied into source, documentation, chat, artifacts, or client bundles.

## Remaining owner-authenticated proof

- Add or confirm the protected production `SUPABASE_SERVICE_ROLE_KEY` secret without revealing its value.
- Complete a controlled production deployment from current `main` and verify the exact commit on both production aliases.
- Verify production migrations and all 34 catalog records.
- Complete positive and negative paid-entitlement tests.
- Complete authenticated organization creation, billing lifecycle, real email delivery with persistence, cross-tenant denial, private-storage denial, and physical-device PWA verification.
- Configure Google sign-in only after the approved redirect URI is available.
- Obtain qualified legal review before treating legal language as final counsel-approved text.
