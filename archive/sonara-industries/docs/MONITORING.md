# Monitoring

Included hooks:
- Sentry setup for Next.js when `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` exist.
- Sentry setup for FastAPI when `SENTRY_DSN` exists.
- request ID middleware for FastAPI.
- `/api/health`, `/api/readiness`, `/api/version` in the web app.
- `/health`, `/readiness`, `/version`, `/worker/health` in the API.

Production still needs:
- log drain
- uptime checks
- alerting policy
- incident response runbook
- data retention policy
