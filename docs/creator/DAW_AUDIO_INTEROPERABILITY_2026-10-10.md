# Creator Studio: DAW, audio/video I/O and interchange — 2026-10-10
## Follow-on source-stem export increment (stacked feature branch)

**Status:** implemented in `feature/creator-source-stems-20261010`, which builds on the unmerged draft PR #611. This section is not evidence of a deployed capability, main-branch integration, formal CI approval or mobile-device quality signoff.

- `public/creator-project-audio.js`: new `renderSourceStems(graph, files, options)` returns individually downloadable, stereo PCM16 WAV files at 44.1/48 kHz. Stems group timeline clips by original project source ID, not by mix bus or independent DAW track. Files have the **same number of samples**, start at sample zero and are zero-padded where that source is silent. The active source IDs are sorted for reproducible output order.
- `routes/sonara-creator-project-routes.cjs`: paid Creator project form exposes an explicit `Render source stems` button. The browser worker transfers resulting ArrayBuffers and the UI creates one individual, user-clicked local download link per source. Existing stereo mixdown remains the default path; no server upload or automatic publishing.
- `tests/creator-source-stems.test.js`: assertions for 48 kHz alignment and gaps, mute treatment, deterministic output, invalid sources/rates, source cap, aggregate input-byte cap, 96 MB output budget and mixdown duration overrides.
- Limits: maximum four active sources; 64 MiB total selected input buffers; 96 MiB calculated WAV output bytes; source WAV <=20 MiB each; timeline <=3 minutes; total active clip time <=10 minutes. Source-stem export can exceed device memory despite respecting these output caps because the DSP mixer uses temporary Float64 buffers; browser/device-memory benchmarking is still mandatory.
- A source used by two clips appears in one shared source-group stem. Multiple instruments recorded together in the same source cannot be separated by this grouping. No model-assisted source separation or native .als/.flp/.ptx sessions are claimed.
- Existing input decoding and output use linear-interpolation sample-rate conversion. It is a preview and handoff path, **not** certified mastering-grade SRC, oversampled true-peak metering, BS.1770 LUFS or full Dolby/ADM handling.

### Why this interchange sequence is supported

- The MIDI Association describes Standard MIDI Files as a transportable representation of time-stamped events with tempo/track structures, **not** native DAW session files: https://midi.org/standard-midi-files . The current Creator Project Graph has audio clips and captions, but no note events, so MIDI should be built only when a typed note/tempo event model exists; do not synthesize fictitious MIDI from audio.
- EBU Tech 3285 Broadcast Wave (BWF) adds metadata including a 64-bit sample TimeReference (since midnight) for audio delivery and interchange: https://tech.ebu.ch/publications/tech3285/ . SONARA currently writes plain RIFF/WAVE with no `bext` timestamp; deterministic zero-padding aligns files but does **not** make them BWF.
- FFmpeg's libswresample supports a higher-quality, configurable resampling/filtering pipeline with optional SoXr where available: https://www.ffmpeg.org/ffmpeg-resampler.html . Before any worker/runtime adoption: check build/license flags, external media rights, execution isolation, server costs and anti-aliasing tests.

