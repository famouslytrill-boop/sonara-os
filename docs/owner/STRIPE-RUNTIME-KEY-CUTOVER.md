# Stripe runtime key cutover

**Purpose:** repair the production `STRIPE_SECRET_KEY` without turning the read-only deployment verifier into a customer-facing billing credential.

## Credential boundary

SONARA uses two different Stripe credentials for two different jobs:

| Location | Secret name | Expected form | Purpose |
| --- | --- | --- | --- |
| GitHub `production` environment | `STRIPE_SECRET_KEY` | `rk_live_...` preferred | Read-only deployment proof for configured Prices and Products. |
| GitHub `production` environment | `STRIPE_RUNTIME_SECRET_KEY` | `sk_live_...` | Source credential for the production runtime cutover. |
| Vercel Production | `STRIPE_SECRET_KEY` | `sk_live_...` | Customer-facing billing runtime: create/read Stripe customers and create Checkout Sessions in addition to reading catalog data. |

Do **not** copy the `rk_live_...` verifier into Vercel. A verifier restricted to Prices/Products read access can make the price audit pass while every customer/Checkout Session write fails.

## One-time owner setup

1. In Stripe, open **Developers → API keys** for the live account. Use the live **secret key** whose value begins with `sk_live_`. Do not paste the value into chat, a commit, an issue, or a log.
2. In GitHub, open the `famouslytrill-boop/sonara-os` repository → **Settings → Environments → production → Environment secrets**.
3. Add or replace the secret named **`STRIPE_RUNTIME_SECRET_KEY`** with that `sk_live_...` value.
4. Keep the existing GitHub **`STRIPE_SECRET_KEY`** restricted verifier in place. It remains the low-privilege credential used by `scripts/verify-stripe-env.mjs`.
5. Do not manually overwrite Vercel after the protected GitHub secret is installed. The controlled deployment performs the cutover and stores Vercel's `STRIPE_SECRET_KEY` as a sensitive Production variable.

The controlled deployment fails **before database mutation** when the runtime secret is absent or is not an `sk_live_...` key. It validates the selected runtime key against the live configured prices before changing Vercel.

## Required proof after cutover

The deployment is not complete merely because Vercel accepts the environment variable. The same controlled run must then pass all of these existing gates:

- release tests, lint, secret scan, routes, database/storage contracts, OpenAPI and open-source controls;
- live Stripe advertised-price verification;
- production migration preview and apply/verification;
- Vercel production deployment;
- apex and `www` commit/alias/authentication verification;
- `scripts/verify-production-product-catalog.mjs --pages-only` against the apex.

After a successful run, `GET /api/readiness` on `https://sonaraindustries.com` must report:

- `services.stripe = "configured"`;
- `paymentConnection = "configured"`;
- `services.checkout = "enabled"` when at least one paid plan is configured;
- no `STRIPE_SECRET_KEY` entry under `invalid.stripe`.

## Rotation

When the runtime Stripe secret is rotated:

1. rotate/create the live Stripe secret in Stripe;
2. replace GitHub `production` environment secret `STRIPE_RUNTIME_SECRET_KEY`;
3. run **Controlled Production Deployment**;
4. wait for the final catalog/pages gate to pass;
5. only then revoke the previous runtime secret.

Keep the read-only `STRIPE_SECRET_KEY` verifier separate unless it also needs an independent rotation. This preserves least privilege for the CI price-audit credential while allowing the runtime to perform the billing writes its code actually requires.
