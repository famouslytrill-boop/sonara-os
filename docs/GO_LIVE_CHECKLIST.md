# Go-live Checklist

This checklist is the production launch gate for SONARA One. It is intentionally strict: critical items block launch until they are verified as ready.

## Launch Order

1. Run local validation.
2. Verify production domain, SSL, and canonical URLs.
3. Verify production environment variables in hosting.
4. Verify database migrations, RLS, auth, and admin protection.
5. Verify Stripe, webhooks, pricing, and support ownership.
6. Verify security headers and source leak scan.
7. Verify public pages, legal pages, onboarding, and mobile layout.
8. Confirm backup, rollback, monitoring, and post-launch operations ownership.
9. Approve launch only after critical blockers are closed.

## Local Validation

Run these commands from the repo root:

```bash
pnpm install --frozen-lockfile
pnpm run security:scan-artifacts
pnpm run validate:infrastructure
pnpm run typecheck
pnpm test
pnpm run build
pnpm run smoke
```

Use `pnpm run check` for the combined local gate when available.

## Critical Launch Blockers

- Domain does not resolve to the intended production deployment.
- SSL is missing, expired, or serving mixed-content errors.
- Required production env vars are missing in hosting.
- Database connection or required migrations are not verified.
- RLS policies are missing or untested for organization-scoped data.
- Admin routes expose private or elevated actions without role protection.
- Stripe live-mode config, pricing, or webhook verification is incomplete.
- Security headers are not active on the production domain.
- Source leak scan finds env files, secrets, service-role values, or source maps in public output.
- Backup and restore plan is missing or untested.
- Legal, privacy, pricing, support, or public claims are not approved.

## Admin Route

Use `/admin/go-live-checklist` for the live internal checklist view. The route is admin-ready and shows a no-go state while critical items remain open.

## Notes

- Do not run automated audit-fix commands without review.
- Do not change Vercel or hosting output settings without validating production build output.
- Do not commit real secrets or production credentials.
- Do not mark placeholder systems as launch-ready.
