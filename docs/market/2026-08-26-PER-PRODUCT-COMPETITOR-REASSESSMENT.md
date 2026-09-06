# Each product against its own competitors

Surveyed 26 August 2026. **Amended 6 September 2026** — see the box below.

Review by: 2026-11-26

> ## Amendment, 6 September 2026
>
> The single finding this survey repeated most — that the gap worth closing
> first, for two of the three products, is a way for the customer to take money
> — **was closed on 26 August, the same day this was written.**
>
> `lib/sonara-connected-payments.cjs`,
> `routes/sonara-connected-payment-routes.cjs` and
> `20260826090000_business_payment_accounts.sql` build Stripe Connect, and
> `tests/a-business-can-be-paid-by-its-own-customers.test.js` covers it. Charges
> are created **on the connected account** using the `Stripe-Account` header, so
> the money lands in the business's own Stripe balance and never enters
> SONARA's. The money-custody objection this document records was answered
> rather than worked around.
>
> The paragraphs below are left as they were written, because a survey is a
> dated record and rewriting it would destroy the thing it is for. What is
> corrected is each "cannot do" line that is no longer true, marked inline.
> `tests/a-capability-we-built-is-not-described-as-missing.test.js` now fails if
> either this file or the source starts claiming the capability is missing while
> the code has it — and fails the other way too, if the code loses it while the
> documents have stopped saying so.

Earlier surveys in this directory compared the *stack* — what somebody pays for
all three jobs at once. This one compares each product against the tools that
compete with **that product**, because the three are not in the same market and
averaging them hid the one finding that matters most.

Every external figure below is dated and sourced. Every internal figure was read
out of this repository on the date above, not recalled.

---

## The finding that reframes the rest

**Growth Studio is not a competitor to Klaviyo. It is a control plane over it.**

`lib/growth-studio-provider-registry.cjs` registers HubSpot, Klaviyo, PostHog and
Google Analytics 4 as *providers*. `routes/growth-studio-control-routes.cjs:912`
posts to HubSpot's `marketing/campaigns/2026-03` endpoint. There is no SMTP path,
no SMS provider, and no Twilio anywhere in the source — `scripts/verify-env.mjs`
classifies every environment variable this application reads and there is no
sending credential among them except `RESEND_API_KEY`, which
`lib/sonara-business-employee-invites.cjs` uses for staff invitations.

So a customer on Growth Studio still pays Klaviyo. That is either the weakest
thing about it or the strongest, and which one depends entirely on whether it is
priced and sold as the layer above rather than as a replacement. It is currently
described in a way that invites the second reading, which is the correction to
make first — before any engineering.

---

## Business Builder

### What it competes with

| Tool | Entry | Middle | Top | Source |
| --- | --- | --- | --- | --- |
| Jobber | Core $49/mo | Connect $149/mo | Grow $349/mo | Beancount comparison, July 2026 |
| Housecall Pro | Basic ~$59/mo annual (~$79 monthly) | Essentials ~$149/mo | MAX ~$329/mo for 8 users, +$35/user | same |
| ServiceTitan | not published — demo required | — | reported 5–10× the others; pays off past ~$2M revenue or multiple locations | same |

### What they have that this does not

- **A phone that answers.** Jobber sells an AI Receptionist add-on that books
  jobs from inbound calls and messages. Housecall Pro has CSR AI auto-booking
  and a Voice phone integration. ServiceTitan runs a dedicated AI division
  (Titan Intelligence) and reports 22% drive-time reduction from AI dispatch.
- **Payment processing for the customer's own customers.** Both Jobber and
  Housecall Pro take card payments on a job.
- A technician mobile app with offline capture, and GPS.

### What this has

48 routes under `/business-builder`, covering bookings and a booking calendar,
quotes, invoices, receivables and money-due, recurring work, inventory,
vehicles, vendors, locations, time, customers with import, week schedules, chase
drafts and a public booking page. All organization-scoped. All of it ordinary
arithmetic over the customer's own rows — no engine, no service, no key.

### What it cannot do, stated plainly

- ~~**A customer cannot pay an invoice through it.**~~ **No longer true, 26
  August 2026.** As surveyed, `lib/sonara-invoice-settlement.cjs` said in the
  source that there was no Stripe Connect here, so the product knew what was
  owed and could not collect it. `lib/sonara-connected-payments.cjs` closed
  that: a business connects its own Stripe account through Stripe's hosted
  onboarding and is paid directly, at `/business-builder/owner/payments`. No
  card data reaches this application and SONARA takes no cut of the charge.
