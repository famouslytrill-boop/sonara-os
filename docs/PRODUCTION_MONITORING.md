# Production Monitoring

This repo currently generates static deployment artifacts. Production monitoring should start with host-level checks and status-only app diagnostics.

## Baseline Signals

- Build result from CI or local `pnpm run build`.
- Smoke result from `pnpm run smoke`.
- Static health artifact at `/api/health`.
- Admin diagnostics route at `/admin/diagnostics`.
- Source leak scan from `pnpm run security:scan-artifacts`.

## What To Check

- App version and environment match the deployment.
- Health check returns `ok: true`.
- Database status is setup mode or configured without exposing keys.
- Stripe status is setup mode or configured without exposing keys.
- AI provider status is setup mode or configured without exposing keys.
- Unsafe feature flags remain disabled unless explicitly reviewed.

## Current Limits

There is no live metrics backend, alerting pipeline, durable log drain, or real database health probe in this checkout. Treat diagnostics as launch-readiness signals, not a replacement for provider dashboards or incident monitoring.
