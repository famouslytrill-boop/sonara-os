# SONARA Market Expansion Integration — 2026-09-16

## Purpose

This document converts the September 14–16 ChatGPT/Claude/Codex market, UX, workflow, interactive-media, generation, vertical-SaaS, field-operations, commerce, and distribution research into a repository-native implementation contract.

It does **not** declare every researched capability production-ready. The repository must continue to separate:

1. implemented foundations;
2. provider/configuration-dependent capability;
3. next implementation work;
4. design-only architecture;
5. research-only pathways;
6. partner integrations SONARA should not rebuild.

The canonical machine-readable source is `lib/sonara-market-expansion-registry.cjs`.

## Integration rule

New product work must strengthen the existing SONARA One / Business Builder / Creator Studio / Growth Studio architecture rather than creating unrelated applications.

Shared order:

```text
identity + tenant boundary
        ↓
authorization + entitlements
        ↓
customer/business data
        ↓
workflow + approvals
        ↓
provider/tool gateway
        ↓
commerce + communications + media
        ↓
product experience
        ↓
industry pack / standalone SKU
        ↓
evidence + analytics + audit
```

Research presence never grants execution authority.

## Existing foundations to reuse

### Identity / tenant / trust

- `organizations`
- `organization_memberships`
- role and permission infrastructure
- tenant guard
- consent records
- audit records
- owner/admin approval boundaries

### Workflow / agent foundation

- `workflow_runs`
- `automation_rules`
- `entity_automations`
- `entity_automation_runs`
- `entity_agents`
- `entity_agent_runs`
- `entity_agent_tool_registry`
- `entity_action_runs`
- `entity_action_approvals`
- `agent_action_logs`

Agent execution remains bounded by the existing authority contract. Generic hand-entered evidence rows must not be used to fabricate runs, approvals, or logs.

### Commerce

- Stripe checkout and webhooks
- connected payment account boundary
- `merchant_products`
- `merchant_product_variants`
- `payments`
- `subscriptions`
- `organization_entitlements`
- `usage_credit_ledger`

### Business operations

- customers and contacts
- services and appointments
- quotes and invoices
- staff, schedules, time, wages
- inventory, vendors, purchase orders, transfers
- locations, assets, vehicles, routes
- restaurant menu, recipe, ingredient, sales, and waste records

### Creator operations

- creator projects/assets/releases
- music projects/tracks/stems
- prompt blueprints and packs
- generation lifecycle
- video treatments
- scroll-site experience records
- rights/provenance/consent boundaries

### Growth operations

- leads
- lead conversations
- routing rules
- campaigns
- segments
- touchpoints
- conversions
- experiments
- reviews
- provider jobs
- consent records

### Mobile / real-world utility

- public PWA shell and service worker
- public offline fallback
- device capability and permission schemas
- location events and routes
- camera/media-capture design records
- calls and phone records

Private authenticated mutation caching remains out of the service-worker allowlist until an explicit conflict/synchronization design is implemented.

## Capability groups

### Core platform

- governed agent runtime
- durable workflow builder
- usage and credit metering
- connected commerce
- unified conversation model
- approval center
- activity timeline
- business data graph/projections

### Add-ons

- interactive media/design studio
- website experience builder
- interactive business widgets
- local/AI visibility
- reputation manager
- voice receptionist
- lead intelligence
- creator commerce
- QR physical/digital bridge
- interactive 3D experiences

### Industry packs

- restaurant operations
- home/field services
- beauty/wellness
- independent professional services
- creator business
- multi-location
- agency/reseller

### Distribution

- MCP/external-agent gateway
- agentic-commerce catalog distribution
- controlled external embeds/widgets
- future reviewed extension marketplace

## UI contract

Every new module should prefer the following shared patterns:

- outcome-first Nexus home;
- global command palette;
- universal record drawer;
- approval center;
- activity/evidence timeline;
- progressive disclosure;
- visible loading/saved/sync/setup/error states;
- mobile large-touch field surfaces;
- reduced-motion and keyboard accessibility;
- no dead buttons or fictional success;
- draft-before-send for sensitive outbound work;
- explicit rollback when reversal exists.

## Interactive Media / Design contract

A media/design capability should store structured project state rather than treating screenshots or generated files as the product model.

Target conceptual hierarchy:

```text
Experience Project
  ├─ document/page
  │   ├─ component
  │   ├─ component
  │   └─ interaction
  ├─ design tokens
  ├─ assets
  ├─ timeline/motion
  ├─ responsive rules
  ├─ accessibility metadata
  └─ publication/version evidence
```

Before new persistence is added, implementation must check whether the record belongs in existing `creator_assets`, `scroll_sites`, `business_sub_app_pages`, `generation_*`, or shared-link structures.

New tables are justified only when those shapes cannot represent the required lifecycle without ambiguous overloaded columns.

## Field / offline contract

The existing PWA offline page is not an offline mutation engine.

A future field-mode write path requires all of the following before it is called operational:

```text
local action
  ↓
local durable queue
  ↓
network available?
  ├─ no → keep queued + visible
  └─ yes
      ↓
server authorization
      ↓
version/conflict check
      ↓
apply or surface conflict
      ↓
record evidence
```

Required fields for any future offline mutation queue:

- organization scope;
- device/install identifier;
- entity type and entity identifier;
- operation type;
- idempotency key;
- expected version when applicable;
- minimal payload or secure local reference;
- created time;
- sync status;
- retry count;
- last sanitized error;
- server result reference.