### Next release proof

Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run build`, and the exact-head workflow gates. Browser test two real WAV sources at 44.1/48 kHz and assert separate file downloads and identical durations. Prove oversized pack denial before memory allocation. Follow repo approval, security and release rules; do not auto-merge stacked PRs or deploy production.


Status: **working branch implementation + researched roadmap**, **not an activated production or native-DAW integration**.

## Verified baseline in SONARA

- The existing paid project workspace uses `routes/sonara-creator-project-routes.cjs`, the validated Creator Project Graph, and a local browser worker `public/creator-project-audio.js`. Its audio sources are selected manually from the user's device; no cloud asset file is automatically downloaded, uploaded or matched.
- This branch extends WAV import to little-endian, mono/stereo, PCM 16/24/32-bit and IEEE float 32-bit recordings at 8–96 kHz; export supports stereo PCM16 at 44.1 kHz or 48 kHz, bounded to 180 seconds. Files remain local. The new 64-bin waveform visualizer and peak/RMS figures measure the **rendered PCM**, not an upstream recording or a certified loudness measurement.
- The output is **one combined mixdown**, not separate track outs, a DAW-native session, MIDI, AAF, surround, lossless original 24-bit export, or a plugin host. Export uses deterministic linear interpolation; when downsampling high-frequency audio it does **not** provide a mastering-grade anti-aliasing guarantee.
- The existing device capture outputs browser-supported WebM/Opus, M4A or Ogg, which **cannot** be passed directly into this WAV-only renderer. Capture format conversion is a separate, permissioned media path.
- No third-party DAW binary, plugin, runtime, SDK or codec has been installed here.

## External feature matrix (vendor manuals, checked 2026-10-10)

| Reference | Verified production pattern | SONARA's next appropriate layer |
| --- | --- | --- |
| Pro Tools (Avid) | AAX is an Avid-specific plugin format; scripting and control surfaces have separate SDKs; track outs use synchronized audio files | Audio file handoff first; AAX licensing and scripting require separate vendor review |
| Ableton Live | WAV/AIFF/FLAC/OGG and selected compressed imports; VST2/VST3 and AU on supported platforms; MIDI import/export | WAV+MIDI interchange, beat/tempo metadata, future Ableton Link opt-in |
| FL Studio | PCM/FLAC/OGG/MIDI exports; plugin support includes VST3 and CLAP and AU on macOS | WAV+MIDI, instrument/channel stem manifests |
| Steinberg Nuendo/Cubase | AAF interchange, VST3, Nuendo ADM Dolby Atmos/BWF workflows | Post-production AAF/ADM evaluation behind licensed provider/worker, not fabricated files |
| Adobe Audition | Session XML and OMF workflow; BWF timestamp placement; custom format and session SDKs | Deterministic edit decision metadata and timeline alignment |
| Ardour | Stem exports and AAF workflows; audio backends ASIO/CoreAudio/ALSA/JACK | Full-length synchronized per-track WAV exports |
| DaVinci Resolve/Fairlight, Premiere | Picture edit, post audio, relink, video delivery and color workflows | Timecode-aware EDL/markers, proxy and rights-cleared video-worker exports |
| REAPER, Logic Pro, Studio One, Bitwig, Audacity | DAW sequencing/mixing, music production, modular design and spectral views | Portable audio assets, MIDI, waveform/spectrogram analysis; no claim of native project compatibility |

Sources:
- Avid AAX SDK: https://developer.avid.com/aax/
- Ableton supported audio formats: https://help.ableton.com/hc/en-us/articles/211427589-Supported-Audio-File-Formats
- Ableton supported plug-ins: https://help.ableton.com/hc/en-us/articles/5937501570460-Supported-Plug-in-Formats
- FL Studio audio/MIDI export: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/fformats_save_export.htm
- FL Studio plug-in support: https://www.image-line.com/fl-studio-learning/fl-studio-beta-online-manual/html/plugins_supported.htm
- Adobe Audition sessions/inputs: https://helpx.adobe.com/audition/desktop/importing-recording-and-playing/creating-opening-files.html
- Steinberg Nuendo post-production: https://www.steinberg.net/nuendo/features/
- Ardour interoperability: https://manual.ardour.org/working-with-sessions/interchange-with-other-daws/
- Avid synchronized track outs: https://www.avid.com/pro-tools/user-guide/exporting-individual-tracks

## I/O capability boundaries

**Browser:** `getUserMedia` requires HTTPS and the user's permission; OS-selected microphones and hardware audio interfaces can be presented as a browser stream. Browser behavior and device selection vary. An output device picker is not universally implemented and needs explicit user action. The current SONARA local capture layer requests and rechecks device permissions; do not bypass it.

**Native workstation adapter, later:** true low-latency multichannel ASIO (Windows), CoreAudio (macOS), and ALSA/JACK/PipeWire (Linux) input/output, aggregate-device behavior, exclusive-mode routing, MIDI devices, clock sync, buffer management and plug-in hosting require an intentionally installed and isolated native application/service. Do not claim these from a web page. No native bridge is activated in this branch.

**Import/export contracts:** sniff the *contents* (not only MIME/extension); reject truncated/oversized/non-finite input; normalize declared timebases; cap channels, duration, memory and processing; preserve an immutable source hash and track the authorized organization when processing server-side. Store license, consent, source and transformations separately from the media bytes.

## Audio formulas SONARA should use

- Duration (seconds) = sample frames / sample rate (Hz).
- Raw PCM payload bytes = sample frames × channel count × bit depth / 8.
- Nominal one-buffer audio latency (ms) = 1000 × buffer frames / sample rate. **Not** end-to-end measured round-trip latency.
- Peak dBFS = 20 × log10(max(|normalized PCM sample|)); silence has no finite dBFS value.
- RMS dBFS = 20 × log10(sqrt(mean(normalized PCM sample²))); **not LUFS**. ITU-R BS.1770 integrated loudness needs weighted filtering and gating.
- Each display bucket is the maximum absolute output amplitude within its interval, clamped to [0, 1]. Deterministic bins are view aids, not a spectrum or an FFT.
- Clipped sample count measures samples exceeding signed 16-bit output range before the final clamp. It is **not** a true-peak measurement.

## Follow-on engineering order

1. **P0 now:** validate new WAV formats, malformed headers, float samples, resampling and 48 kHz output in CI and browsers. Review linear-resampling alias behavior against reference tones before promising professional mastering quality. Keep the feature on its branch until exact-head checks pass.
2. **P1:** implement synchronized full-length track-out/stem export with named tracks, explicit source hashes, common zero start, BPM/tempo markers and manifest. Add Standard MIDI File (SMF1) reader/writer with bounded variable-length parsing and tempo-map tests; keep MIDI 2.0/SMF2 separate.
3. **P1:** add locally permissioned audio interface selection where supported, recording format transcode and a real FFT spectrogram with sample windowing. Avoid unauthorized recording, hidden input activation or cross-origin media processing.
4. **P2:** isolate FFmpeg/GStreamer media jobs with CPU/memory/time/disk egress limits, quarantine and codec/legal reviews. FFmpeg is usually LGPL 2.1+ but GPL-enabled builds have different obligations. Shipping, static linkage and patent exposure need review (https://ffmpeg.org/legal.html).
5. **P2:** optional AAF/OMF/ADM/MusicXML/FCPXML/OTIO adapters only after format and SDK/terms review; test round-tripping and loss reports rather than claiming perfect native DAW session interchange. Evaluate VST3 and CLAP plugins only in sandboxed native processes; AAX is not automatically interchangeable.
6. **Release:** green full CI, cross-tenant storage tests for any server worker, signed build/production approval and post-deploy canary. No route, provider or autonomous consumer activation on the strength of this note.

## Business workflows

- Musicians/recording studios: client recording intake, rights/provenance, drafts, track-out packages, release approvals.
- Podcasters: microphone capture, local cleanup preview, transcripts/captions after an authorized provider is configured, audio/video deliverables.
- Video companies: 48 kHz handoff, frame-accurate picture timeline and timecode model (future), ADR dialogue, captions, proxy/render queues.
- Labels/publishers: source contracts, split sheet, masters delivery, approval logs, usage budgets and storefront handoff; **not** unlicensed distribution or automatic payouts.
- Sound-design/audio-post houses: spot effects, aligned stems, metadata and versioned review packages.

No third-party brand endorsement or formal compatibility certification is asserted.
