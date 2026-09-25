# SONARA Activation-Led Go-to-Market Execution

**Date:** 2026-09-23  
**Status:** execution contract; no customer outcome claim is implied by this document.

## Decision

SONARA should not market itself by counting product cards. The public promise stays:

> **Build. Create. Grow.**

The commercial motion should lead a customer to one real result quickly, measure that result from first-party records, and only then ask for expansion into another studio or a higher plan.

This keeps product, engineering, sales, marketing, support and customer success aligned around evidence rather than feature volume.

## Current market pattern

Current official competitor surfaces reinforce four patterns:

1. **Low-friction entry matters.** HubSpot keeps a permanent free CRM with no credit card required. Salesforce offers a 30-day Sales Cloud trial. HighLevel leads with a 14-day full-product trial.
2. **Setup speed is part of the product.** HubSpot explicitly promotes streamlined onboarding, templates and setup guides. HighLevel uses industry snapshots and onboarding/support to reduce blank-state work.
3. **Expansion follows successful adoption.** HubSpot sells the upgrade from a free CRM into deeper CRM/platform capabilities. HighLevel moves from a starter operating account into unlimited sub-accounts, API access and SaaS mode.
4. **Ecosystem and support are commercial features.** HubSpot promotes a large app marketplace; HighLevel includes support and prebuilt operating patterns. SONARA should not claim comparable breadth until connectors are verified.

Official comparison references:
- HubSpot Free CRM: https://www.hubspot.com/products/crm
- HubSpot pricing: https://www.hubspot.com/pricing/crm
- Salesforce Sales pricing/trial: https://www.salesforce.com/sales/pricing/
- HighLevel pricing/trial: https://www.gohighlevel.com/pricing
- Zoho One: https://www.zoho.com/one/
- Odoo pricing: https://www.odoo.com/pricing-plan

## SONARA's commercial wedge

SONARA's credible wedge is:

- one account across business, creator and growth work;
- low entry pricing;
- customer-owned/portable records;
- deterministic controls around sensitive automation;
- explicit Setup Required states instead of simulated integrations;
- specialized creator rights/release and small-business operating workflows;
- a product family that can hand work between studios without forcing the customer to rebuild identity and records.

Do not claim that SONARA has more mature CRM, ERP, mobile, integration or enterprise depth than Salesforce, HubSpot, Odoo, Zoho or HighLevel.

## Three first-win paths

### Business Builder

**Customer question:** Can I turn a real enquiry into operating work and eventually money without moving between spreadsheets and disconnected tools?

**Current measurable activation:** organization created -> Business Builder intake recorded.

**Target first value:** lead/enquiry -> accepted quote/booking -> work order -> invoice -> recorded payment/export.

**Current event evidence:**
- `account.organization_created`
- `business_builder.intake_created`

The intake event is a workflow start, not revenue and not first value. Do not report it as a completed money loop.

### Creator Studio

**Customer question:** Can I turn creative work into a usable, rights-aware output or release package?

**Current measurable first-value candidate:** a private generated output is successfully collected by the customer.

**Current event evidence:**
- `creator_studio.output_downloaded`

The longer-term first-value definition should move toward asset -> rights/provenance -> package -> export/handoff because that is more differentiated than generation alone.

### Growth Studio

**Customer question:** Can I run a governed growth workflow and connect it to an outcome I actually recorded?

**Current measurable activation:** campaign persisted.

**Current measurable first value:** conversion/outcome persisted with attribution evidence.

**Current event evidence:**
- `growth_studio.campaign_created`
- `growth_studio.conversion_recorded`

A campaign draft is not a result. A recorded conversion is still evidence supplied or connected by the customer/provider; it is not proof that SONARA caused the result.

## Funnel contract

Measure each organization separately before aggregating.

1. **Workspace activation** — first `account.organization_created`.
2. **Workflow start** — first qualifying studio workflow-start event.
3. **First value** — first event explicitly classified `first_value=true` in the canonical activity taxonomy.
4. **Paid conversion** — first verified `billing.purchase_completed`.
5. **Retained organization** — defined only after a production cohort window is chosen and recurring qualifying activity is measured.
6. **Expansion** — an existing paid organization activates another studio or higher plan.
7. **Churn** — define from provider-backed subscription state, not inactivity guesses.

