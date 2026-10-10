# Creator Studio — Phase 10 Native Concurrency and Atomicity Proof
**2026-10-09 · Draft PR · All PostgreSQL work occurs in a local disposable clone.**

## Verification strategy

Phase 9 proved serial CAS, World Bible RLS, private role grants, immutable revision history, and archived-project denial in the isolated clone of the native migration replay database. Phase 10 extends that evidence to **two independent PostgreSQL sessions** and a deliberately failed history append.

### Competing writes

A committed fixture `tests/sql/creator-story-concurrency-fixture.sql` inserts synthetic auth, Creator project, and World Bible data inside only `replay_creator_proposals`, a disposable clone of the canonical migration replay.

The Node native replay script writes **two different SQL files** and starts separate `psql` connections against the clone. Both request `expectedRevision=0`, but they supply different story fingerprints. The first session holds its transaction open briefly after running the RPC so a second writer encounters the unique-row conflict **before commit**.

Required outcomes:

- Exactly **one** `psql` process exits 0.
- Exactly **one** exits 3 with explicit PostgreSQL `PT409` conflict.
- A separate SQL session verifies exactly one latest draft and exactly one historical revision, both revision 1, with matching fingerprints.
- Unexpected SQL errors, two successes, two failures, empty proofs, partial history or other exit codes fail the required CI gate.

This is deterministic CAS protection against two first writes, not a load test or synthetic claim of high concurrency capacity.

### Atomicity on history failure

`tests/sql/creator-story-history-rollback.sql` begins a transaction and temporarily REVOKEs service-role INSERT rights on revision history. Under service_role, the RPC attempts revision 2; the history insert must fail with `insufficient_privilege`. The latest snapshot must remain revision 1 and no revision 2 history record may appear.

The temporary grant change is contained within `BEGIN … ROLLBACK` and cannot persist beyond this disposable test. The actual proposed RPC is not rewritten or granted new power.

### Existing release gates preserved

All existing migrations and P0/P1 tenant/RLS, policy drift, merchant, billing, and schema probes still execute before Phase 9/10. Both new probes target only the post-replay clone. The real migration ledger, app environment flags, and customer data remain unchanged.

**Still unproven:** archive-vs-save simultaneous race, cross-tenant privilege stress under multiple sessions, PostgreSQL statement timeout recovery, PostgREST transport retry semantics, hosted Supabase migration compatibility, backup/restore/retention policy, full browser accessibility and session-bound CSRF. These require separate evidence before an approved customer rollout.

Do not merge or activate `SONARA_CREATOR_WORLD_BIBLE_PERSISTENCE_ENABLED` or `SONARA_STORY_REVISION_PERSISTENCE_ENABLED` based on this test alone.

References: https://www.postgresql.org/docs/current/explicit-locking.html ; https://www.postgresql.org/docs/current/sql-revoke.html ; https://supabase.com/docs/guides/api/securing-your-api .
