# Installing every key, in the order that unblocks the most

Written 9 September 2026. The counts come from `pnpm run verify:env`, which
fails if the code reads a variable that is classified nowhere — so the split
below is derived rather than remembered.

**132 variables are read. Ten are required. Everything else is optional, and
optional means the product works without it** — a missing optional key produces
a stated "setup required" on a page, never an error and never a blank screen.
That is enforced by the release checks, not by good intentions.

Two rules before any of it:

- **Never paste a live key into a chat.** Not to me, not to anyone. Every step
  below is something you do in a dashboard.
- **A variable is read when a deployment is built.** Setting one in Vercel and
  not redeploying changes nothing at all. Every section ends with a redeploy for
  that reason.

---

## Step 0 — The one that is blocking everything

**Updated 9 September 2026 from deployment run 34381505461.** This section used
to say `STRIPE_SECRET_KEY` was absent and that installing it was the whole job.
That is no longer true and repeating it would send you to fix something that is
already done: the run's log shows `STRIPE_SECRET_KEY: ***` injected into the
step, so the secret **is** installed. The deploy is blocked by two different
things, both visible in that one run.

### 0a — The restricted key cannot read prices

Three plans failed with `Stripe returned 403 for its configured price`
(`starter_monthly`, `core_monthly`, `pro_monthly`). A 403 is Stripe saying the
key is valid but not permitted — not that the price id is wrong.

The likely cause is an instruction that used to be on this page: *"grant exactly
one permission: Prices → Read. Nothing else."* That was wrong. The check fetches
`GET /v1/prices/{id}?expand[]=product` — it expands the product deliberately,
because `lib/sonara-billing.cjs` expands it too and refuses an archived product
at checkout. **An expand needs read permission on the thing being expanded.**

So the key needs two grants, not one:

1. Stripe → **Developers → API keys** → edit `github-deploy-price-check`
   (or create a restricted key by that name)
2. Grant **Prices → Read** *and* **Products → Read**. Still nothing else.
3. If you create a new key, copy the `rk_…` value into GitHub → repo →
   **Settings → Environments → [the production environment]** → the
   `STRIPE_SECRET_KEY` secret.

Two read grants are still a small key: it cannot charge, refund, or read a
customer. Do not use your full secret key here.

Re-run the deploy and read the failure line — it now prints Stripe's own message
alongside the status, which names the permission it wanted.

### 0b — Six price ids are marked Sensitive in Vercel, so they arrive redacted

The same run reported *"65 Secret values cannot be pulled from the `production`
Environment"*, and six plans failed with `is set but does not hold a Stripe price
id`: the three `_ANNUAL` variables plus `STRIPE_PRICE_WORKSPACE_MONTHLY`,
`STRIPE_PRICE_ALL_THREE_MONTHLY` and `STRIPE_PRICE_TEAM_MONTHLY`.

`vercel env pull` cannot return a sensitive value — it writes `[SENSITIVE]`
instead — so the check receives a placeholder where a price id should be. The
three older ids were not marked Sensitive and came through fine, which is what
identifies the flag as the cause.

A Stripe price id is not a secret; it is sent to every visitor of the pricing
page. **`docs/owner/PRICING-STEP-BY-STEP.md` → "Put them in Vercel"** has the
two commands that replace a Sensitive variable with a plain one.

### Both, then redeploy

0a and 0b are independent and the run fails on either, so fixing one alone will
not turn it green. Production is still serving `36c1b2a` until both are done.

One thing that has changed in your favour: the price check now runs **before**
migrations are applied rather than after. The seven failed runs between 8 and 9
September each applied every pending migration to production and then stopped,
leaving the database ahead of the code. Another failed run will no longer do
that.

---

## Step 1 — The ten required variables

Read out of `lib/sonara-environment-classification.cjs`, which is the list
`pnpm run verify:env` gates on. **This section previously named a different ten**
— it counted the three monthly price variables as required and omitted four that
are. Anyone following it set nine variables, missed four, and the word "ten" made
it look finished. The list below is the classification's own `REQUIRED` set,
printed from it rather than transcribed.

All ten go in **Vercel → project `sonara-os` → Settings → Environment Variables →
Production**.

### Supabase — the database and sign-in (5)

Supabase → your project → **Settings → API**.

```
SUPABASE_URL                   = https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_URL       = https://<project-ref>.supabase.co   ← same value
SUPABASE_ANON_KEY              = <the anon / publishable key>
NEXT_PUBLIC_SUPABASE_ANON_KEY  = <the anon key>                      ← same value
SUPABASE_SERVICE_ROLE_KEY      = <the service_role key>   ← server-only, Sensitive
```

The two `NEXT_PUBLIC_` variables hold the **same values** as their unprefixed
twins and are required because browser-side code reads them under those names.
That is safe for the URL and the anon key, which are public by design.

**There is no `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` and there must never be
one.** The service-role key bypasses row-level security — it is the reason
`organization_id` filtering is the tenant boundary in this codebase.
`scripts/verify-no-client-secrets.mjs` fails the build if it appears in anything
client-side.

### Stripe — payments (2)

Stripe → **Developers → API keys**.

```
STRIPE_SECRET_KEY     = sk_live_…   ← mark Sensitive
STRIPE_WEBHOOK_SECRET = whsec_…     ← from the webhook endpoint, not the API keys page
```

For the webhook secret: Stripe → **Developers → Webhooks → Add endpoint**,
pointing at `https://sonaraindustries.com/api/stripe/webhook`. The signing
secret appears after the endpoint is created.

