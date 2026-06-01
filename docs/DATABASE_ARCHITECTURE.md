# Database Architecture

Cloud Postgres/Supabase is the source of truth. Local storage is optional cache, draft, and edge mode only.

SONARA uses a multi-tenant model with organizations, organization memberships, workspaces, sub-apps, and audit records. The platform does not create arbitrary physical databases per customer. Business Builder sub-apps use tenant-scoped metadata-driven schema records and safe field definitions.

Scaling plan:
- Add indexes around organization, workspace, status, and created_at access paths.
- Use queues/background jobs for heavy processing.
- Use storage buckets by purpose and tenant access policy.
- Plan backups, archival, read replicas, partitioning, and future sharding only after real usage requires it.
- Keep Business Builder, Creator Studio, and Growth Studio isolated by organization/product/workspace permissions.
