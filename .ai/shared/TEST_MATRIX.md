# Test Matrix

Updated: 2026-07-19 by Codex (Agent A)

## Production connectivity hardening — passed

- Main CI runs typecheck, lint, complete tests, build, client-secret scan, local route smoke, database/storage contract verification, launch configuration and route-registry verification, OpenAPI drift verification, and documentation-link checks.
- Exact-head SONARA Industries CI, dependency scan, Docker Image CI, Vercel Preview, and the first Production Connectivity run passed for PR #36 head `a7d7609ec67c7238d504724ecef57fbcfd4ddc57`.
- PR #36 merged with the exact-head guard to `aebee84129f3488d91bc51ea81aa0f8c423fc8e7`.
- Production deployment `dpl_7RzByXjMYwGp7C78CuNVC6AuiV8Q` reached READY on the exact merge SHA.
- Live `/api/health` returns HTTP 200 with Express, branch `main`, environment `production`, and the exact merge SHA.
- Live `/api/readiness` returns HTTP 200 with Supabase/account database, Stripe, signed updates, Resend/email, founder/admin protection, checkout, and all approved plans configured or enabled.
- Live `/api/support/status` returns a database-backed support queue, enabled email delivery, and `secretsExposed=false`.
- Public pages, compatibility redirects, the canonical manifest, install icons, service worker, offline page, cohesive assets, and brand mark passed the production smoke.
- Customer and admin routes fail closed without authentication.
- Invalid contact, organization-setup, and checkout probes fail without creating sessions or records.
- No Vercel runtime errors were found after deployment.
- The production workflow is configured to run after successful `main` CI, every six hours, on relevant pull requests, and on demand.

## Cohesive 2027 frontend integration — passed

- Runtime patch applies twice without changing output.
- Homepage loads cohesive CSS, base CSS, and JavaScript after the accepted interface engine.
- Canonical runtime registry contains SONARA Industries, SONARA One, the three product names/routes/logos, and approved `$0 / $7 / $19 / $39` pricing.
- Homepage renders live readiness states and never replaces a missing write with visual success.
- Product controls use tab semantics; founder milestones expose pressed state and visible text.
- CSS supports light/dark appearance, 44-pixel controls, mobile widths, and reduced motion.
- JavaScript adds no automatic sound or vibration and respects reduced motion.

## Organization setup compatibility — static and unauthenticated evidence passed

- Runtime patch applies twice without changing output.
- Hosted-compatible organization records include legacy requirements, deterministic slug, owner identity, and canonical membership.
- Partial-write retries reuse the deterministic organization rather than duplicating it.
- Failure logs contain sanitized status/code evidence only.
- Unauthenticated organization creation fails closed.

## Database and access evidence

- Production Supabase connection reports configured and the migration ledger remains 42/42.
- Database/storage contract verification covers 71 canonical tables, required functions, operational indexes, and seven private buckets.
- PR #36 changed no migration, RLS policy, secret, billing rule, or customer-data record.
- Google sign-in remains deferred.
- Qualified legal review remains open.

## Pending owner-authenticated evidence

- Deployed organization creation and membership write.
- Complete billing lifecycle and access relock.
- Real email delivery plus persistence.
- Tenant-isolation and private-storage denial.
- Physical-device and installed-PWA behavior.