**The price variables are not in this list.** They are classified optional, and
that is correct rather than an oversight: the product runs without them, showing
a plan as unbuyable instead of breaking. They are Step 2, and the ids are in
`docs/owner/PRICING-STEP-BY-STEP.md`.

### Resend — email (2)

Resend → **API Keys → Create API Key**.

```
RESEND_API_KEY    = re_…                    ← mark Sensitive
RESEND_FROM_EMAIL = <an address at a domain you verified in Resend>
```

Verify your sending domain in Resend first, or mail is accepted and never
delivered. `RESEND_FROM_EMAIL` must be at that verified domain.

### The site's own address (1)

```
NEXT_PUBLIC_SITE_URL = https://sonaraindustries.com
```

Not a key and easy to skip for that reason. It is what links in outgoing email
and Stripe redirect URLs are built from, so if it is wrong or missing those
point somewhere else.

---

## Step 2 — Annual pricing (done 9 September 2026)

**Set and redeployed at about 06:25 UTC on 9 September 2026.** `/api/readiness`
now returns an empty `invalid` block and `/pricing` serves all three yearly
cards. Recorded here for the next person, and because the values are worth
keeping written down:

```
STRIPE_PRICE_WORKSPACE_ANNUAL = price_1UDdUl0dKtlEU3lA8EB46MUJ
STRIPE_PRICE_ALL_THREE_ANNUAL = price_1UDdUv0dKtlEU3lArDuldBWw
STRIPE_PRICE_TEAM_ANNUAL      = price_1UDdV30dKtlEU3lA9OltiqYX
```

`docs/owner/PRICING-STEP-BY-STEP.md` has the full pricing procedure, including
why the six old $19/$39/$79 prices are archived **last**.

**Check the id against that file before pasting.** A second set of six prices
exists on the live account at these exact amounts, on different products and
without lookup keys, and because the amounts match, every check passes if you
use one by mistake. Section 1b there lists them.

---

## Step 3 — The Cloudflare stack

All three are hosted on public addresses, so a Vercel function can reach them
with nothing tunnelled. All three are optional. Your **account id** is the
32-character hex string in every Cloudflare dashboard URL — it is configuration,
not a secret, and the same value is used by all three.

### Workers AI — a language model with nothing to host

Cloudflare → **My Profile → API Tokens → Create Token**, with **Workers AI:
Read**.

```
SONARA_WORKERS_AI_ENABLED = true
SONARA_WORKERS_AI_URL     = https://api.cloudflare.com/client/v4
SONARA_WORKERS_AI_ACCOUNT = <32-character account id>
SONARA_WORKERS_AI_MODEL   = @cf/meta/llama-3.1-8b-instruct
SONARA_WORKERS_AI_TOKEN   = <the token>   ← Sensitive
```

