# Supabase Production Checklist

Run database changes before launch and verify schema in the Supabase SQL Editor.

## Required Tables

- `stripe_customers`
- `subscriptions`
- `stripe_events`
- `sonara_projects`
- `sonara_sound_assets`
- `sonara_sound_sources` if sound discovery sync is used
- `sonara_sound_sync_runs` if sound discovery sync is used
- `sonara_user_subscriptions` if the legacy SONARA subscription table remains in use

## Security

- Enable RLS on production tables.
- Add policies before production data is stored.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.
- Use the service role key only from server routes and trusted backend jobs.
- Rotate the service role key immediately if it is ever committed.
- Run migrations before launch and avoid duplicating tables.
- Keep Stripe webhook writes server-only after Stripe signature verification.

## Verification

- Confirm login works with Supabase Auth if auth is enabled.
- Confirm saving a project writes to `sonara_projects`.
- Confirm listing projects only returns the signed-in user's rows.
- Confirm deleting a project cannot delete another user's row.
- Confirm subscription webhook updates run only from the server.
- Confirm Stripe webhook events insert or update rows in `stripe_events`, `stripe_customers`, and `subscriptions`.

## Available Migrations

- `003_sonara_subscriptions.sql`
- `004_sonara_final_launch.sql`
- `004_sonara_vector_memory.sql`
- `005_sonara_sound_discovery.sql`
- `006_sonara_generation_history.sql`

Public pages must render without Supabase environment variables. Persistent generation history and vector memory are optional until auth/RLS are verified.
