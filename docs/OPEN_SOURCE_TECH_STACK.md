# Open Source Technology Stack

SONARA OS™ should stay lightweight enough to deploy, audit, and contribute to.

## Current Stack

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- Stripe
- Vercel
- JSZip
- OBS Studio broadcast workflow

## Future / Optional

- FFmpeg for deeper media metadata extraction
- Essentia.js for browser audio analysis
- librosa as a future Python microservice
- Web Audio API for local audio feature inspection
- Ollama / LM Studio for local model modes
- Capacitor for native Android/iOS wrappers

## Rules

- Do not install heavy packages until they are used by production code.
- Prefer documentation and TODOs for future integrations.
- Keep OpenAI optional and keep deterministic product logic in local rules.
- Keep secrets out of source and Vercel config files.
# 2026 Launch Stack Update

Current/now:

- Next.js
- TypeScript
- Tailwind CSS
- Supabase Postgres/Auth/Storage/pgvector when configured
- Vercel deployment
- Stripe web payments when configured
- JSZip export bundles
- Local rules engine
- OBS Studio workflow through exportable broadcast kits
- OpenAI BYOK optional only

Safe to add now:

- Supabase migrations for sound metadata, vector memory, subscriptions, and generation history
- lightweight adapter interfaces
- browser-side Web Audio API hooks

Future optional:

- Qdrant, Chroma, Milvus, Weaviate, Faiss
- ClickHouse
- Neo4j
- Ollama and LM Studio
- Essentia.js, FFmpeg, librosa microservice
- Flowise only as private/internal secured workflow
- Continue.dev for dev-assist checks
- Capacitor for Android/iOS wrapper

Not for launch:

- public third-party sound commerce
- uncontrolled agent automation
- direct OBS control
- native app billing
- required GPU workflows

Risk and cost notes:

- Stripe, Vercel, Supabase, OpenAI, and API providers may require paid plans at scale.
- Some open-license sound data has non-commercial or no-derivatives limits.
- Choose embedding provider and vector dimensions before production semantic search.
