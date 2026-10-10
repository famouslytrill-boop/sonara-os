# SONARA Industries — Shared Network, Traffic Control, Legal and Integration Engineering Pass
**2026-10-08 | design and bounded implementation | NOT production activation**

## Verified starting point and non-negotiable status
At the start of this pass, `famouslytrill-boop/sonara-os` main was `9d141e68d1ec14c037f92d1eebb3c2718d583c0a` following merge #507 (18-PR consolidation). There were **23 open PRs**. Vercel `sonara-os` remained `live:false` / latest production `BLOCKED`. Supabase `yqncsonkxgwhcxedgevk` had **163 applied migrations** through `20261008100000_tighten_service_role_rls_policies`. Do not unpause production, apply migrations, grant new browser privileges, open providers, spend money or change external merchant accounts from this effort.

**Concurrent development:** PRs #508–#530 cover release proofs, recovery, hardening, marketplace grants, social rights, licence evidence and simulation. Do not overwrite their branches, merge all drafts blindly, or create competing entitlement/RLS migrations. Re-evaluate exact heads and check current status first. A merge is not proof of passing tests or of a customer-facing feature.

## Actual source change (separate review branch)
Branch `codex/bounded-business-read-fanout-20261008` implements per-request, bounded, **ordered and settled** source reads:
- New shared `lib/sonara-bounded-source-reads.cjs` exports `settledMapBounded`, accepting an array and asynchronous reader, default concurrency 3, validating integer bounds 1–8, returning one success/failed result per source in **original input order**. A failed read has `{ok:false,code:"source_unavailable"}`; raw provider exceptions are never returned to a caller.
- Business Builder `routes/sonara-business-control-plane-routes.cjs`: the seven-resource operating dashboard and the multi-resource business-detail JSON each issue **at most three concurrent source reads** within that fanout. Existing auth/tenant/permission checks and JSON/HTML destinations remain. An absent, malformed or failed source returns **null/unavailable**, not a fabricated empty table. Capped rows remain marked partial.
- Growth Studio `routes/growth-studio-control-routes.cjs`: nine exact source counts in a campaign report are fetched three at a time and preserve `count:null` when unreadable. Campaign payments' batches of 100 IDs are fetched in bounded threes per `readInBatches` call and fail closed if any batch fails or malforms, without inventing collected money.
- `tests/business-control-plane.test.js` adds deterministic concurrency/order/read-failure and integrated API/dashboard assertions. Existing Growth campaign tests must also pass. This code **does not introduce new SQL tables or external actions**.

**Precisely what is NOT solved:** The bound is per fanout, not global: 100 simultaneous HTTP requests can each start three provider calls. It is not rate limiting across tenants, a connection-pool setting, an execution timeout, a database query/index optimization or a distributed queue. It may increase single-request tail latency for users whose upstream is consistently fast. Instrument p50/p95/p99 and backend 429/5xx before choosing limits; do not call this a measured speedup without A/B evidence.

## SONARA One integrated architecture
```text
SONARA Industries: legal, governance, brand, free identity network, discovery
                 |
              SONARA One shared tenant/account & event backbone
              /             |                \
Business Builder™      Creator Studio™      Growth Studio™
(company/admin/POS)    (media/rights/store)  (social/campaign/attribution)
              \             |               /
                  FREE LOGIN NETWORK PLANE
               Profiles / Follows / Feeds / Interactions
               Moderation / Consent / Appeals / Audit
               Listings / Storefronts / Catalogue / Delivery
                         |
             Provider gateway + usage/rate budgets
                         |
       Tenant-scoped Postgres and private object/media storage
                         |
       Bounded reads, queues, idempotency, OTel, backup evidence
```
The three products must remain separately navigable and independently marketable. A shared signed-in profile/identity may enable discovery across the parent and child apps without automatically granting another company's staff rights. **Customer-owned administration is business/organization scoped**. Public content and tenant-private source data are separate objects and grants. In-app `free to start with login` is a **pricing policy**, not permission to access another user/tenant's private data.

## Core social, storefront and marketplace pricing policy — product requirement, not authorization to deploy
- Accounts, browsing, basic social interactions, creating a hosted storefront and submitting ordinary listings are intended to be free after login under the owner's new direction. Anonymous public browsing may be useful for discovery, but authoring/updating social content requires login; keep anti-spam and controls.
- **Separate platform access price from underlying transactions and variable consumption.** Free storefront hosting does not make payment processing, shipping, taxes, refunds, creator royalties, third-party marketplace fees, paid ads, media compute, external integrations or premium infrastructure free. Never advertise zero transaction charges until legal/provider pricing and business subsidy are contractually established.
- A marketplace listing belongs to a verified publisher/tenant; seller controls inventory, terms, returns, tax obligations, fulfillment and legal rights. Buyer checkout uses provider-owned credentials/custody and verified receipts; SONARA does not assume merchant-of-record liability without a separate licensed/compliant model.
- No impersonation, copyrighted uploads without rights, fake reviews, coercive invitations, silent follow tracking, automated public posting or post-sale download before license/entitlement proof.

