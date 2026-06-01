# API Security

The current web package is a static shell. API security helpers exist for future server routes, but live enforcement requires a real API runtime.

## Future Route Requirements

Every mutating API route should define:

- allowed methods
- JSON content-type requirement when applicable
- maximum body size
- schema or typed payload validation
- auth boundary
- organization boundary
- CSRF requirement for browser-origin mutating requests
- rate-limit policy
- audit event type for sensitive actions
- setup-mode response when required infrastructure is missing

## Sensitive Endpoint Policies

Rate-limit stubs exist for:

- billing changes
- auth and admin actions
- webhook receivers
- AI provider use
- file uploads
- payment link changes

These are policy definitions only. They do not count requests until durable server-side storage exists.

## CSRF

GET requests should remain read-only. POST, PUT, PATCH, and DELETE routes require CSRF protection when called from browser sessions.

## File Uploads

File storage is disabled for MVP setup mode. Future upload routes must validate MIME type, extension, size, malware scanning status, storage bucket policy, and public/private visibility before accepting files.

## Audit-Ready Actions

The following actions must be audit-ready before live writes:

- billing changes
- owner lock changes
- provider config changes
- AI provider use
- legal review packet creation
- payment link changes
- role changes

Audit records must include organization, actor, timestamp, action type, entity, risk label, summary, and redacted metadata.