Time-to-first-value is the elapsed time between workspace activation and the first declared first-value event. Do not calculate it from page views.

## Data rules

Use `public.activity_events` as the canonical first-party product-activity ledger. Do not create another product analytics table just because a new feature needs a metric.

Every metric-eligible event must have:

- a canonical event name;
- product area;
- milestone class;
- allowed metadata;
- a server-side producer tied to a real persisted action;
- tenant scope;
- a test;
- a statement saying whether it is eligible for first-value measurement.

Event metadata must not contain passwords, tokens, secrets, email addresses, phone numbers, payment-card data, raw prompts, unrestricted provider payloads or arbitrary customer free text.

Unknown operational events may be stored for debugging, but they must default to `metric_eligible=false`.

## Acquisition strategy

### 1. Free-tool to workspace loop

Use the existing deterministic calculators and planning tools as acquisition surfaces.

Each high-intent tool should end with one relevant next action:

- business calculator -> Business Builder setup/intake;
- creator planning tool -> Creator Studio asset/project path;
- growth calculator -> campaign/lead path.

Do not route every free tool to a generic signup page.

### 2. Segment-specific landing paths

Start with three narrow audiences rather than dozens of industries:

- owner-operated service businesses;
- independent creators / small creative teams;
- small organizations actively managing leads/campaigns.

Each landing path should show:

- the customer's job-to-be-done;
- the first real workflow;
- what SONARA records;
- what requires an external provider;
- the relevant plan;
- a single start action.

Do not claim an industry pack is complete until representative customers finish the workflow without engineering intervention.

### 3. Design-partner motion

Before broad paid acquisition, recruit a small number of design partners who agree to complete the target workflow with observable milestones.

Use concierge onboarding only to discover friction. Record where staff had to intervene. A workflow that requires hidden staff repair is not self-serve activation.

### 4. Switching/import motion

A major competitor advantage is installed data and ecosystem depth. SONARA should lower switching cost by proving imports for the minimum records a customer needs to begin:

- customers/contacts;
- products/services/offers;
- invoices or payment references where supported;
- creator assets/metadata where supported;
- leads/campaign source records where supported.

The internal target remains: required fields should import without manual re-entry at a measured, declared success rate before that rate is marketed.

### 5. Referral and proof loop

Do not launch a referral-reward program around an unmeasured activation funnel.

First collect approved proof from real customers:
- starting situation;
- exact workflow used;
- elapsed time window;
- result observed;
- evidence source;
- what SONARA did and did not cause;
- explicit permission to publish.

No invented testimonial, customer count, ROI percentage, time saved, revenue lift or conversion-rate claim.

## Pricing strategy

Keep the current canonical ladder as the working commercial baseline unless measured conversion/retention evidence supports a change:

- one workspace: $29/month;
- all three studios: $59/month;
- Team: $109/month;
- annual equivalents remain tied to the canonical pricing configuration.

Positioning should emphasize consolidation and workflow value, not "cheapest CRM."

The next pricing experiments should test packaging, not arbitrary discounts:

1. one-workspace self-serve;
2. all-three cross-studio bundle;
3. Team with collaboration/support value;
4. quoted implementation/setup for customers who need migration/configuration help.

Do not add an enterprise price or SLA promise before support, reliability, identity, recovery and procurement evidence exist.

## 30-day execution sequence

### Days 1-7 — measure

- ship the canonical activity taxonomy;
- record workspace activation;
- record Business workflow start;
- record Creator collected-output first value;
- record Growth campaign start and recorded-conversion first value;
- preserve verified Stripe paid-conversion evidence;
- reject sensitive analytics metadata;
- add tests so unregistered events cannot silently become marketing metrics.

### Days 8-14 — reduce time to value

- make the selected product path land on its first useful task, not a generic dashboard;
- remove blank states from the three first-win paths;
- make setup-required dependencies explicit before a customer invests work;
- measure abandonment by milestone, not page view volume.

### Days 15-21 — prove workflows

- run representative design partners through each target path;
- record staff intervention;
- classify blockers as product, setup/provider, documentation, support or pricing;
- repair the highest-frequency blocker before adding acquisition spend.

### Days 22-30 — conversion experiments

Run bounded experiments with dated populations and denominators:

