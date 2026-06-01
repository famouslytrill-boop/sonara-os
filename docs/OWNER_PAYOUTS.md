# Owner Payouts

SONARA One billing must stay provider-hosted for MVP. The app does not take custody of customer funds for businesses and does not control Stripe payout timing.

## How The Owner Gets Paid

1. A customer pays through Stripe Checkout, Stripe Payment Link, or another provider-hosted Stripe flow.
2. Stripe processes the payment and records the customer, invoice, payment, or subscription in Stripe.
3. Money enters the Stripe account configured by the owner.
4. Stripe deposits payouts to the owner connected bank account according to the payout schedule shown in Stripe Dashboard.
5. Refunds, disputes, failed payments, payout delays, and payout account updates are handled in Stripe Dashboard.

## App Boundaries

- SONARA One does not store raw card numbers.
- SONARA One does not store CVV.
- SONARA One does not store full bank credentials.
- SONARA One does not store Stripe secret keys client-side.
- SONARA One does not control Stripe payout schedules.
- SONARA One does not provide marketplace or third-party payouts in MVP.

## Stripe Connect Note

Marketplace or third-party payouts require a future Stripe Connect review. That work must be separately scoped, feature-flagged, security-reviewed, and documented before implementation.

## Test-mode Requirement

Before live billing:

- Complete `docs/STRIPE_TEST_MODE_WALKTHROUGH.md`.
- Verify the admin Stripe billing health panel.
- Confirm webhook signature verification.
- Confirm price IDs match launch pricing.
- Confirm live mode and test mode are not mixed.
