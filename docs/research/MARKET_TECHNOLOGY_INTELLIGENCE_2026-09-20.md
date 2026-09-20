# SONARA 2026 Market + Technology Intelligence — 2026-09-20

## Purpose

This research converts the September 20, 2026 broad market/technology request into a bounded SONARA implementation program spanning:

- agentic AI, LLMs, RAG, deterministic workflows, skills, memory, evaluation, automation, analytics and scaling;
- small-business and enterprise management;
- restaurant/POS/kiosk/order/delivery operations;
- HVAC, electrical, plumbing, carpentry, cleaning, construction, field service, project and waste-management workflows;
- trucking, fleet, logistics, routing and delivery;
- retail, store, ecommerce, buying/selling, subscriptions, refunds and customer service;
- payments, banking/transfer adapters, usage metering and reconciliation;
- social, creator, streaming, video, audio, images, film, books, artists and podcasting;
- manufacturing, quality, robotics, CAD/3D-printing references and industrial operations;
- real estate, rentals and property workflows;
- gaming, interactive 3D, AR, device/GPU/CPU/performance concepts;
- identity, passkeys, monitoring, notifications, camera/location/sensor inputs and security;
- education, classroom, learning, translation and accessibility;
- websites, apps, SEO, public access, venues, job creation/listing, scheduling and service marketplaces.

This file is research evidence and architecture guidance. It does **not** activate providers, install third-party repositories, grant agent authority, deploy workers, create production migrations, make financial/investment recommendations, or claim a researched capability is already live.

The machine-readable companion is `lib/sonara-2026-market-intelligence.cjs`.

## Executive conclusions

### 1. The product opportunity is not “another chatbot”

AI usage is mainstream while governed agent execution remains materially less mature. Stanford reports 88% of surveyed organizations used AI in at least one function in 2025 while agent deployment remained in the single digits across nearly all business functions. McKinsey's August 2026 survey reports that 40% of respondents at organizations above $1B revenue were scaling agents versus 22% at smaller organizations.

**SONARA implication:** package the infrastructure smaller organizations usually lack: tenant-safe context, deterministic policy, workflows, approvals, tools, cost ceilings, evaluation, evidence, rollback and observability.

### 2. Vertical winners combine a system of record with intelligence and action

Restaurant, trades and fleet evidence points in the same direction:

- Toast grounds its restaurant assistant in sales, labor, menu, guest and operational data.
- ServiceTitan's contractor research shows integration complexity and training are leading adoption barriers.
- Geotab is moving fleet analytics from passive reporting toward predictive maintenance, safety and conversational operational access.

**SONARA implication:** the data model and workflow are primary; LLMs are replaceable components. Intelligence should end in an explainable, authorized business action.

### 3. Agentic commerce is becoming real infrastructure

Stripe's 2026 announcements include agentic-commerce capabilities, delegated agent payments and machine-payment protocols.

**SONARA implication:** catalogs, service availability, checkout, subscriptions, usage metering, delegated spend, refunds and reconciliation need machine-readable contracts. Models must never receive unrestricted payment credentials or final payment authority.

### 4. Distribution is multi-surface

Similarweb's August 2026 global ranking placed Google, YouTube, Facebook, Instagram and ChatGPT as the five most-visited websites. Social-commerce research also shows discovery increasingly converts directly into transactions.

**SONARA implication:** one canonical business/product/service graph should feed owned websites, search/structured data, social/video channels, creator surfaces and AI/agent discovery rather than maintaining disconnected channel data.

### 5. Security and mobile policy are product requirements

FIDO estimates five billion passkeys in use and reports broad consumer/workforce adoption. Apple subscription state is increasingly server-driven through StoreKit/App Store Server APIs/notifications. Google Play's 2026 target-API policy requires current Android targeting for new submissions/updates.

**SONARA implication:** passkeys, step-up authorization, signed entitlement reconciliation, mobile policy gates and device-proof testing belong in the platform roadmap, not as launch-week cleanup.

### 6. Compute and data architecture must stay workload-driven

Synergy Research estimates Q2 2026 cloud infrastructure spending at about $143B, with AI a major driver. This validates demand but does **not** justify adding specialized databases or infrastructure without measured need.

