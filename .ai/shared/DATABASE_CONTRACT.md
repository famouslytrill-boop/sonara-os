# Database Contract

Owner: Codex (Agent A)
Status: accepted repository baseline; hosted migrations pending approval
Last verified: 2026-07-18 repository and CI gates; live-provider evidence remains dated 2026-07-16

## Canonical migration rules

- `supabase/migrations/**` is append-only history. Never edit or replay an applied migration to make a new change.
- Create future migrations with the Supabase CLI, review the generated version, and test locally before any production push.
- `lib/sonara-database-contract.cjs` is the canonical application inventory: three schemas, 71 tables across ten bounded groups, 10 functions, eight evidence-backed operational indexes, and seven private buckets. `pnpm run verify:supabase-contract` enforces it.
- `pnpm run verify:db` verifies 42 SQL migration files, the legacy 15-table launch baseline, all 71 contract tables, 10 functions, eight operational indexes, seven declared private storage buckets, organization membership checks, absence of public bucket declarations, and the Data API and readiness privilege contracts.
- Production was last verified at 39 applied migrations. `20260718064853_data_api_privilege_hardening.sql`, `20260718071148_connect_database_contract.sql`, and `20260718193000_operational_query_index_contract.sql` must not be described as applied until approved production execution in timestamp order and post-apply checks complete.
- The hosted project reference recorded for operational use is `yqncsonkxgwhcxedgevk`; credentials remain outside this repository and chat.

## Tenancy and authorization

- Organization and workspace ownership is enforced server-side and through RLS for private data.
- The verified live snapshot recorded on 2026-07-16 showed RLS enabled for scoped and private tables and anonymous reads returning no rows for support requests, service requests, billing subscriptions, and organizations.
- Membership naming is not normalized: organization, workspace, business, and entity membership concepts coexist. A compatibility ADR and data inventory are required before renaming tables, columns, roles, or API fields.
- ADR-0010 defines the compatibility baseline: `organization_memberships` is canonical customer tenancy; generic `workspace_memberships` language maps to it; `business_memberships` and `entity_memberships` remain separate narrower authorization domains; `user_roles` remains a global override.
- Canonical and compatibility membership resolution must be deterministic. Runtime lookups order matching active rows by non-null creation time and UUID before applying `limit=1`.
- Service-role access is server-only and bypasses RLS; every use must preserve the authenticated organization and user boundary explicitly.
- Global platform owner and administrator authorization derives from `user_roles`, never from ownership or administration of an individual customer organization.
- Public-schema Data API exposure is opt-in for future objects: migrations must explicitly grant the minimum table, sequence, and function privileges to `anon`, `authenticated`, or `service_role`; RLS still determines which rows an otherwise privileged caller may access.
- Authorization helper functions are not anonymous RPC endpoints. Helpers used by authenticated RLS policies must have an empty locked search path, schema-qualified relations, and explicit authenticated and service-role execution; trigger helpers receive no Data API execution grant.
- `sonara_database_contract_snapshot()` is metadata-only and service-role-only. It reports required schema, table, RLS, and function availability to the protected admin API; it never returns customer rows or private agent memory.
- Existing entity-scoped agent, run, memory, tool, approval, automation, connector, workflow, job, and audit tables are the canonical agent foundation. Connectivity does not authorize autonomous execution.

## Operational query and index contract

- Paid access derives from persisted active entitlements or `billing_subscriptions.status` in `active` or `trialing`, plus the documented owner and administrator path; browser redirects do not grant access.
- Paid candidate filtering occurs inside PostgREST by organization, allowed entitlement or plan key, and active state. Unknown product mappings fail closed before a Data API query is issued.
- Operational indexes are limited to real runtime predicates and ordering for active membership, Business Builder manager authorization, active billing, service catalog, requests, deliverables, module outputs, and pending employee invitations.
- Composite indexes place equality-filter columns before timeline sort columns. Partial indexes are used only where the runtime fixes the same status predicate.
- Hosted application of the index migration requires a maintenance-window and index-advisor review because normal PostgreSQL index creation can briefly lock the target table.
- Index value must be validated later against actual hosted cardinality and query statistics; repository presence is not production performance proof.

## Support and storage truths

- Support delivery state includes reference, consent, delivery status, error summary, retry count, and delivery-attempt records. Missing email configuration must leave persistence intact and report delivery failure truthfully.
- Launch storage buckets are private: `avatars`, `business-assets`, `creator-assets`, `music-stems`, `release-packages`, `support-attachments`, and `exports`.
- Recorded storage paths are user-scoped for avatars and organization or owner-scoped for organization assets.

## Change gate

Any schema, index, RLS, function, trigger, or bucket-policy change requires: a new migration; least-privilege review; positive owner and member tests; negative anonymous and cross-tenant tests; repository verification; shared contract and handoff updates; and explicit approval before production application.
