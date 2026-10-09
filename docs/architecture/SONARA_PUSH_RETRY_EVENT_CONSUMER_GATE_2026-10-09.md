# SONARA — push delivery retry bridge and activation gate (2026-10-09)

Status: source-reviewed proposal. **No live consumer activation, production migration, or proof of push delivery.**

## Reuse instead of rebuilding

Existing application sources:
- `lib/sonara-event-outbox.cjs`: organization-scoped durable event claims and settlement
- `lib/sonara-event-consumer.cjs`: disabled-by-default canary, unique claim owners, timeout, finite retries, dead-letter settlement and structured operational metrics
- `lib/sonara-pgmq-transport.cjs`: restricted single-organization transport for separately approved PGMQ canaries
- `lib/sonara-web-push.cjs`: Web Push encryption and provider outcomes
- PR #567: `lib/sonara-delivery-retry-policy.cjs` and parsed `Retry-After` metadata
- PR #561: customer-controlled subscription revocation/tenant ownership hardening
- PR #562: customer-approved PWA update activation

This branch is stacked **on PR #567**. It does not extend event-kind enums, start a worker, add a new queue/table, or activate a schedule. Do not merge it before its base PR or include it in the production release while exact-head CI is not green.

## Implemented in the source slice

The existing generic consumer now accepts an *optional*, internal handler outcome of the form:

```js
{
  ok: false,
  code: "retry_later",
  retryable: true,
  retryAfterSeconds: 120,
  retryAfterStatus: "ok",
  expiresAtMs: Date.parse("2026-10-09T14:00:00Z")
}
```

It delegates such metadata to `nextRetry`. Outcomes are:
- Retry at/after the provider's requested time if the message remains useful.
- Dead-letter without retrying if the message would expire before that time.
- Dead-letter for operator review on an excessive hold or malformed delay.
- Preserve the old 5/10/20/40-second deterministic fallback when the handler supplies **no** provider metadata, so existing synthetic canary expectations remain unchanged.
- Never execute a handler if the row's `organization_id`, `kind`, or `producer` differs from the authorized claim request; report `claim_scope_mismatch`, leaving the row claimed until its lease expires.
- Persist only bounded error codes, scheduling dates and numerical telemetry; do not persist the raw provider body, VAPID credentials or notification content.

## Required work before real customer reminders

1. **Current three draft PRs:** inspect #561/#562/#567 exact-head CI, ownership/CSRF/cross-account revocation, PWA update behavior and flaky tests. This PR is not a replacement for those gates.
2. **Transaction authority:** enqueue a reminder in the **same database transaction** as its originating booking/task/invoice state update. A separate HTTP write followed by an enqueue is not transactional. The outbox cannot prove a preceding business write succeeded unless it participates atomically.
3. **Consent and recipient scoping:** resolve recipient user and organization from server-owned membership; honor topic, channel and quiet-hour choices. Web Push opt-in must be a user gesture and opt-out must remain accessible.
4. **Per-endpoint delivery records:** use `organization + event_id + subscriber_id + channel` for an idempotency key; record `pending/accepted/failed/expired/cancelled` and the last attempted time. Do not retry a successful recipient because another recipient failed. Provider HTTP acceptance is not a confirmed human view. As browser push has no guaranteed application-level exactly-once receipt, duplicates remain possible after process crash; keep tags/grouping user-friendly and do not claim exactly once.
5. **Durable delivery:** use the existing event outbox (or approved PGMQ path after migration/permissions review). Every worker must re-read current consent **immediately before sending**, and must verify that event TTL is still valid. Release a lease only through the existing tenant and claim-token guarded settle procedure.
6. **Canary tests:** one approved tenant; forbidden-tenant and wrong-kind claims, concurrent consumers, provider 429 + `Retry-After`, 410 cleanup, transient 5xx, expired payloads, lost-claim replay, offline device, opt-out before send, and failure between provider acceptance and settlement.
7. **Operational SLOs:** record actual queue age, claim delay, acceptance rate, duplicate suppression, p95 handler duration, retry volume and dead-letter ratio. No latency number is a verified production claim until measured under representative devices, geography, database capacity and load.

## Update, restart, retention and realtime boundaries

- Updates: stage and test versioned PWA assets; never force-reload unsaved forms. Server restart and rollback must be authorized release actions, not a notification failure side effect.
- Retention: distinct policies for provider endpoint tokens, transient delivery attempts, billing evidence, consent receipts and legally held support cases. No automatic deletion migration without a reviewed retention schedule.
- Realtime rooms/lobbies: prefer short-lived authenticated room membership, bounded message queues, tenant-aware reconnection replay and server-observed latency. A specialized Durable Object coordinator is a **separate hosting/cost/authorization decision**, not necessary for these notifications. Cloudflare's hibernation API can preserve connections during idle sleep but does not remove network latency.

## Research and verification

- Supabase Queues: https://supabase.com/docs/guides/queues ; https://supabase.com/docs/guides/queues/pgmq
- Supabase Cron and Vault for scheduled functions: https://supabase.com/docs/guides/functions/schedule-functions
- MDN Web Push best practices: https://developer.mozilla.org/en-US/docs/Web/API/Push_API/Best_Practices
- MDN Push API CSRF warning: https://developer.mozilla.org/en-US/docs/Web/API/Push_API
- Cloudflare WebSocket hibernation: https://developers.cloudflare.com/durable-objects/best-practices/websockets/

Test on the branch after #567 using Node 24 / pnpm 12.7:

```sh
pnpm install --frozen-lockfile
pnpm exec mocha tests/event-consumer-provider-retry-integration.test.js tests/event-consumer-readiness.test.js tests/a-push-retry-obeys-provider-and-expiration.test.js
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
pnpm run verify:gates
```

No live tenant, provider, performance or CI proof is implied by source or simulation results.
