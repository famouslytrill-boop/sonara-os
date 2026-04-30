# CODEX MASTER PROMPT

You are working inside the SONARA OS codebase.

## Product Identity

SONARA is an AI-powered creator business operating system for artists, creators, local businesses, and digital product builders. It helps users build brands, generate content, analyze ideas, find practical revenue paths, and launch with focused AI workflows.

SONARA is not a generic music generator, distributor, streaming platform, video editor, analytics clone, or cluttered creative dashboard.

SONARA should also be understood as a Creator Business OS with three operating modules:

- A&R Intelligence: evaluates song identity, content ideas, offer clarity, audience signal, category fit, and readiness evidence.
- Decision Engine: converts creative and business context into the next practical move.
- Revenue Pathway Engine: maps practical creator, local business, and digital product paths without guaranteeing income, placements, clients, or outcomes.

Active tools:

- Prompt Vault
- Artist OS
- Content Studio
- Visual Builder
- Local Business Kits

The visible promise is simple:

- Every song gets a fingerprint.
- Every release gets a plan.
- Every creator gets a cleaner path from idea to launch.

## Public Product Doors

All product work should support one of these doors:

- Build a Song
- Build a Release
- Build an Artist System
- Run a Studio Workflow

If a feature does not clearly support one of those doors, keep it hidden, delayed, admin-only, research-only, or out of scope.

## Default Runtime

Launch mode is deterministic local rules:

```env
SONARA_AI_PROVIDER=local_rules
SONARA_PROVIDER_TIMEOUT_MS=6000
```

OpenAI BYOK, Ollama, and LM Studio are optional provider modes. They must degrade gracefully to local rules when keys or local model endpoints are unavailable.

## Engineering Rules

- Keep the app usable without paid API keys.
- Keep creator data private.
- Do not commit `.env.local`, Vercel metadata, `node_modules`, `.next`, logs, or generated build output.
- Preserve the Next.js App Router structure under `app/`.
- Prefer small, direct changes over broad rewrites.
- Run validation before deployment:

```bash
npm run build
npm audit --audit-level=moderate
npm run validate:infrastructure
```

## Launch Guardrails

SONARA must not promise:

- income guarantees
- hit-song guarantees
- placement guarantees
- legal, tax, medical, or investment advice
- unauthorized voice or likeness cloning
- fully unsupervised commercial autonomy
- unrestricted raw sample redistribution

Use rights-safe language. Describe texture, structure, era, energy, mood, instrumentation, and arrangement. Avoid instructions that copy a living artist's protected expression.

## Core Output

SONARA Core should produce practical release artifacts:

- song fingerprint
- readiness score
- launch state
- A&R intelligence notes
- next-move decision guidance
- revenue pathway options
- prompt vault assets
- artist OS notes
- content studio angles
- visual builder direction
- local business kit options
- blockers
- next checks
- release plan
- external generator settings
- runtime target
- prompt length guidance
- export bundle

Outputs should help a creator make the next practical move, not overwhelm them with internal system language.

## Deployment Notes

The Vercel project root is this folder. The production app is:

```text
https://sonaraindustries.com
```

Use Supabase migration:

```text
supabase/migrations/004_sonara_final_launch.sql
```

Use `.env.example` as the launch-safe environment template.

Stripe checkout uses these Vercel environment groups:

- Monthly subscriptions: `STRIPE_CREATOR_MONTHLY_PRICE_ID`, `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_LABEL_MONTHLY_PRICE_ID`
- Keys: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- One-time kits stay marked coming soon until real prices and fulfillment exist.
