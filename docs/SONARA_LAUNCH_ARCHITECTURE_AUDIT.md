# SONARA Launch Architecture Audit

Date: 2026-07-16

## Production path

- Repository: `famouslytrill-boop/sonara-os`
- Production branch: `main`
- Current work branch: `codex/paid-launch-completion`
- Runtime: root Express application in `server.js`, exported through `api/index.js`
- Vercel routing: every request rewrites to `/api`; the function bundles `public/**`, `routes/**`, and `lib/**`
- Package manager: pnpm 11.1.1 only
- Node runtime: Vercel project uses Node 24.x
- Frontend folders are not the production deployment root

## Working launch systems

- Public, legal, support, pricing, product, account, service lifecycle, and readiness routes
- Supabase email/password authentication with HttpOnly customer sessions
- Server-side owner/admin authorization
- Organization membership and tenant-scoped record access
- Stripe Checkout creation, signature-verified webhooks, billing event audit, and subscription-backed access
- Contact/support persistence with safe fallback references and Resend delivery state
- Product record APIs for Business Builder, Creator Studio, and Growth Studio
- Protected admin views for users, roles, database, storage, support, billing, webhooks, requests, and deliverables
- PWA manifest, service worker, icons, mobile quick navigation, and reduced-motion handling

## Design handoff implementation

The supplied Express handoff is reflected in the real server renderer, not a disconnected prototype. The homepage now uses the handoff's warm public surface, restrained navigation, editorial heading, real command-center DOM, product-specific cards, workflow band, truthful readiness proof, and mobile layout. Provider status comes from server readiness checks; no demo metrics are presented as live records.

## Supabase state

The supplied project host `yqncsonkxgwhcxedgevk.supabase.co` resolves and returns an authenticated boundary response. That proves the project host exists, not that migrations are applied. Remote schema verification still requires `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, and `SUPABASE_DB_PASSWORD`.

Core migrations cover profiles, organizations, memberships, roles, support, service requests, deliverables, module outputs, product records, billing subscriptions, webhook events, notifications, preferences, audit events, and RLS. Migration `20260716130000_launch_storage_buckets.sql` adds the seven runtime-checked private buckets with user/organization path policies.

## Launch blockers outside source control

1. Link the Supabase CLI and apply/review production migrations.
2. Add the public Supabase URL and anon key plus the server-only service role key in Vercel.
3. Configure and verify Stripe products, price IDs, webhook secret, and a live checkout.
4. Verify the Resend sending domain and delivery to support recipients.
5. Create the first owner and active organization membership.
6. Run provider-backed browser tests, then approve production deployment.

No native iOS target exists in this repository. The current mobile deliverable is the responsive PWA; App Store work requires a separate approved native-wrapper project.
