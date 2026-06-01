# Supabase Final Setup

Supabase must remain server-safe. The browser may use only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Checklist:

- Configure `NEXT_PUBLIC_SUPABASE_URL`.
- Configure `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
- Configure `DATABASE_URL` only in server/build contexts that require it.
- Apply migrations in reviewed order.
- Verify RLS policies for organizations, memberships, billing, customer records, proof profiles, offers, booking links, payment options, reviews, owner confirmation, open-source intake, and deployment sync.
- Add auth redirect URLs for `https://sonaraindustries.com`, `/app`, and local development.
- Document storage buckets before enabling uploads.
- Document backup/restore expectations.

Do not expose service-role keys in client bundles.
