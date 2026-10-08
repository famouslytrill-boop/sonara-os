# SONARA Industries — bootstrapped software-fees-only launch contract (October 7, 2026)

**Owner direction:** minimum-budget startup. SONARA sells software access and collects **only its own disclosed recurring or one-time software fees**. SONARA must **not hold, collect, transfer, split, escrow, release, refund, settle, or claim ownership of customers' underlying commerce, rent, security deposits or digital-asset sales proceeds**. A merchant pays **its own** processor fees and controls its own Stripe/PayPal/account/receipt/return process; the merchant is the seller where verified. No third-party transaction percentage or referral/lease commission is assumed or charged.

**Not legal clearance:** “we are only middleware,” “we are a technology vendor,” and a contract disclaimer do not make SONARA immune from consumer, privacy, copyright, housing, advertising, platform, tax, product-liability or contractual laws. The legal characterization follows actual operations, not terms alone. Risk reduction is achievable, a guarantee of zero legal faults is not.

## The lean pathway (recommended launch state)

```
SONARA subscriber/merchant --[agrees to $29 / $59 / $109 plan]--> SONARA hosted Stripe Billing
                                                                 --> SONARA company bank
customer buying merchant's product --> merchant-owned checkout/payment link --> merchant-owned processor --> merchant's bank
tenant paying landlord rent/deposit --> landlord's own approved payment method/provider --> landlord-controlled funds
creator buyer --> creator-operated payment provider (outside SONARA) --> creator's account
Growth ad campaign --> customer-paid media account (Meta/Google etc) --> ad provider
```

SONARA's platform may host **invoices, customer CRM, storefront catalog previews, rent calculations, budget tools, contract templates, media rights records and reports**, but unless separately reviewed:
- An invoice is **not a payment instruction issued by SONARA**.
- A customer-provided “paid” marker remains `seller_reported_unverified`; it cannot grant paid/licensed content, settle an order, release inventory, or claim bank settlement. In early MVP sellers manually deliver goods independently, or use provider-native fulfillment.
- Verified payment/refund automation is **disabled** when SONARA isn't the integrated payment provider. Use each merchant's own independently configured checkout, dispute procedure and bank statements.
- A processor-domain link passing an allowlist is **not proof** that the actual owner is correct; seller identity and merchant destination must be independently verified before customer presentation. Do not route a customer into a payment link solely because an organization admin pasted it.
- Never collect/process raw credit card numbers, CVV, bank logins, deposit balances, foreign-currency conversions, person-to-person transfers or stored-value wallets.

**Product/experience implications:** The Creator marketplace cannot claim *automatically licensed paid delivery* based only on an external payment redirect; launch as a creator catalog, rights documentation, or seller-fulfilled distribution until authenticated provider confirmation is available. Business Builder storefronts can operate as catalogs/order requests with merchant-owned outside payment, not claim verified paid checkout. Growth Studio performs budgets and analytics only; customer owns and pays their ads account. Leases remain internal **landlord-operated documentation and bookkeeping**, not a SONARA residential leasing brokerage or property management service.

## Key sources / why it is lower cost

