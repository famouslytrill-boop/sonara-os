# Third Search: SONARA Platform Convergence

**Date:** 2026-09-17
**Decision:** Add durable event delivery and AI-evaluation evidence to SONARA's existing infrastructure. Do not add a new agent framework, social network, biometric store, Wi-Fi credential feature, media relay network, or copied third-party code.

## Decision question

Which requested capabilities materially advance SONARA's existing Business Builder™, Creator Studio™, and Growth Studio™ codebase, and what is the smallest safe source-code change that makes those capabilities more reliable?

## Evidence matrix

| Claim | Evidence | Source quality | Freshness | Confidence |
|---|---|---|---|---|
| SONARA already has governed event and LLM-observability contracts. | `lib/sonara-event-driven-agent-contract.cjs`, `lib/sonara-llm-observability-contract.cjs`, and their tests define tenant IDs, idempotency, retry/dead-letter intent, prompt fingerprints, and golden-dataset scoring. | Current repository source and tests | Current checkout | High |
| The contracts were not yet backed by a durable store. | `docs/architecture/EVENT_DRIVEN_AGENT_AND_OBSERVABILITY_FOUNDATION.md` explicitly lists an internal event store/outbox as the next deployment step; no prior migration created `event_outbox`, `event_delivery_attempts`, `llm_observations`, or `agent_evaluation_runs`. | Current repository source | Current checkout | High |
| SONARA already supports private calling, push notification registration, PWA/offline surfaces, MFA, media pipelines, and approval-gated agent work. | `routes/sonara-call-routes.cjs`, `routes/sonara-notification-routes.cjs`, `public/sw.js`, `routes/sonara-two-factor-routes.cjs`, Creator/Growth routes, and `lib/sonara-agent-authority.cjs`. | Current repository source | Current checkout | High |
| Storing biometric data or Wi-Fi credentials would add severe risk without closing the identified platform gap. | Current SONARA privacy/authorization rules require explicit consent and protect credentials; W3C WebAuthn supplies device-mediated public-key authentication rather than a biometric database. | Repository policy + W3C WebAuthn Level 3 | 2026-09-17 | High |
| A custom video network is premature. | Existing `call_sessions`/`call_signals` provide bounded signalling; WebRTC needs a managed/operational media path for reliable production calls. | Repository source + WebRTC documentation | 2026-09-17 | Medium-High |

## Verified facts

- `sonara-os` is a public Express/Vercel/Supabase application with shared identity, records, billing, storage, authorisation, and release gates across the three studios.
- The live repository already includes 136 branches, an active Vercel deployment, a large migration suite, and approved internal boundaries for Provider Gateway and agent authority.
- A testable event envelope already requires organization scope, correlation, idempotency, provenance, authority classification, bounded retry, and secret-field rejection.
- A testable LLM observation contract already excludes raw prompts, raw responses, and secrets and supports golden-dataset scoring.
- The owner queue is the correct first event producer because it already has a verified organization and actor at the point a run is recorded.

## Inferences

- Adding a generic external agent framework now would duplicate established boundaries and make it harder to identify which code owns approval, tenant isolation, and provider use.
- The strongest immediate system improvement is to make existing contracts durable, rather than add more capability names to a catalog.
- Event payloads must carry references and compact structured evidence, not the raw customer records a handler read. A durable event log is otherwise a second ungoverned database.

## Implemented in this change

### Durable outbox

`20260917090000_durable_event_outbox_and_ai_evaluation_store.sql` adds:

- `event_outbox`: organization-scoped, idempotent, claimable event records.
- `event_delivery_attempts`: append-only delivery outcome evidence.
- `claim_sonara_event_outbox`: atomic `FOR UPDATE SKIP LOCKED` claim operation.
- `settle_sonara_event_outbox`: atomic settlement plus attempt record.

No browser role can read those tables. The functions are service-role worker primitives only. Retrying a producer returns the same outbox row through the `(organization_id, idempotency_key)` uniqueness boundary.

### AI observability evidence

