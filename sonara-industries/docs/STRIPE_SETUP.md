# Stripe Setup

Required env vars:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_SOUNDOS_STARTER`
- `STRIPE_PRICE_SOUNDOS_PRO`
- `STRIPE_PRICE_SOUNDOS_STUDIO`
- `STRIPE_PRICE_TABLEOS_STARTER`
- `STRIPE_PRICE_TABLEOS_PRO`
- `STRIPE_PRICE_TABLEOS_MULTI_LOCATION`
- `STRIPE_PRICE_ALERTOS_STARTER`
- `STRIPE_PRICE_ALERTOS_ORG`
- `STRIPE_PRICE_ALERTOS_CITY`
- `NEXT_PUBLIC_APP_URL`

Use `pnpm stripe:seed` for a dry-run list of lookup keys. The scaffold does not auto-create live Stripe records without a deliberate operator decision.

Webhook events:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

The webhook route verifies signatures and returns entitlement update records for persistence.