- free tool -> studio-specific start vs generic start;
- guided first task vs blank workspace;
- one-workspace vs all-three value framing;
- concierge import vs manual setup for qualified design partners.

No experiment result should be published externally until sample size, population, dates and measurement method are recorded.

## Launch gates for broader marketing spend

Do not scale paid acquisition until:

- the exact production release is known;
- the checkout -> webhook -> entitlement path is proven;
- cross-tenant tests are green;
- the three primary onboarding paths have measurable activation;
- support can handle a failed setup without engineering archaeology;
- first-value events are being recorded reliably;
- at least one target cohort has enough observations to identify the dominant onboarding blocker.

## Marketing KPIs

Track by studio and acquisition source once source capture exists:

- qualified signup rate;
- workspace activation rate;
- workflow-start rate;
- first-value rate;
- median and p90 time-to-first-value;
- trial/free-to-paid conversion;
- 30-day retained organization rate;
- expansion rate;
- cancellation/churn reason;
- support contacts before first value;
- staff interventions per activated organization;
- acquisition cost only after spend is actually attributable;
- support + infrastructure cost per paying organization.

Every aggregate metric must carry its population, dates and denominator.

## Next engineering sequence

1. canonical activity taxonomy and sanitizer;
2. server-side instrumentation of real milestones;
3. tenant-scoped activation summary;
4. acquisition-source capture with a first-party, consent-aware model;
5. funnel/retention dashboard;
6. design-partner evidence records and publish-approval boundary;
7. cohort experiments;
8. only then stronger public proof and scaled acquisition.

This sequence advances marketing and product engineering together: claims get stronger only as the underlying customer evidence gets stronger.

## 25 September 2026 — platform and market research update

This update turns the broader product brief into engineering decisions that can be checked in this repository. It does not claim that SONARA is already a complete ERP, media-production suite, transportation platform, operating system, bank, or one-of-a-kind product.

### What the current market says

- The competing products win with focused workflow coverage, onboarding, installed integrations, and recognizable customer outcomes. HubSpot keeps a no-cost CRM entry point; Odoo packages CRM, commerce, accounting, inventory, point of sale, and project management; HighLevel's official pricing currently lists $97, $297, and $497 monthly tiers. These are moving product surfaces, not durable price guarantees. Recheck the primary pricing pages before publishing a comparison or setting SONARA prices.
- A broad catalog is not a useful point of difference by itself. SONARA's defensible test is whether one small-business or creator workflow crosses product boundaries with shared identity, records, permissions, audit history, and a useful export—without requiring duplicate data entry.
- “Unique” and “one of a kind” are not substantiated claims until a dated competitive review and customer research show a specific unmet job. Use the narrower promise: one coherent place to build, create, and grow, with honest setup states and portable records.

Primary market references, checked 2026-09-25:

