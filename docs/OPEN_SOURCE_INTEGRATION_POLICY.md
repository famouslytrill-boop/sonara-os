# Open Source Integration Policy

SONARA OS™ prefers free and open-source software where practical, while staying honest about hosted services and API costs.

## Safe To Use Now

- Next.js, TypeScript, Tailwind CSS
- Supabase Postgres, Auth, Storage, and pgvector when configured
- Vercel deployment
- Stripe web checkout
- JSZip exports
- Web platform APIs and OBS Studio workflow exports

## Future Optional

- Qdrant, Chroma, Milvus, Weaviate, and Faiss for vector search scale or local experiments
- ClickHouse for analytics at scale
- Neo4j for relationship-heavy graph analysis
- Ollama and LM Studio for local models
- Essentia.js, FFmpeg, and a librosa microservice for deeper audio analysis
- Flowise only for private/internal workflows if secured and kept updated
- Continue.dev for optional code quality and PR checks

## Not For Launch

- Heavy vector databases beyond Supabase pgvector
- Public agent builders without auth and security review
- Native mobile billing before Google Play Billing / Apple IAP review
- Fake marketplace fulfillment or fake referral payouts

## Cost And Risk Notes

- Open-source software can still have hosting, support, maintenance, or compliance costs.
- OpenAI BYOK and other paid APIs must remain optional.
- License compatibility must be reviewed before adding dependencies to distributable products.
# 2026 Integration Policy

SONARA is free/open-source-first where practical, but it must not claim third-party services are free when usage can cost money.

Default approach:

- local rules first
- Supabase pgvector first for vector memory
- optional adapter interfaces before installing heavy dependencies
- docs for future integrations instead of unused packages

Human approval required:

- payment configuration
- env var changes
- deleting data
- publishing store products
- downloading sound files for packaging
- legal/trademark language changes

OpenAI, Ollama, LM Studio, and embedding providers remain optional. Core runtime, prompt length, rights, genre, arrangement, lyric, and entitlement logic must stay deterministic local rules.
