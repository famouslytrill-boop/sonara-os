# SONARA Industries — Customer Governance Execution Control Plane
**Date:** 2026-10-08  
**Status:** research-backed source architecture in branch `codex/customer-governance-control-plane-20261008`. No production migration, provider-side effect or deployment is authorized by this document.

## Executive decision

SONARA should keep the low-budget launch model:

- SONARA sells software subscriptions and records customer business activity.
- Customer commerce/rent/creator proceeds/supplier/ad money remains with customer-owned or external providers.
- Deterministic rules handle known arithmetic, limits, timestamps, tenancy and approval state.
- AI drafts, summarizes and recommends; it does not become the legal, financial or authorization authority.
- Consequential external actions use exact-snapshot customer approval and a two-phase transactional execution contract.
- A repository control reduces risk only when the live route, database and provider adapter actually enforce it.

Zero legal fault is not achievable. The engineering goal is **bounded authority + explicit evidence + minimal regulated activity + recoverable failures**.

## 1. Research findings that materially change the design

### Authorization
OWASP currently recommends least privilege, deny-by-default, and validating permissions on every request. Its authorization-pattern guidance distinguishes a Policy Enforcement Point from a Policy Decision Point and emphasizes enforcement close to the protected resource.

SONARA therefore keeps:
`authenticate -> canonical tenant membership -> resource/action authorization -> separate approval -> executor`.

An approval does not create authorization, and authentication does not imply authorization.

### API/resource limits
OWASP API4:2023 recommends endpoint-specific request/payload bounds, operation-frequency controls, limits on response size and provider spending limits/alerts.

SONARA therefore uses **weighted resource budgets**, not only requests/minute:
`cost_units = base + ceil(payload_bytes/MiB)*size_weight + declared_work_units`.

It also separately limits:
- token/refill budget;
- daily units;
- concurrent work;
- upload/request size;
- rows/pages;
- provider spend;
- model/media generation budgets.

### Authentication retries
NIST SP 800-63B-4 treats 100 consecutive failures as an upper bound for applicable authenticators and permits lower limits. Authentication retry policy remains distinct from expensive-resource rate budgets.

### Reviews/testimonials
FTC's Consumer Review Rule has been effective since 2024 and covers deceptive practices including fake/false reviews, AI-generated fake reviews, sentiment-conditioned incentives, certain insider practices, deceptive company-controlled independent-review representations and review suppression. FTC platform guidance also stresses genuine feedback and comparable treatment of positive and negative reviews.

SONARA therefore stores:
- exact review hash;
- authenticated author confirmation;
- actual-experience attestation;
- incentive/relationship metadata;
- AI-assistance state;
- moderation event/reason;
- publication state.

The business cannot rewrite a review and preserve the customer's earlier approval.

### Electronic records
Ohio ORC 1306.11 states that where record-retention law applies, qualifying electronic retention must accurately and completely reflect the final record and remain accessible for later reference. ORC 1306.07 also addresses recipient ability to retain electronic records.

SONARA therefore preserves immutable final document/review/action snapshots separately from mutable application fields.

### Risk governance
NIST SP 1308 (final March 2026) links CSF 2.0, enterprise risk management and workforce decisions. SONARA's risk system should therefore drive explicit owners, review queues and evidence freshness rather than a decorative “security percentage.”

## 2. Current deterministic control chain

The intended request path is:

`identity`
→ `tenant`
→ `authorization`
→ `trusted timestamp`
→ `weighted resource budget`
→ `risk + proof`
→ `customer board approval`
→ `preflight evidence ready`
→ `atomic execution claim`
→ `provider adapter`
→ `verified settlement`
→ `audit/outbox`
→ `customer record/dashboard/spreadsheet`.

Each stage can only tighten authority.

### Existing source components
- `sonara-customer-authorization-calculator.cjs`
- `sonara-rate-budget-math.cjs`
- `sonara-time-authority.cjs`
- `sonara-deterministic-risk-assessment.cjs`
- `sonara-customer-proof-engine.cjs`
- `sonara-customer-approval-board.cjs`
- `sonara-customer-review-governance.cjs`
- `sonara-customer-automation-policy.cjs`

### New orchestration components in this branch
- `sonara-governance-request-preflight.cjs`
- `sonara-governance-execution-state.cjs`
- `sonara-review-moderation-metrics.cjs`
- review-only execution-claim SQL proposal

## 3. Governance request preflight

`preflightGovernedRequest()` composes existing controls.

