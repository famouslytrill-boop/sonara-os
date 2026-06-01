# Stripe Test-mode Walkthrough

Use this walkthrough before launch to verify billing without charging live payment methods. Keep Stripe test mode and live mode separate at every step.

## Safety Rules

- Test mode and live mode must not be mixed.
- Do not enter live card data in test mode.
- Do not store raw card numbers, CVV, bank credentials, provider secrets, or webhook payload secrets in the app.
- Use hosted Stripe Checkout and Stripe Customer Portal for billing tests.
- Payouts happen in Stripe Dashboard. SONARA One does not control Stripe payout schedules.

## Test-mode Checklist

- [ ] Stripe account created.
- [ ] Business details completed.
- [ ] Bank payout account connected in Stripe.
- [ ] Products created.
- [ ] Prices created.
- [ ] Env vars added.
- [ ] Webhook endpoint created.
- [ ] Webhook secret added.
- [ ] Test checkout completed.
- [ ] Subscription record updated.
- [ ] `invoice.paid` handled.
- [ ] `payment_failed` handled.
- [ ] Customer portal tested.

## Required Env Vars

Configure these in the local `.env` file or hosting test environment. Do not commit real values.

```bash
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_CORE=
STRIPE_PRICE_GROWTH=
STRIPE_PRICE_PRO=
STRIPE_PRICE_AGENCY=
STRIPE_PRICE_SETUP_99=
STRIPE_PRICE_SETUP_299=
STRIPE_PRICE_SETUP_499=
```

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is browser-exposed. All other Stripe values above must remain server-side.

## Verification Order

1. Create Stripe products and prices in test mode.
2. Add the test-mode env vars.
3. Create the webhook endpoint for the deployed test URL.
4. Add the webhook secret to the server-side environment.
5. Confirm `/admin/diagnostics` shows Stripe test-mode health without exposing values.
6. Run a test Checkout session using a Stripe test card.
7. Confirm `checkout.session.completed` and subscription events are received.
8. Confirm `invoice.paid` is handled.
9. Confirm `invoice.payment_failed` is handled with a test failure path.
10. Open the Customer Portal and verify plan management behavior.
11. Re-run validation:

```bash
pnpm run validate:infrastructure
pnpm run typecheck
pnpm test
pnpm run build
pnpm run smoke
```

## Admin Health Panel

The admin diagnostics page includes a Stripe test-mode billing health panel showing:

- Stripe secret key configured: yes/no, redacted.
- Publishable key configured: yes/no, redacted.
- Webhook secret configured: yes/no, redacted.
- Price IDs configured: yes/no.
- Webhook route reachable: yes/no.

This panel is status-only. It does not show keys, create checkout sessions, process webhooks, or control payouts.

## Launch Gate

Do not enable live billing until:

- Test-mode Checkout succeeds.
- Customer Portal test succeeds.
- Webhook signature verification is confirmed.
- Required subscription and invoice events are handled.
- Pricing and plan names match the public pricing page.
- Owner payout expectations are documented and reviewed.
