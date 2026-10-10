# SONARA Creator Studio — Durable Interactive Story Revisions (Phase 6)
**DRAFT / UNAPPLIED** • October 9, 2026 • Stacked on #593 (and #592/#591/#590/#587).

## Objective
Turn the ephemeral author-written interactive story sidecar into a private, versioned writing workspace, without silent overwrites or direct public database writes. The user must explicitly save. Read, revisions list and historical-recovery endpoints are authenticated/tenant-filtered and no-store.

This change **does not** turn on production persistence, automatically merge any PR, create active database objects, start billable media jobs, invoke language models, publish scripts, or compile a game.

## Source implementation

- `lib/sonara-interactive-story-store.cjs`: resolves existing Creator project membership/archived status through the canonical project store, then resolves a validated private World Bible. Uses server-only Supabase credentials, with organization and project filters on reads.
- `GET /api/creator-studio/projects/:id/world-bible/interactive/draft`: most recent story snapshot with source `worldChanged` marker. A stale World Bible means **recovery-only**, not executable/resimulatable against changed entities.
- `POST /api/creator-studio/projects/:id/world-bible/interactive/draft`: author-supplied story schema, exact `expectedRevision` and `expectedWorldRevision`, x-sonara-intent story-save, JSON-only, cross-origin rejection, and established creator paid/owner guard. Calls exactly one server-side atomic PostgREST RPC.
- `GET .../interactive/revisions?limit=25`: private latest revision metadata, bounded to 1–25.
- `GET .../interactive/revisions/:revision`: private historical prose/dialogue/choices snapshot for author-controlled recovery, not automatic revert.
- An explicit **Save my authored draft** button and **Load last saved draft** button appear only with the storage flag. Loading requires confirmation before replacing unsaved text; saving requires confirmation and updates local revision on successful confirmed RPC. Conflict means no silent client merge; user must copy work and reconcile.
- New `SONARA_STORY_REVISION_PERSISTENCE_ENABLED=false` gate is independent of the existing World Bible and story-preview flags and remains off until database verification.

### Proposed PostgreSQL model (not migrated)
`docs/sql-proposals/creator-story-draft-revisions-2026-10-09.sql` describes:

| Object | Access | Invariant |
| --- | --- | --- |
| `creator_story_drafts` | service_role SELECT/INSERT/UPDATE only, RLS enabled, no browser policy | Exactly one latest snapshot per project, version and current World Bible fingerprint |
| `creator_story_draft_revisions` | service_role SELECT/INSERT only, RLS enabled, no browser policy | Append-only historical snapshots keyed by project and revision; cascade only on explicitly authorized parent deletion |
| `sonara_save_story_draft` | service_role EXECUTE only, SECURITY INVOKER | Locks active parent and World Bible, CAS creates/updates latest, appends history **in the same database transaction**, then returns confirmed fingerprint/version |

RLS and explicit least-privilege grants matter even with a server-secret backend; enabling RLS **alone** does not revoke default Postgres grants. There is deliberately no authenticated/anon mutation policy. The authorized server remains accountable for tenant membership and calling this role-restricted function with server-derived org/user IDs. PostgREST transaction semantics and `PT409` conflicts need live database proof.

**Invariant:** The latest draft revision and its immutable history snapshot either both commit, or both roll back. Two concurrent writers claiming the same `expectedRevision` must produce exactly one success and one conflict. An archived project or changed World Bible must not accept a new revision.

**Capacity budget:** Maximum 100 revisions per Creator project; each snapshot JSON at most 64 KiB. Uncompressed snapshot payload upper bound is roughly **6.25 MiB/project**, excluding PostgreSQL tuple/index, bloat, WAL, backups and replication. Stop at revision 100 instead of overwriting history. A later archival/export/retention policy requires explicit user approval and deletion/export assurances.

### Correctness and limitations

