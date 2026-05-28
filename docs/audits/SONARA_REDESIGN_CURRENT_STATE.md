# SONARA Redesign Current State Audit

Date: 2026-05-28
Branch: `feat/sonara-platform-redesign-and-research-lab`
Repo root audited: `C:\Users\AXPAY\Documents\GitHub\sonara-os-platform-redesign`

## Audit Scope

This audit records the state after the CI gating fix and before additional feature work. It does not claim production readiness. It identifies what is already aligned with the current SONARA Industries architecture, what still exposes old public architecture, and what must be replaced, archived, redirected, deleted, or human-reviewed.

Current required public architecture:

- Parent company: SONARA Industries
- Products: Business Builder, Creator Studio, Growth Studio
- Shared moat: Trust Shield, Proof-to-Payment, Business Memory Graph, Smart Setup Wizard, Research Lab, Graph Builder, Files & Records, Access Control, Billing & Entitlements, Alerts & Signals, AI Governance, Customer Success, Launch Readiness

## Quality Gate Baseline

Sprint 0 was completed before this audit.

- `.github/workflows/sonara-industries-ci.yml` now uses `pnpm/action-setup@v4` without a hardcoded pnpm version.
- Root `package.json` is the pnpm version source: `pnpm@11.1.1`.
- CI uses Node `"22"`, pnpm cache, and root `pnpm-lock.yaml`.
- Root CI commands include `pnpm install --frozen-lockfile`, `pnpm audit --audit-level moderate`, `pnpm run typecheck`, and `pnpm run build`.
- Supabase preview skips with the message `Supabase preview skipped because required Supabase secrets are not configured.` when `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, or `SUPABASE_DB_PASSWORD` are missing.
- Local verification passed before this audit: `pnpm install --frozen-lockfile`, `pnpm audit --audit-level moderate`, `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, and `pnpm run build`.

## Current Routes

The root Next.js app currently has 96 route-related files under `app/`.

Public/customer routes present:

- `/`
- `/about`
- `/business-builder`
- `/creator-studio`
- `/growth-studio`
- `/pricing`
- `/pricing/business-builder`
- `/pricing/creator-studio`
- `/pricing/growth-studio`
- `/billing-help`
- `/contact`
- `/trust`
- `/login`
- `/onboarding`
- `/legal`
- `/legal/terms`
- `/legal/privacy`
- `/legal/refund-policy`
- `/legal/billing-terms`
- `/legal/acceptable-use`
- `/legal/ai-usage`
- `/legal/cookie-policy`
- `/legal/accessibility`
- `/legal/security`
- `/legal/data-processing-addendum`
- `/legal/subprocessors`
- `/legal/service-levels`
- `/terms`
- `/privacy`
- `/refund-policy`

App/dashboard routes present:

- `/app`
- `/app/dashboard`
- `/app/business-builder`
- `/app/creator-studio`
- `/app/growth-studio`
- `/app/research`
- `/app/files`
- `/app/customers`
- `/app/bookings`
- `/app/payments`
- `/app/reviews`
- `/app/campaigns`
- `/app/settings`
- `/app/settings/notifications`
- `/app/settings/billing`
- `/app/settings/security`

Admin routes present:

- `/admin`
- `/admin/organizations`
- `/admin/users`
- `/admin/billing`
- `/admin/audit-log`
- `/admin/integrations`
- `/admin/system-health`

API routes present:

- `/api/health`
- `/api/stripe/checkout`
- `/api/stripe/webhook`
- `/api/billing/portal`
- `/api/sonara/analyze`
- `/api/sonara/export`
- `/api/sonara/generate`
- `/api/sound-discovery/sync`
- `/api/cron/sonara-maintenance`

Missing routes from the requested redesign plan:

- `/research-lab`
- `/research-lab/open-source`
- `/research-lab/open-source/[slug]`
- `/research-lab/model-comparison`
- `/research-lab/creator-tools`
- `/research-lab/growth-intelligence`
- `/research-lab/multimodal`
- `/research-lab/safety-review`
- `/research-lab/crawling`
- `/app/research/model-comparison`
- `/app/research/model-comparison/new`
- `/app/research/model-comparison/history`
- `/creator-studio/tools`
- `/creator-studio/tools/animation`
- `/creator-studio/tools/open-source`
- `/creator-studio/tools/video`
- `/creator-studio/tools/design`
- `/creator-studio/tools/ai-agents`
- `/growth-studio/intelligence`
- `/growth-studio/content-signals`
- `/growth-studio/recommendation-research`
- `/open-source`
- `/open-source/philosophy`
- `/open-source/third-party-notices`
- `/open-source/license-policy`
- `/legal/open-source-policy`

## Current Navigation

Root public navigation is defined in `components/PublicShell.tsx`.

