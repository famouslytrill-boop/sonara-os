# SONARA Industries — customer-money protection, contracting and fraud controls

**Status:** engineering controls under draft PR #442. Not legal advice, not an attorney-reviewed contract, not a license, not a customer-visible legal page, not a posted financial ledger, and not proof of live processing. Reviewed against sources on **2026-10-06**.

**Applies across:** SONARA One (platform), Business Builder (invoices, storefront, rentals, equipment, POS), Creator Studio (media rights, licensed marketplace), Growth Studio (advertising budgets, marketing spend), subscription billing, credits and future vertical packs.

## A. The company's non-negotiable payment boundary

There are three *different* kinds of money, not one shared SONARA wallet:

| Money owner / transaction | Intended provider path | Accounting classification | What remains blocked |
| --- | --- | --- | --- |
| SONARA SaaS subscription | Stripe-hosted platform billing | SONARA subscription revenue and fee liabilities | Undisclosed renewals, charges without consent, payouts to tenants |
| Business Builder customer invoice | **Direct charge** on the business's verified Stripe connected account | That business's payment evidence; SONARA does not claim to own proceeds | Redirected payee/bank details from email, buyer forms or prompts |
| Storefront checkout | Verified business's connected account | Merchant order + payment, shipping and return reconciliation | Unreconciled paid orders and hidden fees |
| Creator licensed digital sale | Verified seller's connected account, zero platform commission in current design | Seller sale + buyer license, rights and delivery receipts | Selling rights without proof, public payout claims |
| Rental rent | Jurisdiction-specific approved **future** connected-account flow | Rent and legally required allocation/receipts | Automated tenant screening denial, eviction or unapproved payment |
| Refundable lease security deposit | Regulated deposit handling must be approved **before** actual money moves | **Customer liability**, not SONARA or landlord revenue | Spending, pooling, misleading “escrow”, unapproved deductions |
| Equipment/vehicle lease | Licensed/reviewed provider route where appropriate | Lease obligation distinct from ordinary equipment booking | Consumer Regulation M and Article 2A requirements left unchecked |
| Growth ad/marketing spend | Owner-approved external provider account and billing | Cost in the subscribing customer's business | Spending from pooled balances or an unauthorized marketing campaign |
| SONARA usage credits | Subscription/credit entitlements with priced limits | Entitlement usage record; deferred-revenue/tax classification needs accountant | Treating usage credits as transferable cash or cryptocurrency |
| Wallet, P2P transfers, escrow, merchant advances | **Not enabled** | Regulated activity requiring different authorization/business model | All movement and public product claims |

**Critical corrected fact:** Using *direct* Stripe Connect charges generally keeps a seller's payments on its connected account instead of first posting them to a platform charge; it **does not automatically eliminate SONARA's loss liability**. Depending on Connect account terms, disputes, reserves, refunds, and connected-account negative balances may still affect the platform. Nor does using a third-party processor prove a money-transmitter exemption: FinCEN's payment-processor analysis is fact-specific, with conditions. Counsel must review any funds-handling model, state licensing, Stripe agreements, commercial contracts, and OFAC sanctions obligations. [Stripe direct-charge issues](https://support.stripe.com/questions/what-should-i-know-about-using-direct-charges?locale=en-GB); [Stripe Connect negative balances/reserves](https://support.stripe.com/questions/reserves-for-connect-platforms-and-connected-accounts); [FinCEN payment-processor facts](https://www.fincen.gov/resources/statutes-regulations/administrative-rulings/application-money-services-business); [FinCEN software-only distinction](https://www.fincen.gov/resources/statutes-regulations/administrative-rulings/application-fincens-regulations-virtual).

## B. Source-of-truth money journey (intended, not live in this PR)