- The World Bible fingerprint is validated server-side. Revision save is refused when the saved story was created against an earlier World Bible; the historical author text remains readable for manual reconciliation. **Automated schema rebase is not yet implemented.** An explicit rebase or fork path is required to continue saving a story after its World Bible changes.
- The server validates scene IDs, character speakers, state, conditions and 32-decision runtime model through the existing `validateInteractiveStory` function before RPC. PostgreSQL stores the canonical structured story but does not independently evaluate complex narrative/game rules; the service credential must remain secret and server-controlled.
- Database migration replay and real PostgreSQL SQL parsing were **not performed** here. The SQL is intentionally a proposal under `docs/sql-proposals`, not `supabase/migrations`. There is no verified permission to activate it.
- Original PR #593 had CI failures on **two unused-variable lint warnings** and a native database replay failure involving **25-policy drift** in P1 RLS initialization. This phase removes the two warnings in its own stacked branch, but does **not** reconcile the 25 PostgreSQL policies or mark #593 green. Remediations to ancestor branches will need intentional integration/rebase to establish a passing upstream chain.
- SQL proposal assumes upstream `creator_world_bibles` and composite project/org uniqueness are applied. The upstream Word Bible SQL proposal itself must be reviewed, fixed where needed, and converted to a tested numbered migration before this schema can be accepted.
- No fake success path: if PostgREST RPC returns no confirmation or the fingerprint/revision mismatches, the adapter responds with storage-unconfirmed; a network timeout requires safe reconciliation, not automatic blind retry.
- The browser preview remains ephemeral: saving stores only the author's source draft and revision history, **not** game sessions, compiled binaries, published books, rendered films or licensed media.

## Specific release tests required

1. Existing exact-head and ancestor code gates: Node 22/24 lint with zero warnings, typecheck, route/API schema consistency, unit/contract tests, web accessibility/security, dependency scan, and CodeQL remediation.
2. **PostgreSQL native replay first.** Reconcile P1 25-policy definition drift by comparing repository migration authority with replayed policy definitions; do not alter or silently skip a protected rollback proof. Confirm PostgreSQL 16/17/18 and Supabase test-db RLS matrix.
3. In isolated Postgres, run two sessions concurrently saving same revision. Assert one returns 409, only one new history row, latest+history fingerprints match. Force an INSERT history failure and verify latest row rolls back with it.
4. Race story save against (a) parent archive and (b) World Bible update. Verify parent/world row locks and that no future write remains authorized for stale or archived project. Check isolation across two organizations and users with equal project IDs.
5. Read all grants on latest/history/RPC: `anon` has no access, `authenticated` has no table access, `service_role` has only the explicit operations. Function is SECURITY INVOKER, search path pinned. Avoid SECURITY DEFINER bypass.
6. Verify frozen retention limit of 100 revisions, response body statuses and MIME, history ordering, no plaintext credentials, and compare server-generated SHA-256 against stored fingerprints.
7. Test real UI load/confirm/save, no JavaScript execution of story prose, keyboard and assistive technology, unsaved-work recovery, session timeout and CSRF defenses. Existing Origin+Fetch-Metadata checks and custom header are defense in depth, not a replacement for a reviewed session-bound CSRF strategy.
8. Keep both `SONARA_CREATOR_WORLD_BIBLE_PERSISTENCE_ENABLED=false` and `SONARA_STORY_REVISION_PERSISTENCE_ENABLED=false` until explicitly approved migration, staging and one-tenant canary.

### Research and technical references
- Supabase Data API security/grants/RLS: https://supabase.com/docs/guides/api/securing-your-api
- Supabase RLS native testing: https://supabase.com/docs/guides/database/postgres/row-level-security
- PostgREST functions and transactions: https://postgrest.org/en/stable/references/api/functions.html and https://postgrest.org/en/stable/references/transactions.html
- PostgREST custom `PTxyz` status codes: https://postgrest.org/en/stable/references/errors.html
- PostgreSQL locking: https://www.postgresql.org/docs/current/explicit-locking.html

**Next phases:** Reviewed SQL migrations and native concurrency evidence; explicit story/world rebase; selectable version restore (as a new revision, not destructive rewind); privacy/retention controls; localization and provenance; true game runtime adapters after security and provider approval.
