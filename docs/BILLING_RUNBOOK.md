# Billing Runbook

## Owner Payment Path

Customers pay through Stripe Checkout, Stripe-hosted subscriptions, Stripe Payment Links, or approved external provider links. Money enters the owner's Stripe account. Stripe pays out to the connected bank account according to Stripe payout settings.

SONARA One does not store raw card data, does not store CVV, and does not control Stripe's payout schedule.

## Launch Checklist

- Create Stripe products for Starter, Core, Growth, Pro, Agency, and setup services.
- Add Stripe price IDs to Vercel environment variables.
- Configure `/api/stripe/webhook` in Stripe.
- Add the webhook signing secret as `STRIPE_WEBHOOK_SECRET`.
- Complete a test-mode checkout.
- Confirm subscription update handling.
- Confirm failed-payment behavior.
- Confirm customer portal behavior before public billing launch.

## Owner Approval Required

- Refunds
- Price changes
- Payout settings
- Marketplace payout logic
- Subscription entitlement overrides

Use Stripe Dashboard for refunds and disputes until production admin workflows are reviewed.
