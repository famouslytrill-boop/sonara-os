# Post Deploy Verification

Run local checks first:

```bash
npm run build
npm run lint
npm run typecheck
npm run scan:secrets
npm run verify:security
npm run verify:db
npm run verify:heartbeat
npm run verify:entity-security
npm run verify:env
npm run verify:stripe
npm run verify:all
npm run verify:postdeploy
```

## Supabase

- `supabase migration list`
- Confirm `007_platform_infrastructure_ops.sql` and `008_entity_agent_operations.sql` applied.
- Run RLS tests from `docs/RLS_MANUAL_TESTS.md`.
- Run entity membership/manual RLS tests from `docs/RLS_MANUAL_TESTS.md`.
- Confirm storage buckets exist.
- Confirm no public reads on private buckets.

## Stripe

- Confirm checkout opens for each paid tier.
- Confirm webhook endpoint receives signed events.
- Confirm replayed events do not duplicate subscription state.
- Confirm canceled and failed-payment states are reflected.

## Storage

- Test public upload/download.
- Test private signed upload/download.
- Test unrelated user cannot access private files.
- Test delete policy.

## PWA

- Confirm `/manifest.webmanifest` loads.
- Confirm app name, icons, display mode, start URL, theme, and background colors.
- Confirm `/offline` renders.

## Backups

- Confirm latest database backup exists.
- Confirm storage backup plan exists.
- Confirm restore test schedule exists.

## Environment Checklist

- Vercel env vars set.
- Supabase secrets only in server/CI/local secret stores.
- Stripe secret and webhook secret server-only.
- `SUPABASE_DB_URL` not exposed to frontend.
