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

## 1 — The pricing page is advertising three plans nobody can buy

**This is the finding. Read it before doing anything else.**

`/pricing` advertises **One workspace $29/mo, All three $59/mo, Team $109/mo**.
Your live Stripe account holds **thirteen prices in its entire history**, and
**none of them is $29, $59 or $109.** The closest are the three created on
13 August 2026, which charge **$19, $39 and $79** and carry the lookup keys
`sonara_workspace_monthly`, `sonara_all_three_monthly` and
`sonara_team_monthly`.

So whatever `STRIPE_PRICE_WORKSPACE_MONTHLY`, `STRIPE_PRICE_ALL_THREE_MONTHLY`
and `STRIPE_PRICE_TEAM_MONTHLY` are set to in Vercel, they cannot be pointing at
a price that charges what the page says.

**Nobody is being overcharged, and nobody is being charged the wrong amount.**
`assertPriceMatchesAdvertised` in `lib/sonara-billing.cjs` fetches the price from
Stripe on every checkout and refuses to create the session when the amount
disagrees:

```js
if (price.unit_amount !== expected) return { ok: false, code: "price_mismatch", ... };
```

The consequence is worse in a quieter way: **every headline plan on your pricing
page refuses checkout.** A customer clicking Start on any of the three gets a
refusal, not a Stripe page. Only Free works.

### How this happened, since it is worth knowing

`docs/owner/OWNER-STEPS.md` item 5 was written on 19 August 2026, when the plan
table held $19/$39/$79, and it names those three price ids in a table with the
instruction "set each variable above to its price id". That was correct on the
day it was written. On 6 September the amounts moved to $29/$59/$109 and the
price ids in that table stopped matching — but the instruction still read like a
current one. Following it exactly produces precisely this state.

A Stripe price is immutable. Changing what a plan costs always means creating a
new price; there is no edit.

### Fix it in four steps

**Step 1. Create three prices. — DONE 8 September 2026, at the owner's
instruction.** They were created on the existing products, so the description a
customer sees on the invoice stays right, and read back from Stripe to confirm:

| Plan | Price id | Amount | Interval | Lookup key |
| --- | --- | --- | --- | --- |
| One workspace | `price_1UDTj00dKtlEU3lAmimC5cN7` | **$29.00** | month | `sonara_workspace_monthly_v2` |
| All three | `price_1UDToK0dKtlEU3lAWURVCj6H` | **$59.00** | month | `sonara_all_three_monthly_v2` |
| Team | `price_1UDUKr0dKtlEU3lAJzu0pVoe` | **$109.00** | month | `sonara_team_monthly_v2` |

All three: `active: true`, `livemode: true`, USD, `interval_count: 1`. Price ids
are not secrets — they travel to the browser during checkout — so they are
written down here rather than described.

The `_v2` suffix keeps the old price and the new one tellable apart in the
dashboard while both exist. The 13 August prices at $19 / $39 / $79 are still
active and still carry the unsuffixed lookup keys; **step 5 archives them, and
not before step 3 passes.**

Creating a price charges nobody — a price is inert until a checkout session
names it. **Nothing changed for a customer when these were created**, because
the three environment variables still point at the old prices. That is step 2.

**Step 2. Repoint three variables.** Vercel → your project → Settings →
Environment Variables → **Production**:

```
STRIPE_PRICE_WORKSPACE_MONTHLY = price_1UDTj00dKtlEU3lAmimC5cN7
STRIPE_PRICE_ALL_THREE_MONTHLY = price_1UDToK0dKtlEU3lAWURVCj6H
STRIPE_PRICE_TEAM_MONTHLY      = price_1UDUKr0dKtlEU3lAJzu0pVoe
```

**This is the step that changes what a customer is charged**, and until it is
done the pricing page still advertises $29 / $59 / $109 while the variables
point at the $19 / $39 / $79 prices — so every one of those three plans still
refuses checkout with `price_mismatch`. Creating the prices did not fix that on
its own, and could not have.

Price ids are not secrets — they travel to the browser during checkout — so you
can paste them anywhere you like. **Vercel does not apply an environment change
to a deployment that is already running. Redeploy afterwards.**

**Step 3. Prove the amounts agree, with the key present.**

```
STRIPE_SECRET_KEY=rk_live_... node scripts/verify-stripe-env.mjs --require-live
```

**Use a restricted key, not your live secret key.** This script makes one kind
of call — `GET /v1/prices/{id}` — so a Stripe **restricted key** with read
access to Prices is enough. Create one at Developers → API keys → Create
restricted key, grant *Prices: read*, and grant nothing else. A restricted key
that leaks cannot charge anybody, refund anybody, or read a customer.

The variable is still named `STRIPE_SECRET_KEY`, because that is what the code
reads; the value can be `rk_...` or `sk_...`.

