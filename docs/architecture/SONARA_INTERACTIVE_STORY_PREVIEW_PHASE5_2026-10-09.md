# SONARA Creator Studio — Interactive Story Preview v1
**Phase 5 engineering review • October 9, 2026 • Default disabled • No live deployment**

## What is actually implemented

This phase adds **author-supplied** prose, character dialogue, choice links, limited conditions and bounded integer state changes, with a deterministic **unsaved preview**. It does not claim complete game development, Twine/ink runtime support, project-persistent manuscripts, DAW integration, game binaries or broadcasting. Every choice and line of dialogue must be explicitly written by the creator.

It extends the canonical World Bible v1 from draft PR #587 and the narrative/interchange work of stacked PRs #590, #591 and #592. Those upstream PRs have unresolved release gates. No database schema, migrations, service credentials, generated media worker or external provider calls are changed in this PR.

### Scope and data model

`lib/sonara-interactive-story-draft.cjs` validates a new **ephemeral sidecar**:
```json
{
  "version": 1,
  "startSceneId": "village",
  "state": [{"id":"trust","initial":1,"min":0,"max":3}],
  "scenes": [
    {
      "sceneId":"village",
      "prose":"The creator writes the setting.",
      "dialogue":[{"speakerId":"hero","text":"What now?"}],
      "choices":[
        {"id":"go", "label":"Continue", "targetSceneId":"camp",
         "condition":{"stateId":"trust","op":"gte","value":1},
         "effect":{"stateId":"trust","delta":1}}
      ]
    },
    {"sceneId":"camp","prose":"An authored ending.","dialogue":[],"choices":[]}
  ]
}
```

The authoritative world scene and character IDs come from the authenticated, tenant-isolated World Bible read; invented scene references, non-character dialogue speakers, missing targets and arbitrary fields are rejected. Every state variable has an integer initial/min/max and cannot be mutated beyond its declared bounds. No arbitrary JavaScript, network tools, dynamic expressions, scripts, WASM, text interpolation, open-ended condition languages or provider calls are allowed.

**Limits:** 64 KB draft payload, 64 scenes, 16 state variables, 16 dialogue lines/scene, 8 choices/scene, 32 simulated decisions, bounded text and integer ranges. Source is canonicalized and its fingerprint computed server-side. The hash is a content fingerprint only, not authorship/copyright evidence.

### Choice semantics

At scene `s`, a choice `c` is available only if:

```
allowed(c, state) = condition(c, state) AND
     min(effect.variable) <= state[effect.variable]+delta <= max(effect.variable)
```

On a selected choice, apply its explicit integer delta and move to its explicit `targetSceneId`. No other actions exist. The preview returns the current scene's authored prose and dialogue, the available choices, current state, scene-visit trace and final status:

- `awaiting_choice`: at least one authored, allowed choice is available.
- `authored_end`: the current scene contains zero choices.
- `no_available_choices`: the scene has choices, but all are blocked by authored conditions or state limits.

A self-link or cycle in an authored choice graph is allowed **only as preview data**; at most 32 decisions run per request. A loop is explicitly marked when a scene repeats. A scene's World Bible `dependsOn` is a design prerequisite, never an implicit runtime story condition. Missing authored scenes are reported as warnings; no dialogue or choices are generated on the creator's behalf.

### API and browser

Private, tenant-guarded route:

`POST /api/creator-studio/projects/:id/world-bible/interactive/preview`

Requires current Creator Studio paid/owner access, authenticated membership to that **specific project**, existing saved game/interactive World Bible, and an exact `expectedWorldRevision` for conflict detection. Requires JSON with `x-sonara-intent: interactive-preview`; rejects explicit cross-origin and cross-site Fetch Metadata requests. Responses are private and no-store.

The browser offers a JSON textarea and optional comma-separated choice-ID sequence on the existing World Bible project page. It uses `textContent` to display reports and errors, never unsafe HTML injection or implicit script execution. It is not autosaved: authors must copy draft JSON before leaving. The editor is rendered only when the separate preview flag is enabled and the saved medium is `game` or `interactive`.

Both flags start **false** in `.env.example`:
- `SONARA_CREATOR_WORLD_BIBLE_PERSISTENCE_ENABLED=false`
- `SONARA_INTERACTIVE_DRAFT_PREVIEW_ENABLED=false`

The second feature cannot work without the verified first. No new Supabase table is added. This is intentional: persistent writing, revision history, conflict resolution and collaborative authorship need an independently reviewed, tenant-isolated schema and migration.

### Sources and format distinctions

- Twine Twee 3 (passage text, story metadata and compiled story-format distinction): https://github.com/iftechfoundation/twine-specs/blob/master/twee-3-specification.md
- Twine 2 JSON authoring (passage metadata/text): https://github.com/iftechfoundation/twine-specs/blob/master/twine-2-jsonoutput-doc.md
- ink authoring/runtime specification: https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md
- OWASP business logic checks including contextual authorization: https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html
- OWASP access control on **every request**: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

This is a SONARA native data contract, **not** a compatible Twine/Twee, ink, Harlowe, SugarCube or Godot player. Any importer/exporter or real playable engine needs separate format adapters, legal/licensing checks and test fixtures.

## Release and integrity gates

1. Merge-safe review of PRs #587 → #590 → #591 → #592 and this branch, checking parent-head drift, existing Node/runtime CI, security scanners, OpenAPI/route inventory, and browser accessibility. All are drafts until checks are green.
2. Run real Node 22/24 tests for `tests/sonara-interactive-story-draft.test.js`, and extended `tests/sonara-world-bible-routes.test.js`. Exercise 32-choice loops, invalid/missing characters, wrong target IDs, duplicate states, negative/positive state deltas, bounds overflow, unknown source fields, hostile prose and oversized payload.
3. Validate the full server chain: anonymous/expired/foreign tenant/workspace, route access and CSRF mitigations, session cookie settings, JSON intent, 409 stale World Bible, 503 disabled gate, no-store caching and no secrets in previews. Check reverse proxy Origin handling.
4. Verify on staging that the browser shows and edits JSON accessibly on mobile, reports invalid choices clearly, and does not lose work unexpectedly. Provide explicit export/device saving only after UX and privacy reviews.
5. Native PostgreSQL schema/grants/RLS/archival-race migration replay of upstream World Bible is a separate prerequisite. No additional migration is necessary for this preview.
6. Explicit owner approval and a one-tenant canary **before either feature flag is enabled**. No code merges, production migrations, worker activation, billing events, media generation or publication here.

## Subsequent phases

- **Phase 6 (schema):** persisted `creator_story_scripts` revisions, stable prose/dialogue versioning, tenant RLS and revision CAS, backup/delete/export handling.
- **Phase 7 (runtime):** durable state snapshots and resumable game sessions, anti-cheat/business-logic policy, contextual permissions, author-created branching transitions and rollback/backtracking semantics.
- **Phase 8 (interchange):** Twine/Twee, ink and game-engine adapters with compatible syntax, escaping tests and importer round-trips; documented limits.
- **Phase 9 (media):** approvals for media-source references, real timeline/editor/DAW adapters, rendering jobs, provider credentials, cost budgets and publishing consent.

Nothing in this PR constitutes a finished playable game, rendered film, mastered soundtrack, completed audiobook, released book or automatically authorized publishing workflow.
