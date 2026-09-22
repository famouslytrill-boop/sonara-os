# SONARA 2026 Cross-Industry Product & Market Intelligence Wave

**Observed:** 2026-09-22  
**Purpose:** Convert current market, engineering, agentic-AI, infrastructure, commerce, creator, field-service, industrial, security, and UX research into bounded SONARA product decisions.

This document is deliberately not a catalogue of every company or repository found. A reference belongs here only when it changes a SONARA product, architecture, safety, pricing, workflow, or verification decision.

## Executive decision

SONARA should remain **capability-rich underneath and interface-small on top**.

The recurring 2026 pattern across business platforms, restaurant systems, field-service software, commerce, construction, creative suites, AI agents, and financial infrastructure is convergence around:

1. one durable customer/workspace identity,
2. one source of truth for records,
3. a small number of outcome-oriented surfaces,
4. integrations and specialist engines behind adapters,
5. durable/idempotent workflow execution,
6. explicit human approval before irreversible agent actions,
7. subscriptions for durable software value,
8. metering/credits for variable-cost execution,
9. strong observability and audit evidence,
10. progressive disclosure instead of exposing every subsystem.

## Market evidence translated into SONARA decisions

| Domain | Current 2026 pattern | SONARA decision |
|---|---|---|
| Agentic AI | OpenAI's Agents SDK direction emphasizes long-horizon delegated work, tools and controlled execution. LangGraph/n8n emphasize persistence and human review. | Keep agents bounded by tools, permissions, approval classes, retries, evidence, and rollback. Never equate a model response with an authorized action. |
| Durable workflows | Temporal treats durable execution as the primitive for payments, onboarding, fulfillment and long-running agent work. | Durable event/outbox + idempotency + claim/settle/retry remains the SONARA baseline. A new workflow must declare its replay and side-effect policy. |
| Payments | Stripe Entitlements separates feature access from product purchase; Stripe Meters and billing credits support usage-based/credit-burndown models. | Subscription opens software; usage ledger pays for GPU, streaming, campaign email, telephony, 3D/build and similar variable-cost execution. |
| CRM / business OS | HubSpot, Zoho One and Odoo converge many apps behind shared identity/data while using progressive adoption. | Three workspaces stay distinct, but records, identity, billing, evidence, search and support remain shared. Do not create a fourth workspace for every vertical. |
| Restaurants / POS | Toast and Square combine orders, payments, inventory, staffing and customer operations into one restaurant operating loop. | Restaurant features compose Business Builder primitives: catalog/menu, orders, payments, staff, stock, locations and reporting. |
| Trades / field service | ServiceTitan centers call booking, dispatch, jobs, estimates, payments, customers, inventory and technician workflows. | HVAC/electrical/plumbing/carpentry use a reusable Field Operations pack rather than separate codebases. |
| Fleet / trucking | Samsara centers GPS, routing, dispatch, maintenance, safety and geofenced events with explicit privacy controls. | Fleet pack uses vehicles + routes + maintenance + check-ins + location privacy; GPS is never a universal always-on requirement. |
| Construction / CAD | Autodesk Construction Cloud/Forma combine document truth, project management, model coordination and large integration ecosystems; Autodesk Automation APIs expose controlled cloud CAD automation. | CAD/engineering remains an external specialist adapter. SONARA stores jobs, files, approvals, versions and business evidence; it does not pretend to replace CAD. |
| Commerce | Shopify unifies online/in-store orders, customers, inventory and payments. | One commerce record should flow from offer/catalog to order, payment, fulfillment, customer history and growth attribution without re-entry. |
| Creative work | Canva and Adobe combine creation surfaces but meter expensive generative capabilities and premium compute/content. | Keep deterministic creator planning tools free; subscription unlocks projects/assets/release operations; generation uses usage credits. |
| RAG / data | pgvector remains a practical Postgres-native vector primitive for retrieval workflows. | Prefer tenant-scoped Postgres/pgvector retrieval before introducing a second vector database. Every retrieved record retains source/provenance. |
| Observability | OpenTelemetry standardizes traces/metrics/logs; modern product analytics combines funnels, errors, replay and experiments. | Instrument workflows by correlation ID, tenant, capability, provider, latency, cost and outcome. Never expose secrets or raw sensitive payloads in telemetry. |
| Accessibility | WCAG 2.2 and Core Web Vitals require keyboard/focus/reflow plus field performance, not only lab scores. | Release gate must cover keyboard, focus visibility, 200% zoom/reflow, screen-reader landmarks, LCP/INP/CLS and real-user field data when traffic exists. |
| Security | OWASP's 2026 agentic guidance makes agent authorization, tool misuse, prompt injection and control boundaries explicit risks. Passkeys reduce phishing/reuse risk. | Fail closed, least privilege, scoped tools, per-action approval, signed provider callbacks, audit evidence, passkey-ready auth, and no customer secrets in browser code. |
| Physical AI / robotics | NVIDIA Isaac shows simulation-first robotics with specialized compute, ROS and synthetic data. | Robotics/manufacturing is reference + adapter territory until hardware, simulation, safety and liability are separately validated. |
| Mobile market | Top productivity charts increasingly mix general AI assistants with narrow specialist utilities. | Keep SONARA's broad operating layer, but preserve narrow deterministic free tools because they are acquisition, SEO and habit-forming surfaces. |

