# SONARA Industries Operating Systems

SONARA Industries is the parent company for three independent software companies:

- **TrackFoundry**: music creation and release-readiness software for artist identity, catalog vaults, release desk workflows, transcript studio, prompt exports, and market pulse notes.
- **LineReady**: restaurant operations and labor-control software for labor control, schedule grids, recipe costing, crew chat, vendor links, and compliance workflows.
- **NoticeGrid**: verified local information and public-notice software for verified feeds, notice builders, local grids, organization pages, weather/transit links, and quiet alerting.

The products are separated by customer, organization, data, permissions, onboarding, dashboard, pricing, and app surface. They share only parent ownership, authentication, billing, security, infrastructure, audit logging, and admin governance.

## Architecture

- `apps/web`: Next.js 16, React, TypeScript, Tailwind, PWA scaffold.
- `apps/api`: FastAPI, Pydantic, SQLAlchemy, Alembic, Redis/RQ worker scaffold.
- `supabase/migrations`: Supabase-style RLS migration.
- `docs`: production setup, legal, security, monitoring, backup, worker, connector, and audit docs.

## Local Setup

```powershell
pnpm install
copy .env.example .env
docker compose up -d postgres redis
pnpm --filter @sonara-industries/web dev
```

API:

```powershell
cd apps/api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
uvicorn app.main:app --reload
```

## Environment Variables

See `.env.example`. Never commit real secrets.

Required for live production:
- Supabase URL, anon key, and server-only service role key.
- Stripe secret, webhook secret, and price IDs.
- Redis URL.
- Sentry DSN if monitoring is enabled.
- NWS user agent and optional Data.gov key for public connectors.

## Supabase Setup

Apply `supabase/migrations/010_sonara_industries_v3_rls.sql`.

The migration creates:
- tenant tables
- product tables
- RLS helper functions
- app scopes
- storage bucket records
- audit triggers
- updated_at triggers

## Stripe Setup

Run a dry-run lookup key list:

```powershell
pnpm stripe:seed
```

Then create Stripe products/prices manually or extend the seed script after review. Webhook signature verification is implemented in the API.

## Storage Setup

Buckets:
- `profile-images`
- `trackfoundry-media`
- `lineready-documents`
- `noticegrid-imports`
- `public-assets`

Storage backups are separate from database backups.

## Workers

Docker Compose includes Redis and a worker service. Queues are scaffolded for media, transcription, feed import, alert delivery, billing, backup, and analytics.

## Testing

Frontend:

```powershell
pnpm --filter @sonara-industries/web typecheck
pnpm --filter @sonara-industries/web test
pnpm --filter @sonara-industries/web build
```

Backend:

```powershell
cd apps/api
pytest
python -m compileall app
```

## Production Honesty

This is a production-ready MVP scaffold, not a verified production deployment. Do not claim live readiness until credentials are configured, migrations are applied, Stripe checkout/webhooks are tested, storage uploads work, workers run, PWA install is verified, backups are tested, and legal pages are reviewed.