### Shared entities and data contracts (candidate, map existing schema before migration)
| Concept | Durable minimum | Privileged authority |
| --- | --- | --- |
| Network account | auth user ID, profile handle, visibility, moderation state | account owner; no self-promoted admin |
| Publisher organization | organization ID, owner verified role, social/storefront policy | organization owner plus per-action grant |
| Posts/media | owner, explicit audience, consent, licence, content hash, timestamps | publisher; read access by explicit audience |
| Follow/like/comment | authenticated actor, target, unique mutation id, block state, status | actor only; moderation can override by reviewed action |
| Moderation/review | report, policy/version, reviewed reason, evidence, appeal outcome | restricted moderator audit; no forged customer proof |
| Storefront/listing | seller owner/tenant, listing version, price currency, rights, availability | seller only; buyer gets public projection |
| Order/settlement | seller account, provider receipt, currency integer minor units, refund status, idempotency key | provider-confirmed transaction; staff cannot fabricate |
| Digital delivery | purchase or free entitlement, licence version, signed object URL, revocation record | authorized buyer, publisher rights |
| Provider grant | tenant, user, provider account, OAuth scopes, expiry, consent, disconnect | owner grant + least-privileged server adapter |
| Work run | actor, product, input hash, exact approval, quota reservation, status, attempts, receipt | governed worker; no client-supplied success |
| File/import | tenant owner, original file, type/size/hash, row validation errors, provenance | validated upload + owner-approved mapping |

### Three front-end operating planes and owner controls
- SONARA Industries parent: profile, signed-in shared feed, public discovery, public marketplace/index, organization switching, legal/privacy, reporting/appeals and status.
- Business Builder: free hosted storefront/onboarding and owner control plane, role-specific inventory, jobs, POS, stock, appointments, staff schedules, accounting exports; advanced controls only after tenant+role evaluation.
- Creator Studio: free creator storefront, rights evidence, catalogue, licensed delivery, projects/transcripts/timelines, captions and optional compute/provider features with usage estimate. Musical/film/theory templates are educational, not licensed songs or guaranteed rights.
- Growth Studio: free brand profile, consented follower interactions, owned social visibility, campaign drafts and attribution; mass outbound email/SMS, paid advertising changes and cross-platform publication require explicit provider grant and owner approval.
- Every action must have a real route/destination, loading and failure state. Missing dependencies show Setup Required or Unknown, never fake sample customers/earnings.

## Traffic and operational engineering model
Little's law `L = lambda * W`: rising concurrent requests or upstream latency raises in-flight load. A large unconstrained Promise.all can amplify a temporary provider slowdown; a bounded pool reduces per-request pressure but can raise total response time. Measure both outcomes, not just request count.

Recommended operational goals, explicitly targets not current facts:
- p95 dashboard API latency <1.5 seconds under an agreed tenant/load profile; p99 <3 seconds; per-source error rate <1%; dashboard reports incomplete when any source fails.
- Capture OpenTelemetry `product`, anonymized tenant key, route class, source-table logical name, batch size, max in-flight, 429/503, query timeout, result-count/truncation and trace ID; never emit tokens, private documents, email addresses or raw SQL parameters.
- Introduce shared provider concurrency budgets and jittered exponential retries only with durable idempotency; don't retry non-idempotent charges or sends after unknown outcomes. Controlled pool per request is not a distributed limiter.
- Fix indexes only from `EXPLAIN (ANALYZE, BUFFERS)`, targeted workload/row counts and maintenance impacts; do not drop all Supabase advisor warnings indiscriminately.
- Track worker queue-depth, ready jobs, oldest waiting job, retry exhaustion, cancelled vs completed, GPU/egress cost per customer, storage leakage, database pool utilization, cold-start and OpenTelemetry span lineage.

