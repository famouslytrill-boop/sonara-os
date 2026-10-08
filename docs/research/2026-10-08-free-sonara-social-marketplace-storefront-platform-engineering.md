# SONARA Industries — Free Social, Marketplace and Storefront Ecosystem
**Engineering & legal R&D pass** · 2026-10-08 · Parent company + Business Builder™ + Creator Studio™ + Growth Studio™ · Owner policy

## Product decision: free participation with login
**Free to use, all four brands:** sign up / log in, create business/creator/community profile, manage a social channel, make an original post, open a creator listing, configure an independent storefront, interact with other participating businesses/users, discover and browse content. No SONARA monthly subscription, paywall, listing fee or posting fee should gate those *basic platform surfaces*. Public browsing may be available without an account, but account-based interactions require a verified login. The source-level `lib/sonara-free-platform-surface-policy.cjs` represents **policy only**, not proof that all twelve experiences already run.

**Not necessarily free:** an item another seller legitimately prices above $0; independent card/payment processing and refund costs; paid Creator rendering/generation or advanced SONARA commercial products separately selected by a user; delivery/fulfillment by providers, tax due, third-party licensing. These cannot be bundled into a forced subscription to create a free storefront. Price/fee disclosures and affirmative paid consent remain separate.

### Identity without cross-tenant leaks
One verified SONARA account may administer multiple businesses/brands; an organization links to its own storefront, Growth channel and Creator listings through **authorized organization IDs**. A parent discovery/feed aggregates only approved public projections, not private CRM rows, buyer addresses, unpublished projects or provider credentials. Each public item has source organization, origin brand, moderation state, owner and rights status. Tenant membership, ownership and role grants checked on each write. Request-supplied organization ID, `user_metadata`, public handle and badges do not confer authority.

## Source inventory & migration decision
Live Supabase catalog inspected read-only:
- `business_workspaces` is the canonical business owner/profile table.
- `growth_channels`, `growth_channel_posts` are present for managed social publishing; routes exist in `routes/sonara-growth-channel-routes.cjs`.
- `creator_listings`, `creator_marketplace_entries` exist for private listings and public sanitized projection.
- `merchant_storefronts`, `merchant_products` exist for stores and sale catalog.
- Existing migrations count **161 applied**, most recent `20261007130000`. This pass **adds no production migration**: reusing these tables is safer than introducing redundant account/store/market tables. A free centralized parent feed would need a further distinct, reviewed migration and moderation design before activation.

### Proposed future migration (DO NOT execute without review)
A new `sonara_public_activity` **public projection** can carry `id`, `origin_organization_id`, `source_kind` (growth post, creator listing, merchant storefront), `source_id`, `published_at`, `display_title`, `safe_summary`, `moderation_state`, `source_version`. Define tenant-scoped uniqueness on source kind/id; store no private customer records, addresses, raw media, bank data or secret tokens. Separate `sonara_activity_reports` for authenticated/guest abuse reports, `sonara_activity_moderation_events` for audited owner/moderator actions, and `sonara_activity_consent_receipts` for versioned/hashed opt-in. If public browse relies on projection, use a narrow `SELECT` policy for published + approved rows only, explicit `GRANT SELECT` and row security. All creation and moderation must have server-derived organization + role, `WITH CHECK`, rate caps and immutable event evidence. Do not publish a view that bypasses RLS or grant blanket authenticated ownership.

### Architecture: one ecosystem, four experiences
```text
SONARA Industries — free discovery portal; recommendations; verified market directory
  Identity/session -> organization + member + product/owner permission
  Moderation + content licences + tenant-safe public projections
  Free social/review interactions -> opt-in relationships / follow graph
  Market & commerce references -> canonical seller/payment ledger (no custody)
    Business Builder — storefront, local services, appointment, POS provider
    Creator Studio — licences, original assets, release, marketplace delivery
    Growth Studio — public channel, approved campaigns, analytics attribution
  Shared: event outbox, search index, rate limits, notification opt-in, audit
```

Industry-specific channels: restaurant menus and reservations; trades and cleaning service packages; trucking verified delivery profiles; venues tickets and events; rentals schedules; creator art/music/video portfolios and licensed sales; nonprofit community and education; manufacturers OEM/provider profile. A profile may be cross-promoted only with user consent and explicit sender attribution. Avoid fake reviews, fake customer proof, impersonation, deceptive cross-posting or unsolicited marketing.

## Publication, distribution and moderation contracts
- `draft -> pending_review -> published | rejected | hidden | appealed`; no raw private write becomes public by default. Ownership/rights attestations and consent/versioned terms necessary. Expired takedown appeals may need human review.
- Abuse report path always reachable; reporter sees status without revealing private moderator notes. Rate-limit and deduplicate abusive reports. Preserve lawful appeal and audit chronology.
- Artwork, song, spoken word, movies and literature: original uploads, contributor releases, licensed clips, subtitles/metadata, opt-in public embedding. No guessed grant, copyrighted character/brand imagery or living-artist impersonation without authority.
- Explicit material-connection disclosure for ads, product endorsements and compensated creators; viewable on the content itself; no hidden disclosure behind hover, mute audio or user scroll.
- Privacy by design: permissioned uploads, no default location/GPS/gyroscope/microphone/camera tracking, block/ignore/report flows, account deletion/export, minors protections subject to jurisdiction, accessible captions/keyboard focus and reduced motion.
- Provider integration: Microsoft/Excel/OneDrive, Apple, Google, payment engines, cloud storage should use provider OAuth scopes and user-owned grants via the governed connector lifecycle; login alone never gives automatic access to third-party drives or payments.

