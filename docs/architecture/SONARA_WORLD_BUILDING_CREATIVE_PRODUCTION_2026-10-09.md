# Creator Worldbuilding and Cross-Media Production Planner — 9 October 2026

**Status:** source-only draft, review required. No production deployment, database migration, registered provider, standalone game engine, DAW, media renderer, live broadcasting server or approved publish path is introduced by this change.

## Existing code reused

- `public/creator-project-graph-core.js`, `lib/sonara-creator-project-graph.cjs`, `routes/sonara-creator-project-routes.cjs`: creator assets/timelines, revision control and tenant-scope boundaries. This change does not alter their storage schema.
- `lib/sonara-storyboard-tool.cjs`: short-form shot time allocation; do not duplicate it.
- `lib/sonara-creator-media-workflows.cjs`: provider-neutral workflow intents and owner-approval reporting.
- `routes/creator-music-system-readonly.cjs`: existing Creator Studio access middleware and reachable music-system navigation.

The new narrow route is `/creator-studio/worldbuilding`; the structured planning API is `POST /api/creator/worldbuilding/plan`. Both inherit the Creator Studio workspace-access gate. The HTML form is a simpler subset of the structured API. All outputs are ephemeral previews and not saved projects.

## World Bible contract v1

`lib/sonara-worldbuilding-planner.cjs` validates versioned original-world input: `title`, `medium`, `entities` (character/place/faction/item/rule), `scenes` (title, local entity references, optional place and predecessor references, explicit time or narrated-word estimate), and optional `resources`.

Limits: at most 128 entities, 64 scenes, 16 references per scene; local scene dependencies may only point to already-declared scenes (no forward/cyclic precedence); names and IDs are bounded; durations, speaking speeds, media bitrates, PCM settings and audience values are checked. The planner returns a content hash for deterministic comparison; SHA256 here is not a digital signature or proof of copyright ownership.

Invalid references fail. The engine never invents missing scene duration or assumes a video game has predictable playtime. If an untimed scene appears, the cumulative timeline after it and full-production byte estimates remain `null`. Story information is not a stored tenant record in this phase.

## Deterministic formulas

- **Narration time, estimated seconds:** `ceil(spokenWords * 60 / speakingWpm)`. Requires supplied word count and speaking speed; explicitly recorded durations take precedence.
- **Total planned seconds:** sum of scene durations only when all scenes have a known/estimated duration. Unknown scenes force an incomplete coverage state.
- **Uncompressed PCM payload bytes:** `plannedSeconds * sampleRateHz * channels * (bitDepth / 8)`. Assumes integer-second sections, fixed-width samples; excludes WAV/container headers, metadata, compression and overhead.
- **Distribution payload bytes:** `ceil(plannedSeconds * expectedViewers * (audioBitrateKbps + videoBitrateKbps) * 1000 / 8)`. This is a constant-bitrate, full-attendance capacity scenario, **not** a CDN bill, guaranteed usage or peak-bandwidth reservation; no unknown viewer count is substituted.
- **Book pagination estimate:** `ceil(spokenWords / suppliedWordsPerPage)`. Not print-layout pagination.
- **Planned game tick count:** `plannedSeconds * suppliedGameTickHz`. Not actual gameplay length, hardware performance or a playable game.

All resource estimates guard against unsafe JavaScript integers. No hidden provider prices, render costs, subscriptions, media rights, network overhead or licensing fees are inferred.

## Standards and future integration targets (research only)

| Media domain | External standard / documented capability | Engineering boundary |
| --- | --- | --- |
| Film/video editing | OpenTimelineIO, https://opentimelineio.readthedocs.io/ | Interchange for edit lists, tracks, markers and external media references. No rendered media. |
| DAW/music sessions | DAWproject, https://github.com/bitwig/dawproject | Future ZIP/XML import/export with validation and media/plug-in rights; do not call the planner output DAWproject. |
| 3D games/worlds | glTF, https://www.khronos.org/gltf/ ; OpenUSD, https://openusd.org/release/ | Separate 3D asset and scene interchange adapters. Narrative entities are not glTF meshes or USD prims. |
| Game runtime | Godot, https://godotengine.org/license/ | Open-source MIT engine can be an external companion after version/license/platform tests; not bundled here. |
| Browser graphics/audio | W3C WebGPU, https://www.w3.org/TR/webgpu/ ; Web Audio API, https://www.w3.org/TR/webaudio-1.0/ | Feature detection, permissions, quotas and fallback; never require GPU for this deterministic planning endpoint. |
| Video processing | W3C WebCodecs, https://www.w3.org/TR/webcodecs/ | Not a video encoder/codec distribution guarantee; runtime support and codecs must be tested separately. |
| Broadcast | WebRTC, https://www.w3.org/TR/webrtc/ ; Apple HLS authoring guide, https://developer.apple.com/streaming/hls-authoring-specification-for-apple-devices.html | Separate SFU/ingest, transcode, storage, HLS packaging, device adaptation, moderation and network monitoring. |
| Media trust | C2PA, https://spec.c2pa.org/ | Signed content credentials require a different component; blueprint hashes are not C2PA. |
| Upload safety | OWASP file upload guidance, https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html | Media intake requires content sniffing, file limits, re-encoding/scanning, private storage and tenant authorization. |

