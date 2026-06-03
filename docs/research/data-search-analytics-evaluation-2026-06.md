# Data, Search, and Analytics Evaluation - June 2026

Supabase remains the primary backend and source of truth. Prisma is the selected ORM contract. Meilisearch is the app search layer for permission-filtered text search. Supabase pgvector is the AI/vector search layer. Supabase event tables are the first analytics layer.

ClickHouse is deferred until event volume justifies it. DuckDB is allowed for local reporting, import review, and offline analytics only. Redis remains behind a license gate. CockroachDB, TiDB, and SurrealDB stay research-only. TypeORM is not selected because Prisma is the current contract. Directus is internal/admin research only, not a required launch dependency.
