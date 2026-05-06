# Entity Heartbeats

Entity heartbeats report operational status per entity without requiring production secrets locally.

Route:

- `/dashboard/entities/[entitySlug]/heartbeat`

Scripts:

- `npm run heartbeat`
- `npm run heartbeat:entities`
- `npm run verify:heartbeat`

## Status Values

- `healthy`
- `warning`
- `critical`
- `unknown`
- `setup_required`

## Heartbeat Types

The migration supports system, database, auth, storage, Stripe, workers, browser, connectors, PWA, security, public feed, creator tools, business operations, and community information checks.

Checks that require production credentials are marked `setup_required`, not failed, unless the route or infrastructure file itself is missing.
