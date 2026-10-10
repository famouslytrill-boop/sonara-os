# SONARA Creator Studio — Narrative Integrity and World Graph Engine (Phase 4)

**Status: draft, feature-gated by upstream World Bible persistence.** This commit adds no tables, no provider credentials, no background worker, and no production deployment. It is stacked on PR #591, which depends on security PR #590 and persistence PR #587.

## Purpose

Creators writing a novel, screenplay, podcast season, vlog series, interactive story or game world need to know which story beats depend on which others and to export an editable plan. The existing World Bible schema already has:
- Entities: `character`, `place`, `faction`, `item`, `rule`.
- Scenes with a unique identifier, title, optional place, entity references, predecessor `dependsOn` IDs, and optional duration or derived voice-length estimate.
- Strict validation that a scene may only depend on earlier declared scenes. This rules out forward references and directed cycles, and is not a runtime game-choice graph.

Phase 4 deliberately reuses `normalizedDraft` and the existing project-access gate and canonical storage. It does **not** infer scenes, protagonists, scripted dialogue, player decisions, licenses, frame-accurate edits, AI prompts or generated media from absent input.

## Engine: `lib/sonara-world-bible-narrative.cjs`

The deterministic audit exposes the following reproducible measurements:

| Measurement | Computation | Meaning and limit |
| --- | --- | --- |
| Directed prerequisite edges | `E = Σ length(scene.dependsOn)` | Edges are author-declared design prerequisites, not player choices, activation triggers or production tasks. |
| Roots | All scenes with no `dependsOn` | Independent starting beats; not necessarily a story's audience opening. |
| Terminal scenes | All scenes that no later scene declares as a prerequisite | Structural sinks; not necessarily ending scenes. |
| Longest dependency chain | Dynamic program `D(v) = 1 + max(D(p))` over predecessors, zero when none | Number of connected prerequisite scenes on the longest chain. It is not a prediction of audience reading time. |
| Planned weighted longest path | `L(v) = seconds(v) + max(L(p))` over authored predecessors | Hypothetical sum along the longest weighted prerequisite path, **only** if every scene has timing. Otherwise `null`. Not critical staffing duration, schedule ETA or player completion time. |
| Sequential runtime | Sum of all scene durations when all are known | Production storyboard plan, not measured recording or run time. |
| Weak dependency groups | Components after treating author prerequisite links as undirected | Groups of beats not directly tied by prerequisites. This is an informational clue, not an automatic claim of disconnected narratives. |
| World element use | Unique per-scene appearances by entity ID or scene location | Unreferenced lore is an informational finding, never automatically deleted. |
| Timing coverage | Explicit versus supplied-word-and-rate estimate versus unknown | Unknown durations are not invented; downstream OTIO/MIDI keep rejecting incomplete timelines. |

The report includes an explicit advisory disclaimer and counts, groups, longest chain, warning codes, entity appearance counts and source fingerprint. It never claims to detect moral logic, originality, plot quality, plagiarism, genre suitability or character psychology.

## Derived exports

These new formats extend the existing authenticated
`GET /api/creator-studio/projects/:id/world-bible/export/:format`
endpoint. All outputs read the saved source **after** Creator Studio authentication, subscription/owner authorization and tenant membership checks. All remain private, no-store downloadable attachments when the persistence flag is enabled.

| Format | Extension | What is exported |
| --- | --- | --- |
| `audit` | `.json` | Deterministic narrative analysis and nonblocking warnings |
| `dot` | `.dot` | Graphviz digraph with every authored scene and prerequisite edge; labels escaped as quoted DOT strings, no media URLs or action links added |
| `fountain` | `.fountain` | Editable screenplay-style beat outline with explicitly forced `.SCENE ...` headings, scene references, prerequisites and planned duration; no invented action or dialogue |
| `quest` | `.json` | SONARA `sonara.game.quest-prerequisites.v1` for `game` or `interactive` mediums only; scene references and design prerequisites, `choices: []`, `gameTransitions: []`, no executable or playable claims |

The editor links to `audit`, `dot`, `fountain` for saved projects, and links to `quest` **only** for an interactive/game medium. The API separately refuses other media types for quest export with HTTP 422.

The previous CSV, OTIO, MIDI and Markdown exports stay unchanged. No migration or new database table is necessary for these derived files.

### Cross-format behavior and safety

- Source descriptions, titles, and scene links are validated and normalized. Arbitrary extra JSON properties and credentials never propagate to exported files.
- DOT escapes backslash, double quote, newline, carriage return and tabs inside quoted string attributes so user-authored scene titles cannot introduce Graphviz edges or node statements. DOT export is **data, not an executed Graphviz render**.
- The Fountain outline normalizes input to one line before assembling headings to prevent a user title from forging a new title-page field or scene heading. It remains an author-editable template, **not an existing full screenplay or book manuscript**.
- Quest graph edges represent author ordering constraints, not Twine/ink branching decisions. Upstream `dependsOn` is acyclic; exporting it as a playable flow would be a factual error. To build a playable prototype, SONARA must first introduce separately validated choices, conditions, outcomes and runtime state in a schema revision.
- Audit warnings are informational. An unreferenced character or independent component may be intentional and must not trigger automatic content changes.

## Research references

- Graphviz DOT abstract grammar and quoted IDs: https://graphviz.org/doc/info/lang.html
- Fountain syntax and forced scene headings: https://fountain.io/syntax/
- Twine/Twee 3 story and passage metadata (not a substitute for gameplay design): https://github.com/iftechfoundation/twine-specs/blob/master/twee-3-specification.md
- Inkle ink branching scripting semantics: https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md
- SONARA previous phase: `docs/architecture/SONARA_CREATOR_WORLD_BIBLE_INTERCHANGE_V1_2026-10-09.md`

## Verification and release gates

1. Verify precise parent head and cumulative diff against PR #591, including its own unresolved CI and native migration gates. No local merge, auto deploy or DB schema modification.
2. Run the dedicated `tests/sonara-world-bible-narrative.test.js` with actual Node and repository test runner. Validate known timing, unknown timing, mixed groups, lore warnings, determinism, title injection, stale references, wrong medium and field stripping.
3. Run extended `tests/sonara-world-bible-routes.test.js`: access denial to unauthorized/foreign workspaces; private/no-store attachments; valid audit/graph/outline/quest; game-only quest refusal.
4. OpenAPI operation counts, every route declared, correct MIME/filename, static analysis, browser/link tests, typecheck/lint/build and Node 22/24 exact-head CI.
5. Parse sample `.dot` with native Graphviz and sample `.fountain` with a suitable Fountain-compatible reader; validate real importer behavior, not just structural resemblance.
6. Confirm no one has enabled the upstream `SONARA_CREATOR_WORLD_BIBLE_PERSISTENCE_ENABLED` flag before reviewed Supabase migration, RLS proof, cross-tenant tests and release approval.

## Next project: authoring and game execution (separate approval)

A genuine writing environment needs long-form authored scenes, dialogue blocks, localization, full-text revisions, rights/citation metadata, spellcheck and accessible collaborative editing. That requires a versioned source schema with explicit migrations and edited document history.

A genuine interactive media/game engine needs authored choices, conditional transitions, story state, savegames, input/accessibility controls, deterministic simulation state transitions, scripting sandboxing and engine-specific adapters. None are implied by the scene prerequisite records or supplied by this phase.

All features remain off until review, security and production verification pass.
