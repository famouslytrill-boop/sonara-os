# Free/Open-Source Storage Policy

Launch default:

- Supabase Postgres for project data, subscriptions, sound metadata, memory records, and generation history.
- Supabase Storage only for user-owned or rights-cleared files when configured.
- pgvector for optional vector memory.

Do not store:

- secrets in source
- biometric data
- unreviewed downloaded sound files for resale
- copyrighted lyric copies that the user did not provide rights to use

Future optional:

- Qdrant, Chroma, Milvus, Weaviate, or Faiss for larger vector needs.
- Object storage cost review before any heavy media workflow.
