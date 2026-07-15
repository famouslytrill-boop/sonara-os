# SONARA Deployment Report

Date: 2026-07-15
Branch: `launch/sonara-complete-platform-upgrade`

## Deployment configuration

- Vercel remains the primary web path.
- `api/index.js` exports the root Express app.
- `vercel.json` keeps the full rewrite to `/api` and includes `public/**`, `routes/**`, and `lib/**` in the function bundle.
- Vercel install/build commands now use pinned pnpm.
- Docker now uses Node 22 and a frozen production pnpm install; it remains a secondary path and does not change public routing.
- Package, Vercel, and Docker commands no longer mix npm into the root release path.

## Automated proof

- Frozen install passes.
- Dependency audit reports no known vulnerabilities.
- Build, type/syntax checks, lint, 248 tests, secret scan, route smoke, launch-config verification, and route-registry verification pass.
- 124 required GET routes are registered; 343 total method/path registrations have no duplicates.

## Release status

This report does not claim production deployment. A branch push can create a Git-connected preview only if the remote project is configured for it. Production promotion, environment confirmation, migration application, domain checks, and post-deploy smoke tests remain authorized operator actions.

## Required post-deploy checks

1. Confirm the deployed commit and environment in Vercel.
2. Check `/api/health`, `/api/readiness`, `/products`, `/sitemap.xml`, login, one protected redirect, checkout setup, and one protected administrator route.
3. Inspect function errors/external API latency in Vercel Observability.
4. Verify Supabase, Stripe, and Resend dashboards without copying secret values into reports.
5. Promote only after provider and route evidence match this commit.
