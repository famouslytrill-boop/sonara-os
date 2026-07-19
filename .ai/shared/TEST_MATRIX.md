# Test Matrix

Updated: 2026-07-19 by Codex (Agent A)

## Production connectivity hardening — in progress

- Main CI runs typecheck, lint, complete tests, build, client-secret scan, local route smoke, database/storage contract verification, launch configuration and route-registry verification, OpenAPI drift verification, and documentation-link checks.
- Production smoke waits for the exact expected Git SHA after successful `main` CI before testing the deployed domain.
- Live public pages return HTTP 200 with real main content and no placeholders, dead `href=#` links, or secret patterns.
- Compatibility redirects return their exact documented status and destination.
- `/api/health`, `/api/readiness`, and `/api/support/status` return valid non-secret JSON with production deployment, provider, database, support, checkout, and access states.
- Customer and admin routes fail closed without authentication.
- Invalid contact, organization-setup, and checkout POST probes fail without creating provider sessions or records.
- Canonical manifest, legacy redirect, icons, service worker, offline page, cohesive assets, and Trinity Loop mark load successfully.
- Scheduled production connectivity verification runs every six hours and can also be started manually.

## Cohesive 2027 frontend integration — passed

- Runtime patch applies twice without changing output.
- Homepage loads cohesive CSS, base CSS, and JavaScript after the accepted interface engine.
- Canonical runtime registry contains SONARA Industries, SONARA One, the three product names/routes/logos, and approved `$0 / $7 / $19 / $39` pricing.
- Homepage renders live readiness states and never replaces a missing write with visual success.
- Product controls use tab semantics; founder milestones expose pressed state and visible text.
- CSS is scoped to the homepage, supports light/dark appearance, 44-pixel controls, mobile widths, and reduced motion.
- JavaScript adds no automatic sound or vibration and respects reduced motion.
- Exact-head SONARA Industries CI, dependency scan, Docker Image CI, and Vercel Preview passed for `ed20a950425f35f088d6b4c718097c8c7cbb126c`.
- PR #34 merged with exact-head guard to `988afc643b4c4633c1843e4d854b899782a8669a`.
- Production deployment `dpl_Gaa2kkogk3mPkFkUE6QcaM7TH1sG` is READY on the exact merge SHA.
- Live `/`, cohesive CSS, base CSS, JavaScript, and Trinity Loop SVG return HTTP 200.
- Live `/api/health` returns HTTP 200 with branch `main`, environment `production`, and exact SHA.
- Live `/api/readiness` returns HTTP 200 with account database, Stripe, signed updates, email, founder/admin, and checkout configured or enabled.
- No Vercel runtime errors were found in the post-deploy verification window.

## Organization setup compatibility

- Runtime patch applies twice without changing output.
- Hosted-compatible organization records include private legacy requirements, deterministic slug, owner identity, and canonical membership.
- Partial-write retries reuse the deterministic organization rather than duplicating it.
- Failure logs contain sanitized status/code evidence only.

## Database and access evidence

- Production Supabase connection reports configured and the migration ledger remains 42/42.
- No frontend release migration, RLS policy, secret, billing rule, or customer-data mutation was included.
- Google sign-in remains deferred.
- Qualified legal review remains open.

## Pending evidence

- Exact-head CI and live production smoke for the connectivity-hardening branch.
- Exact-SHA production deployment and post-merge scheduled workflow evidence.
- Authenticated deployed organization-creation smoke test.
- Remaining owner-dependent launch gates recorded in TASK_BOARD.md.
