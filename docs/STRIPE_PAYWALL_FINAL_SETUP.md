# Stripe Paywall Final Setup

SONARA billing must use hosted Stripe Checkout, Customer Portal, Payment Links, or subscriptions for SONARA's own billing.

Checklist:

- Configure `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- Configure `STRIPE_SECRET_KEY` server-only.
- Configure `STRIPE_WEBHOOK_SECRET` server-only.
- Configure all Stripe price ID env vars.
- Verify checkout route blocks safely when env is missing.
- Verify webhook route validates Stripe signatures.
- Verify customer portal route requires auth.
- Confirm refunds require owner confirmation.
- Confirm price changes require owner confirmation.
- Confirm payout setting changes are blocked from automation.
- Keep Stripe Connect and marketplace payouts disabled for MVP unless future review approves them.

The app must not store raw card numbers, CVV, bank credentials, provider secrets, or payout details.
