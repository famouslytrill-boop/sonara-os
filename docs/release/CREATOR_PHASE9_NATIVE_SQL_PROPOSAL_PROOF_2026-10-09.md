# SONARA Creator Studio — Phase 9 Native SQL Proposal Proof
**October 9, 2026 — Review-only. No production database modification.**

## Why this phase exists

The repository now has proposals for three Creator Studio private writing tables but no approved migrations for them. Static source checks catch missing flags, grants and RLS declarations; they cannot prove that the actual PostgreSQL engine accepts the DDL or that the save transaction behaves as intended. The next release gate must use a native PostgreSQL process.

## Engineering change

`scripts/verify-migration-replay.mjs` now performs its existing canonical migrations, P0/P1 tenant and policy checks, commerce and migration invariants **unchanged**. After they finish, and before reporting their result, it creates a new database called `replay_creator_proposals` **inside the throwaway local PostgreSQL instance**, cloned from the verified `replay` database.

It then executes, in strict order:

1. `docs/sql-proposals/creator-world-bibles-2026-10-09.sql`
2. `docs/sql-proposals/creator-story-draft-revisions-2026-10-09.sql`
3. `tests/sql/creator-story-proposal-proof.sql` against only the clone.

The probe aborts CI on any PostgreSQL error or missing exact success marker. After the test the disposable PostgreSQL cluster and all databases are deleted by the existing guaranteed cleanup path. The canonical replay database's table inventory, migrations and completion count are **not** changed. This never contacts production Supabase.

### Required real-database assertions

- All three proposed tables have RLS enabled.
- `anon` and `authenticated` cannot directly read or mutate service-only story data; `service_role` can perform only the declared story operations, without UPDATE/DELETE on revision history.
- The saved-story RPC is SECURITY INVOKER; no `anon`/`authenticated` EXECUTE grants exist.
- One user can read their own World Bible but cannot see another organization's World Bible under the authenticated role.
- A first story save writes revision 1. Repeating `expectedRevision=0` is rejected; an authorized edit appends revision 2 and preserves revision 1's prose. A mismatching organization is rejected.
- When the World Bible fingerprint changes, an old story's write is rejected.
- An archived Creator project cannot accept a story revision or a direct World Bible update. Rejected writes leave history untouched.
- Every fixture uses synthetic auth accounts and runs under `BEGIN ... ROLLBACK`. No fake paid subscriptions, media renders, copyrighted works or user data are introduced.

### Explicit limitations and next milestone

Native SQL replay of proposed DDL is **necessary, not sufficient**. This phase proves serial CAS, historical retention, basic role grants and RLS/archival guards. It does **not** yet prove double-writer concurrency across independent PostgreSQL sessions, archive-vs-save races, forced history-insert failure rollback, hosted service-key policy, export/delete retention, or compatibility with an existing production ledger.

Do not move the proposals into `supabase/migrations` or activate `SONARA_CREATOR_WORLD_BIBLE_PERSISTENCE_ENABLED` / `SONARA_STORY_REVISION_PERSISTENCE_ENABLED` based on this test alone. A new migration must be created through the approved Supabase CLI workflow after owner approval, native concurrency proofs, staging migration review, and rollback planning.

### Research references

- Supabase guide — securing the Data API and role grants: https://supabase.com/docs/guides/api/securing-your-api
- Supabase guide — PostgreSQL RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- PostgreSQL reference — creating databases from templates: https://www.postgresql.org/docs/current/manage-ag-templatedbs.html
- PostgreSQL reference — lock modes and transaction behavior: https://www.postgresql.org/docs/current/explicit-locking.html

**Verification state**: code and SQL fixture committed in a stacked draft; exact-head native PostgreSQL 16/17/18 workflow is required before marking any assertion as proven.
