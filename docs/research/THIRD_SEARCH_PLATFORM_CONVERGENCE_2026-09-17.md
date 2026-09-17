# Third Search: SONARA Platform Convergence

**Read and implemented:** 2026-09-17

Review by: 2026-10-17

**Scope:** representative US, European, Chinese, industrial, creator/media, open-source, standards, academic/PDF, and current SONARA-source evidence
**Decision:** strengthen the shared operating layer, durable event delivery, private creator/customer collaboration, observability, and reusable industry composition. Do not add another framework, disconnected studio, public social network, biometric store, Wi-Fi credential feature, or custom global media network.

## Outcome

The third search is integrated with the previous repository, source-evidence, market-expansion, and industry/formula research through `lib/sonara-third-search-convergence.cjs`.

The current source inventories are read dynamically rather than copied into this document:

- 237 governed open-source repository records;
- 27 market-expansion capabilities, 7 industry packs, and 6 possible standalone SKUs;
- 13 reuse-first schema contracts;
- 18 industry systems, 38 deterministic formulas, 17 algorithm strategies, and 27 open-source expansion candidates;
- 11 shared agent strategies and 10 business-AI skills;
- 14 source-evidence records, including 4 uploaded PDFs.

Those numbers are inventory, not claims that every record is installed, production-ready, or commercially safe. The machine-readable endpoint recalculates them from the canonical registries.

## Why this is a convergence, not a giant ranking

“Top” can mean market capitalization, revenue, growth, product quality, installed base, customer retention, or technical influence. The S&P 500 is a market index, not a software-architecture taxonomy. A single list of “top companies in the world” would therefore mix unlike evidence and invite unsupported guesses about internal stacks.

This review instead uses representative archetypes. Named companies are examples, not a complete ranking, and cross-company patterns are explicitly labeled as inferences. Public pages and annual reports can support product and strategy observations; they generally cannot prove an internal framework, database, model, or design process.

## Representative market synthesis

| Archetype | Representative companies | Evidence-backed pattern | SONARA decision |
|---|---|---|---|
| US platform suites | Microsoft, Salesforce, ServiceNow, Adobe, Intuit, Amazon/AWS | Connected identity, productivity, storage, communication, creation, commerce, security, and AI reduce switching friction. Microsoft’s current business suite visibly joins those surfaces. | Keep one organization, customer record, permission model, workflow layer, and evidence trail across all studios. Package outcomes; do not duplicate foundations. |
| European enterprise and industrial depth | SAP, Siemens, ASML, Dassault Systèmes, Schneider Electric, Spotify | Durable business/engineering records, interoperability, vertical expertise, and partner ecosystems create defensibility. SAP describes build/integrate/manage/run capabilities; Siemens describes combining software, hardware, services, AI, and vertical digital threads. | Build shared primitives once, then configure restaurant, field-service, creator, agency, and professional-service industry packs. |
| Chinese mobile and commerce ecosystems | Alibaba, Tencent, Huawei, BYD, Xiaomi, ByteDance | Discovery, communication, transactions, embedded applications, content, devices, and rapid customer feedback reinforce one another. | Use mobile-first capture, profiles, private spaces, commerce links, calls, and notifications. Preserve consent, tenant, provider, and moderation boundaries. |
| Industrial installed-base businesses | Siemens, Caterpillar, Deere, Honeywell, Eaton, Emerson | Reliability, operational workflows, service, training, monitoring, financing/partners, and continuous improvement are stronger moats than a feature checklist. | Sell repeatable operating systems, templates, evidence, training, and support. Integrate hardware and regulated rails rather than claiming to manufacture them. |
| Creator and interactive media platforms | YouTube, Twitch, Spotify, Discord, Zoom, Adobe | Creation, reusable media, live interaction, community, distribution, measurement, and monetization form a reinforcing loop. | Compose existing Creator/Growth records into private client/community spaces and review rooms first. Public ranking feeds and federation remain deferred. |

These are strategy inferences from the official sources below and current product evidence, not statements that every representative company uses the same implementation.

## What SONARA already has

The repository already contains the foundations behind much of the request:

- shared organization identity, tenant isolation, roles, entitlements, billing, storage, audit, and owner approval;
- Business Builder™, Creator Studio™, Growth Studio™, and SONARA One rather than one code silo per business genre;
- creator profiles and follows, media assets/releases, browser call sessions/signals, notifications, commerce, content queues, campaigns, and customer records;
- agent authority, action approvals, provider boundaries, workflow runs, and structured activity logs;
- open-source governance, source/PDF evidence, model profiles, formulas, industry packs, and release gates;
- PWA/offline shell, field/location records, inventory, manufacturing/quality formulas, construction/property workflows, and 3D/CAD/robotics research boundaries.

The measured infrastructure gap was durability: event and model-observation contracts existed, but the core delivery/evaluation records did not.

