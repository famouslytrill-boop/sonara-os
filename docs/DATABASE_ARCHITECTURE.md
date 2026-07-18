# Database Architecture

Cloud Postgres/Supabase is the source of truth. Local storage is optional cache, draft, and edge mode only.

SONARA uses a multi-tenant model with organizations, organization memberships, workspaces, sub-apps, and audit records. The platform does not create arbitrary physical databases per customer. Business Builder sub-apps use tenant-scoped metadata-driven schema records and safe field definitions.

The canonical runtime inventory lives in `lib/sonara-database-contract.cjs`. `public.sonara_database_contract_snapshot()` returns only schema metadata to the server-side service role; anonymous and authenticated Data API roles cannot execute it. The admin readiness API converts that metadata into truthful ready/setup-required states without returning customer rows, credentials, or private agent memory.

Database privileges and RLS are separate controls. Explicit object grants determine which API roles can reach a table or function, while RLS policies constrain which rows an allowed role can access. Private tables require both least-privilege grants and organization-aware RLS.

The agent data model reuses the existing entity-scoped agent, run, memory, tool, approval, automation, connector, workflow, job, and audit tables. Database connectivity does not authorize autonomous shell access, outbound communication, billing changes, deployment, or other production actions.

Scaling plan:
- Add indexes around organization, workspace, status, and created_at access paths.
- Use queues/background jobs for heavy processing.
- Use storage buckets by purpose and tenant access policy.
- Plan backups, archival, read replicas, partitioning, and future sharding only after real usage requires it.
- Keep Business Builder, Creator Studio, and Growth Studio isolated by organization/product/workspace permissions.
- Owner bootstrap requires a real Supabase Auth user first, then a safe organization and active owner membership insert/update.
- If production includes additional required organization columns such as `company_key`, bootstrap scripts must populate them without disabling RLS.
- Apply migrations through one reviewed migration path. Dashboard changes that are not captured in repository migrations create drift and are not accepted as the source of truth.
