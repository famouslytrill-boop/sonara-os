# SONARA game theory, simulation and creative systems — engineering pass

**Date:** 2026-10-08
**Status:** coded sandbox foundation; not customer-facing, not merged, not production-enabled.
**Owner boundary:** SONARA One shared mathematical layer for Business Builder, Creator Studio, Growth Studio. Product/runtime activation requires separate gates.

## Decision and actual code

The new **lib/sonara-creative-simulation-kernel.cjs** is an owned, pure JavaScript mathematical module. **tests/creative-simulation-kernel.test.js** validates deterministic invariants. Neither file creates a game storefront, online lobby, audio workstation, rendered film or customer-facing API. No dependencies, migrations, runtime routes, feature flags, or payments were added.

| Domain | Implemented primitive | Formula / method | Explicit limitation |
| --- | --- | --- | --- |
| Incident scenario | createSeededRng, simulateIncidentRisk | seed xorshift32; expected loss = probability × impact | 10,000-trial limit; illustrative, not financial settlement or a calibrated forecast |
| Zero-sum game | analyzeZeroSumGame | maximin of row minima; minimax of column maxima | pure saddle points only, not mixed-strategy Nash |
| Board game | createTurnState, applyScoreTurn | turn = turnIndex modulo player count; optimistic revision checking | score-based sandbox reducer only; not a trusted multiplayer server |
| Grid routing | shortestGridPath | bounded breadth-first search, four-neighbor unweighted grid | no real roads, geocoding, mobility or GPS |
| Music | midiFrequency, beatSeconds | f = A4 × 2^((MIDI−69)/12), time = beats × 60/BPM | no sound rendering, MIDI import, musical copyright clearance |
| Film | buildFilmTimeline | integer frame offsets, duration = frames × fps denominator / fps numerator | no video encoder, drop-frame timecode converter or edit UI |

**Important:** Seeded pseudo-random sampling is repeatable but not cryptographically secure; never use xorshift32 for auth tokens, gambling or money movement. The risk output is a demonstration of a one-event Bernoulli model. Monetary floating-point estimates are not canonical ledger arithmetic.

## Cross-studio fit

**Business Builder:** bounded staffing, inventory and loss-scenario rehearsals, with explicit input assumptions and uncertainty. The grid method may inform routing tests but needs actual provider-backed mapping for dispatch. Simulated advice cannot directly execute bookings, payments, inventory changes or safety actions.

**Creator Studio:** musical note/tempo calculations, storyboard-to-shot frame accounting and interactive educational game prototypes. The existing Creator Project Graph and media-worker pipeline must remain the source of truth for clips, assets, rights, publication and export.

**Growth Studio:** optional educational game-theory exercises and what-if experiments for plans and offers. Game payoff tables are user hypotheses, not proof about competitors. Do not infer performance without validated data or auto-publish campaigns.

**SONARA One:** potential shared simulation contract with controlled tenancy, rate limits, auth, consent, proof and human review. This sandbox kernel does not perform any of those external operations itself.

## Technology evaluation — no dependencies installed

| Candidate | Upstream findings | Decision |
| --- | --- | --- |
| Godot | MIT engine. Native and dedicated headless server support. Godot 4 web export uses WebAssembly and WebGL2; single-threaded export reduces cross-origin-isolation constraints. | Research-only optional Creator game worker. Do not embed into production HTTP server. |
| boardgame.io | MIT turn-based game-state system offering phases, moves, replay logs, lobby and multiplayer. | Reference / possible future isolated adapter, benchmark against existing deterministic reducer. |
| three.js | MIT 3D rendering, WebGL2 renderer available. | Optional progressive browser rendering, not workflow authority. |
| Tone.js | MIT browser audio framework with scheduling, synth and effect primitives. | Optional Creator music client after autoplay, device, audio and licensing tests. |
| FFmpeg | Mostly LGPL, optional GPL configuration changes obligations. | Isolated licensed media worker only after binary, codec and redistribution review. |
| Web Audio AudioWorklet | Browser API for low-latency thread-isolated audio processing in secure contexts. | Optional, no audio code added. |