### D1 — derived data only

The database `sonaraindustriesd1` exists and its two rollup tables were created
on 9 September 2026. Token needs **D1: Edit**.

```
SONARA_D1_ENABLED  = true
SONARA_D1_URL      = https://api.cloudflare.com/client/v4
SONARA_D1_ACCOUNT  = <32-character account id>
SONARA_D1_DATABASE = <the database UUID from its dashboard page>
SONARA_D1_TOKEN    = <the token>   ← Sensitive
```

The adapter refuses any statement naming a table your Supabase migrations
create. Supabase stays the system of record; D1 holds counters, caches and
rollups — things whose loss costs a recomputation and nothing else.

### R2 — file storage

The bucket `sonaraindustriesr2` exists. R2 needs a **key pair**, not a token,
because it speaks the S3 API: **R2 → Manage R2 API Tokens → Create API token**,
scoped to that one bucket.

```
SONARA_R2_ENABLED           = true
SONARA_R2_URL               = https://<account id>.r2.cloudflarestorage.com
SONARA_R2_BUCKET            = sonaraindustriesr2
SONARA_R2_ACCESS_KEY_ID     = <access key id>       ← Sensitive
SONARA_R2_SECRET_ACCESS_KEY = <secret access key>   ← Sensitive
```

Both halves are treated as secrets. An access key id is not a password, but it
is half of one, and nothing in this product displays either.

**One honest caveat:** no request from this code has ever reached Cloudflare.
The request signing is verified against signature examples AWS publishes, so it
is checked rather than hoped at — but that R2 accepts the result cannot be
proven without your key pair. The first file you store is the proof.

---

## Step 3b — The AI keys, and which of them do anything

Read out of `lib/creator-generation-provider-registry.cjs` and the routes that
send them, on 9 September 2026. **Three hosted AI keys are wired to a real
request. One that the setup scripts ask for is not wired to anything.**

### The three that work

```
ELEVENLABS_API_KEY  = <ElevenLabs key>        ← voice generation
GEMINI_API_KEY      = <Google AI Studio key>  ← Google Veo / Gemini video
SUNO_API_KEY        = <Suno key>              ← music generation
SUNO_API_BASE_URL   = <Suno API base>
SUNO_GENERATE_PATH  = <generate path>
SUNO_STATUS_PATH_TEMPLATE = <status path template>
```

`GEMINI_API_KEY` is the one that is easiest to confirm: it is sent as
`x-goog-api-key` in `routes/creator-generation-routes.cjs`, on the generate
call, the poll and the download. Suno needs all four variables — the registry
refuses the provider when any is blank, so setting the key alone leaves it off.

A text model with nothing to host is Cloudflare Workers AI, in Step 3 above.

### `OPENAI_API_KEY` does nothing. Do not bother setting it.

No route, library or API handler reads it. It appears in exactly three places:
`lib/sonara-environment-classification.cjs` (classified so `verify:env` stays
quiet), `scripts/check-risks.mjs` — where it is a **name in a list of secrets to
hunt for in client bundles**, not a credential — and `scripts/setup-vercel-env.ps1`
and `scan-secrets-local.ps1`.

**The PowerShell setup script asks for it anyway.** That is the same defect as
`GOOGLE_REDIRECT_URI` in Step 5: a variable the setup path requests, that nothing
consumes, which then sits in the environment looking like a working capability.
Setting it costs you a live OpenAI key in an environment for no return.

`tools/agentkit` does use an OpenAI key, but under its own name —
`AGENTKIT_OPENAI_API_KEY` — and it is a Python tool that does not run in the
deployed application.

### The nine that are not installable, and are not meant to be

ComfyUI, LTX-2, Wan 2.2, HunyuanVideo, CogVideoX, Stable Audio 3, AudioCraft,
OpenVoice and GPT-SoVITS are recorded with `adapterMode: "reference_only"`.
**There is no adapter and no variable to set.** They carry no `_ENABLED`, no
`_URL` and no key, because they are records of repositories this project
reviewed — not integrations waiting on configuration. Nothing about them can be
"installed" or "switched on" from here.

