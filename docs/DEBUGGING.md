# Debugging

SONARA One uses a static TypeScript web shell in this checkout. Debugging helpers are designed to keep the app usable while avoiding raw stack traces or secret values in public UI.

## Local Checks

Run the same gates used for launch hardening:

```bash
pnpm install --frozen-lockfile
pnpm run validate:infrastructure
pnpm run typecheck
pnpm test
pnpm run build
pnpm run smoke
```

## Error Surfaces

- Unknown routes resolve to `/not-found`.
- Route render failures show a client-safe message and reference id.
- Global browser `error` and `unhandledrejection` events are logged through the structured logger.
- Public error UI must not show raw exception messages, stack traces, provider responses, tokens, or connection strings.

## Diagnostics

Use `/admin/diagnostics` to review app version, environment, static health status, database setup mode, Stripe setup mode, AI provider setup mode, and feature flag summary. The page is status-only and redacts secrets by design.

## Logging

Use `logger` or `createStructuredLogger` from `packages/web/src/lib/logger.ts`. Log context keys containing secret, token, password, service role, API key, or webhook are redacted recursively.
