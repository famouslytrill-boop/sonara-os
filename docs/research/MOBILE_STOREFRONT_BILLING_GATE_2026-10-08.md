# SONARA mobile storefront billing boundary — October 8, 2026

**Status: implemented test-only classification. NOT wired to checkout, StoreKit or Play Billing. NOT a production release, legal opinion, or app-store approval.** The website remains intentionally offline. No charge, refund, transaction, publishing or deployment is authorized.

## Policy sources reviewed October 8

- Apple App Review 3.1.1, 3.1.1(a), 3.1.3, 1.2 and 4.2: https://developer.apple.com/app-store/review/guidelines/
- Google Play Payments: https://support.google.com/googleplay/android-developer/answer/9858738
- Google Play US alternative billing: https://support.google.com/googleplay/android-developer/answer/16497028
- **Distinct Google Play US external content links program:** https://support.google.com/googleplay/android-developer/answer/16470497
- Google Play UGC: https://support.google.com/googleplay/android-developer/answer/9876937
- Google Play recent US policy updates: https://support.google.com/googleplay/android-developer/answer/15582165

**Recheck before each release:** store account region, product classification, authorized purchase channel, provider/entitlement and program enrollment are specific to each purchase. Country inferred from IP or a browser field is not proof of app-store account storefront.

## Why one Stripe route is insufficient

| SONARA transaction | Web | iOS App Store | Google Play |
| --- | --- | --- | --- |
| Free social, listing and storefront creation | No charge | No charge | No charge |
| Physical goods, restaurant orders, trades/cleaning performed outside the app | Merchant-owned reviewed checkout | Outside-app goods/services payment | Outside-app goods/services payment |
| Digital creator licence or feature consumed in app | Independently verified web provider | StoreKit or eligible reviewed alternative | Play Billing or approved alternative program |
| SaaS subscription, digital credits or in-app feature | Server/provider billing proof | StoreKit or eligible reviewed alternative | Play Billing or approved alternative program |
| In-app social post boost | Digital | Generally in-app purchase | Generally digital purchase |
| Stand-alone advertising campaign management | Distinct service review | Possible category exception only after legal/product review | Explicit product/program review |
| Mixed physical and digital cart | Split and classify | Split and classify | Split and classify |

Apple's 3.1.1(a) permits calls to alternative purchase methods for US storefront apps, without the same entitlement requirement as other storefronts. That does NOT establish a universal right to embed an external digital Stripe checkout in the native app. The policy classifier restricts to a separately reviewed external **link candidate** for US accounts only, not a charge or right grant.

Google's US alternative-billing program is opt-in. As of October 1, 2026 participating developers face reporting requirements for authorized transactions and successful downloads as well as applicable Play service fees. A configured processor alone does not establish enrollment or compliance. Other territories use their own rules and approved programs; this initial implementation rejects unreviewed regions.

### Two separate Google Play US programs (reviewed October 8, 2026)

These are **not interchangeable**. Enrolling in one cannot be treated as enrollment in the other.

| Program | How it works | Distinct operational proof |
| --- | --- | --- |
| Alternative billing for users in the US | A non-Play digital billing choice **within the app** | Enrollment via Play Console Alternative billing, relevant alternative billing APIs, transaction and download reporting, customer support/refunds, applicable fees |
| External content links program for users in the US | A reviewed outbound **link** to buy digital items or download an external app | Separate Play Console external-content-links enrollment, external links APIs and information screen, reviewed destination and disclosure, transaction reporting, applicable fees, and separate external-app approval for download links |

Google's **external content links** guidance currently states October 1, 2026 for transaction reporting/service fees but **December 1, 2026** for reporting successful external-app downloads and related service fees. The separate alternative-billing page states October 1, 2026 for its reporting and fees. A downloader-specific extension of the deadline must never be applied to digital purchase transactions. This policy module authorizes neither an app-download link nor a transaction.

The research classifier therefore adds a new test-only `google_us_external_link` method, distinct from `google_us_alternative`. It requires its own verified program enrollment, approved destination, API readiness, pre-link disclosure, financial reporting, support/refund and service-fee evidence. Even a fully attested record returns **external_link_only** and **checkoutAuthorized=false**; no website checkout, navigation link or app-install permission is created. Actual user-facing routes need signed provider/store evidence and an authorized release.

Apple enterprise-only, free companion, reader-app and advertising manager categories have fact-specific boundaries. Because SONARA also sells direct-to-consumer creator content and subscriptions, none may be presumed universally available. Physical-goods checkout must not disguise in-app digital purchases.

## Implemented deterministic preflight

- Module: lib/sonara-mobile-billing-classification.cjs
- Tests: tests/mobile-store-billing-classification.test.js
- Accounted **test-only** (not runtime-registered) in scripts/report-unreferenced-modules.mjs

Input is a **trusted server catalog classification**, independently verified account storefront, explicitly reviewed purchase channel and evidence flags. Untrusted client SKU, cookie, user metadata or X-Platform header MUST NOT be interpreted as billing authority. Every candidate has checkoutAuthorized=false, entitlementGranted=false, sideEffectExecuted=false, even when a separate route might later be approved.

Mixed carts, unknown products, missing provider proof, absent Play alternative enrollment, unreviewed social-boost exemptions and unsafe payment methods fail closed.

## Controlled implementation order

1. Review a versioned canonical SKU registry: product ID, digital/physical classification, in-app consumption, seller ownership, price, valid territories, tax classification, reviewer, effective date. Never use browser-supplied product types for authorization.
2. Create server-side purchase intent tied to authenticated user, organization, verified merchant/provider, app distribution channel, verified storefront and idempotency key. Reject mixed carts and mismatched store channels.
3. Implement and verify StoreKit 2 / Play Billing on native clients only after approved SKU/store account setup. Verify receipts and purchase tokens server-side and reconcile refunds and revocations before granting entitlements.
4. For opted-in US Google alternative billing, validate program enrollment, alternative-billing APIs, reporting of transactions/downloads, fee settlement, support/refunds and audit deadlines. Test with developer sandbox records rather than live money.
5. For any Apple US external link, approve the destination and disclosures and verify user account storefront, rule applicability, service terms and end-to-end payment provenance. Do not auto-grant licences.
6. Physical merchant checkouts must correspond to real outside-app fulfillment and a reviewed merchant-owned processor. Do not route seller funds through an unlicensed SONARA wallet.
7. Test two merchants/two tenants, replayed receipts, out-of-order refunds, failed reporting, region changes, 401/403 access denial, blocked/withdrawn content and offline mode; log redacted evidence with an exact commit.
8. Require reviewed policy, moderation/report/block/appeal and accessibility, human release signoff, protected branch/environment, staged DB rollback, Android Play internal signed devices and iOS signed/tested device evidence.

## Critical missing proof

- GitHub main enforcement and production reviewers with mandatory exact-commit checks.
- Supabase historical migration divergence resolution (20260919032950) and staging tenant authorization proof.
- Independently connected Stripe sandbox seller and Creator payment reconciliation.
- iOS simulator/device builds; Play signing, Android Digital Asset Links, native billing integration and regional enrollment.
- Production website restoration approval and app-store publication approval are separate actions.

Do not ship or claim app-store compliance solely from this policy document.