## Implemented source foundation

### Durable events and evaluation evidence

`20260917090000_durable_event_outbox_and_ai_evaluation_store.sql` adds:

- `event_outbox`: tenant-scoped, idempotent, claimable event records;
- `event_delivery_attempts`: append-only delivery outcomes;
- `llm_observations`: sanitized provider/model cost, latency, outcome, source-reference, and evaluation metadata;
- `agent_evaluation_runs`: golden-dataset outcomes where `production_input` is permanently false;
- atomic claim and settlement functions using row locking and `SKIP LOCKED`.

The tables use row-level security, have no browser grants, and are service-role only. Database constraints reject flags that would permit raw prompts, raw responses, or secret material.

The owner queue is the first producer because it already knows the organization and actor when it records an agent run. It emits compact status, authority, correlation, and reference evidence—not copied customer records or handler error text.

### Third-search control plane

`lib/sonara-third-search-convergence.cjs` now joins the current repository, market, schema, industry/formula, skills, and source-evidence registries into:

- a dated primary-source register;
- five representative market archetypes;
- a six-step implementation sequence;
- the Creator and Growth Commons contract;
- explicit build/integrate/defer decisions;
- live inventory counts, with no hand-copied total.

It is surfaced on `/ecosystem`, `/admin/ecosystem`, `/api/ecosystem/manifest`, and `/api/ecosystem/readiness`. This control-plane record cannot install code, call a provider, publish content, start a worker, or widen an agent’s authority.

### Research-skill improvement

`.claude/skills/comparing-sonara-to-a-competitor/SKILL.md` now requires portfolio searches to use representative archetypes, primary sources, explicit inference labels, current-repository inspection, and a bounded build/integrate/research/defer sequence. It forbids guessing competitor internals from public websites.

## Creator and Growth Commons

The requested social, interactive-media, recording, streaming, calling, and creator surfaces should become a private workflow layer shared by Creator Studio™ and Growth Studio™, not a separate public social company.

Reuse first:

- `creator_artist_profiles` and `creator_follows`;
- `creator_assets`, releases, treatments, and generation artifacts;
- `call_sessions` and `call_signals`;
- `user_notifications`;
- `growth_content_queue`;
- `merchant_products`, payments, subscriptions, and entitlements.

Next bounded slice:

1. private creator/client/community spaces;
2. explicit memberships and roles;
3. rights-aware posts/media references;
4. review threads and moderated comments;
5. scheduled call/live-room records;
6. content-to-lead-to-sale attribution.

Before public discovery or federation, SONARA would need report/block controls, moderation queues and appeals, takedown/rights workflows, rate limits, anti-spam measures, retention/deletion policy, minor-safety decisions, and staffed incident operations. ActivityPub is useful now as a vocabulary and threat-model reference, not as authorization to enable federation.

## Architecture choices

| Area | Build/own | Integrate | Defer or reject |
|---|---|---|---|
| Business OS | Customer workflow, shared records, permissions, approvals, evidence, UX, industry composition | Accounting, CRM, document, and commerce adapters where customers need them | A separate database/security silo for every vertical |
| Agents/AI | Authority, tool scope, budgets, evaluation, source references, audit, fallback | Reviewed models and providers behind adapters | A new general agent framework without a measured gap |
| Media/calling | Projects, rights, review, schedules, session evidence, customer journey | Managed STUN/TURN/media, transcoding, and delivery when demand requires | A global relay/streaming network before production demand |
| Authentication | Passkeys/WebAuthn relying-party flow and account recovery policy | Device/browser authenticators | A biometric-template or voiceprint database |
| Networks | Normal application connectivity and deployment observability | Hosting/CDN/network providers | Wi-Fi credential discovery, recovery, or scanning |
| Manufacturing/CAD/robotics/3D | Workflows, bills, quality/OEE, assets, maintenance, files, approvals, integrations | Specialist CAD, device, printer, robot, IoT, and digital-twin systems | Pretending SONARA is a semiconductor, robotics, or hardware manufacturer |
| Finance/health/legal | Workflow, evidence, customer-facing coordination | Regulated payment, payroll, tax, lending, insurance, and clinical providers | Rebuilding regulated rails or autonomous high-impact decisions |
| Open source | Review, license/security evidence, thin adapters, rollback | Approved components after fit and ownership review | Bulk repository installation based on popularity |

Governing principle: **own the customer workflow, data model, permissions, evidence, and experience; integrate commodity, regulated, and capital-intensive infrastructure.**

## Website, UX, SEO, and customer strategy

The research supports the existing outcome-first UX instead of a feature warehouse:

