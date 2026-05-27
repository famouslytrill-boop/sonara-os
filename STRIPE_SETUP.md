# Stripe Setup

Stripe is used through server-side APIs and Stripe-hosted Checkout. The app does not store raw card data or CVV.

## Required Variables

Server-only:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Client-safe:

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

Price IDs:

- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_CORE`
- `STRIPE_PRICE_GROWTH`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_AGENCY`
- `STRIPE_PRICE_SETUP_99`
- `STRIPE_PRICE_SETUP_299`
- `STRIPE_PRICE_SETUP_499`

The current pricing implementation also uses product-specific price variables listed in `.env.example`.

## Checkout

The checkout route is `/api/stripe/checkout`. If Stripe is not configured, it returns a setup-required response and does not create a Checkout Session.

## Webhooks

The webhook route is `/api/stripe/webhook`. It verifies the Stripe signature using `STRIPE_WEBHOOK_SECRET`.

Local webhook test command:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Safety Rules

- Use Stripe-hosted Checkout or approved Payment Links.
- Do not store raw card numbers.
- Do not store CVV.
- Keep `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` server-side only.
- Refunds and disputes must be handled in Stripe and reviewed by the owner/admin before action.
