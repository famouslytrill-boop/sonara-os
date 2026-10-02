# Creator timeline workflows — 2 October 2026

Review by: 2026-10-16

Continues main `090b9904` and the Creator Project Graph, local media processing and device draft implementations merged in PRs #416–#418. This is an implementation increment, not completion of the entire company expansion request.

## Customer pathways implemented

| Action | Working destination | Result |
| --- | --- | --- |
| Split a clip | Existing project page and project commands API; local draft editor | Two adjacent clips retain source identity, original trim coverage and mute state. The original ID remains on the first piece. |
| Shift all captions | Same workspace form/API and local draft editor | Signed whole-millisecond offset applied atomically; any out-of-bounds cue rejects the whole operation. |
| Inspect timeline | Project page and local draft editor | Duration, clip/caption counts, unused sources, muted clips, uncovered timeline duration and overlap duration. |
| Save and export | Existing device save, workspace sync and JSON/VTT/SRT/CSV pathways | The same validated graph flows through existing persistence and export code. |

Split positions are absolute timeline milliseconds, strictly inside a clip. A split adds one node and remains subject to the existing 500-node resource bound. Splitting at an edge, into a duplicate ID, or beyond the graph limit fails without mutation. Caption shifts retain text and IDs and never alter clips. The summary counts overlapping intervals once even when three or more clips overlap. Muted clips still occupy timeline space. Caption-only time is uncovered by clips; these metrics do not infer silence, missing rights or publishing readiness.

Server and browser use `public/creator-project-graph-core.js`; no second formula implementation, provider request or database table is needed. The existing `creator_projects` versioned JSON graph stores the new workflow results without a migration. Server commands retain subscription authorization, server-resolved organization scope, private generated-source checks and revision compare-and-update. Device changes remain local until the user explicitly saves or syncs.

## Repository-wide findings

The checked-in capability inventory indexes the entire route/schema/catalog surface, not just Creator files: 875 registered route operations, 337 canonical table definitions, 144 migration files, 47 deterministic formulas and 512 repository records across catalogs. It identifies 286 operations needing explicit data-contract review, 84 workspace-home destination fallbacks and 41 tables not queried by runtime source. These are unresolved engineering findings; route presence is not end-to-end operational proof.

The separate primary open-source register contains 269 entries: nine adapter-built records, 49 optional-adapter-after-review records, 51 research-only records, 90 reference-only records, 50 blocked records, 16 needing license review and four needing security review. The opportunity report identifies 42 low-license-risk, non-reciprocal candidates with permitted-after-review posture. Existing metadata is discovery evidence, not fresh upstream license verification or production enablement. No third-party runtime was promoted in this increment.

The public-tool contract already matches the owner's requested count and remains covered by tests:

| Company | Anonymous tools with results before signup |
| --- | --- |
| SONARA One | Data formatter, text fingerprint, storage budget |
| Business Builder | Break-even, reorder point, offer builder, pricing |
| Creator Studio | Rate card, split sheet, creative brief, release checklist |
| Growth Studio | Budget split, referral reward, campaign outline, KPI calculator |

## Remaining requested scope and acceptance evidence

| Product/workstream | Existing foundation to extend | Completion proof still needed |
| --- | --- | --- |
| Parent platform | Identity, subscriptions, connector registry, workspace directory, route/capability inventory | Resolve destination/data-contract gaps; verify each paid plan unlocks its implemented workspace; independent export, recovery and support paths |
| Business Builder storefront | Catalog, offers, merchant records, connected payments, invoices/work orders | Real tenant storefront, buyer checkout, webhook replay safety, order reconciliation, fulfillment/refund lifecycle and cross-tenant tests |
| Creator marketplace/media | Projects, assets, generated outputs, offers and local audio/image processing | Licensed buyer delivery grants, seller lifecycle, video render/preview, waveform/timeline UI, cancellation and reproducible render receipts |
| Growth social platform | Profiles/follows, campaigns, leads, consent, calls | Feed/posts/comments, report/block/moderation, event RSVP/ticket lifecycle, broadcast/radio transport and public/private authorization proofs |
| Profiles and device use | Existing profile routes, private storage, explicit permissions and scoped drafts | Avatar upload/edit/delete, device capability detection, denial/revocation handling, user-controlled camera/microphone/contact/location flows |
| Local CPU/GPU/storage | Browser workers, deterministic WAV/image processing and IndexedDB drafts | Device benchmarks, video/model resource limits, CPU fallback, cancellation, offline-launch policy and recovery on storage eviction |
| Optional AI/MCP/connectors | Provider Gateway, adapters, generation jobs and included reservations | Verify each upstream integration and license, credential setup/health/revocation, tenant scope, provider quota handling and plan coverage |
| Independent company operation | Separate workspace routes on shared services | Product-specific health, backup/restore, exports, customer support and standalone operational exercises |
| Broader engineering/CAD/maps/gaming | Governed research and module catalogs | Pick concrete executable workflows with supported formats and devices, then implement and test them; catalog records alone do not fulfill these capabilities |

Keep self-serve subscription pathways without quote or special intake requirements. The owner's final instruction preserves provider rate limits. Device resource bounds and provider constraints remain explicit; a subscription cannot make an unconfigured upstream service operational. No additional purchase is introduced by these timeline workflows.

## Research used

The implementation applies existing repository research on immutable project edits, deterministic decisions, version conflicts and explicit local retention. It is SONARA-owned code, not copied repository code. The browser architecture was checked against [MDN Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) on 2 October 2026: dedicated workers operate outside the DOM and exchange messages with their creating page. Existing audio work stays in that worker; bounded graph editing remains in the shared core.

## Validation

Local verification: pnpm 12.7.0 frozen-lockfile installation and moderate-level audit passed; typecheck, lint and build passed; 5,485 server tests passed with six existing pending checks; all 18 browser checks passed. OpenAPI verified 312 operations and the route registry verified 875 registrations without duplicates. Repository verification gates passed, with native PostgreSQL migration replay explicitly skipped because local PostgreSQL binaries are unavailable. CI must execute native replay. The official Playwright browser download was truncated; local browser evidence used isolated test-only Chromium 153.0.0 with GPU disabled and standard web-security settings. No browser package was added to application dependencies. Production database changes and deployments are not part of this increment. Exact-head CI and browser checks must pass before merge; merging source does not establish production activation.
