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
