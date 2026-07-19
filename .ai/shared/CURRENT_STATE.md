# Current State

- The readiness-card repair is merged in source, while Production deployment evidence remains separate from source state.
- Production runtime logs recorded two HTTP 503 responses for `POST /account/setup/organization` on 2026-07-19.
- `/api/readiness` reported the account database configured because provider credentials were present; that synchronous flag did not prove organization insert compatibility.
- Root cause: the hosted `organizations` table retains the migration-010 `company_key text not null` contract, while the setup code omitted `company_key` and also attempted the undefined `owner_user_id` column.
- The bounded source repair writes the compatible shared shape (`name`, `slug`, `owner_id`, `created_by`, legacy internal `company_key`), retains canonical `organization_memberships`, and recovers deterministic organizations by slug before retrying membership.
- No production migration, RLS policy, secret, billing rule, customer record, pricing, or legal content is changed by this compatibility repair.
- Production success must not be claimed until exact-head CI, Preview deployment, and an authenticated organization-setup smoke test pass.
