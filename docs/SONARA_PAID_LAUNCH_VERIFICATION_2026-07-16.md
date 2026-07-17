# SONARA Paid-Launch Verification Record

Verification date: 2026-07-16, refreshed with public production checks on 2026-07-17.

Production domain: `https://sonaraindustries.com`

Supabase project ref: `yqncsonkxgwhcxedgevk`

Verified production commit: `c3fcc9b951ea69f9c208b1382561c8dea1b7a83a`

## Evidence labels

- **Repository verified**: confirmed from committed source, migrations, tests, and local gates.
- **Public-live verified**: confirmed through non-secret production HTTP endpoints.
- **Owner/Claude SQL verified**: production SQL evidence supplied from the owner-approved 2026-07-16 database pass. Codex did not re-query private production SQL without credentials.
- **Human proof remaining**: requires an approved account, provider dashboard, recipient, or legal decision.

## Production architecture

Status: **Repository verified and public-live verified**.

- Root Express runtime: `server.js`
- Vercel function entrypoint: `api/index.js`
- Vercel catch-all rewrite: `/api`
- Package manager: `pnpm@11.1.1`
- Primary backend: Supabase
- Production `/api/health` reported Express, branch `main`, environment `production`, and commit `c3fcc9b951ea69f9c208b1382561c8dea1b7a83a` on 2026-07-17.

## Database migration ledger

Status: **Repository verified and owner/Claude SQL verified**.

- Repository migration count: 39
- Production ledger count supplied by the owner-approved SQL pass: 39
- Canonical final version: `20260716130000`
- Duplicate local versions: none reported by `verify:db`

The production-applied tail is:

```text
20260714120000_sonara_service_lifecycle_runtime_tables.sql
20260714150000_sonara_notifications_and_integrations.sql
20260715110223_support_delivery_state.sql
20260715120000_user_preferences_appearance_notifications.sql
20260716130000_launch_storage_buckets.sql
```

These files are applied history. Future changes must be forward-only migrations with new versions.

## Support database and delivery state

Status: **Repository verified and owner/Claude SQL verified**.

The verified production schema includes:

- `support_requests.reference_id`
- `support_requests.consent_accepted`
- `support_requests.email_delivery_status`
- `support_requests.email_error_summary`
- `support_requests.email_retry_count`
- `support_email_delivery_attempts`

The supported delivery states are `pending`, `email_sent`, and `email_failed`. The request row remains the source of truth when notification delivery fails.

Remaining proof: **Human proof remaining**. Configure a verified production sender, submit one approved contact request, confirm `email_sent`, confirm one delivery-attempt row, and exercise a controlled failure path that leaves the request stored with `email_failed`.

## Service lifecycle and product tables

Status: **Owner/Claude SQL verified**.

The supplied production SQL evidence confirms the service lifecycle, notifications/integrations, preferences, billing entitlement, and support delivery migrations were applied with RLS and policies. The application continues to fail closed when its required provider or table is unavailable.

## Storage buckets and policies

Status: **Repository verified and owner/Claude SQL verified**.

Seven launch buckets are present and private:

- `avatars`
- `business-assets`
- `creator-assets`
- `music-stems`
- `release-packages`
- `support-attachments`
- `exports`

The migration defines size and MIME limits plus eight object policies. Avatar objects are owner-scoped. Organization assets use `<organization_id>/<owner_user_id>/<filename>` and active membership checks.

## Anonymous and tenant isolation

Status: **Owner/Claude SQL verified; cross-tenant user test still recommended**.

The supplied read-only production checks returned zero anonymous rows for `support_requests`, `service_requests`, `billing_subscriptions`, and `organizations`.

Remaining proof: use two approved organizations to verify that authenticated users cannot read or mutate each other's records or objects.

## Stripe and paid access

Status: **Repository verified; end-to-end provider proof remaining**.

Verified in code and automated tests:

- price values must be valid `price_` identifiers
- placeholder, product, secret, publishable, webhook, and display-price values remain blocked
- checkout creation is server-side and requires valid plan/account context
- webhook signatures use the raw request body and timing-safe verification
- event audit is idempotent by provider and provider event ID
- only active/trialing subscription state or owner/admin override unlocks paid access
- redirects do not unlock paid access

Remaining proof: complete an approved Stripe test-mode checkout, signed webhook, active subscription row, workspace unlock, cancellation, and relock. Confirm bad signatures return 400 and duplicate events remain single audit records.

## Authentication and owner flow

Status: **Repository verified; live approved-account proof remaining**.

Automated tests cover server-side access checks, session cookies, account setup, normal-user admin denial, owner/admin access, and user-triggered logout behavior.

Remaining proof: run signup/login, refresh/navigation persistence, explicit logout, no-organization setup, membership creation, normal-customer denial, and owner/admin access with approved production test accounts.

Google OAuth remains intentionally deferred unless the owner requests and configures it.

## Live readiness snapshot

Status: **Public-live verified on 2026-07-17**.

The non-secret `/api/readiness` endpoint reported:

| Service | Status |
| --- | --- |
| Supabase | configured |
| Account database | configured |
| Stripe | configured |
| Stripe webhook | configured |
| Checkout | enabled |
| Payment connection | configured |
| Payment updates | configured |
| Founder/admin protection | configured |
| Resend | invalid |
| Email delivery | invalid |
| Google OAuth | deferred |
| Legal pages | review_required |

This endpoint exposes status labels only and does not prove real provider transactions.

## Automated verification

The documentation branch reran the required gates on 2026-07-17:

- 255 tests passing
- frozen pnpm install passing
- dependency audit passing with no known vulnerabilities
- build, typecheck, and lint passing
- client-secret scan passing
- route smoke passing
- schema verification passing: 39 migrations, 15 required tables, 7 private buckets
- route registry passing: 124 required GET routes, 347 total registrations, no duplicates
- documentation checks passing
- `git diff --check` passing
- live route smoke passing against `https://sonaraindustries.com`: 11 direct 200 responses and four expected compatibility redirects across the 15-route sweep
- production browser opened at 360, 390, 414, 768, and 1440 widths; the 390px capture showed the responsive navigation and hero without visible horizontal clipping
- production browser console reported zero errors and zero warnings

No provider credentials or customer data were used for these checks.

## Remaining owner actions

- Set a verified-domain `RESEND_FROM_EMAIL` and approved recipients in Vercel Production.
- Redeploy and prove one delivered contact notification plus one controlled failure record.
- Run the Stripe test-mode checkout, webhook, unlock, cancellation, and relock flow.
- Run the approved auth/owner account smoke flow.
- Confirm the Supabase GitHub integration targets `yqncsonkxgwhcxedgevk`.
- Complete cross-organization RLS/storage testing.
- Review legal, privacy, refund, pricing, and provider statements.
- Approve any live payment activation and final paid launch.

## Launch recommendation

**NOT CLEARED FOR PAID LAUNCH.**

Database/storage migration evidence is complete, and the deployed code baseline is healthy. The remaining blockers are provider and human proofs: production Resend delivery, Stripe test-mode end-to-end billing state, approved auth/owner flow, cross-tenant verification, and legal/commercial approval.
