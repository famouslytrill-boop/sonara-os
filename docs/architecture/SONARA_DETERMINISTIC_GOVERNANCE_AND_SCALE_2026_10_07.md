# SONARA Industries — Deterministic Governance, AI Content, Customer Finance and Scaling Blueprint
**Version:** 2026-10-07.1 | **Status:** engineering proposal, partial pure-function source drafted in PR #442. NOT deployed, not legal or tax clearance.

## 0. Non-negotiable business role
SONARA Industries owns software subscriptions for Business Builder™, Creator Studio™ and Growth Studio™. Customers own their underlying business payments, rent, refundable deposits, licenses, ad accounts and rights to their own lawful content. Initial product earns **only SONARA's explicitly disclosed software fees**. No custody, pooled escrow, platform payouts, affiliate rental commissions, financial advances, wallet, payment initiator, landlord agency or money transmission claims. Client-visible "paid" = only a verified provider event when lawful integrated providers and their merchant-owned accounts exist. Otherwise label **seller-reported / unverified**. No service can guarantee zero legal liability.

## 1. Architecture: narrow, testable trust boundaries

1. **Edge/session gate**: identify human user and org from server-side session; validate access, permissions, CSRF and canonical origin; rate limit public and authenticated requests.
2. **Tenant boundary**: resolve organization and company from server-owned membership records, not from a client-supplied organizationId. Distinguish SONARA's corporate revenue books from each customer's bookkeeping. Apply private-schema RLS, revoke anon/authenticated grants; use narrowly scoped server endpoints and threat-tested tenant checks.
3. **Evidence intake**: store typed document ID, origin/source, exact cent amount, source checksum, time, version and private file object reference. No card credentials, CVV, excessive personal data, doxxing, or sensitive media in logs or prompts.
4. **Deterministic rule plane**: consult a versioned jurisdiction + business-flow rule with effective dates. Never equate a boolean from HTTP with independent validation or legal clearance. Missing law version, actor authority, model license or evidence -> unreviewed/hold.
5. **Scenario engine**: integer USD minor units and basis points, verified calendars, exact rounding, explicitly cited assumptions, cap overflow, no speculative legal interest formulas and no automatic payment decisions.
6. **Human review plane**: governed cases for legally material actions, subscription disputes, fraud reports, third-party likeness, copyright and abuse takedowns. Authenticate reviewer role, avoid same actor requesting and approving high-risk changes, record reasons and supporting evidence.
7. **Atomic durable writer**: one transaction writes state change + idempotency key + append-only activity event + outbox event; durable worker processes review alerts with retry, backoff, dead letter and deduplicated external notifications. Financial payout jobs DO NOT exist in fee-only mode.
8. **Reconciliation plane**: independently read Stripe platform Billing and company bank deposits for SONARA fees; record customer external payments only as self-reported until separate lawful provider proof. Do not treat a transaction hash as bank settlement.
9. **Monitoring/rollback**: count unprocessed urgent notices, deadline breaches, hash mismatches, review queue latency, tenant access-denied events, failed receipt matching, webhook verification failures, subscription cancellations and worker spend. Restore drills and one-tenant canaries gate releases.

**Data plane:** Node 24/API on existing hosting; PostgreSQL/Supabase as source of truth; private object storage for rights evidence; optional pgmq durable notification work queue only after migration replay + tenant-tested claims. No new GPU cluster required for launch. Audit operational history is not magic immutability: add offsite signed integrity anchors, access controls and backups before asserting tamper-resistance.

## 2. Source-of-truth datasets / SQL blueprint

**Proposed** SQL (NOT a migration): `docs/architecture/SONARA_CONTROL_PLANE_SCHEMA_PROPOSAL_2026_10_07.sql`. Ten conceptual tables:

| Table | Primary purpose | Security/authority |
|---|---|---|
| legal_rule_versions | jurisdiction, version, source digest, effective dates, actual reviewer | server-only; no model self-approval |
| review_cases | reports, valid notice time, due dates, human handling | tenant scope; statutory time anchored to actual receipt |
| case_evidence | sha256 + private object ref | evidence bytes outside SQL and public logs |
| case_event_log | sequence, event digest, actor | append-only app policy; externally anchor hash |
| media_provenance | model version, rights, likeness consent, C2PA verification status | owner control + human publisher review |
| external_customer_receipts | merchant-attested off-platform receipt only | cannot mark platform-paid or trigger deliveries |
| sonara_own_journals | SONARA's own software income, refunds, provider fees | company book, not customer revenue |
| sonara_own_journal_lines | paired debit/credit ledger rows | add deferred balancing trigger before use |
| review_outbox | retries, deadlines, human notice drafts | never charge/refund/payout event types |
| tenant_resource_budgets | AI/assets/storage/worker-second quotas | canonical entitlements + checked reservation |

