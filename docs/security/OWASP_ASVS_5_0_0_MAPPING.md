# OWASP ASVS 5.0.0 production control map

Status: engineering verification map, not a certification claim.

Reference: OWASP Application Security Verification Standard 5.0.0, using
version-qualified identifiers so future ASVS renumbering cannot silently change
what this document means.

## Current mapped controls

| ASVS 5.0.0 control | SONARA evidence | Current state | Production action |
| --- | --- | --- | --- |
| v5.0.0-V2.1.1 — document input-validation rules | `openapi/sonara.yaml`, route validators, `verify:api` | Partial | Make server-side request schemas explicit for every write route; generated OpenAPI agreement alone does not prove runtime validation. |
| v5.0.0-V2.2.1 — validate input against expected structure/rules | Existing route-specific allowlists and validators | Partial | Add a single request-schema boundary for JSON writes, then migrate critical auth/billing/admin/public-write routes first. |
| v5.0.0-V2.2.2 — enforce validation at a trusted service layer | Express server-side handlers; client input is not authoritative | Partial | Add regression tests proving malformed JSON/body shapes are refused before business logic. |
| v5.0.0-V2.4.1 — anti-automation controls | `lib/sonara-rate-limit.cjs`, durable Supabase RPC, IP/subject buckets | Implemented, hardened | Degraded durable-counter failures must fall back to a bounded per-instance budget and emit a structured degradation event. Expand coverage to every unauthenticated/costly write. |
| v5.0.0-V6.1.1 — document auth anti-automation | Auth rate-limit implementation and tests | Partial | Add one canonical authentication-abuse policy with per-route limits and recovery behavior. |
| v5.0.0-V6.3.1 — credential-stuffing/brute-force controls | IP + subject-scoped auth throttles | Implemented | Verify production RPC availability and 429 behavior during the controlled deployment check. |
| ASVS V16 — security logging and error handling | `lib/sonara-structured-log.cjs`, redaction boundary, structured campaign/checkout/agent events | Partial | Preserve the existing structured logger as the security-event authority; correlate it with traces rather than replacing it with an OpenTelemetry Logs pipeline. |

## Adjacent production controls

These controls are not represented as a claim that all requirements in the
chapter are complete.

- Tenant isolation: `tenantGuard.install()`, `verify:tenant-queries`,
  `verify:request-tenant-ids`, cross-tenant adversarial tests.
- Secret safety: client-secret scan, redaction boundary, environment
  classification and provider-key verification.
- HTTP/browser security: CSP verification and route-surface accounting.
- Dependency/supply-chain safety: frozen pnpm lockfile, dependency audit,
  SHA-pinned GitHub Actions, reciprocal-license containment.
- Release integrity: migration replay, applied-migration immutability, exact
  shipped-source notice count, full release-gate chain.

## Explicit gaps that remain release-relevant

1. Four authorization functions are recorded but not migration-owned:
   `is_admin`, `is_current_user_admin`, `has_scope`,
   `has_company_access`. Do not create them blindly: two recorded definitions
   reference tables that migrations do not define. Reconcile live dependencies
   first, then either migrate or retire each object.
2. Runtime request-schema enforcement is inconsistent. OpenAPI/runtime route
   agreement is not the same property as validating every request body before
   business logic.
3. OpenTelemetry traces/metrics are not yet a production runtime dependency.
   Add only after the dependency/architecture decision, with the existing
   structured security log retained as the canonical event format.
4. Root Playwright E2E is absent; the only full Playwright configuration is
   archived. Restore a minimal root suite around signup/login, pricing/checkout
   refusal, tenant isolation, and owner/admin boundaries.
5. Repository governance is not an application control. Protect `main`
   separately in GitHub settings/rulesets so a green release gate cannot be
   bypassed by a direct push.

## Verification rule

A row is not "implemented" because documentation names it. Evidence must be a
runtime control plus a test or release check that can fail when the control is
removed. Production status additionally requires exact-deployed-SHA evidence.
