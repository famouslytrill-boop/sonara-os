# SONARA operational-state transactional boundary

Date: 2026-10-09. Status: **review draft — no migration applied, no live database write, no route enabled**.

This expands the combined SONARA platform draft PR #563. It supplies an internal orchestration seam for Business Builder, Creator Studio, Growth Studio and the parent site without claiming they can be started, stopped or self-healed today.

## Research and existing objects

Read-only GitHub schema inspection and the connected Supabase preview inventory confirmed that:
- public.sonara_control_plane_checks is a registry for named readiness checks. It has no unique operational mode revision and is **not** an authority for pausing or resuming the website.
- public.platform_jobs and public.platform_job_events provide generic worker history. They are not a tenant lifecycle ledger or a substitute for a fencing epoch.
- public.system_audit_events and public.entity_incidents provide wider audit/incident data but do not bind one immutable approval to one versioned lifecycle mutation.
- The connected Supabase project is preview-channel. Do **not** assume it is the production deployment target.

Official references:
- https://www.postgresql.org/docs/current/sql-update.html — conditional UPDATE/RETURNING
- https://www.postgresql.org/docs/current/ddl-rowsecurity.html — RLS and role limitations
- https://supabase.com/docs/guides/database/postgres/row-level-security — exposed schema grants, RLS and pgTAP testing
- https://supabase.com/docs/guides/database/functions — PUBLIC function execution and SECURITY DEFINER risk
- https://supabase.com/docs/reference/cli/global-flags — migration new and db push

## Implemented internal coordinator

File: lib/sonara-operational-transition-coordinator.cjs

The factory operationalTransitionCoordinator({ store, authorizer, evidenceVerifier }) requires explicit, trusted server-side dependencies. It is **not a web route**. It accepts a command with an exact platform/tenant scope, canonical tenant UUID where required, event ID, approval ID, expected revision and target mode. It does **not** accept actor identity, owner approval or evidentiary flags supplied by the caller.

Required trusted operations, all inside **one** transaction:
1. authorizer.authorize({ tx, session, scope, organizationId, action }) — revalidate server session, role and tenant membership using the canonical authority, not JWT user-editable metadata.
2. tx.readStateForUpdate — lock the authoritative scoped mode/revision record. Do not auto-create a missing tenant/platform state.
3. tx.nowMs — database-trusted clock inside that transaction; reject bad or non-monotonic time sources.
4. tx.readApprovalForUpdate — obtain a uniquely identified, unconsumed, approved record bound to the same scope, organization, from/to and expected revision. Require a separate approving actor, up to 15 minutes validity and expiration after current DB time.
5. authorizer.verifyApproval — independently recheck the owner/delegated approver's exact authority, and reject revoked approvals.
6. evidenceVerifier.verify — independently check verified incident, job-drain, health, release and safe-shutdown facts. Calling the policy with hardcoded true booleans is not evidence.
7. Re-evaluate operationalTransitionDecision against the locked state.
8. tx.consumeApproval (exactly one row), tx.compareAndSwapState (exactly one row), tx.appendAuditEvent (exactly one row). The transaction must roll back ALL steps when any operation fails, including an audit uniqueness conflict.
9. withTransaction must not resolve until COMMIT succeeds, and must reject/roll back on any thrown error. Only then may the coordinator return applied=true. External database/provider errors are redacted.

The coordinator never changes provider credentials, starts a process, runs cleanup, applies a migration or bypasses CI. Without a trusted adapter and schema it cannot affect a live service. A caller cannot make its result authoritative by supplying fake callbacks; the backend must own the dependencies and control the connection.

## New PostgreSQL transaction adapter — Pass 11 (still not wired)

File: `lib/sonara-postgres-operational-store.cjs`.

This pass adds a Node-style `pool.connect()` / `client.query()` adapter using a single pinned SQL client per logical transition. It requires an explicitly supplied server-selected `environmentKey` from `local`, `preview`, `staging` or `production`. The current public deployment does **not** import or instantiate this adapter. No credentials or SQL text are obtained from user-supplied lifecycle commands.

