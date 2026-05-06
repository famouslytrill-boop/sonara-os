# Stripe Testing Checklist

## Local / Staging

- `npm run verify:stripe`
- Checkout route returns setup-required when env vars are absent.
- Free tier cannot create Checkout.
- Invalid tier is rejected.
- Paid tier uses a `price_...` ID.
- Secret key is never sent to client.
- Webhook route rejects missing signature.
- Webhook route rejects invalid signature.
- Webhook route accepts valid signed test events.

## Live Manual Checks

- Creator checkout opens.
- Pro checkout opens.
- Label checkout opens.
- Checkout cancel redirects to `/pricing?checkout=cancelled`.
- Checkout success redirects to `/account/billing?checkout=success`.
- Stripe webhook delivery is `200`.
- Subscription row updates in Supabase.
- Canceled subscription updates.
- Failed payment updates.
- Replayed webhook event does not duplicate business state.

Do not complete live payment tests unless intentionally authorized.
