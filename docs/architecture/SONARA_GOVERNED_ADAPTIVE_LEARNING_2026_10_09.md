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

## Implemented next-stage consent snapshot contract (policy-only)

The proposal evaluator now additionally calls `evaluateLearningConsent` in `lib/sonara-adaptive-learning-policy.cjs`.

It **requires**, in addition to the already governed proposal rules:

- A trusted server's independently authenticated latest consent-state read; a client-supplied `latestConsentReadVerified=true` or forged receipt is never adequate in a real route. There is currently no connected consent database reader or write endpoint.
- An explicitly opted-in consent receipt bearing a UUID, matching organization ID and exact user ID, adaptation scope, a nonempty notice version, positive revision, canonical UTC grant/expiration dates, and an explicit user-action method.
- A fresh unrevoked state with `revokedAt: null`, a consent lifetime of 90 days or less and a recorded retention period of 1–90 days.
- The entire measured evidence window beginning no earlier than consent and within the specified retention window, with observed evidence ending after the window starts.
- All authorized outputs remain **proposals**; the evaluator does not store consent, collect habits, hash or sign receipts, grant new permissions, modify memory, or execute a tool.

**Threat boundary:** A typed JavaScript object can be forged by any caller. The receipt contract provides necessary structural checks, not cryptographic proof, authenticated identity, valid consent, or production authorization. Until a trusted authenticated source and tested RLS-backed lifecycle exist, the product must keep customer adaptation disabled.

**Current review-only statuses:** malformed/missing/stale/revoked receipt `blocked`, insufficient aggregate evidence `needs_more_evidence`, conservatively supported candidate `review_ready`. None authorizes execution.

## Implemented prediction, workflow mapping, and operational-state triage (policy-only)

The second engineering pass adds `lib/sonara-adaptive-prediction-mapping.cjs` and exports its bounded readiness description within the existing `/api/ecosystem/learning-memory` **static metadata**. There is no live forecast endpoint, customer data reader, scheduler, user-habit pipeline, database migration, model-fitting job, or automatic operational action.

### 1. Forecasting: defensible deterministic baseline

`forecastDailyAggregate` supports **five allowlisted daily, aggregate count metrics**: orders, bookings, creative jobs, opted-in leads, and workflow runs. It accepts 35–180 strictly contiguous UTC-dated observations, 1–14 days of horizon, a trusted tenant assertion, reviewed aggregate evidence, small-cell suppression, and an attested contributing population of at least ten. Input numbers must be nonnegative safe integers bounded by 1,000,000. The last observation must not be in the future or over seven days old.

**Prediction formula:** for horizon day `h`, `prediction[h] = last_observed_week[(h-1) mod 7]`. This is a **seven-day seasonal-naive benchmark**, not trained machine learning. It preserves known weekday patterns when data are genuinely daily and contiguous. It does not model holidays, closures, seasonality changes, promotions, supplier shocks, or gradual growth; therefore **customer staffing, purchasing, inventory, campaign spend or revenue should not be automatically changed using its output**.

**True held-out backtest:** reserve the last seven observed days; generate that week's predictions from only the seven days immediately *before* them. The holdout outcomes are used only to score errors, never to select or fit the model. Report:
- `MAE = sum(abs(actual - predicted)) / 7`;
- `WAPE = 100 * sum(abs(actual - predicted)) / sum(actual)`, reported as **null** when the denominator is zero;
- 80th percentile of seven holdout absolute errors as a **descriptive historical residual reference**. It is **NOT a calibrated predictive interval**, despite being used to show a nominal error band;
- forecast output only as `forecast_preview_only` with `executionAuthorized=false`.

A seven-point historical backtest is too small for reliable future uncertainty coverage or model selection. Later candidates should use rolling-origin evaluation, holdout separation, explicit horizon-specific scoring, holiday/closure covariates, calibrated intervals and drift alerts. Forecast outputs must be measured against reality, not against their own predictions.

### 1A. Rolling-origin forecast reliability — implementation pass 3

`evaluateRollingForecastEvidence` now reuses the **same allowlisted, privacy-reviewed, tenant-scoped and complete-date-series validation** as the forecast preview. With fewer than 42 daily observations it returns `insufficient_history_for_rolling_evaluation`, rather than inventing an accuracy rating.

For sufficiently long histories, it evaluates **non-overlapping seven-day holdout blocks**, starting after at least 21 chronological training days. At each origin it compares:

- *Seven-day seasonal naive:* forecast day `d` from the same weekday of the immediately preceding week.
- *Last-value naive:* forecast each of the next seven days from the most recent observed value before the holdout.

Every evaluated holdout has its own training/holdout boundary, MAE and actual total. Overall metrics are out-of-sample MAE and WAPE; WAPE is `null` when total actual activity is zero.