Current top nav:

- Home
- Business Builder
- Creator Studio
- Growth Studio
- Pricing
- Trust
- Login

Required but missing from top nav:

- Research Lab

Footer notes:

- Footer legal links point to the current `/legal/*` pages.
- Footer `Status` points to `/app/system-health`, but the current app has `/admin/system-health` and no `/app/system-health`. This is a broken or unfinished route mapping.
- Footer `Integrations` points to `/app/integrations`, but no `/app/integrations` route currently exists.

## Current Homepage Copy

Root homepage is `app/page.tsx`.

Current hero:

- Headline: `Build. Create. Grow.`
- Subheadline: `SONARA Industries powers Business Builder, Creator Studio, and Growth Studio through shared infrastructure engineered for trust, speed, and scale.`

Already aligned:

- Parent brand is SONARA Industries.
- Current products are Business Builder, Creator Studio, and Growth Studio.
- The old hero `Independent systems. Shared infrastructure. Stronger markets.` is not the active root homepage hero.
- Homepage avoids fake customer logos and fake dashboard metrics.
- Trust and pricing sections warn against guaranteed revenue, guaranteed compliance, and guaranteed cybersecurity claims.

Still incomplete:

- No dedicated Research Lab preview route exists.
- Homepage does not yet contain separate Research Lab, Proof-to-Payment, Trust Shield, Creator tooling, and Growth intelligence preview sections matching the requested structure.
- Shared infrastructure appears as a compact grid, but the full moat list should be checked against the required public architecture.

## Current Product Pages

Product routes exist and use current names:

- `app/business-builder/page.tsx`
- `app/creator-studio/page.tsx`
- `app/growth-studio/page.tsx`

Business Builder currently covers:

- Problem it solves
- Setup flow
- Daily dashboard
- Records and documents
- Payments and quotes
- Trust and audit trail

Creator Studio currently covers:

- Creator workspace
- IP and asset records
- Launch planning
- Monetization
- Collaboration
- Rights and licensing warnings

Growth Studio currently covers:

- Campaign engine
- Lead and customer flow
- Reviews and referrals
- Market research
- Analytics
- Creator-to-business preview

Still incomplete:

- Module lists need to be made explicit on each product page.
- Creator Studio tool-library routes do not exist.
- Growth Studio intelligence and recommendation-research routes do not exist.
- Research Lab references are planning copy only; the public Research Lab route family is missing.

## Current Legal Pages

Legal route templates exist through `components/LegalPolicyPage.tsx` and mark pages as review-ready templates.

Present legal pages:

- `/legal/terms`
- `/legal/privacy`
- `/legal/refund-policy`
- `/legal/billing-terms`
- `/legal/acceptable-use`
- `/legal/ai-usage`
- `/legal/cookie-policy`
- `/legal/accessibility`
- `/legal/security`
- `/legal/data-processing-addendum`
- `/legal/subprocessors`
- `/legal/service-levels`

Present docs:

- `docs/legal/LEGAL_REVIEW_REQUIRED.md`

Still missing:

- `/legal/open-source-policy`

Human review required:

- All legal pages remain attorney-review-required drafts.
- No page should be treated as final legal compliance documentation until reviewed by qualified counsel.

## Current Pricing Page

Pricing is implemented with:

- `app/pricing/page.tsx`
- `app/pricing/business-builder/page.tsx`
- `app/pricing/creator-studio/page.tsx`
- `app/pricing/growth-studio/page.tsx`
- `components/PricingTiers.tsx`
- `config/pricing.ts`

Current tiers:

- Free: `$0`
- Starter: `$9-$15/mo`, internal `monthlyPrice: 15`
- Core: `Around $29/mo`
- Growth: `$49-$59/mo`
- Pro: `$79-$99/mo`
- Agency/Scale: `$149-$199/mo or custom`

Setup services:

- Profile Setup: `$99`
- Business Launch Setup: `$299`
- Premium Setup: `$499+`

Already aligned:

- Checkout is blocked unless Stripe configuration is present.
- Provider pass-through costs are disclosed.
- No guaranteed revenue/customer claims are made.
- Refund policy and billing terms are linked.

Still incomplete:

- Requested Starter public price is `$9/month`; current label is `$9-$15/mo`.
- Requested Premium launch setup is `$499`; current label is `$499+`.
- Setup service buttons and env mapping should be verified after Stripe configuration.

## Current Favicons and App Icons

Current assets include:

- `public/brand/sonara-logo.svg`
- `public/brand/sonara-mark.svg`
- `public/brand/business-builder-icon.svg`
- `public/brand/creator-studio-icon.svg`
- `public/brand/growth-studio-icon.svg`
- `public/brand/sonara-og.svg`
- `public/favicon.svg`
- `public/icon.svg`
- `app/icon.svg`
- `public/icons/apple-touch-icon.png`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `public/icons/maskable-icon-512.png`
- `public/manifest.webmanifest`

