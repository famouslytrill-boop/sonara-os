# Offline Check-In Replay Safety — Engineering Decision

Status: implementation proposed for review (not a production deployment).
Assessed: 2026-10-08
Review by: 2026-11-08
Affected surfaces: `/staff/location`, `/api/location/events`, `public/sonara-check-in.js`, `public/sonara-offline-queue.js`.

## Threat and source findings

The browser's `localStorage` belongs to an *origin*, not a login or person. It persists after closing a tab or browser. An organization/user-specific key is a useful organizational partition, but it does **not** encrypt entries, protect them from other code with the same origin, or prevent a person controlling a shared device from reading them. Pending field check-ins may include location and employee IDs. Do not treat client-side metadata or tenant key names as an authorization mechanism. Server-side session/membership resolution remains authoritative.

Primary sources:
- MDN Storage API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
- OWASP HTML5 security: https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html
- OWASP Session Management: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html

## Observed implementation

The October 8 main branch already uses a v2 storage key containing organization and user IDs, client-side scope comparisons, and an explicit review/discard experience for legacy records. It also prevents cross-employee replay in a normal scoped session, retains ambiguous receipt outcomes for retry, honors Retry-After, and preserves records added while a request is pending.

**Residual defect:** `keyFor()` falls back to the old `sonara.offline-queue.v1` key when scope is missing/invalid. `keep()` and `flush()` therefore still allow a legacy, unbound record to be stored/sent if called without scope (even though the current page usually supplies one). A scoped key could also contain a record without either capture ID; the previous comparison only rejected conflicting IDs **when present**. The server also accepted `sent_later=true` with no original user/organization IDs, attaching the write to whichever account was active.

## Changes in this branch

1. Browser capture: reject missing/invalid scope; require valid UUID event ID and matching original user+organization metadata before saving.
2. Browser replay: fail closed when scope is absent; don't fall back to v1; reject stored records with missing or mismatching identity. A malformed legacy record remains available for explicit review/discard, not replay.
3. Server: require BOTH original IDs on `sent_later` submissions and reject mismatched IDs against server-resolved signed-in organization and user; ordinary immediate check-ins without those fields retain their existing API contract.
4. Negative tests: legacy absent scope, missing capture metadata, mismatched account, prevented persistence, retained review records, plus existing retries/receipt/overlap guarantees.

## Safety and compatibility contract

- The browser code has no access to privileged credentials. The capture IDs are consistency checks, NOT proof of identity. All writes are authorized via the server session and tenant membership.
- Legacy unscoped queued check-ins will no longer auto-send. This is a deliberate fail-closed change to avoid sending location data as a different employee. Keep them visible for user-initiated discard, never silently attach them to an account. The page must explain the behavior.
- The new behavior does not provide confidentiality for localStorage. A dedicated encrypted native offline store, device-level keys, short retention, remote revocation, XSS hardening and data minimization are separate work requiring device qualification and customer privacy review.
- User data is not erased as part of this branch; no database migrations, schema writes or provider changes.
- Check mobile/browser offline behavior, duplicate delivery after a lost receipt, unauthorized switch, same device new browser profile, absent network, broken JSON, retries, and the seven-day cutoff before a customer launch.
- Never use offline queuing for payments, payroll changes, contract signing, sensitive security actions, refunds, sending a marketing campaign or other consequential owner-reviewed actions.

## Acceptance and rollback

Source checks alone do not prove the behavior in production. Required acceptance:
- Targeted `tests/a-check-in-with-no-signal-is-sent-later.test.js` passes on the PR head.
- Full Node 24 lint/build/tests/coverage and security CI on the exact PR head.
- Browser staff form proves a valid saved scoped check-in can retry; another user or incomplete identity cannot send it.
- A 200 JSON response with `ok !== true`, redirect, 401, 403, 408, 429 or 5xx must not be mistaken for a confirmed delivery.
- Explicit owner approval for merging and a separate staged/controlled deployment with post-deploy identity and rollback checks.
- Rollback must not re-enable unbound legacy replay. If a code rollback is needed, retain the server-side identity requirement or make the endpoint temporarily reject delayed submissions.
