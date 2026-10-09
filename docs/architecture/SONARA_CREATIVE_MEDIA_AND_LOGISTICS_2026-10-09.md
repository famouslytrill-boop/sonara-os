# SONARA Creative Production, Language and Logistics Engineering — 2026-10-09

Status: research and bounded implementation on a feature branch, NOT production deployment. SONARA Industries is the parent; SONARA One owns accounts; Creator Studio owns creative project media, rights and delivery; Business Builder owns orders, inventory and payments; Growth Studio owns permitted campaigns and analytics.

## Reviewed foundations and this branch

Existing: Creator Project Graph with timelines/captions and JSON/VTT/SRT/CSV exports; on-device optional WAV render; storyboard builder; demand forecasting and inventory science; mobile/media/provider architecture. Do not duplicate those foundations.

Implemented in this branch:
- lib/sonara-creator-beat-grid.cjs — exact-ratio film frame rates; deterministic absolute music beat-to-frame markers; strict bounded inputs; CSV export.
- GET /creator-studio/projects/beat-grid — page under Creator entitlement, linked from project list and project detail. No media upload, external provider, persistence or background tracking.
- tests/creator-beat-grid.test.js — formula, fractional FPS, input rejection, access guard, CSV and route rendering assertions.

Rate options: 24, 25, 30, 60, 24000/1001, 30000/1001, 60000/1001 fps. BPM 20–320, beats/bar 2–12, bars 1–128, offset up to 2,000,000 frames. Frame for beat k = offset + round(k * 60 * fpsNumerator / (BPM * fpsDenominator)). Absolute calculation avoids accumulated frame rounding. These are frame positions, NOT SMPTE timecodes, real recorded tempo tracking, or proof of audio/video synchronization.

## Required production workflow and ownership

1. Writing room: private premise, character profiles, act/scene beats, screenplays, chapter outlines, version history and approvals. Writer's block: deterministic prompt templates plus optional owner-initiated AI suggestions, with human-authored revisions preserved.
2. Pre-production: approved script beats -> storyboard/shot list -> schedule/call sheet -> consent/location/props/equipment/crew plan. Reuse the existing storyboard, not a second generator. Beat structure and scene lengths are creative heuristics, not objective quality formulas.
3. Music: keys/modes/chords/progression; meter, tempo, dynamics and scene synchronization; MIDI/MusicXML exchange. Constant quarter-note pulse yields seconds_per_beat = 60/BPM and bar_duration = beats_per_bar*60/BPM. Tempo maps require piecewise timing with rational timebases.
4. Film/media: hash and quarantine rights-cleared source, immutable originals, editable timeline references, transcodes/proxies, render worker, approval, licensed delivery. OpenTimelineIO is an editorial interchange format referencing external media, NOT a media renderer. Use WebCodecs capability negotiation and dedicated workers for supported browsers; AudioWorklet for low-latency DSP.
5. Localization and accessibility: source-language transcript; speaker diarization; timestamps; human-readable glossary; translated captions and subtitles; separately reviewed audio description; optional verified sign-language interpreter video. Signed languages are independent languages. Pose estimates DO NOT reliably translate sign language or replace trained interpreters.
6. Motion capture: camera/motion access at point of use; consent and revocation; local hand/face/pose landmarks with confidence and coordinate normalization, rig retargeting verification, no default biometric identification or always-on recording.
7. Commerce: explicit creator asset license -> buyer approval -> merchant catalog/order -> payment confirmation -> stock reservation -> pick/pack -> delivery events -> reconciliation. Do not auto-refund or auto-publish rights, campaigns or restricted media.
8. Logistics: use existing reorder science, demand forecasting and store inventory; GS1 EPCIS event adapter for physically tracked equipment, merchandise, props and parcels; verify product identifiers and deduplicate carrier events.

## Technical choices and gates

| Subsystem | Standard or candidate | Proof before activation |
| --- | --- | --- |
| Editing | OpenTimelineIO, rational frame/timebase contract | Import/export parity, codec and clip trim fixtures |
| Video | WebCodecs workers, mux/demux through approved library | Device capabilities, memory, 4K thermal and codec fallback |
| Audio | AudioWorklet, optional MIDI 2.0 UMP and MusicXML 4 | Glitch/jitter budget, sample-rate, round-trip score fixtures |
| Mastering | EBU R128 only for relevant delivery targets | Actual LUFS/true-peak measurement and profile selection |
| Captions | WebVTT/SRT, WCAG 2.2 | Overlapping cues, names, timings, keyboard and screen-reader testing |
| Translation | consented ASR -> translation -> glossary -> human review | Language-specific accuracy, speaker identity, latency and privacy proof |
| Signed language | Interpreter-video track plus accessible controls | Human interpreter quality review, WCAG 1.2.6 where relevant |
| MoCap | MediaPipe Tasks pose/hand models, opt-in | Consent, model version, tracker confidence, rig-space tests |
| Retail fulfillment | GS1 EPCIS 2.0/CBV events, existing inventory science | Tenant isolation, scanned identifiers, idempotency, audit and stock reconciliation |
| Mobile ordering | Existing Android/iOS/PWA delivery architecture | Signed builds, offline queue ownership, device/permission testing |

## Proposed data additions (NOT migrated)

