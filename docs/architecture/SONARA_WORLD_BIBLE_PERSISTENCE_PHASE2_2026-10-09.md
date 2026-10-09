# Creator World Bible persistence — Phase 2 review

**Status:** code committed to a stacked draft branch. Default-off, unmerged and not migrated. Nothing in this draft changes live Supabase tables or SONARA production availability.

Parent draft: PR #587 (`feature/creator-worldbuilding-plan-20261009`).

## Architecture decision

Preserve the original `creator_projects` media graph: changing its `validateGraph` node kinds or underlying JSON may invalidate existing media editor, draft, audio render, captions and export assumptions. Worldbuilding is an **attachment**, not a new replacement project system.

`creator_world_bibles` is keyed by `project_id`, references `creator_projects (id, organization_id)` through a composite FK and contains one validated source snapshot with an independent revision number. A linked Creator Project can be audio, video, image or mixed; the World Bible represents the project's narrative/game/film/book/podcast plan, not a new media file.

The normalized source is the only stored creative payload. On read the deterministic planner recomputes estimates and SHA256 from that source; it is not a media render or a licensed publishing artifact. The response explicitly distinguishes `sourceSaved: true` from `blueprintIsDerived: true`. An unsaved blueprint's `persistence: not_saved` refers to the generated planning preview, not the attached source snapshot.

## Customer and API paths

| Action | Path | Authority |
| --- | --- | --- |
| View/edit World Bible | `GET /creator-studio/projects/:id/world` | Existing Creator Project paid/owner access gate |
| Read saved source/plan | `GET /api/creator-studio/projects/:id/world` | Existing Creator Project access + matching tenant |
| Save new / edit snapshot | `PUT /api/creator-studio/projects/:id/world` | Existing access + JSON and explicit editor intent + project revision check |
| Unsaved planner | `/creator-studio/worldbuilding` | From Phase 1, still useful without this migration |

JSON save body shape:

```json
{
  "expectedRevision": 0,
  "source": {
    "title": "Original World",
    "medium": "game",
    "entities": [
      {"id": "lead", "kind": "character", "name": "Lead"}
    ],
    "scenes": [
      {"id": "opening", "title": "Opening", "entityIds": ["lead"], "durationSeconds": 30}
    ],
    "resources": {"gameTickHz": 60}
  }
}
```

- `expectedRevision: 0` creates a missing attachment once. Subsequent edits supply the last saved positive revision. Stale revisions return 409. A matching PostgREST `UPDATE revision=eq.n` provides compare-and-swap behavior.
- The user cannot submit organization IDs, SQL table names, custom service endpoints, privileged content flags or media-generation privileges. Server-resolved organization and authenticated user are the only database scope.
- Reads and writes first pass through `projectStore.get`, which verifies project ID, resolved organization and membership. Deleted/foreign projects return 404; archived projects reject writes.
- Persistent editing routes are default-disabled via `SONARA_CREATOR_WORLD_STORAGE_ENABLED=false`. Opening them before verified release produces a truthful 503 and does not query the new table. The feature flag is **not** an authorization substitute.
- HTML uses escaped customer JSON and status text. Editor submission is explicit, no autosave. PUT requires JSON and `x-sonara-intent: world-bible-save`; the normal session, anti-CSRF/CORS settings and product access gates remain independently necessary.
- A SHA256 preview digest is a comparison fingerprint, not ownership/authorship evidence, C2PA credentials or a proof of originality.

## Data and security review

The DB statement is staged ONLY at `docs/sql-proposals/creator-world-bibles-persistence-2026-10-09.sql`, not under `supabase/migrations`.

Before promoting:

1. Confirm the exact Supabase project, available PostgreSQL version and baseline creator-project table migrations. Verify there are no conflicting existing tables/functions/trigger names.
2. Use **Supabase CLI `supabase migration new`** to generate the correct migration filename, then place and review the SQL. A staged SQL proposal must not be treated as migration authority.
3. Run on an isolated database/branch. Prove RLS on the new exposed table, explicit Data API grants, zero anon access, read-only member access, and service-role writes only. Run Supabase Advisors. Supabase's 2026 API exposure change requires explicit grants for newly created tables.
4. Verify composite project+organization FK by attempting a mismatched pair; test delete cascade separately. Replay a concurrent parent project archive and World Bible update; proposed invoker trigger locks an active parent row and rejects writes to archived projects.
5. Check actual PostgREST errors and response shapes for absent schema, duplicate create, stale CAS, invalid source, and network failure. Confirm the service role key never reaches browser sources, user-facing HTML, logs or output.
6. Test user A / user B / organization A / organization B, archived-project behavior, cross-tenant forged IDs, malformed JSON, 64 KB UTF-8 limit, XSS, 409 retry behavior, and dev/staging authorization. Test multiple sessions and rapidly alternating edits.
7. Run pnpm frozen install, typecheck, lint, full tests, OpenAPI verification, route inventory checks, build, security scanners, and Node 22/24 compatibility against **the exact feature head**.
8. Require explicit owner approval and one-tenant staging/canary before any runtime enablement. No automatic deploy, public listing, rights clearance or publishing action.

## Concurrency and limitations

- World Bible revisions are separate from the media Project Graph revision. Editing captions does not invalidate a creative narrative revision, and vice versa.
- Current CAS guarantees conflict detection only when the intended DB atomic filter is proven. It is **not** a change-history log, automatic merge, CRDT, full undo, or backup. Durable history snapshots and team collaboration remain follow-up work.
- The server validates scene dependencies and entity IDs within one World Bible, but does not create or automatically clear rights to external media, samples, sources or characters.
- No DAWproject, OTIO, glTF or game-engine output is generated by this phase.
- The DB trigger is **unexecuted proposal SQL**, not proven native behavior. In particular, error codes and lock interactions must be exercised against real PostgreSQL before flag activation.

## Research references

- Supabase grants and API exposure: https://supabase.com/docs/guides/api/securing-your-api ; https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- OTIO editorial external references: https://opentimelineio.readthedocs.io/en/latest/
- OWASP access-control/CSRF guidance: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

## Next gate after Phase 2

After native persistence is verified, the next isolated feature should be revision history and **validated interchange exports** (book outline/JSON, cue sheets, screenplay shot list, and safe OTIO metadata adapters). Keep license/rights checks as explicit independent requirements. Media rendering, DAW integration, game compilation, DRM and live broadcast remain separately governed projects.
