# SONARA leasing, rental and licensing risk controls — research draft

**Status:** research and engineering specification; **not attorney-reviewed; not a production compliance engine**.
**Checked:** 2026-10-06 (America/New_York). **Applies to:** Business Builder property/rental/equipment workflows, Creator Studio licensing and marketplace, Growth Studio marketing, and the SONARA platform.
**Owner gate:** No publication of legal terms, launch of regulated workflow, automated adverse action, movement of client funds, or production activation is authorized by this document.
**Scope warning:** Leasing real property, leasing goods, short-term lodging, and licensing intellectual property are four distinct legal transactions. Do not collapse them into one “lease” workflow. Laws depend on property location, transaction type, customer status, and governing jurisdiction.

## 1. Immediate operating rules

1. **Identify transaction and location before showing a contract.** Ask: (a) residential real estate, commercial real estate, short-term lodging, vehicle, other equipment, or digital/content license; (b) state/local jurisdiction; (c) consumer or business; (d) owner, landlord, authorized broker, or marketplace operator; (e) possession/use versus transfer of intellectual-property rights. Unknown or unsupported combination = review_required, not approved.
2. **Keep SONARA a software provider unless the business model is intentionally changed and cleared.** Do not represent SONARA as a real-estate brokerage, credit reporting agency, escrow company, insurance provider, attorney, or licensed lessor. Customers remain responsible for underlying property/business conduct; SONARA remains responsible for its own software practices and legal obligations.
3. **No unlawful discrimination or automated tenant rejection.** Standardize eligibility criteria; review local protected classes; allow disability accommodation requests; do not infer protected characteristics. A human must decide any consequential screening result. When a consumer report contributes to adverse action, the landlord needs appropriate FCRA notice.
4. **Show the full price before commitment.** Display recurring rent, required recurring fees, one-time fees, refundable deposits, late fees, taxes, renewal rules, termination/return conditions, and refund consequences; distinguish optional from unavoidable charges. Maintain quote snapshots and consent receipts. Do not optimize through hidden charges.
5. **Separate deposits, rent, fees, and payment settlement.** Model each as a distinct ledger entry. Do not promise custody/escrow or release of funds without verified provider agreement and legal authority. Never store card PAN or CVV.
6. **Do not generate eviction/self-help instructions or take automated lockout actions.** Route contested nonpayment, default, early termination, repossession, or eviction to owner/counsel. Notice drafts require human approval and current jurisdiction-specific validation.
7. **No pricing coordination between competing landlords.** Do not use competitors’ nonpublic rents, current occupancy, strategy, or real-time deal data to recommend coordinated pricing; prohibit shared optimization loops across tenants. Pricing must remain independently set.
8. **Contracts must state capacity and actual rights.** Verify owner/title or authorized agent; store contracts and time-stamped signatures with a versioned terms snapshot; do not promise an e-sign workflow is legally sufficient for every transaction without counsel.
9. **Design for accessibility, privacy, and evidence.** Minimize sensitive screening data, encrypt and restrict it, retain only for approved periods, and provide dispute/correction workflows. Require organizational RLS and audit records, not just UI hides.
10. **No blanket “legally compliant” output.** Permitted states: reference_only, needs_location, blocked_pending_review, review_required, implementation_verified, externally_reviewed. None equals a certification or legal opinion.

## 2. Legal rules to parameterize — Ohio and Columbus examples (not universal rules)

