# SONARA — Reddit-Sourced Worker Reliability Research and Implemented P0 Hardening

Date: 2026-10-08 (America/New_York). Repository: `famouslytrill-boop/sonara-os`. Scope: SONARA One shared execution/outbox infrastructure. This record accompanies a **draft PR**; it is not proof of deployed or live-provider operation.

## Decision

Prioritize provable, tenant-scoped, at-least-once event delivery before new agents, marketing automation, billing notifications or third-party social publishing. Do **not** add another queue framework. Harden the existing `lib/sonara-event-consumer.cjs`, its synthetic one-tenant canary, and negative tests.

## Source-grounded research evidence

| Claim / customer pain | Source and date | Strength / contradiction | SONARA decision |
| --- | --- | --- | --- |
| Retried webhooks can cause duplicate downstream side effects | Reddit r/n8n, 2026-03-04: https://www.reddit.com/r/n8n/comments/1rkuh6x/webhook_retries_can_cause_duplicate_executions_in/ | User anecdote; directionally consistent with ordinary at-least-once delivery. It does not demonstrate SONARA's exact failure rate | Require event/outbox uniqueness, bounded attempts, transactionally fenced settlement, owner approval for sensitive actions |
| Developers report confusing situations where the payment was accepted but the application never recorded the resulting webhook | Reddit r/stripe, 2026-04-24: https://www.reddit.com/r/stripe/comments/1sumo3c/stripe_webhook_debugging/ and r/SaasDevelopers, 2026-03-08: https://www.reddit.com/r/SaasDevelopers/comments/1ro21k3/webhooks_are_the_part_of_saas_nobody_warns_you/ | Self-reported incidents; not statistics or proof that SONARA suffers these exact bugs | Reconcile webhook receipts against the authoritative provider, distinguish retryable from permanent failures, never issue fresh charges from a retry notification |
| Multiple-tenant RLS alone is not equivalent to testing every server-credential action | Reddit r/Supabase, 2026-08-26: https://www.reddit.com/r/Supabase/comments/1vz9yyu/multitenants_advices/ and 2026-10-03: https://www.reddit.com/r/Supabase/comments/1www4uo/hardening_supabase_rls_for_multitenant_isolation/ | Some social replies contain vendor promotion or oversimplified JWT claims; verify against authoritative docs | Verify tenant + kind + producer after every service-role queue claim and before handler execution |
| Small operators need invoices/payment workflow continuity more than hundreds of loosely connected features | Reddit r/CRMSoftware, 2026-09-23: https://www.reddit.com/r/CRMSoftware/comments/1wnuiit/looking_for_a_crm_with_invoicing_before_our/ and r/smallbusiness, 2026-01-27: https://www.reddit.com/r/smallbusiness/comments/1qod9o9/what_tools_are_we_using_for_invoicingaccounting/ | Small self-selected samples; demands further interviews | Once worker proof is credible, connect job -> invoice -> provider event -> customer notification with a single correlation trail |

**Primary-source cross-check:** Supabase explicitly documents that service-role credentials bypass RLS and require server-side protection: https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/guides/getting-started/api-keys . Stripe documents idempotent requests and webhook event identifiers; independent replay/ledger checks are still required: https://docs.stripe.com/api/errors and https://docs.stripe.com/api/events . No Reddit code or dependency was imported.

## Verified defect reproduced from main

`evaluateCanaryActivation` previously accepted 20 identical `delivered` samples (even with duplicate event identities), 20 samples whose `handlerDurationMs` was `null` (coerced through `Number(null) === 0`), and 20 `delivered` samples with `attemptCount: 2`, **all as green readiness**. The original script mapped `result.sample`, and claim failures or idle results returned `null` rather than a sample. A canary must not discard those observations or conflate unknown latency with zero milliseconds.

This is a local pure-function reproduction, **not** a claim that a real customer was affected or that payment duplication occurred.