Do not store secrets, raw payment authentication data, or unrestricted customer payloads in offline browser storage.

## QR contract

A future typed QR resource must resolve through an allowlisted SONARA target rather than becoming an arbitrary open redirect.

Required concepts:

- organization scope;
- target type;
- target record ID or approved SONARA path;
- public token/slug;
- activation state;
- expiry/revocation;
- scan count/analytics;
- owner approval for public activation where required.

Reusable targets include bookings, review requests, invoices/payment links, menus, products, creator releases, events, and controlled forms.

## Local visibility and reputation contract

Target workflow:

```text
scan
→ collect evidence
→ classify issue/opportunity
→ recommend
→ owner approval where mutation is external
→ apply through reviewed provider adapter
→ rescan
→ measure
```

Reuse market-intelligence tables for competitors/signals/opportunities unless provider-specific snapshot history requires a new normalized table.

External listing/review providers remain optional integrations and must not be represented as configured when credentials or account authorization are absent.

## Voice / communications contract

Voice receptionist operation requires:

- configured telephony provider;
- business knowledge source boundary;
- consent/recording policy appropriate to the call flow;
- allowed intents and tool list;
- booking/lead/customer lookup rules;
- human transfer/fallback;
- call evidence and sanitized error state;
- no unrestricted outbound campaign calling.

The unified inbox should be a projection of normalized communication events, not a reason to duplicate each channel's source records.

## Vertical pack principle

Industry packs should primarily compose existing modules, defaults, workflows, labels, and dashboards.

They should **not** fork tenant/auth/billing/customer infrastructure.

Example:

```text
Home Services Pack
  = leads
  + booking
  + service catalog
  + quotes
  + job/appointment projection
  + field mode
  + payments
  + reviews
  + maintenance recurrence
```

## Standalone SKU principle

Possible future SKUs:

- SONARA Voice
- SONARA Local
- SONARA Field
- SONARA Commerce
- SONARA Media
- SONARA Agency

These remain product packaging decisions over shared Nexus infrastructure, not separate data/security silos.

## Marketplace boundary

The repository already contains older marketplace concepts and explicit no-public-marketplace launch policies for some creator-kit material. Those restrictions remain in force.

A general SONARA extension marketplace must not launch until it has:

- publisher identity/review;
- source/licence/security review where code is involved;
- versioned extension manifest;
- requested permissions;
- organization installation records;
- entitlement/billing state;
- upgrade and rollback policy;
- data-access declaration;
- execution allowlist;
- abuse/removal process;
- payout/tax/legal policy if third parties are paid.

Marketplace research must not weaken existing creator-content licensing restrictions.

## Build vs integrate

### Build/own

- SONARA workflow and approval logic
- business/creator/growth data projections
- user experience
- industry composition
- evidence/audit state
- marketplace governance
- entitlement and capability routing

### Integrate

- payment rails
- telecommunications carrier/provider infrastructure
- foundation models
- image/video/audio model runtimes
- payroll/tax/banking/lending/insurance rails
- external accounting systems
- hardware POS stacks

Principle: **own the workflow; rent commodity or regulated infrastructure.**

## Implementation sequence

1. Keep CI, tenant isolation, auth, billing, and release evidence green.
2. Complete the durable generation persistence slice currently stacked beneath this work.
3. Version workflow definitions and link real action runs to approvals.
4. Extend usage metering and provider-cost reconciliation.
5. Implement Local Visibility/Reputation and the unified conversation projection.
6. Add Voice only through a configured provider adapter and explicit allowed intents.
7. Add structured media/design document contracts, then editable UI surfaces.
8. Build field/offline/QR primitives, then compose Home Services and other mobile-first verticals.
9. Promote Creator Commerce from product/release assets into entitlement-backed delivery.
10. Add parent-child tenant policy before Agency/Reseller mode.
11. Add MCP/external distribution only after per-tool scopes, auth, and audit are proven.
12. Add extension-marketplace installation/version/rollback contracts before public listing or payouts.

## Current branch relationship

This expansion work is intentionally stacked on the durable-generation lifecycle branch so it can reuse that persistence contract without duplicating generation tables.

If the generation persistence PR changes before merge, this branch must be rebased and its lifecycle references re-verified before it is merged.

## Third-search convergence add-on — 2026-09-17

The subsequent broad market/technology request does not create another expansion registry. `lib/sonara-third-search-convergence.cjs` reads this registry, the reuse-first schema plan, the industry/formula catalog, the governed repository registry, shared agent strategies, and source/PDF evidence at runtime and turns them into one bounded sequence.

The add-on makes three architecture decisions explicit:

1. durable events and sanitized evaluation evidence are infrastructure foundations, not a new product;
2. social, calling, streaming, recording, and interactive-media work begins as a private Creator/Growth Commons assembled from current profiles, follows, assets, calls, notifications, content queues, and commerce records;
3. public social discovery/federation, biometric storage, Wi-Fi credential features, and a custom global media network remain outside the current product boundary.

The supporting evidence, representative US/European/Chinese/industrial/creator archetypes, source-versus-runtime status, and stop conditions are recorded in `docs/research/THIRD_SEARCH_PLATFORM_CONVERGENCE_2026-09-17.md`. Named companies are representative strategy inputs, not a ranking or an assertion about their undisclosed internal stacks.
