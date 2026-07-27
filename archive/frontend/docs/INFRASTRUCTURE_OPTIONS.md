# Infrastructure Options

SONARA Industries is open-source-first where practical.

Supported deployment paths:

- Vercel for the Next.js frontend and serverless API routes.
- Supabase or self-hosted Postgres for auth, schema, storage, and row-level security.
- MinIO or S3-compatible object storage for uploads.
- Coolify as an open-source self-hosted PaaS option.
- Dokku as a lightweight open-source PaaS option.
- OpenTelemetry-compatible logs, metrics, and traces when configured by environment variables.

Local development should stay simple. These services are optional until the production deployment path is chosen.

Do not launch paid users until real auth, RLS, Stripe webhooks, production env vars, upload boundaries, and mobile QA have passed.
