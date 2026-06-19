# SONARA Industries

SONARA Industries is the Express/Vercel application for the SONARA parent site and the Business Builder, Creator Studio, and Growth Studio workspaces.

The app intentionally stays on Express/Node for the current production deployment. Do not add Next.js, React, or client-side secret exposure as part of this launch path.

## Product Areas

- Business Builder: service-business setup, intake, offers, customer records, orders, billing, and employee access.
- Creator Studio: assets, offers, releases, records, and creator workspace settings.
- Growth Studio: campaigns, leads, follow-ups, records, and growth workspace settings.

## Safety Rules

- Service-role keys, Stripe secrets, webhook secrets, Resend keys, and admin credentials stay server-side.
- Stripe Checkout session creation does not unlock paid access.
- Paid access unlocks only after Stripe webhook events record valid billing state in Supabase.
- Failed payments are audited but never unlock paid modules.
- Owner/admin roles can access internal modules for operations without creating fake customer entitlements.
- Legal pages and launch docs require owner and qualified legal review before paid public launch.

## Local Validation

Use pnpm only.

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm typecheck
pnpm build
pnpm run scan:client-secrets
```

## Deployment

Vercel routes all traffic to the Express serverless handler in `api/index.js`, which exports the app from `server.js`.

Required deployment files:

- `server.js`
- `api/index.js`
- `vercel.json`
- `pnpm-workspace.yaml`
- `package.json`

## Environment

Use `.env.example` as the source of truth. Keep real values only in local `.env`, Vercel, Supabase, Stripe, Resend, or a password manager. Never commit real provider credentials.

## Database

Supabase migrations live in `supabase/migrations/`. Apply them through the Supabase CLI or Supabase dashboard review flow. Do not commit generated Supabase temp state from `supabase/.temp/` or `supabase/.branches/`.
