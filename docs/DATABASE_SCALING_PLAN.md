# Database Scaling Plan

SONARA does not promise infinite databases. It uses multi-tenant architecture, metadata-driven sub-app schemas, and tenant-scoped records.

Near-term priorities:
- Keep Cloud Postgres/Supabase as source of truth.
- Add indexes for tenant, status, and recency queries.
- Use background jobs for expensive imports, document processing, sync, and reporting.
- Separate public/reference tables from private customer records.

Later scaling paths:
- Read replicas for analytics-heavy reads.
- Storage buckets by tenant and purpose.
- Queueing for provider calls and large imports.
- Archival tables for old audit and event records.
- Partitioning/sharding only after measured pressure requires it.
