# SONARA Billing and Webhook Report

Date: 2026-07-14

## Preserved surface (verified by the 240-test suite)

- `POST /api/checkout/session` and `POST /api/billing/create-checkout-session`
  — validate plan, require a customer session, return 503
  `setup_required: stripe_secret_key` (exact dependency) when Stripe is
  unconfigured, name the exact missing price env var, redirect browsers to
  Stripe checkout, return `checkout_url` JSON to API clients.
- `POST /api/webhooks/stripe` and `POST /api/stripe/webhook` — registered
  before body parsers with raw-body parsing; HMAC signatures verified with
  timing-safe comparison; 503 when the webhook secret is missing; 400 on
  bad signatures.
- `POST /api/billing/create-portal-session`, `GET /api/billing/status`,
  `/pricing`, `/billing`, `/business-builder/billing` — intact.

## Event handling

- Every event is persisted to `billing_webhook_events` with
  `on_conflict=provider,provider_event_id` and `ignore-duplicates` —
  idempotent by construction (unique constraint now exists in the
  migration).
- `customer.subscription.created/updated/deleted` upserts
  `billing_subscriptions` (`provider,provider_subscription_ref`) and
  derives `billing_entitlements` (`organization_id,entitlement_key`);
  non-active/trialing statuses set entitlements to `disabled`, which
  covers payment failure and cancellation lockout.
- Failure events are audited without touching entitlements (tested).

## Access control

- Paid unlock requires owner/admin override OR an active/trialing
  subscription/entitlement row. Checkout redirects never unlock (tested:
  402 without billing state, 200 with active entitlements).
- Locked/unlocked reason is surfaced: `upgrade_required` payloads with
  `upgrade_url`, dashboard billing panel text, and
  `paid access reason: owner_admin_override | billing entitlement`.

## Status panels

- Dashboard billing card: plan state from org-scoped subscription rows +
  "paid access unlocks only after payment updates" language.
- `/admin/billing`, `/admin/webhooks` (last 20 events), `/admin/subscriptions`
  (rows + counts), `/admin/integrations` (checkout/secret/webhook states),
  `/business-builder/billing` billing panel with per-plan checkout state.
- Test vs live mode: key prefixes are validated (`sk_`/price ID formats);
  mode is visible to operators via env-readiness labels without exposing
  values.

## Resend

- Server-side key only; sender/support addresses via env; placeholder
  values marked invalid; intake/support notifications degrade to
  `setup_required` with reference IDs (never fake success); delivery
  attempts audited in support_email_delivery_attempts.

## No secrets

Client-secret scan passes; no key values are rendered anywhere; webhook
payload bodies are visible only in admin views.
