# Deployment Sync

Deployment Sync checks SONARA Industries launch readiness across domain, cloud, paywall, auth, security,
and deployment configuration.

It does not connect to production services, deploy to production, or claim cloud verification. It
reports configured, needs-review, blocked, failed, or skipped-for-MVP states from local env/config
signals.

## Canonical Domain

- Primary domain: `sonaraindustries.com`
- Public base URL: `https://sonaraindustries.com`
- App base path: `/app`
- Optional alias: `app.sonaraindustries.com` after DNS verification only

## Local Commands

- `pnpm run deployment:check`
- `pnpm run env:check`
- `pnpm run security:sync-check`
- `pnpm run paywall:check`

Secret values are never printed. Checks only report configured/not configured/redacted state.
