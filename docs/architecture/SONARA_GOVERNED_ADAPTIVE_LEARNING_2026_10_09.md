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

A future authenticated route must provide **six independent server-controlled functions**:

1. `resolvePrincipal`: resolve an authenticated user and active organization membership through the existing trusted SONARA session and authorization stack; identify permission to read learning evidence. Do not accept a user ID or verified role from the HTTP body.
2. `readLatestConsent`: fetch the latest scoped, revisioned opt-in receipt for that exact user, organization and change type. It must be current and distinguish revoke/expiry, missing records and provider errors.
3. `readAggregateEvidence`: obtain only approved organization-wide cohort summary counts, checked evidence windows, measurement definition, source provenance, minimum contributor population, and small-cell suppression; **never raw user events, emails, messages, personal traits, or secrets**.
4. `readGovernance`: retrieve separately verified **inspect**, **correction** and **deletion** availability flags, overall review status, rollback readiness and a bounded explanation from an independently governed policy source. Missing or false rights-control flags block evidence access; no caller may hardcode their availability.
5. `authorizeUserScopedEvidenceRead`: require a **caller JWT, never service-role**, through `requireVerifiedUserScopedRead()` from `lib/sonara-supabase-clients.cjs`; reject unverified table grants/RLS, missing tenant checks, proof mismatches or stale target-database evidence before reading aggregates. The proof must come from authenticated server-side staging/live test observations, not a request or user-supplied flag.
6. `clock`: produce server-owned canonical UTC timestamps; never trust browser clocks for authorization decisions.

The service first resolves the server principal and reads/validates opt-in **before** touching aggregate evidence. It then independently validates governance **and an independently verified user-scoped database read**, **before** making the aggregate read (no concurrent speculative aggregate access when governance/RLS would deny the request). After the evidence read it re-reads the consent receipt **and** independently re-resolves the authenticated principal to detect mid-read membership, permission, organization, or account changes. A missing/mismatching/stale/revoked receipt, altered revision, invalid aggregate shape, inadequate privacy safeguards, unsafe provenance, absent governance review, or a reader exception gives a **blocked, non-executing** outcome. Exceptions are returned as a generic refusal; provider/database error strings are not disclosed to callers. A passing result is still just a *review-ready proposal*.

**Critical limitation:** The injected functions are deliberately not wired to production. Their booleans and objects are test seams, **not cryptographic security proofs**. The production integration needs real provider identity, durable session membership checks, approved and least-privileged database readers, server-resolved organization filtering, audited RLS/grants and revocation semantics. A second consent read can detect a change *during these reads* but is **not transactional isolation** and cannot prevent a revocation that happens after the second read. Because no action is executed, this residual race does not authorize anything. Any later action must independently reauthorize consent and permissions within its own transaction or equivalent durable operation boundary.

### Verification and next production architecture

- Focused regressions cover legitimate principal-to-consent-to-governance-to-evidence flow, unauthorized membership refusal before queries, speculative aggregate-read prevention when governance denies access, forged request flags, expired and revoked receipts before evidence access, consent revision changes during reads, mid-read user/tenant/permission changes, cross-tenant evidence, missing privacy evidence, raw record contamination, malformed provenance and deliberate provider exception redaction.
- Deliver a private, separately reviewed schema and tenant/role allow-and-deny test suite. Do not create or connect a new customer-data store until release governance, provenance, retention and data-deletion controls are approved.
- For a future read-only customer preview route, require account authentication, active tenant membership, anti-abuse limits, source-of-truth consent, verified grants/RLS behavior, and one-tenant canary observation. Use caller-scoped RLS when practicable; where service-role authority is required, make tenant filtering and independent membership verification explicit and adversarially tested. No auto-posting, payments, code merging, tenant permission changes or self-modification is permitted.
- During failure drills, test replayed consent, revoked user sessions, changed membership, schema drift, missing aggregate rows, provider outages and log redaction. The current isolated test suite does not replace these end-to-end tests.

