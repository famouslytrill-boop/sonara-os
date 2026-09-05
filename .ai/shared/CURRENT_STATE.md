# Current State

## 2026-09-05 latest-branch release reconciliation

- PR #216 merged to `main` as `7aa68a06235bfe44a1c9d5950caf34f5f0f0289c`. Its controlled deployment stopped at migration `20260819030000_member_read_policies_research_sources.sql` because the hosted legacy `customers` table has no `organization_id`; the transaction failed before Vercel deployment.
- Follow-up branch `codex/production-member-policy-compat-20260905` makes the generator verify each required scope column before enabling RLS or creating a policy. Legacy-shaped tables are left untouched with an explicit notice; canonical tables retain the same member-scoped policy.
- Active work is on `codex/production-member-policy-compat-20260905`, based on merged `main` commit `7aa68a06235bfe44a1c9d5950caf34f5f0f0289c`.
- The governed open-source register now contains 217 records and 213 unique GitHub targets. The latest branch's 14 records remain authoritative, and 32 non-duplicate reviewed records were carried forward.
- A public read-only `/technology-radar` and protected product modules at `/business-builder/technology`, `/creator-studio/technology`, and `/growth-studio/technology` route records without installing or enabling third-party code.
- The customer software catalog remains 42 active products. Repository references are not additional executable products.
- The complete local release gate passes on the compatibility branch: 3,802 tests pass with 6 explicitly pending, followed by build, lint, client-secret, route, database, policy, catalog, registry, coverage, and documentation checks. Review, merge, and controlled deployment retry remain next.
- Local migration replay is explicitly skipped because PostgreSQL binaries are unavailable. CI sets `SONARA_MIGRATION_REPLAY_REQUIRED=1`; production database proof remains owner/provider dependent.
- `.cjs` and `.sql` now use LF through `.gitattributes`, and applied-migration checks normalize CRLF so Windows checkout behavior cannot imitate a migration edit. The launch gate records V8 coverage during its one authoritative test run and reuses it only when a source fingerprint matches, avoiding a second Windows loopback-heavy test run without weakening coverage proof.

Updated: 2026-07-26 UTC after complete Claude/Codex reconciliation.

<!-- baseline: fa9402a8671bae7934925c5c64f147a221bf4e16 -->
<!-- superseded-by: docs/HANDOFF_PROMPT.md -->

**This is a dated audit record, not a live description of the repository.**
Everything below was true on 26 July 2026, and is written in the past tense for
that reason. The live picture is `docs/HANDOFF_PROMPT.md`, which is generated
from the repository by `scripts/generate-handoff-prompt.mjs` and therefore
cannot drift. Read that first; read this for what was decided in July and why.

The two HTML comments above are read by
`scripts/verify-agent-development-sync.mjs`. `baseline` names the commit this
document describes; while that commit is not the tip of `main`, the
`superseded-by` pointer is required. Refreshing this file to the current tip is
what allows the pointer to be dropped.

## Why this notice exists

Until 4 September 2026 this file opened with two present-tense claims that had
stopped being true: that `main` was `fa9402a8...`, and that no live `claude/*`
branch or open Claude pull request existed. By then `main` was `ccaea37...` and
origin carried eight `claude/*` branches. The release-chain command that reads
this file asserted five substrings were present and printed "shared state are
aligned" -- and all five were still present, so six weeks of drift never
surfaced as a failure. A check that cannot fail on the thing it names is the
defect `CLAUDE.md` describes, and this is a shared baseline two different
assistants read before deciding what to do.

## Source baseline

- The audited `main` on 26 July 2026 was `fa9402a8671bae7934925c5c64f147a221bf4e16`, the merge of PR #104.
- PR #104 added the v3 SONARA SVG identity family, light/dark startup and loading experience, reduced-motion behavior, PWA updates, and regression coverage.
- PR #103 added the premium conversion homepage, mobile conversion behavior, truthful proof policy, and visible lifecycle restrictions.
- PR #102 clarified the remaining production boundary for the 34-product recommended catalog.
- PR #100 repaired the recommended-product-catalog runtime transform so repeated apply/build/verification passes remain idempotent.
- PR #101 merged Claude branch `claude/fix-deploy-service-role-secret`; its head `375a2ef1b3809be76ccd4f3a00a107d8d9f788a9` is an ancestor of current `main`, which is 45 commits ahead.
- No open Claude-generated pull request or live `claude/*` branch was found **on that date**. That has since changed -- this line is kept as the record of what the July audit saw, not as a statement about now. Merged Claude branches had been deleted, but their commits remain in repository history.

## Deployment and secret boundary

- The controlled-production workflow still keeps `SUPABASE_SERVICE_ROLE_KEY` out of job scope.
- The service-role secret is bound only to the protected-credential guard and the production catalog database verifier.
- Dependency installation, builds, tests, Supabase CLI migration steps, and dynamically fetched Vercel CLI steps do not receive the service-role key.
- The temporary Vercel environment file is removed before deployment.
- GitHub does not expose protected secret values through this integration; secret existence must be proven by a successful workflow run.
- **Production lag, as measured on 26 July 2026:** the latest READY Vercel production deployment found reported commit `f730d51c4b7f18aa594685e3e38e09e43a9e2eac`, while source `main` was `fa9402a8671bae7934925c5c64f147a221bf4e16`.
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
