# Database Contract

Owner: Codex (Agent A)
Status: accepted repository and production baseline
Last verified: 2026-07-18 guarded linked production migration and lint

## Canonical migration rules

- `supabase/migrations/**` is append-only history. Never edit or replay a migration after it is recorded in the hosted ledger.
- Create future migrations with the Supabase CLI, review the generated version, test locally, dry-run against the linked project, and require explicit production approval.
- `lib/sonara-database-contract.cjs` is the canonical application inventory: three schemas, 71 tables across ten bounded groups, 10 functions, eight evidence-backed operational indexes, and seven private buckets.
- `pnpm run verify:db` and `pnpm run verify:supabase-contract` enforce the repository contract.
- Production now confirms all 42 repository migration versions applied. The guarded workflow verified migrations `20260718064853`, `20260718071148`, and `20260718193000` in both local and remote ledger columns and passed linked schema linting.
- Hosted project reference: `yqncsonkxgwhcxedgevk`. Credentials remain outside repository files, reports, public clients, and chat.

## Tenancy and authorization

- `organization_memberships` is canonical customer tenancy. `business_memberships` and `entity_memberships` remain narrower authorization domains; `user_roles` remains the platform-level override.
- Organization and workspace ownership is enforced server-side and through RLS for private data.
- Canonical and compatibility membership resolution is deterministic before `limit=1`.
- Service-role access is server-only and bypasses RLS; every use must preserve the authenticated organization and user boundary explicitly.
- Global platform owner/admin authorization derives from `user_roles`, never from customer-organization ownership.
- Public-schema Data API exposure is explicit and least-privileged. RLS remains enabled; anonymous helper RPC execution is prohibited.
- `sonara_database_contract_snapshot()` is metadata-only and service-role-only.
- Agent and automation tables remain approval-gated; schema availability does not authorize autonomous execution.

## Billing-subscription compatibility

- The first guarded migration-42 attempt proved that the live `billing_subscriptions` table predated the canonical runtime definition and lacked `organization_id`.
- Because migration 42 was not yet in the remote ledger, it was corrected before application. No ledger repair, force flag, or fabricated migration status was used.
- Migration 42 additively reconciles the canonical fields used by the existing Stripe webhook and paid-access queries: organization, provider/customer/subscription references, plan, status, period end, cancellation state, metadata, and timestamps.
- Compatible legacy Stripe customer/subscription and plan identifiers are preserved when those legacy columns exist. No organization relationship is guessed or fabricated.
- A unique `(provider, provider_subscription_ref)` index supports idempotent PostgREST upserts.
- Paid access derives only from persisted active entitlements or active/trialing subscriptions, plus the documented owner/admin path. Checkout redirects never grant access.

## Operational index contract

- Eight reviewed indexes support active membership, Business Builder manager authorization, active billing, service catalog, requests, deliverables, module outputs, and pending employee invitations.
- Composite column order follows equality predicates before timeline ordering. Partial indexes mirror fixed runtime status predicates.
- Production application and index validity/readiness are proven by migration 42 and the linked production lint.
- Actual workload value still requires later telemetry or representative query-plan review; presence alone is not a performance claim.

## Support and storage truths

- Support delivery records retain consent, provider status, sanitized failure details, retry count, and delivery attempts.
- The seven launch buckets remain private: `avatars`, `business-assets`, `creator-assets`, `music-stems`, `release-packages`, `support-attachments`, and `exports`.
- Storage paths remain user-scoped for avatars and organization/owner-scoped for organization assets.

## Change gate

Any future schema, index, RLS, function, trigger, or bucket-policy change requires a new append-only migration, least-privilege review, positive owner/member tests, negative anonymous/cross-tenant tests, repository verification, shared-contract updates, dry-run evidence, and explicit production approval.