- use one clear Nexus home with role-appropriate next actions;
- keep global search/command, universal record drawers, approvals, and activity evidence consistent;
- use progressive disclosure, explicit loading/saved/setup/error states, keyboard access, and reduced-motion behavior;
- connect pages to real offers, bookings, catalog, intake, customer records, and analytics;
- maintain logical information architecture, descriptive URLs, useful original content, and relevant internal links;
- mark user-generated or untrusted outbound links appropriately and require rights/moderation controls for media;
- measure acquisition-to-lead-to-booking/purchase outcomes rather than vanity traffic alone.

Google’s guide supports logical structure, descriptive URLs, people-first content, relevant links, and careful treatment of user-generated links. Those are product constraints, not a promise of search ranking.

## Source state versus runtime state

| Item | Source state | Runtime/customer claim |
|---|---|---|
| Event/evaluation tables | Implemented in migration source | Pending controlled migration; not yet claimed live |
| Owner-queue event producer | Implemented and tested in source | No background delivery claim until deployment and worker proof |
| Outbox worker | Not enabled | No autonomous consumer |
| Creator/Growth Commons | Existing foundations plus reuse-first schema contract | Private-space UI/runtime not yet shipped by this research |
| Public social feed/federation | Explicitly deferred | Not available |
| Biometric storage/Wi-Fi credentials | Explicitly rejected | Not a SONARA feature |
| Global streaming network | Provider integration boundary only | Not operated by SONARA |

## Ordered implementation sequence

1. Deploy the durable event/evaluation migration through the controlled path and verify tenant/RLS behavior.
2. Add one approved, low-risk outbox consumer with idempotency, bounded retries, dead-letter evidence, and operator visibility.
3. Build the private Creator/Growth Commons slice from existing profile, follow, asset, call, notification, content, and commerce records.
4. Connect sanitized model/provider observations to vendor-neutral traces, metrics, and logs.
5. Ship vertical workflows as configuration and industry packs over shared primitives.
6. Revisit public discovery/federation only if measurable demand and the full moderation/abuse operating model exist.

Stop conditions: do not add a broker before one database-backed consumer proves need; do not add public social delivery before safety operations exist; do not create new tables until the reuse-first contract proves existing records cannot represent the lifecycle.

## Contradiction search

| Question | Finding | Consequence |
|---|---|---|
| Does SONARA already have most named product categories? | Yes, as foundations, registries, or bounded research. | Compose and harden; do not rename existing work as new products. |
| Did SONARA already have a durable outbox? | No prior migration/table was present; the architecture record named it as the next step. | The four-table foundation is a real architectural advance. |
| Does an outbox grant autonomous authority? | No; delivery and authorization are separate concerns. | Existing tenant, agent-authority, and owner-approval checks remain mandatory. |
| Is public federation required for private creator collaboration? | No. ActivityPub distinguishes client/server and federation concerns and describes substantial security risks. | Private spaces first; federation stays off. |
| Does production calling require SONARA to run a global network? | No. WebRTC leaves signaling to the application and production NAT traversal commonly needs ICE/STUN/TURN operations. | Keep workflow/session ownership; integrate managed transport when justified. |
| Does biometric sign-in require biometric storage? | No. WebAuthn keeps user verification at the authenticator and returns public-key evidence to the relying party. | Use passkeys; do not build a biometric database. |

## Primary and authoritative sources

All were read on 2026-09-17.

- [Microsoft 365 for business](https://www.microsoft.com/en-us/microsoft-365/business)
- [SAP Business Technology Platform](https://www.sap.com/products/technology-platform.html)
- [Siemens ONE Tech strategy](https://press.siemens.com/global/en/pressrelease/siemens-enters-next-stage-growth-its-one-tech-company-program)
- [Alibaba investor financial reports](https://www.alibabagroup.com/en-US/ir-financial-reports)
- [Tencent 2025 annual report](https://static.www.tencent.com/uploads/2026/04/09/62d786fcf3d3c8cb7e54791ee95439ac.pdf)
- [W3C ActivityPub Recommendation](https://www.w3.org/TR/activitypub/)
- [W3C WebRTC](https://www.w3.org/TR/webrtc/)
- [W3C WebAuthn Level 3](https://www.w3.org/TR/webauthn-3/)
- [PostgreSQL `SELECT` locking](https://www.postgresql.org/docs/current/sql-select.html)
- [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [OpenTelemetry signals](https://opentelemetry.io/docs/concepts/signals/)
- [Google Search SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [U.S. SBA business planning](https://www.sba.gov/counseling/plan-your-business/)

Internal source and tests were inspected on the branch rebased onto `ceb1df53fd77cf972a6c75f9a44a40f5c461c551`; the original production baseline was `main` at `39dec4a7da7e6945bb5e1c7a14b706e0c0fdd0db`. Uploaded PDFs, market documents, screenshots, and repository records remain non-executing evidence governed by `lib/sonara-source-evidence-register.cjs` and the open-source registry.
