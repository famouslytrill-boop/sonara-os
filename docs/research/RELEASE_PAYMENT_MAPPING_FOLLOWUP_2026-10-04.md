# Release payment mapping and native replay follow-up

## Implementation

Customer creation no longer treats a failed or malformed database lookup as an absent Stripe customer. Multiple local customer mappings are rejected instead of choosing an arbitrary first row. New provider customers use a tenant/user-derived idempotency key with stable metadata-only parameters; changing email does not turn a retry into a different provider request. Keys contain a hash rather than raw user identifiers. Existing customer IDs and creation responses are validated.

Checkout stops when the provider identity cannot be stored. A successful ignore-duplicates write must also be confirmed by a tenant/user-scoped read returning exactly the created customer. This closes the earlier path where checkout proceeded with an unrecorded customer. The HTTP checkout fixtures now model the persisted mapping, and tests exercise failed reads, failed writes, malformed responses, ambiguous mappings, tenant separation and retry stability.

This is one reconciliation improvement, not complete provider reconciliation. Stripe may prune idempotency keys after at least 24 hours. A permanently failed mapping still requires operator reconciliation before a later retry; permanent deduplication requires a separately verified durable provisioning record and database uniqueness constraint. This increment does not add those migrations or claim the provider identity can never be duplicated.

## Native replay execution path

`.github/workflows/native-migration-replay.yml` defines a dedicated Ubuntu 24.04 Node 22/24 lane. It installs native PostgreSQL 16, rejects a root runner, requires replay, preserves pipeline failure with `pipefail`, and uploads commit, migration hashes, runner identity, PostgreSQL version and SQL replay logs on success or failure. The existing main CI replay requirement remains unchanged. The job is not a production migration and does not receive production credentials.

The workflow definition is locally validated, including pinned Actions and its required replay/evidence contract. Its existence is not proof of execution. This environment still cannot assign the unprivileged ownership required for local PostgreSQL replay. A successful supported-runner replay must be linked to the exact candidate before release.

## Verification and remaining limits

The full server suite passed with its existing pending checks after updating the checkout persistence fixtures. Additional focused tests cover malformed provider responses and the native lane. Typecheck, lint, build, dependency audit, generated handoff and document-count checks passed during this increment. No new dependency, migration SQL, production migration, live charge or model activation is part of this change.

Marketplace checkout/private delivery still needs the transaction and durable purchase-grant implementation described in `RELEASE_LIMIT_REMEDIATION_2026-10-04.md`. Full financial reconciliation still needs connected account, payment amount/currency, fees, refunds, disputes and operator exception handling. Physical-device qualification needs actual devices; customer retention needs observed cohorts; model activation needs pinned assets, licenses, bounded worker evaluation and deployment evidence. None is established by these payment tests.

## Primary research checked on 4 October 2026

- Stripe idempotency parameters and key retention: https://docs.stripe.com/api/idempotent_requests
- Stripe required fulfillment, paid-session checks and concurrent delivery: https://docs.stripe.com/checkout/fulfillment.md?payment-ui=stripe-hosted
- Stripe signed raw-body webhook verification: https://docs.stripe.com/webhooks

No API/SDK migration or third-party model adoption was performed.
