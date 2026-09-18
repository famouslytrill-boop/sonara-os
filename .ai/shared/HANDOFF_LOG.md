# Handoff Log

## 2026-09-18 - Codex - Node 24 production runtime / Node 26 compatibility proof

- Stacked runtime migration on top of PR #294 hardening rather than mixing scopes. Draft PR #295 keeps production and ordinary CI on Node 24, adds Node 26 as a blocking compatibility lane, and prewires Node 27 as manual/non-blocking only until an official release exists.
- Vercel project metadata confirms the SONARA project is configured for Node `24.x`; latest READY production deployment remains on merged `main` commit `6f52b33e69724ad6b8f5c6fa855a4cadc6edd879`. No deployment was triggered from this branch.
- GitHub exact-head runtime proof passed on Node `24.20.0` and Node `26.9.0`: dependency install, typecheck, lint, full test suite, and build all green in both blocking lanes. Node 27 correctly skipped on pull-request runs.
- First Node 24 dependency-scan attempt exposed a parser defect rather than failing tests: Node 24 changed the default `node --test` human-readable summary. The workflow now pins `--test-reporter=tap` and parses TAP's machine-readable count; existing suite floors were preserved. Replacement dependency-scan is green.
- Action/runtime health is green: 70 external Action references across 16 workflows resolve to seven reviewed Actions on `node24` or composite runtimes, and the network verifier reread eight upstream manifests at the exact pinned commits. No retired Node runtime is registered or referenced.
- Exact-head PR #295 workflows are green: Docker Image CI, dependency-scan, Node Runtime Compatibility, External Repository Health, and SONARA Industries CI.
- Next ordered gate: integrate PR #294 first, then retarget/rebase PR #295 onto the resulting `main`, rerun the complete exact-head matrix, and only then consider merge/deployment. No merge or production mutation was performed in this pass.

## 2026-09-18 - Codex - GitHub action v7 pin migration

- Upgraded `actions/checkout` to immutable v7.0.1 commit `3d3c42e5aac5ba805825da76410c181273ba90b1` across all workflows.
- Upgraded `actions/setup-python` to immutable v7.0.0 commit `5fda3b95a4ea91299a34e894583c3862153e4b97` across all workflows.
- Updated `scripts/verify-github-action-pins.mjs`; its supply-chain gate verifies all 64 external action references across 15 workflows.
- Did not change the Node application runtime; Node 24 migration remains a separate ordered change.

## 2026-09-14 UTC - Operations reconciliation merged; deployment held by live proof gate

- Merged current `origin/main` (`d83785fc`) into the reconciliation branch,
  committed as `74a9927f`, and merged PR #252 into `main` as `7e456965`.
- Post-merge local evidence: `pnpm test` passed 4,438 tests with 6 pending;
  build, lint, client-secret scan, route smoke, API contract, repository schema,
  OpenAPI, and governance gates passed. The repository contains 118 migrations,
  146 canonical tables, 8 operational indexes, and 7 private buckets.
- Fixed two gate findings during final verification: encoded analytics date
  filters at the PostgREST boundary, and made the request-tenant verifier
  portable across Windows and POSIX path separators. Updated migration counts
  in shared and owner documentation.
- Controlled production run `34815661993` started from merged main and passed
  protected credentials, dependencies, build, tests, secret scan, and lint. It
  stopped before migration or Vercel deployment at live member-read proof
  because `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SONARA_VERIFY_USER_JWT` were not present
  in the protected workflow environment. No secrets were added or printed.
- Remaining owner-controlled proof: provide the protected Supabase verification
  values, apply the two new append-only migrations through the controlled
  workflow, then rerun the Stripe live-price, catalog, storage, and production
  alias checks. Media providers/workers remain setup-required by design.

## 2026-09-13 UTC - Deterministic operations, media planning, and governance

- Rebased the launch reconciliation branch onto `origin/main` at `f5f57ab3`
  and merged the complete operations/media branch without removing current
  catalog or launch work.
- Added organization-scoped business analytics, reservation resources,
  waitlists, consent-aware mapping, employee PWA access, allowlisted automation,
  and truthful Creator Studio music/video workflow planning.