Current metadata in `app/layout.tsx` uses:

- Title: SONARA Industries
- Description: Technology infrastructure for Business Builder, Creator Studio, and Growth Studio.
- Canonical metadata base from `NEXT_PUBLIC_SITE_URL` or `NEXT_PUBLIC_APP_URL`, defaulting to `https://sonaraindustries.com`.
- Icons from `/brand/sonara-mark.svg`.

Still needs review:

- `public/next.svg`, `public/vercel.svg`, `public/file.svg`, `public/globe.svg`, and `public/window.svg` remain from the default asset set and should be removed if unused.
- App-store-grade raster exports need final human design QA if mobile/PWA distribution is planned.

## Current Dashboard and App Shell

The app shell exists but is mostly placeholder-safe:

- `/app` renders `AppPlaceholderPage` titled `SONARA One`.
- `/admin` renders `AppPlaceholderPage` titled `Admin Command Center`.
- App subroutes exist for business, creator, growth, files, customers, bookings, payments, reviews, campaigns, research, and settings.

Aligned:

- Placeholder pages avoid fake private user data.
- Admin surface does not show real secrets.

Still incomplete:

- Auth protection and owner/admin role enforcement need verification against production auth.
- The dashboard shell does not yet expose Research Lab open-source watchlist previews.
- Admin routes are placeholders and should not be marketed as complete control systems.

## Current Supabase Files

Supabase/database files exist:

