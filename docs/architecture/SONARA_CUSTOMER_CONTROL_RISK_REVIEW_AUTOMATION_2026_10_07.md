# SONARA Industries — Customer Control, Review Boards, Risk, Proof, Rate Budgets and Governed Automation
**Date:** 2026-10-07  
**Status:** research-backed engineering blueprint with pure-function draft controls in PR #442. Not deployed, not an applied database migration, not legal advice or legal certification.

## 1. Control-plane principle
Every consequential customer workflow should pass through the same layers:

`identity -> tenant -> authorization -> rate/resource budget -> immutable request snapshot -> trusted timestamp -> deterministic calculation -> risk/proof checks -> customer approval board -> governed executor -> append-only outcome/audit -> customer record -> spreadsheet/dashboard`.

**AI is an optional assistant inside the workflow, not the authority layer.** An AI model cannot create tenant membership, money authority, legal approval, customer consent, review authorship, proof, timestamps, signatures or security permissions.

## 2. Authorization model
Authentication answers **who**. Authorization answers **may this identity perform this action on this resource in this tenant**. Approval answers **has the authorized customer decided to proceed with a consequential action**. These three states must remain separate.

Proposed authorization components:
- **Policy Enforcement Point (PEP):** route/service immediately protecting the resource.
- **Policy Decision Point (PDP):** deterministic role/resource/action/tenant policy.
- **Policy Administration Point (PAP):** customer-owned roles, board assignments and policies.
- **Policy Information Point (PIP):** canonical membership, resource ownership, sensitivity, step-up and board evidence.

Default deny. Unknown role/action/resource -> deny. Every service-role database call still needs an explicit tenant filter even when RLS exists.

Draft calculator: `lib/sonara-customer-authorization-calculator.cjs`.

### High-impact authorization
`approve | publish | delete | security_admin | billing_admin` requires owner/admin authority and step-up authentication. Destructive, security and billing administration also require review-board evidence. The calculator itself never becomes a runtime permission token.

## 3. Customer approval board
Customers own their governance rules but may not weaken SONARA's hard safety floors.

### Multi-person company
High-risk requests use two distinct authorized human approvals:
`proposal hash -> requester -> approver A -> approver B -> exact-hash quorum -> separate executor`.

The proposer cannot satisfy dual control. A decision for a different snapshot is invalid.

### Solo customer/business
A one-person business cannot invent a second employee. Explicit `solo_owner_step_up` uses:
- owner identity;
- strong reauthentication;
- exact immutable proposal hash;
- short approval expiry;
- delayed second confirmation (current proposal: 5 minutes);
- independent-channel confirmation for financial/security changes;
- explicit residual-risk label `no_independent_second_human`.

This is less protective than a second human and the product must say so.

Draft: `lib/sonara-customer-approval-board.cjs`.

## 4. Customer review board / customers approve their own reviews
A customer may approve **their own exact review text**. That means the authenticated author confirms the hash of the exact text they experienced/wrote. It does **not** mean the business may approve, rewrite or fabricate words on the customer's behalf.

Review states:
`draft -> exact_text_author_confirmed -> moderation_review -> publication_review_ready -> published/held/removed`.

Rules:
- actual experience attestation;
- exact text hash;
- customer identity evidence;
- any grammar/AI suggestion requires exact-text reapproval;
- business-drafted or fully AI-generated content may not impersonate a consumer review;
- incentives cannot depend on positive/negative sentiment;
- material incentives/relationships require appropriate disclosure;
- positive and negative reviews use the same moderation policy;
- sentiment by itself is not a moderation/removal reason;
- business-controlled review pages cannot claim to be independent;
- moderation may hold/remove for real policy reasons but does not rewrite the review's message.

FTC's Consumer Review Rule addresses fake/AI-generated reviews, sentiment-conditioned incentives, certain insider practices, company-controlled “independent” review sites, review suppression and fake social indicators. FTC staff guidance also recommends equal treatment of positive/negative reviews and no editing to change the message. The Consumer Review Fairness Act separately restricts standardized contract terms that punish honest reviews.

Draft: `lib/sonara-customer-review-governance.cjs`.

## 5. Proof and customer records
A “proof” record has multiple independent properties:

1. **Integrity:** bytes/hash have not changed.
2. **Attribution:** identified person approved/created this exact record.
3. **Corroboration:** multiple relevant sources agree.
4. **Independent verification:** data was independently retrieved from an external authoritative source.
5. **Completeness:** all evidence types required for this claim are present.
6. **Publication authority:** customer/business has separately approved publication.

