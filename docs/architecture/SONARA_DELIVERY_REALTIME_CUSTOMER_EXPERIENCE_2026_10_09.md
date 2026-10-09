# SONARA Delivery, Updates, Realtime, and Customer Experience — Engineering Decision Record
Date: 2026-10-09
Status: **architecture and implementation sequence; not production-proven**.
Applies to SONARA Industries / SONARA One, Business Builder™, Creator Studio™, and Growth Studio™.

## 1. Reuse the deployed source of truth — do not clone subsystems

Existing source: `routes/sonara-notification-routes.cjs`, `lib/sonara-push-subscriptions.cjs`, `lib/sonara-web-push.cjs`, `public/sonara-push.js`, `public/sw.js`, `lib/sonara-recurring-task-*.cjs` (verify actual paths), `lib/sonara-rate-limit.cjs`, `lib/sonara-tenant-guard.cjs`, and SONARA's durable-worker/observability work. Verify exact branch and tests; any named architecture surface is not by itself a live service.

This wave implements the bounded **browser opt-out and tenant-scoped deletion** described below on a review branch. It does **not** create a new database, activate provider push delivery, deploy a realtime lobby server, or claim zero latency.

## 2. Unified event and reminder pipeline — next implementation slice

Business event (booking, invoice, order, approval) -> authoritative tenant-scoped record and **transactional outbox** -> durable dispatcher -> customer consent/preference decision -> channel adapter (in-app, Web Push, optional approved email) -> delivery attempt/receipt or failure evidence. Route all three child products through shared metadata but enforce their own entitlements and organization scope.

**Proposed canonical fields** for reuse or migration review, not a claim that the columns exist: `event_id`, `organization_id`, `actor_id`, `event_type`, `entity_type`, `entity_id`, `occurred_at`, `idempotency_key`, `correlation_id`, `payload_version`, `consent_snapshot`, `deliver_after`, `expires_at`, `attempt_count`, `lease_owner`, `lease_expires_at`, `last_error_class`, `delivery_state`, `delivered_at`, and `retention_policy_id`. Never store a raw provider secret or more customer personal data than necessary in a notification message.

- **Reminder scheduler:** calculate local wall-clock due times from an IANA time zone, explicitly handling daylight-saving gaps/overlaps. Persist resolved UTC instants, deduplicate by `organization_id + entity_id + event_type + scheduled_slot`, and never claim that cron's single invocation guarantees one send.
- **Delivery semantics:** at-least-once execution, idempotent channel send where provider supports it, bounded retries, exponential backoff with jitter, `Retry-After` priority, poison-message dead-letter, and no silent drop. PGMQ visibility timeout is a *lease*, not a promise of end-to-end exactly-once side effects.
- **Policy:** marketing and nonessential engagement are opt-in and quiet-hours-aware, with per-channel and per-topic switches. Urgent account/security notices need a separate governed classification, not a back door around consent. No mass campaign, payout, security setting, or destructive write is autonomous without owner authorization.
- **Operator evidence:** counts of due, delayed, attempted, accepted, expired, opted-out, retried, dead-lettered, and actually read when a supported channel supplies a receipt. Web Push success is provider acceptance, not proof that a user saw it.

## 3. Automatic updates, reset/restart and rollback policy

Web/PWA: publish hashed or versioned static assets with immutable caching; network-first for public documents, **no shared service-worker caching of private authenticated responses**. Detect updates, show an accessible non-modal action, preserve unsaved forms, and reload only when the user accepts or the next navigation is safe. The current public service-worker code already performs registration/update checks and displays a message; customer-proof of seamless upgrades is **not established**. Audit `skipWaiting` against unsaved-form workflows before making it automatic.

Servers/workers: no request-path process restart to fix latency. Use health probes, readiness drains, finite worker leases, deployment canaries, bounded automatic restart after *verified transient* faults, circuit breaker for provider outages, backoff, and rollback to last-known-good commit. Never trigger an unreviewed production redeploy, migration reversal, credential change or data reset. Separate **session reconnection** from **data deletion**: an account-level Reset button must never implicitly delete customer records.

## 4. Proposed realtime coordination/lobby capability

Use this when live collaboration, hosted calls, Creator review rooms or multiplayer-style waiting rooms actually demand it. **No latency** is impossible: networks, queueing, retransmissions and users' devices impose delay. Set budgets and measure them instead.

Architecture: region-aware ingress -> authenticated room join token (short TTL, tenant/role claim) -> room coordinator (one ordered state authority per room) -> WebSocket fanout with message sequence/ack and capped outbound buffers -> durable tenant-scoped reconciliation through existing database. Ephemeral room presence must expire independently of durable customer records.

