# Supabase RLS Policy Notes

Supabase is the production database spine.

RLS expectations:
- Every private table is organization scoped.
- Members can read and manage records only for their organization.
- Admin-only records use `public.is_org_admin(organization_id)`.
- Anonymous users cannot read private tenant records.
- Sensitive audit logs are append-oriented and should not expose private prompts or secrets.

Latest migration:
- `0003_agent_growth_rag_foundation.sql` adds agent, growth tactics, consent-safe outreach, and vector document tables.
- The migration is append-only and uses existing `public.is_org_member` and `public.is_org_admin` helpers.

Remaining owner tasks:
- Run Supabase Preview in CI.
- Approve production migration application.
- Verify RLS behavior with a real owner and member account.