1. **Identity and authority:** Identify authenticated organization, owner/finance role, verified seller Stripe account, customer identity/consent and exact business/contract. Client, webhook metadata or model suggestion never supplies authoritative payee/account/price.
2. **Quote:** Save priced line items, quantity, required fees, currency/minor-unit precision, tax-provider evidence, refundable deposits, discounts and quote expiry. Never silently classify a deposit or collected tax as revenue.
3. **Agreement:** Snapshot jurisdiction, purpose, legal version, licensing/landlord rights, renewal/deposit/refund/notice terms, acceptance method, support, customer-accessible copy and disclosure receipt. Never auto-sign, forge consent, or imply attorney approval.
4. **Provider checkout:** Authenticated server verifies current connected-account eligibility and opens processor-hosted checkout on **the exact seller account** (platform account only for SONARA's own subscriptions). Idempotent request key and amount/currency checks; no raw PAN/CVV in SONARA.
5. **Webhook evidence:** Verify Stripe signature, event/account/amount/currency/order/buyer as applicable, event age, provider id, replay uniqueness and secure processor ownership. *Checkout success redirects cannot settle an order.*
6. **Atomic append-only posting (not yet built):** One database transaction locks the relevant organization and provider-event row, checks idempotency and tenant scope, atomically writes balanced debit/credit rows and a settlement link, records source provenance and audit, and commits. On failure: no partial entries.
7. **Customer-visible statement:** Reveal *exactly what is known* (pending, failed, partially paid, paid per verified processor, overpayment requiring review, refunded, disputed, or unknown). Provider “succeeded” does not by itself mean bank funds are available.
8. **Disputes/refunds:** Verified evidence and owner approval; avoid silent reversals, display dispute escalation/rights, preserve original journal and post a compensating entry only after external verification.
9. **Independent reconciliation:** Compare the processor's complete, paginated events with internal events by provider account/organization/payment id/currency/amount/status. Then separately compare payouts/fees/reserves to actual processor balance transactions and bank statements. Never claim full reconciliation from partial event lists.
10. **Retention and accountability:** Role-scoped immutable history, retention schedules and lawful holds; minimize personal/financial data; periodic backups/restore tests; incident-response procedures; independent hash anchoring if tamper evidence is desired.

**Fraud priority:** a changed beneficiary, payout account, owner identity, checkout origin, linked bank, or connected account is high consequence. Quarantine the attempt, notify the rightful account owner through an **existing verified contact route**, require step-up authentication and independent confirmation, log who approved, and only then allow a separate reviewed production action. Email/DM changes alone are **never authority**.

## C. Engineering work included in draft PR #442

- `lib/sonara-lease-ledger.cjs` from first pass: draft/unposted balanced journals, tenant and source-event shape checks, chain integrity, refundable deposit projection. **A declared `verifiedByServer` field is not a cryptographic provider signature.** The module has no money-changing callers.
- `lib/sonara-lease-policy-gates.cjs` from first pass: jurisdiction/actor/legal readiness preflight for housing, goods, lodging and media with no execution permission.
- `lib/sonara-rental-customer-protections.cjs` from first pass: draft Columbus rent-first payment allocation and deposit installment choices; no payment changes.
- **NEW:** `lib/sonara-money-pathway-guards.cjs`: explicit cross-suite money-pathway matrix, tenant and payee mismatch screening, high-risk destination changes, banned unlicensed financial flows, processor-vs-app per-event comparison, source evidence completeness, duplicate, refund and dispute checks. Outputs are **advisory/draft**, never spend authority.
- **NEW:** `lib/sonara-contract-evidence-gates.cjs`: agreement type, party authority, exact text/version digest tied to counsel review, required clause categories, price and remedies, E-SIGN consent and ability to retain a copy. Outputs a **draft document hash, not a signature**.
- **NEW:** `lib/sonara-financial-scenario-math.cjs`: cent-accurate quote totals that preserve refundable-deposit separation, refund arithmetic ceilings without refund initiation, contribution margin/break-even projections without guarantee.
- **UPDATED:** `lib/sonara-connected-payments.cjs` source comment clarifies direct-charge loss and licensing exposure instead of claiming registration obligations are automatic.

**No new runtime routes, SQL migrations, customer legal pages, payments, webhooks, KYC/sanctions provider calls, model activation, or production database modifications were created.** These controls become useful only when wired to server-side authorization and externally verified evidence.

## D. Agreement & contract design gates — counsel must author final text

**1. SONARA customer SaaS agreement (parent and three studios):**
Identify contracting entity, features and limitations, plan price/usage budget/credit expiration, clear trial/renewal/cancellation terms, refunds, payment method, support, acceptable use and account suspension, account data export/retention/deletion, tenant boundaries, third-party processors, limitations/warranties subject to law, accessibility, choice of law, and version-change notice. Refund terms must match real Stripe configuration. No “unlimited AI” or claimed certification.

**2. Business-owner merchant/connected-payment addendum:**
Clarify seller as merchant of record where true; separate platform vs connected-account fee obligations; loss/chargeback liability per the actual Stripe agreement; payouts controlled by provider, not SONARA; KYC/KYB and beneficial-owner requirements through provider; truthful tax/remittance responsibilities; suspicious payments/dispute/chargeback handling; supported refunds; incident notice; restrictions on unlicensed money movement. Do not promise protection from Stripe reserves.

**3. Creator Studio seller and buyer license terms:**
Verify identity and original/licensed source, authorized sale and exact grant (reproduction, derivative, distribution, commercialization, duration, territory, exclusivity and sublicensing), ownership reserved vs transferred, notices/takedowns/counter-notices, delivery guarantee only after verifiable settlement, revocation/dispute/refunds and data retention. Disclaim unsupported chain-of-title or AI-generated output ownership certainty.

**4. Residential and commercial leasing template pack:**
Jurisdiction-scoped landlord/agent authority, legal description/address and occupancy/term, rent schedule, mandatory recurring charges and tax, deposits/interest/return/deductions, maintenance/entry, notices, late fees, payment allocations, renter's-choice alternatives where applicable, fair-housing/source-of-income and accommodation handling, lead-paint applicability, screening adverse-action process, renewal/rent-increase clauses, dispute remedies and required signatures. Template is not a license to broker/evict and not final without local counsel.

**5. Equipment / vehicle lease or short-term rental:**
Asset serial/VIN where relevant, insurance/liability, delivery/pickup and physical condition, use/maintenance, deposits, loss/damage evidence, rental vs lease-finance classification, consumer advertising disclosures/Regulation M when covered, taxes, return, default, repossession restrictions and local regulatory permits. Do not relabel a loan to evade lending rules.

**6. Growth Studio ad spending approval:**
Customer provider account and billing ownership, spending cap, campaign scope, authentic consent, approved creatives and rights, charge/fee forecasting vs actual provider bill, pause/stop/refund limits, anti-spam/CAN-SPAM/TCPA/CASL as applicable, independent platform compliance and marketing data permissions. A campaign recommendation is not permission to spend.

**7. Other essential documents:**
Privacy + DPA/subprocessors, security/incident response, retention/deletion, dispute escalation, acceptable use, platform/seller policies, verified consent and electronic disclosure choices, accessibility, business continuity and evidence preservation. Legal counsel must align public terms to actual runtime controls and state/federal law.

### E-SIGN consent cannot be inferred
Federal E-SIGN Act 15 U.S.C. §7001 and Ohio UETA Chapter 1306 govern relevant electronic agreements/records. Where consumer law mandates a disclosure in writing and electronic delivery is selected, additional affirmative consent, paper/withdrawal information, hardware/software and retention/access requirements can apply. A checkbox and hash are **not automatically legally sufficient**. Our draft evidence gate requires these facts to be provided for review but **never signs anything**.
Sources: [15 U.S.C. §7001](https://www.govinfo.gov/content/pkg/USCODE-2024-title15/html/USCODE-2024-title15-chap96-subchapI-sec7001.htm), [Ohio UETA](https://codes.ohio.gov/ohio-revised-code/chapter-1306).

## E. Illegal activity, AML and customer-protection controls

**Fraud:** fake orders, refund abuse, seller impersonation, payment redirection, false occupancy/returns, duplicate webhooks, account takeover, sanctioned persons, unlicensed remittance, fraudulent chargebacks, stolen payment cards, identity theft and prohibited content sales. Rule signals warrant **human review**, not punishment or an accusation. Preserve appeal and error-correction routes and do not discriminate using protected classes or proxies.

**Risk-based compliance:**
- FINCEN: money transmission and exemption depend on the actual activity, agreements and clearing/settlement structure, not a “we use Stripe” slogan. Stop unreviewed stored value, wallets, loans, platform-managed payouts and P2P.
- OFAC: sanctions screening and prohibited-transactions assessment where applicable, risk-based controls, testing, documented escalation and training. Supplier screening does not replace an organizational sanctions compliance program. [OFAC guidance](https://ofac.treasury.gov/system/files/126/instant_payment_systems_compliance_guidance_brochure.pdf).
- CFPB Regulation E (12 CFR 1005): evaluate **whether SONARA or a connected provider actually offers covered electronic-fund-transfer or prepaid consumer accounts**; don't claim all SaaS invoices are Reg E financial accounts. When covered, error-resolution, disclosure, receipts and unauthorized-transfer protections may apply. [Reg E](https://www.consumerfinance.gov/rules-policy/regulations/1005/).
- FTC Red Flags Rule: determine whether SONARA/customer businesses meet statutory covered creditor/account definitions before claiming it applies. If covered, implement a written identity theft prevention program. [FTC Red Flags guidance](https://www.ftc.gov/business-guidance/resources/fighting-identity-theft-red-flags-rule-how-guide-business).
- FCRA and housing discrimination: no algorithmic adverse action without authorized review and legally required notices. [CFPB tenant screening](https://www.consumerfinance.gov/ask-cfpb/what-should-i-do-if-my-rental-application-is-denied-because-of-a-tenant-screening-report-en-2105/).
- FTC deceptive billing/advertising: avoid hidden recurring fees, fake urgency or misleading marketing and use meaningful opt-in, transparent billing and a functional cancellation path. Relevant legal requirements need current counsel review.
- PCI data handling: stay on processor-hosted payment collection and never store PAN, CVC, or unsupported sensitive identifiers.

## F. Database and production implementation — explicitly NOT COMPLETE

**Future append-only schema proposal (requires a separate reviewed new migration):**
`money_flows` (tenant, contract, flow/type, seller acct, currency, idempotency/status); `financial_journals` (tenant, source, immutable hash, atomic sequence); `financial_journal_lines` (tenant, journal, account and debit/credit minor units); `payment_provider_events` (provider account + event unique in tenant and provider, signed event verification receipt); `money_reconciliations` (complete pagination cursor, provider and bank statement reference, mismatches, reviewed at); `money_disputes` (case, type, disputed amount, human owner, deadlines and status); `money_safety_holds` (reason, scope, expiry, approver and release receipt); `contract_versions` (legal exact version and review scope); `contract_consents` (specific party, medium, consent evidence, withdrawal); `cash_reserves` (currency, connected-account reserve and loss exposure) **as external-account observations, not cash held by SONARA**.

**Security and correctness criteria:** tenant RLS plus service-role explicit ownership; connected-account foreign keys; unique event/idempotency constraints and partial-uniqueness where applicable; debit = credit per posted journal enforced by **transactional database logic**; full decimal precision via bigint/numeric SQL (do not mix floats); original event immutability and compensating corrections; no writes for client-side confirmation; approvals separate from accounting state; signed-provider payload verification and duplicate/event-order handling; external settlement/payout/fee linkage; encryption/access audit; idempotent retries; failure recovery and back-up/restore drill; adverse-action and consent retention.

**Required tests before deployment:** webhook replay/out-of-order, ambiguous provider data, cross-tenant insert/read/delete, partial processing and concurrency races, wrong connected account, duplicate refund, refund > paid, dispute reversal, payout reserve/negative balances, app/processor/bank mismatch, currency precision, deposit-vs-revenue separation, statutory notice expiry, unsigned consent, business-owner transfer approval and audit, incomplete pagination, accessibility and export, approved contract hash immutability. No migration on production without backup, disposable native replay, exact-head CI evidence and owner approval.

## G. Finance formulas and customer experience

**Draft payable quote** = sum(unit quantity × price) − explicit discount + required fees + reviewed applicable tax + refundable deposit; disclose refundable deposit **separately**. Sale/lease charges and deposit liability must not be merged in revenue reporting.

**Unrefunded arithmetic ceiling** = verified original receipts − previous valid refunds (subject to processor/reconciliation proof). Reject proposal when new proposed refund exceeds this arithmetic ceiling; refund still requires owner approval.

**Monthly customer contribution** (scenario only) = monthly price − per-customer service cost − per-customer payment/provider cost − assumed refunds/fraud loss allowance.

**Break-even customer count** (scenario only) = ceil(monthly fixed costs ÷ positive per-customer contribution). If contribution <=0, report no positive break-even customer count. Never advertise speculative projection as actual ROI or guaranteed income.

**Customer-facing statuses:** confirmed/pending/unknown must be distinct; show dispute or overpayment liabilities, provider-reported success vs actual payout/settlement, optional paper agreement choices, deposit refund due date and itemized deductions where law requires, transaction receipt and support route, account changes requiring verified contact, tenant-screening appeal and correction.

## H. Activation plan

**P0:** legal/commercial review of actual Stripe connected accounts and service agreement/loss liability; determine whether platform owes reserves; attorney-reviewed jurisdiction legal packs and actual contract clauses; source-of-truth payee design; schema and atomic writer/RLS tested; verified webhook+bank reconciliation; incident/dispute process and customer terms aligned.

**P1:** risk queue/dashboard and owner step-up; consent/version approval; source-based OFAC/KYB integrations if business model needs them; transaction evidence export/backup and monthly financial audit; event retry/dead letter monitor; connected-account risk limit/reserve controls. Risk classification must have meaningful false-positive review.

**P2:** regulated expansion only after applicable licenses/provider approvals: escrow/stored value, lending, financing, remittances, insurance, and additional jurisdictions/currencies. Do not automatically turn exploratory widgets into regulated business lines.

**Verification status at commit:** isolated unit logic checks executed for new modules; complete repository Node24 test suite, security gates, migrations and live connected-payments journeys **not verified**. Merge/deployment and real processing remain separately gated.


## I. October 7, 2026 follow-up — legal accuracy and finance hardening

**The objective is not “zero legal faults” as a warranty:** neither software, checklists, contract disclaimers, LLC structures, liability clauses, payment-provider outsourcing nor a single attorney letter can guarantee no legal exposure. The product should instead map duties to owners, refuse unverified high-consequence actions, preserve complete evidence, offer notice/appeal/recovery pathways, and prove each technical safeguard works in a real supported jurisdiction. Qualified counsel, a licensed accountant and insurer should approve separate professional exposures.

### Newly verified official authority

- Ohio §5321.16(A): the portion of a residential security deposit above the **greater** of $50 or one month's periodic rent bears **5% annual** interest if the tenant stays in possession **six months or longer**, computed and paid annually. Return, lawful deductions and forwarding-address rules are distinct provisions in §5321.16(B)-(C). Source: https://codes.ohio.gov/ohio-revised-code/section-5321.16
- CFPB Regulation M, **12 CFR 1013.2(e)**: during **calendar 2026** the indexed threshold is **$73,400**; ordinary covered consumer leases of personal property are generally for a natural person primarily for personal/family/household purposes and a lease period over four months. Official commentary explains that **month-to-month leases with a penalty for not continuing beyond four months can be treated as longer**, and that the transaction's total contractual obligation requires careful calculation. Check the lessor/arranger definition and exceptions, not just the customer's term or monthly payment. Source: https://www.consumerfinance.gov/rules-policy/regulations/1013/2/
- FTC guidance: when a tenant consumer report partly informs an adverse action, **higher deposits, higher rent or requiring a co-signer** can require FCRA notice, not just outright rejection. Notice content includes CRA name/address/telephone, that the CRA did not make the decision, the right to dispute, and the right to a free copy within 60 days. Source: https://www.ftc.gov/business-guidance/resources/using-consumer-reports-what-landlords-need-know
- Stripe: direct charges typically put negative transactions on the connected account, **but the platform may still bear connected-account negative balance risk depending on actual configuration**. Inspect Accounts v1 `controller.losses.payments` or v2 `defaults.responsibilities.losses_collector` from verified provider account data; legal/finance review remains necessary. Source: https://docs.stripe.com/connect/risk-management
- FinCEN's payment processor exemption has **factual conditions**, including a settlement system, formal agreement and seller/creditor relationship; merely labeling SONARA “software only” or using an external payments provider is not a legal conclusion. Source: https://www.fincen.gov/resources/statutes-regulations/administrative-rulings/application-money-services-business
- E-SIGN 15 U.S.C. §7001(c) requires appropriate affirmative consent and access/retention disclosures when covered mandatory consumer written disclosures are delivered electronically; even then electronic validity does not erase other legal duties. Source: https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section7001&num=0&edition=prelim

### Security gaps found and tightened

1. **Reviewed text alone did not bind changed prices.** The first draft's counsel approval recorded only a body hash. This was vulnerable to a fee or cancellation-flag change outside the immutable prose. `lib/sonara-contract-evidence-gates.cjs` now requires `approvedSnapshotHash` of the complete type/jurisdiction/version/prose/sections/**all serialized agreement metadata**, with current, correctly formatted `approvedOn` and `approvalExpiresOn`. Any unreviewed fee or clause change invalidates the approval. Actual counsel evidence must be fetched by a protected server-side source: a matching hash supplied by a browser is not authorization.
2. **Payout amounts are not proof of destination.** `lib/sonara-financial-close-controls.cjs` compares a complete provider payout window with a distinct verified bank statement window using payout identity, amount, currency, organization, provider account, posted/paid status and a **verified approved destination reference**. Equal values or matching dates alone never clear the transfer; missing independent bank evidence remains unknown.
3. **Direct Stripe charges are not a shield for connected losses.** The close controls classify provider-reported `lossesCollector` and explicitly identify cases in which SONARA may bear negative-balance/reserve risk. No function promises a liability amount or changes provider settings.
4. **Bank/payee updates require independent approval.** The draft two-person review rejects self-approval and requires out-of-band confirmation through a known contact channel, independent step-up and short approval windows. The function **does not** update destinations or allow payouts.
5. **Leasing rules must match transaction class.** `lib/sonara-lease-statutory-formulas.cjs` provides an Ohio 5%-on-excess-deposit **annualized basis estimate** (not amount due), a 2026 Regulation M scope classifier that understands early cancellation penalties and lessor/arranger review, and an FCRA adverse-action notice-evidence checklist with no automated denials.
6. **Document and law status remain distinct.** `draft_structurally_reviewed` and `matched_records_finance_review_required` are review statuses, not `legally_compliant`, `bank_settled`, `cash_owned`, or `authorized_to_execute`.

### Additional tests

- `tests/sonara-financial-protection-foundation.test.js`: catches unreviewed changes to recurring price, extra legal terms, stale/impossible approval dates, and noncanonical/unserializable agreement data.
- `tests/sonara-financial-close-controls.test.js`: independently linked payouts, bank reference mismatch, bank destination swap, duplicate deposits, partial pagination, missing permissions, connected loss role, and two-person payee review.
- `tests/sonara-lease-statutory-formulas.test.js`: Ohio excess deposit interest annual basis and gate conditions, $73,400 2026 Regulation M boundary, 4-month and month-to-month penalty nuance, lessor review and FCRA higher-deposit adverse-action notices.

**What has NOT happened:** no Node 24/Mocha CI, real bank or Stripe event retrieval, actual legal review, signed contracts, application route activation, SQL migration, RLS deployment, bank custody, funds movement, KYC/sanctions execution, paid customer settlement or insurer underwriting proof. Even passing every module test cannot replace licensed professional reviews or deployment evidence.

### Release decision checklist (cannot be skipped by a generative model)

Every live financial feature needs (1) a law-jurisdiction transaction-class owner, (2) locally qualified counsel approval of the *exact* document/fee schedule, (3) consent/authority audit, (4) tenant RLS and server-only IDs, (5) atomic idempotent and balanced database posting, (6) actual provider account-loss role and payout identity, (7) matched independent bank/processor record windows, (8) dispute/refund/correction procedures and time windows, (9) access/retention/incident processes, (10) covered risk insurance, (11) negative/adversarial tests, (12) formal owner activation approval. Missing evidence stays blocked. 
