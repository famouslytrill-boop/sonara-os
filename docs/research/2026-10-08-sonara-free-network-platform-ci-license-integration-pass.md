# SONARA Industries — Consolidated Platform, Legal, Free Network and CI Engineering Pass
**Date:** 2026-10-08 (America/New_York) · **Authority:** source-backed research + release-gate repair · **Not a production release or verified full-suite pass**

## 1. Baseline from current connected systems

Inspected GitHub repository `famouslytrill-boop/sonara-os`, main `9d141e68d1ec14c037f92d1eebb3c2718d583c0a` (merge PR #507, 18-PR consolidation). There were **35 concurrent open PRs** at inspection. Do **not** automatically merge them en masse; preserve exact-head source lineage, find overlapping files, distinguish migration/entitlement/media/release authoring lanes, and require one coherent verified integration head.

Supabase `yqncsonkxgwhcxedgevk` had **163 applied migrations**, last `20261008100000`. Vercel `prj_QN8mHacmlaJWSieVbjMFV5D7fmuY` remains `live:false`, latest production deployment **BLOCKED** under the owner's instruction to keep the website offline. Neither platform was changed by this work. GitHub issue #460 remains open for required checks/merge governance. Issue #457 has been marked closed; that does not prove the later merged branch's complete exact-head CI passed.

### Confirmed CI evidence, not assumptions
A representative active recovery PR #526 (`c2e519d4ca50bf0ec7d960b112ff4457b4e114c8`) has green Node compatibility and SONARA One Validation, but **red Native migration replay**, **red SONARA Industries CI**, and **red release-gate diagnosis**. In nine matrix combinations of Node 22/24/26 and PostgreSQL 16/17/18, the replay failed during an historical policy rollback:
```
ERROR: historical P1 rollback experiment failed before service-role hardening:
subscriptions duplicate policy definitions drifted; abort
```
This is a correctness assertion, not something to bypass or relabel as green. It is already the subject of concurrent recovery PRs #519/#526; preserve their scope, deduplicate repair branches and test the real schema state before another migration.

One separate blocking release verification failed because `ios/README.md` described an *independent* open-source XcodeGen developer tool without marking the vendor relationship. The existing repository README scanner suppresses third-party attributions intentionally but flagged the ambiguous line. PR #547:
- accurately labels XcodeGen a **third-party MIT-licensed** project independent of SONARA;
- states its licence does **not** grant any rights in SONARA's proprietary source;
- adds regression tests in an **existing** Mocha file to avoid generating an additional Mocha-file count discrepancy;
- executes `scripts/verify-source-licence.mjs` as a real subprocess to prove the gate, not a mocked regexp test.
This is an isolated release-gate correction; no attempt has been made to alter proprietary project licensing or weaken grant checks. XcodeGen's upstream MIT licence: https://github.com/yonaskolb/XcodeGen/blob/master/LICENSE

## 2. One shared SONARA application OS, four connected brands

```text
SONARA Industries (parent: brand, identity-entry, free discovery, governance)
   SONARA One (shared application OS, not kernel/device OS)
      ├── Identity/session/passkey/recovery + membership + per-organization roles
      ├── Entitlement: optional paid suite separately from free network participation
      ├── Free Network: social + marketplace + storefront public projections
      ├── Consent + policy + signed licences + moderation + user appeals
      ├── Canonical customer/work/order/payment/media/rights record graph
      ├── Connectors: OAuth scope + token vault + provider health + rate budgets
      ├── Durable outbox: jobs, retries, idempotency, reconciliation, ledger
      ├── Private storage + lawful retention/deletion + accessibility/i18n
      └── Observability, feature flags, resilience, security gates, control planes
          ├── Business Builder™: industry operations, work orders, POS & stores
          ├── Creator Studio™: media projects, rights/licences, marketplace
          └── Growth Studio™: consented channels, campaigns and analytics
```

**Important distinction:** SONARA is a shared application-platform architecture. It is not a replacement for an Android/iOS kernel, bank/payment processor, ERP/DAW/CAD system, cloud provider or regulated entity. Do not claim capabilities on unsupported platforms. Original visuals, high-resolution media, assistive features and front-end interactions should be backed by real workflows or plainly labelled proposals.

## 3. Owner-set business model: free social, marketplaces, storefronts

The policy in `lib/sonara-free-platform-surface-policy.cjs` already defines **12 combinations**: parent + three child products × social, marketplace, storefront. Each has `platformSubscriptionRequired:false`, `platformListingFeeCents:0`, `platformPostingFeeCents:0` and `launchState:policy_only`. The existing `tests/free-platform-surface-policy.test.js` checks scoped login, verified tenant/permissions, moderation and no accidental paid-plan gate.

**Product rule:** public discovery/browsing can be available to guests; account interactions (posting, listing management, follow, comments, moderation, storefront administration) require verified login, organization ownership/grants, moderation and policy-compliant content. Creation and ordinary participation in the network do NOT require a paid SONARA subscription or basic listing/posting fee. **Still permitted:** a seller's own price for a good/service, separate payment processor fees, taxes, fulfillment costs, optional upgraded app/business-suite subscriptions and user-approved high-cost generation/provider actions. Never blur those with free participation. Do not promise all 12 platform experiences are already wired/running: `policy_only` means policy, not deployed functionality.

### Canonical implementation order
1. Bind **one identity** to a set of verified `organization_id` memberships and per-brand business/creator/channel/store identities. Never trust request-supplied `organization_id` or editable JWT `user_metadata` for ownership.
2. Design source-specific customer records and **public projection** rows with stable `source_kind`, `source_id`, `source_version`, `origin_organization_id`, verified owner, moderation state and rights/consent digest. Public aggregate queries touch only projections, never private CRM/fulfillment/payments.
3. Require public publication `owned + original/rights-cleared + consented + moderated + age/territory classified + rate-limited`; fail closed if an upstream lookup is missing. A creator licence receipt is not authority to republish that creator's private project.
4. Implement social **follow/comment/block/report/appeal** as deterministic authenticated transitions with abuse rate limits, block precedence, notification opt-out and audit. Avoid gamified ranking without explainable privacy and moderation checks.
5. Ensure marketplace product/order entitlements use canonical seller/provider evidence, idempotent transaction IDs, merchant-owned settlement where supported, and charge reconciliation. Storefront billing must **not** be a hidden prerequisite for creating a free shop.
6. Reuse per-company owner management and platform review boards: a company manager can administer only their own store, public profile, channel, customers, moderation actions and analytics according to granted rights.
7. Connect parent discovery cards to source-specific product routes through an allowlisted registry; no orphaned buttons, redirects to foreign domains, dead upload controls or unsupported “execute” actions.
8. Keep a clear sequence `draft → reviewed → approved → published → corrected/appealed → withdrawn`, with stable external receipts; never mark mere save as published or an email accepted as delivered.

**No new SQL migration is applied by this proposal.** Read existing migrations for `business_workspaces`, `growth_channels`, `growth_channel_posts`, `creator_marketplace_entries`, `merchant_storefronts`, `merchant_products` and current RLS before suggesting more tables. A shared public projection requires *new, separately reviewed* source-of-truth mapping/tenant policies, not an unconstrained `SELECT *` view.

## 4. Customer administration: basic vs advanced control planes

| Control | Simple UI (must be real) | Advanced backend owner boundary | Evidence before “ready” |
| --- | --- | --- | --- |
| Business identity | Choose a company, edit logo/profile | server membership + business owner + exact version | owner vs member vs foreign-tenant |
| Team and delegated access | Invite/revoke, roles explained | scoped grants, audit, expiry, no self-escalation | access revocation effective, RLS |
| Cross-suite settings | locale, time, accessible preferences, notifications | versioned per-actor preferences; default privacy | browser/mobile/a11y/tenant |
| Free social | post, report, block, appeals | moderation state, consent, rate limits and deletion | negative UGC/abuse tests |
| Free storefront | create seller page, list products | rights, seller verification, idempotent checkout | free creation independent of paid plan |
| Creator marketplace | publish rights-cleared original, download licensed product | immutable rights/evidence, private object ACL | failed/duplicate licence grants blocked |
| Growth channels | manage owned content and campaigns | OAuth scoped token, no surprise broadcasts | approved recipient + provider receipts |
| Analytics | explain “what changed”, show actual counts | source freshness, denominator, per-currency money, access | no unknown → 0 coercion |
| Workflow automation | task card, approvals, pause button | durable event id, budget reservation, leases, DLQ | double-run/double-charge tests |
| Review board | preview action and consequences, approve/cancel | exact request hash, actor/role, nonce/expiry, audit | replay/tenant/signature denials |
| Developer/operations | status and test results accessible to owner | no customer access to CI secrets, restricted evidence | exact SHA/CI test states |

A customer's business control plane must never become a global SONARA administrator. The parent governance console is a distinct role/scope.

## 5. Engineering bottlenecks: control them by measured proof

**Requests:** latency objective requires measured p50/p95/p99 and a sample size, not a fabricated speedup. Parallel tenant-bound reads must have bounded fan-out `F`, per-request deadline `T`, and graceful explicit `unavailable` for timed-out sources. A dashboard of 20 records means 20 bounded reads, not unlimited backend fan-out.

**Backpressure:** effective provider concurrency `C <= min(provider documented limit, tenant budget slots, worker capacity)`. A token bucket with refill rate `r` and max burst `B` enforces `tokens(t)=min(B,tokens(t0)+rΔt)-admitted_cost`. Every external write is idempotent (deterministic tenant + source + version key) and reconciled before retry on unknown outcome.

**Storage:** object content is private by default; metadata retains tenant, SHA256, source licence, content type, size, moderation, retention, and review owner. Upload validation includes MIME sniff, virus/scanner, size quota, forbidden executables and signed URL expiry.

**Cost:** `provider_cost = billed_requests*unit_rate + token_or_GPU_usage*rate + storage_GB_month*rate + egress_GB*rate`; reserve cost budget first and reconcile actual. Free surfaces still incur infrastructure and moderation cost: define per-user fair-use resource budgets transparent to users without a paid access gate.

**Capacity/forecast:** `throughput ≈ concurrency / mean_work_seconds` only for measured, stable load; queue utilization `ρ=λ/(workers*μ)` should remain below 1 with a documented buffer; p95 queue age and DLQ volume trigger alerts. Avoid “self-healing” that can execute sensitive actions without review.

**Security:** NIST SSDF (https://csrc.nist.gov/pubs/sp/800/218/final), OWASP ASVS, Supabase RLS and per-table least-privilege. All identity/object/public projection boundaries require adversarial multi-tenant tests, explicit `WITH CHECK` on updates and reviewed privileged functions; do not infer safety from a migration count.

**Reliability:** approved main exact-SHA → complete required jobs → reversible DB migration with backup/rollback evidence → signed build/staged preview → test → owner-approved production promotion only after explicit offline-policy reversal. No auto-merge of draft or red PRs.

## 6. Legal, contracts, licensing, mobile and integrations

Legal documents need a versioned jurisdiction and source registry, human/legal review, an immutable displayed-terms hash, affirmative acceptance, date/time and durable signed receipts. Separate general website terms/privacy, platform UGC/community rules, seller agreement, creator/licence grant, buyer refund and fulfillment policy, consent to electronic contracts, user image/voice/content release and accessibility/record retention. No assumption that a developer or automated review itself makes a legal opinion.

**Licensing:** SONARA proprietary source remains `UNLICENSED`/all-rights-reserved; independent XcodeGen's MIT is a separate third-party grant and should be attributed accurately. Avoid copying brand assets or claiming Sony/Apple/Microsoft/Marvel proprietary integration solely from research. Product owner controls a separately reviewed licensing policy; keep commercial and community-use rights distinct.

**Apple/iOS:** App Store review of user-generated content, creator purchases, external links, subscription rules, privacy and signing require platform and regional review. Native shell is still a restricted pilot, not certified App Store app. Android and iOS need actual physical-device accessibility and payment-policy compliance.

**Microsoft/Google/Apple:** connectors should be separate reviewed adapters, not bundled credentials; OAuth/Graph/Google consent exact scopes; admin consent when required; revoke/delete/disconnect; scope-specific provider tests; rate headers and retry-after. Microsoft Graph requires least-privilege permissions and admin consent for sensitive scopes (https://learn.microsoft.com/en-us/graph/auth-v2-service?tabs=http). Google Workspace, Google Play and Apple App Store Connect policies/integrations require their own official docs and service account/developer approval before claiming connectivity.

**Excel/database entry:** customer uploads only after file virus/size quota checks, sheet schema preview, locale/date/currency normalization, per-row errors, tenant field mapping, dry-run diff, approver and idempotent committed batch; formula-like spreadsheet cells never turn into executable code or SQL.

**Flight/public transport/other information:** publicly sourced routes/schedules can be research adapters with sources and timestamps; “free flights” cannot be represented as airline inventory, free tickets, booking or discounts without genuine provider rights and proof.

## 7. Marketing and economics

Parent company hosts free public discovery and trust/education; all 3 child companies maintain their distinct operational funnels. Use 15–30 second **accurate** captioned task previews rather than claiming connected payment, advanced generation or live social/marketplace features that still have `policy_only` status. Publish three parent and four child free no-signup tools as previously set; registered accounts remain the minimum requirement for free interactive social, free marketplaces and free storefront administration.

Metrics (all source-verified): successful no-login free tool result, login creation, first approved public post/listing/store, repeat use at 7/30 days, conversion to optional paid work tools, per-industry monthly variable cost, moderation/report resolution time, order reconciliation accuracy, failed-to-successful provider outcome ratio, accessible task completion and complaint rate. Do not invent customers/ROI, ranking placement or seller sales.

## 8. Staged engineering execution and no-bypass acceptance

**P0 ongoing:** resolve historical native migration replay assertion across PG16–18 / Node22–26; fix `verify:source-licence` false positive via PR #547; repair exact-head SONARA Industries CI. Confirm source tests against exact SHAs; branch protection and merge queue owned by authorized GitHub repository administrator, not source file claims. GitHub supports required status checks, branch rulesets and merge queues: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets

**P1 parallel, but not indiscriminate:** reconcile #529 free-network permission work, #527 marketplace duplicate licence receipts, #533 uncertain email batches, #534 bounded reads, #531 rate-limit boundary, #537 protected secret boundary, #543 media rights. Assign source-file ownership for conflicting drafts; rebase deliberately, no blind 35-PR merge.

**P2 product:** exactly one canonical free feed projection with tenant/rights/moderation tests, accessible owner-grade admin consoles in each studio, external/Excel integrations, offline conflict control, media/GPU work, commerce settlement, legal receipts, mobile store reviews, deterministic scenario analysis.

**Definition of done:** `researched != policy_only != source_implemented != exact_head_CI_green != provider_verified != live != customer_proven`. This pass does not change production database data, release contracts, authentication grants or Vercel uptime.
