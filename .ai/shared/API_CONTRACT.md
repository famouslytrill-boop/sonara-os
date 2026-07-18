# API Contract

## Current handlers

- `POST /api/contact`: validate and store support/contact intake; send email only when configured; return sanitized status/reference data.
- `GET /api/admin/contact-requests`: admin-only contact queue access.
- `GET /api/health`: safe runtime health metadata.
- `GET /api/readiness`: secret-safe provider/readiness state.
- `GET /api/formulas/definitions`: formula definition data.
- `GET /api/formulas/readiness`: formula-system readiness.
- `GET /api/ecosystem/manifest`: ecosystem manifest.
- `GET /api/infrastructure/readiness`: infrastructure readiness.
- Stripe checkout/create-checkout/customer-portal handlers: server-side plan validation and session/portal creation.
- `POST /api/stripe/webhook`: raw-body signature verification, idempotent event processing, and database-backed billing state.

## Response principles

- Use stable JSON codes and sanitized human-readable messages.
- Never include secret values, provider raw errors, stack traces, or private tenant records.
- Distinguish missing configuration, unauthorized, forbidden, validation failure, dependency failure, and success.
- Browser setup states must not be mistaken for successful provider operations.
- Database write success and email delivery success are separate states.

## Change protocol

Contract changes require a lock, tests, frontend coordination, this document update, route registry update where applicable, and a handoff entry. Do not silently change response shapes.

