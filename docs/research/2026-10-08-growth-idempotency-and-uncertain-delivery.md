# SONARA Industries — Cross-Suite Provider Retry and Receipt Engineering

**Date:** October 8, 2026  
**Candidate:** `fix/growth-dispatch-ambiguous-delivery-20261008`  
**Mode:** Draft-source change, not a deployment or an enabled customer campaign.

## What is newly confirmed

1. In `lib/growth-studio-dispatch.cjs`, a Resend batch with HTTP failure, malformed body, or partial response was automatically replayed *as new individual requests*. Its original source expressly acknowledged the possibility of duplicate email. In an unreliable network, a lost response is not proof that the provider performed no action.
2. Both `POST /emails` and `POST /emails/batch` officially support `Idempotency-Key`. Resend documents a **24-hour retention window**, same-key/same-body semantics, and that `409` can mean either concurrent in-flight requests or conflicting payloads:
   - https://resend.com/changelog/idempotency-keys/
   - https://resend.com/changelog/batch-idempotency-keys/
   - https://www.resend.com/blog/engineering-idempotency-keys
3. The Reddit r/n8n thread on webhook duplicates and retries is a useful user-reported failure pattern, but it does not validate live SONARA behavior:
   - https://www.reddit.com/r/n8n/comments/1wv0a5v/n8n_webhook_checklist_duplicates_retries_and/
4. The Microsoft saga and retry-pattern guidance independently distinguishes guaranteed-idempotent operations from uncertain external side effects, and requires manual intervention for irreversible/unreconcilable steps:
   - https://learn.microsoft.com/en-us/azure/architecture/patterns/saga
   - https://learn.microsoft.com/en-us/azure/architecture/patterns/retry

## Source-level engineering fix

- Derive a **stable, tenant/campaign/send-attempt/request-body-scoped SHA-256 request key**, never the raw email address or secret. Attach it to both Resend individual and batch POST requests. This is a *provider* retry guard, not a perpetual durable dedupe proof.
- Require complete batch response cardinality **and** nonempty recipient-level provider IDs to claim success. Anything less is `delivery_unconfirmed`.
- Eliminate batch-to-individual fallback when the batch may already have been accepted. Mark each affected recipient `uncertain`, preserve the HTTP status, record `reason: provider_outcome_unknown`, and **stop sending subsequent batches** in that invocation. Not-yet-attempted recipients stay separate from uncertain recipients.
- When a one-recipient request has no trustworthy response, record `uncertain`; explicit definitive HTTP 4xx rejections (excluding 408/409/425/429) remain `failed`.
- Keep charging only for confirmed accepted sends, and never manufacture a paid delivery count from unknown provider activity. Provider charges arising from unknown responses require reconciliation.
- Reuse existing `growth_campaign_sends.status='failed'` for the **storage envelope only** with `reason='provider_outcome_unknown'`, thereby avoiding a new migration in the currently red replay chain; customer-facing and execution telemetry use a **separate `uncertain` list**. The storage envelope is not a semantic statement that the send definitely failed.
- Update `createSendRecordReader` to select `reason`. `remainderFrom` refuses to derive a safe remainder from any recorded unknown delivery. This also prevents the API/UI's existing “send only remaining” action from silently mailing an uncertain recipient again.
- Return `uncertain` to the Growth campaign API, count `unconfirmed` in audit events, and preserve existing consent, unsubscribe, owner-approval, limits and tenant-scoped read constraints.

## Reproduced safety probes and tests

- Isolated source-level harness: **5 of 5 targeted scenarios passed** with injected Resend and storage adapters:
  1. Short batch response caused one request, zero automatic replays, three uncertain recipients and durable reason rows.
  2. Remainder selector refused the same rows.
  3. A 503 from the first of multiple batches prevented the later batch, preserving not-attempted records.
  4. Definitive 422 single-recipient rejection remained a known failure.
  5. Provider keys were repeatable for the same operation and different for another approved attempt.
- Added tests to *existing* `tests/a-campaign-sends-only-to-who-was-authorised.test.js` and `tests/a-remainder-send-refuses-what-it-cannot-know.test.js`, keeping the Mocha test file count stable. At the latest verified commit, **9 of 9 focused source-backed regression bodies passed in an isolated JavaScript harness**, and the pure remainder selector refused recorded provider uncertainty. This is not full Node/Mocha, CI, provider, or database staging verification.
- All HTTP/provider actions in these tests are mocked. No live email sent or billed.

## Cross-suite application contract: review before applying each adapter