- Added a commercial integration activation policy covering terms review, rate
  limits, organization scope, server-only secrets, operator approval, and
  optional-only AI. Invalid connections remain disconnected.
- Added deterministic purchase-order approval, owner/manager role separation,
  fulfillment blocking, rate limiting, and a service-only atomic audited RPC in
  append-only migration `20260913190000_purchase_order_approval_controls.sql`.
- Updated OpenAPI and shared contracts. Focused tests, the 300-operation API
  contract, and the 118-migration/146-table repository database contract pass.
- Remaining proof: complete launch gate, pull-request checks, protected
  production migration application, authenticated tenant/role smoke tests,
  configured media worker/provider execution, and controlled deployment.

## 2026-09-10 UTC - Homepage visual reconciliation

- Audited the current Express-rendered frame against the shared design and frontend contracts. The homepage had the two-column hero grid available in CSS but rendered only the copy column, so its production presentation was flatter than the intended SONARA One interface.
- Added a real homepage workspace preview in `lib/sonara-page-frame.cjs` with honest readiness language and a direct readiness link. It does not claim provider, billing, or database success.
- Added responsive styling in `public/sonara-application-ui.css`; the preview remains visible on mobile, fits within the viewport, keeps status text readable, and preserves the existing reduced-motion and touch-target rules.
- Verification: `pnpm run build`, focused brand-route/motion tests (6 passing), `git diff --check`, and `pnpm run lint` passed. Full suite remains the previously verified 4,377 passing / 6 pending at the reconciled main baseline; no provider secrets were read.

## 2026-09-09 - Usage-bounded reconciliation and photo intake

- Synchronized reconciliation branch with main ddac658e and Claude's registry/dependency repairs; original dirty checkout untouched.
- Added original customer-flow diagnostic skill and corrected GPL versus AGPL network-use guidance.
- Added docs/audits/PHOTO_REPOSITORY_INTAKE_20260908.md and USAGE_BOUNDED_COMPLETION_PATH.md; unresolved photo names are not installed runtimes.
- Frozen pnpm install, moderate dependency audit, git diff --check and full verify:launch passed. PostgreSQL replay skipped (binaries absent), live Stripe prices unverified (key absent), and 21 Python files unmeasured due to missing optional packages. Do not infer production readiness from this entry.
- Usage snapshot: 73% five-hour and 64% weekly remaining, zero reset credits. Cannot guarantee open-ended scope completion within account limits.
- Claude: follow the ordered evidence gates in the completion pathway and preserve the superseded database-repair stash without reapplying duplicate migrations.

## 2026-09-05 UTC - Production member-policy compatibility repair

- PR #216 merged to `main` as `7aa68a06235bfe44a1c9d5950caf34f5f0f0289c` after all exact-head checks passed.
- Controlled deployment run 33973274001 validated credentials, dependencies, tests, client-secret boundaries, routes, database contracts, project identity, migration preview, and rollback checkpoint creation.
- Production migration application then failed transactionally because hosted table `public.customers` exists without the canonical `organization_id` column. Vercel deployment and post-deploy verification did not run.
- Updated the still-generator-owned migration to test its required scope column before enabling RLS or creating a policy. Tables with an incompatible legacy shape remain unchanged and emit an explicit skip notice; canonical tables keep the intended member policy.
- Focused generator, policy, frozen-migration, and 145-table contract checks pass. The complete local release gate also passes with 3,802 tests and 6 explicitly pending. Follow-up PR, merge, and controlled deployment retry remain.

## 2026-09-05 UTC - Latest-branch release reconciliation

- Rebased the routing work onto `fc2b151b`, preserving all 14 newer registry records and adding 32 non-duplicate reviewed records for a 217-record, 213-unique-GitHub-target register.
- Regenerated the product integration map and handoff prompt from the reconciled registry instead of hand-merging derived output.
- Passed the complete local release gate with 3,801 tests passing and 6 explicitly pending, followed by build, lint, client-secret, route, database, policy, catalog, registry, JavaScript coverage, Python coverage, and documentation checks.
- Removed Windows-only gate failures without weakening checks: portable paths and line endings, cross-platform Python discovery, and fingerprint-bound reuse of V8 coverage from the successful release test run.
- Pull-request checks, merge, and controlled production deployment are the remaining steps in this session.