| Rule/source | Engineering control | Release condition |
| --- | --- | --- |
| Ohio residential landlord-tenant law (ORC Chapter 5321, especially §§5321.04, 5321.16) | Repair/entry/notice checklist. Security-deposit workflow with documented itemized deductions and 30-day accounting/return window after termination and delivery of possession; calculate statutory interest when applicable to qualifying excess deposits and tenancy length. | Counsel verifies applicability, exceptions, and local overlays. |
| Ohio residential entry (ORC §5321.04(A)(8)) | Give reasonable advance notice of entry except emergencies/impracticability; 24 hours is presumed reasonable under Ohio law; capture notice and purpose. | Owner/broker review; do not use a nationwide 24-hour rule. |
| Columbus source-of-income protection (City §4551.03) | Do not reject a qualified applicant merely because they use an eligible subsidy or voucher; apply voucher-adjusted rent in relevant income-threshold calculation. | Only after jurisdiction verifies City of Columbus coverage. |
| Columbus Renter's Choice (§4551.04) | For covered operators (generally 5+ rental units), support required written notice and allowable deposit installment alternatives before lease. | Confirm operator qualification and exact alternatives with counsel. |
| Columbus rent/payment terms and receipt protections (§4551.05 and §4551.06, as applicable) | Show all monthly/periodic required charges in leases to which post-2025 rules apply; correctly allocate covered payments and produce evidence of receipts; verify local text before implementation. | Local-counsel verified. |
| Columbus >10% rent increase (§4551.071) | For covered written leases entered into/renewed after 2025-01-31, include clause requiring at least 60 days' prior written notice of a periodic/monthly increase above 10%; capture delivery evidence. | Confirm location, lease cohort and exact statute. |
| Federal Fair Housing Act; local civil-rights rules | Fair housing protections; accessible accommodation process; protected-attribute minimization; human review of adverse outcomes. | Fair-housing attorney review; test adverse-impact risks. |
| Federal FCRA (FTC landlord guidance) | Permissible-purpose verification for tenant screening; vetted consumer-report vendor; adverse-action notice workflow (CRA contact, dispute/free-report rights; additional data for credit-score use); correction intake. | Vendor contracts and legal review; no unlicensed consumer reporting business. |
| EPA pre-1978 lead-paint disclosure rule | For applicable residential property, collect construction-year and signed lead disclosure/pamphlet evidence before agreement; exceptions are conditional. | Qualified local property/legal check. |
| City short-term-rental operations (Columbus Chapter 598 and license office) | Licensing/permit + zoning + lodging-tax and operator rules validated before listings/bookings in relevant localities; show not_launchable otherwise. | Actual permit, tax, registration and provider verification. |
| Ohio lease-of-goods UCC Article 2A (ORC Chapter 1310) | Differentiate a goods lease from security interest / sale; item identification and term; written/signed record for relevant contracts; damage/warranty/return options. | **Changed effective 2026-10-06 under HB 195:** fresh statute and counsel review required before equipment/vehicle templates. |
| Federal Consumer Leasing Regulation M (12 CFR Part 1013) | Classify covered consumer personal-property leases separately; calculate and display required payment, term, early-termination, purchase-option and advertising disclosures. | Qualified consumer-finance/legal review. Do not apply to residential real-estate leases. |
| Ohio real estate brokerage licensing (OAC 1301:5-5-07; ORC Chapter 4735) | Distinguish the property owner's decision and properly authorized licensed broker from clerical assistants and SONARA software; do not let unlicensed service agents negotiate or approve leases on another's behalf. | Legal/real-estate regulator review. |

The Columbus overlays above apply only within the relevant municipal jurisdiction and subject to their exact scope; Ohio law is not a substitute for Columbus/local rules. The city limits must be established from authoritative jurisdiction data, not an IP-based geolocation guess.

## 3. Leasing operations architecture

**Domain types:** residential_real_estate, commercial_real_estate, short_term_stay, vehicle_lease, equipment_lease, equipment_rental, digital_content_license. Do not reuse residential eviction, deposit, or consumer-report logic for other types.

**Proposed records (names are design-only, not existing deployed tables):**

