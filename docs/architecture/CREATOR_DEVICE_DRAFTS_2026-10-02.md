# Creator device drafts — 2 October 2026

Review by: 2026-10-16

Continues main `3b60e8dea4be748e8e0f47135586eabdb54e7e73`. The local baseline was verified against the complete GitHub tree `d0aae4c1b76f177126e62a322df898eb7dfab5bc`, preserving the preceding ChatGPT and Claude implementations.

## Working interface

| User action | Destination | Result |
| --- | --- | --- |
| Edit a local caption, source duration, clip trim or mute | Existing `/creator-studio/projects/:id` page | Same canonical graph rules as the server; no provider call or automatic upload |
| Save draft on this device | Browser IndexedDB `sonara-creator-drafts-v1/drafts` | Account/workspace/project-scoped snapshot, committed only after transaction completion |
| Open saved draft | Same project's local editor | Restores the original workspace revision and graph; does not adopt a newer cloud revision |
| Open project JSON | Explicit local file selection, up to 2 MB | Validates the project identity, metadata and graph; unknown metadata is discarded |
| Download local draft | Browser Blob download | Portable project JSON from the current draft without signup changes or provider credentials |
| Forget saved draft | Same project key, local revision check | Removes only the explicit saved device copy; current in-memory work remains downloadable |
| Save draft to workspace | Existing project commands endpoint, `restore_snapshot` | Fresh identity/subscription checks, source authorization and atomic project-revision comparison |
| Download SRT captions | Existing `/api/creator-studio/projects/:id/export/srt` | Deterministic ordered SubRip cues with millisecond timing and escaped user text |

Existing project tables and mutations remain authoritative. No migration, duplicate media store, automatic campaign or provider dispatch is introduced. The public tools remain exactly four per child and three for the parent. Workspace access remains direct through the existing subscription guard.

## Module design

The browser-safe graph core moved to `public/creator-project-graph-core.js`. Its interface is shared by the Node export/store adapter and the browser editor, keeping validation, identity, timing and edge derivation in one implementation. Server SHA-256 export hashing remains server-side.

`createDeviceProjectStore` exposes read/save/forget/close through one IndexedDB adapter. Save and forget compare a local revision inside the same readwrite transaction as the mutation. Failure, abort, unavailable storage and unreadable records remain distinct from a successful empty read. Nothing is persisted automatically; downloads stay available after storage errors.

Workspace restore crosses the existing `command()` seam. The caller's captured user/organization scope is compared with freshly resolved server identity and never selects the tenant. The original snapshot revision must match the requested and current revisions. Project identity and medium must match, source permissions are rechecked, and the final PATCH retains its revision filter. An archived project cannot be restored through a draft upload. Extra snapshot fields cannot change project ownership, title, billing or credentials.

Conflicts, expired access, source revocation, malformed responses and lost responses preserve the local graph. Successful sync never silently writes or deletes device storage. If local edits happen while a sync response is pending, those edits remain local and downloadable; the response does not replace them. No automatic retry acquires a newer cloud revision.

## Device and research boundaries

This supports disconnected editing in an already-open, previously authorized project page. It does not cache private HTML or claim an offline private-page launch. The public-only service worker policy remains intact. Device drafts contain text and references; audio files, avatar data, tokens, signed URLs and model weights are not cached. Saved drafts are not encrypted or automatically erased at logout; the user controls the explicit forget/download actions. Browser storage can be evicted, so the editor offers a portable backup.

The renderer continues to use the saved workspace graph until the page reloads after a confirmed sync. Local draft downloads do not render or publish media, establish rights clearance, or enable a marketplace. Optional providers keep their actual quotas and configured included allowances; these local edits require no additional purchase.

Patterns were taken from existing governed research, not copied third-party implementations: `sonara-market-expansion-schema-plan.cjs` field-offline version/authorization/minimized-persistence contracts, Batch 21's visible offline/stale state, and the existing Creator Project Graph validation/source adapters. No research-only runtime or new dependency was installed.

Primary sources checked on 2 October 2026:

- [W3C Indexed Database API](https://www.w3.org/TR/IndexedDB/): transaction scheduling, commit and abort behavior; version 3 is a Working Draft.
- [MDN IDBTransaction](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction): browser transaction lifecycle.
- [MDN storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria): storage failure and eviction behavior.

## Validation and remaining work

Server tests exercise shared browser/server validation, snapshot identity and metadata reduction, SRT bytes, tenant and private-generated-source refusal, account changes, archive refusal and concurrent cloud updates. Browser tests use the shipped markup/scripts and real IndexedDB, with controlled HTTP responses for conflicts/ambiguous saves and in-flight edits. They cover opt-in persistence, disconnected use, restoration after remount, account/workspace key isolation, competing tabs, transaction abort and downloadable retained work. HTTP tests separately cover the real store and paid route guards.

Local validation passed: 5,481 server tests (six existing pending), 17 browser checks, frozen-lockfile install, moderate-level dependency audit, typecheck, lint, build, documentation checks and repository verification gates. Native PostgreSQL migration replay was skipped locally because PostgreSQL is unavailable; CI must run its required replay. The browser runtime was isolated outside the repository and used standard browser security; no application dependency changed.

Read-only production inspection on 2 October found the active, source-pinned Supabase project with `creator_projects`, row-level security and generation reservation storage/RPC present. Vercel's production deployment was READY at baseline `3b60e8dea4be748e8e0f47135586eabdb54e7e73`. Those observations describe the preceding release, not activation of this change.

The existing storefront, Creator marketplace and Growth community foundations still need real buyer checkout/delivery grants, published storefront/order reconciliation, feed/comments/moderation and broadcast transport. General offline launch, media caching, avatar/offline-device flows, local GPU models and subscription-wide provider accounting remain separate execution work. Their catalog records are not relabeled as installed or live.

Production activation still requires exact-head CI, the controlled release pipeline, subscribed-user/two-tenant checks and deployment evidence. Passing a local test or merging this source does not prove hosted activation.