It verifies:
- tenant/resource scope;
- role/action/resource authorization;
- required risk class;
- exact approval evidence for consequential actions;
- trusted server/provider time;
- weighted token budget;
- daily resource budget;
- concurrency budget;
- deterministic residual-risk evidence;
- required proof packet.

A successful preflight returns:
`preflight_evidence_ready`.

It still returns:
`executionAuthorized: false`.

That is deliberate. A preflight result can be stale immediately after it is calculated.

## 4. Two-phase claim → execute → settle

### Phase A — preflight
Pure/read-only evaluation. No side effect.

### Phase B — atomic claim
Future database RPC must atomically:
1. resolve canonical tenant/role;
2. lock/re-read the approval;
3. compare the exact proposal SHA-256;
4. reject expired/revoked approval;
5. consume shared resource budgets;
6. acquire concurrency;
7. insert unique `(organization_id, idempotency_key)` claim.

Duplicate key:
- same snapshot + already settled → return recorded outcome;
- same snapshot + still executing → do not execute again;
- different snapshot → block.

### Phase C — external execution
Only an owned `claimed` row may transition to `executing`.

Before adapter invocation:
- tenant still matches;
- snapshot still matches;
- provider is configured;
- executor key is registered.

### Phase D — settlement
Success requires:
- executor actually attempted;
- provider result reference;
- independently verified provider-result evidence;
- observed side effect;
- transactionally recorded settlement.

Provider timeout remains **unknown**, not automatically failed.

### Phase E — outbox/reconciliation
Settlement and event/outbox insertion happen together.
Notification delivery may retry independently without repeating the underlying side effect.

## 5. Idempotency and race-safety formulas

### Unique side-effect identity
`claim_key = organization_id + idempotency_key`.

The key is bound to:
`proposal_snapshot_sha256`.

An idempotency key cannot be reused for different request bytes.

### Approval expiry
`claim_time <= approval_expires_at`.

If approval expires after preflight but before claim, claim fails.

### Weighted budget
`refilled = min(capacity, available + floor(elapsed_ms * refill_per_minute / 60000))`.

`allow = request_cost <= refilled`.

### Retry wait
`retry_ms = ceil((request_cost - refilled) * 60000 / refill_per_minute)`.

### Risk
`inherent = likelihood(1..5) * impact(1..5)`.

`residual = ceil(inherent * (10000 - verified_control_effectiveness_bps) / 10000)`.

No current verified control evidence → residual risk = `unknown`.

### Proof completeness
`coverage_bps = floor(covered_required_evidence_types / total_required_types * 10000)`.

A hash proves integrity, not truth.

## 6. Review fairness audit

The moderation metrics are descriptive only.

For each sentiment:
`action_rate_bps = floor((held + removed) / submitted * 10000)`.

Audit disparity:
`abs(negative_action_rate - positive_action_rate)`.

A configured disparity threshold may create:
`requires_policy_reason_audit`.

It does **not** produce:
- “illegal”;
- “fake reviewer”;
- automatic deletion;
- protected-class inference;
- a legal conclusion.

Every hold/removal still needs an allowed moderation reason.

## 7. Customer-controlled review board

Customer control means:
- reviewer approves their own exact review;
- business moderates under disclosed neutral rules;
- owner decides whether to feature a genuine review as marketing proof;
- customer can approve/reject pending actions for their organization.

It does **not** mean:
- business approves words for the reviewer;
- AI creates fictional consumer experiences;
- business selects only customers predicted to be positive;
- negative sentiment itself is a removal reason;
- one approval becomes permanent standing authority for sensitive automations.

## 8. Customer automation/agent boundary

Safe bounded unattended candidates:
- summarize records;
- draft content/replies;
- prepare reports;
- data-quality checks;
- next-step suggestions;
- reversible classification.

Approval-per-run:
- campaigns;
- review/testimonial publication;
- refunds;
- payment destination/security changes;
- legal/policy publication;
- destructive mutations.

Every run must have:
`tenant + skill version + trigger + tool allowlist + data scope + daily budget + concurrency + cost + result + audit`.

A model/agent cannot upgrade its own permissions.

## 9. AI-generated content

AI content pipeline:
`source/rights -> bounded context -> provider/model/version -> generation -> private output -> hash/provenance -> policy review -> customer approval -> publication`.

Legal draft:
`source registry -> deterministic jurisdiction facts -> bounded AI draft -> human/customer review -> separate signing/execution`.

Consumer review:
AI may provide editing assistance, but exact final text must be reapproved by the real reviewer.