## Stage 5: fail-closed user-JWT selection contract — implemented, not activated

The current `lib/sonara-supabase-clients.cjs` includes `chooseClient()`, which correctly preserves existing legacy page behavior but defaults to **service_role** for an unknown or unready table. That fallback is **not acceptable for a newly introduced private learning-evidence route**, because the service-role credential bypasses RLS.

The new `requireVerifiedUserScopedRead()` function is an opt-in **fail-closed** route-independent helper. It requires all of the following before constructing customer-scoped GET headers:

- Explicit canonical table and server-resolved matching user ID and organization ID.
- A nonempty customer access token distinct from the public/anon key and privileged service-role key.
- A recent (24-hour maximum), canonical-UTC **server-attested target-database** RLS-readiness proof identifying the same table, user and organization, with grants checked, a same-tenant positive read and a cross-tenant denial test.
- A public or anonymous API key in `apikey` paired with the caller token in `Authorization`. It refuses equal/privileged keys.
- A `client: "user"`, `mode: "rls_scoped_read_only"`, `serviceRoleFallbackAllowed: false` result. No retry to service role, no write method, no separate data read.

The `createAdaptiveProposalReader()` adapter now additionally requires `authorizeUserScopedEvidenceRead()` and refuses to invoke `readAggregateEvidence` until the callback returns the exact **read-only** scope and table `sonara_learning_aggregates`. It must be implemented on the server using `requireVerifiedUserScopedRead()`, not a manually forged result. The learning aggregate table **does not exist as a released, verified SONARA customer schema**; this boundary is therefore **inactive**, and real requests must not use it.

**Evidence is not self-certifying:** `liveProof`, `membershipVerified`, `controlsVerified` and `sourceVerified` are fields that any JavaScript caller can fabricate. The security system must issue/read these exclusively from server-owned authorization logic and independently verified database tests, never deserialize them from an HTTP body or from agent output. A successful local test with a mocked token/attestation proves *only* the fail-closed structural contract, not a real Supabase JWT, deployed RLS, a live data source, or access control.

**Prerequisites:** independently reviewed and reconciled production schema; private learning-aggregate storage with least-privilege grants, RLS and real two-tenant access/deny proofs; user read and deletion/correction paths; server-authenticated principal and live consent; bounded retention/audit; rollback tests; exact-head release CI green. No production database migration, provider secret update or customer-data activation occurred in this PR.

Supabase key and RLS references, current as of this engineering date: https://supabase.com/docs/guides/getting-started/api-keys and https://supabase.com/docs/guides/database/postgres/row-level-security. Supabase now favors publishable/secret keys rather than legacy anon/service_role; migrating key configuration requires a separately tested change, not a silent alias swap.

## Stage 6: Opaque read capabilities and Supabase key compatibility

The read-only `requireVerifiedUserScopedRead()` helper now issues a **process-local, branded capability**. `isVerifiedUserScopedRead(capability, {table, organizationId, userId})` checks both object identity against a non-exported `WeakSet` and the exact scope. The adaptive proposal reader requires this check before `readAggregateEvidence` can run. A forged JSON object, object spread, shallow copy or serialized/deserialized clone of a legitimate capability is rejected.

The selected request's HTTP header object remains available to authorized internal code as `capability.headers`, but the property is intentionally non-enumerable and immutable, so ordinary `JSON.stringify(capability)` does not include the caller's bearer token. **Do not log capability objects or HTTP headers using custom inspectors, debug dumps, or explicit property enumeration; the token remains readable by code holding the object.** This is a narrow accidental-leak reduction, not a secrets vault.

Current Supabase API keys include low-privilege `sb_publishable_` keys and elevated `sb_secret_` keys, in addition to legacy `anon` and `service_role` keys. The strict selector now optionally accepts a **publishable key** through `config.publishableKey` without changing the legacy user-client chooser; it rejects secret and service-role keys as API-key credentials or caller access-token substitutes. The caller's independently authenticated access token still belongs in `Authorization: Bearer ...`. The key itself never proves the customer is signed in. Relevant upstream documentation: https://supabase.com/docs/guides/getting-started/api-keys and https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys.

