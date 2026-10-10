# SONARA Public Network, free services and discovery — 2026-10-08

The parent public network connects opt-in identities, creator portfolios, merchants, communities and their child-product workspaces. Free core social use, free marketplace listing/participation and free storefront creation require no SONARA subscription. Seller product prices, provider processing fees, taxes, shipping and optional resource-intensive media are separate. Public browsing may remain anonymous; publishing requires a verified account, ownership and moderation.

Business Builder contributes published merchant catalogs, local services, events and offers. Creator Studio contributes approved previews, provenance, rights records and licensed assets. Growth Studio contributes public channels, posts, campaigns and social profiles. Parent discovery uses **public sanitized projections only** and returns to the owning child app for write/checkout/delivery. Do not join tenant-private transactions into a public feed.

Research 2024–2026: TikTok's June 2025 Manage Topics/keyword controls and Nov 2025 generated-content labels suggest opt-in preferences and AI visibility controls; Meta 2025/26 publicly reports cross-app recommendation personalization and an emphasis on newer original posts. Treat secret competitor algorithms as unknown. References: https://newsroom.tiktok.com/tiktok-trending-summer-2025-plus-new-ways-to-shape-your-feed?lang=en-150 ; https://newsroom.tiktok.com/more-ways-to-spot-shape-and-understand-ai-generated-content?lang=en-GB ; https://about.fb.com/news/2026/01/2026-ai-drives-performance/

This branch adds a pure, NOT YET SERVED component at lib/sonara-community-discovery.cjs: chronological default, verified-public eligibility, moderation and rights gates, blocked author/muted topic filters, opt-in Discover, labeled generated media, deterministic diversity caps, bounded inputs and public-safe output. No personal data tracking or provider calls. Tests are appended to the existing free-platform test suite.

Next before a route: verify publisher/member access against canonical tables, obtain authoritative public projection data, add real block/report/follow controls and appeal records, enforce quota, show user-facing recommendation explanations and chronological toggle, test minors and abuse. Store policies require UGC moderation, reporting and blocking: https://support.google.com/googleplay/android-developer/answer/9876937?hl=en

Do not say a proposed social endpoint or marketplace route is live merely because this document names it.

## October 9: customer-controlled feed integrity (draft branch, no live rollout)

The pure discovery candidate policy now accepts `hiddenContentIds` (post-level
"Hide"), `mutedKeywords` (whole word or exact phrase, Unicode-normalized),
`blockedPublishers` (existing user-account block projection) and
`mutedTopics` (existing topic preference). A malformed saved list fails closed:
it MUST NOT silently revert to an unrestricted feed. The caller MUST retrieve
the signed-in viewer's settings from authenticated server-side storage before
using this module; browser-supplied preference arrays are not authorization.

Public projections with absent/malformed `sponsored` or `aiGenerated`
disclosures are ineligible instead of defaulting to an undisclosed false
value. Display clients must visibly label sponsored and generated content,
and continue to implement report/block controls independent of the Hide action.

A corrected `hasMoreCandidates` result counts only selectable items after the
per-publisher discovery diversity cap, so exhausted publisher slots do not
create a misleading "Load more" promise. It is NOT a server cursor, database
pagination, cross-request fairness algorithm, or proof that more pages exist in
the underlying source. Cursor pagination needs a bounded signed cursor tied
to consent, projection revision, filter version and strict database query
order; no such endpoint was wired in this change.

### Algorithm model and performance envelope

- Default: chronological, descending `publishedAt`; tie-break by canonical
  post UUID. `Following`: chronological and only explicitly followed users.
- Opt-in Discover candidate score:
  `0.30 topic + 0.20 quality + 0.20 exp(-ageHours/168) + 0.15 originality + 0.15 diversity - aiReduction`
  with component inputs bounded to [0, 1], `aiReduction = 0.2` only under
  the viewer's explicit reduce setting, and at most **2 posts per publisher**
  in the selected candidate set. This is an experimental, non-validated
  heuristic, not a competitor's algorithm and not a promised performance lift.
- Processing boundaries: no more than 250 candidate projections, 40 returned
  items and 200 values per preference list. The whole-word keyword filter
  uses only the sanitized *title* (not invisible/private post content);
  it is a viewer choice, **not** a safety/moderation classifier.
- Per-page hide, unblock and mute changes must be persisted with a
  viewer-authenticated setting owner; a refresh may re-expose hidden posts
  until that backend is built. Block state must also be enforced on the
  server for follows, comments, replies and DMs, not just a feed filter.

### Required runtime sequence (not implemented here)

1. Authenticate and resolve viewer, membership and age/privacy controls.
2. Fetch bounded settings and revision; deny on failure, never pretend the
   missing block list is an empty block list.
3. Read approved public projections with rights and moderation evidence;
   never join private tenant data into discovery.
4. Filter and rank; render explicit chronological/discover control, sponsored
   and generated-content labels, "Why am I seeing this?", Hide, Mute Topic,
   Block and Report actions with distinct affordances and keyboard focus.
5. Only after permissioned actions are persisted: issue signed opaque cursor,
   record privacy-minimal aggregate counters, enforce rate/abuse limits.
6. Moderate reported UGC with independent reviewer actions, appeal and
   takedown audit. Deletion/retention and legal escalation require policy
   review. No automatic customer messaging is authorized by a feed view.

### Store-policy and security basis

- Google Play UGC policy requires terms acceptance and effective reporting,
  blocking and ongoing moderation for public social apps and direct messaging:
  https://support.google.com/googleplay/android-developer/answer/9876937
- Apple App Review Guideline 1.2 requires content filtering, reports with
  timely responses, user blocking and published contact information:
  https://developer.apple.com/app-store/review/guidelines/