## Spreadsheet import/export, Microsoft, Google and Apple connector strategy
- Import CSV/XLSX via *staged previews* (never direct live table writes): validate row and formula bounds, normalize locales/time zones/currencies, map customer-owned columns, deduplicate with review, reject unknown foreign tenant references, and calculate clear errors before a versioned import job. Do not execute spreadsheet macros/formulas. On CSV export guard spreadsheet-formula injection for any value starting `=`, `+`, `-`, `@`, tabs or newlines; escape according to target and test. Preserve source file, checksum, approval, audit and rollback where possible.
- Microsoft Graph Excel workbook APIs support specific file types and delegated permissions; design explicit OneDrive for Business scoped connectivity, use `Files.Read` for reading, `Files.ReadWrite` for writing where allowed, and verify supported account types before offering the connection. A planned connector does not authorize Microsoft access.
- Google Drive/Sheets: where compatible use `drive.file` and file Picker instead of all-Drive restricted scopes, encrypt server-side refresh tokens, implement explicit disconnect and per-file permissions. Selected file scope is not global Drive access.
- Apple identity: Sign in with Apple requires server-verification of identity token, correct client/service identifiers and nonce/state; Safari/iOS camera/motion/notification use is user-consent driven. Do not claim Apple platform integration is present until configured and tested on devices.
- Payment providers: prefer provider-managed merchant onboarding and direct seller payouts with evidenced per-account authorization. A platform-level free storefront is not a free payment-processing guarantee.
- Cloud: durable object-storage quotas, virus scanning, signed URLs, file rights, region/backup policy, tenant-specified retention, versioned import receipts, disaster restore drill evidence. User-owned provider connections remain clearly labeled versus SONARA-hosted storage.

## Legal/policy and customer contract review board — drafted engineering requirements only
**Do not silently publish or revise production Terms/Privacy**; use owner-approved, jurisdiction-reviewed versions with acceptance receipts:
1. User agreement: free-platform scope, login requirements, prohibited conduct, account suspension/appeal, dispute process, service availability, accessibility, copyright and user-content licence limited to hosting/distribution.
2. Seller/merchant addendum: seller legal identity, responsibility for listings/consumer law/taxes, authorized Stripe Connect or similar payment account, fees, returns, digital delivery, promotions, shipping and chargeback allocation. Where needed user-specific seller classification is a legal review.
3. Creator release/licence: ownership, provenance, sublicensing limits, permitted edits/reposting, model training consent separate and opt-in, royalty attribution, purchaser use, takedown and reinstatement.
4. Media appearance/voice releases: who appears, intended media/platforms, term, geographic scope, whether AI modification is allowed, compensation and revocation/withdrawal boundaries; qualified counsel review for sensitive content, minors and biometrics.
5. Privacy/cookies: purpose, retention, account deletion/export and shared network cross-product controls; provider revocation; notifications off by default; international processing disclosures when applicable.
6. Social moderation: community guidelines, abuse/report/block/appeal, user consent for algorithmic ranking, child/teen protection and DMCA/takedown procedures where legally applicable, FTC material-connection disclosures for influencers/sponsored content, no bought fake reviews.
7. Business owner admin grants: per-org delegation, short-lived session/MFA for high-impact operations, review before transfer, immutable receipt (actor/organization/action/version/time/approval digest), explicit withdraw/expiry.
No generic disclaimer makes regulated medical, housing, financial or transport functions automatically permissible. Obtain qualified legal review before release.

## Release/acceptance grid
- Code and tests for this branch: target `pnpm exec mocha tests/business-control-plane.test.js` plus existing `tests/a-campaign-is-judged-on-what-its-customers-paid.test.js` and `tests/a-campaign-says-whether-it-paid-for-itself.test.js`, `pnpm test`, lint/typecheck/build, `verify:gates` and exact-head Actions/browser.
- Verify max in-flight per Business Builder dashboard and detail view =3; preserve ordering and tenant filters; rejected provider errors become unavailable; no fake amounts/zero counts; no unexpected global leaks. Existing Growth tests must show payment attribution unchanged.
- No new route/schema/migration added; no model/provider keys; no changed permissions/entitlements; no provider call beyond synthetic tests; production remains OFFLINE.
- Existing PRs #519/#526 repair test-count/migration replay; #529 reviews free-platform UGC grants and rights; #525/#521 release attestation. Do not claim they are merged or replace them with this work.

## Sources checked 2026-10-08
Supabase RLS https://supabase.com/docs/guides/database/postgres/row-level-security ;
W3C WCAG2.2 https://www.w3.org/TR/WCAG22/ ;
Stripe Connect marketplaces https://stripe.com/connect/marketplaces ;
Microsoft Graph Excel https://learn.microsoft.com/en-us/graph/api/resources/excel?view=graph-rest-1.0 ;
Google Drive scopes https://developers.google.com/workspace/drive/api/guides/api-specific-auth ;
Google Sheets scopes https://developers.google.com/workspace/sheets/api/scopes ;
Apple Sign in https://developer.apple.com/documentation/signinwithapplerestapi ;
FTC endorsements https://www.ftc.gov/business-guidance/advertising-marketing/endorsements-influencers-reviews .
