# SONARA System Design Intelligence Integration

Date: 2026-07-26  
Source: `liquidslr/system-design-notes`  
Pinned upstream commit: `aa7ac69e206bca659020baa5954bb65cfd70ab99`

## Decision

The repository is integrated as a **reference-only architecture topic index**. It is not installed, cloned into the production bundle, executed, mirrored, or used as a runtime dependency.

The upstream repository contains educational notes and diagrams derived from *System Design Interview - An Insider's Guide*, Volumes 1 and 2. No upstream license file was detected during review. SONARA therefore does not copy chapter text, images, diagrams, screenshots, or book-derived assets.

SONARA uses only:

- public repository identity and provenance;
- the public list of 28 system-design topic names;
- original SONARA-written module mappings;
- original SONARA architecture questions;
- original SONARA security, tenant, cost, failure, and activation gates.

## Implemented components

### Reference catalog

`data/system-design-reference-catalog.cjs`

- records source provenance and the no-license boundary;
- pins the reviewed upstream commit;
- maps all 28 topics into SONARA domains and modules;
- distinguishes active, future, and blocked reference topics;
- includes original review questions and guardrails;
- explicitly records that copied upstream content is false.

### Architecture review engine

`lib/sonara-system-design-engine.cjs`

The engine is deterministic and local. It accepts:

- module key;
- product;
- summary;
- capabilities;
- risks;
- constraints;
- scale tier.

It returns:

- matched architecture patterns;
- SONARA module mappings;
- architecture questions;
- required security and operational gates;
- implementation sequence;
- blocked regulated-finance patterns;
- deterministic review fingerprint;
- provenance and rights boundary.

It does not call external services, clone repositories, run shell commands, deploy code, modify databases, send messages, charge money, or make autonomous implementation decisions.

### Admin routes

- `GET /admin/system-design-intelligence`
- `GET /api/admin/system-design-intelligence`
- `POST /api/admin/system-design-intelligence/review`

All routes require founder/admin authentication. Review events are written to the existing admin audit system without logging full sensitive architecture input.

### Ecosystem integration

The architecture engine is registered in:

- the SONARA ecosystem manifest;
- the admin control-plane route list;
- the external repository research queue;
- the route registry;
- the OpenAPI contract;
- the runtime transformation pipeline;
- automated tests.

## Topic-to-SONARA mapping

| Upstream topic | SONARA application |
|---|---|
| Scaling | Vercel, Supabase, worker capacity, stateless runtime, caching and deployment planning |
| Back-of-the-envelope estimation | performance, cost, storage, throughput and provider planning |
| System design framework | module architecture review and launch gates |
| Rate limiter | public API, login, webhook, upload, email and research abuse protection |
| Consistent hashing | future worker routing and partition ownership |
| Key-value store | feature flags, session metadata, readiness cache and configuration boundaries |
| Unique ID generator | UUIDs, idempotency, webhook events, jobs and audit evidence |
| URL shortener | future consent-safe campaign and release links |
| Web crawler | governed public-source market and research intake |
| Notification system | Resend, alerts, customer notifications and job completion |
| News feed | workspace activity and creator/growth updates |
| Chat system | future support, team and customer conversations |
| Search autocomplete | command navigation, catalog and tenant-scoped search |
| Video platform | Creator Studio upload, transcoding, thumbnails and delivery |
| File sync | Files & Records, Creator assets, exports and versioning |
| Proximity service | future Business Builder local discovery and service areas |
| Nearby presence | blocked by default; consent and privacy review required |
| Maps | future routes, dispatch and mobile operations |
| Distributed queue | media jobs, email dispatch, provider jobs, webhooks and exports |
| Monitoring and alerting | Admin Command Center, readiness and provider health |
| Event aggregation | Growth Studio attribution and consent-safe analytics |
| Reservation system | Business Builder bookings, appointments and capacity holds |
| Distributed email | Resend dispatch, suppression, bounces and reconciliation |
| Object storage | Supabase Storage buckets, signed access, lifecycle and quotas |
| Leaderboard | future optional, non-exploitative progress or community views |
| Payment system | Stripe Checkout, webhooks, entitlements, refunds and reconciliation |
| Digital wallet | blocked; SONARA does not hold funds or claim banking functionality |
| Stock exchange | blocked; no brokerage, trading, custody or securities functionality |

## Mandatory implementation rules

Every architecture review remains `review_required`. A recommendation can become code only when a separate scoped change includes:

1. owner/admin approval;
2. functional and non-functional requirements;
3. organization, role and tenant boundaries;
4. data ownership and retention;
5. API and idempotency contract;
6. failure and degraded-state behavior;
7. monitoring and audit evidence;
8. capacity and provider-cost assumptions;
9. security and abuse review;
10. automated tests;
11. rollback instructions;
12. reviewed pull request.

## Explicit exclusions

This integration does not introduce:

- a new database engine;
- a new message-queue provider;
- a new caching provider;
- an autonomous infrastructure agent;
- wallet, banking, trading or custody functionality;
- copied upstream code or assets;
- customer-facing system-design claims;
- unreviewed architecture changes.

## Verification

Automated tests verify:

- exactly 28 unique mapped topics;
- pinned source provenance;
- no-license/reference-only boundary;
- no runtime fetch, clone or shell execution;
- Business Builder booking/payment mapping;
- Creator Studio video/queue/storage mapping;
- blocked wallet and stock-exchange behavior;
- deterministic review fingerprints;
- ecosystem, route and OpenAPI registration;
- founder/admin authentication enforcement.
