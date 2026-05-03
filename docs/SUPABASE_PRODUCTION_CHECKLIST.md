# Supabase Production Checklist

<<<<<<< HEAD
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
=======
Run database changes before launch and verify schema in the Supabase SQL editor.

## Required Tables

- `sonara_projects`
- `sonara_sound_assets`
- `sonara_sound_sources` if sound discovery sync is used
- `sonara_sound_sync_runs` if sound discovery sync is used
- `sonara_user_subscriptions`

## Required `sonara_projects` Columns

- `id`
- `user_id`
- `owner_id`
- `title`
- `project_type`
- `genre`
- `subgenre`
- `readiness_score`
- `launch_state`
- `analysis`
- `created_at`
- `updated_at`

## Required `sonara_sound_assets` Columns

- `license`
- `redistribution_category`
- `commercial_use_allowed`
- `redistribution_allowed`
- `attribution_required`
- `export_status`
- `source_id`
- `source_name`
- `source_url`
- `creator`

## Security

- Enable RLS on production tables.
- Add policies before production data is stored.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.
- Use the service role key only from server routes and trusted backend jobs.
- Rotate the service role key immediately if it is ever committed.
- Run migrations before launch and avoid duplicating tables.

## Verification

- Confirm login works with Supabase Auth.
- Confirm saving a project writes to `sonara_projects`.
- Confirm listing projects only returns the signed-in user's rows.
- Confirm deleting a project cannot delete another user's row.
- Confirm subscription webhook updates only run from the server.
# 2026 Supabase Production Update

Required/available migrations:

- `003_sonara_subscriptions.sql`
- `004_sonara_final_launch.sql`
- `004_sonara_vector_memory.sql`
- `005_sonara_sound_discovery.sql`
- `006_sonara_generation_history.sql`

Checklist:

- Enable RLS.
- Confirm policies.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.
- Rotate service role key if ever committed.
- Run migrations before production launch.
- Enable pgvector if using vector memory.
- If vector dimension/model is undecided, do not block public app routes.
- Persistent generation history is optional until auth/RLS are verified.
>>>>>>> 7176af92909d4c152a7097a15c8ad57645d8b9ca
