# Creator Project Graph continuation — 2 October 2026

Review by: 2026-10-16

This continues merged main `48934ac82788ce1edacae567504e52b786948d9b` and preserves the preceding local included-generation/image-processing commit `1118f423`. Existing work from ChatGPT and Claude remains the foundation.

## Working changes

| Action | Existing destination | Actual result |
| --- | --- | --- |
| Change a clip's trim, timeline position or mute setting | `/creator-studio/projects/:id` and its existing commands endpoint | Validated update of the same graph entry; expected revision protects concurrent saves |
| Edit caption text/timing or declared source duration | Same project editor | Revalidation of all dependent clips; invalid shortened sources are refused |
| Generate for a project | Project link → `/creator-studio/generation?project=:id` | Tenant-resolved project validation before reservation, job insertion or provider dispatch |
| Add generated media | Project source picker | Own completed audio/music/voice/video/image outputs or stems become graph source references |
| Render audio locally | Project page → local worker → playback/download | Real 44.1 kHz, stereo, PCM 16-bit WAV from selected local recordings, applying trim, position, overlap mixing and mute |
| Start using SONARA | `/start`, `/service-catalog`, `/pricing` | Anonymous tools → plan → workspace; public quoted operator services removed |

The graph module's interface now accepts `update_source`, `update_clip` and `update_caption` through the existing command seam. Only editable fields are accepted; callers cannot replace IDs, kinds or source links by sending extra fields. Validation depth keeps timing and dependency rules local, providing leverage to both HTML forms and programmatic callers.

Sources use a fixed `origin` discriminator: absent or `library` means the existing `creator_assets` adapter; `generation` means the existing `creator_generation_assets` adapter. No caller supplies table names, buckets, paths or credentials. This is a real seam with two storage adapters. Source identity is origin plus asset ID. Edges continue to reference source node IDs. No new project tables or duplicate file storage are required; existing JSON graph snapshots accommodate the field.

Generated sources are checked against the resolved organization **and user**, allowed media/asset roles, and completed parent jobs on mutation and export. Generation downloads are already user-private; this change does not grant colleagues new file access. Organization members can still read project metadata; projects containing another member's private generated files cannot be edited/exported by that member until explicit sharing is designed. Storage-read failures are returned as failures, not empty-success libraries.

## Deterministic device processing

`public/creator-project-audio.js` parses RIFF/WAVE chunks, accepts PCM 16-bit mono/stereo 8–96 kHz, resamples with linear interpolation, mixes clips in stable ID order, emits silence for muted clips/gaps and counts clipped output samples. It writes a complete WAV header and data section. Identical graph and source bytes produce identical output bytes.

A dedicated Web Worker performs parsing and mixing. There is no media upload, microphone request, model invocation, autoplay or durable local caching. Selected files are explicit local copies, not automatically downloaded or cryptographically matched to graph assets. Sources may be up to three minutes/20 MB each and 64 MB total, the output timeline up to three minutes, and total unmuted clip work up to ten minutes. These are device resource limits. This is a basic audio renderer, not video rendering, mastering, high-quality bandlimited resampling or a full DAW. Changing files terminates in-flight work and clears stale playback/downloads; navigating away releases workers and object URLs.

The previous local image processing and included-generation reservation migration remain part of this branch. The three-minute WAV limit does not consume a provider allowance or require an extra purchase. Consent/rights controls still apply to optional provider generation.

## Public subscription journey

The public catalog contains self-serve software entries; database rows for operator services cannot reintroduce quoted purchases. Historical service requests/deliverables and the retired `business_builder_one_time` entitlement remain readable. That retired plan is hidden from pricing and returns HTTP 410 for a new JSON checkout attempt; browser submissions return to pricing. No existing entitlement or customer record is deleted.

Generation submissions have durable transport abuse protection (120 attempts per minute per account/IP, with a bounded instance fallback during database outages). This protects request bursts separately from provider quotas and subscription usage. The reservation function is named `reserveIncludedGeneration` because it reserves a verified financial allowance, while identity authorization remains in the paid workspace guard.

