# SONARA restaurant → Creator → Growth → network planning engine
**Assessment:** 2026-10-09 · **Scope:** Source-only prototype for an application OS, not a device operating system.
**Production claim:** None. No endpoint, feature flag, tenant database migration, provider credential, public post, booking, charge, customer message or deployment is added by this change.

## Target customer outcome

A restaurant operator chooses a menu offer and estimates whether the kitchen can fulfill it; a creator prepares rights-cleared media; Growth Studio proposes a bounded distribution and attribution plan; SONARA's opt-in public network may ultimately show the approved promotion. Each product remains a separately marketable customer workspace. SONARA One coordinates identity, access, records, approvals, jobs and evidence, rather than mixing their private databases or publishing drafts automatically.

| Product | Proposed owner-visible record | Read/write boundary | Execution proof still needed |
| --- | --- | --- | --- |
| Business Builder | Recipe/menu cost, ingredient and labor availability, reservation/order/service capacity | Canonical business workspace scoped by organization | Stock reconciliation, signed order and booking evidence |
| Creator Studio | Storyboard, footage, clip candidates, transcript/captions, contributor rights | Creator project and private media grants; no automatic public copies | Provenance, release and human content approval |
| Growth Studio | Campaign draft, send permissions, budget, channel attribution and measurement | Approved channel, consent and provider grants | Owner-signed launch, provider IDs, delivery and conversion reconciliation |
| Parent public network | Sanitized restaurant/creator listings, interest discovery, report/block/appeal | Approved public projection only, never private tables | Moderation queue, block/report enforcement, customer-facing controls |

## Implemented in this branch

`lib/sonara-restaurant-creator-growth-planner.cjs` exports `planRestaurantCreatorGrowthScenario` (deterministic, side-effect-free). `tests/restaurant-creator-growth-planner.test.js` exercises six edge-case groups.

Inputs are bounded integer cents, days, capacities, raw video duration, target clip length, qualified visits and optional observed attributed orders. No personal data, credentials, audience profiles, tenant identifiers or imported media enter calculation. Unknown attribution remains `null`, not zero. No server request or social action is emitted.

**Key equations (cents unless marked):**

- Unit contribution = menu price − variable cost − offer discount; does not include fixed overhead, tax, refunds, payment fees or delivery unless already in the supplied variable cost.
- Spare capacity = (daily order capacity − committed daily orders) × campaign days; this is a planning ceiling, not an inventory reservation.
- Observed order rate = historical attributed orders / historical qualified visits, available only at a chosen minimum sample of 30 qualified visits. This minimum is a conservative *input-hygiene heuristic*, not statistical significance or proof of incremental lift.
- Scenario demand = floor(planned qualified visits × observed order rate). Projected incremental orders = min(scenario demand, spare capacity).
- Scenario net contribution = projected incremental orders × unit contribution − campaign spend; this is **not verified campaign ROI** and attribution does not establish causation.
- Break-even added orders = ceil(campaign spend / positive unit contribution); no break-even figure when contribution ≤ 0.
- Raw clip count upper bound = floor(raw source seconds / target clip seconds); editability, transitions, captioning, licensing and creative quality may reduce usable output.

All results contain explicit `status=planning_only`, `sideEffectsExecuted=false` and `automatedPublishingAllowed=false`. Unverified readiness is a blocker, never inferred from a caller-supplied boolean. The engine only computes a *scenario* and proposed four-stage draft workflow.

## Architecture to implement next (not present)

```text
Restaurant operator (signed-in)
  -> canonical business workspace & role check
  -> actual ingredient / inventory / capacity snapshot
  -> planner (pure, bounded and versioned)
  -> proposed creator task + private media project
  -> licensed/captioned media derivatives and review
  -> owner-approved Growth campaign draft
  -> provider OAuth scope + consent + budget approval
  -> transaction/outbox + durable leased queue
  -> verified delivery and reconciliation receipts
  -> moderated public activity projection (optional)
  -> reports / blocks / appeals / takedown invalidation
  -> owner dashboard: actual conversions, cost, exceptions
```