The adapter references a future private schema with these literal names:

- `sonara_operations.operational_scope_state` — `id`, `environment_key`, `scope`, `organization_id`, `mode`, `revision`, `updated_at`.
- `sonara_operations.operational_approvals` — `id`, `state_id`, `status`, `from_mode`, `to_mode`, `expected_revision`, `approved_by`, `issued_at`, `expires_at`, `revoked_at`, `consumed_at`, `consumed_event_id`.
- `sonara_operations.operational_transition_events` — `id`, `state_id`, `approval_id`, `revision`, `from_mode`, `to_mode`, `actor_id`, `recorded_at`.

**Migration is still required; these objects are not claimed to exist.** A read-only `pg_catalog` query against the connected Supabase preview database returned zero matching tables in `sonara_operations` or for the three named operational tables. This confirms that executing the adapter against that preview project now would fail closed, not perform a lifecycle transition. All user-specific values, environment scopes, revisions, actor IDs and UUID receipt IDs use bound parameters. The adapter locks the authoritative state row and approval, rechecks approval expiry during consumption using the database clock, uses `UPDATE ... WHERE revision = $n RETURNING id` for compare-and-swap, and inserts one unique event. Every step must return exactly one affected row.

The adapter uses `BEGIN`, session-local 2-second lock and 10-second statement limits, then `COMMIT` on the same client. On a rejected write or error before COMMIT, it issues ROLLBACK. If COMMIT itself errors, the outcome is **indeterminate** because the database might already have applied the transaction; the module raises the sanitized `SONARA_COMMIT_OUTCOME_UNKNOWN` code. The coordinator translates that into `commit_outcome_unknown_reconciliation_required`. The event ID is the durable reconciliation key. **Never auto-retry the same approval after an uncertain commit.**

The adapter exposes `tx.authorizedQuery` **only to server-owned authorizer and evidence verifier implementations** inside that transaction. Such implementations are not delivered in this pass and must be security-reviewed against SONARA's canonical sessions, membership tables, independent owner approval and incident records. Those trusted callbacks must not accept arbitrary SQL from a client or expose the PostgreSQL pool. Running the module alone does not authenticate an actor or establish access-control correctness.

The coordinator now requires UUID event/approval IDs, verifies `revokedAtMs` is absent and only returns `applied:true` after the transaction adapter promises a successful COMMIT.

**Focused test coverage:** 10 adapter and coordinator regression cases passed 170 assertions in an isolated V8 harness, including bound query parameters, one-client sequencing, rollback on staged failures, concurrent-write conflict results, cross-tenant and forged-evidence rejection, revoked or stale approval refusal, ambiguous COMMIT, and coordinator-to-adapter compatibility using mocked PostgreSQL results. This does **not** prove that actual SQL runs, authorization is enforced, schema exists, tests pass under Node 24, or operations are safe on production.

### Critical database integration constraints

1. Schema grants must be reviewed for `PUBLIC`, `anon`, `authenticated`, `service_role` and any dedicated backend role. Private schema not exposed via PostgREST; RLS defense in depth and privilege checks needed.
2. Use UUID primary keys for approval/event IDs; previous opaque IDs in the pure audit replay remain non-authoritative and cannot be substituted for SQL receipt IDs without normalization.
3. Enforce uniqueness for state per `(environment,scope,organization)`, event per `(state_id,revision)` and one-use `approval_id`; ensure approval `state_id` foreign key and approved-by lookup.
4. Verify real `pg` driver `rowCount`, bigint parsing and transaction semantics in a disposable database. Stage owner approval and incident evidence inside the **same transaction**.
5. Run two independently connected clients racing for one state and simulate loss of COMMIT acknowledgment; query event receipt to distinguish committed from not committed before any retry.
6. Do not add a production route or service-role action to invoke the adapter until migrations, RLS tests, human authorization and full CI are verified.

