---
name: creator-daw-interoperability
description: Implement SONARA Creator Studio audio/video/music production workflows and DAW file interchange with verified format support, bounded DSP, explicit device permissions, media rights, source hash provenance, real exports and failure-driven tests.
---

# Creator DAW interoperability engineering skill

Use this when a change touches `public/creator-project-audio.js`, `routes/sonara-creator-project-routes.cjs`, media/voice capture, worker processing, waveform visualizers, plug-in evaluation, DAW inputs, output exports or media production user journeys.

## Read the actual system first

1. Read `AGENTS.md`, `docs/creator/DAW_AUDIO_INTEROPERABILITY_2026-10-10.md`, `lib/sonara-creator-project-graph.cjs`, `lib/sonara-creator-media-workflows.cjs`, the current media processing contract, and the relevant route and tests.
2. Confirm the live code path and actual registered route before claiming a feature exists.
3. Read current official vendor specification/manual and terms for each proposed file format, plugin or API; document platform/version limits. Never treat a DAW project-file extension as evidence that SONARA can open it.
4. Check the upstream's exact license and any codec/model/media rights separately before adopting executable dependencies. No external DAW code is copied into this skill.

## Choose the smallest interoperable artifact

- **Audio:** prioritize PCM WAV/BWF handoff, deterministic channel routing and synchronized per-track files. Keep source rates, sample format, origin offset and output rate explicit.
- **Microphone recording finalization:** `public/creator-local-capture.js` must call `MediaRecorder.stop()` on user Stop, then accept its final `dataavailable` and release tracks from `onstop` (not synchronously in the click handler). A revision-changing immediate `abort()` still discards chunks for permission revocation, navigation or explicit cancellation. The Playwright `audio Stop preserves microphone tracks until the final MediaRecorder data event` test guards this lifecycle. W3C working draft: https://www.w3.org/TR/mediastream-recording/ ; MDN: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/stop_event .
- **Multitrack SMF 1:** `public/creator-project-midi.js` additionally supports user-entered tracks using `writeMidiFormat1`: a conductor tempo track + up to four uniquely named channel-separated note tracks, 480 PPQ and 128 notes total; the active page currently exposes two tracks. Verify `tests/creator-midi-format1.test.js` and browser binary downloads. Do not imply a DAW native session, sound rendering, automatic transcription or persisted note arrangement.

- **MIDI:** use the executable `public/creator-project-midi.js` Format 0 writer for explicit user-authored note rows: integer 40–240 BPM, 480 PPQ, one track, 128 notes maximum, 256-beat ceiling, channel 1–16, bounded variable-length deltas. Keep `tests/creator-midi-interchange.test.js` golden fixture intact. Do not infer notes from audio, invent BPM metadata, or claim Format 1, native DAW projects, MIDI 2.0, MIDI input or virtual instruments. Build new formats behind explicit typed contracts and test round trips.
- **Video:** treat frames, audio clock, timecode, variable frame rate, proxies, captions, rights and delivery encoding as separate validated contracts.
- **Production:** distinguish local proof, provider/worker requirement, native desktop integration and production-enabled capability.

## DSP and media safety checks

- Validate RIFF/WAVE structure and chunk lengths against actual byte buffers, not filenames. Bound payloads, sample counts, channel count and duration *before* allocating output.
- Reject unsupported encoding, non-finite float samples and corrupted structures; preserve stable mix order. Test signed 24-bit boundaries and correct stereo channel placement.
- Track sample peak, RMS, clipping and visible waveforms with explicit mathematical definitions. Never label sample RMS as LUFS or sample peak as dBTP.
- Document that interpolation-only sample-rate conversion is not mastered anti-aliasing. Add filter impulse/frequency response tests before improving the DSP engine.
- Use isolated workers for expensive media. Do not ship an unrestricted file conversion process into request handlers; never provide shell-executable filenames or unbounded arguments.
- Request camera/microphone permissions only after explicit user interaction. Recheck authorization on long-running capture, stop tracks on end/visibility change and explain where data stays.
- In tenant-backed paths, enforce private signed assets, per-organization access, rights/consent, owner approvals for publishing/monetization, bounded resources, retry idempotency and provenance.

## Acceptance suite that can fail

Test positive and negative fixtures: 16/24/32-bit PCM, 32-bit float, mono and stereo, 44.1/48 kHz, signed samples, malformed RIFF/chunk sizes, unsupported rate and encoding, NaN/Infinity, muted sources, clipping, timeline duration, repeatable export bytes, capped memory and browser preview availability. Prove at least one rejected fixture fails *because of the new validation*. Do not call tests green unless executed and verified for the exact commit.

Use pnpm and the repository test gates. For a browser UI, check keyboard/focus, accessible level descriptions and mobile overflow. Record measured completion separately from aspirational roadmap.

## Delivery and reporting

Create a branch and PR; no direct `main` merge or production activation. Report exact files changed, tests run/results, current PR SHA/status, remaining limitations and dependencies. A combined stereo render is not equivalent to DAW track outs, and file handoff is not a native AAX/VST/ASIO integration.