## Cross-industry primitive map

The requested industries should be implemented by composition rather than by cloning full products.

**Identity & trust:** profiles, organizations, memberships, roles, consent, authentication, approvals, audit.

**Commerce:** offers, products/services, quotes, orders, invoices, payments, refunds, subscriptions, usage credits.

**Work:** projects, jobs, tasks, schedules, bookings, routes, locations, staff, vendors, assets, inventory, maintenance.

**Customer:** leads, enquiries, customers, conversations, permissions, support, reviews, referrals, attribution.

**Creator/media:** projects, assets, rights, collaborators, releases, generation jobs, exports, delivery.

**Automation:** deterministic rules, durable events, agent actions, approvals, retries, dead letters, observability.

**Data/intelligence:** analytics, experiments, forecasting, formulas, retrieval, provenance, reports.

**Device/context:** notifications, camera/mic/location/haptics only behind purpose-specific permission and graceful fallback.

New verticals—restaurants, trucking, trades, cleaning, property/rental, retail, waste, manufacturing, construction, delivery and service businesses—should first prove they can be expressed with these primitives. Only a genuine domain-specific invariant earns a new core primitive.

## Agent and workflow contract

Every executable workflow must declare:

- trigger and actor;
- tenant/workspace scope;
- input schema and validation;
- authorization policy;
- deterministic steps versus model-assisted steps;
- side-effect class;
- approval requirement;
- idempotency key;
- retry/backoff policy;
- timeout/cancellation behavior;
- durable state;
- compensation/rollback strategy;
- audit event;
- metrics and cost;
- customer-visible status;
- privacy/retention rule.

For agent tools, default approval is required for payments, purchases, refunds, external messages, publishing, destructive writes, permission changes, account changes, physical-device actions, regulated/high-impact actions and irreversible provider calls.

## Monetization contract

Customer access is four simple concepts plus scope:

| Customer concept | Meaning |
|---|---|
| Free | account essentials + deterministic planning/acquisition tools + limited useful records |
| One Workspace | full operational depth inside one selected workspace |
| All Three | Business Builder + Creator Studio + Growth Studio |
| Team | All Three + staff portal, team roles, assignments, approvals and people operations |
| Metered usage | variable-cost execution charged from usage credits; separate from software access |

Historical database values starter/core/pro may remain temporarily for compatibility, but they must not be the normal customer vocabulary.

