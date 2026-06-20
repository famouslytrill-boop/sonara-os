# SONARA Customer Go-Live Checklist

This document defines what must happen before SONARA Industries is safe to open for real customers. A system is not launch-ready just because the page loads. Every customer-facing button must either complete a real workflow, save real data, deny access correctly, request payment correctly, or show a clear Setup Required state.

## Go-live definition

SONARA is customer-ready only when:

1. Public pages load without broken links or placeholder language.
2. Customer signup/login works through Supabase Auth.
3. Founder/admin login works and is protected server-side.
4. Each customer is attached to an organization/workspace.
5. Business Builder, Creator Studio, and Growth Studio open correctly based on access rules.
6. Stripe checkout creates real sessions for configured plans.
7. Stripe webhook events are verified and written to the database.
8. Paid access unlocks from webhook records, not browser redirects.
9. Resend sends verified-domain email for support/intake/account flows.
10. Required Supabase tables exist and pass readiness checks.
11. Storage buckets exist and private buckets are protected.
12. Realtime/live update channels are private or disabled until policies are ready.
13. Each active module has a real read/list/create workflow or a visible Setup Required state.
14. Tests pass locally and in deployment build.
15. Vercel production deployment is tied to the GitHub `main` branch.

## Phase 1: Stop blockers

### 1. Pull latest code

```powershell
cd C:\Users\AXPAY\famouslytrill-project
git fetch github
git pull github main
```

### 2. Apply runtime wiring

```powershell
npm install
npm run apply:runtime
npm run build
npm test
```

Acceptance criteria:

- `/api/health` works.
- `/api/readiness` works.
- `/api/last9/readiness` works.
- `/api/creator/music-system/readiness` works.
- `/api/formulas/readiness` works.
- `/api/ecosystem/readiness` works.
- `npm test` passes.

### 3. Patch migrations and push

```powershell
npm run db:patch-triggers
npm run db:push
```

Acceptance criteria:

- Supabase migration push finishes without duplicate trigger errors.
- Formula tables exist.
- Business/employee/music ops tables exist.
- No database reset is used.

## Phase 2: Account and admin readiness

### Customer account requirements

- Supabase URL is configured in Vercel.
- Supabase anon key is configured in Vercel.
- Supabase service-role key is configured server-side only in Vercel.
- Email/password signup works.
- Email/password login works.
- Logout clears customer session.
- Customer session does not expose secrets.

### Founder/admin requirements

- Founder email is in `ADMIN_EMAILS`, `ADMIN_EMAIL`, or `FOUNDER_EMAILS`.
- Founder user exists in Supabase Auth.
- Founder profile row exists.
- Founder organization exists.
- Founder organization membership exists.
- Founder has owner/admin/founder roles.
- Admin login works from `/admin/login`.
- Admin routes require admin authorization.
- Admin logout works.

Acceptance criteria:

- Customer can create account and log in.
- Founder can log in to `/admin`.
- Non-admin cannot open admin routes.

## Phase 3: Organization and workspace readiness

Each customer account must have or create:

- `profiles` row.
- `organizations` row.
- `organization_memberships` row.
- default product workspace access.
- role mapping for owner/customer/employee where relevant.

Acceptance criteria:

- New user can land on `/dashboard` after login.
- Business Builder dashboard can identify the customer organization.
- Creator Studio dashboard can identify the customer organization.
- Growth Studio dashboard can identify the customer organization.
- Setup Required appears if organization setup is missing.

## Phase 4: Payment readiness

Stripe must be production-ready before paid customers use the site.

Required environment variables:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- at least one real Stripe price ID for an enabled plan
- `APP_URL` or `PUBLIC_SITE_URL`
- safe success/cancel URLs

Required webhook events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Acceptance criteria:

- `/pricing` shows checkout-enabled plans only when Stripe price IDs are real.
- `/api/checkout/session` creates a Stripe checkout session for logged-in users.
- Stripe sends webhook event to SONARA.
- Webhook signature is verified.
- Webhook event is stored in `billing_webhook_events`.
- Subscription state is stored or updated in `billing_subscriptions`.
- Paid access unlocks only after webhook-backed state exists.

## Phase 5: Email readiness

Resend must be verified before customer-facing email is treated as working.

