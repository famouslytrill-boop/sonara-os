# Post Deploy Verification

## Automated verification

Install the locked dependencies and run the complete local contract suite:

```bash
pnpm install --frozen-lockfile
pnpm run verify:launch
pnpm run test:docs
```

Verify the deployed public system, provider-readiness flags, PWA assets, protected-route boundaries, and safe negative POST behavior:

```bash
BASE_URL=https://sonaraindustries.com pnpm run smoke:live
```

To verify that Vercel is serving one exact Git commit, include the expected SHA and allow time for deployment propagation:

```bash
EXPECTED_COMMIT_SHA=<full-git-sha> \
WAIT_FOR_DEPLOYMENT_SECONDS=600 \
BASE_URL=https://sonaraindustries.com \
pnpm run smoke:live
```

`SONARA Production Connectivity` runs this smoke automatically after successful `main` CI, on relevant pull requests, on demand, and every six hours.

## Supabase

Automated/static checks:

```bash
pnpm run verify:db
pnpm run verify:supabase-contract
```

Authorized operator checks:

```bash
pnpm exec supabase migration list --linked
pnpm exec supabase db lint --linked --level error
pnpm exec supabase db push --linked --dry-run
```

Manual proof gates:

- Run the authenticated organization-creation smoke against the deployed hosted-compatible schema.
- Run the tenant-isolation and membership tests in `docs/RLS_MANUAL_TESTS.md`.
- Confirm all required storage buckets exist and remain private.
- Test signed private upload/download, unrelated-user denial, and delete policy.
- Confirm the latest database backup and restore-test schedule.

## Stripe

Automated checks verify non-secret readiness, plan allowlist status, webhook configuration, and fail-closed unauthenticated checkout behavior.

Manual proof gates:

- Open checkout for every paid plan with an authenticated organization.
- Confirm the signed webhook is received and persisted once.
- Replay the provider event and confirm idempotency.
- Complete cancellation and failed-payment tests and confirm entitlement relock.

## Email

Automated checks verify that Resend and the database-backed support queue report configured without exposing credentials.

Manual proof gate:

- Send one approved production message and verify provider delivery plus the persisted delivery/audit record.

## PWA and devices

Automated checks verify the canonical manifest, legacy redirect, icons, service worker, offline page, public assets, and service-worker privacy boundary.

Manual proof gates:

- Install the PWA on a physical Android device and supported desktop browser.
- Verify online/offline behavior, update behavior, safe-area layout, touch targets, and authenticated-route privacy.

## Environment and security

- Vercel environment variables must remain server-scoped where required.
- Supabase service-role, Stripe secret/webhook, Resend, and administrator secrets must never be exposed to public assets or API responses.
- `SUPABASE_DB_URL` must not be present in frontend bundles.
- Google sign-in remains deferred until `GOOGLE_REDIRECT_URI` is configured and verified.
- Qualified legal review remains an owner-dependent launch gate.
