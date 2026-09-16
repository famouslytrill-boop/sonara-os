# Governed generation adapter lifecycle

Status: reference implementation only. This layer performs no external model inference, makes no provider network request, authorizes no spend, and grants no publish/send/billing/destructive authority.

## Why this layer exists

`sonara-generation-execution-contract.cjs` defines which execution shapes could be eligible. It deliberately does not execute them. The next boundary must prove that SONARA can manage a generation request as a durable, tenant-scoped state machine before any real provider or GPU runtime is connected.

The canonical adapter surface is:

- `submit(request)`
- `status(request)`
- `cancel(request)`
- `result(request)`
- `health()`
- optional `stream()` only when the manifest explicitly declares streaming support

A provider SDK is never the application contract. Future provider-specific code must sit behind this surface.

## State machine

The persisted lifecycle is:

`planned -> submitted -> queued -> running -> succeeded`

Controlled exits are `failed`, `canceled`, and `expired`. Terminal states are immutable. A job cannot transition to `succeeded` until at least one durable artifact with a SHA-256 digest and provenance has been recorded.

Every mutation uses an expected version. A stale version fails rather than overwriting newer state. This is the in-memory proof of the compare-and-swap rule the durable database implementation must preserve.

## Idempotency and tenancy

Idempotency is keyed by `(tenant_id, idempotency_key)`. Retrying the same key inside one tenant returns the same logical job and provider locator. The same key in another tenant creates a different job. Reads and mutations require both tenant and job identifiers; a job identifier by itself is not an authorization boundary.

Provider request identifiers are recorded by server-side adapter code after submission. Clients do not choose them and cannot use one tenant's locator to resolve another tenant's job.

## Data minimization

The persisted request shape stores references and digests, not raw creation inputs. The reference repository intentionally ignores arbitrary `prompt`, `media`, `authorization`, credential, token, and raw content fields. Audit-event details also strip common sensitive/raw-content keys.

The durable implementation should preserve this rule: customer media belongs in approved object storage, secrets belong in secret stores, and job rows contain only the references required to operate and prove the lifecycle.

## Artifact rule

Provider output URLs are not treated as durable artifacts. Before success, SONARA must have its own durable storage reference, a SHA-256 digest, media type, and provenance fields. Downstream publication or sending remains a separate approval/authority decision even after successful generation.

The in-memory adapter synthesizes an artifact record without invoking a model. Its `memory://` storage reference is test evidence only and is not a production persistence mechanism.

## Cost and network boundary

The reference adapter manifest declares `externalNetwork: false` and `externalSpend: false`. `health()` performs no billable generation. Successful reference jobs record a final cost of zero minor currency units. This prevents tests from accidentally proving a paid-provider path when the intent is only to prove lifecycle semantics.

A future real adapter must separately declare network/spend behavior and pass execution allowlisting, rights, privacy, residency, budget, credentials, and provider configuration gates before it can run.

## Durable follow-on

The next persistence step should map this proven interface into tenant-scoped database records for jobs, attempts, artifacts, callback deduplication, cost events, and append-only audit events. Database row-level security must preserve tenant isolation, and callback handlers must use authenticated provider callbacks or bounded polling with idempotent state application.

Only after that durable layer is green should one low-risk runtime be promoted behind a feature flag and explicit execution allowlist. A second provider belongs later, after cancellation, deadlines, callback replay, cost ceilings, observability, and circuit-breaking have been exercised on the first runtime.
