# SONARA Signed Recovery Transport — Security Hardening (2026-10-08)

**Review only: PR #510.** No production endpoint, migration, cron, provider adapter or auto-recovery activation is added here. This report complements, and does not replace, the separate Phase 8 route metrics report.

## Research and threat model

Signed monitor bodies and headers must remain stable while asynchronous secret retrieval, registry lookup and durable nonce admission execute. OWASP recommends authentication of the raw body and metadata, replay denial, constant-time HMAC comparison, strict input bounds, operational key rotation and edge rate limiting. A typed, signed observation is provenance evidence; it cannot itself grant tenant access or permission to affect a provider.

## Changes on the branch

- `lib/sonara-signed-recovery-observation.cjs`: single-read, bounded snapshot of all signed sensor metadata and a cloned raw body **before awaiting** the key store; MAC verification and nonce admission use that same snapshot. Throwing header getters fail closed.
- `lib/sonara-signed-recovery-ingress.cjs`: parses and verifies one frozen transport snapshot, not separately mutable copies.
- `lib/sonara-signed-recovery-transport.cjs`: accepts original `IncomingMessage.rawHeaders` pairs only; denies duplicates even across differently cased header names, comma-coalescing, header folding/control characters, unknown SONARA headers, malformed timestamps and oversize raw bodies.
- `lib/sonara-signed-recovery-http-boundary.cjs`: binds the strict transport parser to Phase 7 authenticated ingress, disabled by default. It creates no actual HTTP listener.
- `tests/sonara-signed-recovery-snapshot.test.js`: seven simulated tampering, replay/nonce, getter and disabled-ingress cases.
- `tests/sonara-signed-recovery-transport.test.js`: six parsing and security-negative cases.
- `tests/sonara-signed-recovery-http-boundary.test.js`: four integrated signed-ingress and malformed-header cases.

## Current evidence

An isolated local Node v22 execution of the 2560-byte transport parser copy passed 6/6 tests; committed sources and tests were also syntax-checked. These do **not** prove the complete repository test suite or production PostgreSQL race and role behavior. GitHub exact-head workflow conclusions must be obtained and judged independently; queued/pending checks are not successes.

## Required next gates

1. Run exact-SHA lint/typecheck/build, native PostgreSQL replay, multi-session due-claim and nonce replay tests, and all signed-ingress suites.
2. Validate key vault and per-sensor secret rotation/revocation; no frontend secret export.
3. Enforce HTTPS, raw-header access, strict ingress request/byte caps, per-sensor rate limits and redacted logs before registering any route.
4. Add approved bounded nonce cleanup only after proving a nonce cannot become acceptable again under clock-skew/window rules.
5. Verify tenant registry and provider-specific idempotency/fence against authoritative state and complete a human-approved one-tenant canary.
6. Protect deployment and merge: automated recovery of money, identity, grants, source, schema, publication or deployment stays forbidden.

References:
- https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html
- https://nodejs.org/api/crypto.html
- https://www.postgresql.org/docs/current/sql-select.html