## 2026-09-03 UTC - Latest registry routing and Windows gate hardening

- Continued from the newest available remote development baseline, commit `8ce041a9`, in `codex/latest-content-hardening-20260902`.
- Added 32 non-duplicate governed records to the then-current register. That intermediate result was 203 records and 199 unique GitHub targets; the 2026-09-05 reconciliation above supersedes those totals.
- Preserved a 50-source social evidence manifest: 35 repository identities verified, 31 new register entries, 4 existing entries, and 17 unresolved or service-only sources left unguessed.
- Added `/technology-radar` as a public read-only governance page and protected technology-reference modules under Business Builder, Creator Studio, and Growth Studio.
- Kept blocked or restricted records unavailable and presented every repository as a reference, research item, or unavailable record rather than a connected integration.
- Fixed Windows-only false failures without weakening checks: system ZIP validation falls back from `unzip` to `tar`, path assertions normalize separators, saved dates use UTC, and migration checks normalize CRLF while `.gitattributes` pins `.cjs` and `.sql` to LF.
- Verification passed: 3,492 tests, lint, typecheck, build, route smoke, client-secret scan, 108-migration/145-table database contract, and all local governance gates.
- Local migration replay was not executed because PostgreSQL binaries were unavailable. CI remains fail-closed through `SONARA_MIGRATION_REPLAY_REQUIRED=1`.
- No external repository was installed or copied. No provider was enabled. No secret, deployment, merge, or production data change was made.

## 2026-07-26 UTC - Claude development reconciliation and deployment boundary

- Searched every accessible SONARA GitHub repository; only `famouslytrill-boop/sonara-os` is connected.
- Searched live branches, open and historical pull requests, recent commits, current workflow code, shared agent records, and Vercel production deployment metadata.
- No open Claude-generated pull request or live `claude/*` branch remains.
- The requested branch `claude/fix-deploy-service-role-secret` was confirmed as merged PR #101. Claude head `375a2ef1b3809be76ccd4f3a00a107d8d9f788a9` is an ancestor of current `main`.
- Current audited `main` is `fa9402a8671bae7934925c5c64f147a221bf4e16`, 45 commits ahead of the Claude service-role fix.
- Confirmed the production workflow still scopes `SUPABASE_SERVICE_ROLE_KEY` only to the credential guard and catalog database verifier. It is not exposed to dependency installation, build/test, Supabase migration, or Vercel CLI steps.
- Confirmed PR #100's recommended-product-catalog idempotency guard remains present.
- Confirmed the Claude-authored `brace-expansion` security override remains pinned to `5.0.8`.
- Confirmed later PRs #102–#104 build on the Claude baseline rather than removing its security behavior.
- Latest READY Vercel production deployment found reports commit `f730d51c4b7f18aa594685e3e38e09e43a9e2eac`; no READY deployment matching current `main` was found.
- Protected secret values were not read or copied. A successful exact-SHA controlled-production run is still required to prove secret presence and deployment completion.
- Added `.ai/shared/CLAUDE_SYNC_2026-07-26.md` and an automated agent-development verification script so future Claude/Codex sessions detect regressions in the secret scope, catalog idempotency, dependency override, and shared-state baseline.

## 2026-07-19 - Production connectivity hardening released