- `supabase/migrations/003_sonara_subscriptions.sql`
- `supabase/migrations/004_sonara_final_launch.sql`
- `supabase/migrations/004_sonara_vector_memory.sql`
- `supabase/migrations/005_sonara_sound_discovery.sql`
- `supabase/migrations/006_sonara_generation_history.sql`
- `supabase/migrations/007_platform_infrastructure_ops.sql`
- `supabase/migrations/008_entity_agent_operations.sql`
- `supabase/migrations/010_sonara_platform_current_schema.sql`
- `lib/supabase.ts`
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/supabaseAdmin.ts`
- `docs/SUPABASE_SETUP.md`
- `docs/SUPABASE_DEPLOYMENT_RUNBOOK.md`
- `docs/SUPABASE_PRODUCTION_CHECKLIST.md`
- `docs/RLS_MANUAL_TESTS.md`
- `docs/DATABASE_INFRASTRUCTURE.md`

Still human-reviewed:

- Live Supabase project linking, migration push, RLS verification, Auth redirect URLs, and backup policy are not locally verifiable.
- Service-role keys must remain server-only.

## Current Stripe Files

Stripe/billing files exist:

- `app/api/stripe/checkout/route.ts`
- `app/api/stripe/webhook/route.ts`
- `app/api/billing/portal/route.ts`
- `app/account/billing/page.tsx`
- `app/admin/billing/page.tsx`
- `app/app/settings/billing/page.tsx`
- `app/billing-help/page.tsx`
- `lib/stripe.ts`
- `lib/sonara/billing/entitlements.ts`
- `docs/STRIPE_SETUP.md`
- `docs/STRIPE_LIVE_SETUP.md`
- `docs/STRIPE_PRODUCTION_RUNBOOK.md`
- `docs/STRIPE_TESTING_CHECKLIST.md`
- `docs/STRIPE_SECRET_ROTATION_CHECKLIST.md`
- `docs/BILLING_RUNBOOK.md`

Aligned:

- Stripe checkout route is server-side.
- Stripe webhook route verifies `stripe-signature` with `STRIPE_WEBHOOK_SECRET`.
- Checkout is safely blocked when env is not configured.

Still incomplete:

- Current webhook route handles `checkout.session.completed` and subscription created/updated/deleted events.
- Requested invoice and refund event coverage should be verified or added later.
- Live Stripe products, prices, webhook endpoint, and customer portal setup remain human dashboard tasks.

## Current Workflows

Workflow files:

- `.github/workflows/dependency-scan.yml`
- `.github/workflows/docker-image.yml`
- `.github/workflows/sonara-industries-ci.yml`

Current CI alignment:

- GitHub Actions use pnpm for frontend/root dependencies.
- Hardcoded pnpm versions were removed from pnpm/action-setup.
- No active workflow uses `npm ci`, `npm install`, or `npm audit`.
- Docker workflow skips when no Dockerfile exists.
- Supabase preview is secret-gated and skips instead of failing when required secrets are absent.

## Current Package Scripts

Root package:

- Name: `sonara-industries-platform`
- Package manager: `pnpm@11.1.1`
- Important scripts: `dev`, `build`, `lint`, `test`, `typecheck`, `validate:infrastructure`, `verify:db`, `verify:env`, `verify:stripe`, `verify:brand`, `verify:legacy-copy`, `verify:all`, `check:local`

Notes:

- `pnpm run lint` delegates to the `frontend` workspace.
- `pnpm test` delegates to the `frontend` workspace.
- No root `package-lock.json` is present.

## Current Old-Brand References

Legacy terms found outside `docs/archive/legacy-names.md` and outside prior audit docs:

- `README.md`
- `config/brandSystem.ts`
- `backend/app/main.py`
- `frontend/app/layout.tsx`
- `frontend/lib/brand-registry.ts`
- `frontend/lib/entities/config.ts`
- `next.config.mjs`
- `scripts/check-no-legacy-public-copy.mjs`
- `sonara-industries/.env.example`
- `sonara-industries/README.md`
- `sonara-industries/scripts/seed-stripe-products.mjs`
- `sonara-industries/apps/web/app/*`
- `sonara-industries/apps/web/components/*`
- `sonara-industries/apps/web/lib/*`
- `sonara-industries/apps/web/tests/*`
- `sonara-industries/docs/*`

Important distinction:

- Some legacy route references in `next.config.mjs` are intentional redirects and should remain or be replaced with equivalent redirect coverage.
- `scripts/check-no-legacy-public-copy.mjs` intentionally contains blocked terms as scanner patterns.
- The nested `sonara-industries/` workspace still carries the old TrackFoundry, LineReady, and NoticeGrid architecture and must be archived, redirected, or updated carefully.
- Root `README.md`, `config/brandSystem.ts`, `frontend/*`, and `backend/app/main.py` are not archive-only surfaces and should be cleaned or updated.

## What Must Be Replaced

- Root `README.md` tagline using `Independent systems. Shared infrastructure. Stronger markets.`
- `config/brandSystem.ts` public copy still using the old premium slogan and homepage subtitle.
- `frontend/app/layout.tsx`, `frontend/lib/brand-registry.ts`, and `frontend/lib/entities/config.ts` old tagline references.
- `backend/app/main.py` old tagline response.
- Nested workspace public copy and tests that still present TrackFoundry, LineReady, and NoticeGrid as active products.
- Pricing labels that do not match the requested simplified plan exactly.

## What Must Be Archived

- Historical meaning of TrackFoundry, LineReady, NoticeGrid, Signal OS, and signal-os should remain only in `docs/archive/legacy-names.md`.
- Any nested workspace docs that are useful for context but not current public product docs should move under archive or be clearly marked historical.

## What Must Be Deleted

- Unused default public assets such as Next/Vercel starter SVGs should be deleted after confirming they are not imported.
- Any public route files that exist only to serve old product pages should be removed or replaced by redirects after route testing.
- No deletion should happen until imports, redirects, and tests are checked.

## What Must Be Redirected

Existing redirects in `next.config.mjs` already cover:

- `/trackfoundry/:path*` to `/creator-studio`
- `/lineready/:path*` to `/business-builder`
- `/noticegrid/:path*` to `/growth-studio`
- `/signal-os/:path*` to `/app`
- `/music` to `/creator-studio`
- `/tableops` to `/business-builder`
- `/alertos` and `/civicsignal` to `/growth-studio`

Still needs route review:

- Old nested workspace route families under `sonara-industries/apps/web/app` should not remain public unless intentionally preserved as compatibility redirects.
- Footer links to `/app/system-health` and `/app/integrations` must either get routes or be redirected to existing admin/app surfaces.

## What Must Be Human-Reviewed

- Legal pages and policy text before paid public launch.
- Third-party/open-source tool licenses and commercial use rights.
- Supabase migrations and RLS policies before production push.
- Stripe live products, prices, webhook endpoint, and customer portal setup.
- Domain, SSL, Vercel environment variables, and production redirects.
- Browser favicon/app-icon QA across desktop, mobile, and PWA install surfaces.
- Real auth flows, role protection, and admin-only access.

## Current Blockers Before Public Launch

- Research Lab public route family is missing.
- Open-source intelligence registry is missing.
- Creator Studio tool-library route family is missing.
- Growth intelligence route family is missing.
- `/legal/open-source-policy` is missing.
- Public navigation is missing Research Lab.
- Footer contains at least two unresolved route links.
- Legacy public copy remains outside the archive.
- Nested `sonara-industries/` still exposes the old product architecture.
- Stripe, Supabase, domain, legal, and auth production setup require human dashboard access and live verification.

## Recommendation

Continue with Sprint 2 only after committing this audit. Prioritize replacement of active public legacy copy, missing Research Lab navigation/routes, pricing exactness, and route-link cleanup before adding deeper Research Lab adapters or model comparison scaffolds.
