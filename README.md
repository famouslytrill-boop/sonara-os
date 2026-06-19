# SONARA Industries

SONARA Industries is the Express/Vercel application for the SONARA parent site and the Business Builder, Creator Studio, and Growth Studio workspaces.

The current production path is intentionally Express/Node:

- `server.js` defines the app and exports it.
- `api/index.js` exports the Express app for Vercel.
- `vercel.json` rewrites all traffic to `/api`.
- Do not convert this launch path to Next.js or expose server-only provider secrets to browser code.

## What Works In Code

- Public SONARA Industries marketing, pricing, help, security, contact, and legal pages.
- Email/password signup and login through Supabase Auth when Supabase public auth env vars are configured.
- Customer sessions stored in secure HTTP-only cookies.
- Manual logout from customer, workspace, and admin shells.
- Free workspace pages for Business Builder, Creator Studio, and Growth Studio.
- Business Builder intake API that writes to `intake_requests` and records `activity_events` when Supabase is configured.
- Business Builder checklist API with GET, POST, PATCH, and DELETE against `launch_checklist_items`.
- Stripe Checkout creation for configured plans.
- Stripe Customer Portal creation for authenticated customers with Stripe customer records.
- Stripe webhook signature verification and billing-state synchronization.
- Paid workspace gates that require active billing entitlement/subscription records unless the user is owner/admin.
- Founder/admin login through Supabase email/password plus server-side role or email allowlist checks.
- Admin overview and env-status APIs that return only safe booleans/counts, never secret values.
- Resend support/contact and employee invite email attempts when Resend is configured.

## Manual Setup Still Required

- Add real Vercel environment variables.
- Apply Supabase migrations to the production Supabase project.
- Promote the real owner account through reviewed SQL after signup.
- Create real Stripe products, prices, customer portal configuration, and webhook endpoint.
- Verify Resend domain and sender email.
- Complete qualified legal review.
- Run final production smoke tests.

## Local Setup

Use pnpm.

```powershell
corepack enable
pnpm install
pnpm lint
pnpm test
pnpm typecheck
pnpm build
pnpm run scan:client-secrets
```

## Vercel Setup

Project settings:

- Framework preset: Other
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build`
- Output directory: leave empty
- Production domain: `https://sonaraindustries.com`

Required files:

- `server.js`
- `api/index.js`
- `vercel.json`
- `pnpm-workspace.yaml`
- `package.json`
- `pnpm-lock.yaml`

## Environment Variables

Use `.env.example` as the source of truth. Do not commit real values.

Public browser-safe values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_URL`

Server-only values:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SUPPORT_TO_EMAIL`
- `CONTACT_TO_EMAIL`
- `ADMIN_EMAILS`
- `ADMIN_EMAIL`
- `FOUNDER_EMAILS`

Stripe price variables and aliases:

- `STRIPE_PRICE_STARTER_MONTHLY`
- `STRIPE_PRICE_CORE_MONTHLY`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_BUSINESS_BUILDER_ONE_TIME`
- `STRIPE_PRICE_ID_BUSINESS_BUILDER_MONTHLY`
- `STRIPE_PRICE_ID_BUSINESS_BUILDER_ONETIME`
- `STRIPE_PRICE_ID_CREATOR_STUDIO_MONTHLY`
- `STRIPE_PRICE_ID_GROWTH_STUDIO_MONTHLY`
- `STRIPE_PRICE_BUSINESS_BUILDER_STARTER_MONTHLY`
- `STRIPE_PRICE_BUSINESS_BUILDER_CORE_MONTHLY`
- `STRIPE_PRICE_BUSINESS_BUILDER_PRO_MONTHLY`
- `STRIPE_PRICE_BUSINESS_BUILDER_ONETIME`
- `STRIPE_PRICE_CREATOR_STUDIO_CORE_MONTHLY`
- `STRIPE_PRICE_CREATOR_STUDIO_PRO_MONTHLY`
- `STRIPE_PRICE_GROWTH_STUDIO_CORE_MONTHLY`
- `STRIPE_PRICE_GROWTH_STUDIO_PRO_MONTHLY`

Rules:

- Stripe price IDs must start with `price_`.
- Stripe secret keys should be server-only and start with `sk_live_`, `sk_test_`, or a restricted key accepted by the deployment policy.
- Stripe webhook secrets must start with `whsec_`.
- Never create `NEXT_PUBLIC_` aliases for service-role keys, Stripe secrets, webhook secrets, Resend keys, or admin/founder allowlists.

## Supabase Setup

Migrations live in `supabase/migrations/`.

Apply pending migrations:

```powershell
supabase migration list --linked
supabase db push
```

If applying manually through the Supabase SQL editor, review and run the newest migration files in order. New public tables include explicit grants plus RLS policies because new Supabase projects may not expose public tables to the Data API automatically.

Owner promotion after signup should be done manually and reviewed. Example pattern:

```sql
insert into public.user_roles (user_id, role)
select id, 'owner'
from auth.users
where email = 'OWNER_EMAIL_HERE'
on conflict do nothing;
```

Replace `OWNER_EMAIL_HERE` in the dashboard before running. Do not commit real owner emails if they are private.

## Stripe Setup

Create products and prices in Stripe for:

- Starter monthly
- Core monthly
- Pro monthly
- Business Builder one-time setup

Add the matching `price_` IDs to Vercel env vars. Configure the Customer Portal in Stripe before relying on `/api/billing/create-portal-session`.

Webhook endpoint:

```text
https://sonaraindustries.com/api/stripe/webhook
```

The legacy-compatible endpoint also works:

```text
https://sonaraindustries.com/api/webhooks/stripe
```

Subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Use Stripe CLI for local webhook testing:

```powershell
stripe listen --forward-to localhost:5000/api/stripe/webhook
```

## Resend Setup

In Resend:

- Verify the sending domain.
- Add required DNS records.
- Set `RESEND_API_KEY`.
- Set `RESEND_FROM_EMAIL`.
- Set `SUPPORT_TO_EMAIL` or `CONTACT_TO_EMAIL`.

If Resend is missing, contact and invite routes do not fake email delivery. They return setup-required states or save records without claiming email was sent.

## Admin Setup

Admin access uses Supabase email/password plus server-side authorization:

- `ADMIN_EMAILS`, `ADMIN_EMAIL`, or `FOUNDER_EMAILS` can allow founder/admin email accounts.
- `user_roles` can store durable `owner` and `admin` roles.
- Admin routes never return raw secrets.
- Admin audit events are written when Supabase service-role access is configured.

## Functional Routes

Core:

- `/`
- `/pricing`
- `/login`
- `/signup`
- `/logout`
- `/dashboard`
- `/settings`
- `/contact`
- `/help`
- `/docs`
- `/security`

Business Builder:

- `/business-builder`
- `/business-builder/dashboard`
- `/business-builder/intake`
- `/business-builder/checklist`
- `/business-builder/launch-readiness`
- `/business-builder/billing`
- `/business-builder/employees`

APIs:

- `/api/health`
- `/api/readiness`
- `/api/business-builder/intake`
- `/api/business-builder/checklist`
- `/api/billing/create-checkout-session`
- `/api/billing/create-portal-session`
- `/api/stripe/webhook`
- `/api/admin/overview`
- `/api/admin/env-status`

## Deployment

After checks pass:

```powershell
git status
git add server.js tests/server.test.js .env.example README.md .vercelignore supabase/migrations
git commit -m "Build functional SONARA SaaS launch system"
git push origin main
pnpm dlx vercel@latest --prod
```

Do not force push.
