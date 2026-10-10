# SONARA Governed Adaptive Learning, Skills, and Self-Development

**Engineering date:** 2026-10-09  
**Status:** implementation of an offline, non-executing policy evaluator only. Not a live personal-memory service, agent trainer, code writer, autonomous deployer, or production feature.

## Verified repository boundaries

- SONARA Industries owns the SONARA One application platform and the Business Builder, Creator Studio, and Growth Studio products.
- `lib/sonara-learning-memory-control-plane.cjs` already classifies retention, provenance, sensitivity, approvals, and inactive semantic-memory runtime. It is not a production organization-scoped vector-memory store.
- `lib/sonara-agent-runner.cjs`, `lib/sonara-agent-authority.cjs`, and customer automation policies already constrain execution. Do not build an adaptation bypass around them.
- New `lib/sonara-adaptive-learning-policy.cjs` accepts only caller-supplied aggregate binary outcome evidence, returns a deterministic proposal state and confidence intervals, and performs zero writes/execution.
- Public `/api/ecosystem/learning-memory` exposes static adaptation readiness, not customer records or user profiles.

## Operational meaning

**Self-observation** is metrics and diagnostics, not consciousness: latency, error rates, success/undo rates, quota use, missing permissions, stalled queues, cost, and rollback outcomes.

**Self-learning** is an evidence lifecycle, not arbitrary live model-weight mutation. Approved records and aggregate opt-in feedback may suggest improved templates, layout and workflow hints, or future agent skill routing.

**Self-adaptation** must start as a reviewable reversible recommendation. Nothing in the current policy auto-personalizes a customer, profiles raw clicks, schedules work, changes permissions or charges money.

**Self-coding** belongs in an isolated engineering pipeline: issue -> scoped change proposal -> sandbox branch -> static checks/tests/evals -> human review -> protected PR merge -> controlled release. Agents cannot approve their own patches, alter safety gates, take production credentials or deploy.

## Deterministic evaluation

Inputs come **only from an independently verified server-owned source** after a stored opt-in receipt. Never trust client-asserted `verifiedConsent`, `aggregateEvidenceVerified`, identity, tenant, or timing.

- Two independent baseline/candidate cohorts, each with at least 30 binary outcomes measured under the same definition.
- `p = successes / trials`. Compute Wilson 95% bounds with `z = 1.96`.
- Proposal triage requires `p_candidate - p_baseline >= 0.05` AND `lower95(candidate) > upper95(baseline)`. This conservative nonoverlap rule is not proof of causation or a guaranteed 5% benefit.
- Invalid counts, stale (>90-day) evidence, forward dates, missing provenance, consent/tenant/control failure or missing rollback plan block evaluation. Weak evidence requests more evidence, never action.
- Even a `review_ready` outcome only permits displaying a proposal. Execution authority remains false for all adaptation types.

The numeric rule is an **offline triage heuristic**, not a powered statistical experiment design. Before real A/B evaluation: define treatment assignment, randomization, sample-size/power, guardrail metrics, pre-registered primary outcome, multiple-testing policy, and sequential-testing policy.

## User experience and product scope

| Product | Initial safe learning output | Not automatically allowed |
|---|---|---|
| Business Builder | A reviewable dashboard layout or standard operating procedure hint | Vendor orders, financial changes, work dispatch, payroll |
| Creator Studio | Suggested storyboard or draft packaging template | Rights transfers, publishing, deletion, voice cloning |
| Growth Studio | Suggested draft campaign template or workflow hint | Outreach, ad spend, live posting, customer targeting |
| SONARA One | Internal agent skill-routing or CI repair *proposal* | Self-approval, source pushes, security changes, production deployment |

Every proposal UI must show **why**, **evidence date**, **estimated effect with uncertainty**, **opt-in status**, **accept / dismiss**, **undo**, and **pause / disable personalization**. Do not use covert behavioral profiling, inferred health, biometrics, protected-class targeting or user manipulation.

## Next architecture stage — design only, not a migration

1. **Consent and preferences:** tenant/user-scoped opt-in receipts, purpose, revocation timestamp, version, retention, correction/export/deletion. Default off.
2. **Observe:** audited tenant-scoped aggregation of approved outcomes; short retention of raw sources where allowed; no secrets, raw messages, or browsing trails as learning input.
3. **Evaluate:** versioned baseline/candidate scores, provenance and quality regressions, bounded daily budget and read-only proposals.
4. **Review:** explicit user acceptance of reversible user-facing changes; two-person / independent approval when a separate consequential action is ever requested.
5. **Execute:** existing authority and orchestration gates only; durable idempotency keys, transaction-bound reservations, retry caps, no agent-created permissions.
6. **Measure and rollback:** correlation ID, latency, errors, cost, acceptance/undo/complaint rates, opt-out, drift signals, canary holdback, instant kill switch.
7. **Delete:** consent revocation stops new learning and triggers verifiable removal of retained eligible data and derived indexes according to policy.

Suggested future tables (names only, **no SQL applied**): `org_learning_consents`, `org_learning_aggregate_evidence`, `org_learning_proposals`, `org_learning_evaluation_runs`, `org_learning_approval_events`. RLS and least-privilege grants must be proven on each object. Service-role paths still require independently resolved `organization_id` filters.

## Release and threat gates

- Adversarial tenant isolation, consent replay, revoked opt-in, stale metric, malformed input, data deletion, output redaction and rollback tests.
- OWASP agentic risks: prompt/memory poisoning, tool misuse, privilege escalation, goal hijacking, unexpected execution and uncontrolled resource use.
- Anomaly and drift alerting is read-only by default; bounded retries and circuit breakers are separate from policy or source repair.
- Use existing OpenFeature flags with trusted tenant targeting, guarded tool permissions, independent approval and auditable kill switches.
- Require exact-head lint, typecheck, test suite, build, security checks, CI, migration replay where relevant, protected review and one-tenant canary. This PR is NOT permission to merge, apply migrations, connect a provider or deploy.
- Known controlled-deployment and other release-gate failures must be repaired and independently evidenced before any launch claim.

## Research references

- NIST AI RMF and Generative AI Profile: https://www.nist.gov/itl/ai-risk-management-framework
- OWASP Top 10 for Agentic Applications 2026: https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/
- OpenAI Agents SDK human review: https://openai.github.io/openai-agents-js/guides/human-in-the-loop/
- OpenFeature evaluation context: https://openfeature.dev/specification/sections/evaluation-context/