Never meter or paywall basic account security, consent withdrawal, subscription cancellation, required privacy/data rights, or access to a customer's existing records after downgrade.

## Product-surface contract

Normal customers should see tasks and outcomes, not infrastructure names.

Keep technical terms such as control plane, migration, RLS, event outbox, model gateway, provider job, lifecycle engine and deployment evidence on operator/admin surfaces.

Public navigation target:

- Products
- Free Tools
- Pricing
- Sign in
- Start free

Workspace navigation uses progressive disclosure. Keep advanced and rarely-used screens reachable through search/More rather than placing every route in primary navigation.

Self-serve software must say **Open tool/Open workspace/Compare plans**. Done-for-you work may say **Request service**. Do not mix the two interaction models on every catalog card.

## Reliability and scale priorities

1. Reconcile code catalog, database catalog, service catalog UI and entitlement model into one generated truth.
2. Normalize customer pricing vocabulary without rewriting historical entitlement keys.
3. Classify every workflow as active, beta, setup_required, disabled, internal or metered.
4. Prove the paywall matrix with Free, One Business, One Creator, One Growth, All Three, Team, cancelled, expired, payment-failure and credit-exhaustion identities.
5. Consolidate navigation and remove internal engineering surfaces from ordinary customer paths.
6. Run Supabase authorization/performance cleanup without weakening deny-by-default behavior.
7. Wire observability only when it measures real runtime paths.
8. Validate mobile/accessibility/Core Web Vitals.
9. Only then freeze the full brand/design system.

## Regulated and high-risk boundaries

Finance/investment, insurance, government, military, surveillance/biometrics, medical, autonomous vehicles/robotics, employment decisioning and other high-impact domains stay **reference-only or specialist-adapter** until legal, security, safety, authorization, data-governance and human-review requirements are individually satisfied.

Researching a repository, company or workflow does not grant permission to execute it or send customer data to it.

## Source set read for this wave

Primary/current sources checked on 2026-09-22 include:

- OpenAI Agents SDK and agent-work guidance: https://openai.com/
- Temporal durable execution: https://temporal.io/
- LangGraph persistence/HITL: https://docs.langchain.com/
- n8n human-in-the-loop tools: https://docs.n8n.io/
- OWASP Agentic AI / LLM security guidance: https://owasp.org/
- NIST AI Risk Management Framework: https://www.nist.gov/
- FIDO passkeys: https://fidoalliance.org/passkeys/
- Stripe Entitlements, Meters and billing credits: https://docs.stripe.com/
- HubSpot CRM/platform: https://www.hubspot.com/
- Zoho One: https://www.zoho.com/one/
- Odoo: https://www.odoo.com/
- Toast restaurant platform: https://pos.toasttab.com/
- Square Restaurants: https://squareup.com/
- ServiceTitan: https://www.servicetitan.com/
- Samsara: https://www.samsara.com/
- Autodesk Construction Cloud / Automation APIs: https://www.autodesk.com/
- Shopify POS: https://www.shopify.com/pos
- Canva Visual Suite: https://www.canva.com/
- Adobe Creative Cloud / Firefly: https://www.adobe.com/
- Supabase pgvector: https://supabase.com/docs/guides/ai
- OpenTelemetry JavaScript: https://opentelemetry.io/
- web.dev Core Web Vitals: https://web.dev/vitals/
- W3C WCAG 2.2: https://www.w3.org/WAI/WCAG22/
- NVIDIA Isaac: https://developer.nvidia.com/isaac
- Apple App Store and Google Play productivity charts for current mobile-market reference.

## Explicit non-goals

This wave does **not**:

- install every repository found;
- turn research entries into production execution;
- replace specialist CAD/ERP/DAW/medical/regulated systems;
- enable autonomous payments, publishing or outreach;
- create a new database merely because a technology is popular;
- add a feature without an owner, customer outcome, entitlement, workflow state and release proof.