**The same key is what the deployment needs.** The controlled production
deployment runs this check as step 26 of 32, so add that restricted key to the
repository's protected GitHub environment as `STRIPE_SECRET_KEY`
(Settings → Environments → the production environment → Add secret). Until it is
there, every deployment fails at that step — deliberately: a deployment that
cannot prove it charges what it advertises is what shipped the September
mismatch.

`--require-live` was added on 8 September 2026 and is the point of this whole
section. Without it the script skips the live comparison when there is no key
**and still exits 0**, which is why both runbooks tell you to "read the last
line rather than the exit code". That instruction was followed and this
happened anyway. With the flag, every reason for not comparing is a failure, so
the exit code means what the last line says.

Expect one line per plan:

```
[OK] workspace_monthly: Stripe charges exactly what the pricing page advertises
```

Anything else stops the cutover.

**Step 4. Buy one, with a real card.** `docs/SHIP_READINESS.md` item 1, still
open. Buy One workspace at $29, confirm the workspace opens rather than saying
"setup required", then refund yourself. The charge path, subscription creation
and refund have all been observed working. **The entitlement half never has** —
the only subscription that ever existed lived 29 minutes. This is the only thing
that proves it.

**Do not archive the old prices until steps 3 and 4 pass.** A superseded plan
drops off the page only when its replacement can be bought, so archiving first
takes the pricing page down to nothing purchasable. That is
`docs/owner/PRICE-CUTOVER-RUNBOOK.md` pathway C, and it is the one to avoid.

### Optional, once the monthly three work: annual billing

Three more prices, and the page will start showing yearly cards it currently
hides entirely:

| Variable | Interval | Amount |
| --- | --- | --- |
| `STRIPE_PRICE_WORKSPACE_ANNUAL` | **year** | $290 |
| `STRIPE_PRICE_ALL_THREE_ANNUAL` | **year** | $590 |
| `STRIPE_PRICE_TEAM_ANNUAL` | **year** | $1090 |

Each is ten months of its monthly twin — two months free. Check the interval
says **year**, not month; `verify-stripe-env.mjs` refuses a subscription plan
whose Stripe interval disagrees with the period the page advertises.

`/api/readiness` reports these three under `deferred.stripe` rather than
`missing.stripe`, which is the difference between a variable nobody is waiting
for and a variable nobody has noticed. Leaving them unset is a supported state,
not an unfinished one.

---

## 2 — What is genuinely still open, besides the prices

Read from `/api/readiness` on production at 06:15 UTC on 8 September 2026, which
was serving commit `6f4c7b1`:

```
missing:  { "googleOAuth": ["GOOGLE_REDIRECT_URI"] }
deferred: { "stripe": ["STRIPE_PRICE_WORKSPACE_ANNUAL",
                       "STRIPE_PRICE_ALL_THREE_ANNUAL",
                       "STRIPE_PRICE_TEAM_ANNUAL"] }
invalid:  (nothing, for any service)
```

Everything else — Supabase, Stripe secret, Stripe webhook, Resend, admin
protection, founder access, the account database, the payment connection and
payment updates — reports `configured`.

### `GOOGLE_REDIRECT_URI` is not a task. Do not set it.

It reads like the one outstanding variable, and it is not one. Checked by
grep on 8 September 2026: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and
`GOOGLE_REDIRECT_URI` appear in `.env.example`, in `lib/sonara-readiness.cjs`,
and in tests and docs. **No route reads any of them.** `services.googleOAuth` is
the string literal `"deferred"` in `lib/sonara-readiness.cjs` — it cannot become
`configured`, whatever you set.

So setting `GOOGLE_REDIRECT_URI` would empty that `missing` list and add no
Google sign-in button. It would make the readiness payload say a capability is
fully configured that does not exist. Leave it unset until somebody builds
Google sign-in.

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

Fifty-eight environment variables are read; ten are required. Forty of the rest
are capabilities, every one of which degrades to a stated "setup required"
rather than an error, and **none may become a launch dependency** — that is
enforced by the release checks rather than by intention. That includes all six
service adapters (Ollama, Langflow, Open WebUI, Crawl4AI, Dify, RAGFlow), every
analytics key and every media provider.

If you install one of those adapters on your laptop, the deployed application
still cannot reach it: `http://localhost:11434` means "this serverless
function", which is a machine in a datacentre with no Ollama on it.
`docs/architecture/EXTERNAL-SERVICES.md` is the long version.

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

1. Create three Stripe prices at **$29, $59, $109**.
2. Repoint the three `STRIPE_PRICE_*_MONTHLY` variables in Vercel Production, and redeploy.
3. `STRIPE_SECRET_KEY=sk_live_... node scripts/verify-stripe-env.mjs --require-live`
4. Buy One workspace with a real card, confirm the workspace opens, refund.
5. Only then archive the old $19/$39/$79 prices.
6. Leave `GOOGLE_REDIRECT_URI` alone.
