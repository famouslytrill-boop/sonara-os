# Database Decision Record

Supabase is the primary backend. Prisma is the selected ORM contract. TypeORM is rejected unless a specific future need appears. Meilisearch is selected for app search. Supabase pgvector is selected for AI/vector search.

ClickHouse is deferred until analytics volume justifies it. DuckDB is local/reporting/import only. Redis stays behind a license gate. Directus remains internal/admin research only. CockroachDB, TiDB, and SurrealDB are deferred research items, not launch databases.
