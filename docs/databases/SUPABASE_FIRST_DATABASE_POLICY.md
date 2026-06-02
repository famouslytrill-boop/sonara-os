# Supabase-First Database Policy

SONARA launch data uses Supabase Postgres as the source of truth. Local caches, vectors, or alternate database technologies may support drafts, search, or future experiments only after review.

Business Builder creates metadata-driven tenant-scoped schemas, not arbitrary physical databases per customer.

Scaling plan:

- Index hot tenant queries.
- Use archival for cold records.
- Add queues for heavy work.
- Add read replicas and sharding only when measured load requires it.
