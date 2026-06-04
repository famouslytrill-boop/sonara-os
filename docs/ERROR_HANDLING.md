# Error Handling

SONARA Industries error handling should keep users oriented without leaking implementation details.

## Rules

- Public UI shows safe fallback messages only.
- Raw stack traces stay out of rendered pages.
- Secrets, tokens, webhook payloads, provider keys, and database URLs must never be rendered.
- Route render failures include a reference id for support/debugging.
- Future API routes should use the API error response helper so responses are structured and client-safe.

## Helpers

- `createClientSafeError` returns a safe title, message, and reference id.
- `createApiErrorResponse` returns `{ ok: false, status, error }` with a sanitized message.
- `sanitizeClientMessage` blocks stack/secret-like details and truncates long copy.
- `installGlobalErrorBoundary` captures browser runtime errors and unhandled promise rejections.

## Follow-Up Monitoring

When a real runtime backend or log drain is added, route reference ids should be correlated with structured server logs and deployment metadata.
