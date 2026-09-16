# Event-Driven Agent and Observability Foundation

Date: 2026-09-16

Status: architecture foundation; no external runtime enabled by this document.

## Why this exists

SONARA already has an agent-authority boundary, provider gateway, tenant rules, audit requirements, and explicit owner-review actions. The missing architectural layer was a shared event contract for agent coordination plus a provider-neutral observability contract for model behavior.

The uploaded Confluent guide argues that agents scale better when they consume and emit asynchronous events instead of building direct point-to-point dependencies. It describes four useful multi-agent patterns: orchestrator-worker, hierarchical, blackboard, and market-based. It also emphasizes immutable logs, replay, idempotent processing, dead-letter handling, loose coupling, and stream governance.

The uploaded AWS/Datadog brief treats generative-AI observability as a development requirement rather than a late production add-on. The reusable ideas are full-stack traceability, model latency/cost tracking, prompt/response behavior evaluation, audit trails, golden datasets, guardrails, and continuous evaluation.

SONARA adopts the principles, not the vendor lock-in.

## Added source contracts

### `lib/sonara-event-driven-agent-contract.cjs`

This module defines a provider-neutral event envelope and delivery policy.

Required properties:

- organization-scoped tenant key
- actor and producer identity
- event and correlation IDs
- optional causation ID
- idempotency key
- explicit authority classification
- provenance metadata
- attempt number for retry/dead-letter handling

The contract rejects obvious secret-bearing payload fields. Consequential actions named in `AGENTS.md` are classified as `owner_review` and fail dispatch until a matching approval record exists.

Delivery assumptions:

- at-least-once delivery
- immutable log when a broker is introduced
- idempotent consumers
- replayable events
- bounded retries
- dead-letter routing after the retry budget is exhausted
- consumer isolation
- tenant key on every event

These assumptions can be implemented with PostgreSQL outbox tables, a managed queue, Kafka-compatible streaming, or another reviewed transport. The transport is deliberately not hard-coded.

## Multi-agent pattern mapping

### Orchestrator-worker

Use for decomposition where one coordinator assigns independent tasks to workers. Commands and results must travel through the event contract rather than direct worker-specific connections.

### Hierarchical delegation

Use only when decomposition genuinely has levels. Every non-leaf coordinator remains bound by the same authority model; a parent cannot grant a child more authority than the parent has.

### Blackboard/shared context

Use for shared findings, research notes, and state updates. The blackboard is append-only evidence plus derived current state, not an unaudited mutable scratchpad.

### Market-based coordination

Not a current customer feature. The pattern may be useful for non-financial resource scheduling, but trading, bidding, or financial-advice behavior remains outside product authority.

## Security invariants

1. Every event is organization-scoped.
2. Service-role keys, API keys, passwords, authorization headers, tokens, private keys, and client secrets never appear in event payloads.
3. Owner-review actions do not dispatch on an agent's assertion alone.
4. Browser workers operate only on user-authorized destinations and may not expose anti-bot or fingerprint-evasion features.
5. Security workers operate only against SONARA-owned or explicitly authorized targets.
6. Media workers accept only user-owned/licensed material and require consent/right checks for likeness and voice use.
7. Failed work is retried only inside a bounded policy and becomes dead-letter evidence rather than an infinite loop.
8. Replayed events must be safe because consumers are idempotent.

## Added observability contract

### `lib/sonara-llm-observability-contract.cjs`

The observation record captures:

- trace and span IDs
- tenant ID
- provider/model/operation
- outcome
- latency
- input/output token counts
- cost in integer micro-units
- provider-called state
- prompt-template fingerprint
- source references
- groundedness/relevance/hallucination-risk style evaluation slots
- policy-violation and user-satisfaction slots
- sanitized tags

Raw prompts, raw responses, and secret material are explicitly excluded by this contract. If a future secure-debug mode ever stores content, it needs a separate architecture decision covering tenant isolation, encryption, retention, access control, deletion, and audit trails.

## Golden datasets

A golden dataset is a small reviewed set of test prompts/cases with expected behavior and policy expectations. It should be used in CI and pre-release evaluation to catch regressions in:

- output behavior
- policy compliance
- grounding
- secret leakage
- edge cases

A golden dataset is not production conversation storage.

## External projects from this intake

### OpenOSINT

Research-only Authorized Security Lab candidate. MIT upstream. Never used for unauthorized reconnaissance or sensitive-person profiling.

### PinchTab

Research-only local browser-worker candidate. Current upstream metadata reports MIT even though the submitted screenshot showed Apache-2.0. Upstream currently advertises stealth capability, so any SONARA adapter must deliberately expose only loopback, authenticated, allowlisted browser-control functions and omit stealth, CloakBrowser, CAPTCHA bypass, and anti-bot circumvention.

### OpenShorts

Research-only Creator Studio media-worker candidate. Current README describes an MIT core and a separately licensed `cloud/` directory; repository-level metadata is therefore mixed/NOASSERTION. No source adoption until a path-level license and dependency review is complete. Any media use also requires content, likeness, voice, and social-publishing rights checks.

### Every Programmer Should Know

CC-BY-4.0 engineering-reference collection. Useful as a gap-checking and training index, not a runtime dependency. Preserve attribution when adapting content.

## Deployment sequence

1. Merge the provider-neutral contracts and tests.
2. Add an internal event store/outbox behind the contract before introducing a broker.
3. Instrument existing Provider Gateway calls with sanitized observations.
4. Add a small golden-dataset CI job.
5. Add founder/admin views for event failures, dead letters, model cost/latency, and evaluation regressions.
6. Only after measured throughput/latency requires it, evaluate a managed queue or streaming platform.
7. External adapters remain individually reviewed; none are enabled by this architecture document.

## Business effect

This foundation is intended to reduce coupling between future agents and workers, make failures replayable and auditable, keep consequential actions under owner authority, expose model cost/quality regressions earlier, and make Creator Studio/security/browser experiments safer to evaluate without turning research projects into production dependencies.
