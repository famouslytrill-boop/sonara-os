# SONARA OS

SONARA Industries™ is building creator infrastructure for modern music: songs, releases, sound systems, artist workflows, rights-aware exports, and creator business operations.

## SONARA Core™

Built for every genre. Structured for every release.

SONARA Core™ reads genre, rhythm, harmony, drums, vocals, sound identity, runtime, lyrics, explicitness mode, and release goals into a clear operating system for music creators.

## Launch Mode

The default launch provider is deterministic local rules:

```env
SONARA_AI_PROVIDER=local_rules
SONARA_PROVIDER_TIMEOUT_MS=6000
```

OpenAI BYOK, Ollama, LM Studio, Supabase, Stripe, vector memory, and sound discovery are optional integrations. The app must build and run without `OPENAI_API_KEY`.

## Main Routes

- `/` public company site
- `/store` store/products
- `/pricing` subscriptions
- `/tutorial` OS tutorial
- `/login` login
- `/dashboard` SONARA OS™ workspace
- `/create` SONARA Core™ create flow
- `/library` saved projects
- `/export` export bundles
- `/settings` launch configuration status
- `/trust` trust and safety
- `/support` support
- `/founder` founder command center placeholder

## Stack

- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS
- Supabase-ready Postgres/Auth/Storage/pgvector
- Stripe Checkout/Webhook scaffold
- JSZip export bundles
- Vercel deployment and cron

## Setup

```bash
npm install
cp .env.example .env.local
npm run build
npm run dev
```

## Validation

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Production Honesty

This repo can reach 10/10 architecture readiness. Do not call it a 10/10 operating business until the live website, Vercel env vars, Supabase migrations/RLS, Stripe checkout/webhook, domain/HTTPS, PWA install, support email, store products, and mobile QA are verified.
