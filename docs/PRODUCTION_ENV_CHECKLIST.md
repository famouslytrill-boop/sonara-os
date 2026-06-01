# Production Environment Checklist

Production env vars must be configured in the hosting provider, not committed to the repo.

## Required Review Areas

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_MARKETING_URL`
- `NEXT_PUBLIC_SUPPORT_EMAIL`
- `NEXT_PUBLIC_COMPANY_NAME`
- Supabase public URL and anon key, if Supabase is enabled
- Supabase service-role key only in server-side hosting config, if used
- Stripe secret key only in server-side hosting config
- Stripe webhook secret only in server-side hosting config
- Stripe publishable key only as a public browser-safe value
- Stripe price IDs for all enabled billing plans

## Rules

- `NEXT_PUBLIC_*` values are browser-exposed.
- Server secrets must never be imported into client code.
- Service-role keys must never appear in public bundles, static output, docs examples, screenshots, or browser diagnostics.
- Production Stripe and Supabase keys must be configured in hosting settings.
- Do not use placeholder env vars for public launch.

## Verification

1. Compare hosting env vars against `.env.example`.
2. Confirm no real secrets are present in repo files.
3. Run:

```bash
pnpm run security:scan-artifacts
pnpm run build
pnpm run smoke
```

4. Use `/admin/diagnostics` to verify status without exposing raw secret values.
5. Use `/admin/go-live-checklist` to record launch readiness.
