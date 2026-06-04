# Massive Final Fix Plan

Date: 2026-06-04
Branch: sonara-one-full-project-update-v101
Base commit: 3049927

## Current State

Package manager: pnpm is the selected and only supported package manager. `package.json` declares `pnpm@11.1.1`, `pnpm-lock.yaml` exists, and no npm lockfile is expected.

Current scripts include lint, typecheck, build, route smoke, legacy checks, public-claims checks, environment safety, license/provider/technology registry checks, Supabase checks, GitHub Radar checks, app-store readiness, privacy data map, and `verify:all`.

Missing scripts found during inspection:

- `check:package-manager`
- `check-public-routes`
- `check:sitemap-robots`

Current public route gap:

- Core pages existed for home, product pages, pricing, about, security, contact, help, support, feedback, and root legal pages.
- Modern aliases were missing from the typed route surface: `/trust`, `/legal/*`, `/research-lab`, `/open-source`, `/docs`, `/api-webhooks`, `/integrations`, and `/changelog`.

Current protected route gap:

- App shell routes existed, but explicit aliases were missing for `/app/dashboard`, `/app/admin`, `/app/admin/github-radar`, and `/app/admin/integrations`.

Current auth state:

- Supabase Auth UI scaffolds exist for login, signup, callback, forgot password, reset password, security settings, readiness, and owner bootstrap.
- Production auth still requires Vercel environment values and Supabase Auth redirect configuration.

Current Supabase state:

- Supabase checks exist for environment, service-role safety, migrations, RLS, storage, and integration policy.
- Local Supabase validation remains provider/local-runtime dependent.

Current email/support state:

- Support/contact/help/feedback routes and readiness checks exist.
- Inbound routing and outbound email still require DNS/provider setup and tested mail delivery.

Current legacy references:

- Old public product URLs are redirect compatibility entries only.
- Historical old-name references are allowed only in audit/archive docs and migration comments.

## Repair Scope

1. Add missing package-manager, public-route, and sitemap/robots gates.
2. Add modern public route aliases and protected admin aliases to route types, router handling, manifest, smoke tests, and static sitemap source.
3. Preserve intentional legacy redirects.
4. Add missing launch docs for auth, deployment, branding, route SEO, and final reports.
5. Run pnpm-only install, audit, checks, lint, typecheck, build, smoke, Supabase checks, and full verification.

## Owner/Provider Input Still Required

- Real Vercel env vars
- GitHub Actions secrets
- Supabase Preview rerun and production migration approval
- Supabase Auth redirect URLs
- First owner account, organization, and active membership
- DNS, SSL, and Cloudflare Email Routing verification
- Outbound email provider configuration and test send
- Stripe/Square/PayPal setup
- Legal, privacy, and license review
- Final PR merge and production deploy approval
