# Monetization Setup

Web payments should use Stripe Checkout after manual setup is complete.

Required steps:

1. Rotate any exposed Stripe key.
2. Create Stripe products and monthly prices for Creator, Pro, and Label.
3. Add Stripe environment variables in the Vercel dashboard.
4. Add the production webhook endpoint: `https://sonaraindustries.com/api/stripe/webhook`.
5. Test checkout in Stripe test mode first.
6. Test webhook delivery before granting entitlements.
7. Do not commit secrets.

Until checkout and webhooks are verified, paid CTAs must stay in setup-required mode.

See `docs/STRIPE_LIVE_SETUP.md` for the exact live setup checklist.
