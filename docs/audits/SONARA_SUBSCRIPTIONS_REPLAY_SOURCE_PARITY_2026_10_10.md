# Subscription RLS migration parity — October 10, 2026

Status: RELEASE BLOCKED. Evidence and synthetic replay test only; NO production changes.

## Confirmed evidence

- Native PostgreSQL fresh replay on PR #610 matched 21 post-hardening service_role scoped policies and four authenticated ownership policies. It then failed because neither of the two expected named subscription SELECT policies existed.
- The connected Supabase project yqncsonkxgwhcxedgevk is a preview-channel PostgreSQL 17.6 project; it is not confirmed as the production deployment target. Read-only pg_policies queries there showed the two named policies both with permissive SELECT, authenticated roles, owner-only auth.uid = user_id predicates, and no WITH CHECK.
- Read-only information_schema inspection of the preview subscription table found a nullable user_id UUID but did not find organization_id.
- Migration 010_sonara_platform_current_schema.sql creates subscriptions with organization_id and no user_id. Migration 011_sonara_saas_launch_system.sql uses CREATE TABLE IF NOT EXISTS with a user_id definition; this statement cannot alter a table that exists already. The full later migration history still needs a canonical field-by-field audit.
- The fresh replay instead contains three **distinct** subscription policy scopes: public membership-gated SELECT, service_role ALL, and authenticated membership/admin SELECT. They are not equivalent to the two preview user-scoped policies and must not be treated as identical deduplication candidates.
- Therefore preview and fresh replay cannot be presumed schema-equivalent. No attempt was made to apply SQL to preview.

## Draft PR #610 safety boundary

The 25-policy preflight verifies role scope, command, permissiveness and ownership predicates from hardened migration 20261008100000. A separate three-policy preflight checks the existing source subscription policies by exact name, role, command, USING and WITH CHECK (with an explicit count of three). The new replay-only fixture explicitly checks the two named subscription policies are absent from the tracked replay, then creates a DIFFERENT synthetic table inside a transaction with two synthetic user UUID rows and two identical owner-read RLS policies. It grants SELECT to authenticated and anon so anonymous/user-A/user-B tests exercise the predicates, not just missing table grants. It proves A sees only A; B only B; anonymous sees none; removing the duplicate does not expose B to A; ROLLBACK restores the database. Its postcondition confirms the fixture table is gone.

This is an algorithm and RLS proof, NOT evidence that fresh migrations reproduce the connected preview. If the source history changes to include either named policy, the fixture intentionally fails pending review.

## Required next stage before any real RLS migration

1. Identify the canonical subscription table and source of each column, policy, grant and constraint across every applied migration, preview and the confirmed deployment database.
2. Compare read-only schema catalogs, applied migration version/checksums, and actual app entitlement query contracts. Distinguish owner-based access from organization membership.
3. Execute A/B plus anonymous role SELECT/INSERT/UPDATE/DELETE denial tests in an authorized isolated staging project. Preserve special service-role operations.
4. Review exact-head CI, main branch protection, database migrations and rollback procedure; only then propose a new forward migration if justified.

No live customer read/write, schema mutation, payment or production deployment is authorized by this audit.

References: PostgreSQL CREATE TABLE and ALTER TABLE manuals; Supabase Row Level Security Guide; SONARA migrations 010, 011, 20261008100000 and PR #610 CI evidence.
