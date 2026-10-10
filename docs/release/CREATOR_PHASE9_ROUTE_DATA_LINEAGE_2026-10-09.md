# SONARA Creator Studio — Phase 9 Route/Data Lineage Contract
**October 9, 2026 · Draft stack #596 → #595 → #594 → #593 → #592 → #591 → #590 → #587**

## Root cause confirmed by CI

At PR #596 head `b3308bbded69c27337eb96a693defabe0f90dd3f`, Docker, dependency, Node and native PostgreSQL checks completed successfully. The main SONARA Industries CI failed later at `node scripts/generate-capability-inventory.cjs --check` with **13 routesWithoutDataContract**.

The existing handler/source tracer does not follow the indirect `worldStore` / `storyStore` dependency from route registration to a private, default-off adapter. Neither a migration nor a live Supabase table is created by those 13 routes. Labelling all 13 as "reads nothing" would hide persistence and authorization boundaries, while pretending proposed tables are deployed would be a material false claim.

## Actual operations

| Operation class | Count | Data semantics |
| --- | ---: | --- |
| Existing World Bible read / export / write and author-provided interactive preview | 6 | Server-guarded `creator_world_bibles` proposal; saves require the upstream review-only SQL proposal |
| Private story latest/history read and author save | 4 | Server-guarded `creator_story_drafts` and `creator_story_draft_revisions` proposals, plus world-reference read |
| Original worldbuilding form / HTML preview / JSON preview | 3 | Repository-based form and deterministic `planWorldbuilding()` preview; source is *not saved* and no rendering/provider job exists |

The 10 database-dependent routes are **not operational** until the proposed SQL has been approved, promoted to numbered migrations, replayed, authorized, and enabled for a tenant. The 3 original planner routes are unsaved and do not imply a production content studio.

## Engineering changes

- New `lib/sonara-creator-route-data-contracts.cjs`: exact **13 registered route IDs** with declared mode, SQL reads/writes, adapter, feature flag and an honest source-backed reason.
- The inventory generator adds `creatorDataContract` **only to affected routes**, not globally. Proposed reads/writes appear as `proposedReadTables` and `proposedWriteTables`; they are *not* added to active `directTables`, `schemaMigrations`, or operational table counts.
- New validation cross-checks every route against the actual Express route list, the three review-only SQL tables from `PENDING_CREATOR_SCHEMA`, the two live source adapters, and the real `planWorldbuilding()` HTML/JSON handlers. It rejects missing routes, deleted flags, absent story-history references or missing planner source evidence.
- Explicit no-database descriptions apply only to the three original unsaved planner handlers. A future real outbound call, table trace or truncated trace on one will invalidate this classification.
- Five regression test groups (including mutations) and updated handoff Mocha file count.

## Security and release boundaries

Supabase requires both PostgreSQL grants and RLS for Data API exposure. A service-role key must stay on the backend; a default-off route is not proof that a proposed schema exists. References:
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://www.postgresql.org/docs/current/ddl-rowsecurity.html

**Not applied:** No SQL migration, project data mutation, feature flag activation, billing action, published media, background worker, merge or production deployment.

## Native generated-file gate remains mandatory

`scripts/generate-capability-inventory.cjs --check` also compares the complete generated JSON and Markdown artifacts, `data/capability-inventory.json` and `docs/CAPABILITY_MAP.md`. Updating only the route contract code is not enough: once invariants are green, it will correctly reject stale generated artifacts.

Regenerate **from the exact branch checkout** with:

```sh
pnpm install --frozen-lockfile
node scripts/generate-capability-inventory.cjs --write
node scripts/generate-capability-inventory.cjs --check
pnpm run lint
pnpm test
pnpm run verify:supabase-contract
```

Commit the generated JSON and Markdown outputs, and rerun exact-head CI. Regeneration cannot be replaced by hand-editing 13 JSON entries or disabling --check; this checkout must execute the generator to keep every counted route, tenant boundary and migration lineage synchronized.

**Status:** Source edits are committed; isolated JS contract tests passed (5/5). The large generated inventory has not yet been regenerated in the linked full repository, so **do not call this PR releasable or all-green**. Full Node24/26, native PG16/17/18, Docker, dependency, OpenAPI, accessibility and security verification remain required before downstream approval.
