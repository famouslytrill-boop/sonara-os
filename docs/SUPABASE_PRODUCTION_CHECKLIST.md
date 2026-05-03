# Supabase Production Checklist

Before launch:

1. Run required migrations.
2. Enable row-level security.
3. Add policies for user-owned rows.
4. Keep the service role key server-only.
5. Never expose `SUPABASE_SERVICE_ROLE_KEY` in client components.
6. Rotate the service role key if it was ever committed or shared.
7. Confirm project save, project read, export save, and subscription access paths.
8. Verify storage bucket policies before storing user files.
9. Apply `supabase/migrations/003_sonara_subscriptions.sql` before testing live Stripe webhook persistence.
10. Confirm `sonara_user_subscriptions` RLS allows users to read only their own subscription rows.
11. Keep Stripe webhook writes server-only after Stripe signature verification.

Public pages must render without Supabase environment variables.
