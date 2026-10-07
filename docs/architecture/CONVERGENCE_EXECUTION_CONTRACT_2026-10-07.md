# SONARA Convergence Execution Contract

Status: engineering contract for the next implementation phase  
Baseline: `main` at `a8890755d8bdfdcf8f899f7ab1b235f8461d8840`  
Owner: SONARA engineering

## Purpose

SONARA has enough registered capabilities. The next increment closes customer workflows end to end:

`capability -> workflow -> provider execution -> customer transaction -> telemetry -> proof -> repeat use`.

A feature is not complete because a route, table, adapter, or page exists. It is complete when the workflow has an authoritative result, an honest failure state, tenant-scoped evidence, retry/idempotency behavior, and a customer-visible proof surface.

## Release rule

Every convergence PR must name:

- one canonical workflow and its start/end states;
- the source-of-truth records and database functions;
- provider calls and required credentials/scopes;
- idempotency key, retry, timeout, cancellation, and dead-letter behavior;
- tenant/actor authorization boundary;
- telemetry event names and redacted correlation identifiers;
- customer-facing receipt, evidence, or status destination;
- verification commands and the exact external proof still required.

Do not add a second implementation of a state transition. Do not mutate inventory, entitlements, settlement, delivery, or attribution through an unverified read-then-write route when a locked server/database transition exists.

## P0 acceptance slices

### Creator Marketplace

The canonical chain is:

`asset -> version -> approval -> rights/consent -> listing -> buyer -> checkout -> settlement -> license grant -> private delivery -> receipt -> seller report -> reconciliation -> refund/dispute -> audit trail`.

Done means:

- checkout success does not itself grant entitlement;
- provider webhook/authoritative result creates or repairs the settlement idempotently;
- license and delivery are private, tenant-scoped, and refresh-safe;
- refund/dispute changes the entitlement/settlement state through one canonical transition;
- seller reporting and reconciliation expose provider id, internal id, amount, currency, status, and timestamps;
- missing provider configuration is visible as setup-required, never fabricated success.

### Business Builder

The canonical chain is:

`lead -> estimate -> customer -> booking/job -> employee -> inventory -> work completion -> invoice -> payment -> receipt -> repeat job -> profitability`.

Done means:

- job/order/employee/customer relationships are organization-scoped;
- stock changes use the canonical order/material transition and hold tables;
- payment and invoice states come from authoritative provider or database results;
- completion produces an auditable receipt and profitability inputs;
- retrying a submission cannot duplicate a job, invoice, payment, or stock movement;
- the next repeat-job action is linked to the completed customer record.

### Growth Studio

The canonical chain is:

`lead/source -> campaign -> channel -> outbound connector -> delivery receipt -> engagement -> conversion -> attribution -> ROI -> next action`.

Done means:

- provider authorization, scope, account, and disconnect state are explicit;
- approval-gated publishing checks actor authority before execution;
- provider delivery ids and receipts are persisted idempotently;
- engagement and conversion metrics retain source, period, freshness, and attribution confidence;
- retry/recovery never reposts the same approved action;
- ROI and next-action surfaces identify what is measured versus inferred.

## Proof contract

Each closed workflow must expose:

1. current state and last transition;
2. authoritative internal record id;
3. provider record id when a provider is involved;
4. timestamps and correlation id;
5. failure/setup/retry state;
6. the next permitted user action;
7. an audit-safe customer receipt or evidence view.

A green unit test is not provider proof. A catalog entry is not integration proof. A rendered status badge is not telemetry proof. A local migration replay is not production migration evidence.

## Scope discipline

- P0: finish workflow completion, settlement, reconciliation, delivery, and customer proof.
- P1: add connectors only when one connector is executed end to end; then generalize the framework.
- P1: keep media jobs bounded, cancellable, provenance-bearing, and deterministic-first.
- P1: treat mobile/offline work as a state-reconciliation problem before adding native feature breadth.
- P2: vertical packs, POS, community, interchange, and digital-twin modeling reuse the same canonical records; they do not create parallel customer, order, payment, or evidence models.

## Required handoff fields

Every agent appending to `.ai/shared/HANDOFF_LOG.md` must record:

- exact base commit;
- files and locks touched;
- workflow state closed;
- tests run and result;
- provider/production proof unavailable;
- next smallest unblocked slice.

The contract is satisfied only when the source, tests, deployment verification, and customer-visible proof agree.
