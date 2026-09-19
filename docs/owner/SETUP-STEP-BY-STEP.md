# Installing the keys and the prices, step by step

Review by: 2026-12-08

Written 8 September 2026. Every state below was read from the live site, the
live Stripe account `acct_1TRSqj0dKtlEU3lA`, and this repository on that date.
Nothing here is recalled from an earlier document.

You asked for the whole install. Most of it is already done, so this is ordered
by what is actually left rather than by what a fresh setup would need. Section 1
is the one that is costing you money today. Sections 2 and 3 are the rest of the
open work. Section 4 is the reference for every key, for the day you rebuild
this somewhere else.

---

## 1 — Canonical Stripe catalogue and deployment verification

The live Stripe account was read again on **18 September 2026**. SONARA's
canonical workspace ladder now exists in Stripe at exactly the amounts the
application advertises, for both monthly and yearly billing:

| Plan | Price ID | Amount | Interval | Stripe state |
| --- | --- | ---: | --- | --- |
| One workspace | `price_1UDcAR0dKtlEU3lA6xBfzRYu` | $29 | month | active price / active product |
| All three | `price_1UDcB60dKtlEU3lAiTaUfXLI` | $59 | month | active price / active product |
| Team | `price_1UDcC60dKtlEU3lABcH8EVw6` | $109 | month | active price / active product |
| One workspace yearly | `price_1UDcdq0dKtlEU3lA6bTBV7Pk` | $290 | year | active price / active product |
| All three yearly | `price_1UDcfA0dKtlEU3lAaqioX8tE` | $590 | year | active price / active product |
| Team yearly | `price_1UDcg80dKtlEU3lAoLjca1r0` | $1090 | year | active price / active product |

The three Price IDs previously written in this runbook as the new monthly
catalogue do **not** exist in the connected live Stripe account and must not be
used. The table above is the provider-read result.

### Production environment pointers

Vercel Production should contain only the canonical price variables:

```text
STRIPE_PRICE_WORKSPACE_MONTHLY   = price_1UDcAR0dKtlEU3lA6xBfzRYu
STRIPE_PRICE_ALL_THREE_MONTHLY   = price_1UDcB60dKtlEU3lAiTaUfXLI
STRIPE_PRICE_TEAM_MONTHLY        = price_1UDcC60dKtlEU3lABcH8EVw6
STRIPE_PRICE_WORKSPACE_ANNUAL    = price_1UDcdq0dKtlEU3lA6bTBV7Pk
STRIPE_PRICE_ALL_THREE_ANNUAL    = price_1UDcfA0dKtlEU3lAaqioX8tE
STRIPE_PRICE_TEAM_ANNUAL         = price_1UDcg80dKtlEU3lAoLjca1r0
```

Do not restore retired pricing variables or product-specific aliases. Runtime checkout, readiness, entitlement mapping and plan limits no
longer recognize them.

### Verification sequence

1. Let the controlled production dry run pull the real Vercel Production
   environment.
2. Require `scripts/verify-stripe-env.mjs --require-live` to prove each
   configured Price has the advertised amount, interval and active Product.
3. Do not deploy if a canonical variable points at any other Price.
4. After the exact-head CI and controlled deployment are green, complete one
   authenticated One-workspace checkout and confirm the persisted Stripe
   entitlement opens the workspace.
5. Cancel/refund the proof purchase as appropriate and confirm paid access
   relocks after the authoritative Stripe update.

The verifier credential may be a restricted live key with Prices/Products read
access. The customer-facing runtime credential remains separate and must retain
the permissions required to create customers and Checkout Sessions.

### Historical billing evidence

The provider-read retirement ledger, including historical plan names, aliases,
Price IDs, and the zero-subscription evidence captured before archival, lives in
`docs/archive/legacy-names.md`. Active setup instructions intentionally use only
the canonical catalogue above.

---

## 2 — Google sign-in is required

Google is no longer deferred and there are no SONARA/Vercel variables named
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or `GOOGLE_REDIRECT_URI`.

SONARA uses the hosted Supabase Google provider and server-side PKCE:

1. In Google Cloud, create/open the SONARA OAuth Web Client.
2. Add this exact Google Authorized redirect URI:
   `https://yqncsonkxgwhcxedgevk.supabase.co/auth/v1/callback`
3. In Supabase -> Authentication -> Providers -> Google, enable Google and paste
   that Web Client ID and Client Secret.
4. In Supabase Auth redirect URLs, allow:
   `https://sonaraindustries.com/auth/callback`
5. Save the provider.
6. Run:
   `node scripts/verify-google-oauth-provider.mjs --require`
   with the production Supabase public URL/anon values loaded.
7. Confirm production `/api/readiness` reports
   `services.googleOAuth = "configured"`.
