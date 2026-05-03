<<<<<<< HEAD
# SONARA Industries™ / SONARA OS™

SONARA OS™ is a creator operating system for music as a whole.

It helps artists, songwriters, producers, bands, labels, engineers, managers, content creators, and music entrepreneurs turn ideas into structured lyrics, arrangement notes, sound direction, rights-aware assets, metadata, release plans, and export-ready creative bundles.

SONARA OS™ supports traditional, AI-assisted, and hybrid workflows. It is not only an AI music generator.

## Users

Normal users access SONARA OS™ from the browser/PWA. No desktop install, local Node.js, npm, Git, local GPU, Stripe account, Supabase account, Vercel account, or OpenAI key is required for the core workflow.

## Local Checks

```powershell
npm run check:software
npm run audit:deps
npm run lint
npm run build
npm run verify:launch
npm run verify:security
npm run scan:secrets
```

If port 3000 is already in use, that is not a build failure. See `docs/LOCAL_PORT_3000_HELP.md`.

## Safe Bootstrap

```powershell
npm run bootstrap:local
npm run launch:local-check
```

The bootstrap script installs only the dependencies pinned in `package-lock.json`. Optional tools are checked or documented, not blindly installed.

## Launch Notes

- Do not commit secrets.
- Keep OpenAI optional.
- Default provider remains `local_rules`.
- Add Stripe, Supabase, and app URL environment variables in Vercel.
- Revoke and rotate any exposed Stripe live key before redeploy.
- Apply Supabase migrations and confirm RLS before production.
- Test Stripe checkout and webhooks before enabling paid access.
- No public kit marketplace at launch.
- Software can make SONARA OS™ payment-ready, not profit-guaranteed.
=======
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
>>>>>>> 7176af92909d4c152a7097a15c8ad57645d8b9ca