The SQL is private by default and has no unrestricted authenticated-user row access. Do NOT assume `auth.uid() = organization_id`: user IDs and organization IDs are different concepts. Validate a real membership table before adding customer-facing SELECT policies. Use independent normalized subject IDs, NOT hand-built customer PII identifiers.

### Law version provenance
`{jurisdiction, rule_key, effective_from, checked_at, source_url, digest, reviewer_id, review_state}`. At any execution, match as-of date and applicable jurisdiction, do not use a stale policy. Legal status is **review-needed** if conflicting, unknown, expired, multi-state or modified documents. Merely setting a Boolean like `legalReviewRecorded=true` is not sufficient proof: require server-verified records, authentic signer identity and review of the *exact immutable document hash*.

## 3. Deterministic worktables and algorithms

**Fee-only transaction classifier:**
`operation ` -> `{sonara_own_subscription | customer_external_funds | non-money record | prohibited activity}` -> allow only SONARA hosted own-billing through billing module, otherwise external seller record (never paid) or deny. Unknown operation or funds mode -> fail closed. New connected merchant Checkout requires a separate reviewed-mode owner opt-in AND Connect feature flag, and is NOT part of launch.

**Draft commercial quote:** `total_minor = Σ(unit_minor × qty) − discount_minor + disclosed_fee_minor + verified_tax_minor + separately_disclosed_deposit_minor`. A deposit is liability, never revenue. Taxes cannot be invented: block publishing chargeable tax if authority/configuration unverified. Arithmetic does not make a tax legally due.

**Refund math:** `remaining_refundable = max_verified_receipts − prior_verified_refunds`; if proposed > remaining, flag. A passing calculation NEVER executes or promises a refund.

**Monthly business contribution:** `contribution = subscription_price − processor_fee − resource_cost − support_cost − expected_loss_reserve`; `break_even_count = ceil(fixed_cost / contribution)` only if positive. No predictive certainty.

**Scenario cohort retention:** `paid_next = paid_current − round(paid_current × assumed_churn_bps / 10000) + assumed_acquisitions`, recalculated per month. Scenario, not market prediction.

**Storage demand:** `bytes = tenants × average_assets_per_tenant_per_day × average_bytes × retention_days × redundancy_factor`. Include derivative files, video transcoding, backups and metadata as separate budget lines in operational estimates.

**Worker sizing:** `worker_capacity_per_hour = floor(3600000 × concurrent_jobs × utilization_bps / (average_processing_ms × 10000))`; `workers_needed = ceil(peak_jobs_per_hour / worker_capacity_per_hour)`. Use measured p95 processing time for serious SLOs, not optimistic mean latency.

**Ohio deposit review:** potential annual interest basis `0.05 × max(0, deposit − max($50, monthly_rent))` when statutory conditions apply. Review legal timing, type of tenancy and partial-year complexities rather than pretending this computes final statutory liability. Pending deductions remain memo entries; **full deposit liability is not reduced until a separately verified lawful final decision**.

**Content incident SLA:** for qualifying covered-platform valid TAKE IT DOWN Act notices, `deadline_utc = actual_valid_notice_received_at + 48h`. The time origin MUST be earliest actual receipt of a valid notice, not when a reviewer finally reads it. Stage urgent notifications within an internal 4h target. Human legal validity must be decided promptly; do not stall the statutory clock through slow classification. Acknowledgment, identification and actual removal of known identical copies are separate auditable actions.

## 4. AI-generated media and text — controlled, not autonomous law

### Creator Studio media workflow
`human prompt/source media -> rights/consent records -> model-terms check -> generation -> sha256 + model/source manifest -> C2PA signing (optional genuine crypto) -> human safety and copyright review -> private preview -> approved publish -> complaint & takedown workflows -> correction/removal history`.

- AI may generate assets, suggested licenses, accessible subtitles, translations, podcast outlines, social captions and contract **drafts**; no AI assertion creates copyright ownership, consent or exclusive rights.
- Model provider terms, samples, trademarks, preexisting copyrighted inputs and performers' likeness/voice approvals must be checked. For pure AI-generated material, do NOT promise copyright protection; human-authored contributions can matter.
- Track `human_authored|ai_assisted|ai_generated|mixed_human_ai`, source hashes, transformations, dates, model revision, input/output rights evidence and manual edit references.
- C2PA manifest validity is cryptographic provenance, NOT moral truth, copyright ownership or legal consent. Recording SHA-256 without actually signing a manifest does not make a C2PA credential.
- Protect minors, private people and sensitive media; human-led expedited incident workflow. No customer private contents in unattended LLM prompts without permission/retention controls.
- No paid content delivery triggered solely by an off-platform buyer redirect, "seller says paid" flag or seller-uploaded screenshot.