Do not collapse them into one “proof score.”

Current evidence tiers:
`claimed_only -> attributable -> corroborated -> independently_verified`.

Objective formula:
`required_coverage_bps = floor(verified_required_types / total_required_types * 10000)`.

A SHA-256 hash is integrity evidence; it is **not truth evidence**.

Draft: `lib/sonara-customer-proof-engine.cjs`.

### Customer record versioning
Every consequential customer record should retain:
`record_id, organization_id, record_type, version_no, current_hash, previous_hash/ref, source, created_by, created_at, modified_by, modified_at, status, evidence_refs, approval_refs, retention_rule_ref`.

For signed/final records, preserve the exact final binary/text version separately from mutable working data. Do not recreate the “original” from fields that later changed.

## 6. Trusted time / calendar / timestamps
Store three different clocks when relevant:
- **server_received_at** — SONARA server receipt; default deadline authority.
- **provider_occurred_at** — may become authority only after provider evidence/signature verification.
- **client_occurred_at** — useful context but untrusted for deadlines until independently verified.

Never let a device's reported time silently overwrite server receipt.

Approval window:
`expires_at = requested_at + ttl_seconds`.

Trusted deadline:
`due_at = trusted_anchor_at + statutory_or_policy_duration`.

Calendar duration:
`duration_minutes = (end_instant - start_instant) / 60000`.

Require offset-aware RFC3339 timestamps and preserve IANA time-zone identifiers for display/scheduling. DST math should use instants, not naive “09:00 minus 08:00” strings.

Capacity:
`whole_jobs = floor(available_minutes / (minutes_per_job + buffer_minutes))`.

That is capacity math, not a guaranteed dispatch schedule.

Draft: `lib/sonara-time-authority.cjs`.

## 7. Weighted rate limits and cost controls
SONARA already has durable Postgres-backed authentication throttling. Keep that.

Add a distinct resource budget for expensive work:
`request_cost = base_cost + ceil(payload_bytes / MiB) * size_weight + declared_work_units`.

Token-bucket refill:
`refilled = min(capacity, available + floor(elapsed_ms * refill_units_per_minute / 60000))`.

Request:
`allow iff request_cost <= refilled`.

Retry:
`retry_ms = ceil((request_cost - available) * 60000 / refill_units_per_minute)`.

Also enforce:
- per-IP where appropriate;
- per-user;
- per-organization;
- per-automation;
- provider spend/day;
- concurrency limits;
- request body/file size;
- returned row/page count;
- model output/input/token/resource ceilings.

A request-frequency limit alone is inadequate when one request can generate a 4K render or export 50,000 rows. OWASP API4:2023 specifically calls out resource consumption, payload limits, rate limiting and provider-spend limits.

Draft: `lib/sonara-rate-budget-math.cjs`.

## 8. Authentication throttling
NIST SP 800-63B-4 requires effective throttling for relevant authenticators and treats 100 consecutive failed attempts as an upper bound in the referenced rules; applications may use lower limits and escalating delays/risk controls.

SONARA should maintain different policies:
- password/login attempt budget;
- OTP/recovery budget;
- reset-email budget;
- magic-link budget;
- API/public-form budget;
- expensive-work resource budget.

Successful authentication can reset applicable retry counters as appropriate, but issuing a new OTP must not become a way to reset the security boundary.

## 9. Deterministic risk assessment
Avoid the fake precision of “82% risky.”

### Inherent matrix
`inherent_score = likelihood(1..5) * impact(1..5)`.

Current internal priority bands:
- 1–4 low
- 5–9 moderate
- 10–16 high
- 17–25 critical

These are prioritization conventions, not predicted probabilities.

### Residual risk
Only apply a control reduction if evidence is both current and verified:
`residual_score = ceil(inherent_score * (10000 - measured_control_effectiveness_bps) / 10000)`.

No verified control evidence -> residual risk is **unknown**, not lower.

### Expected-loss scenario
When a separately justified probability estimate exists:
`expected_loss_cents = ceil(loss_cents * event_probability_bps / 10000)`.

This is scenario expected value, not a forecast and not a reserve/payment.

### Review triage
A separate priority index can combine:
- residual band;
- deadline proximity;
- data sensitivity;
- number of affected customers.

It is labeled `triage_priority_not_legal_severity`.

Draft: `lib/sonara-deterministic-risk-assessment.cjs`.