- No phone, no SMS, no voice. Nothing answers a call.
- No mobile application and no offline mode. It is a website.
- No GPS or route optimisation, so the drive-time claim above has no
  counterpart here.

### The gap that is worth closing first

~~Invoice payment~~ — **closed 26 August 2026.** As surveyed: *"Invoice payment,
and it is not close. Every competitor at every price point takes money on a job;
this one produces a statement."* That is no longer the state. The blocker named
here — a Connect platform account the owner has to open — is the remaining
manual step, not the code.

**The gap now worth closing first is the phone.** Jobber sells an AI
Receptionist, Housecall Pro has CSR AI auto-booking and a Voice integration, and
nothing here answers a call. That is the one item in "what they have that this
does not" with no counterpart built.

---

## Creator Studio

### What it competes with

| Tool | Price | Transaction fee | Source |
| --- | --- | --- | --- |
| Podia | Mover $39–42/mo | **5%** | vendor pricing, Aug 2026 |
| Podia | Shaker $84/mo, Earthquaker $150/mo | none | same |
| Kajabi | Basic $149/mo ($119 annual) | none | same |
| Gumroad | no fixed fee | **10% + $0.50** | same |
| Teachable | Starter | **7.5%** | same |
| SamCart | $79/mo, AI copy and page generation | none | same |
| Higgsfield | Starter $19 (270 credits), Plus $59 ($47 annual, 1,200), Ultra $129 ($99 annual, 3,000) | credits expire ~90 days; top-ups ~$5/100 | vendor pricing, Aug 2026 |

Higgsfield is the closest comparator for the generation half: a multi-model video
platform (Sora 2, Veo 3.1, Kling 3.0, WAN 2.6, Seedance 2.0, Hailuo 02) founded
by ex-Google Brain engineers. **No clear first-party API** — access is through
third-party gateways, which makes it a thing to learn from rather than integrate.

### What this has

40 routes under `/creator-studio`: assets with a real file upload and private
signed-URL retrieval, rights, releases, voice permissions, voice studio, music
projects and a music system, a generation section with audio, music, video,
voice, reference analysis and a job list, a scroll site builder, calendar,
device cues, and artist records.

### What it cannot do

- **Generation is off by default and reports setup required.**
  `CREATOR_MEDIA_WORKER_URL`, `SUNO_API_KEY`, `ELEVENLABS_API_KEY`,
  `OPENAI_API_KEY` and `GEMINI_API_KEY` are all classified
  `OPTIONAL_CAPABILITY` in `scripts/verify-env.mjs`, which by that file's own
  rule means "a feature is unavailable without these and every path falls back
  to a stated setup-required. None may become a launch dependency."
- ~~**A creator cannot sell anything through it.**~~ **No longer true, 26
  August 2026** — the same Connect path serves both products. What was the
  weakest line in this survey is now the strongest comparison in it: Podia takes
  **5%** on Mover, Teachable **7.5%**, Gumroad **10% + $0.50**, and this takes
  **nothing** on top of Stripe's own processing fee, because the charge is
  created on the creator's own account rather than passing through ours.
- No credit system, so there is no way to charge for generation even once a
  provider is configured.

### The gap that is worth closing first

~~The same one: a way for the customer to take money.~~ **Closed 26 August
2026.** The till exists.

**The gap now worth closing first is charging for generation.** The survey line
below still stands: there is no credit system, so even with a provider
configured there is no way to bill for a GPU second.
`lib/sonara-paid-capabilities.cjs` prices six such capabilities against dated
cost floors and is required by exactly two files — its own release check and its
own test. It charges nobody. See
`docs/pricing/2026-09-05-PRICING-STRATEGY.md` section 4.

---

## Growth Studio

### What it competes with

| Tool | Billing basis | Price | Source |
| --- | --- | --- | --- |
| Brevo | **emails sent**, unlimited contacts | Starter $9/mo (5,000 emails); Business $18/mo | Omnisend comparison, 2026 |
| Klaviyo | **total active profiles** (changed Feb 2025 from emailed contacts) | $30/mo at 1,000; $150/mo at 10,000; $720/mo at 50,000 | same |
| HubSpot | contacts, bundled with free CRM | Marketing Hub tiers | same |

The Klaviyo change is the useful detail: billing on *total* profiles rather than
emailed ones raised the bill for anyone holding a large unengaged list. That is
the pain a control plane can address — pruning and segmenting before the profile
count is paid for — and it is a real, dated, specific wedge rather than a
generic "we're cheaper".

### What this has

29 routes under `/growth-studio`: campaigns, leads, enquiries, pipeline,
journey, attribution, content plan, ideal customer, lead routing, chat widget,
provider jobs, and a control centre.

