# Database Contract

Owner: Codex (Agent A)
Status: accepted existing baseline
Last verified: 2026-07-18 repository gate; live-provider evidence remains dated 2026-07-16

## Canonical migration rules

- `supabase/migrations/**` is append-only history. Never edit or replay an applied migration to make a new change.
- Create future migrations with the Supabase CLI, review the generated version, and test locally before any production push.
- `pnpm run verify:db` currently verifies 39 SQL migration files, 15 required launch tables, seven declared private storage buckets, organization membership checks, and absence of public bucket declarations.
- The hosted project reference recorded for operational use is `yqncsonkxgwhcxedgevk`; credentials remain outside this repository.

## Tenancy and authorization

- Organization/workspace ownership is enforced server-side and through RLS for private data.
- The verified live snapshot recorded on 2026-07-16 showed RLS enabled for scoped/private tables and anonymous reads returning no rows for support requests, service requests, billing subscriptions, and organizations.
- Membership naming is not normalized: organization, workspace, business, and entity membership concepts coexist. A compatibility ADR and data inventory are required before renaming tables, columns, roles, or API fields.
- ADR-0010 defines the compatibility baseline: `organization_memberships` is canonical customer tenancy; generic `workspace_memberships` language maps to it; `business_memberships` and `entity_memberships` remain separate narrower authorization domains; `user_roles` remains a global override.
- Service-role access is server-only and bypasses RLS; every use must preserve the authenticated organization/user boundary explicitly.

## Billing, support, and storage truths

- Paid access derives from persisted `billing_subscriptions.status` in `active` or `trialing` state, plus the documented explicit owner/admin path; browser redirects do not grant access.
- Support delivery state includes reference, consent, delivery status, error summary, retry count, and delivery-attempt records. Missing Resend configuration must leave persistence intact and report delivery failure truthfully.
- Launch storage buckets are private: `avatars`, `business-assets`, `creator-assets`, `music-stems`, `release-packages`, `support-attachments`, and `exports`.
- Recorded storage paths are user-scoped for avatars and organization/owner-scoped for organization assets.

## Change gate

Any schema, RLS, function, trigger, or bucket-policy change requires: a new migration; least-privilege review; positive owner/member tests; negative anonymous/cross-tenant tests; repository verification; shared contract/handoff updates; and explicit approval before production application.
