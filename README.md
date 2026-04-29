# SONARA OS

SONARA is an AI-powered creator business operating system for artists, creators, local businesses, and digital product builders. Build your brand, generate content, analyze your ideas, find your best revenue path, and launch with focused AI workflows.

## Creator Business OS

SONARA frames the workflow as a Creator Business OS:

- A&R Intelligence evaluates song identity, hook strength, audience signal, genre fit, and release-readiness evidence.
- Decision Engine turns creative context into the next practical move: go, improve, hold, or export.
- Revenue Pathway Engine maps realistic creator business routes such as releases, services, sound assets, bundles, licensing prep, and studio offers.

Revenue pathways are planning tools only. SONARA does not guarantee income, placements, hit records, approvals, or market outcomes.

## Active Tools

- Prompt Vault
- Artist OS
- Content Studio
- Visual Builder
- Local Business Kits

These tools sit on top of the intelligence layer and turn strategy into daily creator work: prompts, artist systems, content plans, visual direction, and local offer kits.

## Current Launch Mode

SONARA is configured to launch in deterministic local-rules mode:

```env
SONARA_AI_PROVIDER=local_rules
SONARA_PROVIDER_TIMEOUT_MS=6000
```

No paid AI key is required for the public launch baseline. Optional OpenAI BYOK, Ollama, LM Studio, Supabase, and Stripe settings are documented in `.env.example`.

## App Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase-ready auth and saved projects
- Stripe checkout scaffold
- JSZip export bundles
- Vercel deployment

## Main Routes

- `/` - SONARA public entry
- `/create` - song builder and release-readiness blueprint
- `/dashboard` - protected workspace shell
- `/library` - saved projects when Supabase is connected
- `/export` - export bundle workflow
- `/settings` - launch service status

## Setup

```bash
npm install
cp .env.example .env.local
npm run build
npm run dev
```

Open:

```text
http://localhost:3000/create
```

## Validation

Run from this folder:

```bash
npm run build
npm audit --audit-level=moderate
npm run validate:infrastructure
```

Backend Python tests, if using the optional Python service, run from the parent `backend/` folder or the `services/sonara-python` service described in `services/sonara-python/README.md`.

## Supabase

Apply:

```text
supabase/migrations/004_sonara_final_launch.sql
```

Then set these in Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=sonara-releases
```

## Stripe

Stripe checkout remains disabled until these are set in Vercel:

```env
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER_MONTHLY=
STRIPE_PRICE_PRO_ARTIST_MONTHLY=
STRIPE_PRICE_STUDIO_MONTHLY=
STRIPE_PRICE_STARTER_PROMPT_PACK=
STRIPE_PRICE_VISUAL_IDENTITY_PROMPT_PACK=
STRIPE_PRICE_AR_MARKET_AUDIT_KIT=
STRIPE_PRICE_RELEASE_PLANNER_KIT=
STRIPE_PRICE_ARTIST_OS_PRO_KIT=
STRIPE_PRICE_ALBUM_BUILDER_SYSTEM=
STRIPE_PRICE_LOCAL_BUSINESS_MARKETING_KIT=
STRIPE_PRICE_REVENUE_PATHWAY_BLUEPRINT=
```

## Production

Production domain:

```text
https://sonaraindustries.com
```
