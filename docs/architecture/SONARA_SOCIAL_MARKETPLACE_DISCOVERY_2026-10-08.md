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

## October 9 Phase 3: individual viewer preference CAS and consent evidence (DRAFT)

**Repo components:** lib/sonara-social-preference-policy.cjs and
docs/sql-proposals/social-feed-viewer-preferences-cas.sql.
The SQL file is a **review-only proposal**, not a Supabase migration or
statement of applied database changes. The preference policy is a pure
non-executing mutation proposal, not a route.

### Live schema inspection (read-only, connected preview only)

The accessible project ref yqncsonkxgwhcxedgevk reports ACTIVE_HEALTHY on a
PostgreSQL 17 preview channel; it is **not verified as SONARA production**.
Its public schema has user_preferences and profile_settings with personal
user_id columns, but user_preferences also has an optional workspace_id and
stores language, units, appearance and general notifications. It has existing
self-scoped authenticated SELECT, INSERT and UPDATE policies. Creator follows,
Growth channels/posts and reports already have their own tables. We did not
read any customer preference values or mutate the database.

**Decision:** do not mix personal social privacy with tenant workspaces or
introduce duplicate follow/report/block tables. Propose a single user-owned
record in an *unexposed* sonara_social_private schema, with an append-only
Discover consent decision record. Actual blocks/follows must come from their
canonical verified security sources. Age, country and membership are also
separate trusted inputs, not user-editable social preference fields.

### Supported proposal mutations

- Add/remove topic; mute/unmute topic or normalized whole-word keyword
- Hide/unhide one public post UUID
- Set generated-content preference to include, reduce or exclude
- Opt into Discover **only with independently verified, version-bound consent**
- Opt out of Discover without requiring a new consent receipt

All mutations require a server-authenticated actor ID, matching personal
record owner, a complete valid setting record, a positive current revision and
an exactly matching expected revision. Invalid or oversized inputs deny.
Unknown command fields deny rather than being silently dropped.
The planner's returned object is a **candidate only**; it never writes SQL,
emails customers, changes blocks/follows or publishes anything.

### Atomic write proposal and guarantees

The unexecuted SQL design uses a private schema, explicit grants, RLS, service
role restricted to approved server code, a single viewer_id primary key,
row-locked FOR UPDATE serialization and expected revision compare-and-swap.
It records Discover opt-in and opt-out changes in a consent event table.
The storage engine must reject stale writes and must not auto-retry a stale
unblock or undo newer privacy choices. Consent writes must be atomic with
their audit event. A missing initialized row is an error, not an empty set.

**Critical boundary:** a Supabase service-role credential bypasses RLS and
can directly write if it has table privileges. The CAS function protects only
callers that actually use it; it cannot contain a compromised service-role key.
The runtime must authenticate the viewer and use a trusted restricted DB
adapter. The private-schema function is SECURITY INVOKER, not an exposed
SECURITY DEFINER RPC. A new database connection/role, PostgREST schema
exposure and all grants require separate independent assessment.

### Before PostgreSQL acceptance

1. Verify which Supabase project is truly production and compare migration
   checksums and source-controlled security policies.
2. Use Supabase CLI to generate a numbered migration **on an isolated clone**;
   review schema/grants, row ownership, retention and deletion behavior.
3. Prove two simultaneous writers on the same viewer + expected revision
   yield exactly one accepted changed revision; run two-session PostgreSQL
   tests, not just mocked JS.
4. Test missing-row, forged viewer ID, anon/authenticated role denial,
   service-role-only function execution, zero grants in exposed API schemas,
   rollback of consent audit insertion failure, user export/deletion.
5. Verify real viewer session revocation, tenant A/B isolation, and that block
   changes cannot be bypassed by following, messaging, or comment actions.
6. Complete full exact-head pnpm, Node, security, RLS, browser and release CI
   and protect main. Only then consider owner-approved one-account sandbox
   preview behind an OFF-by-default flag.

**This change neither merges #602/#603 nor restores the intentionally offline
website.** No production data or customer permissions are changed.

### Reference basis

- Supabase RLS and Data API grants:
  https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase SELECT/UPDATE ownership, security definer and search_path guidance:
  https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
- Google Play UGC rules for blocking, reporting and ongoing moderation:
  https://support.google.com/googleplay/android-developer/answer/9876937
- Apple App Store user-generated-content guideline 1.2:
  https://developer.apple.com/app-store/review/guidelines/

## October 9 Phase 4: verified Growth public projection gate (DRAFT, unmounted)

**New source:** lib/sonara-growth-public-projections.cjs; **stacked on PR
#606**. Implements a pure, read-only projection builder suitable for plugging
into the Phase 2 feed reader only after real source/security adapters are
approved. This branch does not register Express routes, add DB columns,
execute SQL, publish content, send messages, alter customer records or
reinstate the intentionally offline website.

### Grounding: live schema read-only evidence

