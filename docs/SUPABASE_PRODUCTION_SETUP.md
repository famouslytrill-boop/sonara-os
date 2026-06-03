# Supabase Production Setup

## Dashboard Steps

1. Open Supabase.
2. Go to **Authentication** -> **URL Configuration**.
3. Set **Site URL** to the production app URL.
4. Add redirect URLs:
   - `http://localhost:3000/**`
   - `https://your-vercel-domain.vercel.app/**`
   - `https://your-custom-domain.com/**`
5. Enable or confirm email provider settings.
6. Enable Google provider if Google login is used.
7. Enable Phone provider and configure SMS delivery if phone OTP is used.
8. Confirm users can sign up.
9. Apply migrations in order.
10. Confirm RLS is enabled on identity, organization, preference, business, billing, support, and audit tables.
11. Create the first user by signing up through `/signup`.
12. Verify `profiles`, `organizations`, `organization_memberships`, and `user_preferences` records after signup.
13. Never paste `SUPABASE_SERVICE_ROLE_KEY` into client code, browser consoles, screenshots, or public docs.

## Migration Notes

The production bootstrap migration is append-only:

- `supabase/migrations/20260603090000_production_auth_workspace_rls.sql`
- `supabase/migrations/20260603103000_user_preferences_language_units.sql`

It adds or hardens:

- `profiles`
- `organizations`
- `organization_memberships`
- RLS helper functions
- owner/admin/member policies
- billing and webhook RLS policies
- `audit_logs`
- `user_preferences` for signed-in language and unit-system persistence

Apply in a preview or staging database before production.

## Manual Verification

Use two test users:

1. User A signs up and creates a workspace.
2. User A creates a customer record.
3. User B signs up and creates a separate workspace.
4. User B must not be able to read User A customer data.
