# Stripe Setup

Required env vars:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_TRACKFOUNDRY_STARTER_PRICE_ID`
- `STRIPE_TRACKFOUNDRY_STUDIO_PRICE_ID`
- `STRIPE_TRACKFOUNDRY_LABEL_PRICE_ID`
- `STRIPE_LINEREADY_SINGLE_STORE_PRICE_ID`
- `STRIPE_LINEREADY_OPERATOR_PRICE_ID`
- `STRIPE_LINEREADY_GROUP_PRICE_ID`
- `STRIPE_NOTICEGRID_COMMUNITY_PRICE_ID`
- `STRIPE_NOTICEGRID_ORGANIZATION_PRICE_ID`
- `STRIPE_NOTICEGRID_MUNICIPAL_PRICE_ID`
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
