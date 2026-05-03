# Safe Software Bootstrap Guide

The request was to find and download all software needed to run SONARA OS™ efficiently and make money. The safe version is:

- install only required project dependencies from the lockfile
- check optional tools without downloading them
- configure paid services through official dashboards
- never commit or paste secrets
- never claim profit is guaranteed

## Recommended Local Flow

```powershell
npm run check:software
npm run bootstrap:local
npm run launch:local-check
```

## What `bootstrap:local` Does

`npm run bootstrap:local` runs `npm ci` when `package-lock.json` exists. That installs the exact project dependencies recorded in the lockfile.

It does not:

- install random global tools
- install heavy audio, GPU, vector, or LLM stacks
- add secrets
- modify Vercel, Stripe, Supabase, or GitHub settings

## What Must Be Manual

- Rotate the exposed Stripe live key in Stripe Dashboard.
- Add the new Stripe key only to Vercel Environment Variables and a password manager.
- Configure Stripe products, prices, and webhooks.
- Configure Supabase migrations, RLS, Auth, and Storage.
- Connect the correct GitHub repo from the actual project root.
- Redeploy through Vercel.

## Profit Readiness

Software can make SONARA OS™ payment-ready, not profit-guaranteed. Revenue still depends on product-market fit, pricing, traffic, support, legal readiness, checkout reliability, and customer trust.