The migration also adds:

- `llm_observations`: sanitized model cost, latency, outcome, source-reference, and evaluation records.
- `agent_evaluation_runs`: golden-dataset outcomes where `production_input` is permanently false.

Database checks reinforce the existing application rule: raw prompts, raw responses, and secret material cannot be stored in `llm_observations` through these tables.

### Existing-workflow integration

`routes/sonara-agent-activity-routes.cjs` now uses a small outbox publisher for owner-queue agent runs. It emits only compact status/authority/correlation evidence. Handler results and error text are not copied into the event payload.

The publisher is optional in `lib/sonara-agent-runner.cjs`. An outbox failure does not relabel a completed customer action as failed, while the outbox itself remains auditable and retryable.

## Explicitly not implemented

| Request area | Decision | Why |
|---|---|---|
| Wi-Fi passwords/discovery | Not a SONARA feature | Credential recovery/network scanning is unrelated to the customer workflow and creates serious authorization risk. |
| Biometric studio/database | Not a SONARA feature | Use passkeys/WebAuthn; never store fingerprint, face, voiceprint, or biometric-template data. |
| Public social network/feed | Deferred | Start with private project/client review, approval, and sharing records; public discovery adds moderation, safety, and legal obligations. |
| Custom video streaming network | Deferred | SONARA can manage meeting/workflow records and integrate a reviewed provider; media relay operations are not an MVP requirement. |
| CAD, robotics, semiconductor, ERP, custom cloud | Template/integration research only | Each is a separate product line with a different support, capital, compliance, and reliability burden. |
| New agent framework | Not adopted | Existing Provider Gateway, agent authority, and event contracts already cover the measured gap. |

## Practical product impact

| Studio | What gains from this foundation | Customer-facing claim now |
|---|---|---|
| Business Builder™ | Reliable follow-up, payment/booking workflow events, future customer portal reminders | No change until a tested customer workflow consumes the outbox. |
| Creator Studio™ | Durable review, delivery, generation, and publishing workflow events | No publishing claim changes; publishing remains owner-approved. |
| Growth Studio™ | Safer campaign outcome processing, notification/retry evidence, future analytics events | No automated outreach is enabled by this change. |
| SONARA One / admin | Event failure and evaluation evidence becomes possible to inspect safely | Operational foundation only; no fake readiness dashboard. |

## Contradiction search

| Risk or contradiction | Result | Decision consequence |
|---|---|---|
| Does SONARA already have an outbox? | No migration/table was present; the architecture document names it as the next step. | Build the small outbox now. |
| Does an outbox allow autonomous actions? | No. It stores/delivers validated events; `sonara-agent-authority` and owner approval remain separate. | Preserve existing approval checks. |
| Do LLM observations need raw prompts/responses to be useful? | No for operational cost/latency/outcome/evaluation evidence; raw content would require a separate privacy/retention decision. | Enforce false database flags. |
| Could browser users read operational records through RLS? | New tables have RLS enabled, no browser grants, and server-only functions. | Keep tables closed by default. |
| Does a new table break database release verification? | It will unless its reviewed extension contract, tenant table generation, migration checksum manifest, and replay checks are updated. | Update all generated/contract evidence and test it. |

## Sources

- SONARA repository source listed above, inspected at `main` commit `39dec4a7da7e6945bb5e1c7a14b706e0c0fdd0db` before this branch.
- W3C Web Authentication Level 3: https://www.w3.org/TR/webauthn-3/
- WebRTC introduction: https://webrtc.org/getting-started/overview
- Uploaded internal source references: *Event-Driven Design for Agents* (Confluent, 2025) and *Operationalize Generative AI with Confidence Using Datadog* (AWS/Datadog, 2025).

## Next safe step

Apply the migration only through the controlled deployment path after the full migration replay, tenant-query checks, test suite, lint, build, and release evidence gates are green. Then add one worker with a single approved low-risk consumer (for example, owner briefing preparation) before adding any new broker, social publishing, paid model, or background automation.