### What it cannot do

- **It cannot send.** No email sender, no SMS, no push. Campaigns are created
  through HubSpot's API; events go to Klaviyo. The consent rules are enforced
  here (`SONARA records the event before dispatch`), the delivery is theirs.
- Attribution is provider-reported, and the registry says so: *"Revenue
  attribution remains provider-reported and must preserve reporting-window
  metadata."* This product does not measure it independently.

### The gap that is worth closing first

Not a feature — a description. Sold as the layer above Klaviyo and HubSpot that
enforces consent and keeps profile counts down, it is honest and differentiated.
Sold as an alternative to them, it fails on first contact with a customer who
tries to send a campaign.

---

## The technology that would actually differentiate

One candidate stands above the rest, on the specific ground that it fits this
product's economics rather than because it is new.

**Browser-side inference over WebGPU.** Verified support levels as of 2026:
roughly 90%+ of desktop browsers and 70–75% of mobile. WebLLM (17.6k stars,
OpenAI-compatible API) reaches up to 80% of native inference performance with
streaming, JSON mode and function calling. Transformers.js v4 gives a 4× BERT
speedup on WebGPU and runs 20B-parameter models at around 60 tokens/second.
Quantised models under 2GB run at interactive speed. Chrome ships Gemini Nano
on-device.

Why it fits *here* specifically: this product's constraint is that **a
per-token bill that grows with use cannot sit behind a tool promised as free**.
Every hosted option — Gemini 3.1 Pro at $2.00/$12.00 per million tokens, GPT-5.2
at $1.75/$14.00, Grok 4.3 at $1.25/$2.50, Grok 4.1 at $0.20/$0.50 (all Aug 2026)
— has a marginal cost per use. Inference in the customer's own browser has a
marginal cost of zero to the operator, and the model weights never leave the
device, which is the same sentence as the consent and provenance rules in
`AGENTS.md` rather than a separate promise.

`data/open-source-tools.ts` already records WebLLM and Transformers.js at
`needs_security_review`. That review is the next step, not a new decision.

### The others, and why they rank below it

- **NVIDIA NIM.** Free on up to 16 GPUs for Developer Program evaluation;
  production requires NVIDIA AI Enterprise at **$4,500 per GPU per year**, plus
  the GPUs (H100 SXM around $2.69/GPU-hour on RunPod). A real self-hosting
  option and the wrong shape for a serverless product with one function.
- **Hugging Face Inference Providers.** An OpenAI-compatible gateway routing to
  Groq, Together, Fireworks, Replicate, Cerebras and others; $0.10/month of
  credits free, $2.00 for PRO, then provider pass-through with no HF markup.
  Genuinely useful as a *single adapter that reaches many models* — it fits the
  Provider Gateway rule in `AGENTS.md` — but it is a per-token bill like the
  rest.
- **Higgsfield.** No first-party API found. Learn from the credit model; do not
  plan an integration on it.
- **GitReverse.** Turns a public GitHub repository into a single paste-ready
  prompt by swapping `github.com` for `gitreverse.com` in the URL. Useful for
  *reading* other people's public repositories. **It must never be pointed at
  this one.** It is a third-party service that ingests a repository and hands it
  to an LLM; this source is proprietary, and the tool's own coverage flags
  feeding proprietary material to it as the obvious risk. Recorded here so the
  next person meets the warning at the same time as the tool.

---

## Sources

- [Jobber vs Housecall Pro vs ServiceTitan, Beancount, July 2026](https://beancount.io/blog/2026/07/16/jobber-vs-housecall-pro-vs-servicetitan-field-service-software-guide)
- [FSM software pricing comparison, LeadDuo, 2026](https://www.leadduo.io/en/blog/fsm-software-pricing-comparison-servicetitan-jobber-housecall-pro)
- [Brevo vs Klaviyo pricing, Omnisend, 2026](https://www.omnisend.com/blog/brevo-vs-klaviyo/)
- [Hugging Face Inference pricing, techjacksolutions, 2026](https://techjacksolutions.com/ai-tools/hugging-face/hugging-face-pricing/)
- [NVIDIA NIM pricing breakdown, DeployBase, 2026](https://deploybase.ai/articles/nvidia-nim-pricing)
- [NVIDIA NIM microservices, NVIDIA](https://www.nvidia.com/en-us/ai-data-science/products/nim-microservices/)
- [LLM API pricing comparison 2026, IntuitionLabs](https://intuitionlabs.ai/articles/ai-api-pricing-comparison-grok-gemini-openai-claude)
- [GitReverse](https://www.gitreverse.com/) and [its repository](https://github.com/filiksyos/gitreverse)