**Stripe explicitly states**: if you are a subscription SaaS business and you do **not** extend Stripe products or payment processing to merchants, you **do not need Connect**. Use normal Stripe Billing and hosted Checkout for SONARA revenue; merchants independently use their own processors. [Stripe SaaS guidance](https://docs.stripe.com/connect/saas).

If customers later demand deeply integrated sales payment, **alternative requiring separate owner decision**: Stripe Connect SaaS model with **Stripe-owned pricing and Stripe responsible for negative balances**, seller is merchant of record and pays processing fees. [Stripe SaaS](https://docs.stripe.com/connect/saas), [Connect risk responsibility](https://docs.stripe.com/connect/risk-management). Existing repo Connect routes were built for this class of functionality, but real `controller.losses.payments` (Accounts v1) or `defaults.responsibilities.losses_collector` (Accounts v2) must be inspected. **A direct charge is not itself evidence that Stripe carries negative-balance liability.** Connect can add requirements and should be a later phase, not necessary for low-budget v1.

**Ohio real-estate brokerage caution.** Ohio Revised Code §4735.01(A) covers compensated acts involving leasing/renting and offers to negotiate, listing, managing and procuring prospects, including certain fee-based renter information/referrals; SaaS access fees may constitute consideration depending on SONARA's activities. Avoid SONARA-run property listing marketplaces, leasing negotiation, tenant matching, rental commissions, landlord agency, rent collection and signing or screening decisions until a qualified Ohio attorney verifies a lawful exclusion or required licensing. Independent landlords may use private recordkeeping and calculation tools to operate their own business; the applicable Ohio law still governs *their* lease and deposits. [Ohio broker definition](https://codes.ohio.gov/ohio-revised-code/section-4735.01).

**Ohio rental deposit duties remain on the actual landlord**: qualifying interest and itemization/refund timing under ORC §5321.16 must be modeled correctly. SONARA can provide a calculator, but it should never falsely imply that a software label resolves the landlord's legal obligations. [Ohio deposit law](https://codes.ohio.gov/ohio-revised-code/section-5321.16).

## What SONARA actually charges

- Business Builder™: $29 monthly.
- Creator Studio™: $29 monthly.
- Growth Studio™: $29 monthly.
- All Three: $59 monthly.
- Team: $109 monthly.
- Free tier: limited tools within usage/resource budgets. Public free calculators are accessible without account creation consistent with the current product policy.
- One-time software items: only when separately priced, clearly described and enabled; no commission or percent of rent/sales.
- Taxes and Stripe subscription fees: determine using actual billing account, billing jurisdiction and tax configuration. Do not quote a guaranteed net income margin, automatic tax exemption or refund terms absent verification.
- Do not promise perpetual unlimited AI/media rendering, unlimited storage, or an “unlimited free” tier without quotas.

## Technical implementation in draft PR #442

1. `lib/sonara-low-custody-policy.cjs` adds `external_only` as a conservative **decision-engine** default. It distinguishes platform SaaS fees, customer merchant payments, regulated/rental payments, and never-supported escrow/wallet/advance/P2P activity. It also labels external seller receipt claims as **unverified** rather than paid.
2. `lib/sonara-connected-payments.cjs` adds an **explicit runtime readiness kill switch**: when `SONARA_CUSTOMER_FUNDS_MODE=external_only`, `connectReadiness` fails closed, including account creation, eligibility and checkout paths **that call this readiness check**. This does not alter SONARA subscriptions and does not by itself prove **all** Connect routes, asynchronous workers, existing sessions/webhooks, direct lower-level calls or previously deployed instances have been disabled.
3. `lib/sonara-property-vendor-boundary.cjs` restricts a software provider to customer-owned private drafting and report workflows; blocks SONARA brokerage/referrals/negotiations/rent collection/eviction legal acts even if a license flag is asserted.
4. The existing draft ledger, finance formulas, contract review gates and independent payment/bank matching stay available as **offline, informational controls**, not payment services.
5. `tests/sonara-low-custody-policy.test.js` and `tests/sonara-property-vendor-boundary.test.js` cover the new boundaries.

### Deployment requirements — not executed

- **Owner chooses fee-only**: explicitly configure `SONARA_CUSTOMER_FUNDS_MODE=external_only` and `STRIPE_CONNECT_ENABLED=false` for every relevant runtime, server and preview/prod environment **after** checking customer migration consequences. No such config has been changed here.
- Audit all `server.js` mounts, merchant and marketplace checkout routes, Connect onboarding, worker and scheduler side effects, existing sessions and signed Connect webhooks for bypasses and outstanding legitimate customer transactions; preserve historical receipts and resolve refunds/disputes lawfully. Avoid simply deleting evidence or stranding paid users.
- Check client pages and menu labels: show catalog/invoice/quote/seller-provided payment instructions, not SONARA-hosted payment buttons or a “SONARA-held deposit.” Disable custody/escrow/wallet/advances, auto-executed rent payments and unreviewed rental advertising/referral features.
- Keep **SONARA's own** Stripe Billing and customer-portal cancellation available, verify subscription webhook signature, tax/price agreement and simple ledger of SONARA revenue; ensure complete billing/refund/consumer disclosures.
- Run real Node 24 tests, whole-suite regression, static security tests, tenant isolation tests, CI exact-head checks, live production commit verification and a controlled rollout with rollback. Deploy only with owner permission.
- Professional help on a shoestring: a **narrow, fixed-scope** local lawyer consultation for business activity/Ohio real estate + basic SaaS agreements is more cost-effective than attempting regulated escrow, financial custodianship or a multi-state property marketplace. Later obtain accountant/tax advice and appropriate insurance if viable. Free authoritative regulations are useful for design but don't equal counsel approval.

### Customer-facing responsibility matrix — review-only, not published terms

| Subject | SONARA software vendor | Customer merchant/landlord | Independent provider |
| --- | --- | --- | --- |
| SONARA SaaS recurring charges and cancellations | Owns accurate billing, disclosures, support and refund obligations | Pays its software invoice | Processes SONARA payments |
| Sale of merchant goods/service | Supplies general catalog/orders/records tools | Responsible for pricing, contract, delivery, consumer returns, and taxes as applicable | Processes merchant’s payments |
| Customer rent/deposit | Offers private calculations/draft notices without handling money | Makes lease decisions; controls rent/deposit and lawful remedies | Landlord-selected rent processor/bank |
| Creator sale/rights | Provides upload/catalog/license-draft software and accurate limitations | Verifies own rights, seller refunds and buyer delivery | Creator's processor |
| Paid advertising | Provides forecasts/drafts/analytics | Approves spend and holds provider account | Ad platform bills customer |
| Data security / platform claims | Always responsible for its own authorized systems and truthful statements | Controls and legally uses its own customer data | Each processor has its own security obligations |

**This is a product/engineering operating model, not a liability waiver or proof of legal compliance.** Users cannot automatically be forced to bear SONARA's negligence or statutory duties. State/federal consumer and privacy protections remain relevant.

## Stop-ship criteria for low-budget mode

- Any SONARA server route can still create/payout/split/hold/refund **merchant** funds under `external_only`.
- Customer payments are represented as paid merely because merchant says “paid.”
- Seller-supplied link can silently redirect to an attacker or impersonated payee.
- A rental or seller listing is misleadingly presented as reviewed by SONARA.
- SONARA is shown as escrow agent, licensed property manager, bank, landlord, tax professional or lawyer without actual authority.
- SONARA accepts a cut of real-estate lease proceeds or advances money while claiming its compensation is “just SaaS.”
- Own subscription cancellation/fees/refund disclosures do not match the actual service.

**Verified state today:** new draft source committed, isolated policy tests have run. No deployment configuration, real Stripe connected accounts, card charges, hosted payment links, financial data, or public legal terms have been modified.


## Exact-head engineering follow-up — strict default and historical reconciliation

**Important change:** The Connect checkout gate now **fails closed when `SONARA_CUSTOMER_FUNDS_MODE` is missing, unknown, or `external_only`**, even if an old production environment still has `STRIPE_CONNECT_ENABLED=true`. To use Connect again later, the runtime must explicitly set `SONARA_CUSTOMER_FUNDS_MODE=connect_direct_reviewed` **and** `STRIPE_CONNECT_ENABLED=true` after a separately recorded professional/owner decision. This dual opt-in is **necessary but not sufficient** for legal clearance or actual provider eligibility. The reviewed value is a technical feature-mode name, **not** evidence that counsel actually signed off.

The `.env.example` file now includes both `SONARA_CUSTOMER_FUNDS_MODE=external_only` and `STRIPE_CONNECT_ENABLED=false`; it is an example file, not a live Vercel/production variable. The actual public deployment has not been inspected or modified in this PR.

### Preserve honest old transactions while forbidding new ones

- **Blocked when fee-only:** onboarding new managed Stripe Connect accounts, creating marketplace/storefront Checkout Sessions, using the Connect account eligibility flow, and expiring Checkout Sessions through this checked helper. All checkout operations implemented by `lib/sonara-connected-checkout.cjs` now rely on the two opt-ins for writes.
- **Still permitted with existing server keys and appropriate tenant authorization:** processor **GET** requests for preexisting connected-account Checkout Sessions. Read-only recovery/reconciliation of legitimately paid orders must not disappear just because SONARA stops offering integrated checkout. **No new customer charge** results from a GET; actual bank deposit is still separate proof.
- **Continue to accept signed historic Connect webhooks** until existing orders, disputes, refunds, and outstanding legitimate customer funds records are safely reconciled. The server's **own** platform billing webhook/Checkout/Customer Portal remains separately implemented and unchanged.
- **Cutover warning:** turning off an app checkout button does **not** cancel existing hosted Checkout Sessions, remove a seller's external payment links, resolve all already-pending charges, cancel preexisting merchant payment authorizations, or retroactively undo losses. Inventory of live/expired/paid sessions, merchant contacts, recovery and customer notifications need approved operational handling before deploying the new mode. Do not unilaterally delete merchant records or send unapproved refunds.
- **Security caveat:** browser or seller-provided payment link strings remain unverified destinations even if their URL host appears to be Stripe/PayPal. No default conversion from these URL strings into an in-SONARA paid checkout or automated entitlement delivery.
- **Scope of this PR:** the files above are **draft branch changes only**. Historical webhook tests, runtime route wiring tests, new-money suppression, and unchanged SONARA Billing behavior must pass in real Node24/Mocha, CI and permitted staging before a controlled production deployment.

### Integration tests updated for dual opt-in

All existing mocked legacy Connect flows that intentionally exercise checkout now explicitly declare `SONARA_CUSTOMER_FUNDS_MODE=connect_direct_reviewed` in test fixtures, without silently enabling Connect in an actual deployment. The new fee-only test suite checks missing/invalid mode, unchanged hosted subscription boundary, old-mode Connect flag not overriding the kill switch, no-network creation denial, merchant checkout denial, read-only historic session GET and denied session-expiration POST. These isolated checks are not a production go-live verdict.


## Budget and compliance support: start with no-cost resources

- [Ohio SBDC](https://www.ohiosbdc.net/contact/): provides no-cost one-on-one startup advising and financial/business-planning assistance. It is not an automatic substitute for licensed real-estate or payments counsel.
- [SBA Local Assistance](https://www.sba.gov/counseling/local-assistance/): free or low-cost SBDC and SCORE mentoring resources.
- Use the official [Ohio brokerage statute](https://codes.ohio.gov/ohio-revised-code/section-4735.01), [landlord deposit rule](https://codes.ohio.gov/ohio-revised-code/section-5321.16), and [Stripe SaaS/Connect guidance](https://docs.stripe.com/connect/saas) for **scope control**, not to claim legal immunity.
- Defer public property brokerage, custody, escrow, lending, multi-party settlements and complicated multi-state paid leasing products to a future funded/legal-reviewed phase.
- Before collecting its **own SaaS subscription fees**, SONARA still needs accurate pricing, renewal/cancellation, refund, tax, consumer-protection, privacy, accessibility and security disclosures and genuine customer support. A no-custody software business has fewer financial risks; it is **not exempt from law**.

**Status of code as of this draft:** fee-only is a fail-closed software default; only `connect_direct_reviewed` + `STRIPE_CONNECT_ENABLED=true` unlocks legacy Connect readiness. Sample env uses `external_only`. All money-feature changes are in an **unmerged GitHub draft PR** and have not been applied to deployment environments. In-flight seller checkouts, existing orders, and webhooks must be audited at cutover.


## 2026-10-08 advanced low-budget payment-boundary review

The prior fee-only work is now on `main`. The current hardening continuation is draft PR #552; it does not change production configuration or activate customer payments.

### Why external-only remains the launch default

For a low-budget software startup, the cleanest engineering boundary is still:

`customer -> customer's chosen processor/account -> customer`

and separately:

`SONARA subscriber -> SONARA Stripe Billing -> SONARA software revenue`.

SONARA may calculate amounts, create invoices/quotes, keep customer-owned ledgers, reconcile evidence, and store external references. In `external_only` mode it does not accept, hold, transmit, split, route, release, refund or pay out customer/merchant funds.

This is risk reduction, **not a legal safe harbor**. FinCEN repeatedly states that money-transmitter status is facts-and-circumstances based. Its payment-processor rulings depend on specific conditions, including facilitating payment for goods/services, use of qualifying clearance/settlement systems, formal agreements, and acting at least for the seller/creditor. Another FinCEN ruling found money-transmitter status where a platform accepted/stored funds and let users release or withdraw them. Those distinctions support SONARA's product choice to avoid stored balances, wallets, escrow and general-purpose transfer instructions.

### Stripe boundary

Stripe documentation distinguishes payments made on connected accounts via direct charges from destination/separate-charge routing and also documents that responsibility for fees/negative balances depends on the connected-account configuration. Therefore:

- direct charges can reduce the amount of customer money that enters the platform account;
- direct charges do **not** prove SONARA has no regulatory, contractual, tax, consumer, dispute or loss responsibility;
- application fees, destination routing, transfers and platform-managed payouts are intentionally outside low-budget launch scope;
- the safest current option remains `external_only`; `connect_direct_reviewed` remains an explicitly funded/reviewed future mode, not the default.

### New source-level release invariant

Draft PR #552 adds a runtime source scan that fails if executable `lib/` or `routes/` code introduces:
- `application_fee_amount`;
- `transfer_data`;
- `on_behalf_of`;
- `source_transaction`;
- Stripe Transfers API routing;
- Stripe Payouts API routing.

The scan strips comments before checking, so existing architecture explanations do not count as runtime behavior. Existing marketplace/storefront schema also rejects commission/application-fee columns.

This is a regression tripwire, not proof that every possible payment-regulation theory has been eliminated.

### Current authoritative starting points

- FinCEN payment processor / ISO ruling: https://www.fincen.gov/resources/statutes-regulations/administrative-rulings/application-money-services-business
- FinCEN stored/released funds platform ruling: https://www.fincen.gov/resources/statutes-regulations/administrative-rulings/whether-company-provides-online-real-time
- Stripe Connect SaaS/payment model guidance: https://docs.stripe.com/connect/enable-payment-acceptance-guide
- Stripe application fee API reference: https://docs.stripe.com/api/application_fees/object
- CFPB stored payment-app funds issue spotlight: https://www.consumerfinance.gov/data-research/research-reports/issue-spotlight-analysis-of-deposit-insurance-coverage-on-funds-stored-through-payment-apps/full-report/

### Practical startup rule

If a feature requires SONARA to hold a customer balance, decide when someone else receives money, pool funds, split proceeds, lend/advance money, or represent itself as escrow/custodian, **do not ship it in the bootstrap product**. Replace it with calculation, recordkeeping, customer-owned provider links/accounts, and evidence/reconciliation until the company can afford jurisdiction-specific professional review.