**Threat model limitation:** A capability proves only that the object was created by the in-process selector. It does **not** prove that the user JWT was cryptographically verified, that a requested customer session remains active, that a `liveProof` record originated from a real target database, or that RLS policies allow/deny the expected rows. A malicious caller inside trusted server code could mint a capability using forged dependency inputs. Therefore no external client may call the selector or populate `liveProof`; those inputs must come from independently authenticated server checks, database access probes, and approved RLS tests. Never treat capability identity as execution authorization. No Supabase connection, schema migration, or provider key change was performed here.

Regression coverage now includes branded vs cloned capabilities, token-safe standard JSON serialization, authorization to the exact requested tenant/user/table, legacy and publishable API keys, blocking of secret-key aliases, and the earlier 35 learning/privacy/governance tests. The focused **43-case isolated JavaScript harness** is not a full Node 24, lint, Mocha, browser, database or CI run.

## Stage 7: observed two-tenant RLS checks (read-only, not production-wired)

The earlier `requireVerifiedUserScopedRead()` accepted caller-supplied `liveProof` Boolean fields. Even though it issued a module-private branded read capability, **any trusted-process caller could mint a valid capability with a fabricated proof object**. Brand checking alone does not establish evidence origin.

The new `createUserScopedRlsReadinessVerifier({ inspectTableSecurity, readExactRow })` returns an asynchronous, strictly read-only verification process. A successful run now requires, in this exact sequence:

1. Two distinct, server-selected organization IDs, user IDs, JWT access tokens and known, seeded, distinct row IDs. Scope and timestamp inputs are validated; no secrets are serialized into proof results.
2. Trusted `inspectTableSecurity({table})` evidence indicating table grants, enabled RLS, and source verification.
3. Positive probe: **user A's own JWT** reads the known row A, and its ID and `organization_id` match.
4. Negative probe: user A's JWT receives **zero rows** querying known row B **by its ID alone**.
5. Positive probe: user B's JWT reads known row B and its organization matches.
6. Negative probe: user B's JWT receives **zero rows** querying known row A **by its ID alone**.

**The `readExactRow` adapter MUST NOT add `organization_id` filtering, because a filter would make a cross-tenant test pass even if RLS were broken.** It must send the selected user's JWT with a low-privilege publishable/anon key (not service-role), use an exact-row read-only query, and return only the minimal checked result; do not record credentials, actual customer rows or private identifiers in published logs.

Failure to find an own-tenant row, an erroneous negative/positive result, a mismatched row/tenant, missing privilege proof, provider exception, future timestamp, or non-distinct user/tenant fixtures causes a generic rejection. Successful verification creates a **module-private branded proof** (not caller-provided booleans), which `requireVerifiedUserScopedRead` requires before constructing a branded, user-scoped GET capability. Copies/JSON clones of either proof or read capability are rejected.

**Important remaining limitation:** The verifier still uses **injected callbacks**. Its focused tests mock all responses; a malicious or wrongly implemented server callback can synthesize the expected four observations. There is no active REST route, real project probe, real JWT validation, real database, seeded tenant fixtures or production migration in this PR. A production proof requires independently authenticated, live two-tenant test accounts and controlled access to the verified target database, plus a source identity and migration/grant/RLS reconciliation. The proof is a point-in-time check, not a durable authorization guarantee; authenticated scope and consent must be checked on every request and again before consequential actions.

The design follows Supabase's documented separation between table grants (object privileges) and RLS row filtering, and its documented service-role bypass. It is not evidence of live compliance: https://supabase.com/docs/guides/database/postgres/row-level-security

**Current isolated verification:** 45 focused JavaScript tests passed against branch-fetched modules, including tested fixture-positive and fixture-denial paths; full pnpm/Node24 test, browser, migration, external API and staging RLS runs remain outstanding. All learning and self-coding results are still proposals only.

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
