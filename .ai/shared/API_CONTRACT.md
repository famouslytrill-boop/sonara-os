# API Contract

Owner: Codex (Agent A)
Status: accepted baseline
Last verified: 2026-07-19

## Canonical sources

- Runtime implementation: `server.js` plus registered modules under `routes/**`.
- Machine-readable contract: `openapi/sonara.yaml` (OpenAPI 3.1.0).
- Drift gate: `pnpm run verify:api` compares every registered `/api/*` method/path with the OpenAPI document in both directions and rejects duplicate operation IDs.
- Current verified inventory: 85 operations across 62 distinct paths.

## Compatibility rules

1. The existing JSON error shape remains `{ ok: false, code, message?, service?, missing? }`.
2. The master directive's larger error envelope is not adopted by this baseline. It would be a breaking response-shape change and requires an approved migration ADR, compatibility period, and coordinated client update.
3. Browser form requests may negotiate `303` redirects or HTML confirmation/error pages. JSON clients should send `Accept: application/json`.
4. Setup and provider failures must remain explicit (`setup_required`, `503`, or the documented provider-specific error); clients must not infer configured or paid state from navigation.
5. Adding, removing, or changing an API method/path requires updating `openapi/sonara.yaml`, affected tests, this contract when semantics change, and the shared handoff log in the same logical commit.

## Structured payload contract

- JSON and URL-encoded request bodies are limited to 1 MiB (`1,048,576` bytes), replacing the previous 64 KiB parser ceiling.
- Requests above that boundary return HTTP `413` with `{ ok: false, code: "payload_too_large", message, maxBytes: 1048576 }`; they must not be wrapped or mislabeled as HTTP 400.
- File bytes, base64 media, archives, audio, and video must not travel through a Vercel function JSON body. Clients must request an approved signed upload URL and upload directly to private object storage.
- The 1 MiB limit applies only to structured application data. It is not a storage-bucket file-size limit and does not override provider/global storage limits.

## Security boundaries

- Customer/workspace operations use server-resolved Supabase bearer sessions and the existing workspace/role/entitlement middleware.
- Admin operations are owner/admin protected and fail closed when authorization configuration is unavailable.
- Stripe webhook endpoints use the raw request body plus `Stripe-Signature`; they do not use bearer auth.
- Readiness endpoints expose service names and readiness states only, never credentials.
- The service-role key remains server-only and must never appear in browser code, logs, API responses, or OpenAPI examples.

## Critical verified behavior

- `POST /api/checkout/session` and `POST /api/billing/create-checkout-session`: authenticated organization required; plan must map to the server allowlist; successful API response includes the checkout URL, while browser forms may redirect. A redirect never grants paid access.
- `POST /api/webhooks/stripe` and `POST /api/stripe/webhook`: raw-body signature verification, timing-safe comparison, and idempotent provider-event audit.
- `GET /api/health`: process/runtime/deployment metadata.
- `GET /api/readiness`: non-secret configuration state.
- Paid record access is authorized from persisted billing entitlement state, not client claims or checkout success redirects.

## Deferred contract improvements

- Add endpoint-specific request and success schemas incrementally. The initial OpenAPI baseline intentionally uses generic object schemas where the runtime currently returns heterogeneous records; route/method/auth/error semantics are nevertheless canonical now.
- Standardize pagination, correlation IDs, and rate-limit headers only through a compatibility ADR and staged implementation.
- Membership naming normalization remains a database/auth compatibility decision and must precede any related API field changes.