Room lifecycle: `created -> accepting -> active -> draining -> closed` with explicit expiry. On reconnect: verify membership, supply last-acknowledged sequence, replay bounded recent events or send authoritative state snapshot; never trust a client-supplied room ID alone to authorize access. Rate-limit joins, chat sends and reconnect floods per identity **and** room. Detect slow consumers and disconnect/re-snapshot instead of allowing an unbounded queue to exhaust memory.

Tradeoffs: start with existing Supabase Realtime only where its tenant authorization and load tests are proven; evaluate a specialized strongly consistent room coordinator (e.g. Cloudflare Durable Objects) only if tests demonstrate a workload needing it. WebRTC/SFU is a separate media-provider decision; WebSocket rooms do not by themselves deliver low-latency video/audio. Do not route billing or inventory canonical writes through an ephemeral lobby.

### Proposed service objectives (not observed results)

| Surface | Design target | Evidence required before claim |
| --- | --- | --- |
| Interactive authenticated API | p95 <= 300 ms, p99 <= 750 ms, measured at app edge under representative load | k6 load test across warm/cold starts with tenant filters and database metrics |
| Room event server-to-connected-client | p95 <= 150 ms within a selected region under a documented load profile | two-client timestamp tests with correlated tracing and network shaping |
| Reconnect/resume | p95 <= 3 s after recoverable network interruption | forced disconnect, duplicate publish, stale token, mobile sleep and retry-storm tests |
| Web Push | no delivery-latency guarantee; accepted/error/expired outcomes observed | actual consented devices across Chrome, Android and installed iOS web app |
| Reminders | scheduled due slot processed within 60 s at ordinary load (initial target) | clock-skew, DST, failover, high-backlog and lease-expiry simulation |
| Availability | proposed 99.9% monthly SLO after an operational baseline exists | uptime monitoring, error budgets, restore exercise, provider-dependency inventory |

These budgets must be recalibrated by region, device class, plan and real customer traffic. There is no evidence here that they have been met.

## 5. Retention / customer service engine

Use a *policy registry*, not a hard-coded global deletion timer. Record owner, data class, legal/contractual hold, purpose, start trigger, approved duration, archive/deletion action and proof of completion. Partition ephemeral lobby states (minutes), notification delivery attempts (days/weeks), support tickets (approved support lifecycle), billing records (legal retention), and user assets (customer contract) instead of assigning one global retention number. Only owners may approve destructive policy changes; report which tenant/policy/records would be affected before execution. Avoid user-facing claims that private data has been deleted until deletion and backup handling can be verified.

Proposed customer service module: support case with correlation ID, channel consent, assigned owner, SLA clock, related event IDs, status, last customer-visible update and an accessible escalation path. Add customer self-serve status pages for booking/payment/delivery with explicit retry and apology only when the associated operation failed. Never fabricate a resolved ticket from an automated acknowledgment.

## 6. Safety, adversarial validation and release sequence

1. **P0, this branch:** browser permission-consented unsubscribe UI + service-role deletion restricted to organization and the subscription's creating user. Automated delivery cleanup remains organization-scoped. Run `pnpm exec mocha tests/a-push-optout-is-tenant-scoped.test.js tests/a-browser-that-agreed-can-be-reached.test.js tests/a-person-can-turn-notifications-on.test.js`, then `pnpm test`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run build`, `pnpm run verify:gates` under project Node/pnpm versions. Review browser CSRF and cross-tenant subscription upsert separately; a review branch is not shipping proof.
2. **P0:** production gate repair first: exact-head CI, staging smoke, true production schema/migration/RLS reconciliation and approved rollback. Do **not** auto-release while these gates fail.
3. **P1:** integrate existing recurrence/event sources with transactional outbox; model due time and consent; test crash between side effect and ack, simultaneous workers, duplicate webhook, 410 gone versus 429 retry, no-opt-in and unsubscribed-device behavior.
4. **P1:** update coordinator with customer-controlled reload, unsaved-state guard, accessible screen reader notice, old/new asset compatibility test and rollback.
5. **P1:** one authenticated realtime room behind a flag, bounded participant capacity and backpressure. Test cross-tenant joins, flood protection and reconnect snapshots before extending to live collaboration.
6. **P2:** retention approvals + audited deletion receipts, support SLA summaries, customer satisfaction feedback with opt-in, load/chaos/cost benchmarks and mobile-device validation.

**Source reference patterns (not dependencies):** MDN Web Push opt-in https://developer.mozilla.org/en-US/docs/Web/API/Push_API/Best_Practices ; PGMQ lease semantics https://pgmq.github.io/pgmq/ ; OWASP CSRF https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html ; WebSockets room coordinator https://developers.cloudflare.com/use-cases/web-apps/real-time/ ; Service Worker lifecycle https://web.dev/learn/pwa/update .

**Release rule:** code written != tests passed != merged != deployed != provider verified != customer proven.