- User requested assurance that the software and its provider connections work correctly.
- Audited the live production deployment, route registry, CI workflow, PWA contract, database contract, readiness responses, protected-route behavior, and Vercel runtime logs.
- The pre-change production system was healthy, but CI did not run the complete route, database/storage, configuration, OpenAPI, documentation, and public-bundle verification suite; the live smoke checked only basic GET statuses.
- PR #36 expanded main CI and added `SONARA Production Connectivity`, which runs on relevant pull requests, after successful `main` CI, every six hours, and on demand.
- The production smoke now verifies exact deployment SHA, health/readiness/support semantics, public pages, redirects, customer/admin fail-closed boundaries, PWA/install assets, cohesive assets, secret leakage, and safe validation failures.
- Exact-head SONARA Industries CI, dependency scan, Docker Image CI, Vercel Preview, and Production Connectivity passed for head `a7d7609ec67c7238d504724ecef57fbcfd4ddc57`.
- PR #36 merged with the exact-head guard to `aebee84129f3488d91bc51ea81aa0f8c423fc8e7`.
- Vercel Production deployment `dpl_7RzByXjMYwGp7C78CuNVC6AuiV8Q` reached READY on the exact merge SHA and serves the production domains.
- Live health reports Express, `main`, production, and the exact merge SHA.
- Live readiness reports Supabase/account database, Stripe, signed payment updates, Resend/email, founder/admin protection, checkout, and all approved plans configured or enabled.
- Live support status reports a database-backed queue and enabled email delivery without secret exposure.
- Unauthenticated customer and admin requests fail closed, and no Vercel runtime errors were found after deployment.
- The release changed no migration, RLS policy, provider credential, billing authorization, customer record, or legal content.
- Owner-authenticated proof is still required for organization creation, a complete billing lifecycle, one real email delivery, tenant/private-storage isolation, and physical-device PWA behavior.

## 2026-07-19 - Cohesive 2027 frontend released to Production

- Preserved the accepted root Express runtime and `layout()` contract; no SPA migration was introduced.
- Added the canonical runtime registry for SONARA Industries, SONARA One, Business Builder, Creator Studio, Growth Studio, real routes/logo assets, and owner-approved `$0 / $7 / $19 / $39` plan prices.
- Added a server-rendered homepage that consumes the live non-secret readiness object.
- Added scoped cohesive styles, progressive product/milestone interaction, and the cohesive symbolic logo family.
- PR #34 merged to `988afc643b4c4633c1843e4d854b899782a8669a`; Production deployment `dpl_Gaa2kkogk3mPkFkUE6QcaM7TH1sG` reached READY.
- Supabase Postgres remains authoritative. No migration, RLS policy, secret, billing authorization, customer record, or legal content was changed.

## 2026-07-19 - Organization setup schema compatibility

- User evidence showed `Organization setup required` while readiness reported `accountDatabase=configured`.
- Repository migration evidence identified legacy required organization fields not supplied by the prior application insert.
- The merged compatibility patch uses a deterministic slug, writes the hosted-compatible shape, keeps canonical memberships, retries safely, and logs sanitized status/code evidence.
- No production schema migration or data mutation was included.
- An authenticated deployed organization-creation smoke test remains mandatory before the write path is called production-proven.

## Outstanding launch gates

## 2026-09-11 - Competitor-informed homepage pathways merged; Stripe provider gate remains

- Reconciled the public homepage against the internal competitor/reference research set (Jobber, Housecall Pro, ServiceTitan, Podia, Kajabi, Gumroad, Teachable, SamCart, Higgsfield, Brevo, Klaviyo, HubSpot, Stripe, Spotify/media-library patterns, GOV.UK plain language, and the governed external-repository registry).
- Added an honest homepage workspace preview and a visible quickstart pathway for Business Builder intake, Creator Studio assets, Growth Studio campaigns, and shared setup review. Added responsive styling with mobile-safe two-column and single-column breakpoints, focus states, and real routes.
- PR #233 merged into `main` at `498e4e92fca481c0de68d968e012e6c9285ceb51`; public-language correction PR #234 merged at `985b8341c75ba344187c9a42c487bb80143d8905`.
- Local build, lint, diff check, and focused customer-language/conversion/pricing tests pass. Controlled release run `34558599155` passed install, audit, build, release tests, secret scan, lint, route/config contracts, OpenAPI, open-source controls, production identity, and migration preview.
- Production promotion stopped at the live Stripe verification gate. The configured restricted key lacks `Prices:read` and `Products:read`, and several Vercel price variables are marked sensitive/redacted even though the verifier must read their non-secret `price_...` IDs. No secrets were printed, changed, or added, and the deployment was not bypassed.
- Owner action: use a Stripe key with the minimum read permissions required by the verifier (Prices:read and Products:read, plus existing checkout/webhook permissions), ensure each production `STRIPE_PRICE_*` variable contains its real `price_...` ID and is not stored as an unreadable/redacted secret, then rerun the controlled release. Recheck live checkout and webhook events after promotion.