The connected Supabase PostgreSQL 17 preview project has the existing:
growth_channels(id, organization_id, handle, state, updated_at, ...),
growth_channel_posts(id, organization_id, channel_id, state, body, kind,
created_at, updated_at, author_user_id, ...), growth_channel_directory,
growth_post_reports, creator_artist_profiles, and creator_follows.

**Important negative findings:** these Growth tables do not carry approved
moderation, cleared licensed distribution rights, verified AI/sponsorship
disclosure, audience classifications or a complete publish/revoke
attestation. Inspecting pg_policies showed no SELECT/UPDATE policies on
the Growth tables in this preview project; reads in the existing website use
server-side service-role credentials and route-specific reviewed filters.
Existing post report data is NOT moderation approval. There were no
non-internal update triggers on growth_channel_posts or growth_channels
in the connected preview, so updated_at alone is not immutable proof of
unchanged content. A table-name inventory found license_reviews and
growth_post_reports, but did not establish an authoritative approved
social content attestation table. Do not map those tables by name alone.

The platform MUST NOT upgrade a live public Growth post into recommended
content merely because its channel has state=public, the post has
state=published, or its creator profile has a public handle.

### Proposed attestations (not currently created)

The independent, server-controlled moderation/rights/disclosure authority
must produce short-lived post ID, channel ID, organization ID, post/channel
timestamp version matches, SHA-256 contentDigest, approved moderation,
cleared distribution rights, explicit sponsorship and generated-media
booleans, general/mature rating, approved country scope, topic, explicit
rubric-backed quality/diversity and originality boolean, issuance timestamp
and expiry. SHA-256 binds approval to the current canonical post bytes,
channel routing and state even when updated_at fails to move. **The hash is
not a signature or proof that a reviewer approved it.** The future adapter
must independently validate issuance, reviewer identity/authority,
revocation and policy version. This module cannot authenticate an injected
callback or handle real-time moderation revocation without a source read.

- A publication edit invalidates the old content digest; the content should
  disappear from discovery pending a fresh review.
- A channel becomes hidden or a post removed: excluded, even if an earlier
  approval remains.
- Rights missing/unknown, sponsored or AI field absent: exclude rather than
  assume false.
- Country/age rules are forwarded to the existing viewer policy for
  enforcement. Raw profile voice identities, private prompts, org IDs,
  payment records, report notes and full post bodies never leave the
  projection builder.
- A personal muted keyword is not reciprocal account blocking. Actual
  blocking must come from the canonical, authenticated block state and be
  tested across direct messages, follows and public interactions.

### Data flow / authorization boundary

Trusted server-only source reads at most 250 canonical Growth post/channel
pairs, with current status and identical organization ownership; a separate
trusted attestation reader answers for those post IDs. The module rejects
duplicate post IDs and ambiguous/injected attestation sets. Stale, missing,
denied or mismatched evidence excludes that candidate; failed source reads
deny the entire operation. The module returns only explicit public fields.

No new creator profiles, restaurant menus, business listings or marketplace
assets are automatically ingested in this phase. Every product needs its
own content-safe public read model, rights model and audience/age proof before
participating. Do not create an owner-inferred social graph from payment,
workplace or email contacts.

### Acceptance tasks before runtime

1. Resolve production database identity and migration checksums. Keep the
   current connected preview separate from unverified production.
2. Establish an independently governed moderation/rights/disclosure
   authority with public-content revision/digest proof, revocation and
   human report/appeal workflows. Define who may issue each attestation.
3. Replace in-memory callback test seams with server-controlled, limited
   credentials and verified canonical row selection; prove no wildcard
   service-role reads into private creator/business tables.
4. Prove native PostgreSQL source joins, tenant A/B cross-read denial,
   content edit/revocation races, duplicate entries, proof expiry and
   rollback. Verify published post timestamps and any planned version
   triggers in an isolated DB.
5. Enforce authenticated rate/cost limits and approval-gated flags; run
   the exact-head CI matrix, then one tenant canary only when authorized.
6. Resolve draft PRs #602, #603, #606 and other moderation/security PRs
   in dependency order, protect main and separately approve any live
   website restoration.

### Test and research evidence

Source + tracked tests passed **62/62 in an isolated JavaScript harness**
including 19 asynchronous tests. The harness used a non-cryptographic
stand-in for the Node crypto API to exercise digest binding logic; normal
Node crypto SHA-256, native PostgreSQL concurrency/RLS, full Mocha/pnpm,
Node 24/22 CI, production connectors and live browser checks are NOT
established by that harness. No database migrations applied.

References:
- Supabase safe views and privileges:
  https://supabase.com/docs/guides/database/views
  https://supabase.com/docs/guides/database/postgres/row-level-security
- OWASP API object authorization, selective field authorization, budgets:
  https://api-security.owasp.org/editions/2023/en/0x11-t10/
  https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/
- Google Play and Apple public UGC user reporting/block rules remain
  independent deployment requirements, not satisfied by this module.