It also compares the two most recent weekly activity totals as a **simple absolute volume-shift heuristic**. A change greater than 30%, or movement from zero to nonzero, emits `drift_requires_operator_review`. This is not a statistical concept-drift test. A lower seasonal MAE by at least 5% relative to the last-value reference may yield `seasonal_baseline_review_candidate`, but this is **not a statistical significance claim, model promotion, reliable calibrated prediction interval, or automation authorization**. Operators need additional seasonal/holiday/closure evaluation and high-impact business decisions remain manual.

The roll-origin method and leakage precautions are grounded in Rob Hyndman and George Athanasopoulos, *Forecasting: Principles and Practice*, section 5.10: https://otexts.com/fpp3/tscv.html and the scikit-learn TimeSeriesSplit guidance: https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html.

### 1B. Operational metrics now require a bounded window

`assessOperationalSignals` additionally demands canonical UTC time anchors, an observed 5-minute to 24-hour measurement window, an end date not in the future and no more than two hours stale, a complete metric sample, and a server-histogram-based p95 claim. Invalid, future-dated, improperly aggregated or stale data is blocked. This is **only a shape/quality preflight**: the next production stage must independently retrieve and authenticate the metrics and reviewed SLO thresholds, constrain cardinality and redact sensitive labels.

OpenTelemetry guidance on HTTP metrics and `error.type` informs this planned adapter contract: https://opentelemetry.io/docs/specs/semconv/http/http-metrics/

### 2. Sequencing and dependency mapping

`mapLearningSequence` validates a deterministic graph of at most 32 numbered/typed steps and 1,000 estimated cost units, including dependencies and strict phase order:

`observe → validate → map → predict → evaluate → propose → review → verify`

- A step after `observe` must depend directly on a step of the immediately preceding phase.
- Missing/deviating dependencies, duplicate identifiers, cycles, invalid step types and excess budgets are blocked.
- Steps are returned in stable phase/name order with auditable dependency links, graph depth and potential parallel groups.
- A partial but internally valid graph now returns `incomplete_sequence_requires_review`, with explicit missing phases and `endToEndComplete=false`. A full graph returns `reviewable_sequence_only` but **still is not an authorization**. The purpose field is limited to 240 characters and rejects control characters.
- `review` in a graph is **not human authorization**, and the returned graph can neither execute nor schedule tools, create user data, modify source, or approve its own effects.

### 3. Operational awareness as verified telemetry

`assessOperationalSignals` classifies a bounded snapshot of request errors and p95 latency against previously reviewed thresholds. It requires at least 100 counted requests and an independently verified telemetry source. Threshold breaches yield `operator_review_recommended`; no incident remediation, credential use, source changes, deployment, shutdown or restart occurs. A single telemetry window never establishes full platform health.

### 4. Next-phase security and product proof

- Make evidence/tenant/consent/telemetry authority a real **authenticated server-side contract**, never caller-provided flags.
- Add scoped database aggregates with user opt-in where personalization is involved, small-cell suppression, RLS write/read/deny tests, provenance and deletion/retention checks.
- Build a read-only forecast and sequence-review UI with assumptions, reference dates, data adequacy, input/metric units, holdout quality, limitations and user dismissal.
- Add deterministic, timestamped offline metrics to an approved observability pipeline and verify production cost/latency/error budgets.
- Allow external side effects only through the existing agent authority, independently authenticated human approval, durable workflow/retry/rollback and release gates.

**Research alignment:** Google's Rules of Machine Learning and Google Cloud predictive ML quality guidance emphasize distinguishing training/serving skew, continuously measuring drift and monitoring prediction quality. NIST AI RMF requires risk mapping, measurement, governance and management; OWASP calls out model/tool authorization, memory poisoning and context spoofing. These references guide planned stages but are not proof that SONARA has passed an audit.

## Implemented stage 4: server-owned, read-only evidence boundary

`createAdaptiveProposalReader` is now exported from `lib/sonara-adaptive-learning-policy.cjs`. It is an **injectable integration seam**, **not** a live route, a verified database adapter, or a permit to collect user habits.

A future authenticated route must provide **five independent server-controlled functions**:

1. `resolvePrincipal`: resolve an authenticated user and active organization membership through the existing trusted SONARA session and authorization stack; identify permission to read learning evidence. Do not accept a user ID or verified role from the HTTP body.
2. `readLatestConsent`: fetch the latest scoped, revisioned opt-in receipt for that exact user, organization and change type. It must be current and distinguish revoke/expiry, missing records and provider errors.
3. `readAggregateEvidence`: obtain only approved organization-wide cohort summary counts, checked evidence windows, measurement definition, source provenance, minimum contributor population, and small-cell suppression; **never raw user events, emails, messages, personal traits, or secrets**.
4. `readGovernance`: retrieve separately verified **inspect**, **correction** and **deletion** availability flags, overall review status, rollback readiness and a bounded explanation from an independently governed policy source. Missing or false rights-control flags block evidence access; no caller may hardcode their availability.
5. `clock`: produce server-owned canonical UTC timestamps; never trust browser clocks for authorization decisions.