- Confirm the protected production service-role secret exists without exposing it.
- Deploy current `main` through the controlled workflow and verify exact-SHA production aliases.
- Verify the two catalog migrations and exactly 34 production software-product records.
- Verify real positive and negative paid-plan entitlements.
- Authenticated deployed organization-creation smoke test.
- Isolated Preview backend configuration and verification.
- One real production email delivery with persistence evidence.
- Authenticated billing lifecycle and access relock.
- Authenticated tenant-isolation and private-storage denial checks.
- Google sign-in configuration when an approved redirect URI is available.
- Qualified legal review.
- PWA/browser and physical-device evidence.

## 2026-09-11 - Free-first integration substitution pathways documented

- Added `docs/INTEGRATION_SUBSTITUTION_PATHWAYS.md` with free/open-source
  candidates, adapter boundaries, license and operating-cost caveats, product
  pathways, rollout order, and integration acceptance criteria.
- Preserved the existing Supabase/Postgres, pgvector, Meilisearch, Stripe, and
  Resend contracts. No external repository was installed or copied.
- Open-Meteo, maps, worker media tooling, and self-hosted email remain gated by
  commercial terms, security, deliverability, consent, or operational review.
- This is documentation and architecture guidance only; it does not claim any
  provider is configured or customer-facing.

## 2026-09-14 - Direct workspace entry replaces intake in the primary path

- Updated the public homepage, shared dashboard, quickstart card, Business
  Builder landing actions, workspace actions, and workspace index so customers
  sign up, enter a workspace, use free tools, and compare real plans without
  being funnelled into an intake form.
- Kept `POST /api/business-builder/intake` and its database-backed behavior for
  compatibility with existing integrations. The authenticated GET path remains
  reachable but redirects to the Business Builder launch checklist.
- Added regression coverage for the direct `Start working` CTA, hidden intake
  navigation, and the authenticated compatibility redirect.
- Verification: build, lint, client-secret scan, route smoke, and the full test
  suite pass (`4438 passing, 6 pending`). The integrated launch verifier reached
  its expected protected Supabase proof boundary and stopped because this
  checkout has no `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, or `SONARA_VERIFY_USER_JWT`; no deployment or
  migration was bypassed.

## 2026-09-14 - Admin agent control-plane visibility

- Added protected `/admin/agent-activity` read-only operations view and linked it
  from the admin command center and generated admin navigation.
- The page reports only non-secret counts for recorded agent runs, waiting
  approvals, and schedules. It does not execute work, expose prompts or
  payloads, or widen the existing organization, approval, or audit boundaries.
- Missing Supabase access or agent tables renders setup-required instead of a
  false healthy state. The existing customer-facing `/owner/agent-activity`
  queue and approval flow remain unchanged.
- Verification: focused admin and route tests pass (18 passing); build, lint,
  route registry, agent sync, customer-ready checks, and the prior full suite
  remain green. No secrets, migrations, providers, or deployment settings were
  changed.

## 2026-09-14 - Public readiness preview uses the shared contract

- Updated the public SONARA One interface preview to derive database, checkout,
  support, and operator states from the existing readiness contract.
- The preview defaults to setup-required language when readiness is unavailable
  and never presents a static "Available" claim. It remains environment-only,
  exposes no credentials, and keeps the public route synchronous and safe.
- Added a page-frame regression test for configured and missing service states.
- Focused verification passed: build, lint, and 58 route/frame/auth tests.

## 2026-09-14 - Visual palette recalibration

- Rebalanced the working palette around evergreen operations, cobalt navigation,
  coral creative cues, and amber growth signals while retaining the existing
  SONARA logo gradients.
- Updated light, dark, and no-JavaScript fallback token blocks together,
  including Business Builder, Creator Studio, Growth Studio, and admin accents.
- Shifted ambient gradients, startup visuals, and Business Builder fallback
  colors without adding third-party assets, runtime dependencies, or route
  behavior changes.
- Bumped the shared immutable asset token to `sonara-ui-20260914-v12-palette`
  across the page frame, fonts, server-worker precache, and server cache note so
  existing browsers cannot pin the previous visual bundle.
- Verification: contrast, theme agreement, customer-ready checks, build, and
  lint pass. The palette remains reversible and no provider, secret, migration,
  or payment wiring changed.
