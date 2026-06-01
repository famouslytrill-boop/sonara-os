# Launch Connection Checklist

Run before public launch:

- `pnpm run deployment:check`
- `pnpm run env:check`
- `pnpm run security:sync-check`
- `pnpm run paywall:check`
- `pnpm run security:scan-artifacts`
- `pnpm run validate:infrastructure`
- `pnpm run validate:migrations`
- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm test`
- `pnpm run build`
- `pnpm run smoke`

Manual checks:

- DNS points to the approved host.
- SSL is active for `sonaraindustries.com`.
- Metadata, sitemap, robots, manifest, and health endpoint are deployed.
- GitHub CI and branch protection are enabled.
- Vercel project/domain/env are verified.
- Supabase auth redirects and RLS are verified.
- Stripe test mode and webhooks are verified.
- Docker is skipped or documented.
- Rancher is skipped for MVP unless explicitly selected.
- Admin routes and owner-only routes are protected.
- Secrets are redacted everywhere.

Do not mark launch ready if any critical security, payment, auth, domain, or owner-confirmation blocker remains.