- [HubSpot free CRM](https://www.hubspot.com/products/crm)
- [Odoo product suite and pricing](https://www.odoo.com/pricing)
- [HighLevel pricing](https://www.gohighlevel.com/pricing)
- [Federal Reserve Banks, 2025 Report on Employer Firms (2024 survey)](https://www.fedsmallbusiness.org/reports/survey/2025/2025-report-on-employer-firms)

### Product and data rules

1. **One source of truth per business fact.** Keep one canonical record and expose list, board, calendar, timeline, and map views over that record where the workflow needs them. Do not create parallel tables for the same activity or status. Every new table needs an owner, tenant scope, lifecycle, retention rule, and at least one production read/write path.
2. **Tenant boundaries are schema rules.** Use foreign keys, uniqueness/check constraints, tenant-scoped indexes and queries, and row-level policies together. PostgreSQL documents that row-level security is default-deny when enabled without a matching policy; privileged table owners and service paths still need separate access review. Test both reads and writes across tenants and test migrations from an empty database as well as the supported upgrade path.
3. **An initially empty customer workspace is a valid state; an empty-looking dead end is not.** Show a clear next action that creates a real record, explains setup required, or links to a useful import/template. Never insert fake customer records to make a dashboard look populated. Keep sample data inside a clearly named, disposable sandbox.
4. **Every visible control has one declared outcome.** A navigation item has one canonical route; a form submits to a tested handler; a button either executes a specific action or is visibly unavailable with a reason. Check duplicates, unresolved links, dead buttons, unexpected redirects, keyboard operation, and failure responses. Maintain the existing two-way route accounting and signed-in reachability crawl as release gates; add browser assertions for the high-value create, save, export, connect, disconnect, and notification paths.
5. **Notifications are user-controlled and explain why they appeared.** Persist preference, delivery state, retry state, and deduplication key; default sound, vibration, push, SMS, and email off unless the user enables them. Provide in-app status and an accessible text alternative to every sound or visual cue.

### Deterministic foundation; optional AI

The no-AI operating path should cover core business records, calculations, scheduling, routing, approvals, forms, search, imports/exports, analytics definitions, and automation state transitions. LLMs and other hosted providers remain optional adapters: turning them off must not disable saved records, deterministic formulas, explicit user actions, or the workflow's inspectable history.

For media, separate repeatable editing/rendering from probabilistic generation. A reproducible render job records input asset hashes, edit/scene manifest, fonts and assets, tool/codec versions, parameters, and output checksum. Use pinned software encoders and regression fixtures for deterministic templates, graphics, music beds, voice announcements, and video assembly. Hardware encoders and third-party generative models may vary across versions/devices; expose that as a provider-dependent result with provenance, and do not promise byte-identical output unless the exact pipeline has passed that test. FFmpeg documents `bitexact` options, but that flag alone does not make every codec, plugin, hardware path, or external model reproducible.

### Open technology choices and controls

- Keep PostgreSQL/Supabase migrations and the canonical schema contracts as the data authority; use PostgreSQL constraints and tenant RLS as database-level enforcement, not only route checks.
- Keep OpenTelemetry for vendor-neutral traces, metrics, and logs, and use its semantic conventions to make service/workflow measurements comparable. Separate local instrumentation from a successfully deployed collector and backend; “wired” is not “export proven.”
- Keep OpenFeature for provider-independent capability flags and tenant evaluation context. Fail closed for restricted capabilities, record the evaluated capability and reason, and require an explicit canary gate before external side effects.
- For each newly adopted open-source component, record the immutable version, licence and notice obligations, SBOM/dependency evidence, security owner, resource budget, actual call site, recovery path, and removal plan. “Installed” and “researched” do not mean customer-ready.

These choices follow the current [OpenTelemetry documentation](https://opentelemetry.io/docs/), [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/), [OpenFeature specification](https://openfeature.dev/specification/), [PostgreSQL row-security guide](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), and [FFmpeg documentation](https://ffmpeg.org/ffmpeg.html), checked 2026-09-25.

### Upgrade order from here

1. Finish the three measurable first-win workflows in this document; publish a milestone only after the user-visible action, tenant-scoped database write, telemetry record, failure path, and export are tested together.
2. Turn the current dashboard into an evidence view: denominator and date range, workflow starts, first value, paid conversion, setup-required blockers, support contact, and provider failures. Keep organization-level data isolated and exclude free text and secrets.
3. Remove friction from setup: guided creation, validated import mapping, reusable templates, clear empty/setup/failure states, responsive screens, keyboard paths, and understandable notifications.
4. Activate one external connector per customer cohort only after authorization, bounded sync, idempotency, retries, telemetry, reconciliation, disconnect/delete, and recovery are proven. Do not expand connector count to inflate marketing breadth.
5. Add vertical templates on shared business objects. Start with owner-operated service businesses, independent creators, and small teams managing leads. Expand into restaurants, transport, retail, manufacturing, government, finance, robotics, or dating only after customer demand, data/legal needs, support cost, and domain-specific failure handling are validated.
6. Keep performance and release gates measurable: route and action coverage, WCAG 2.2 keyboard/focus/reflow review, p50/p95 response latency, render time/frame rate on named test devices, crash/error rate, queue age, backup-restore evidence, and cost per successful workflow. Report missing production evidence as a blocker rather than a pass.

W3C's [WCAG 2.2](https://www.w3.org/TR/WCAG/) is the accessibility baseline for focus visibility, target size, and keyboard paths. The repository's route checks prove registered paths and page reachability; they do not alone prove that every browser control works end to end, that every schema is populated, or that production performance targets have passed. Keep those as explicit, separate evidence gates.