- lease_jurisdictions: jurisdiction_id, state, municipality, effective_from/to, source_url, verified_on, reviewer_identity, rule_set_version, approval_status.
- lease_subjects: organization_id, property_or_asset_id, legal_owner_id, address/location, transaction_class, zoning/permit references, evidence_status.
- lease_terms_versions: template_id, version, transaction_class, rent/payment schedule, mandatory fees, refundable deposits, allowed notice periods, renewal/early-termination rules, signatures/evidence hash, legal_review_status.
- lease_screening_decisions: application_id, organization_id, criteria_version, reviewer_id, report_vendor/reference, permissible_purpose_receipt, action_type, notice_due_status, dispute reference. **Keep source reports out of ordinary analytics.**
- lease_deposit_ledger: organization_id, contract_id, payment processor reference, deposit principal, legally applicable interest rule/version, deductions with evidence, amounts returned, deadline, reconciliation status. Funds custody is a separate regulated question.
- lease_notices and lease_audit_events: template version, recipient, delivery channel, timestamp, delivery receipt, immutable audit actor, outcome and challenge status.
- lease_regulatory_approvals: rule_set_version, specific legal scope, named reviewer, review date, expiration/recheck date, decision (allowed/blocked), evidence location.

Tenant-level row-level security, data minimization, encryption at rest/in transit, integrity protection, audit reads, export/retention and idempotent settlement are mandatory. Never add these tables until a migration has been reviewed, replay-tested against a disposable DB, and proven cross-tenant safe.

**Workflow:** choose transaction → resolve authoritative jurisdiction → verify actor/permit/ownership → show documented price and disclosures → accept application only if permitted → authorized screening decision and any mandated notices → counsel-approved terms → explicit signatures → payment provider settlement → occupancy/pickup → maintenance/inspection → renewal/return → deposit reconciliation → retention/deletion.

**Stop signs (default BLOCK/REVIEW):** unknown jurisdiction; unknown actor's authority; missing permits for regulated short-term stays; missing applicable disclosures; unchecked fair housing/FCRA obligations; unreviewed local lease clauses; attempts at automated eviction/rejection; unverified funds custody; missing owner approval; cross-tenant signals in rent-recommendation data.

## 4. Test specification (future work, not executed here)

1. Columbus voucher applicant with valid subsidy cannot be rejected merely for subsidy; income check uses voucher-adjusted share where required.
2. Columbus covered 5+ unit operator cannot finalize lease without Renter's Choice notice/alternatives; excluded operator follows reviewed exception.
3. A qualifying Ohio security deposit generates interest assessment and 30-day return workflow; avoid a universal deposit-interest rule.
4. FCRA report-influenced rejection or adverse conditions generate correct notice evidence and allow dispute; no automatic denial.
5. Pre-1978 housing requiring lead disclosure cannot reach signature without completed required evidence.
6. A proposed Columbus rent increase above 10% triggers rule/version and 60-day notice check for covered leases.
7. An equipment finance lease and a simple short-term tool rental produce different disclosures; consumer leases check Regulation M when covered.
8. Unknown location or outdated legal review blocks agreement execution instead of silently selecting Ohio defaults.
9. One tenant cannot access another tenant's applicants, credit histories, leases, deposits or pricing. Ensure anonymized telemetry contains no applicant reports.
10. Cross-landlord nonpublic occupancy or live pricing cannot feed recommendation features. Price output has tenant-local data provenance.
11. Duplicate payment/webhook cannot double-charge or double-return deposits; failed provider settlement is reconciled.
12. Owner/operator and counsel approvals cannot be forged via request parameters or prompt/agent outputs.
13. A public rental listing never claims an unverified short-term rental permit.
14. All source timestamps and effective dates are versioned; a change triggers re-review and snapshot preservation for signed agreements.

## 5. Separate software/content licensing controls (not property leasing)

SONARA already has: docs/legal/OPEN_SOURCE_LICENSE_POLICY.md, data/license-policies.ts and scripts/check-license-risk.mjs. Keep them authoritative for present policy; do not treat a source code repository's public visibility as an open license.

