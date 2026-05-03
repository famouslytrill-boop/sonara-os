# Stripe Secret Rotation Checklist

An exposed live Stripe secret key is compromised. Revoke or delete it before production redeploy.

1. Revoke or delete the exposed key in the Stripe Dashboard.
2. Create a new live secret key with the minimum scope needed.
3. Store the new key only in Vercel Environment Variables and a password manager.
4. Do not store real keys in `.env.local` unless they are strictly local and never committed.
5. Do not put real keys in `vercel.json`.
6. Do not screenshot the key.
7. Do not paste keys into Codex, chat, GitHub, README, AGENTS.md, docs, screenshots, or source files.
8. Keep `.env.example` as placeholders only.

Required Vercel variables:

```text
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_CREATOR_MONTHLY_PRICE_ID=
STRIPE_PRO_MONTHLY_PRICE_ID=
STRIPE_LABEL_MONTHLY_PRICE_ID=
NEXT_PUBLIC_APP_URL=
```
