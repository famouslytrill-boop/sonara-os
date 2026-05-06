# Workers

SONARA OS should keep the Vercel Next.js app as the production web runtime. Workers are optional local/CI/background systems for jobs that should not block web requests.

## Current Worker Surfaces

- `app/api/cron/sonara-maintenance/route.ts`
- `app/api/sound-discovery/sync/route.ts`
- `python/sonara_ops/main.py`
- `platform_jobs` database table

## Job Types

- scheduled cleanup
- public information fetch placeholders
- notification queue placeholders
- asset processing queue placeholders
- Stripe sync/reconciliation placeholder
- backup reminders
- analytics and readiness scans

## Rules

- Jobs must be idempotent.
- Jobs must log status without secrets.
- High-risk actions require human approval.
- Connectors should use official APIs/RSS when available.
- Do not scrape when an official API or RSS feed exists.
- Do not auto-publish civic alerts or official-language announcements.

## Smoke Test

```bash
npm run workers:smoke
```

## Production TODO

- Choose worker host.
- Configure `REDIS_URL` in worker secret storage.
- Add dead-letter queue monitoring.
- Add retry limits.
- Add worker logs to monitoring.