Exactly four anonymous tools remain for each child company and three for SONARA Industries. Paid workspace actions remain guarded. Included generation renews from verified subscription periods without top-up purchase; provider rate limits, actual configuration and the included budget still apply. This does **not** claim every metered Growth/Business provider operation has moved into that allowance.

## Repository findings and remaining execution work

The generated capability map covers 875 registered route operations, 337 canonical table definitions, 178 migrations, 47 executable formulas and 512 repository records across catalogs. These are inventory counts, not evidence that every route or repository is live. The map still exposes 286 routes needing explicit data-contract review and 84 workspace-home fallbacks. Research records remain distinct from executed integrations.

| Area | Next concrete execution requirement |
| --- | --- |
| Creator marketplace | Seller onboarding, actual buyer checkout, immutable license/delivery grants and dispute lifecycle |
| Business storefronts | Tenant storefront pages, catalog/cart/checkout and order/delivery reconciliation |
| Growth community | Posts/comments, report/block/moderation, events/RSVP/tickets, streaming/radio transport |
| Subscription-wide usage | Bring remaining metered Growth/Business operations under period-based included reservations |
| Profiles/device work | Avatar upload/edit, isolated offline workspace storage, reconciliation and permission-led camera/contact flows |
| Heavy media/local models | Actual video workers, licensed model deployment, GPU/device qualification and cancellation/retry evidence |
| Production activation | Exact-head CI, live included-generation migration, deployment, subscribed-user/two-tenant checks and rollback evidence |

No research-only repository is relabeled as installed by these changes. Upstream identity, license, compatibility, resource behavior and user-data isolation must be verified for each actual adapter; original implementation of useful patterns remains available without copying restricted code.

## Source research

Checked 2 October 2026, using primary sources and the repository's existing governed research:

- [Microsoft RIFF structure](https://learn.microsoft.com/en-us/windows/win32/xaudio2/resource-interchange-file-format--riff-): chunk identifiers, sizes and WAVE content.
- [Microsoft WAVEFORMATEX](https://learn.microsoft.com/en-us/windows/win32/multimedia/using-the-waveformatex-structure): PCM channel/sample format fields.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): table grants and policies are separate; tenant/user authorization must be explicit.
- [MDN origin-private storage](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system): local file storage is origin-scoped and quota-limited; durable workspace caching remains separate work.
- `CREATOR_PROJECT_GRAPH_V1.md`, `INCLUDED_GENERATION_AND_LOCAL_PROCESSING.md`, the screenshot radar and existing media/project/market expansion research provide the application direction.

## Verification

Locked dependency installation, moderate-level dependency audit, typecheck, lint and build passed. Focused graph/generation tests cover mutation, identity preservation, invalid trims, optimistic concurrency, tenant isolation, private generated sources, completed-job requirements and project validation before billing/provider side effects. PCM tests inspect real output headers and sample values, silence, stereo channels, clipping, stable output order and malformed/truncated input refusal.

The included-generation migration was executed twice in an isolated PGlite PostgreSQL/WASM database; reservation, overspend refusal, settlement, idempotency, release, expiry and tenant probes passed. This is not a full native migration replay or hosted production mutation. CI executed the full native migration replay successfully after the exact server-only table expectation was updated to include `generation_usage_reservations`. The readiness document now reports the same 35-table set. Read-only hosted inspection confirmed `creator_projects` exists while the new `generation_usage_reservations` and `generation_usage` RPC are absent.

The final full server suite passed 5,477 tests with six deliberately pending checks, including the persisted-catalog regression. The verification gates also passed; local native PostgreSQL replay was explicitly skipped and remains required in CI. Twelve browser tests passed, exercising local media processing/downloads, no uploads, explicit playback, stale-output clearing and phone/navigation layouts. The standard Playwright Chromium download was truncated in this environment; an isolated test-only Chromium 153.0.0 package provided local evidence with GPU disabled and normal web-security enforcement. No test-browser package was added to application dependencies. Remote CI remains authoritative for the locked official browser and native PostgreSQL replay. Do not describe this branch as live until release gates and activation succeed.
