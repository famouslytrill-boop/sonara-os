# Stripe Production Runbook

Do not paste Stripe secrets into code, docs, screenshots, chat, or GitHub.

## Steps

1. Create products:
   - SONARA OS Creator
   - SONARA OS Pro
   - SONARA OS Label
2. Create recurring monthly prices.
3. Copy Price IDs, not Product IDs.
4. Configure webhook endpoint:
   - `https://sonaraindustries.com/api/stripe/webhook`
5. Add webhook signing secret to hosting secrets:
   - `STRIPE_WEBHOOK_SECRET`
6. Add Stripe secret key to hosting secrets:
   - `STRIPE_SECRET_KEY`
7. Add publishable key only to frontend-safe env:
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
8. Add price IDs:
   - `STRIPE_CREATOR_MONTHLY_PRICE_ID`
   - `STRIPE_PRO_MONTHLY_PRICE_ID`
   - `STRIPE_LABEL_MONTHLY_PRICE_ID`
9. Run safe verification:
   - `npm run verify:stripe`
10. Test checkout.
11. Test subscription update.
12. Test cancellation.
13. Test webhook replay.
14. Verify entitlement gating.

## Optional Seed Plan

Run the dry-run seed plan:

```bash
npm run stripe:seed
```

The root seed script is dry-run by default and does not mutate live Stripe.

## Required Events

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## Stop Conditions

Do not launch paid plans if:

- webhook signature verification fails
- failed/canceled subscriptions still receive paid access
- duplicate webhook events duplicate rows
- secrets appear in logs
