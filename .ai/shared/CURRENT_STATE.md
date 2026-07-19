# Current State

- `main` at `aebee84129f3488d91bc51ea81aa0f8c423fc8e7` includes the cohesive 2027 public frontend, canonical SONARA registry, and production connectivity hardening released in PR #36.
- Vercel Production deployment `dpl_7RzByXjMYwGp7C78CuNVC6AuiV8Q` is READY on that exact merge SHA and serves `sonaraindustries.com` and `www.sonaraindustries.com`.
- Main CI now runs the complete test/build/lint/typecheck suite plus client-secret, route, database/storage, launch-configuration, route-registry, OpenAPI, and documentation verification.
- `SONARA Production Connectivity` verifies the production domain on relevant pull requests, after successful `main` CI, every six hours, and on demand.
- Its first pull-request run passed against Production, including public routes, provider readiness, PWA/install assets, protected customer/admin boundaries, and safe validation probes.
- Live `/api/health` reports Express, branch `main`, environment `production`, and exact SHA `aebee84129f3488d91bc51ea81aa0f8c423fc8e7`.
- Live `/api/readiness` reports Supabase/account database, Stripe, signed payment updates, Resend/email delivery, founder/admin protection, checkout, and all approved checkout plans configured or enabled.
- Live `/api/support/status` reports a database-backed support queue, enabled email delivery, and no exposed secrets.
- Unauthenticated customer and admin routes continue to fail closed.
- No Vercel runtime errors were found after the release.
- Google sign-in remains deferred because `GOOGLE_REDIRECT_URI` is not configured.
- Legal pages and pricing are owner-approved baselines; qualified legal review remains open.
- Supabase Postgres remains authoritative. PR #36 changed no migration, RLS policy, provider secret, billing authorization, customer record, or legal approval state.
- Authenticated organization creation, a complete Stripe payment/cancellation lifecycle, one real email delivery with persistence, cross-tenant RLS denial, and physical-device PWA behavior still require owner-authenticated proof before those paths are called end-to-end production-proven.
