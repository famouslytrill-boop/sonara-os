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