## Implemented in draft source

1. `lib/sonara-event-consumer.cjs`: after a service-credential claim, check `row.organization_id === requested organizationId`, that `row.kind` belongs to the allowlisted kinds, and that `row.producer` matches the permitted producer list. On mismatch: structured `claim_scope_mismatch` error; no handler or settlement action.
2. Include `eventOutboxId` in every concrete worker sample, enabling positive proof of unique deliveries.
3. Summarize the full attempted sample array rather than silently discarding null or malformed attempts. Strictly validate queue age, duration, attempt count and event identity. Unknown latency stays **unknown**; an invalid sample never becomes a zero millisecond success.
4. Activation gate requires a fresh, unique list of expected enqueued IDs, complete valid samples, exactly-once observation of every expected delivered ID, first-attempt execution and existing latency/retry/dead-letter ceilings.
5. `scripts/run-event-consumer-canary.mjs` refuses unreadable, duplicate, or pre-existing enqueues; passes the expected fresh outbox IDs to the activation gate; does not silently drop missing samples.
6. `tests/event-consumer-readiness.test.js` adds negative cases for missing/duplicate/substituted IDs, missing and invalid metrics, attempts >1, cross-tenant/wrong-kind/wrong-producer claimed rows and script wiring; positive synthetic canary fixtures now have real unique IDs.

**No new package or schema migration. No provider access or worker activation. No production deployment. No change to mandatory owner approvals.**

## Proof levels and next checks

- Exact main-source reproduction: false-green cases reported `ok:true` before the patch.
- Updated branch source: isolated JS execution of synthetic scenario probes shows invalid canary evidence denied and cross-scope claim rejected before handler/settlement. These are **not** the complete Mocha test suite.
- Run `pnpm exec mocha tests/event-consumer-readiness.test.js`, frozen pnpm install, lint, build, full test suite, all exact-head security and native migration replay checks on the PR's final SHA.
- With an approved isolated staging Supabase project: enqueue N unique canary events; validate the same IDs in settled rows; intentionally return a wrong tenant/kind/producer from a mocked repository; corrupt a sample; force a retry; expire a lease and replay; test with 4 concurrent workers and an executor restart; confirm no duplicate side effect, no cross-tenant handler, explicit false readiness and immutable evidence. Never use customer-visible campaigns or real billing for this canary.
- Observe provider reconciliation and task-outcome logs before announcing reliable integrations. A 100%-green synthetic sample is necessary, not sufficient, for production or economic proof.
- Main stays protected. This change is a draft, independent of PR #508 CI repair and #509 analytics improvements. Production remains offline as previously directed.

## Backlog translated from the evidence

**P0:** finish required CI/release gates, fail-closed canary proofs, real two-tenant denial matrix, Stripe customer billing reconciler with replayed webhook and provider-authoritative balances.

**P1:** make worker delivery/retry/dead-letter status visible in founder/customer operation boards; add versioned provider receipts, clear action ownership, and user-approved campaigns/publication; isolate high-cost Creator media processing.

**P2:** collect meaningful baseline task-completion rates from consented small-business pilots, then measure workflow completion, 7-/30-day retention, delivered notification accuracy, incident rate and contribution margin. Do not infer ROI from Reddit voting or feature counts.

No social scraping, unauthorized Reddit Data API integration, cold DMs, customer data import from discussions, or claims of production capability are authorized by this research.


## Third research/engineering pass — explicit handler-result contract

Source review found a second independent false-success condition: `createEventConsumerWorker` treated any handler result **except** `{ok:false}` as delivered, including `undefined`, `null`, `false`, `[]` and `{ok:"true"}`. A provider adapter may perform an external side effect and accidentally return nothing; treating that as confirmed completion destroys the durable queue's ability to surface uncertainty.