### AI document/legal workflow
`jurisdiction + customer facts -> vetted legal template version -> deterministic required-fields check -> optional LLM draft within fixed scope -> compare obligations to authoritative source -> legal-risk review flags -> show "UNREVIEWED DRAFT" notice -> user edits -> signed document hash if independent verified signing is later enabled`.

Output a machine-readable **issue list**, not a definitive legal opinion:
`[{clause_key, missing_fact, governing_source, jurisdiction, severity, evidence_ref, reviewer_required}]`.
The LLM never decides legality, tenant admission, financial custody, statutory waiver validity or e-sign execution. Missing counsel permits an educational unreviewed draft, but not an "attorney-approved" claim.

### Growth Studio generation
Claims and advertisements must be attributable to verified customer facts; forbid invented testimonials, fabricated financial returns or fake endorsements. If generating outbound marketing, honor applicable consent, unsubscribe, and platform requirements. Campaign spend is approved and paid by the customer in their own media provider account.

## 5. Evidence-backed review playbooks / internal skills

| Skill | Input | Deterministic output | Human owner |
|---|---|---|---|
| money_path_auditor | operation, merchant role, provider ownership, tenant | own-billing/external-only/block + reason codes | founder/security |
| document_clause_preflight | exact bytes hash, version, jurisdiction, party authority | missing terms/required disclosure and unreviewed watermark | customer; qualified counsel for regulated scope |
| media_provenance_inspector | asset digest, model/version, source and consent evidence | provenance/evidence gaps, no automatic rights certification | creator + moderator |
| incident_intake_triage | notice kind, received timestamp, supporting metadata | case priority, statutory candidate, escalation clock | trust/safety team |
| deposit_liability_guard | prior entries + pending deduction evidence | projected liability + pending memo separately | actual landlord |
| subscription_disclosure_auditor | amount, cadence, cancellation and assent evidence | missing-pricing/consent/cancel fields | SONARA billing admin |
| ledger_reconciliation | verified provider invoice, deposit and refund refs | mismatches, duplicates, missing source windows | finance owner |
| capacity_optimizer | measured p95, jobs, bytes, storage and budgets | integer size scenarios and quota alerts | infrastructure owner |

**Minimum review protocol:** rules are deterministic and versioned; all outcomes include a provenance marker, organization scope and a denial reason; requests and approvals are separate; failure to read verification evidence is "unknown", NEVER "passed"; unapproved AI-written contract remains draft. Escalate security incidents and customer rights reports, not merely count them in a dashboard.

## 6. Pricing and deployment economics

Preserve the existing $29 individual, $59 All Three and $109 Team subscriptions. Free parent/child tools do not require signup for their results and should have strict anonymous CPU/runtime quotas. Server-rendered forms, maintained templates and deterministic math cost much less than default GPU inference for every request.

Baseline launch stack: existing Node 24 + Vercel + Supabase/Auth/RLS + Stripe Billing for SONARA only + object storage + structured logs + email delivery. No new Kafka, GPU farm, multi-region database or costly real-time vector processing is justified before measurable demand. Add pgmq only for durable non-payment notifications once migration replay is clean.

Staged resource tiers are **capacity gates, not dollar quotes**:
- **0–50 paying customers:** one primary region, scheduled backup/restore tests, manual human case queue, fixed free-tool limits, basic application telemetry; no multi-tenant seller payments.
- **50–500:** tenant quota enforcement, asynchronous media queues, retry/timeout/dead-letter processing, actual usage meter, p95 dashboards, QA and abuse response on-call coverage.
- **500–5,000:** separated workers, connection pooling, object lifecycle tiering, legal source update automation, event-driven audit, provider resilient reporting; measure true infrastructure spend per active tenant.
- **5,000+:** only after proven revenue and SLOs, consider dedicated read replicas, regional isolation, DR rehearsal, signed audit anchors, specialized provider integrations and a separately reviewed optional payments product.

Never claim a headcount or resource plan can satisfy a regulatory reporting deadline without a staffed process and proven alert delivery.

## 7. Suggested customer journeys by company

**Business Builder™ restaurant/trades/trucking:** customer creates workspace -> opens catalog/job/work order -> deterministic quote/tax review -> issues externally payable invoice -> tracks customer-reported status -> independently reconciles own bank/provider record -> books actual business expense/revenue in customer ledger -> customer-controlled fulfillment. SONARA never receives money for the goods.

**Business Builder™ rental:** verified landlord account -> property-level private templates -> interest/deposit calculation -> proposed deduction memo -> owner documents legal basis and tenant notices -> landlord pays/receives via provider outside SONARA -> informational books and timeline. No SONARA rental brokerage, referral fee, tenant eligibility decision or eviction automation.

**Creator Studio™:** author/creator uploads or generates work -> rights/voice checks -> provenance -> private preview -> content incident channel -> creator personally manages payment processor and delivery -> optional later signed provider-owned verification under reviewed external account capabilities. No automatic paid licensed distribution based on hearsay.