Research: PostgreSQL `UPDATE ... RETURNING` and conditional updates (https://www.postgresql.org/docs/current/sql-update.html), RLS and privileges (https://www.postgresql.org/docs/current/ddl-rowsecurity.html), and Supabase RLS guidance (https://supabase.com/docs/guides/database/postgres/row-level-security).

## Pass 12 — exact positive-only recovery from indeterminate COMMIT

Files: `lib/sonara-postgres-operational-store.cjs` and `lib/sonara-operational-transition-coordinator.cjs`.

**Defect addressed:** a successfully acknowledged COMMIT could previously appear to fail to the caller if `client.release()` raised an exception. The adapter now preserves the confirmed COMMIT result across connection-pool release errors. When the COMMIT acknowledgement itself is lost, it still returns the sanitized `SONARA_COMMIT_OUTCOME_UNKNOWN` condition. No automatic retry of a consumed approval is safe.

**New recovery contract:** `store.withReadOnlyTransaction(work)` opens a separate, read-only PostgreSQL transaction on the **authoritative primary** (no eventually-consistent read replica), with a scoped receipt lookup `tx.readCommittedEvent`. The coordinator's `reconcile({session,command})` independently checks the current authorized actor and tenant through its trusted authorizer, then verifies exact event UUID, approval UUID, actor UUID, environment, scope, tenant UUID, expected prior revision, next revision and destination mode. The read-only SQL joins the immutable audit receipt with the one-use approval and original state, requiring `a.consumed_event_id = e.id`, consumed timestamp, matching from/to, `e.revision = a.expected_revision + 1`, and `s.revision >= e.revision`.

**Three possible results:**
- `confirmed_committed`: complete event and approval proof exists for the authorized actor. This does not reexecute the transition.
- `unresolved`: receipt absent, invalid or unreadable, or the DB lookup unavailable. **Do not treat absence as proven rollback or safe retry.**
- `refused`: caller-supplied evidence, malformed receipt identifier, invalid scope or unauthorized tenant actor. Does not divulge whether another tenant's event exists.

All cases set `retryAuthorized: false`; do not automatically replay a command merely because a network call failed. This read-only verification does not substitute for separately authorized restorative action or an external provider reconciliation.

**Operational prerequisites:** the PostgreSQL pool must target the authoritative production writer for that environment, with current read-your-writes visibility; access through an asynchronous replica could produce false "not found" ambiguity. The private schema must ensure event immutability, unique event/approval IDs, one-use approval consumption, tenant-safe joins, and audited revocation. The coordinator accepts only server-supplied authorization, and the read query runs inside a PostgreSQL transaction declared `READ ONLY`, which prohibits ordinary table writes. SQL arguments are parameterized. No browser-exposed RPC, schema migration, endpoint, or monitoring job has been enabled.

**Focused test evidence:** committed source passed 13 coordinator/adapter tests with 218 assertions, including end-to-end mocked PostgreSQL receipt lookup, missing/foreign/forged events, unauthorized actor, read error and rollback, SQL-value parameterization, full-mode rollback and post-COMMIT release exception. A regression initially caught an incorrect four-part UUID check in the adapter; it was fixed to the complete five-part UUID format and all 13 cases passed.

**Not yet proven:** actual PostgreSQL SQL parsing and runtime, pg driver behavior on connection loss, real primary/replica consistency, CI runner execution, branch protection, multi-client CAS and tenant RLS. Do not claim operational activation or real committed customer events from mocked fixtures.

References: https://www.postgresql.org/docs/current/sql-set-transaction.html and https://www.postgresql.org/docs/current/sql-update.html .

## Schema design for review (NOT an executable migration)

Generate a dated migration using the real installed Supabase CLI before committing DDL. Reconcile existing database migrations and the production target first. The relational model needs **three** operator-only tables, preferably in a non-exposed schema:

1. operational_scope_state: immutable state_id (UUID PK), environment_key (approved enum/text), scope ('platform'/'tenant'), organization_id (UUID, null only when platform), mode, revision BIGINT CHECK >= 0 and less than maximum safe JS integer, updated_at. Add **partial unique indexes** for (environment_key) WHERE scope='platform' and for (environment_key,organization_id) WHERE scope='tenant'. Tenant keys MUST NOT collide with the platform key.
2. operational_approvals: approval UUID PK, state_id FK, from_mode, to_mode, expected_revision, approved_by UUID, issued_at, expires_at, consumed_at, consumed_event_id UUID, revoked_at, reviewed_evidence_reference. Enforce short expiry, no reuse and state/scope binding. Only trusted operators can insert/revoke; never accept a client-supplied Boolean as proof.
3. operational_transition_events: event UUID PK, state_id FK, approval_id FK UNIQUE, revision BIGINT, from_mode, to_mode, actor_id UUID, recorded_at, trace_id nullable. UNIQUE(state_id,revision) prevents two transitions receiving one revision. No arbitrary customer content or secrets in trace fields.

On all new tables: explicit REVOKE for PUBLIC/anon/authenticated, ENABLE and preferably FORCE RLS, restricted backend connection with a documented privilege model, explicit indexes and NO browser-facing grants or SECURITY DEFINER RPC. A service-role connection bypasses RLS, so RLS is **not** the trusted authorization boundary for that role; identity and tenant permission must be verified before writes. A dedicated non-bypass database role could strengthen this further but needs a reviewed connection and migration plan.

### Atomic mutation specification

Within one database transaction using bound parameters, compare:
- stored state_id, approved environment, exact scope and organization_id;
- prior mode and expected revision;
- approval's state_id, mode pair, expected revision, valid status and expiry according to DB clock;
- current authorization/incident evidence.

Consume approval once, UPDATE state WHERE revision and mode still match, and INSERT unique event. Require precisely one affected row for each write, and ROLLBACK otherwise. The state mutation and event insert must share the same SQL transaction and session, not independent REST/HTTP requests. Never swallow a failed audit write after the state update or blindly retry an old approval.

### Concurrency and data-isolation acceptance

- Two operators race from revision N: at most one COMMIT, exactly one new event at revision N+1.
- Two different tenant UUIDs cannot read, mutate, consume approvals or emit receipts in each other's scope.
- Platform-scoped commands cannot be reinterpreted as tenant commands or vice versa.
- Approval consumed, revoked, expired, foreign-scoped, self-approved, or tied to an older mode/revision always rejects.
- A failed audit insert, CAS, approval consumption or transaction COMMIT must leave state, event ledger and approval consumption unchanged.
- No direct transition from lockdown/offline to active; a verified incident-clearance step into paused must precede separately gated activation.
- The plan must survive transaction retries, connection pool reuse and service restarts without duplicate business effects.
- Avoid UPDATE-through-RLS surprise: PostgreSQL requires appropriate SELECT policies in addition to UPDATE when using a non-bypass authenticated role.
- Read checks should verify explicit GRANTs AND RLS state for all three tables.

### Verification completed on the draft

Five focused coordinator tests were executed against the exact committed module with a transactional **in-memory fixture**. They prove the logic rejects untrusted proofs, foreign identities, stale/expired/reused approvals, missing incident evidence and database conflict results; the fixture rolls back staged state and approval mutations when CAS or audit insert is refused. This tests **coordinator code**, not real SQL atomicity. Production integration, true concurrent SQL transactions, pgTAP, migrations, Node-24 full suite, and live rollback are still unverified.

## Engineering next gate

1. Restore exact-head GitHub CI execution and enforce main branch rules/mandatory reviews.
2. Verify the intended canonical production Supabase mapping, current migration history, backup/restore point and owner release plan.
3. Run the actual Supabase CLI against a disposable, approved staging checkout. Generate migration with supabase migration new; never invent an applied timestamp.
4. Implement the three-table schema, migrations and SQL adapter (or safely reuse any canonical overlapping tables found at final review), with negative grant/RLS tests and real concurrent transaction integration tests.
5. Verify release gates, run a single low-risk staging canary, then seek separate owner approval before any production migration or site reactivation.