**External evidence and limits:**
- [Reddit r/n8n, 2026-08-27](https://www.reddit.com/r/n8n/comments/1vztr0i/how_do_you_make_n8n_webhooks_safe_under/): developers discuss the exact gap between reserving an idempotency key and successfully finishing a downstream action. The conversation is an engineering lead, not a reliable prevalence estimate.
- [Reddit r/SaaS, 2026-06-19](https://www.reddit.com/r/SaaS/comments/1u9ydx8/how_are_you_guys_handling_failed_webhooks_and/): a founder reports difficult-to-detect background failures. Anecdotal, potentially promotional.
- [Temporal: at-least-once execution semantics](https://docs.temporal.io/nexus/operations): a handler may execute more than once after timeouts; idempotency and durable status are needed.
- [Stripe: request idempotency](https://docs.stripe.com/api/idempotent_requests): a repeated request with a stable idempotency key can return the prior status; this is **not** a substitute for a trustworthy application-side completion receipt and provider reconciliation.

**Source change:** require a handler to return an actual non-array object with boolean `ok`. Only `{ok:true}` becomes `delivered`; explicit `{ok:false,code,...}` retains existing retry/dead-letter behavior. Anything else becomes `{ok:false,code:"handler_result_invalid",retryable:false}` and is dead-lettered for **manual reconciliation**, not automatically retried or counted as success. This is a conservative safety decision: ambiguous completion may follow an irreversible provider action. No customer-facing provider handler is activated by this patch; the current synthetic canary returns `{ok:true}` explicitly.

**Regression:** two new test cases in the existing `tests/event-consumer-readiness.test.js` cover nine invalid output shapes, explicit successful completion, and retryable provider rejection. They run in isolated JavaScript against the proposed branch, not in place of the full Node/Mocha workflow.

**Release diagnostics confirmed from actual PR run logs:**
- PR #508 `SONARA Industries CI` failed the release chain at `data/capability-inventory.json` stale, despite its native migration replay passing. It also has Firefox/WebKit browser failures (missing UI elements and unexpected 429/503 responses); investigate the test environment and route contracts rather than reducing thresholds.
- PR #509 main/test workflows include `docs/HANDOFF_PROMPT.md` test-file drift (committed 513, runner counted 516); native replay reports `P1 policy definition drift on 25 policies; abort`. Do **not** rewrite guarded policy digests just to make that database gate pass. Reconcile policy history and staging evidence.
- PR #511's exact-head CI was red before this patch even while its dedicated Event Consumer Activation Readiness job was green. A green single lane never overrides the red release matrix.

**Next stage gate:** freeze exact PR head → real Node 24 `pnpm exec mocha tests/event-consumer-readiness.test.js` → full CI and native PostgreSQL replay → single authorized test-tenant canary with fresh enqueue IDs and result receipts → controlled owner release. Never enable payments, autoposting, messaging, production workers or the temporarily offline site based on these isolated tests.


## Fourth engineering pass — repository exceptions and release-chain diagnostics

**Concrete failure reproduced on original `main`:** `createEventConsumerWorker.runOnce` awaited `repository.claimNextFiltered` and `repository.settle` directly. A rejected promise or synchronous adapter exception propagated past `runOnce`, leaving no scoped `event.consumer` failure and making scheduled canary sample accounting incomplete. A settlement exception is especially ambiguous: the backing database or external side effect may already have completed.

**Implementation on this draft branch:** three repository call sites (claim, successful delivery settlement, unsuccessful retry/dead-letter settlement) now use a single `safelyCallRepository(operation, code)` boundary. A thrown exception becomes a deterministic `{ok:false,code,row:null}` result that is consumed by existing structured failure logic, without logging the raw error text. Claims use `claim_request_failed`; settlements use `settle_request_failed`. The worker returns false rather than claiming delivery; it does not immediately re-run completed handlers.

**Tests and proof:**
- Two new test cases inject synchronous exceptions and rejected promises into claim and both settlement paths. They assert stable status, one handler execution at most, no settlement after claim failure, and no exposure of an intentionally secret-bearing exception message.
- Direct execution of 19 runnable existing and new repository test bodies against the branch source passed; one canonical runtime-capability test requires the complete Node application environment and was not run in the isolated harness.
- A separate before/after main-source probe showed `uncaught` with zero diagnostic events before the change, and `claim_failed` plus one structured diagnostic event afterward. This is executable unit evidence, **not** database staging validation, automatic recovery proof, or full GitHub CI.
- The current safety boundary cannot guarantee cancellation of an external provider action after timeout, or exactly-once completion across multiple systems. A durable idempotency receipt, action-specific reconciliation and owner review of uncertain payments or publishing remain required.

### Updated external research cross-check

- [Reddit r/Supabase 2026-08-03 migration-drift report](https://www.reddit.com/r/Supabase/comments/1vepk4y/my_production_schema_had_drifted_from_my/): an anecdotal report highlights that migration-file history and live policies/grants can diverge. Do not treat an unversioned production SQL edit as a harmless repair.
- [Reddit r/Supabase 2026-09-29 privilege-drift discussion](https://www.reddit.com/r/Supabase/comments/1wtp6cj/our_supabase_dashboard_can_silently_drift_from/): a tool author claims default schema diffs can miss effective grants. This is a vendor-adjacent claim, not an independently verified property in SONARA; validate actual role privileges using PostgreSQL catalog checks.
- [GitHub's required status check guidance](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks): required status checks must succeed for the applicable latest commit / test-merge commit. A draft PR with individual green jobs but red mandatory jobs is not release-ready.

### Concrete CI forensics from GitHub run logs (no bypasses)

**PR #508:** `SONARA Industries CI` → `Run every release gate` fails because `data/capability-inventory.json` is stale; generator requests `node scripts/generate-capability-inventory.cjs --write`. Its native migration replay passed, but browser WebKit and Firefox jobs failed with missing expected elements and/or service 429/503 responses. The correct fix is to regenerate **on the exact source checkout**, review the diff, then test the target browsers independently. Do not edit generated JSON by hand, relax release checks, or modify public routes to hide 503s.

**PR #509:** `SONARA Industries CI` and Node compatibility fail a handoff count assertion: generated `docs/HANDOFF_PROMPT.md` says 513 test files; the Mocha spec counts 516. Run `node scripts/generate-handoff-prompt.mjs` on the exact branch and review all output, including file-size limits. Its PostgreSQL replay fails `P1 policy definition drift on 25 policies; abort`. This is an intentional integrity guard; prove the canonical policy definitions with fresh database replay and inspect migration ordering before preparing any revised hash/proof or rollback. Unilaterally blessing the current definitions would defeat the gate.

**PR #511:** its earlier synthetic canary readiness workflow passed, but release matrix jobs were red; new commits restart the exact-head verification. A passing narrow job or `mergeable:true` is insufficient.

**PR #512:** its outbox response-integrity adapter was updated independently; the generated test-file count was preserved by integrating new regression cases into the existing test file. Review against #511 prior to any integration; source patches are not automatically conflict-free just because draft branches are separate.

**Required next execution:** exact-head generated-artifact refresh and verified native migrations in the CI-fix branch → browser contract triage → full Node/Mocha checks on the updated worker/outbox branches → provider-free two-tenant staging tests → governance and separately approved controlled release. Preserve the owner's existing temporary production-offline instruction.


## Fifth engineering pass — uncertain timeout, lease budget, and explicitly safe retries

**Baseline reproduction, October 8 2026:** the source in this draft branch scheduled `retry` with code `handler_timeout` when a synthetic handler ran longer than its timeout but remained in flight. `Promise.race` merely stops waiting; it does not stop an underlying promise or external provider action. A second invocation could therefore execute the same side effect while the original request still ran. This is a safety-critical correctness issue for payments, Creator delivery, CRM lead creation, email and social publishing. This was a local simulated handler test, not an actual duplicate charge or customer action.

**Design from primary and practitioner sources:**
- [Temporal documentation, Activity Definition](https://github.com/temporalio/documentation/blob/main/docs/encyclopedia/activities/activity-definition.mdx): a durable Activity can be executed multiple times and partially complete on more than one attempt; record exactly-one completion is not synonymous with exactly-one side effect.
- [Stripe API idempotent requests](https://docs.stripe.com/api/idempotent_requests): a stable request key can prevent duplicate mutation within documented retention conditions, but keys may be removed after 24h and results (including first 500) may be cached. SONARA still needs its own event id and provider reconciliation.
- [Reddit r/n8n, 2026-10-02](https://www.reddit.com/r/n8n/comments/1wvh8h1/help_preventing_duplicate_leads_when_a_crmapi/): the author asks how to handle a CRM create request that may have succeeded before timing out. A question is not prevalence evidence.
- [Reddit r/aiagents, 2026-09-08](https://www.reddit.com/r/aiagents/comments/1wb131p/for_people_running_ai_agents_in_production_what/): practitioners discuss tool/API calls with unknown post-timeout side-effect state. It is not production evidence for SONARA.
- [Reddit r/n8n, 2026-04-21](https://www.reddit.com/r/n8n/comments/1srgrst/the_n8n_skill_that_actually_matters_has_nothing/): explicitly distinguishes transient failure, invalid payload, and repeated triggers as needing different retry behavior. Anecdotal advice; independently verified against code contracts.

**Implementation in `lib/sonara-event-consumer.cjs`:**
1. Add `LEASE_SETTLEMENT_RESERVE_MS = 10000` and reject configured `handlerTimeoutMs` unless a positive safe integer strictly below the fixed five-minute claim lease less the reserve. This reduces accidental overlapping stale-lease reclamation; it cannot prevent an external handler continuing after timeout, nor compensate for paused processes or a stalled settlement request.
2. On `handler_timeout`, mark the handler outcome `retryable:false`, settle `dead_lettered`, preserve a structured reason and attempt evidence, and require a human or authorized reconciliation process to check provider state before any replay. Never schedule automatic replay for this uncertainty.
3. Remove optimistic default `retryable !== false`. For thrown exceptions and returned `{ok:false}` outcomes, retry only with **explicit** `retryable:true`; unclassified failures are dead-lettered. An approved adapter must explicitly distinguish known-safe transient faults from unknown post-side-effect faults. Owner approval remains mandatory for sensitive acts.
4. Preserve the existing bounded exponential backoff and five-attempt ceiling for explicitly retryable failures. No changes to database migration history, dependencies, RLS, provider keys, payment actions, website status or deployment.

**Tests in the existing `tests/event-consumer-readiness.test.js`:**
- Prove a slow handler is still running when its timeout fires, but the settlement is `dead_lettered` with no `nextAvailableAt`; then prove the original handler eventually completes independently. No cancellation or provider rollback claim.
- Test positive 30s configuration and deny invalid, non-integer and claim-lease-overlapping timeout settings.
- Verify unclassified returned failures and thrown exceptions do **not** retry, while explicit `retryable:true` failures do retry through both code paths.
- At the final tested branch commit, 23 of 23 runnable repository test bodies passed in an isolated in-memory adapter harness, with one full-runtime capability-gate test skipped. This is not a Node/Mocha full run, PostgreSQL replay, or a production verification.

**Release and follow-on:** first obtain green exact-head CI and PostgreSQL policy audit. The next separately approved development wave should implement a provider-specific reconciliation contract (`eventId`, stable operation key, provider receipt reference, result state `verified|unknown|rejected`) and operator review queue, with independent idempotency checks at each consequential side effect. Never claim autonomous exact-once side effects solely from message-queue settlement.