- Dependency evidence: source repository, SPDX identifier, license text and NOTICE obligations, exact version/commit, transitive graph, copyright attribution, vulnerability and maintenance checks, human signoff and software bill of materials.
- MIT/BSD/Apache-2.0: commercial use is often permissible but preserve required notices and review patent/attribution obligations.
- GPL/AGPL/LGPL/MPL/dual licenses: route to legal review rather than auto-rejecting all use or assuming “SaaS makes it safe.” AGPL modified network-server usage can impose source-offer duties; actual triggers depend on use and combination. A container/process boundary is not a magic license exception.
- AI models: model **weights and datasets** have independent licenses/acceptable-use rules; a GitHub code license does not automatically license weights, voices, video, music, or training data. Commercial use requires affirmative permission when restricted.
- Creator marketplace: seller identity and rights attestation per asset; contributor permissions; separate reproduction, synchronization, public performance, derivative, redistribution, resale, sublicensing and territorial rights as relevant. A customer paying for a “license” does **not** prove the seller held the underlying rights.
- Platform content takedowns: counsel to establish applicable DMCA safe-harbor posture, public designated agent, Copyright Office registration where required, notice/counter-notice, repeat infringer policy, restoration/dispute steps and records.
- No publishing, payouts, public licensed delivery, or third-party rights grants unless the rights graph, payment settlement, licensing terms, and owner approvals are all verified in runtime.

## 6. Release and ownership gates

**P0 before any live leasing product:** named compliance owner and local counsel; verify actual intended cities/states and product types; review housing discrimination/tenant screening; show real total price and terms; define bank/payment role; prove audit, access restrictions and no automated legal decisions.

**P1 engineering:** data model and RLS in preview DB; signed versioned agreement templates; jurisdiction policy catalog with source links/review dates; deposit/notice schedulers; permitted broker/owner role matrix; screening adverse-action templates; provider payment reconciliation; proof-oriented tests.

**P2 rollout:** dry-run with licensed partners; resolve short-term rental jurisdiction packs individually; stress-test payment collisions and cross-tenant data; external privacy/security review; establish law-change cadence; legal signoff per launch jurisdiction.

Every jurisdiction-specific rule must store citation, effective date, review date, owner and test IDs. **Do not mark a jurisdiction compliant solely from passing tests.** A tested feature is implementation evidence; it is not a legal opinion.

## 7. Research sources checked 2026-10-06

- Ohio residential law, ORC Chapter 5321 and §5321.16: https://codes.ohio.gov/ohio-revised-code/chapter-5321 and https://codes.ohio.gov/ohio-revised-code/section-5321.16
- Ohio landlord duties and entry: https://codes.ohio.gov/ohio-revised-code/section-5321.04
- Columbus housing ordinance §§4551.03–4551.071: https://library.municode.com/oh/columbus/codes/code_of_ordinances?nodeId=TIT45HOCO_CH4551REOWOC
- HUD Fair Housing: https://www.hud.gov/program_offices/fair_housing_equal_opp/fair_housing_rights_and_obligations
- FTC tenant reports/FCRA: https://www.ftc.gov/business-guidance/resources/using-consumer-reports-what-landlords-need-know
- EPA lead disclosures: https://www.epa.gov/lead/real-estate-disclosures-about-potential-lead-hazards
- Columbus short-term rental licenses: https://www.columbus.gov/Business-Development/Business-Licenses-Resources
- Ohio goods leases effective 2026-10-06: https://codes.ohio.gov/ohio-revised-code/chapter-1310
- Ohio leasing vs security interest: https://codes.ohio.gov/ohio-revised-code/section-1301.203
- Ohio brokerage staffing exemption: https://codes.ohio.gov/ohio-administrative-code/rule-1301%3A5-5-07
- CFPB Consumer Leasing Regulation M: https://www.consumerfinance.gov/rules-policy/regulations/1013/
- DOJ housing pricing collusion enforcement: https://www.justice.gov/opa/pr/justice-department-requires-realpage-end-sharing-competitively-sensitive-information-and
- MIT/Apache/GPL/AGPL rights comparison: https://choosealicense.com/licenses/
- Copyright Office DMCA directory: https://copyright.gov/dmca-directory/

**Verification limit:** Sources are public research, not legal advice. Municipal rules, pending federal rulemaking, interpretation, jurisdiction, exceptions, contract forms, and business model must be verified by qualified counsel before any real-world transaction. This document makes no assertion that the current SONARA app already enforces the proposed rules.