## Ordered implementation phases

1. **This PR: planning only.** Bounded schema, user-facing basic preview, protected advanced API, hash, resource formulas, negative tests and an API declaration. Do not merge until exact-head CI, lint, typecheck, security gates and route coverage are green.
2. **Project attachment:** formally relate world bible versions to the Creator Project Graph and existing tenant RLS, with revision CAS, authorship, deletion, asset lineage, rollback and tests for cross-tenant denial. Do not create orphan tables or duplicate projects.
3. **Production interchange:** add tested export adapters for editor timelines, DAW sessions and game/world artifacts with explicit rights and licensed dependencies. Test malformed imports, path traversal, ZIP bombs, SSRF, and escaping before shipping.
4. **Actual media production:** isolated, metered workers for transcoding/rendering, queue retries/cancellation and immutable result manifests. Add quotas and owner approvals for paid execution. Do not run in the Vercel request lifecycle.
5. **Distribution:** authenticated storefront/licensed deliverables; live recording/broadcast only through approved streaming infrastructure, moderation and consent; creator controls over rights, privacy and public publication.

**Required release gate:** verify the exact PR head, all mandatory checks, staging environment, existing production DB migration history and security status. Do not activate, merge to main or deploy this draft automatically. If the website remains intentionally offline/paused, keep it that way.

## Phase 2 addition — project-linked World Bible (source-only, not enabled)

The same draft PR now also contains an authenticated, bounded persistence adapter in `lib/sonara-world-bible-store.cjs`, an HTML JSON editor and guarded JSON read/write routes in `routes/sonara-creator-project-routes.cjs`, safe author-editable Markdown outline output, a declared OpenAPI contract and mock-backed regression tests.

**Activation control:** `SONARA_CREATOR_WORLD_BIBLE_PERSISTENCE_ENABLED` defaults to off. Until a reviewed schema is tested and applied, GET/POST endpoints return 503 rather than implying that data has been saved. Keep the flag off in production. Existing Creator project authorization, organization selection and archived-project checks apply; the new endpoints do not accept organization IDs from clients.

**SQL:** `docs/sql-proposals/creator-world-bibles-2026-10-09.sql` is not a migration and must not be executed in production. It proposes a single row per Creator project, a composite (project, organization) FK, default-denied direct writes, member-read RLS, server-only mutation and a monotone revision. The client submits `expectedRevision` (0 for creation). Server PATCH includes the exact current revision and organization+project filters; stale edits must fail. No data writes occur unless the separate flag is enabled and a reviewed migration has established the table.

**Export:** `GET /api/creator-studio/projects/:id/world-bible/export/markdown` returns a private and escaped Markdown story outline. It does not embed real media, generate game code, issue rights clearance, or publish content.

### Phase 2 verification required before activation

1. Independently review and apply a numbered migration to a disposable Supabase project; verify existing creator_projects constraints and the composite foreign key. No automatic main/prod migration.
2. Use native PostgreSQL/pgTAP to test cross-tenant reads and writes, creator archive vs concurrent saves, uniqueness, invalid JSON, deletion cascades, privilege grants and membership RLS. Run separate sessions and direct Data API tests.
3. Confirm a service-only key is never delivered to web clients and that authentication/authorization cannot be replaced by a request-supplied organization identifier.
4. Run tests/sonara-world-bible-store.test.js and tests/sonara-world-bible-routes.test.js plus the entire exact-head Node 24 pnpm lint/typecheck/test/build/security suite.
5. Test HTML accessibility, mobile form behavior, 64 KB payload boundaries and HTTP/cache semantics in an authorized staging tenant.
6. Release only by explicit review/approval after other standing deployment gates are resolved. Do not merge or deploy this work merely because GitHub reports the branch mergeable.
