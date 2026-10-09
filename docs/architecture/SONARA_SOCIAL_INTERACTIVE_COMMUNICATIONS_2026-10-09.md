# SONARA Social and Interactive Communications — Engineering Wave (2026-10-09)

## Scope and honest status

This branch adds an executable pure preflight library: lib/sonara-social-interaction-gates.cjs, plus adversarial unit tests. It is **not mounted into an endpoint**. It neither sends messages, publishes posts, creates live sessions, nor writes database records. No tables, provider credentials, deployed infrastructure, billing, or real customer data are touched. It MUST NOT be advertised as a working social network or live-media service.

Reuse these existing SONARA assets rather than replacing them:
- routes/sonara-growth-channel-routes.cjs: published merchant channels, public posts, anonymous abuse reports and Atom feeds; not a person-to-person messenger.
- lib/sonara-community-discovery.cjs: unmounted cross-product opt-in discovery candidate algorithm, with chronological default, moderated/rights-cleared candidates, blocked authors and muted topics.
- lib/sonara-free-platform-surface-policy.cjs: the parent and three studios share free core social usage policy, not implicit authorization.
- Creator Studio: creator project, source assets, media workflows, rights and licensed delivery. Growth Studio: public channels and campaign workflow. Business Builder: customer/merchant/appointments. SONARA One: shared identity and consent.

## New shared interaction gate

Actions: follow/unfollow, react, comment, report, block/unblock, mute/unmute, direct-message candidate, publish media candidate, start-live candidate and join-live candidate.

Context MUST come from server-controlled authenticated session, tenant membership, public target projection, moderation/rights evidence, consent receipts and transactionally acquired rate-budget/idempotency leases. Never trust browser JSON that says role=true or approved=true.

Decision order:
1. Known action, valid UUID actor/tenant, server-verified tenant match and free-surface permission.
2. Bounded idempotency key, atomically reserved abuse-rate allowance and validated target for relational operations.
3. Reciprocal block state, public target visibility, existing target moderation and separate comment moderation.
4. Reporting remains allowed for a blocked or removed target so victims can report harm; the report must be processed by an authorized reviewer, not auto-takedown.
5. DMs require recipient opt-in and inbox enabled; a missing block read or consent record denies delivery.
6. Media publication needs cleared rights, moderation, owner approval, consent/release evidence for identifiable people, and image alt text / audio transcript / video captions.
7. Live sessions additionally need working transport, real-time captions, staffed moderation and a tested kill switch.
8. Notification intents require explicit per-channel user opt-in, readable preferences, no suppression, quiet-hours handling, provider readiness, idempotency and budget; marketing separately requires campaign approval and marketing consent.

Positive decisions always return state=preflight_only and sideEffectExecuted=false. Future transactional code MUST revalidate everything, claim its idempotency and rate budget atomically, then persist the outcome and send only from a durable worker. Existing anonymous Growth channel reporting stays separate from this proposed authenticated network reporting.

## Data model proposal — NOT migrated

| Logical record | Authority and safety |
| --- | --- |
| Social profile | Supabase auth actor; separate allowlisted public projection |
| Follow/block/mute | directional actor/target edge, unique active relation, revocation timestamp |
| Public post | published+moderated+rights-cleared projection, private tenant content never copied |
| Comments/reactions | post/actor association, moderation, abuse caps, tombstones |
| Abuse reports/appeals | durable target record, reason, reviewer state, reporter-safe visibility |
| Media rights and provenance | asset ref, rights/release receipts, labels, alt/caption/transcript proof |
| Consent/preferences | versioned purpose+channel+recipient consent, revocations and quiet hours; off by default |
| Conversations/members | read and write grants derived per participant and tenant |
| Notification intent/attempt | source event, unique delivery key, provider ack, retry/dead-letter status |
| Live sessions | owner, lease, start/end state, active moderation, disconnect/kill-switch evidence |
| Audit log | actor, operation, server time, decision code; no plaintext secrets |

Before writing any migration, inventory existing canonical tables. Enforce RLS, explicit grants, SELECT projections for public content, with-check tenant scope for writes, and adversarial cross-tenant tests. Confirm which Supabase instance is production. Never apply schema updates solely because this plan names a table.

