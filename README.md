# SONARA Industries SaaS Launch System

SONARA Industries is an Express/Vercel SaaS platform for the parent SONARA site and three child products:

- **Business Builder:** turn service ideas into paid offers, intake flows, launch checklists, and customer operations.
- **Creator Studio:** plan, package, and manage creative releases, campaigns, and audience workflows.
- **Growth Studio:** track outreach, campaigns, offers, and growth experiments from one operating dashboard.

The app intentionally remains an Express/Node deployment for this repo. Do not add fake Next.js pages just because the internet has collectively decided every button must summon a hydration problem.

## What is functional now

- Public marketing pages for `/`, `/pricing`, `/business-builder`, `/creator-studio`, and `/growth-studio`.
- Email/password signup, login, logout, persistent HTTP-only session cookies, and password visibility toggles when Supabase is configured.
- Auth-protected `/dashboard`, product dashboards, Business Builder intake, launch readiness, billing, and support pages.
- Role-aware access for `customer`, `paid_customer`, `owner`, `admin`, and `founder`.
- Paid-tool access gates based on roles, active/trialing subscription rows, or valid purchase rows.
- Supabase-backed intake requests, checklist items, support requests, activity events, profiles, organizations, memberships, subscriptions, purchases, and audit logs.
- Stripe Checkout session creation, Customer Portal session creation, webhook signature verification, subscription/purchase sync, and payment activity events.
- Admin-only overview and environment-status API routes that return booleans only, never secret values.
- Legal template pages: terms, privacy, refund policy, cookies, acceptable use, accessibility, and earnings disclaimer.
- Setup-required states when Supabase, Stripe, Resend, Google OAuth, or founder access are missing.

## What still requires manual external setup

- Create/configure the Supabase project.
- Apply the SQL migrations in `supabase/migrations/`.
- Configure Supabase email auth and any Google OAuth provider settings.
- Create Stripe products/prices and add the price IDs to env vars.
- Configure the Stripe webhook endpoint to hit `/api/stripe/webhook` and copy the webhook secret.
- Configure Resend sender/domain verification.
- Add real founder/admin emails to `FOUNDER_EMAILS` or `ADMIN_EMAILS`.
- Have qualified counsel review the legal templates before production use.

## Local setup

```powershell
cd C:\Users\AXPAY\famouslytrill-project
corepack enable
pnpm install
copy .env.example .env
pnpm start
```

Open `http://localhost:3000`.

## Required env vars

Use `.env.example` as the source of truth. Required names for production SaaS behavior:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_BUSINESS_BUILDER_MONTHLY=
STRIPE_PRICE_ID_BUSINESS_BUILDER_ONETIME=
STRIPE_PRICE_ID_CREATOR_STUDIO_MONTHLY=
STRIPE_PRICE_ID_GROWTH_STUDIO_MONTHLY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
NEXT_PUBLIC_SITE_URL=
FOUNDER_EMAILS=
```

Backward-compatible aliases are documented in `.env.example` and remain supported where practical.

## Supabase setup

1. Create or open your Supabase project.
2. Go to **Project Settings → API**.
3. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Service role key → `SUPABASE_SERVICE_ROLE_KEY`
4. Go to **Authentication → Providers → Email** and confirm email/password is enabled.
5. Apply the migration:

```powershell
pnpm exec supabase login
pnpm exec supabase link --project-ref YOUR_PROJECT_REF
pnpm exec supabase db push
```

Manual SQL Editor fallback: open `supabase/migrations/011_sonara_saas_launch_system.sql`, review it, then run it in the Supabase SQL Editor.

## Stripe setup

1. In Stripe, create products/prices for:
   - Business Builder monthly
   - Business Builder one-time setup
   - Creator Studio monthly
   - Growth Studio monthly
2. Copy each `price_...` ID to the matching env var.
3. Copy your secret key to `STRIPE_SECRET_KEY`.
4. Create a webhook endpoint:

```text
https://YOUR_DOMAIN/api/stripe/webhook
```

5. Subscribe to these events:

```text
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.payment_succeeded
invoice.payment_failed
```

6. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.

## Resend setup

1. Verify your sending domain in Resend.
2. Create an API key.
3. Add:

```text
RESEND_API_KEY=
RESEND_FROM_EMAIL=SONARA Industries <no-reply@yourdomain.com>
```

If Resend is missing, intake still saves when Supabase is configured and returns `emailDelivery: setup_required`.

## Founder/admin setup

Add comma-separated founder/admin emails:

```text
FOUNDER_EMAILS=you@example.com
ADMIN_EMAILS=you@example.com
```

Founder/admin access is checked server-side. Customers cannot access admin pages or admin JSON routes.

## Vercel setup

1. Import the GitHub repo into Vercel.
2. Set the framework preset to **Other** if Vercel does not auto-detect the Express setup.
3. Add all production env vars in **Project Settings → Environment Variables**.
4. Confirm `vercel.json` routes traffic to `api/index.js`.
5. Deploy.
6. Visit:
   - `/api/health`
   - `/api/readiness`
   - `/pricing`
   - `/admin/login`

## How to test webhooks locally

```powershell
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the `whsec_...` value to `STRIPE_WEBHOOK_SECRET` in `.env`, then trigger a test checkout.

## Quality gates

Run these before deployment:

```powershell
git status
git grep -n -E "<<<<<<<|=======|>>>>>>>" -- . || true
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('package.json','utf8')); console.log('package.json valid')"
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('vercel.json','utf8')); console.log('vercel.json valid')"
corepack enable
pnpm install
pnpm run build
pnpm run lint
pnpm test
pnpm run scan:client-secrets
```

## Production honesty rules

- No committed secrets.
- No fake users, fake revenue, fake activity, fake testimonials, or fake customer logos.
- Checkout session creation never unlocks paid access.
- Stripe webhooks are the source of truth for paid state.
- Missing providers must show setup-required states.
- Legal pages are templates until counsel reviews them.