The service first resolves the server principal and reads/validates opt-in **before** touching aggregate evidence. It then independently validates governance, **before** making the aggregate read (no concurrent speculative aggregate access when governance would deny the request). After the evidence read it re-reads the consent receipt **and** independently re-resolves the authenticated principal to detect mid-read membership, permission, organization, or account changes. A missing/mismatching/stale/revoked receipt, altered revision, invalid aggregate shape, inadequate privacy safeguards, unsafe provenance, absent governance review, or a reader exception gives a **blocked, non-executing** outcome. Exceptions are returned as a generic refusal; provider/database error strings are not disclosed to callers. A passing result is still just a *review-ready proposal*.

**Critical limitation:** The injected functions are deliberately not wired to production. Their booleans and objects are test seams, **not cryptographic security proofs**. The production integration needs real provider identity, durable session membership checks, approved and least-privileged database readers, server-resolved organization filtering, audited RLS/grants and revocation semantics. A second consent read can detect a change *during these reads* but is **not transactional isolation** and cannot prevent a revocation that happens after the second read. Because no action is executed, this residual race does not authorize anything. Any later action must independently reauthorize consent and permissions within its own transaction or equivalent durable operation boundary.

### Verification and next production architecture

- Focused regressions cover legitimate principal-to-consent-to-governance-to-evidence flow, unauthorized membership refusal before queries, speculative aggregate-read prevention when governance denies access, forged request flags, expired and revoked receipts before evidence access, consent revision changes during reads, mid-read user/tenant/permission changes, cross-tenant evidence, missing privacy evidence, raw record contamination, malformed provenance and deliberate provider exception redaction.
- Deliver a private, separately reviewed schema and tenant/role allow-and-deny test suite. Do not create or connect a new customer-data store until release governance, provenance, retention and data-deletion controls are approved.
- For a future read-only customer preview route, require account authentication, active tenant membership, anti-abuse limits, source-of-truth consent, verified grants/RLS behavior, and one-tenant canary observation. Use caller-scoped RLS when practicable; where service-role authority is required, make tenant filtering and independent membership verification explicit and adversarially tested. No auto-posting, payments, code merging, tenant permission changes or self-modification is permitted.
- During failure drills, test replayed consent, revoked user sessions, changed membership, schema drift, missing aggregate rows, provider outages and log redaction. The current isolated test suite does not replace these end-to-end tests.

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
- OWASP Top 10 for Agentic Applications 2026: https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/\n- OWASP Memory & Context Poisoning (ASI06): https://genai.owasp.org/2026/05/13/memory-is-a-feature-it-is-also-an-attack-surface/\n- Supabase row-level security and role boundaries: https://supabase.com/docs/guides/database/postgres/row-level-security
- Google's Rules of Machine Learning: https://developers.google.com/machine-learning/guides/rules-of-ml
- Google Cloud ML quality guidelines: https://docs.cloud.google.com/architecture/guidelines-for-developing-high-quality-ml-solutions
- OpenTelemetry general metrics conventions: https://opentelemetry.io/docs/specs/semconv/general/metrics/
- OpenAI Agents SDK human review: https://openai.github.io/openai-agents-js/guides/human-in-the-loop/
- OpenFeature evaluation context: https://openfeature.dev/specification/sections/evaluation-context/

- Server-side authorization versus row-level policy: https://supabase.com/docs/guides/database/postgres/row-level-security

### 2026-10-09 source verification notes

- NIST AI RMF recommends independent risk measurement and continuous post-deployment governance; neither a policy evaluator nor its unit tests qualify as production monitoring or certification: https://airc.nist.gov/airmf-resources/airmf/5-sec-core/
- Supabase RLS identifies `service_role` as bypassing RLS; a privileged backend must verify every tenant query rather than treat RLS as a safety net: https://supabase.com/docs/guides/database/postgres/row-level-security
- OWASP agentic risk categories explicitly cover identity/privilege abuse and memory/context poisoning. A stored learning result must remain data and must not be reinterpreted as a tool instruction or permission: https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/

### 2026-10-09 second control hardening review

- Governance verification now happens before any aggregate evidence query; the controller does not speculatively read aggregated customer-derived activity if the governance source denies access or fails.
- The authenticated principal is resolved again after evidence and consent reads, blocking the preview if the membership, user identity, organization or read permission has changed. This is not an atomic authorization substitute; actual operations need independent checks.
- The prior constant `userCanInspectCorrectDelete: true` was replaced by separate, mandatory, server-attested inspect/correction/deletion control fields. These are **contracts only** pending real authenticated data-rights endpoints; no right is operational solely because the flag exists.
- The focused pure-module test set contains 35 cases, including negative tests for the individual rights flags, governance-first sequencing, mid-read principal changes and exception redaction. This is **not** the full pnpm/Mocha/CI matrix.
