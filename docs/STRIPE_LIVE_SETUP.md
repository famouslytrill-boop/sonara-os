# Stripe Live Setup

Stripe live mode is blocked until test mode checkout, customer portal, and signed webhook verification are complete.

## Required Checks

- `STRIPE_SECRET_KEY` configured server-side.
- `STRIPE_WEBHOOK_SECRET` configured server-side.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` configured client-side only.
- Price IDs configured through environment variables.
- Checkout route safely blocks when env is missing.
- Webhook route verifies Stripe signature against raw request body.
- Customer portal route requires auth and a verified Stripe customer.
- Refunds, price changes, and payout settings require owner approval.

## Payment Custody

The app does not store raw card numbers, CVV, bank credentials, provider tokens, or payout credentials.
