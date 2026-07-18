# SONARA Paid Launch Finalization — 2026-07-18

Owner approval: Damian / SONARA Industries  
Engineering owner: Codex (Agent A)  
Branch: `codex/finalize-paid-launch`  
Pull request: #27

## Executive status

This release applies the approved production database migrations, reconciles the live billing-subscription schema with the current Stripe webhook contract, repairs Resend sender validation, records the current pricing catalog as owner-approved, and records the legal pages as an owner-approved launch baseline while preserving the explicit qualified-legal-review boundary.

It does not claim attorney review, create a paid entitlement from a checkout redirect, expose credentials, weaken row-level security, or fabricate a successful payment or email delivery.

## Production database migration result

The guarded production workflow targeted only Supabase project `yqncsonkxgwhcxedgevk`. It required the exact project reference, linked with encrypted repository secrets, performed a dry run, rejected unexpected pending migration files, applied the approved ledger, verified the remote ledger, and ran linked database linting.

The production ledger now confirms:

- `20260718064853_data_api_privilege_hardening.sql`
- `20260718071148_connect_database_contract.sql`
- `20260718193000_operational_query_index_contract.sql`

Migrations 40 and 41 were already present in the remote ledger when this finalization began. Migration 42 was the remaining pending migration.

The first guarded attempt failed safely because the live `billing_subscriptions` table predated the canonical runtime definition and lacked `organization_id`. No migration-history repair or forced ledger mutation was used. Migration 42 was reconciled before remote application to add only the canonical columns required by the existing server contract:

- `organization_id`
- `provider`
- `provider_customer_ref`
- `provider_subscription_ref`
- `plan_slug`
- `status`
- `current_period_end`
- `cancel_at_period_end`
- `metadata`
- `created_at`
- `updated_at`

Compatible legacy identifiers are preserved when corresponding legacy columns exist. No organization relationship is guessed or backfilled. The migration adds a unique provider/subscription index used by the existing idempotent webhook upsert and retains the eight previously reviewed operational indexes.

Final production workflow result:

- project-ref verification: passed
- linked migration preflight: passed
- dry-run allowlist: passed
- production migration application: passed
- remote ledger confirmation: passed
- linked production schema lint at error level: passed
- final CLI result: remote database up to date; no schema errors found

The temporary migration workflow was removed after success so it cannot execute again from the merged branch.

## Resend correction

Production previously reported `RESEND_FROM_EMAIL` as invalid while using the documented friendly-name form:

```text
SONARA Industries <no-reply@sonaraindustries.com>
```

The defect was local validation, not the Resend request body. The validator now extracts and validates the address inside an optional display-name envelope. Placeholder and malformed addresses remain rejected. Server-only API-key handling and the existing support-delivery audit trail remain unchanged.

Repository tests prove:

- friendly-name senders are accepted;
- placeholder addresses inside friendly-name syntax are rejected;
- API-key values are never returned in readiness output; and
- email readiness can transition to configured/enabled without client-side secret exposure.

A real provider delivery is not represented as proven until one approved production support/contact request records a successful provider response.

## Stripe and checkout status

The live production readiness endpoint already reported before this release:

- Stripe secret: configured
- Stripe webhook secret: configured
- checkout: enabled
- Starter monthly price: enabled
- Core monthly price: enabled
- Pro monthly price: enabled
- Business Builder one-time price: enabled

This release preserves:

- server-created Stripe Checkout Sessions;
- customer and organization metadata;
- signed webhook verification;
- webhook audit persistence;
- organization-scoped subscription synchronization;
- billing entitlement synchronization; and
- paid access derived only from persisted active or trialing billing state or the documented owner/admin path.

`/api/billing/status` intentionally continues to report `paidStatus: not_verified` until a real persisted billing state exists. Configuration readiness is not treated as payment proof.

The remaining commercial proof is the approved Stripe test lifecycle:

1. authenticated checkout session;
2. signed Stripe webhook;
3. persisted subscription and entitlement;
4. paid feature unlock;
5. cancellation or deletion event; and
6. paid feature relock.

## Pricing approval

The owner approved the current affordability-focused catalog without changing values:

- Free: `$0`
- Starter: `$7/month`
- Core: `$19/month`
- Pro: `$39/month`
- Business Builder setup: one-time price configured in Stripe

Readiness now exposes `pricingCatalog: owner_approved`.

## Legal approval boundary

The owner approved the current legal pages as the launch baseline. Readiness records:

- `ownerLegalApproval: owner_approved`
- `legalPages: review_required`
- `legalReviewBoundary: not_attorney_reviewed`

Every legal page states that it is an owner-approved baseline, that qualified legal review remains required, that it is not legal advice, and that it is not represented as attorney-reviewed. Engineering does not substitute for qualified legal counsel.

## Verification

The final implementation passed:

- dependency scan
- Docker Image CI
- SONARA Industries CI
- frozen-lockfile install
- dependency audit at moderate threshold
- typecheck
- lint
- complete Mocha test suite
- build
- Supabase CLI migration/config validation
- production schema verifier
- canonical Supabase contract verifier
- client-secret scan
- route smoke
- launch configuration verification
- OpenAPI runtime drift verification

## Unchanged security boundaries

This finalization did not:

- expose Supabase, Stripe, Resend, or administrator credentials;
- put server credentials in browser code;
- disable RLS;
- add anonymous database writes;
- unlock paid functionality from a redirect;
- invent a payment, webhook, email-delivery, or attorney-review result;
- enable autonomous production agents; or
- replace the accepted root Express/Vercel production runtime.