Financial calculation:
Known formulas remain deterministic code; model output is explanatory text only.

## 10. Database proposal

Review-only file:
`docs/architecture/SONARA_GOVERNANCE_EXECUTION_CLAIM_SCHEMA_PROPOSAL_2026_10_08.sql`.

Three new proposed tables:
- `claims`
- `attempts`
- `resource_consumptions`

Canonical reuse:
- `public.agent_pending_actions` remains the organization-scoped customer approval queue.
- `public.event_outbox` + `public.event_delivery_attempts` remain the durable result/event delivery system.
- `public.sonara_auth_rate_limits` remains authentication-specific throttling and is not reused as a weighted resource-budget ledger.

Security posture:
- private schema;
- anon/authenticated grants revoked;
- RLS enabled;
- no provider secrets;
- no raw bank/card data;
- no customer-content payloads in execution audit rows.

This is deliberately outside `supabase/migrations/`.

## 11. Customer spreadsheets/dashboard

Customers should receive values-only workbook views for:
- approval requests;
- review moderation;
- risk register;
- proof coverage;
- automation usage;
- weighted rate budgets;
- evidence age;
- execution claims/outcomes.

No uncontrolled workbook macros or formula strings.

Useful values:
- `approval_remaining = required - valid`;
- `automation_utilization_bps = floor(runs_today / max_runs * 10000)`;
- `budget_utilization_bps = floor((capacity - available)/capacity * 10000)`;
- `evidence_age_days`;
- `proof_coverage_bps`;
- `review_reason_coverage_bps`;
- `failed_execution_rate_bps`.

## 12. Low-budget scaling roadmap

### Bootstrap
Postgres/Supabase remains the coordination store. Do not add Kafka/Redis merely for architecture fashion.

Use:
- unique constraints;
- row locks / atomic RPC;
- pgmq/durable queue where justified;
- transactional outbox;
- bounded worker concurrency;
- private object storage;
- indexes on tenant/state/time.

### Early growth
Measure contention before adding infrastructure:
- p95 claim latency;
- rate-budget lock wait;
- queue depth;
- outbox lag;
- provider retry rate;
- tenant storage;
- model/media unit cost;
- failed/unknown settlement rate.

### Scale trigger
Add a dedicated high-throughput shared counter only when Postgres rate-budget contention is measured. Durable claims/audit remain in Postgres.

Partition event/attempt/outbox history only after table size and query plans justify it.

## 13. Customer proof requirements

Do not advertise “verified customer” or “verified payment” from a self-reported row.

Suggested tiers:
- `claimed_only`
- `attributable`
- `corroborated`
- `independently_verified`

Payment proof requires provider-side evidence retrieved through a trusted adapter.
Bank settlement proof requires independent bank evidence.
Review authorship requires authenticated exact-text confirmation.

## 14. Release sequence from here

1. Keep this branch pure/review-only until exact-head CI is green.
2. Preserve `agent_pending_actions` as canonical organization approval truth and `event_outbox` as canonical durable delivery; do not revive `entity_action_approvals` as a competing organization approval system.
3. Implement one atomic claim RPC in a non-production Supabase environment, rechecking `agent_pending_actions` and consuming a dedicated weighted-resource budget in the same transaction.
4. Run 50-way concurrency proof: one idempotency key → exactly one claim winner.
5. Add rollback/restore and outbox duplicate-delivery tests.
6. Wire a **safe reversible** action first (for example private report generation), not money/publishing/security.
7. Canary for one approved tenant.
8. Only after evidence is green, wire a consequential adapter behind per-run customer approval.
9. Keep real payment custody/rent collection/wallet/escrow outside the low-budget launch architecture.

## Authoritative sources reviewed

- FTC Consumer Reviews and Testimonials Rule Q&A: https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers
- FTC review-platform guidance: https://www.ftc.gov/business-guidance/resources/featuring-online-customer-reviews-guide-platforms
- OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- OWASP Authorization Patterns: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Patterns_Cheat_Sheet.html
- OWASP API4 Resource Consumption: https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/
- NIST SP 800-63B-4: https://pages.nist.gov/800-63-4/sp800-63b.html
- NIST SP 1308: https://csrc.nist.gov/pubs/sp/1308/final
- Ohio ORC 1306.07: https://codes.ohio.gov/ohio-revised-code/section-1306.07
- Ohio ORC 1306.11: https://codes.ohio.gov/ohio-revised-code/section-1306.11

**No source above makes SONARA legally fault-proof. The control plane is designed to make authority, evidence and failure states explicit and auditable.**
