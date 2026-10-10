# Creator Studio — World Bible Interchange v1 (2026-10-09)

**Status:** source implementation in a stacked draft PR. Not merged, migrated, deployed, or enabled. This is not a DAW, game engine, live broadcaster, media renderer or copyrighted-media licensing service.

## Why this phase

The previous draft PRs added deterministic World Bible story planning, guarded persistence, Markdown outline export, and CSRF/archival race hardening. This phase works from those exact contracts rather than adding a second table, another planner, or a new project editor.

The new dependency-free module `lib/sonara-world-bible-interchange.cjs` reads the canonical validated draft through `normalizedDraft`. It never trusts arbitrary client-output metadata, foreign asset URLs, media rights declarations or external credentials. Every file is built on demand from the tenant-authorized saved World Bible. It creates no generation jobs and never mutates the project.

## Actual export capabilities

| Download | Content | What it is NOT |
| --- | --- | --- |
| `/export/csv` | UTF-8, quoted CRLF cue sheet with scene numbers/IDs, locations, referenced entities, dependencies, timing basis and authored words. Unknown timing stays blank. Formula-like spreadsheet cells are apostrophe-prefixed. | Not a complete spreadsheet workbook, licensed publication, or DAW session. |
| `/export/otio?fps=24` | OTIO `Timeline.1 > Stack.1 > Track.1 > Gap.1` **timed placeholders** at 24/25/30/60 whole frames per second, plus SONARA metadata. Source range durations are scene seconds multiplied by chosen rate. No external media references. | Not rendered film, editor-specific timelines/plugins, automatically assembled clips, motion capture, drop-frame timecode or a universal OTIO importer guarantee. |
| `/export/midi` | Binary Standard MIDI File (format 0, 1 track, 480 ticks/quarter, fixed 120 BPM and 4/4). Track name, tempo, time signature, scene marker meta events and End-of-Track. Cue starts use `sceneStartSeconds * 960 ticks` exactly at 120 BPM. | **No notes, stems, effects, vocals, mix, instruments, sound synthesis, audio data, DAWproject container or real recorded music.** |

The OTIO and MIDI endpoints **reject** timelines containing an unknown scene duration (HTTP 422). A script/book outline cannot be disguised as a finished editorial project. The CSV remains available with blanks when timing is incomplete. The user-facing editor hides timed-export links when they would fail and explains how to complete planning first.

### Deterministic conventions

- CSV column values are quoted (double quote is escaped by doubling). Control characters are replaced with safe spaces. Cells that can trigger spreadsheet formula evaluation after leading whitespace start with a literal apostrophe. Spreadsheet-specific handling must be retested against target importer versions before making stronger security promises.
- OTIO timing is whole frames: `frames = sceneDurationSeconds * frameRate`. Since the planner uses whole-second durations and only integer frame rates, no fractional frames or time rounding are introduced here. The exported gaps are editorial placeholders, not media clips. Unknown durations fail closed rather than silently shortening or lengthening the timeline.
- MIDI tempo `500000 µs/quarter` and `480 ticks/quarter` produce exactly `960 ticks/second`. Every marker is a delta-time encoded event, and the final track End-of-Track is located at planned total duration. No MIDI channel note or system-exclusive event is emitted. The tempo is deliberately fixed; a configurable tempo map belongs to a separate, testable feature.
- The source World Bible fingerprint is **only** a content-comparison digest, not a signed rights certificate. Outputs explicitly carry no rendering/publication authority.

### Interoperability caveats and references

- OTIO serialized schema specification: https://github.com/AcademySoftwareFoundation/OpenTimelineIO/blob/main/docs/tutorials/otio-serialized-schema.md
- OTIO JSON format: https://github.com/AcademySoftwareFoundation/OpenTimelineIO/blob/main/docs/tutorials/otio-file-format-specification.md
- OTIO sample timeline: https://github.com/AcademySoftwareFoundation/OpenTimelineIO/blob/main/tests/sample_data/clip_example.otio
- Standard MIDI File bytes/events: https://www.cs.cmu.edu/~music/cmsip/readings/Standard-MIDI-file-format-updated.pdf
- DAWproject format is a separate ZIP/XML adapter with `project.xml` and `metadata.xml` and different track/asset requirements: https://github.com/bitwig/dawproject
- glTF 2.0 requires visual scene/node semantics and often buffers/assets. World Bible characters or places must not be mislabeled as actual 3D geometry: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html

## Security and operational gates

1. Review stacked PR #587 (World Bible persistence + Markdown) and PR #590 (cross-origin writes, archived-parent DB proposal). Both are draft; no SQL has been applied.
2. Run unit tests in `tests/sonara-world-bible-interchange.test.js` and private route tests in `tests/sonara-world-bible-routes.test.js` with Node 24 and real repo dependencies.
3. Check CSV formula protection (Excel, LibreOffice, target importer), Unicode and CR/LF inputs. Check that source materials or credentials cannot flow into exports via metadata. Verify no arbitrary file URI/URL ever gets embedded into OTIO output.
4. Import a generated `.otio` file with the installed OpenTimelineIO release (native reader and editor adapter). Confirm Gap durations and track kind; the repository currently includes no executed native OTIO-import proof.
5. Independently parse generated `.mid` with a standards-compliant MIDI parser and try importing into at least one approved DAW. Check frame/tick positions, track end, tempo, Unicode scene names and marker visibility. The in-repository tests use a binary event parser but are not vendor/DAW acceptance proof.
6. Verify existing paid/owner access gates, org isolation, HTML-escaping, `Cache-Control: private, no-store`, content-disposition, error behavior, max input limits, MIME/Content-Type and CDN cache rules.
7. Run exact-head frozen pnpm install, lint, typecheck, tests, build, OpenAPI completeness, route inventory, dependency scan, CodeQL, browser/mobile/accessibility checks. Prove native Supabase migrations separately before enabling the persistence feature.
8. Keep `SONARA_CREATOR_WORLD_BIBLE_PERSISTENCE_ENABLED` disabled until staging and security acceptance. Do not merge, migrate, publish or deploy without explicit owner-approved release gates.

## Roadmap after v1

- **Editorial:** source media approval, private asset ownership checks, safe signed references and actual OTIO Clip objects rather than placeholder Gaps.
- **Audio and DAW:** real MIDI notes, variable tempo map, quantization/beat automation, WAV stems and eventually a validated DAWproject ZIP/XML exporter.
- **Game systems:** a typed SONARA narrative quest-graph interchange, then separate glTF/OpenUSD adapters for real scene geometry and Godot/other engine integration.
- **Books/storywriting:** chapter hierarchy, manuscript drafts, screenplay formats, citations, licensing reviews, writing/grammar assistance and publishing approvals.
- **Podcasts and streaming:** approved local/hosted media workers, loudness checks, captions, WebRTC/HLS pipelines, logs/moderation, failover and explicit publishing permissions.

A worldbuilding story graph can inform these products, but it is not itself a playable game, mixed song, edited video, released book, or live stream.
