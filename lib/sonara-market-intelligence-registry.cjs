// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { getMarketRDPriorities } = require("./sonara-market-rd-priorities.cjs");

const MARKET_INTELLIGENCE_FRAMEWORK = Object.freeze({
  version: "2026-09-22",
  asOf: "2026-09-22",
  positioning: "Affordable, governed operating infrastructure for independent founders, creators, local operators, and small teams that need real workflows without enterprise cost or platform lock-in.",
  portfolioThesis: [
    "Do not compete as another generic website builder, design editor, or bulk-email platform.",
    "Win on the connected path from first offer to first transaction, from creator asset to owned release package, and from consented customer data to measured growth.",
    "Use one organization, customer, consent, asset, evidence, and attribution spine across Business Builder, Creator Studio, and Growth Studio.",
    "Keep advanced providers optional and setup-gated; the core system must remain useful without pretending external accounts are connected.",
    "Preserve affordable pricing while limiting high-cost provider work, storage, sending, and support through clear plan limits and fair-use rules."
  ],
  markets: Object.freeze({
    business_builder: Object.freeze({
      name: "Small-business operating software",
      primaryAudience: "Nonemployer businesses, independent service providers, local operators, restaurants, mobile vendors, and small teams.",
      marketSignals: [
        "The United States has more than 36 million small businesses, and nonemployer businesses represent the majority of establishments.",
        "Small businesses are increasing investment in digital operations, cybersecurity, content, social media, and selected AI-assisted workflows.",
        "Established competitors bundle payments, bookings, customer records, inventory, invoicing, staff tools, and websites, but advanced plans commonly move well above SONARA's current price range.",
        "The strongest underserved need is not another blank builder; it is guided setup, operational continuity, affordability, portability, and a clear route to the first completed transaction.",
        "Mature 2026 suites converge around a shared operating loop: customer or lead, offer or catalog, booking/order/job, fulfillment, payment, staff/inventory, and reporting. Their advantage comes from connected records and execution depth rather than the number of disconnected tools.",
        "Field-service platforms make the operating chain explicit: lead generation, booking, dispatch, job execution, invoice/payment, and back-office operations. Business Builder should model that chain as reusable primitives and specialize it with vertical packs.",
        "Payments platforms increasingly span online and in-person acceptance, recurring billing, marketplace payouts, tax, fraud controls, and financial-data connections. SONARA should integrate those regulated rails through adapters instead of handling card or banking credentials itself."
      ],
      priorities: [
        "First-transaction workflow: offer, intake, booking or order, payment, customer record, delivery, review request, and repeat follow-up.",
        "One reusable lead-to-cash and job-to-cash operating spine before more isolated modules: customer, catalog, quote, booking/order/job, fulfillment, invoice/payment, reconciliation, and follow-up.",
        "Vertical starter packs for restaurant/food, trades and field service, retail/ecommerce, fleet/logistics, professional services, cleaning/facilities, property/rental, events/hire, memberships, and light manufacturing without creating separate products for every trade.",
        "A deterministic workflow layer with explicit states, idempotency, retry/backoff, dead-letter handling, approvals, audit evidence, and rollback boundaries; model-driven agents may plan, extract, summarize, rank, and propose but do not bypass business authorization.",
        "Organization-scoped RAG over current business records and approved documents with ACL propagation, provenance, source citations, freshness labels, retrieval telemetry, and no cross-tenant memory.",
        "Cash-flow and operating-health snapshots using posted business records, with no accounting or tax claims.",
        "Security checks covering account access, staff permissions, payment limits, backups, passkeys/step-up authentication, and how to recover.",
        "Import and export paths that reduce switching friction and preserve customer ownership.",
        "Provider-neutral adapters for payments/POS, accounting, payroll, calendars, maps, telematics, messaging, tax, ecommerce, identity, and analytics so regulated or commodity infrastructure stays outside SONARA's source of truth."
      ],
      operatingLoops: Object.freeze([
        "lead_to_customer",
        "offer_or_catalog_to_quote_or_order",
        "quote_or_order_to_booking_job_or_fulfillment",
        "fulfillment_to_invoice_or_payment",
        "payment_to_reconciliation_and_reporting",
        "inventory_to_procurement_and_reorder",
        "schedule_to_time_and_labor_cost",
        "customer_outcome_to_review_retention_and_follow_up"
      ]),
      architecturePriorities: Object.freeze([
        "shared_business_primitives_before_vertical_forks",
        "deterministic_state_machine_for_money_permissions_and_fulfillment",
        "bounded_agents_above_deterministic_tools_not_instead_of_them",
        "durable_workflows_for_long_running_retries_human_waits_and_compensation",
        "tenant_scoped_rag_with_acl_provenance_freshness_and_evaluation",
        "provider_adapter_boundary_for_regulated_and_fast_changing_external_services",
        "event_and_observability_contract_shared_across_business_builder_modules",
        "mobile_accessibility_offline_and_field_work_as_first_class_constraints"
      ]),
      agentAndWorkflowPolicy: Object.freeze({
        modelMay: Object.freeze(["classify", "extract", "summarize", "draft", "rank", "plan", "recommend_next_step"]),
        deterministicRequired: Object.freeze(["authorization", "entitlement", "money_math", "inventory_mutation", "booking_state", "job_state", "invoice_state", "payment_state", "refund_state", "ledger_or_audit_write"]),
        approvalRequired: Object.freeze(["outbound_customer_message", "refund", "payout", "destructive_change", "publication", "high_impact_permission_change", "external_purchase"]),
        executionRule: "A model may propose an action, but a tenant-scoped deterministic command validates authority, schema, idempotency, budget, approval state, and evidence before any mutation."
      }),
      ragPolicy: Object.freeze({
        sourceOfTruth: "organization-scoped operational records and explicitly approved documents",
        required: Object.freeze(["tenant_filter", "document_acl", "provenance", "source_citation", "freshness", "retrieval_trace", "evaluation"]),
        prohibited: Object.freeze(["cross_tenant_retrieval", "secret_indexing", "unbounded_raw_payload_capture", "silent_write_back_from_generation"])
      }),
      avoid: [
        "Trying to match Square, Shopify, Wix, QuickBooks, or HoneyBook feature-for-feature before SONARA's core workflows are complete.",
        "Unlimited hands-on support or costly provider usage inside low-price plans.",
        "Public claims that SONARA replaces legal, tax, payroll, banking, or licensed accounting professionals."
      ]
    }),
    creator_studio: Object.freeze({
      name: "Creator operations and monetization infrastructure",
      primaryAudience: "Independent musicians, video creators, designers, podcasters, creator-led businesses, collaborators, and small labels or teams.",
      marketSignals: [
        "Creator advertising is a core media channel, while measurement, standards, creator selection, audience authenticity, and business-outcome reporting remain major market gaps.",
        "Creators want stronger direct relationships with fans, sustainable businesses, and control over their work and audience.",
        "General-purpose creation is dominated by large design and media suites, while membership platforms can charge percentage-based platform fees in addition to payment processing.",
        "A defensible SONARA position is workflow ownership, rights evidence, provenance, portable assets, release operations, collaboration, and creator-to-campaign measurement rather than raw generation alone."
      ],
      priorities: [
        "Rights, consent, provenance, originality, collaborator roles, and source-reference records attached to every release package.",
        "Portable creator asset and release packages that can be exported to a DAW, distributor, client, brand partner, or archive.",
        "Direct-fan and buyer records owned by the creator, with consent status and export controls.",
        "Brand partnership briefs, deliverables, proof of approval, whether your disclosures are in order, and the handoff of results to Growth Studio.",
        "Human-controlled generation workflows where external models remain optional adapters and outputs retain provider and provenance metadata."
      ],
      avoid: [
        "Competing primarily on template volume or generic image generation against Canva and Adobe.",
        "Implying guaranteed streams, audience growth, sponsorship revenue, copyright clearance, or distribution acceptance.",
        "Identity imitation, undisclosed sponsorships, or generation without rights and consent attestations."
      ]
    }),
    growth_studio: Object.freeze({
      name: "Customers, follow-up marketing, and measuring what works",
      primaryAudience: "Small businesses, creator-led brands, consultants, local operators, and small growth teams that need governed campaigns and usable measurement.",
      marketSignals: [
        "Digital advertising and creator advertising continue to grow, but fragmented journeys and weak measurement make it difficult to connect spend to business outcomes.",
        "First-party data, consented signals, offline conversions, cross-channel measurement, and incrementality testing are becoming more important.",
        "Entry-level CRM and email tools can be inexpensive or free, while advanced automation, attribution, governance, and onboarding often become expensive.",
        "SONARA's opportunity is the gap between basic sending tools and enterprise marketing operations: consent, evidence, attribution confidence, experiments, approvals, and cross-studio context."
      ],
      priorities: [
        "One consent ledger and first-party customer timeline shared with Business Builder and Creator Studio.",
        "Server-controlled touchpoints, offline conversions, deduplication, source freshness, attribution model, and confidence evidence.",
        "Experiment and incrementality planning that separates correlation from verified lift.",
        "Creator partnership measurement, audience-fit evidence, disclosure checks, deliverable approvals, and conversion handoff.",
        "Answer-engine visibility tracking as an evidence workflow, without claiming guaranteed placement in search or AI answers.",
        "Provider diagnostics and human approval before messaging, publishing, advertising changes, or budget mutations."
      ],
      avoid: [
        "Competing as a high-volume email or SMS sender before provider approvals, deliverability controls, consent, and suppression handling are complete.",
        "Presenting last-click attribution as certainty or using modeled results without confidence and freshness labels.",
        "Autonomous ad spending, publishing, or customer messaging without explicit authorization."
      ]
    })
  }),
  pricingPosition: Object.freeze({
    currentPlans: ["Free $0", "One workspace $29/month", "All three $59/month", "Team $109/month", "Business Builder setup: quoted"],
    conclusion: "The canonical 2026 ladder is workspace-based rather than depth-tiered. Preserve the simple breadth choice, but meter cost-bearing provider work instead of promising unlimited advanced usage.",
    packagingPriorities: [
      "Free: prove value with real core tools and saved work across the three studios without a card.",
      "One workspace $29/month: one complete Business Builder, Creator Studio, or Growth Studio workspace selected by the customer.",
      "All three $59/month: all three workspaces under one organization, login, entitlement model, and bill.",
      "Team $109/month: all three workspaces plus the staff portal and workforce operating surfaces.",
      "Annual twins remain ten months of the matching monthly plan when configured; the setup package remains quoted rather than silently assigning a fixed checkout price.",
      "Cost-bearing email, SMS, media generation, storage, model/tool execution, and third-party API work must use measurable included usage, customer-supplied accounts, or separately priced credits/usage."
    ]
  }),
  scoring: Object.freeze({
    positive: Object.freeze({
      demandEvidence: 25,
      willingnessToPay: 20,
      strategicFit: 20,
      underservedNeed: 15,
      differentiation: 10,
      channelAccess: 10
    }),
    penalties: Object.freeze({
      deliveryComplexity: 15,
      complianceRisk: 15
    }),
    bands: Object.freeze([
      Object.freeze({ minimum: 75, recommendation: "prioritize" }),
      Object.freeze({ minimum: 55, recommendation: "validate" }),
      Object.freeze({ minimum: 35, recommendation: "watch" }),
      Object.freeze({ minimum: 0, recommendation: "hold" })
    ])
  }),
  researchAndDevelopment: getMarketRDPriorities(),
  evidenceRules: [
    "Record the source, observed date, geography, segment, confidence, and expiry date for every market signal.",
    "Keep competitor prices and capabilities timestamped because they change frequently.",
    "Separate facts, customer quotes, estimates, assumptions, and internal opinions.",
    "Do not advance an opportunity to build only because the total market is large; require reachable customers, urgency, willingness to pay, and a differentiated workflow.",
    "Link approved opportunities to roadmap items so the evidence follows the work from first idea through testing, building, early access, launch, and what you learn."
  ],
  sources: Object.freeze([
    Object.freeze({ key: "sba_small_business_2026", publisher: "U.S. Small Business Administration Office of Advocacy", title: "Frequently Asked Questions About Small Business 2026", url: "https://advocacy.sba.gov/2026/02/03/frequently-asked-questions-about-small-business-2026/", observedAt: "2026-02-03" }),
    Object.freeze({ key: "census_nonemployer_2026", publisher: "U.S. Census Bureau", title: "Census Bureau Provides Resources, Data Tools, Website for Small Businesses", url: "https://www.census.gov/library/stories/2026/05/small-business-week.html", observedAt: "2026-05-04" }),
    Object.freeze({ key: "census_ai_2026", publisher: "U.S. Census Bureau", title: "Large Firms With at Least 20 Employees Biggest AI Users", url: "https://www.census.gov/library/stories/2026/05/ai-use-businesses.html", observedAt: "2026-05-26" }),
    Object.freeze({ key: "verizon_smb_2025", publisher: "Verizon Business", title: "2025 State of Small Business Survey", url: "https://www.verizon.com/about/news/2025-state-small-business-survey", observedAt: "2025-05-20" }),
    Object.freeze({ key: "iab_creator_2025", publisher: "Interactive Advertising Bureau", title: "2025 Creator Economy Ad Spend & Strategy Report", url: "https://www.iab.com/insights/2025-creator-economy-ad-spend-strategy-report/", observedAt: "2025-11-20" }),
    Object.freeze({ key: "iab_creator_measurement_2026", publisher: "Interactive Advertising Bureau", title: "The As-Is Measurement Landscape in the Creator Economy", url: "https://www.iab.com/guidelines/creator-economy-as-is-measurement-landscape/", observedAt: "2026-01-29" }),
    Object.freeze({ key: "patreon_state_of_create_2025", publisher: "Patreon", title: "State of Create 2025", url: "https://stateofcreate.co/", observedAt: "2025-01-01" }),
    Object.freeze({ key: "ftc_endorsements", publisher: "Federal Trade Commission", title: "Endorsements, Influencers, and Reviews", url: "https://www.ftc.gov/business-guidance/advertising-marketing/endorsements-influencers-reviews", observedAt: "2026-07-25" }),
    Object.freeze({ key: "google_measurement_2025", publisher: "Google", title: "Get more from your ads with the latest AI measurement tools", url: "https://blog.google/products/ads-commerce/google-ai-ad-campaign-measurement-update/", observedAt: "2025-05-21" }),
    Object.freeze({ key: "google_data_manager_2025", publisher: "Google", title: "Data Manager API helps advertisers improve measurement", url: "https://blog.google/products/ads-commerce/data-manager-api-helps-advertisers-improve-measurement-and-get-better-results-from-google-ai/", observedAt: "2025-12-09" }),
    Object.freeze({ key: "odoo_suite_2026", publisher: "Odoo", title: "Odoo business applications", url: "https://www.odoo.com/page/all-apps", observedAt: "2026-09-22" }),
    Object.freeze({ key: "zoho_one_2026", publisher: "Zoho", title: "Zoho One unified business system", url: "https://www.zoho.com/one/", observedAt: "2026-09-22" }),
    Object.freeze({ key: "dynamics_business_central_2026", publisher: "Microsoft", title: "Dynamics 365 Business Central", url: "https://www.microsoft.com/en-us/dynamics-365/products/business-central", observedAt: "2026-09-22" }),
    Object.freeze({ key: "hubspot_crm_2026", publisher: "HubSpot", title: "HubSpot CRM", url: "https://www.hubspot.com/products/crm", observedAt: "2026-09-22" }),
    Object.freeze({ key: "square_business_2026", publisher: "Square", title: "Square business software and payments", url: "https://squareup.com/us/en", observedAt: "2026-09-22" }),
    Object.freeze({ key: "toast_restaurant_2026", publisher: "Toast", title: "Toast restaurant platform", url: "https://pos.toasttab.com/", observedAt: "2026-09-22" }),
    Object.freeze({ key: "servicetitan_platform_2026", publisher: "ServiceTitan", title: "ServiceTitan trades platform", url: "https://www.servicetitan.com/", observedAt: "2026-09-22" }),
    Object.freeze({ key: "stripe_platform_stack_2026", publisher: "Stripe", title: "Stripe Connect, Billing, Terminal, Tax and Radar", url: "https://docs.stripe.com/connect", observedAt: "2026-09-22" }),
    Object.freeze({ key: "temporal_durable_execution_2026", publisher: "Temporal", title: "Temporal durable execution", url: "https://docs.temporal.io/", observedAt: "2026-09-22" }),
    Object.freeze({ key: "langgraph_durable_agents_2026", publisher: "LangChain", title: "LangGraph overview", url: "https://docs.langchain.com/oss/javascript/langgraph/overview", observedAt: "2026-09-22" }),
    Object.freeze({ key: "openfeature_2026", publisher: "OpenFeature", title: "OpenFeature specification", url: "https://openfeature.dev/", observedAt: "2026-09-22" }),
    Object.freeze({ key: "pgvector_2026", publisher: "pgvector", title: "pgvector", url: "https://github.com/pgvector/pgvector", observedAt: "2026-09-22" })
  ])
});

