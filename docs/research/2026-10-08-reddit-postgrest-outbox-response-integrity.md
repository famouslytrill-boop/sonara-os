# SONARA research and implementation: PostgREST response-integrity boundaries

**Date:** 2026-10-08, America/New_York  
**Repository:** `famouslytrill-boop/sonara-os`  
**Scope:** SONARA One event outbox; cross-product payments, automation, media, CRM and Growth event reliability.  
**Status:** source change on draft PR, not production-certified. No deployment, schema mutation, provider call or resumed website.

## Research decision

Do not adopt an additional workflow engine just because developers on Reddit describe webhook and integration failures. SONARA already has transaction-scoped event outbox primitives. Close the correctness gap in the existing PostgREST adapter first: **HTTP success is not the same as receipt integrity**.

## Evidence matrix

| Finding | Evidence | Classification and contradiction | Engineering decision |
| --- | --- | --- | --- |
| Webhook retries can duplicate side effects when no authoritative idempotency receipt exists | [r/n8n, 2026-03-04](https://www.reddit.com/r/n8n/comments/1rkuh6x/webhook_retries_can_cause_duplicate_executions_in/) | Anecdote, not SONARA telemetry; standard at-least-once transport model | Keep canonical tenant/idempotency key and never transform an ambiguous transport response into success |
| Static workflow dedupe raises durability and concurrency concerns | [r/n8n, 2026-10-06](https://www.reddit.com/r/n8n/comments/1wz8idp/webhook_signature_check_dedupe_in_n8n_is_static/) | Single developer asking a question; not proof of a defect in n8n itself | Use persisted Postgres uniqueness and independent verified read-back; not in-memory “seen” maps |
| Service-role access plus caller-controlled identifiers creates a dangerous authorization boundary | [r/Supabase, 2026-08-08](https://www.reddit.com/r/Supabase/comments/1vizjyd/i_used_the_service_role_key_with_a_clientsupplied/) | Self-report; matches official bypass-RLS semantics | Confirm returned organization identity after privileged operations |
| RLS policies, DB grants and privileged SQL functions must be independently audited | [r/Supabase, 2026-10-02](https://www.reddit.com/r/Supabase/comments/1ww821x/the_rls_checks_id_run_before_launching_any/) | Community audit checklist, not authoritative certification | Retain two-tenant RLS tests and service-role response checks; never assume “RLS enabled” means a server-key path is safe |

**Authoritative evidence and contradiction search:**

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): server-held service-role/secret keys bypass RLS, so grants and all server-side authorizations must remain trustworthy.
- [Supabase API key migration](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys): legacy `anon` and `service_role` keys are being deprecated by the end of 2026. Migration to publishable and secret keys needs its own separate staged change and independent authorization review; do not silently rotate a production credential in this PR.
- [PostgREST representation](https://postgrest.org/en/latest/references/api/resource_representation.html): plural queries normally return an array. An array must still be validated for shape, count and identity.
- [PostgREST ignore-duplicates behavior](https://github.com/PostgREST/postgrest/issues/3976): `ON CONFLICT DO NOTHING RETURNING` can return an empty representation. An empty array after an ignored insert is not proof of successful creation. SONARA's existing scoped read-back must remain intact.

## Reproduced defects on main

Against the exact original `lib/sonara-event-outbox.cjs` source, using deterministic injected PostgREST mocks:

1. HTTP 201 enqueue representation with a row from another `organization_id` returned `{ok:true, created:true}`.
2. HTTP 200 filtered claim with `response.json()` rejecting returned `{ok:true,row:null}`, indistinguishable from a genuinely idle queue.
3. HTTP 200 settlement representation with an unrelated `id` and `organization_id` returned `{ok:true}`.

These are reproducible source-level failures. **They do not prove actual cross-tenant disclosure or a live duplicate charge.**

## Source implementation

File: `lib/sonara-event-outbox.cjs`.

- Parse only array representations; a JSON read failure, object response, or multiple returned rows cannot constitute a valid single-event response.
- On a newly enqueued row, require a present record ID, the intended `organization_id`, and the original `idempotency_key`.
- On `resolution=ignore-duplicates`, leave the existing verified read-back path intact; require the returned row's tenant/key identity before declaring `created:false`.
- Distinguish a genuinely empty claim array (`ok:true,row:null`) from malformed claim evidence (`ok:false`).
- On a claimed row, validate target organization and `state:claimed`; filtered claims also check the approved event kind and producer.
- After settlement, verify original outbox record ID, organization and expected persisted state (`delivered`, `ready` for retry, or `dead_lettered`). An empty settlement result still means `claim_lost`.
- Return small error codes only, with `row:null` when uncertain. No secrets or raw provider errors enter logs or customer-visible records.

**Test files:** `tests/event-outbox.test.js` updates the positive receipt fixture to include idempotency identity. The same existing `tests/event-outbox.test.js` now includes 20 additional positive and adversarial test cases (no extra test-file count); all 20 executed successfully with the checked-out code text in an isolated JavaScript test harness. This is **not** a full Node/Mocha run, nor a real PostgREST integration test.

## Follow-on failure and recovery policy

| Failure | Correct immediate state | Next safe recovery |
| --- | --- | --- |
| New enqueue response malformed or wrong identity | `enqueue_response_invalid` or `enqueue_identity_mismatch` | Retry using **same** idempotency key after inspecting the authoritative scoped row; never allocate a new charge or action ID |
| Duplicate lookup returns wrong tenant/key | `dedupe_identity_mismatch` | Quarantine and investigate privileges/proxy/schema, no event handoff |
| Claimed RPC returns malformed body | `claim_response_invalid` | Do not run handler. The DB may have leased a row; rely on stale lease recovery and incident alert |
| Claimed event is another tenant or unapproved type | `claim_identity_mismatch` | Do not run handler, alert; separately inspect claim SQL and tenant scope |
| Settlement response mismatches original row/state | `settle_identity_mismatch` | Do not claim delivered. **Do not blindly retry side effects**; query scoped durable state and reconcile provider receipt |

## Staging and release proof required

1. `pnpm exec mocha tests/event-outbox.test.js tests/event-consumer-readiness.test.js`
2. `pnpm install --frozen-lockfile`, lint, typecheck, build, full required tests, security scans, native SQL migration replay and CI on exact final commit.
3. Reproduce a failure with a real staging PostgREST role and a mock injected wrong-tenant return; prove no handler gets invoked; inspect DB row after ambiguous enqueue/settlement response.
4. Independently verify `claim_sonara_event_outbox_filtered` and `settle_sonara_event_outbox` production/staging signatures, grants, `search_path`, tenant equality predicates, and return state.
5. Confirm transactionally authoritative Stripe entitlements and external provider receipts without new charges, refunds, customer communications, or payout changes.
6. Review the separate event worker canary PR #511 and activation metrics PR #509. This patch stays in a different branch; no automatic merging of any draft PR and no production action.
7. Review planned upgrade away from legacy Supabase API keys under a different change set. Confirm supporting provider versions first.

## Product and business translation

**Business Builder:** customer -> job -> invoice -> payment source -> reconciled receipt; ambiguous event status is never “paid.”  
**Creator Studio:** asset -> approval/rights -> job reservation -> worker -> durable delivery; ambiguous receipt is never “finished.”  
**Growth Studio:** channel grant -> approved campaign -> delivery -> provider receipt -> measured result; ambiguous receipt is never “published.”

Shared rule: **claim, execute, settle, verify**, with persisted tenant identity, immutable event keys, owner approval for sensitive actions, bounded retries, and audit evidence. Subscriptions and automation costs require reconciled provider costs; unknown values are unknown, not zero.

**Stop condition:** no deployment or runtime activation until mandatory exact-head checks and separately approved staging proofs succeed; preserve the owner's temporary production-offline requirement.


## Follow-up engineering: claim-owner fencing token validation (October 8)

### Root cause and trace
The native `claim_sonara_event_outbox_filtered` migration sets `claimed_by = nullif(btrim(p_consumer), '')` and returns `event.*`. That token is also used by `settle_sonara_event_outbox` to prevent stale workers from recording successful settlement after a new worker reclaims a lease. However the JavaScript PostgREST adapter on the previous PR head validated only `organization_id` and `state = 'claimed'`, so an HTTP 200 claim receipt with another worker's token was accepted by both `claimNext` and `claimNextFiltered`.

An exact source before/after probe supplied a single tenant-correct `claimed` row with `claimed_by = stale-worker` while invoking each claim method with `consumer = current-worker`. The earlier PR #512 source returned `ok:true` for both; the amended branch returns `ok:false, code:'claim_identity_mismatch', row:null` for both.

### Change
`matchesClaim` now requires `row.claimed_by === claimOwner`. Both claim entry points pass the requesting worker token. A mismatch refuses work before a downstream handler is invoked; no privileged policy or production SQL migration is altered. The existing positive receipt still passes.

**Tests** include mismatched, missing, null and empty `claimed_by`, and a two-worker same-tenant scenario in which one invocation receives another invocation's claim. All were inserted into the existing `tests/event-outbox.test.js` to preserve generated test-file counts.

### Research / remaining limitations
- [PostgreSQL 18 SELECT documentation](https://www.postgresql.org/docs/current/sql-select.html) confirms `SKIP LOCKED` is useful to avoid contention between queue consumers but provides an inconsistent view and does not guarantee external side effects happen once.
- [PostgreSQL job queues need leases, August 4 2026](https://ghassan.de/en/articles/postgres-job-queue-leases) explains why durable leases, fencing tokens, crash recovery and idempotent external effects must supplement transient row locks. This is independent practitioner guidance; the code and migration provide SONARA-specific proof.
- This check validates the *returned receipt*, not continuous ownership through execution. The claim could still expire immediately after the check; reliable provider idempotency, bounded handler times, settlement enforcement in SQL and reconciliation on unknown outcomes remain necessary.
- Isolated adapter tests do not prove PostgreSQL concurrency safety or live provider integration. Run full Mocha/Node and two-worker Postgres test (lease expiry, stale owner, current owner) in a separately authorized staging project before release.

### Integration boundary
Draft PR #511 strengthens handler timeouts and safe retries; draft PR #512 strengthens PostgREST receipt identity. Validate them *together* only after the #508 release-repair branch has passing exact-head checks. No production activation is authorized.