Verified source URLs (2026-10-08):
- https://godotengine.org/license/
- https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_dedicated_servers.html
- https://docs.godotengine.org/en/4.5/tutorials/export/exporting_for_web.html
- https://github.com/boardgameio/boardgame.io/blob/main/LICENSE
- https://boardgame.io/documentation/
- https://github.com/mrdoob/three.js/blob/dev/LICENSE
- https://threejs.org/docs/pages/WebGLRenderer.html
- https://github.com/tonejs/tone.js/
- https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet
- https://ffmpeg.org/doxygen/trunk/md_LICENSE.html
- https://ocw.mit.edu/courses/14-12-economic-applications-of-game-theory-fall-2025/download/

Code licenses do not establish rights to bundled artwork, templates, books, recordings, models, datasets, samples, codecs or trademarks.

## Research → mathematical and creative applications

The design references mathematics and scholarship as methods, not as newly invented science:

- **Graph theory / Dijkstra:** build on the included BFS foundation; later weighted routes, branching story graphs and cost-constrained dispatch with traceable inputs.
- **Game theory / von Neumann:** pure zero-sum saddle-point analysis now; mixed equilibria, incentive design and non-zero-sum games later.
- **Bellman optimization:** later dynamic programming for scheduling, allocation and decision sequences; not currently implemented.
- **Shannon information theory:** research entropy, signaling, signal processing and experiment uncertainty; not currently implemented.
- **Monte Carlo / probability:** bounded seeded rehearsal now; confidence intervals, model calibration, historical backtesting and scenario validity later.
- **Music theory:** equal temperament and beat positioning now; rhythmic subdivisions, chords, harmony, arrangement, scales and score notation later.
- **Film theory / narrative:** precise shot durations now; user-owned narrative beats, scene continuity, shot/caption synchronization, alternative versions and authorial review later.
- **Books / literature / researchers:** citation-grounded source metadata, rights, public-domain status, educational annotations and user-owned manuscript structure. Do not indiscriminately ingest copyrighted books or reproduce text without authorization.
- **Game engine architecture:** pure state reducers and deterministic pathfinding now; future fixed-timestep physics, ECS, rollback networking, prediction/reconciliation, anti-cheat, spectators and accessible controller mapping.

## Promotion gates

1. Require exact input/output JSON contracts, bounds, schema version and stable replay identity. Tests must explicitly fail for forbidden inputs.
2. Use a server-side principal, tenant ownership, rate limit, idempotency key and immutable audit before any API. Client-provided game state is not trusted; score reducer does not authenticate actors.
3. Persist scenario seed, assumptions, model/version, provenance, rights, approval and cost. Experimental output must be labeled as simulation, not observed operational truth.
4. Heavy game/media workers need sandboxed CPU/GPU/memory/egress/time limits, budget reservation, cancellation, retries, dead letters, tracing and rollback.
5. Media rights: customer-owned/licensed only, moderation and reporting, records of consent and restrictions for minors. No real-money gambling without specialized legal/product approval.
6. Accessibility: keyboard and touch parity, clear focus, reduced motion, captions/transcripts, non-audio feedback alternatives; sound and haptics opt-in.
7. Pass Mocha plus full exact-head CI, multi-tenant adversarial tests, cost/load/device qualification and release controls before exposing customer functionality.

## Ordered remaining work

**P0:** verify new tests via full pnpm/Mocha/CI on this branch, and do not merge while P0 release gates remain red.  
**P1:** typed, auth-checked sandbox API and governed research-lab UI; separate experiment persistence migrations following RLS review.  
**P1:** connect frame and tempo utilities to the existing Creator Project Graph and storyboard, with round-trip tests and zero duplicate timeline authorities.  
**P1:** compare boardgame.io for real multiplayer/reconnect, moderation and anti-cheat instead of building a parallel back end without proof.  
**P2:** isolated Godot/three.js/Tone.js pilots with Android/iOS and assistive-technology acceptance, worker cost proof, rights and license register.  
**P2:** weighted graph algorithms, mixed equilibria, constrained optimization, calibrated uncertainty, fixed-step physics and narrative graph engine.

A committed kernel is a code contribution, not a deployed or customer-ready gaming/media capability.