**Growth Studio™:** user-approved campaign brief -> verifiable claims -> deterministic budget and segmentation -> rights/consent checks -> drafts -> user sends via their own platform credentials with bounded permissions -> analytics read-only reports; never spends ad funds without owner authorization.

## 8. Roadmap / release gates

**P0: release correctness** — Fix CI lint/env variable classification, ledger pending-deduction accounting, route coverage, complete Node 24/26 matrix, native migration replay, and privacy/security proof. Existing signed merchant webhooks continue reconciling pre-cutover sessions. No merge without exact-head green and explicit owner review.

**P0: protection minimum** — Publish truthful privacy, subscription/cancellation and refund disclosures once reviewed; add an intake channel for AI/media abuse, rapid valid-notice handling, DMCA designated-agent protocol if hosting qualifies, evidence-retention and staff escalations. Train operators on what reports can/cannot conclude. Consult local competent advisors on Ohio SaaS tax, property brokerage and nationwide consumer rules when expanding.

**P1: workflow integration** — Wire the draft compliance engine into authenticated routes; add versioned policy records and case RLS; use outbox and idempotent work queues; implement real human audit and opt-in service-level alerts. Establish trustworthy company Billing-to-bank reconciliation only through an authorized read-only adapter.

**P1: Creator scale** — Implement private media storage lifecycle, cost quotas, provable authorship/consent sources, a genuine C2PA signer/verifier where supported, robust media job retries, copyright and safety takedown processes, and human approval on public release.

**P2: specialist expansion** — Public property listings or leasing brokerage, merchant payment orchestration, consumer financing, custody/escrow, paid licensing automation, automated housing screening or jurisdiction-specific advice ONLY after legal review, provider risk validation, signed contracts, operational verification and separate funding.

## 9. References (engineering research starting points)
- Stripe SaaS / no-Connect model: https://docs.stripe.com/connect/saas
- Ohio brokerage definition: https://codes.ohio.gov/ohio-revised-code/section-4735.01
- Ohio security-deposit responsibilities: https://codes.ohio.gov/ohio-revised-code/section-5321.16
- Ohio taxable business ADP/information services: https://codes.ohio.gov/ohio-administrative-code/rule-5703-9-46
- FTC TAKE IT DOWN Act effective May 19, 2026: https://www.ftc.gov/business-guidance/resources/complying-take-it-down-act
- U.S. Copyright Office AI authorship: https://www.copyright.gov/ai/
- Copyright Office DMCA agent ($6 and 3-year renewal): https://copyright.gov/dmca-directory/faq.html
- NIST Generative AI Risk Management Profile: https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
- C2PA cryptographic media provenance: https://spec.c2pa.org/specifications/specifications/2.2/specs/C2PA_Specification.html
- FTC consumer-report restrictions for landlords: https://www.ftc.gov/business-guidance/resources/using-consumer-reports-what-landlords-need-know
- Supabase private-schema + RLS best practices: https://supabase.com/docs/guides/database/postgres/row-level-security
- PGMQ durability/visibility timeout (not exactly-once side effects): https://github.com/pgmq/pgmq

**No deployment, data migration, legal certification, content moderation service, human legal reviewer or customer financial transaction has been activated by writing this plan.**


## 10. Governed optional model execution: current draft code

- `lib/sonara-content-compliance-engine.cjs` + dedicated tests: deterministic case routing, candidate TAKE IT DOWN deadline based on verified valid notice receipt, separate rights and AI media evidence, and educational unreviewed contract drafting with no automatic legal execution.
- `lib/sonara-governed-ai-draft-packets.cjs` + dedicated tests: bounded metadata-only packets for six content/document outlines; only pre-approved source registry identifiers; optional provider model revision; explicit refusal of unbounded or sensitive fields; untrusted model output validation; mandatory human review and no automatic public release.
- `lib/sonara-deterministic-capacity-planner.cjs` + dedicated tests: exact-integer scenario calculations for churn, acquisition, replicated storage, queued processing capacity and monthly subscription contribution.
- `lib/sonara-lease-ledger.cjs`: pending deductions are memo-only and no longer reduce draft security-deposit liability; a final deduction requires a **separate lawful settlement design** and cannot be inferred from a memo.
- `tests/sonara-control-plane-schema-proposal.test.js`: static checks on the ten-table SQL proposal, privacy-first grants, review case shape, resource quotas and customer money separation.

**Go-live constraints:** These are pure functions and design artifacts. No authenticated router/writer, live model adapter, legal reviewer, approved policy registry, licensed provider connection, queue, or SQL migration has been activated. A successful static check only verifies source expectations; it is not PostgreSQL syntax validation, RLS replay, bank confirmation, proof of copyright ownership or an attorney opinion.
