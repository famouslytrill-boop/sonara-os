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