8. Complete one real Google login from `/login` and confirm it returns through
   `/auth/callback` to `/dashboard` (or the requested safe SONARA path).

The controlled production deployment runs the same provider verification after
pulling the production Vercel environment and **before** rollback checkpoint,
database migration, or Vercel deployment. If Google is not enabled at Supabase,
the release stops with production untouched.

### The owner steps that are still real

From `docs/owner/OWNER-STEPS.md`, with today's state against each:

| # | Step | State on 8 September 2026 |
| --- | --- | --- |
| 1 | Buy a plan in production, once | **Open.** Blocked by section 1 above — no plan on the page can complete checkout. Do section 1, then this. |
| 2 | Supabase leaked-password protection, **and** `SONARA_REQUIRE_LEAKED_PASSWORD_PROTECTION=true` | **Open, and not visible from here.** The dashboard toggle and the variable are two halves and people do one. Until the variable is set, a green deploy tells you nothing about whether the toggle is on. |
| 4 | Try one `EXECUTE` revoke on a preview branch | Open. Blocks nothing. |
| 6 | Make the `sonara-uploads` bucket, and make it **private** | Open. A public bucket makes every signed link pointless. |
| 7 | Enable Stripe Connect, so your customers can be paid | Open. Read what you are agreeing to in that section before switching it on. |

Items 3 and 8 are closed and kept as records.

---

## 3 — Where a variable goes, and the three rules about that

Every variable in this document goes in **one** place: Vercel → Settings →
Environment Variables → **Production**. Then redeploy, because Vercel does not
apply an environment change to a deployment that is already running.

1. **`SUPABASE_SERVICE_ROLE_KEY` is server-only.** It bypasses every row-level
   security rule in the database. It must never appear in a `NEXT_PUBLIC_*`
   variable, in a client bundle, or in a commit.
2. **`SONARA_ALLOW_MANUAL_ORG_ID` must never be set.** It accepts an
   `organization_id` straight from the request body with no membership check.
   The code now refuses it in production regardless of value, and
   `tests/manual-org-id-guard.test.js` fails if that guard is removed — setting
   it to `false` is the second lock, not the only one.
3. **Never commit a secret.** GitHub push protection blocks it, and a key that
   reached a commit is a key to rotate rather than a commit to amend.

To check you have not missed one:

```
pnpm run verify:env
```

It reads every `process.env` reference in the source and fails in both
directions: a variable the code reads with no classification, and a
classification for a variable nothing reads.

---

## 4 — Every key, and where it comes from

This is the reference half. All of it is already set in production; it is here
for the day you rebuild this in a second environment, and so each value can be
checked rather than assumed.

`docs/owner/PROVIDER-KEYS.md` is the generated long version, covering all 30
providers the application can reach — 13 that need an account and 17 that need
nothing bought. This is the short version: the ten variables without which a
paying customer cannot be served, grouped by the account you open.

### Supabase — the database, sign-in and file storage

<https://supabase.com/dashboard> → your project → **Project Settings → API**.

| Variable | Where it is on that page |
| --- | --- |
| `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role — **server-only** |

Then **Authentication → Providers**: turn on Email, and turn on leaked-password
protection.

### Stripe — payments and who is on which plan

<https://dashboard.stripe.com/apikeys>.

| Variable | Where it comes from |
| --- | --- |
| `STRIPE_SECRET_KEY` | Developers → API keys → Secret key |
| `STRIPE_WEBHOOK_SECRET` | Developers → Webhooks → add an endpoint at `https://YOUR-DOMAIN/api/stripe/webhook`, then copy its **Signing secret** |
| `STRIPE_PRICE_*` | One per plan — section 1 above |

**`STRIPE_WEBHOOK_SECRET` is the one whose absence looks fine.** Checkout
succeeds, the customer is charged, and the entitlement never arrives. Nothing on
the outside looks wrong. It is also what proves a message came from Stripe:
without it, anything that can reach that endpoint can claim somebody paid.

### Resend — email

<https://resend.com/api-keys>.

| Variable | Where it comes from |
| --- | --- |
| `RESEND_API_KEY` | An API key with send permission |
| `RESEND_FROM_EMAIL` | An address at a domain you have **verified** with Resend |

Add the DNS records Resend gives you and wait for the domain to verify before
sending anything. Sending before it verifies puts your mail in spam folders and
is hard to undo.

### Your own domain

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | The full address including `https://`, no trailing slash |

Used to build the links in email and the return URLs from checkout. Wrong here
means a customer who pays and lands on the wrong host.

### Nothing to buy: the two-factor key

| Variable | Required |
| --- | --- |
| `SONARA_TOTP_KEY` | No |

Generate it yourself: `openssl rand -hex 32`. Set it once and keep it — changing
it makes every enrolled second factor unreadable. Until it is set, two-factor
authentication refuses to switch on and says so on the page. It does not fall
back to storing secrets in the clear.