## 10. Customer calculators
Customer calculators should return:
`input assumptions + formula version + exact result + unit + rounding rule + exclusions + evidence state + generated_at`.

Examples:
- break-even;
- margin;
- storage budget;
- rate budget;
- risk matrix;
- expected loss;
- scheduling capacity;
- proof completeness;
- review-board quorum;
- resource cost;
- retention due date;
- backup age;
- restore coverage;
- automation utilization.

No calculator should execute a payment, determine legal compliance, deny housing/employment/credit, publish a review, or assert a tax obligation solely from arithmetic.

## 11. Customer automations
Customer-owned automation:
`trigger -> tenant/authorization -> rate budget -> skill plan -> deterministic checks -> owner approval if sensitive -> action adapter -> result/audit -> customer notification`.

Triggers:
`manual | schedule | record_created | record_changed | deadline_approaching | threshold_crossed`.

Safe bounded skills:
- records summarizer;
- private draft writer;
- reply drafter;
- report builder;
- data-quality checker;
- next-step planner;
- record classifier.

Sensitive examples:
- campaign dispatch;
- review/proof publication;
- refund preparation/execution;
- security/permissions;
- legal-policy publication;
- destructive changes.

Sensitive skills are `approval_per_run`; customers cannot create one blanket approval and let it run forever.

Every automation must have:
- customer pause/cancel;
- max runs/day;
- max concurrent runs;
- expiry/renewal;
- resource budget;
- tool-call bound;
- exact data scope;
- audit events;
- failure/circuit-breaker behavior.

Draft: `lib/sonara-customer-automation-policy.cjs`, building on the existing `sonara-agent-authority.cjs`.

## 12. Customer agent skills
A skill is a contract, not authority.

Skill manifest:
`{skill_key, version, purpose, products, input_schema, output_schema, data_scope, tool_allowlist, max_tool_calls, resource_budget, side_effect_class, approval_mode, sources, retention, failure_policy}`.

Execution patterns:
- deterministic/local first;
- single-shot model for bounded no-side-effect work;
- retrieval + generation where grounding is necessary;
- bounded tool loop only when useful;
- verifier-gated/high-impact flow for sensitive work;
- human approval at the point of irreversible external effect.

AI “self-review” is not independent verification.

## 13. AI-generated content
For normal content:
`source rights -> model/version -> generation -> private output -> hash/provenance -> rights/safety review -> customer approval -> publication`.

For consumer reviews/testimonials:
**do not generate a fictional consumer.** AI can assist the real customer with spelling/grammar, but the real customer must approve the exact final text and remain the source of the experience.

For legal drafts:
AI may generate an explicitly unreviewed draft within a bounded source set. It may not certify enforceability or automatically sign/publish it.

For calculations:
prefer deterministic code over model math whenever formula/inputs are known.

## 14. Review-board automation and customer self-control
A customer can:
- create their own boards;
- appoint authorized reviewers;
- pause their automations;
- approve/reject exact pending actions;
- approve their own exact review text when they are the reviewer/author;
- set ordinary operational thresholds/cadence;
- configure notification preferences;
- export governance registers.

They cannot use settings to bypass:
- tenant boundaries;
- owner-only high-risk authority;
- required step-up;
- exact-snapshot approvals;
- per-run approval for sensitive automations;
- legal/content safeguards;
- no-custody money model;
- system security limits.

## 15. Spreadsheet layer
Governance workbook views:
1. **Risk Register**
2. **Approval Board**
3. **Proof Register**
4. **Customer Reviews**
5. **Automations**
6. **Rate Budgets**

Draft: `lib/sonara-governance-workbook-views.cjs`.

These sheets contain plain values/evidence states, not arbitrary Excel formulas/macros.

Useful formulas generated by SONARA itself:
- `open_gap_count = count(state in {gap, partial, implemented_unverified})`
- `overdue = today > due_date && state != closed`
- `approval_remaining = required_approvals - valid_approvals`
- `proof_coverage = covered_required / total_required`
- `automation_utilization = runs_today / max_runs_per_day`
- `rate_budget_utilization = 1 - available_units / capacity_units`
- `evidence_age_days = floor((now - evidence_checked_at)/86400000)`

For financial sheets use integer cents and explicit basis-point rounding.

## 16. Proposed database schema
Review-only SQL:
`docs/architecture/SONARA_CUSTOMER_GOVERNANCE_AUTOMATION_SCHEMA_PROPOSAL_2026_10_07.sql`.

