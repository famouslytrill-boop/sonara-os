# SONARA Engineering Phase 7 — Signed Recovery Evidence and Durable Replay Denial
Date: 2026-10-08. Draft PR #510, **review only; no runtime activation**.

## Research and engineering conclusion

A monitor cannot authorize a self-healing action by asserting `authorizedScope`, `verifiedIdempotency`, `organizationId` or `domain` in the request body. A signed raw-byte observation proves provenance, not permission to operate. The server-side registry must independently supply tenant, domain, safe-action and operation facts. HMAC authenticity alone is insufficient: a captured valid delivery can be replayed until a durable nonce claim denies it.

References:
- OWASP Webhook Security: https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html
- Node crypto timingSafeEqual: https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b
- PostgreSQL concurrency: https://www.postgresql.org/docs/current/sql-insert.html

## Proposed custom SONARA sensor transport (not a third-party webhook format)

This exact format is for SONARA-owned authenticated sensors only. Do not use it to verify Stripe, GitHub, Resend or other providers: use their maintained webhook libraries and published schemes.

- Ingress transports HTTPS and passes the **unmodified request body Buffer** to the server-side verifier before any JSON reconstruction.
- The sensor provides `sensorId`, `timestampMs`, 32-character hex random `nonce`, and 64-character hex HMAC signature as transport metadata. Format and header names are to be fixed in a separately reviewed HTTP ingress contract.
- Signed bytes are exactly the UTF-8 prefix `sonara-recovery-v1\n`, then `sensorId\n`, decimal `timestampMs\n`, lowercase hex `nonce\n`, followed by the **exact original raw request bytes**.
- Compute HMAC-SHA256 with a distinct server-managed >=32-byte key per sensor and compare using Node `timingSafeEqual`; never log or return the key/signature/body.
- Payload is a <=4096-byte JSON object with **exactly** `incidentId`, `resourceId`, `sensorId`, `signal`, `observedAtMs`, and `organizationId`. All other authority comes from the trusted server registry.
- Reject observations older than 120 seconds or >5 seconds ahead of the receiving server clock. The signed observation timestamp and the transport timestamp must agree within 5 seconds.
- On a valid signature, require the server to perform an **atomic durable nonce claim** before passing the observation to a runbook or durable retry scheduler; a duplicate, timeout or DB failure must deny the observation.
- Rate-limit requests **before expensive work** at the future ingress edge, bound body size at the HTTP parser, and enforce a small per-sensor resource budget. No endpoint was introduced in Phase 7.

## New source artifacts

| File | Responsibility |
| --- | --- |
| `lib/sonara-signed-recovery-observation.cjs` | Validates original body bytes, HMAC, sensor identity, signed timestamp and the durable nonce result |
| `lib/sonara-postgres-sensor-nonces.cjs` | Maps service_role-only RPC response to exact boolean nonce admission (no client creation or exported key) |
| `supabase/migrations/20261008214500_autonomic_signed_sensor_nonces.sql` | Private `sonara_private.autonomic_sensor_nonces` table with RLS and atomic `public.sonara_claim_autonomic_sensor_nonce` RPC restricted to `service_role` |
| `lib/sonara-signed-recovery-ingress.cjs` | Binds signed sensor bytes → authenticated registry → existing bounded delayed retry; disabled by default |
| `tests/sonara-signed-recovery-observation.test.js` | 10 cryptographic/schema/timestamp/replay/tenant checks |
| `tests/sonara-signed-recovery-ingress.test.js` | 6 combined integration/adapter/disabled/replay/tenant-denial cases |
| `tests/sql/autonomic-sensor-nonce-role-matrix.sql` | Native disposable PostgreSQL role, duplicate, freshness and nonce namespace matrix |
| `scripts/verify-migration-replay.mjs` | Required native replay includes sensor nonce role test |
| `supabase/applied-migration-checksums.json` | SHA-256 pin: `da1feffd17da0bf31a4aec517920f53cd1546a5260019115cfd98d3f058bd66e` |

No existing migration was edited in this phase; no production migration was applied.

## Operational and privacy risks not yet resolved

1. **Secret lifecycle**: real per-sensor keys, creation/revocation/rotation, vault access, and incident-response runbooks are not connected. Reject requests if a key is unavailable. An abstract `getKey` callback is **not** a full secret-management system.
2. **Nonce storage growth**: the DB keeps nonce identities until a separate approved retention/cleanup mechanism is built and verified. Never delete them within their acceptance window. Rate limiting, capacity alerts and a bounded retention job are required before launch.
3. **Durability and concurrency**: current tests are committed but native PostgreSQL replay and two-session nonce race/restore drills have not yet been proven green at exact PR head.
4. **External effect guarantee**: signed evidence does not ensure external exactly-once execution. Provider idempotency, operation fencing and post-action reconciliation remain mandatory.
5. **Auth domain boundary**: do not expose `service_role` credentials to client bundles, and do not make an unprotected public endpoint for any new RPC. Tenant authorization must come from the signed sensor registry plus current operation state, not the signed event's assertions.
6. **Availability**: authenticated retry ingestion remains off until the complete exact-head GitHub CI matrix is green, native replay succeeds on PostgreSQL 16/17/18, operator approval and low-risk provider canaries are proven.

## Deployment gate

Review draft PR → exact-commit lint/unit/security/build/native replay → authorization+tenant isolation evidence → validate migration digest and project environment → stage only → approve disabled-by-default sensor and key provisioning → monitor non-production canary → explicit human approval before any production activation.

No automatic payments, refunds, auth/security, database/schema, code, deployment, or publishing actions are authorized by this phase.