Required environment variables:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SUPPORT_TO_EMAIL`
- `CONTACT_TO_EMAIL`

Required DNS setup:

- verified sending domain
- DKIM record
- SPF record if required by Resend setup
- sender email using verified domain

Acceptance criteria:

- Contact form stores request.
- Contact form sends email when Resend is enabled.
- Intake confirmation can send to customer.
- Admin readiness shows email delivery as enabled only when real values are present.
- Invalid or placeholder values show invalid/setup required.

## Phase 6: Storage readiness

Create required Supabase Storage buckets:

- `avatars`
- `business-assets`
- `creator-assets`
- `music-stems`
- `release-packages`
- `support-attachments`
- `exports`

Access rules:

- public assets can be public.
- customer/private documents stay private.
- employee documents stay private.
- creator stems and release packages stay private unless explicitly published.

Acceptance criteria:

- Buckets exist in Supabase.
- Upload policies are scoped to authenticated users and organizations.
- Download policies respect organization/workspace access.
- Public files do not expose private customer or employee data.

## Phase 7: Realtime readiness

Realtime is not required for first customer launch unless policies are correct.

Required channels:

- `organization:{id}:activity`
- `organization:{id}:support`
- `business:{id}:orders`
- `business:{id}:staff`
- `creator:{id}:jobs`
- `growth:{id}:campaigns`

Acceptance criteria:

- Private organization data is not broadcast publicly.
- Realtime channels require authenticated access.
- Channels are disabled or marked Setup Required until policies are verified.

## Phase 8: Customer-facing module minimums

### Business Builder MVP

Must work before inviting business customers:

- Landing page
- Signup/login
- Dashboard
- Offer Builder
- Intake form
- Checklist
- Billing page
- Employee invite page
- Basic records list
- Setup Required state for unavailable tools

Next after MVP:

- service catalog
- appointments
- staff time clock
- wage projection
- inventory
- menu/POS
- recipe/food cost
- vendor invoices
- route/vehicle records

### Creator Studio MVP

Must work before inviting creator customers:

- Landing page
- Signup/login
- Dashboard
- Asset record flow
- Creator offer flow
- Music System page
- Formula/readiness pages
- Setup Required state for unavailable tools

Next after MVP:

- artist systems
- song blueprints
- prompt packs
- release packages
- export packages
- audio job tracking
- transcription jobs
- video/broadcast references

### Growth Studio MVP

Must work before inviting growth customers:

- Landing page
- Signup/login
- Dashboard
- Campaign plan flow
- Lead capture flow
- Records list
- Formula/readiness pages
- Setup Required state for unavailable tools

Next after MVP:

- automation rules
- experiments
- analytics dashboard
- follow-up priority
- consent review workflow

## Phase 9: Tests required before launch

Run:

```powershell
npm run apply:runtime
npm run build
npm test
npm run scan:client-secrets
```

Test manually:

- Public homepage
- Pricing
- Signup
- Login
- Logout
- Dashboard
- Business Builder dashboard
- Creator Studio dashboard
- Growth Studio dashboard
- Contact form
- Checkout
- Stripe webhook
- Admin login
- Admin support queue
- Admin formulas
- Admin ecosystem

Live URLs to verify:

- `https://sonaraindustries.com/api/health`
- `https://sonaraindustries.com/api/readiness`
- `https://sonaraindustries.com/api/last9/readiness`
- `https://sonaraindustries.com/api/creator/music-system/readiness`
- `https://sonaraindustries.com/api/formulas/readiness`
- `https://sonaraindustries.com/api/formulas/definitions`
- `https://sonaraindustries.com/api/ecosystem/manifest`
- `https://sonaraindustries.com/api/ecosystem/readiness`
- `https://sonaraindustries.com/formulas`
- `https://sonaraindustries.com/ecosystem`

## Phase 10: Soft launch plan

Do not open to everyone first.

Soft launch order:

1. Founder-only smoke test.
2. One test customer account.
3. One real free user.
4. One real paid user in Stripe test or low-cost live plan.
5. Three small-business beta users.
6. Three creator beta users.
7. Three growth beta users.
8. Public launch after support, payment, and email issues are stable.

## Launch gate

Do not announce public launch until all are true:

- migrations pass
- build passes
- tests pass
- client secret scan passes
- live health/readiness endpoints pass
- auth works
- admin works
- contact works
- checkout works
- webhook writes database rows
- paid access unlocks correctly
- email sends from verified domain
- support queue is reviewable
- customer records are not leaking across organizations
- setup-required states are clear
- legal pages are linked in footer

## What comes after customer launch

After customers can safely use the MVP:

1. Expand CRUD APIs for each module.
2. Build richer admin visualizers.
3. Add storage upload flows.
4. Add realtime activity safely.
5. Add worker jobs.
6. Add premium UI polish.
7. Add mobile haptics and sound toggles.
8. Add advanced Creator Studio audio/video workers.
9. Add deeper Business Builder POS/time clock/inventory.
10. Add Growth Studio automations and reporting.

## Final rule

A feature is customer-ready only when it has:

- page
- route
- API if it saves/loads data
- database table
- permission check
- setup-required fallback
- test
- admin visibility
- no leaked secrets

Anything else is a prototype wearing lipstick. Charming, but not launch-ready.