Sixteen conceptual tables:
- boards
- board_members
- approval_requests
- approval_decisions
- customer_reviews
- review_author_confirmations
- review_moderation_events
- proof_packets
- proof_evidence
- risk_assessments
- rate_budget_state
- calendar_events
- deadline_records
- customer_automations
- automation_runs
- customer_agent_skill_assignments

All are private-by-default in the proposal. No production migration has run.

Before migration, compare these tables to existing agent/action/approval/review schema and extend canonical truth rather than creating duplicate production truth.

## 17. Database scaling
### Current/low scale
- ordinary B-tree tenant/time/status indexes;
- bounded pagination;
- no `select=*` for large paths;
- idempotency unique keys;
- immutable/versioned evidence;
- private object storage for large files.

### Growth
Partition only after measurements justify it. Candidates at high volume:
- automation run/event logs by month;
- file access events by month;
- review/audit events by month;
- high-volume provider/webhook events.

Do not prematurely partition core customer entities.

### Shared-state hot spots
Rate budgets/queues require atomic DB procedures and careful indexes. At meaningful scale, separate:
- auth throttles;
- customer operational quotas;
- provider spend quotas;
- media worker concurrency.

For extremely hot counters, evaluate a dedicated low-latency shared counter only after Postgres contention is measured, keeping durable audit/reconciliation in Postgres.

## 18. Infrastructure scaling
**0–50 paid:** Postgres/Supabase + Vercel + own Stripe Billing + private Storage + manual review queue + deterministic controls.

**50–500:** durable queues, customer boards, rate/resource state, malware scanning, automation jobs, customer proof/review dashboards, alerting, object lifecycle.

**500–5,000:** separated workers, connection pooling, workflow queues, partition large event logs only if measured, provider resiliency, cost per tenant, audit anchor/restore drills.

**5,000+:** regional/DR work only when product/revenue/SLO evidence justifies it. Do not automatically add banking/custody/real-estate brokerage capabilities as a scale milestone.

## 19. Legal / policy research foundations
- FTC Consumer Review Rule prohibits categories including fake/false reviews (including AI-generated fake reviews), sentiment-conditioned review incentives, certain insider review practices, deceptive company-controlled review sites and certain review suppression.
- FTC review-platform guidance recommends genuine-review verification, no editing to change the message, equivalent treatment of positive/negative reviews, transparency and investigation of suspicious reviews.
- Consumer Review Fairness Act restricts standardized contract clauses that prohibit or penalize honest reviews or take review IP rights.
- Ohio UETA recognizes electronic records/signatures subject to its rules and requires qualifying retained electronic records to accurately/fully reflect final information and remain accessible for later reference.
- OWASP recommends deny-by-default/least privilege and enforcement close to resources, plus API resource/rate limits.
- NIST CSF 2.0 has SMB guidance, and NIST SP 1308 (March 2026) links cybersecurity, enterprise risk management and workforce decisions.
- NIST SP 800-63B-4 addresses authenticator retry/rate limiting and replay resistance.

## 20. Release road map
### P0
- Keep fee-only/no-custody customer-money boundary.
- Exact-head CI green.
- Resolve capability-inventory gate through the currently locked tracer owner/branch; do not edit the locked tracer from PR #442.
- Wire customer review exact-text confirmation to authenticated routes.
- Implement customer approval board on existing canonical approval tables if possible, rather than duplicating.
- Add atomic durable weighted rate-budget RPC.
- Add trusted timestamp capture to approval/review/automation records.

### P1
- Customer Review Board UI.
- Risk Register workbook.
- Customer Proof Register.
- Approval Board timeline/calendar.
- Automation Builder with safe skills and per-run sensitive approvals.
- Storage/file governance integration.
- Customer device/offline proof and revocation.

### P2
- External provider verification adapters.
- Genuine C2PA media provenance where appropriate.
- Advanced customer governance policies and enterprise retention.
- Optional regulated products only as separately funded/legal-reviewed launches.

## 21. Authoritative research starting points
- FTC Consumer Review Rule: https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers
- FTC review platform guidance: https://www.ftc.gov/business-guidance/resources/featuring-online-customer-reviews-guide-platforms
- FTC review solicitation guidance: https://www.ftc.gov/business-guidance/resources/soliciting-paying-online-reviews-guide-marketers
- FTC Consumer Review Fairness Act guidance: https://www.ftc.gov/business-guidance/resources/consumer-review-fairness-act-what-businesses-need-know
- Ohio UETA: https://codes.ohio.gov/ohio-revised-code/chapter-1306
- OWASP Authorization: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- OWASP Authorization Patterns: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Patterns_Cheat_Sheet.html
- OWASP API4 Resource Consumption: https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/
- NIST CSF SMB: https://csrc.nist.gov/pubs/sp/1300/final
- NIST SP 1308: https://csrc.nist.gov/pubs/sp/1308/final
- NIST SP 800-63B-4: https://pages.nist.gov/800-63-4/sp800-63b.html