**SONARA implication:** PostgreSQL/Supabase remains the system of record. Add cache/search/vector/time-series/analytics/graph/edge/GPU systems only when a measured workload and recovery/consistency contract requires them.

## Current 2026 market evidence

| Domain | Dated signal | SONARA implementation consequence |
| --- | --- | --- |
| AI adoption | Stanford AI Index: 88% organizational AI use; agent use still early | Governed agent runtime + deterministic workflow/evaluation |
| Enterprise agents | McKinsey: large enterprises scaling agents faster than smaller firms | Deliver pre-integrated agent infrastructure for businesses without platform teams |
| Skilled trades | ServiceTitan: 12% embedded AI, 34% experimenting; training/integration are top barriers | Guided onboarding, embedded intelligence, field workflows |
| Restaurants | Toast: AI usage grounded in sales/labor/menu/guest/operations across large restaurant cohorts | Restaurant data graph + action-aware operator copilot |
| Fleet/trucking | Geotab: >5.8M connected vehicles in report dataset; predictive safety/maintenance focus | Telematics adapters + exception/maintenance/route workflows |
| Identity | FIDO: passkeys at multi-billion scale | Passkeys + recovery + step-up + audit |
| Payments | Stripe: agentic-commerce and machine-payment infrastructure | Delegated spend + budgets + idempotent payment state + reconciliation |
| Web distribution | Similarweb Aug. 2026: Google/YouTube/Facebook/Instagram/ChatGPT top five | Search/social/video/AI-readable distribution from canonical business data |
| Games | Newzoo forecasts $213.9B market and 3.70B players in 2026 | Reuse interactive/real-time/entitlement patterns; do not build a general game engine |
| Large-company market structure | S&P 500 Aug. 31: IT 37.9% of index weight | Study platform economics and ecosystems, not stock-price signals |
| Cloud | Synergy Q2 2026: ~$143B quarterly infrastructure spend, 43% YoY growth | Cost-aware provider-neutral compute/storage/data architecture |
| Robotics/manufacturing | IFR: U.S. industrial robot installs rose 11% to 38,000 in 2025; food-industry adoption +30% | Industrial management + telemetry adapters, not robot hardware |
| Real estate | Zillow introduced conversational AI tied to live listings and actions such as tour scheduling | Conversation should connect proprietary/current data to real workflow actions |
| Social commerce | EMARKETER forecasts 51% of U.S. social buyers will shop on TikTok in 2026 | Link creator/social content to catalog, attribution and checkout |
| Apple subscriptions | Apple directs subscription apps to StoreKit + App Store Server API/Notifications | Server-verified entitlements and refund/renewal reconciliation |
| Android distribution | 2026 Play target-API cycle requires API 36 for standard new apps/updates after Aug. 31 | Preserve API-36 packaging gate and physical-device proof |

## Competitive and ecosystem archetypes

Named organizations below are **reference archetypes**, not a ranking and not a claim about private internal architecture.

### AI / model / agent ecosystem

- OpenAI, Anthropic, Google, Microsoft, Meta, xAI, Alibaba and DeepSeek demonstrate that model/provider competition changes quickly.
- GitHub and coding-agent ecosystems show software creation is becoming more agent-assisted.
- The correct SONARA architecture is therefore a provider-neutral gateway plus evaluation, policy, cost and observability contracts.

### Business operating systems

Useful archetypes include Salesforce/HubSpot for CRM and growth, Shopify for merchant operations, Stripe for payments/platform economics, Toast for hospitality, ServiceTitan for trades, ServiceNow for enterprise workflow, and Geotab/Samsara-style systems for connected fleet operations.

**Do not clone product surfaces.** Extract patterns: canonical records, workflow state machines, embedded analytics, integrations, role policy, mobile field UX, event streams, billing/entitlements and vertical defaults.

### Web, social and creator distribution

Google/YouTube, Meta properties, TikTok and AI assistants concentrate discovery and attention. SONARA should own canonical business/creator data and syndicate controlled projections outward.

### Manufacturing and robotics

The management layer should model work orders, assets, BOM/material usage, quality, OEE, maintenance, evidence and telemetry. PLC/robot/CAD/CAM/3D-printing systems remain external specialist integrations unless a narrow SONARA-owned data contract is justified.

