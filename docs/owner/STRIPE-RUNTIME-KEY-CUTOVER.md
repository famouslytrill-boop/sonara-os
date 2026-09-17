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

## How the deployment tells you it is wrong

**It fails on the first step, in seconds, and names which problem you have.**

Updated 17 September 2026. This was already true in the sense that mattered
most — the run failed before any database mutation — but it failed at roughly
the seventeenth step, after dependency install, the audit, the build, the whole
release test suite, lint, every contract check, the migration preview and the
production environment pull. `production-commit-drift.yml` records the cost:
*"every deploy run since 5 August had failed, the newest of them at a single
step, an empty `STRIPE_RUNTIME_SECRET_KEY`."*

The credential precondition is now the first step in the job. It resolves the
same secret in the same order and accepts exactly the same thing — an
`sk_live_...` key — so nothing that worked before stops working. What changed is
that the run summary now states:

- which variable the value came from (`STRIPE_RUNTIME_SECRET_KEY`, or
  `STRIPE_SECRET_KEY` used as the documented compatibility fallback);
- which of the ways it is unusable applies — nothing configured at all, a
  restricted `rk_live_...` verifier, a test-mode key, or an unrecognised prefix;
- whether the value carries leading or trailing whitespace, which is what a
  pasted secret usually picks up. That is reported and **not** failed on, because
  only the live validation further down can say whether Stripe accepts it. If
  authentication fails there, re-paste the secret with no trailing newline.

**No key value is ever printed, logged, or written to the run summary** — only
which variable it came from and which shape class it is.

The synchronization step further down is unchanged and remains the authority: it
validates the selected runtime key against the live configured prices before
changing Vercel, which is the only check that can prove a key actually works.

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