| Product | Actual existing integration point | Required common behavior | Current outcome of this patch |
| --- | --- | --- | --- |
| Business Builder™ | `routes/sonara-merchant-payment-routes.cjs`, `lib/sonara-connected-checkout.cjs` | Stable payment keys, provider-owned seller charge, webhook signature, authoritative receipt, owner-gated refunds | Audited source; unchanged, not re-certified here |
| Creator Studio™ | `routes/sonara-marketplace-checkout-routes.cjs`, media generation workers | Verify licensed delivery and provider jobs; never treat missing receipt or timeout as completion | Audited source; unchanged, not re-certified here |
| Growth Studio™ | `lib/growth-studio-dispatch.cjs`, `lib/growth-studio-send-records.cjs`, `routes/growth-studio-control-routes.cjs` | No blind send retries; confirmed/failed/unknown distinct; audited owner reconciliation | **Implemented in this branch** |
| SONARA One | `lib/sonara-event-consumer.cjs`, `lib/sonara-event-outbox.cjs` | Tenant scope, idempotency, bounded retries, explicit status receipts and manual escalation | Separate unmerged draft PRs #511/#512; not integrated or shipped |

No universal autonomous retry rule can safely be applied to payments, emails, refunds, destructive actions, licensed delivery, publishing or customer communications. Each operation's authority, side-effect visibility and provider reconciliation API must be verified before promotion.

## Remaining P0 release and product work

1. Execute exact-head `pnpm exec mocha tests/a-campaign-sends-only-to-who-was-authorised.test.js tests/a-remainder-send-refuses-what-it-cannot-know.test.js` plus all mandatory Node 24/26, browser, native Postgres, and security checks.
2. Resolve draft PR #508 generated inventory and browser failures and the 25-policy migration replay drift across other branches; do **not** bless any drift by weakening assertions or rewriting policy hashes blindly.
3. Qualify a **durable provider reconciliation pathway**: event ID, tenant, send-attempt ID, request hash, verified provider message IDs, bounded retention, user-approved manual replay and auditable closure. The existing reason field is an interim safety fence, not a full ticketing workflow. Preserve unknown entries until verified.
4. Test the receipt reader and the “send to remainder” owner UI end-to-end against staging PostgREST and isolated Resend mocks. Confirm no second email and no additional usage charge on an unknown response.
5. Do not merge or deploy this candidate until exact-head gates succeed, tenant security and payment source checks pass, and the owner authorizes a controlled rollout. The production website remains offline as directed.

## Additional review: response integrity and adapter exceptions

- Validation was tightened again after the first implementation: an apparently complete batch response containing **repeated provider message IDs** cannot establish that distinct recipients were individually accepted. Such an answer is now `delivery_unconfirmed`, rather than a false success.
- Both synchronous throws and rejected promises from the injected provider adapter are contained and classified as unknown completion, with no raw provider error or credential string in the response.
- Existing production code for Business Builder and Creator checkout already uses a provider operation key and signed webhook decisions, but these code paths were not changed or proven by this Growth-specific fix. The intended common architecture is not equal to end-to-end integration or launch evidence.
- Provider idempotency hash depends on the exact serialized email request and approved attempt; current unsubscribe tokens are deterministic over organization and recipient rather than a timestamp, a prerequisite for stable retry keys. Any future signed-email format adding per-send timestamps must have its idempotency contract retested.

## Sixth engineering iteration: real individual receipts and legacy test migration

The previously hardened batch contract still had a separate single-send false-positive path. The `sendOne` implementation interpreted `response.ok` as an accepted email without parsing `SendEmailResponse.id`; it inserted `provider_message_id:null`, and could charge for a send whose receipt was unparseable. Resend's published OpenAPI defines an object with an `id` for an individual successful email. The source now requires a nonblank provider id for **both** individual and batched sends.

A single HTTP 2xx with missing/unreadable `id` becomes `provider_outcome_unknown`, with zero verified accepted, no billable usage debit and no automatic replay. Synchronous provider/JSON parser exceptions are contained without leaking raw error details. Later messages remain not attempted after an unconfirmed earlier result.

**Repository test-contract migration:** some older tests had been written before batching and sent 24 recipients through a mock that expected one `payload.to`; those tests could pass only through the now-forbidden batch fallback. The route fixtures have been rewritten to return a documented index-aligned batch receipt. Their charge-check cases now use 20 verified accepted recipients and four refused for missing consent/unsubscribe authority, rather than fabricating a partial batch success response. The route-level test for 301 recipients now demands exactly one ambiguous batch, 100 unconfirmed, 201 not attempted, zero single-send replays and a non-success HTTP outcome. The route lifetime test now asserts `MAX_FALLBACK_BATCHES === 0` rather than demanding that unsafe fallback exist.

**Verification:** sixteen targeted exact-source test bodies, including updated legacy cases and new adversarial receipt tests, passed in an isolated JavaScript harness with injected authorization, billing and crypto mocks. Seven changed JavaScript files were parsed successfully. This does not establish end-to-end Express/Supertest success, real pnpm/Node/Mocha, hosted CI, live provider outcomes or actual RLS behavior; those gates remain outstanding. The existing send table is append-only, so a separate adjudication record or owner-controlled provider reconciliation feature is mandatory to eventually clear unknown outcomes safely. Never hand-edit past applied migration files just to make this proposal pass.