## Terms, licences, contracts and release forms — DOCUMENT SCHEMA (legal review required)
Version every artifact; present relevant documents, obtain affirmative acceptance and store time, tenant, actor, exact SHA-256 content snapshot and form-version/locale. Do not precheck boxes; do not claim a legal signature merely from opening a page.
1. **Terms of Platform Use**: account requirements, service eligibility, permitted uses, acceptable use/content, moderation/report/appeal, privacy/cancellation, intellectual property, liability disclaimers, service availability, jurisdiction, contact.
2. **Community & Content Policy**: prohibited material, disinformation/spam, impersonation, ad/endorsement labeling, safety rules and notice/action appeals.
3. **Creator Upload & Distribution Licence**: creator retains owned IP; limited, purpose-specific nonexclusive right to store, transcode and display materials; revoke/withdraw where law/contract permit; third-party/public redistribution separately consented.
4. **Talent/Voice/Property Release**: identify performer/recorded work, capture methods, specific uses, territory, duration, compensation (if any), revocation boundaries, guardian requirements when relevant. No fabricated permission.
5. **Seller/Marketplace Agreement**: independent seller identity, listing rights, inventory/product truth, payment provider custody, taxes, refunds/chargebacks, dispute handling and seller payout responsibility. Do not promise universal non-custodial exemption.
6. **Buyer Terms and Digital Delivery**: seller of record, item-price and licence visibility, applicable return/refund policy, entitlement/access expiry, secure delivered file checksum.
7. **Data Processing/Provider Addendum**: owner-directed integration scopes, retention, subprocessors, export/removal, security incident and provider data handling.
8. **Advertising Agreement**: optional campaign budget, content rights, billing terms, FTC material-connection disclosure, approval before send/publish and audit trail.

**Legal review board gate:** jurisdiction applicability, current source registry, owner approval, versioned policy hash, stored rollback, counsel if required, publish time. Existing `lib/sonara-terms-and-policy-governance.cjs` exposes evidence gates but does not execute contracts or certify compliance.

## Scale, reliability, traffic and security
1. Indexed public projection/search path separate from private OLTP and request-scoped credentials.
2. Cursor pagination and maximum limit, cache validated public data with invalidation on moderation/unpublish, `ETag`, image/video CDN derivatives, rate limiter and abuse circuit breakers.
3. Durable outbox -> leased asynchronous render/transcode/index/notify jobs. Retries bounded/backoff/idempotent; DLQ and cost reservation protect free service sustainability. Offline drafts are not auto-published after reconnect without permission.
4. Storage quotas/retention fair-use caps and upload type validation, AV scanning, signed URLs, attribution and rights metadata; no unlimited GPU/upload claims.
5. Customer-owned administrative planes provide per-organization content/posts/listings/store status, analytics from actual reads, flagged reports, integration health, staff roles, storage budget and receipt audit. Unreadable is unavailable, not 0.
6. Source-level and hosted benchmarks: p50/p95/p99 by route and tenant cohort, error budget, throughput saturation, connection-pool limits, queue time, db slow queries, bandwidth/egress cost. Do not claim operational capacity absent load evidence.
7. Test matrices: cross-tenant deny; no paid entitlement required to create a free listing; one public listing per approved source; public browsing never reads private catalog rows; owner consent revoked -> feed stops; TOS mismatch blocks; copyright report accepts and flags; unsupported text/media mime/length denied; refund and checkout never authorized by social posting.

## Marketing and monetization
Public promise: **Join for free. Build your presence. Sell what you own. Grow on your terms.** The three paid studios' premium software products remain optional under transparent tier/usage rules. The public no-sign-up free tool baseline remains separate (3 parent tools, 4 per child). Use original 15–30 second video examples per sector and license-cleared audio, with captions and no invented testimonials. Measure real activation, repeat visits, first content post, approved listing-to-sale conversion, reports/appeal latency, safety load, cost per monthly active user, free-to-paid optional product upsell, retained users.

**Research grounding:** US Copyright Office DMCA agent directory/notice criteria https://copyright.gov/dmca-directory/ ; FTC endorsements https://www.ftc.gov/news-events/topics/truth-advertising/advertisement-endorsements ; FTC reviews rule Q&A https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers ; Supabase RLS https://supabase.com/docs/guides/database/postgres/row-level-security ; W3C WCAG 2.2 https://www.w3.org/TR/WCAG22/ . Other markets (EU DSA, UK Online Safety Act, state privacy, seller tax reporting) require fact-specific review before expansion; do not assert worldwide compliance.

## Engineering boundary
Source addition: `lib/sonara-free-platform-surface-policy.cjs` + `tests/free-platform-surface-policy.test.js`; **a policy and test contract only**, no live composite feed, subscriptions removed globally, table added or payment policy changed. Existing Business Builder/Creator/Growth routes remain in charge of actual permissions and merchant commerce. Use an explicit future reviewed PR to wire any new public feed or provider connector. Production remains OFFLINE.