### Finance and investment intelligence

Use market/index/company data for **business intelligence**, benchmarking and research. Do not turn the platform into an investment adviser or autonomous trading system. S&P sector composition and major financial/technology companies are signals about capital and industry structure, not buy/sell instructions.

### Public-sector and government integrations

Treat public-sector workflows as compliance-first partner integrations: accessibility, public forms, scheduling, records/retention hooks, procurement evidence, audit and secure identity. This research adds no tactical, weapons or autonomous enforcement capability.

## Product architecture generated from the research

```text
Identity + tenant + entitlement
        ↓
Policy + approval + deterministic authority
        ↓
Canonical customer/business/creator/asset graph
        ↓
Versioned workflow + durable events + idempotency
        ↓
Agent/RAG/model/tool gateway
        ↓
Commerce + communications + scheduling + media
        ↓
Vertical composition
        ↓
Distribution / websites / mobile / social / agents
        ↓
Analytics + evaluation + audit + evidence
```

### Shared primitives first

Build once and reuse everywhere:

1. identity, tenant isolation, role policy, passkeys, entitlements and approval;
2. versioned workflows, action runs, idempotency, durable events, retries/dead-letter evidence;
3. grounded retrieval, governed memory, tool registry, agent evaluation and cost/latency budgets;
4. customer/contact/conversation timeline;
5. catalog/order/payment/refund/subscription/reconciliation state machines;
6. scheduling/calendar/availability/timekeeping;
7. notification and channel adapters;
8. media asset/project/rights/provenance contracts;
9. mobile/offline/camera/GPS/device capability boundaries;
10. analytics, forecasting, formula and evidence layers.

### Vertical composition

- **Restaurant/POS/kiosk:** menu, recipe, food cost, inventory, vendors, labor, ordering, payments, kiosk isolation, delivery adapters, reviews.
- **Field service/trades:** lead → booking → dispatch → estimate → approval → work → material usage → invoice → payment → review.
- **Fleet/trucking/delivery:** asset/driver/route/job, GPS/telematics adapters, maintenance, safety, utilization, delivery evidence.
- **Retail/ecommerce/store:** catalog, inventory reservation, order state, returns/refunds, customer service, channel synchronization.
- **Creator/social/media:** project → asset → rights → generation/edit → review/moderation → schedule/publish → measure → sell.
- **Manufacturing:** work order, BOM/materials, quality, OEE, maintenance, machine telemetry and document/CAD references.
- **Real estate/rental:** property/unit/listing, inquiry, tour/booking, document, maintenance, payment and communication.
- **Learning/translation:** content graph, retrieval, translation provenance, accessibility, progress/evaluation.
- **Interactive/gaming/3D:** scene/project graph, assets, timing/state, entitlements, performance budgets, telemetry; specialized engines remain integrations.

## Deterministic and statistical engine direction

The existing SONARA formula/algorithm registries should remain the authority rather than adding duplicate calculators. New execution work should compose tested functions for:

- contribution and gross margin;
- food/labor cost percentage;
- inventory reorder point and safety stock;
- utilization and capacity;
- OEE/quality capability;
- route/dispatch objective functions;
- queue pressure/backpressure;
- SLA and response-time compliance;
- churn/retention cohort measurements;
- conversion and attribution;
- forecast error (MAE/MAPE where appropriate);
- RAG citation coverage/retrieval evaluation;
- agent success, retry, escalation and cost per successful outcome.

The new market layer adds one portfolio heuristic:

```text
opportunity_score =
  0.25*pain
+ 0.25*platform_reuse
+ 0.20*data_advantage
+ 0.15*monetization
+ 0.15*adoption_readiness
- 0.12*integration_risk
- 0.13*regulatory_risk
```

This is an internal planning heuristic, **not** a revenue forecast or investment score.

## Build vs. integrate

### SONARA should own

- tenant/identity/authority and approvals;
- business/customer/creator data projections;
- workflow state and evidence;
- cross-product UX;
- deterministic formulas and evaluation;
- vertical composition;
- entitlement/capability routing;
- research-to-runtime governance.

### SONARA should integrate