- creator_scene_beats: tenant ID, project ID, scene ID, revision, beat order, duration frames, frame-rate numerator/denominator, approval status.
- creator_language_tracks: tenant/project/asset IDs, source language tag, target language tag, modality, glossary version, revision, reviewer and checksum.
- creator_mocap_sessions: tenant/project IDs, consent record, captured time, device/model reference, coordinate system, retention policy. Separate access-controlled expiring landmark storage.
- creator_production_reservations: tenant/project, merchant item, requested/reserved quantities, linked order, idempotency key, expected revision.
- creator_delivery_events: tenant/order, provider event ID, event type, event time and received time, proof asset pointer, privacy scope.

Before any migration: check for existing canonical tables, tenant RLS, unique IDs, lifecycle/retention, rollback, and cross-tenant adversarial tests.

## Formulas and alerts

Inventory position = usable_on_hand + confirmed_incoming - reserved_or_allocated. Reorder threshold = forecast daily use * verified replenishment lead time + safety stock; obtain safety stock from the existing module, and reject unreliable demand history. Suggested policy: warning when inventory position is <= the validated reorder point; critical when usable stock is below committed demand. Alert transitions need deduplication by tenant+object+state+version; push/email/SMS are opt-in. Inventory warnings do not automatically authorize purchasing.

Media unit margin = sale net of provider/API fees, compute/render costs, storage and egress, customer support and payment/marketplace fees. Require bounded jobs, owner review for rights, and no false “unlimited” media claims.


## Engineering Phase 2 — variable-tempo music and film interchange (2026-10-09)

Added to the same guarded Creator Studio route:
- Optional ordered tempo changes: comma-delimited `bar:BPM` entries such as `5:90,9:140`. A change applies from its named bar forward; the first bar uses the primary BPM. Up to 16 events, 1–128 total bars, integer BPM 20–320. Invalid, unsorted, duplicate, or overlong input is rejected.
- Exact rational accumulation of cumulative bar duration. Fraction arithmetic uses positive BigInt numerator/denominator reduced with GCD after each bar. Frames are rounded once from the absolute time, rather than summing independently rounded durations. This prevents drift at fractional picture frame rates.
- `format=vtt`: nonoverlapping, contiguous WebVTT chapter cues with fixed `Bar N` labels. It is a **chapter** track, not a subtitle or live interpretation track. Each cue extends to the next bar marker, including a terminal boundary. The player must explicitly declare `<track kind="chapters">`; playback support must be verified separately.
- `format=json`: versioned, provider-neutral marker manifest with explicit film rate numerator/denominator, offset, tempo map and marker boundaries. Rights and rendering booleans are false, never inferred as cleared or rendered.
- `format=csv`: existing numeric-only edit markers retained, no arbitrary user text in CSV cells.
- Added route and calculation tests for tempo-change boundaries, rational NTSC-like frame rates, export shape, rejection and tenant-independent entitlement gating. PR CI remains mandatory.

Video/source synchronization nuance: exact planned frame indices cannot guarantee synchronization with captured variable-frame-rate video or audio clocks, nor does this export a Standard MIDI File tempo track, SMPTE timecode or OpenTimelineIO object. Future verified adapters may convert the manifest into those formats. Do not label these as implemented.

**Authoritative interchange references:** WebVTT chapter cues require positive nonoverlapping durations and omit formatting tags (https://www.w3.org/TR/2026/CRD-webvtt1-20260520/); OpenTimelineIO `RationalTime` and `Marker` have an owning-item time coordinate system (https://opentimelineio.readthedocs.io/en/latest/api/python/opentimelineio.schema.html). This initial JSON is explicitly SONARA-native, not `.otio`.

**Next bounded implementation after full CI:** add project-graph-linked cue metadata behind revision compare-and-swap, input validation and tenant isolation. Prevent historical cue sheets from being silently rewritten when a user changes BPM; store source hash, revision, timebase and approval state. Offline saved drafts require conflict detection at reconnection. No automatic writes to live productions or merchant orders.

## Next sequence

P0: exact-head test, lint, typecheck, build, security, route smoke and CI; keep existing global release failures visible and separate.
P1: integrate beat-marker CSV with versioned Project Graph cue metadata, revision compare-and-swap and recoverable local exports.
P1: script/story beat graph and shot scheduling, then CPU-first render worker with quota, metering, retries, cancel and provenance.
P1: localized caption/transcript tracks with native-language quality verification; audio description and human interpreter video.
P2: permission-gated motion capture/retargeting; retailer event adapters and mobile inventory/QR scanning; signed Android/iOS acceptance.
P2: storefront/media marketplace licensing, payout reconciliation, delivery and scalable creator monetization.

Sources: https://opentimelineio.readthedocs.io/en/latest/ ; https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API ; https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet ; https://midi.org/universal-midi-packet-ump-and-midi-2-0-protocol-specification ; https://www.musicxml.com/for-developers/ ; https://tech.ebu.ch/publications/r128 ; https://www.w3.org/TR/webvtt1/ ; https://www.w3.org/WAI/WCAG22/Understanding/ ; https://developers.google.com/mediapipe/solutions/vision/pose_landmarker ; https://ref.gs1.org/standards/epcis/artefacts .

This is a scoped engineering specification, not evidence that P1 or P2 capabilities are live.