- OWASP API Security Top 10 emphasizes object-level authorization,
  authentication and unrestricted resource consumption:
  https://api-security.owasp.org/editions/2023/en/0x11-t10/
- AT Protocol uses signed content/account labels and stackable moderation;
  this is a reference pattern, **not** a SONARA federation integration:
  https://atproto.com/guides/labels
- ActivityPub is a separate inbox/outbox federation layer; do not activate
  without SSRF, signature, delivery replay, moderation, data retention and
  remote-identity threat review: https://www.w3.org/TR/activitypub/

### Acceptance gates and evidence status

- Isolated pure-JavaScript checks exercise hide, mute, sponsor/gen disclosure
  and terminal candidate indicators. Additional repository Mocha regressions
  are included on this branch.
- No full `pnpm` suite, CI-green SHA, live signed-in customer action,
  production database migration, persisted preference service, public feed,
  media streaming room, chat or push delivery is established by this patch.
- Merge only after Node 24 CI, lint, typecheck, `pnpm test`, build, security
  gates, tenant/RLS adversarial tests, a browser/accessibility audit and
  explicit release approval. Do not unblock the presently offline production
  website or flip social feature flags without the independent release gate.

## October 9: authenticated discovery reader boundary (stacked draft)

**Source:** lib/sonara-community-feed-reader.cjs. This is a **read-only, unmounted
JavaScript module**, built on lib/sonara-community-discovery.cjs. It does not
create a database table, route, active authenticated feed or moderation service.
It imports no credentials and sends no notification. Customer data is not
accessed by this draft.

### Trust and sequencing contract

The reader accepts four server-owned callbacks; these must NEVER be injected
from HTTP query/body fields or unverified JWT/profile metadata:

| Port | Required authoritative implementation | Failure behavior |
|---|---|---|
| resolveAuthenticatedViewer | Verify signed session, current account state and can-read-social privilege. Derive user ID from session, never caller userId. | Deny before reading settings or public rows |
| loadViewerPreferences | Authenticated user-owned preferences; complete block/follow/mute lists, explicit discovery opt-in, age verification, country, and positive monotonic revision. | Deny if missing, corrupt, foreign, or oversized |
| loadPublicProjections | Reviewed read of public-only projections, moderated and rights cleared, no tenant-private joins or service-role wildcard selects. | Deny if failed, over cap or malformed |
| clock | Trusted current time. | Deny if unavailable |

**Sequence:** validate request mode/limit → authenticate → read owner-scoped
preferences → enforce Discover consent → load bounded public projections →
**reauthenticate** → **reload preferences** → compare revision and exact
whitelisted policy snapshot → run existing public/rights/block/age/territory
filters → emit public-safe records only.

Any mid-read account change, session revocation, preference change or provider
exception returns an error with **zero content items**. The module never
serializes session IDs, organization IDs, raw preferences or provider errors.

The callbacks' ok:true, canReadPublicSocial:true and fresh:true fields are
test seams, **not production proof**. Real callbacks must verify actual
server-side identity, permission and current database state. The existing
Supabase service-role helper bypasses RLS; a server request is not automatically
tenant-safe.

The double-check detects changes at two request boundaries, but cannot stop a
mutation between the final read and HTTP delivery or replace atomic database
snapshot/transaction guarantees. Follow/comment/DM blocks need independent
write-side authorization.

**Caps:** 250 candidate rows, 40 returned rows, 200 entries per preference
list. hasMoreCandidates describes the bounded batch only, not persistent
pagination or underlying-source exhaustion.

### Runtime prerequisites (not implemented here)

1. Reconcile canonical user, creator, channel and report/block tables and the
   correct production Supabase project; establish migration, grants, RLS and
   two-user tenant isolation on an isolated database.
2. Implement viewer-owned preferences with revision/CAS, explicit consent
   receipts, export/delete and authenticated session verification.
3. Implement a **server-owned** public projection source (no tenant-private
   business, creator license or transaction rows), and prove source whitelists.
4. Add a feature-flagged read-only route only after middleware, authorization
   and source evidence; enforce authenticated rate limits and abuse monitoring.
5. Independently reconcile moderation/report/block draft branches #572, #573,
   #575 with review, PostgreSQL replay, operator staffing and appeal handling.
6. Run exact-SHA CI, browser/keyboard/mobile checks and a one-tenant private
   canary before any public activation. Keep the site offline unless separately
   authorized for restoration.

### Research verified October 9, 2026

- Google Play UGC policy requires terms acceptance for UGC creation and
  reporting and blocking appropriate for public social/DM experiences:
  https://support.google.com/googleplay/android-developer/answer/9876937
- Apple App Review §1.2 requires filtering, prompt reporting response, user
  blocking and contact information; February 2026 guidance clarified
  random/anonymous chat also falls under 1.2:
  https://developer.apple.com/app-store/review/guidelines/
  https://developer.apple.com/news/?id=d75yllv4
- OWASP API Security Top 10 2023 highlights object authorization and bounded
  resource consumption:
  https://api-security.owasp.org/editions/2023/en/0x11-t10/

These are engineering references, not platform approvals or legal findings.

### Evidence and status

13 additional focused asynchronous Mocha cases were appended to the existing
test entrypoint, testing double-checks, foreign preferences, changed revisions,
revocation, malformed inputs, hidden/blocked posts and exception redaction.
An isolated, in-memory JS harness executed the **32/32** test cases in that
file without failures. This is not the full Node 24 Mocha, pnpm, typecheck,
lint, build, CI, native PostgreSQL, browser or production test suite.

This branch stacks on PR #602. Neither branch is merged or deployed.