## Interactive media blueprint

| Feature | Implementation path | Honest fallback |
| --- | --- | --- |
| Image posts | approved thumbnails, original asset provenance, text alternative | accessible text card |
| Short video/audio | queue → transcode → caption/transcript → CDN/object storage → playback events | poster+transcript, never fake render |
| Realtime audio/video | authenticated signaling, WebRTC perfect negotiation, TURN; SFU for groups; moderator console | disconnected state, no fake live event |
| Discussions | existing public channels first; then opt-in follows/comments/reactions | chronological feed/Atom |
| Customer service | tenant-scoped inbox, routing, assigned owner, escalations | existing contact/lead request |
| Notifications | outbox → opt-in gate → bounded delivery worker → provider acknowledgment → audit | in-app pending/failed state |
| External social | OAuth-scoped provider adapters, approval, provider quotas and idempotency | explicit manual share/export |

WebRTC does not replace persistent chat history, TURN, SFU or a moderation service. Any cross-provider broadcast or video render must respect contractual rights and capped resource budgets. Do not claim zero latency, unlimited generation or unrestricted auto-posting.

## Formulas and measurable release criteria

- Public visibility = published AND moderated AND rights-cleared AND publicly projected AND age/territory eligible AND not blocked.
- Chronological feed = sort(published_at DESC, id ASC); no behavioral tracking required.
- Discover = existing opt-in, explainable bounded weighted ranking with a per-publisher cap; do not claim competitors' confidential formulas.
- Notification eligibility = tenant_authorized AND channel_opt_in AND not_suppressed AND provider_ready AND idempotency_claimed AND budget_reserved.
- Backoff seconds = min(max_delay, base_delay * 2^attempt) * bounded_jitter; cap attempts, then dead-letter and alert.
- Delivery receipt rate = provider_acknowledged / provider_attempted. Measure p95 queue age and delivery-lag; never treat queue acceptance as customer receipt.
- Customer metrics = onboarding-to-first-approved-post, response time, report-to-review time, block enforcement errors, opt-out effectiveness, accessibility defects, p75 media startup, and verified retained users.

## Activation sequence

P0: Resolve current exact-head failed CI, branch protection, security scans, production environment identity and rollback proof. No bypass or blind deploy.

P1-A: Inventory canonical identity/UGC/notifications data; implement transaction-safe follow/block/report/appeal RLS and verified moderated public projection.

P1-B: Add scoped conversation persistence and notification intent outbox, DMs only by explicit recipient consent, quiet-hours settings, opt-out, reliable worker receipts and dead-letter recovery.

P1-C: Wire the existing discovery selector to server-owned moderated projections, honoring revocations; add reachable social UX, report/block buttons, chronological toggle and recommendation explanations. Test mobile keyboard focus, screen readers and reduced motion.

P1-D: Introduce image/video/audio proof gates in actual publication handlers. Gate live rollout on TURN/SFU, monitored transport, live captions, operator moderation, stop control and load testing.

P1-E: One-tenant feature-flagged canary, negative tenant/consent/replay tests, real provider proof, budget alerts and owner approval; only then request public expansion. Keep publishing, messaging and broadcasting off by default until evidence exists.

## Upstream research

- OWASP API Security Top 10: https://api-security.owasp.org/editions/2023/en/0x11-t10/
- W3C ActivityPub inbox/outbox: https://www.w3.org/TR/activitypub/
- MDN WebRTC perfect negotiation: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
- W3C Push API: https://www.w3.org/TR/push-api/
- W3C prerecorded caption accessibility: https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html
- Apple user-generated content rules: https://developer.apple.com/app-store/review/guidelines/
- NIST 800-63-4 identity guidelines: https://csrc.nist.gov/pubs/sp/800/63/4/final

## Non-goals

No real chat, feed delivery, live streaming, notifications, schema writes, server routes, automatic fan-out, payment transactions or production promotion are authorized by this branch. Research, tested preflight, migrated persistence, tested runtime and activated product are separate maturity states.
