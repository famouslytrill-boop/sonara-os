# Vector Memory System

SONARA memory starts with Supabase Postgres and pgvector. It stores text and metadata now, and semantic embeddings become active only after an embedding provider/model is chosen.

## Provider Strategy

- Default: `supabase_pgvector`
- Future: Qdrant, Chroma, Milvus, Weaviate, Faiss local

## Memory Kinds

- project
- prompt
- export
- sound_asset
- release_plan
- authentic_writer_note
- brand_doc
- support_feedback
- store_product
- research_note

## Embedding Policy

SONARA does not require OpenAI embeddings. Future options include Supabase AI toolkit, Hugging Face, local embedding models, and optional OpenAI BYOK.

If embeddings are not configured, records can still store text and metadata and report semantic search as `not_configured`.

## Migration

Run `supabase/migrations/004_sonara_vector_memory.sql`. The migration attempts to enable `vector`, creates `sonara_memory_records`, and uses a 1536-dimension placeholder when pgvector is available. Final dimension must match the chosen model.
# 2026 Vector Memory Update

Default provider: `supabase_pgvector`.

Future providers:

- qdrant
- chroma
- milvus
- weaviate
- faiss_local

Memory kinds:

- project
- prompt
- export
- sound_asset
- release_plan
- authentic_writer_note
- brand_doc
- support_feedback
- store_product
- research_note

Launch behavior:

- Store metadata and text now.
- If embeddings are not configured, store records without embeddings and mark semantic search as `not_configured`.
- Never crash public pages when vector config is missing.
- Do not require OpenAI embeddings.

Future embedding options:

- Supabase AI toolkit
- Hugging Face
- local embedding models
- OpenAI BYOK optional