### Everything else is optional, and that word is safe here

132 environment variables are read and ten are required. `pnpm run verify:env`
prints that split and fails if a variable is read by the code and classified
nowhere, so the numbers here come from a command rather than from memory — the
previous version of this paragraph said fifty-eight variables and six adapters,
and both had been true once.

Every optional one degrades to a stated "setup required" rather than an error,
and **none may become a launch dependency** — enforced by the release checks
rather than by intention. That covers all eleven service adapters, every
analytics key and every media provider.

Eight of those eleven adapters talk to software you run yourself: Ollama,
Langflow, Open WebUI, Crawl4AI, Dify, RAGFlow, whisper.cpp and voice clone. If
you install one on your laptop, the deployed application still cannot reach it.
`http://localhost:11434` means "this serverless function", which is a machine in
a datacentre with no Ollama on it. `docs/architecture/EXTERNAL-SERVICES.md` is
the long version.

### The three Cloudflare services, which are the exception to that

These are hosted on public addresses, so the deployed application can reach them
with nothing tunnelled and nothing running on your machine. You created all
three on 9 September 2026, and this is what each needs before the code can use
it. All three are still optional: set none of them and the product works.

Your **account id** is the 32-character hex string in every Cloudflare dashboard
URL. It is configuration rather than a secret — it appears in those URLs — and
the same value is used by all three.

**Workers AI** — running a language model without hosting one:

```
SONARA_WORKERS_AI_ENABLED=true
SONARA_WORKERS_AI_URL=https://api.cloudflare.com/client/v4
SONARA_WORKERS_AI_ACCOUNT=<your 32-character account id>
SONARA_WORKERS_AI_MODEL=@cf/meta/llama-3.1-8b-instruct
SONARA_WORKERS_AI_TOKEN=<API token with Workers AI: Read>
```

**D1** — the SQL database you created as `sonaraindustriesd1`. Its id is the
UUID on its dashboard page:

```
SONARA_D1_ENABLED=true
SONARA_D1_URL=https://api.cloudflare.com/client/v4
SONARA_D1_ACCOUNT=<your 32-character account id>
SONARA_D1_DATABASE=<the database UUID>
SONARA_D1_TOKEN=<API token with D1: Edit>
```

D1 is for derived data only — counters, caches, rollups. The adapter refuses any
statement naming a table your Supabase migrations create, so the two databases
cannot come to disagree about a customer record.

**R2** — the bucket you created as `sonaraindustriesr2`. This one needs a key
*pair* rather than a token, because R2 speaks the S3 API. Create it under
**R2 → Manage R2 API Tokens → Create API token**, scoped to that one bucket:

```
SONARA_R2_ENABLED=true
SONARA_R2_URL=https://<your account id>.r2.cloudflarestorage.com
SONARA_R2_BUCKET=sonaraindustriesr2
SONARA_R2_ACCESS_KEY_ID=<the access key id>
SONARA_R2_SECRET_ACCESS_KEY=<the secret access key>
```

Both R2 values are secrets. The access key id is not a password, but it is half
of one, and nothing in this product displays either.

One thing worth knowing before you rely on R2: no request from this code has
ever reached Cloudflare. The request signing is checked against signature
examples AWS publishes, so it is verified rather than hoped at — but that R2
accepts the result is not something this repository can prove without your key
pair. The first file you store is the proof.

---

## 5 — Running it on your own machine, if you want to

`docs/owner/INSTALL.md` is the full version. The short one:

```
corepack enable                  # gets the pinned pnpm; do not use npm here
pnpm install --frozen-lockfile
pnpm start                       # http://localhost:5000, not 3000
```

**Copying `.env.example` to `.env` does nothing on its own** — there is no
`dotenv` in this project, and nothing reads that file at startup. Use:

```
pnpm run dev                     # node --env-file=.env server.js
```

A blank local install is *supposed* to show public pages at 200 and `/dashboard`
at 503. That 503 is the "setup required" state, not a broken install.

---

## The order, if you only read one thing

1. Keep only the canonical Stripe plans: **One workspace $29**, **All three $59**, **Team $109** (plus optional annual twins).
2. Verify them with `node scripts/verify-stripe-env.mjs --require-live`.
3. Do not restore retired pricing keys or aliases; the archived provider-read ledger records the zero-subscription evidence.
4. Enable Google in Supabase Auth and put the Google Web Client ID/Secret there only.
5. Google Cloud redirects to `https://yqncsonkxgwhcxedgevk.supabase.co/auth/v1/callback`.
6. Supabase is allowed to redirect to `https://sonaraindustries.com/auth/callback`.
7. Run `node scripts/verify-google-oauth-provider.mjs --require`, then complete one real production Google sign-in.