function getMarketIntelligenceFramework() {
  return JSON.parse(JSON.stringify(MARKET_INTELLIGENCE_FRAMEWORK));
}

function scoreMarketOpportunity(input = {}) {
  const positive =
    clampNumber(read(input, "demandEvidence", "demand_evidence"), 0, 25) +
    clampNumber(read(input, "willingnessToPay", "willingness_to_pay"), 0, 20) +
    clampNumber(read(input, "strategicFit", "strategic_fit"), 0, 20) +
    clampNumber(read(input, "underservedNeed", "underserved_need"), 0, 15) +
    clampNumber(read(input, "differentiation"), 0, 10) +
    clampNumber(read(input, "channelAccess", "channel_access"), 0, 10);
  const penalties =
    clampNumber(read(input, "deliveryComplexity", "delivery_complexity"), 0, 15) +
    clampNumber(read(input, "complianceRisk", "compliance_risk"), 0, 15);
  return Math.max(0, Math.min(100, Math.round(positive - penalties)));
}

function recommendMarketAction(score) {
  const normalized = clampNumber(score, 0, 100);
  return MARKET_INTELLIGENCE_FRAMEWORK.scoring.bands.find((band) => normalized >= band.minimum)?.recommendation || "hold";
}

function read(input, camel, snake) {
  if (input[camel] !== undefined) return input[camel];
  if (snake && input[snake] !== undefined) return input[snake];
  return 0;
}

function clampNumber(value, minimum, maximum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return minimum;
  return Math.max(minimum, Math.min(maximum, numeric));
}

module.exports = {
  MARKET_INTELLIGENCE_FRAMEWORK,
  getMarketIntelligenceFramework,
  scoreMarketOpportunity,
  recommendMarketAction
};