Two are blocked by licence rather than by effort, which no amount of work
changes:

- **AudioCraft** — the code is MIT but the published model weights are
  **CC-BY-NC 4.0**. NonCommercial. This product is sold on paid plans, so those
  weights cannot be used in it unless Meta relicenses them.
- **HunyuanVideo** — the Tencent model licence carries usage restrictions that
  need qualified review.

Every one of the other seven records the same warning in a milder form: the code
licence is not the model-weights licence, and the weights need reviewing
separately before anything commercial happens. A permissive repository licence is
not permission to sell what the model produces.

**The supported way to actually run these models is the SONARA Open Media
Worker** — you host the engine, and the application talks to your worker over a
real adapter:

```
CREATOR_MEDIA_WORKER_URL   = https://<your worker>
CREATOR_MEDIA_WORKER_TOKEN = <token>   ← Sensitive
```

**`docs/owner/MEDIA-WORKER-INSTALL.md` is the full build-and-install guide** —
where to host it, the two endpoints your service must expose (`POST /v1/jobs`
and `GET /v1/jobs/{id}`), every field the application sends, the three job
states, and the four rules an output URL has to satisfy. Every one of those was
read out of `routes/creator-generation-routes.cjs`, and a test fails if the guide
and that code stop agreeing.

The Step 4 caveat applies and is what catches people: `http://localhost:...`
means *this serverless function*, not your laptop. Its registry record says
activation requires a recorded licence review, which is the same point as above
with a procedure attached.

`CREATOR_MEDIA_WORKER_URL` and `CREATOR_MEDIA_WORKER_TOKEN` are the SONARA Open
Media Worker, which is the supported way to put those models somewhere a
deployed function can actually reach.

---

## Step 4 — The eight self-hosted adapters, and why they are different

Ollama, Langflow, Open WebUI, Crawl4AI, Dify, RAGFlow, whisper.cpp and voice
clone all talk to software **you** run. Each takes an `_ENABLED`, a `_URL` and
sometimes a key, and each is off until you set them.

The thing that catches people: if you install one on your laptop, the deployed
application still cannot reach it. `http://localhost:11434` means "this
serverless function" — a machine in a datacentre with no Ollama on it. The
adapters detect this and say `unreachable_from_serverless` rather than timing
out mysteriously. `docs/architecture/EXTERNAL-SERVICES.md` covers the three ways
round it.

Every one of them is visible on the assistant page inside each product, so
"which of these is on" is one question with one answer.

---

## Step 5 — Two variables you must not set

- **`GOOGLE_REDIRECT_URI`** — no route reads the three `GOOGLE_*` variables and
  `services.googleOAuth` is a string literal. Setting it makes the readiness
  page claim a capability that does not exist, which is worse than the gap.
- **`SONARA_ALLOW_MANUAL_ORG_ID`** — it accepts an organization id from a
  request body with no membership check. The code refuses it in production
  whatever its value, and `tests/manual-org-id-guard.test.js` fails the build if
  that guard is removed. Never set it anywhere.

---

## Step 6 — Prove it

After setting anything, **redeploy** (Vercel → Deployments → current production
→ ⋯ → Redeploy), then:

```
pnpm run verify:env                              # every variable classified
node scripts/verify-stripe-env.mjs --require-live # advertised amount vs live price
```

Then open `/api/readiness` and the assistant page in each product. Readiness
tells you what is configured; the assistant page tells you which adapters are
on.

One thing readiness will **not** tell you: `checkout: enabled` there means *a
price variable is set*, not *a price that can be sold*. Those came apart on
8 September and every headline plan silently refused checkout while readiness
stayed green. The only thing that proves the path end to end is buying a plan
with a real card and confirming the account unlocks — which has still never
happened on this account.

---

## The order, if you only read one thing

1. Restricted Stripe key into the GitHub environment. **This unblocks deploys.**
2. The ten required variables, if any are missing.
3. The three `_ANNUAL` price ids. Redeploy.
4. Cloudflare, if and when you want it. All optional.
5. Buy one plan with a real card.
6. Archive the six old prices — last.