**Application-OS responsibilities:** versioned capability registry, server-derived organization and role, action approval policy, idempotency key, bounded job lease, retries and dead-letter review, trace IDs, access-revocation handling, data-export/deletion, user-controlled notifications, quota controls and evidence receipts. Do not activate steps by concatenating arbitrary text into provider endpoints or SQL.

**Data reuse:** inspect existing `business_workspaces`, `growth_channels`, `growth_channel_posts`, `creator_listings`, `merchant_storefronts` and `merchant_products` before proposing any new tables. A new public activity projection is a separate reviewed migration, with explicit grants and tenant RLS on source records. Derive authorization from server session + membership, never `user_metadata` or caller-supplied organization IDs. A public view must not accidentally bypass RLS.

**Minimum event contracts:** `scenario_planned`, `campaign_review_requested`, `media_cleared`, `campaign_approved`, `provider_publish_requested`, `provider_publish_confirmed`, `public_projection_approved`, `content_reported`, `content_removed`. Store organization, actor, resource/version, request hash, approval identity/expiry and execution receipt in authorized server records; keep the public projection deliberately sparse. The event names are proposed, not asserted runtime events.

**Suggested social ranking:** chronological by default; opt-in Discover constrained to approved/public/licensed media, with topic mute, blocking, age/territory rights, sponsored/generated labels and publisher diversity caps. Never mix private CRM, purchase history or payment records into a public recommendation candidate. Treat any personalized-ranking weights as unvalidated hypotheses. ActivityPub could be an eventual interoperability adapter, not a shortcut around blocking, moderation or rights enforcement.

**Interactive media:** accept creator-owned source files through private storage with MIME and size validation and virus checks; produce captioned preview/vertical format derivatives through asynchronous encoding; WebCodecs can support browser-side encode/decode on supported devices, and WebRTC can support consented real-time sessions. Neither standard supplies an end-to-end editor, transcode fleet, or moderation system by itself. Avoid unlimited GPU, storage or low-latency claims without load tests.

## Release gates, in order

1. Review product data contracts and historical attribution definitions; resolve duplicate business/creator/growth entities.
2. Add authenticated draft-only endpoint and owner-visible form after server-derived tenant/role checks; rate-limit and log only safe scenario metadata.
3. Persist plan with formula version, bounded input snapshot/hash, revision and stale-data warning; adversarial cross-tenant and permission tests.
4. Implement stock/staffing validation, asset-rights proof, human-approved campaign budget and consent; no customer contact as an automatic fallback.
5. Use durable outbox and queue; idempotency and dead-letter replay before any provider write. Trace and reconcile the provider receipt.
6. Add public projection with moderation, reporting, blocking and appeals; invalidate caches and search index on takedowns and consent withdrawal.
7. Verify Playwright keyboard/mobile accessibility, p95 performance, storage/egress budget, local load tests, exactly-once business settlement behavior and exact-head CI.
8. Review platform legality, food/menu disclosure and applicable local food rules, then controlled deploy/rollback. No deployment in this branch.

## Source-grounded research

- FDA Food Code 2022 is a retail food-safety model; local adoption varies: https://www.fda.gov/food/fda-food-code/food-code-2022
- W3C ActivityPub federation recommendation: https://www.w3.org/TR/activitypub/
- W3C WebRTC recommendation (2025): https://www.w3.org/TR/webrtc/
- W3C WebCodecs Working Draft (2026): https://www.w3.org/TR/webcodecs/
- OAuth 2.0 Security Best Current Practice RFC 9700: https://www.rfc-editor.org/rfc/rfc9700.html
- OWASP API risks (especially object authorization): https://api-security.owasp.org/editions/2023/en/0x11-t10/
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Queues / pgmq: https://supabase.com/docs/guides/queues
- Google Play user-generated-content moderation and block/report requirements: https://support.google.com/googleplay/android-developer/answer/9876937?hl=en

**Honest limitation:** This implementation proves deterministic scenario calculation with focused local tests. It does **not** prove a revenue forecast, customer acquisition, legal compliance, account access, source-to-database integration, physical device compatibility, a production social platform or customer-facing activation.