- card/bank/payment rails;
- telecom and messaging carriers;
- app-store billing;
- foundation models and model hosting;
- external accounting/payroll/tax/insurance/lending;
- POS hardware and specialist restaurant devices;
- telematics and vehicle hardware;
- robot/PLC/industrial hardware;
- CAD/CAM specialist execution;
- social/search distribution APIs;
- cloud/GPU commodity infrastructure.

Principle: **own workflow, policy, data context and customer experience; integrate commodity, regulated and hardware infrastructure.**

## Engineering sequence

1. Preserve exact-head CI, tenant isolation, auth, billing and release evidence.
2. Finish current PR #310 convergence without weakening its security/runtime boundaries.
3. Promote the new market intelligence module into the existing ecosystem control plane only after its tests and repository governance checks pass.
4. Complete versioned workflow/action-run/approval/idempotency contracts.
5. Activate exactly one low-risk durable-event consumer behind a disabled-by-default flag and canary evidence.
6. Unify customer conversations, service records and activity timelines.
7. Normalize catalog/order/payment/refund/subscription/reconciliation.
8. Compose restaurant, field-service and fleet packs from shared primitives.
9. Add creator/social/media distribution and rights-aware commerce.
10. Complete offline field/device inputs, passkeys and security monitoring.
11. Add provider-neutral external/MCP adapters only behind tool scopes and audit.
12. Add spatial/3D/game-like experiences and highly regulated integrations only after product-specific proof gates.

## Research sources

- Stanford HAI, 2026 AI Index — Economy: https://hai.stanford.edu/ai-index/2026-ai-index-report/economy
- McKinsey, The State of AI 2026: https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai
- ServiceTitan, 2026 State of AI in the Trades: https://www.servicetitan.com/guides/2026-ai-in-the-trades
- Toast, Q1 2026 restaurant AI/POS trends: https://pos.toasttab.com/blog/data/q1-2026-restaurant-ai-pos-trends
- Geotab, 2026 State of Commercial Transportation: https://www.geotab.com/resources/ebook/state-of-commercial-transportation-2026/
- FIDO Alliance, State of Passkeys 2026: https://fidoalliance.org/the-state-of-passkeys-2026-global-consumer-and-workforce-report/
- Stripe Sessions 2026: https://stripe.com/newsroom/news/sessions-2026
- Stripe Machine Payments Protocol: https://stripe.com/blog/machine-payments-protocol
- Similarweb, Top 100 Most Visited Websites — August 2026: https://www.similarweb.com/blog/research/market-research/most-visited-websites/
- Newzoo, 2026 Global Games Market: https://newzoo.com/articles/executive-summary-ggmr-2026-free-edition
- S&P Dow Jones Indices, S&P 500: https://www.spglobal.com/spdji/en/indices/equity/sp-500/
- Synergy Research, Q2 2026 cloud infrastructure: https://www.srgresearch.com/articles/q2-cloud-market-passes-143-billion-highest-growth-rate-in-eight-years
- International Federation of Robotics, U.S. robot industry 2026: https://ifr.org/ifr-press-releases/news/us-robot-industry-returns-to-double-digit-growth
- Zillow Group, Zillow AI mode: https://investors.zillowgroup.com/news-and-events/news/news-details/2026/Zillow-debuts-AI-mode-bringing-guided-intelligence-to-every-step-of-the-housing-journey/default.aspx
- EMARKETER, U.S. Social Commerce Forecast 2026: https://www.emarketer.com/content/us-social-commerce-forecast-2026
- Apple Developer, subscriptions: https://developer.apple.com/app-store/subscriptions/
- Apple Developer, App Store Server API: https://developer.apple.com/documentation/appstoreserverapi
- Android Developers, target API requirements: https://developer.android.com/google/play/requirements/target-sdk

## Evidence quality notes

- Stanford, McKinsey, FIDO, Similarweb, S&P, Synergy, IFR and Newzoo are used as external market/standards/research evidence.
- Toast, ServiceTitan, Geotab, Stripe and Zillow are company/vendor sources and are treated as product/usage signals rather than neutral proof of market-wide outcomes.
- Forecasts are directional. They are never encoded as guaranteed demand or revenue.
- App-store rankings and web rankings change frequently; use dated snapshots, not permanent “top app” claims.
- Named companies and products are pattern references. No private internal architecture is inferred.
