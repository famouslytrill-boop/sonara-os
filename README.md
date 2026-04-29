# SONARA OS

SONARA OS is a music identity and release-readiness workspace for creators. It turns song context into a practical launch blueprint: fingerprint, mood, hook direction, sonic palette, readiness score, next checks, and exportable release assets.

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
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_CREATOR=
STRIPE_PRICE_STUDIO=
```

## Production

Production domain:

```text
https://sonaraindustries.com
```