**None of these design artifacts authorizes an external side effect or establishes legal compliance.**


## 22. 2026-10-08 continuation — durable resource budgets and AI governance

### Implemented on the follow-up branch
The pure deterministic automation preflight now composes the existing independent controls before a run becomes eligible for an executor:

`customer pause -> trusted server time -> authorization -> per-run approval -> weighted operation cost -> token/daily budget -> concurrency -> verified residual risk -> proof packet where required`.

The result still sets `externalSideEffectExecuted=false` and `runtimePermissionGranted=false`. This layer decides whether a request has sufficient evidence to proceed to a separately governed executor; it does not become the executor.

A dedicated service-only durable resource-budget migration now adds:
- SHA-256 bucket keys rather than raw IP/email/subject identifiers;
- weighted token capacity and per-minute refill;
- a separate daily-unit ceiling;
- short-lived idempotent concurrency leases rather than a fragile integer “active jobs” counter;
- automatic expiry so crashed workers self-release capacity;
- service-role-only SECURITY DEFINER RPCs with an empty search path;
- migration-time proofs for consumption, denial, idempotent lease reuse, saturation, release and recovery.

The application adapter deliberately fails closed when durable shared state is unavailable. Expensive automation/media/provider work does **not** fall back to an unlimited serverless-local counter.

Resource acquisition is ordered:
`governance preflight -> concurrency lease -> durable weighted/daily budget -> executor -> finally release lease`.

If the weighted/daily budget denies after the lease is acquired, the adapter releases the lease immediately. If that cleanup call itself fails, the lease expires automatically and the caller receives `cleanupPending=true`; no external side effect is authorized.

### AI-generated content and agent behavior
The current product rule remains:
- AI may draft, summarize, classify, analyze and propose.
- Deterministic code performs known arithmetic and policy calculations.
- AI output does not establish identity, consent, legal approval, payment authority, customer authorship, review truth, provider verification or a trusted timestamp.
- Sensitive actions remain approval-per-run.
- High/critical residual risk cannot be hidden behind a model confidence score.
- AI-assisted customer reviews require the real customer to approve the exact final text.

This is aligned with NIST's lifecycle risk-management approach and its current work emphasizing tested/validated guardrails, auditable rationales, graceful degradation and human oversight for higher-impact AI systems. NIST's AI Resource Center also centers testing, evaluation, verification and validation rather than treating model output as self-proving.

For generated media, C2PA 2.4 is now the current specification family reference. Content Credentials can provide tamper-evident provenance/history and signed assertions; they are **provenance evidence**, not a guarantee that the underlying statement or depicted event is true.

For consumer reviews, FTC guidance remains especially important for SONARA's review tools: fake/false reviews include reviews attributed to nonexistent people (including AI-generated fake reviewers), sentiment-conditioned incentives are prohibited, and hosting a review is legally different from turning it into the business's own testimonial/advertising. Exact-author confirmation plus separate publication/moderation authority is therefore the correct product boundary.

### Research references updated 2026-10-08
- NIST AI Resource Center / AI RMF operationalization: https://airc.nist.gov/
- NIST AI security and resilience research: https://www.nist.gov/artificial-intelligence/ai-research-security-and-resilience
- NIST AI RMF Generative AI Profile: https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf
- NIST 2026 trustworthy AI in critical infrastructure profile work: https://www.nist.gov/programs-projects/concept-note-ai-rmf-profile-trustworthy-ai-critical-infrastructure
- FTC Consumer Reviews and Testimonials Rule Q&A: https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers
- C2PA specifications and current 2.4 Content Credentials specification: https://spec.c2pa.org/specifications/

### Verification status
Focused isolated checks on this continuation: **40 passing / 0 failing** across automation governance, durable resource-budget adapter and migration-contract suites.

Not yet proven:
- actual PostgreSQL migration replay;
- exact-head full Node test suite;
- CodeQL/security workflow outcome;
- production Supabase application;
- provider/load testing;
- any customer-facing automation activation.

Those remain release gates, not implied successes.
