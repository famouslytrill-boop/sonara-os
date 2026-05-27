# SONARA Industries

SONARA Industries is a technology holding company that owns independent software companies.

Tagline: Independent systems. Shared infrastructure. Stronger markets.

Public message: Build. Create. Grow.

## Product Architecture

- Business Builder: create, launch, run, and manage a business with guided systems, payments, bookings, records, and operational intelligence.
- Creator Studio: organize, protect, publish, monetize, and grow creative work, digital products, media, and creator operations.
- Growth Studio: attract customers, leads, fans, referrals, reviews, and revenue through campaigns, follow-up, offers, and growth systems.

SONARA One is the shared app platform for the three product workspaces.

## Shared Infrastructure

- Trust Shield
- Proof-to-Payment
- Business Memory Graph
- Smart Setup Wizard
- Research Lab
- Graph Builder
- Files & Records
- Access Control
- Billing & Entitlements
- Alerts & Signals
- AI Governance
- Customer Success
- Launch Readiness

## Safety Rules

- No raw card data or CVV storage.
- Service-role keys stay server-side.
- Stripe webhooks verify signatures.
- Paid checkout stays disabled or safely errors until real Stripe env vars are configured.
- Risky actions require owner approval.
- No guaranteed legal, financial, cybersecurity, uptime, customer, or revenue claims.
- Legal pages are review-ready drafts, not legal advice.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase-ready auth/RLS structure
- Stripe Checkout and webhook scaffolding
- PWA manifest/service worker
- GitHub Actions dependency/security workflow

## Public Routes

- `/`
- `/business-builder`
- `/creator-studio`
- `/growth-studio`
- `/pricing`
- `/trust`
- `/about`
- `/contact`
- `/legal`
- `/legal/terms`
- `/legal/privacy`
- `/legal/refund-policy`
- `/legal/acceptable-use`

## App Routes

- `/app`
- `/app/dashboard`
- `/app/business-builder`
- `/app/creator-studio`
- `/app/growth-studio`
- `/app/settings`
- `/admin`

## Local Setup And Validation

Use pnpm only.

```powershell
pnpm install --frozen-lockfile
pnpm audit --audit-level moderate
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
pnpm run verify:legacy-copy
```

Do not use npm, `npm audit fix`, or `package-lock.json`.

## Environment

Use `.env.example` as the source of truth. Keep secret values in local `.env`, Vercel, Supabase, Stripe, GitHub secrets, or a password manager.

Required setup docs:

- `docs/ENVIRONMENT_VARIABLES.md`
- `docs/DEPLOYMENT_RUNBOOK.md`
- `docs/SUPABASE_SETUP.md`
- `docs/STRIPE_SETUP.md`
- `docs/BILLING_RUNBOOK.md`
- `docs/PRODUCTION_CHECKLIST.md`

## Database

Supabase migration scaffolding lives in `supabase/migrations/010_sonara_platform_current_schema.sql`.

RLS-ready table structure is included, but production RLS is not complete until applied and tested in Supabase.
