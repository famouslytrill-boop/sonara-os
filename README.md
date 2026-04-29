# SONARA Launch Core

SONARA is a music identity and release-readiness system.

Product promise:
- Every song gets a fingerprint.
- Every release gets a plan.
- Every creator gets a cleaner path from idea to launch.

## Visible App

The visible UI stays simple:
- Home
- Create
- Library
- Export
- Settings

Advanced systems run inside SONARA Core. SONARA is not a generic music generator, distributor, streaming platform, OBS clone, video editor clone, raw analytics clone, or cluttered dashboard.

## Launch Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Local Rules release intelligence by default
- Optional OpenAI BYOK mode with Responses API and Structured Outputs
- Optional Ollama Local and LM Studio Local provider modes
- Supabase-ready auth, database, and storage
- JSZip release-kit exports
- Motion for subtle UI animation
- SONARA™ Full Infrastructure Package for internal operating discipline

## SONARA OS™ Doors

- Build a Song
- Build a Release
- Build an Artist System
- Run a Studio Workflow

Everything in the product must support one of those four doors. Internal systems include Business Principles Layer™, Economic Moat Scorecard™, Company Operations Layer™, Profitability & Differentiation Engine™, System Visibility Engine™, and Final Company Audit™. These stay hidden, delayed, admin-only, studio-only, research-only, or dead unless they directly improve the four doors. They are operating tools, not financial, legal, tax, medical, or investment advice.

## Provider Setup

SONARA does not require a paid API key for launch. The default provider is Local Rules:

```env
SONARA_AI_PROVIDER=local_rules
```

Optional providers:
- `SONARA_AI_PROVIDER=openai_byok` uses your own `OPENAI_API_KEY`.
- `SONARA_AI_PROVIDER=ollama_local` uses a local OpenAI-compatible Ollama endpoint.
- `SONARA_AI_PROVIDER=lmstudio_local` uses a local OpenAI-compatible LM Studio endpoint.

Example optional configuration:

```env
SONARA_AI_PROVIDER=local_rules
SONARA_PROVIDER_TIMEOUT_MS=6000

# Optional OpenAI BYOK mode.
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
OPENAI_FAST_MODEL=gpt-5.4-mini
OPENAI_REASONING_EFFORT=medium
OPENAI_MAX_OUTPUT_TOKENS=700
OPENAI_STORE_RESPONSES=false

# Optional local model modes.
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1
LM_STUDIO_BASE_URL=http://127.0.0.1:1234
LM_STUDIO_MODEL=local-model

# Optional Supabase launch services.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=sonara-releases

# Public deployment URL.
NEXT_PUBLIC_APP_URL=https://sonaraindustries.com

# Optional Stripe checkout.
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_CREATOR=
STRIPE_PRICE_STUDIO=
```

When Local Rules is active, SONARA still produces Song Fingerprint, Sound Discovery, Streaming Pack, Broadcast Kit, Breath Control, and Export Bundle assets.

## Vercel

Deploy the `frontend/` directory as the Vercel project root.

Recommended baseline environment variables:
- `SONARA_AI_PROVIDER=local_rules`
- `SONARA_CRON_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=sonara-releases`
- `NEXT_PUBLIC_APP_URL=https://sonaraindustries.com`

`OPENAI_API_KEY` is optional and should only be set for OpenAI BYOK mode.

## Supabase

Apply `infra/supabase/sonara_launch_schema.sql` to create:
- `song_fingerprints`
- `release_plans`
- `sonara_projects`
- `sonara_billing_customers`
- `sonara_subscriptions`
- private `sonara-releases` storage bucket

Supabase is wired for auth, protected dashboard routing, saved project persistence, and storage, but local launch can run without Supabase credentials.

## Stripe

Stripe checkout is scaffolded but stays disabled until production keys and price IDs are set in Vercel:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_CREATOR`
- `STRIPE_PRICE_STUDIO`

Create real Stripe products and subscription prices before public purchases go live.

## Launch Checks

Run from `frontend/`:

```bash
npm run build
npm audit --audit-level=moderate
npm run validate:infrastructure
```

Run from `backend/`:

```bash
python -m pytest -q
```
