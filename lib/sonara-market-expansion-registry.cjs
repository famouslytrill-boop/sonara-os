// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Canonical product-expansion intake for the September 2026 market, UX, media,
// vertical-SaaS, field-operations, agentic-commerce, and workflow research.
//
// This is a planning/control-plane registry. A record here does not install a
// provider, create a database table, charge a customer, publish content, send a
// message, start a worker, or claim a production capability exists. Promotion
// into executing product code stays behind the existing SONARA lifecycle,
// provider, approval, tenant, security, cost, and release gates.

const STATUS = Object.freeze({
  LIVE_FOUNDATION: "live_foundation",
  CONDITIONAL: "conditional_on_configured_provider",
  IMPLEMENT_NEXT: "implement_next",
  DESIGN_ONLY: "design_only",
  RESEARCH_ONLY: "research_only",
  PARTNER_INTEGRATION: "partner_integration",
  DO_NOT_REBUILD: "do_not_rebuild"
});

const FORMS = Object.freeze({
  CORE: "core_platform",
  ADD_ON: "add_on",
  VERTICAL: "industry_pack",
  STANDALONE: "standalone_sku",
  DISTRIBUTION: "distribution_channel",
  PARTNER: "partner_integration"
});

const CAPABILITIES = Object.freeze([
  capability({
    key: "governed-agent-runtime",
    name: "Governed Agent Runtime",
    form: FORMS.CORE,
    status: STATUS.LIVE_FOUNDATION,
    targets: ["sonara_one", "business_builder", "creator_studio", "growth_studio"],
    value: "Bound specialized agents to explicit tools, budgets, scopes, approvals, evidence, and audit trails.",
    existing: ["agent authority", "entity agent schema", "agent action logs", "workflow runs", "provider gateway", "durable event outbox", "delivery-attempt evidence", "sanitized model-observation store"],
    next: ["single low-risk outbox consumer", "dead-letter operator view", "approval-linked action runs", "bounded tool registry", "cost ceilings"],
    data: ["entity_agents", "entity_agent_runs", "entity_agent_tool_registry", "entity_action_runs", "entity_action_approvals", "agent_action_logs", "event_outbox", "event_delivery_attempts", "llm_observations", "agent_evaluation_runs"],
    workflow: ["intent", "plan", "tool check", "approval when required", "execute", "evidence", "outcome"],
    ux: ["Nexus command surface", "Approval Center", "activity timeline"]
  }),
  capability({
    key: "durable-workflow-builder",
    name: "Durable Workflow Builder",
    form: FORMS.CORE,
    status: STATUS.IMPLEMENT_NEXT,
    targets: ["sonara_one", "business_builder", "creator_studio", "growth_studio"],
    value: "Reusable trigger/action/approval workflows shared by every product and industry pack.",
    existing: ["workflow_runs", "automation_rules", "entity_automations", "provider jobs"],
    next: ["versioned workflow definitions", "step runs", "retry policy", "delay/wait", "human task steps"],
    data: ["workflow_runs", "automation_rules", "entity_automations", "entity_automation_runs"],
    workflow: ["trigger", "conditions", "actions", "approval", "retry", "result"],
    ux: ["visual workflow editor", "run inspector", "failure repair"]
  }),
  capability({
    key: "mcp-api-gateway",
    name: "MCP and External Agent Gateway",
    form: FORMS.DISTRIBUTION,
    status: STATUS.DESIGN_ONLY,
    targets: ["sonara_one"],
    value: "Expose approved SONARA capabilities to external agents without bypassing tenant, approval, or policy controls.",
    existing: ["integration connections", "provider gateway", "agent tool registry"],
    next: ["read-only MCP resources", "approved tool manifest", "per-tool authorization", "audit evidence"],
    data: ["entity_connectors", "entity_connector_events", "organization_integrations"],
    workflow: ["authenticate", "scope", "discover tools", "invoke", "policy check", "audit"],
    ux: ["integration settings", "tool permission review", "connection activity"]
  }),
  capability({
    key: "embedded-commerce",
    name: "Embedded Commerce and Connected Payments",
    form: FORMS.CORE,
    status: STATUS.CONDITIONAL,
    targets: ["business_builder", "creator_studio"],
    value: "Connect catalog, checkout, invoices, subscriptions, connected accounts, payments, and entitlement state.",
    existing: ["Stripe checkout", "Stripe webhooks", "billing", "connected payment accounts", "merchant products"],
    next: ["usage metering", "connected-account onboarding evidence", "transaction-margin reporting", "seller payout visibility"],
    data: ["merchant_products", "merchant_product_variants", "payments", "subscriptions", "organization_entitlements", "business_payment_accounts"],
    workflow: ["catalog", "price", "checkout", "provider confirmation", "entitlement", "receipt"],
    ux: ["commerce dashboard", "payment readiness", "money movement timeline"]
  }),
  capability({
    key: "usage-metering",
    name: "Usage and Credit Metering",
    form: FORMS.CORE,
    status: STATUS.LIVE_FOUNDATION,
    targets: ["sonara_one"],
    value: "Track bounded paid usage for provider-backed generation, voice, messaging, and premium workflows.",
    existing: ["usage_credit_ledger", "generation cost events", "billing entitlements"],
    next: ["capability meters", "budget notifications", "organization-level ceilings", "provider reconciliation"],
    data: ["usage_credit_ledger", "generation_cost_events", "billing_entitlements"],
    workflow: ["estimate", "authorize", "consume", "reconcile", "report"],
    ux: ["usage meter", "budget controls", "cost evidence"]
  }),
  capability({
    key: "interactive-media-studio",
    name: "Interactive Media, Community, and Design Studio",
    form: FORMS.ADD_ON,
    status: STATUS.IMPLEMENT_NEXT,
    targets: ["creator_studio", "growth_studio", "business_builder"],
    value: "Unify rights-aware images, video, audio, profiles, calls, private community/client review, layout, motion, interactive components, and export around editable project state.",
    existing: ["creator assets", "creator profiles and follows", "browser calls", "notifications", "generation lifecycle", "scroll sites", "video treatments", "brand governance"],
    next: ["private creator/client spaces", "moderated review threads", "scheduled live rooms", "design document contract", "component tree", "timeline", "responsive rules", "approval/export states"],
    data: ["creator_assets", "creator_artist_profiles", "creator_follows", "call_sessions", "call_signals", "user_notifications", "creator_video_treatments", "scroll_sites", "generation_jobs", "generation_artifacts"],
    workflow: ["brief", "rights check", "compose or convene", "generate/import/call", "review", "moderate", "approve", "export/publish"],
    ux: ["business-oriented canvas", "private space", "client review room", "call room", "asset rail", "timeline", "responsive preview"]
  }),
  capability({
    key: "website-experience-builder",
    name: "Website Experience Builder",
    form: FORMS.ADD_ON,
    status: STATUS.IMPLEMENT_NEXT,
    targets: ["business_builder", "creator_studio"],
    value: "Create a business or creator web experience tied to real offers, bookings, catalog, intake, and analytics.",
    existing: ["public booking pages", "lead capture pages", "scroll sites", "business sub-app schema"],
    next: ["editable page document", "business data bindings", "component templates", "preview", "versioned publication"],
    data: ["public_booking_pages", "lead_capture_pages", "scroll_sites", "business_sub_apps", "business_sub_app_pages"],
    workflow: ["business brief", "structure", "content", "bind data", "review", "publish", "measure"],
    ux: ["guided site builder", "device preview", "publish checklist"]
  }),
  capability({
    key: "interactive-business-widgets",
    name: "Interactive Business Widgets",
    form: FORMS.ADD_ON,
    status: STATUS.DESIGN_ONLY,
    targets: ["business_builder", "growth_studio", "creator_studio"],
    value: "Reusable calculators, quote estimators, quizzes, forms, booking widgets, galleries, pricing tools, and configurators.",
    existing: ["formula engine", "lead capture", "booking", "shared links"],
    next: ["widget manifest", "safe embed contract", "data binding", "analytics events"],
    data: ["sonara_formula_definitions", "lead_capture_pages", "shared_links"],
    workflow: ["choose template", "configure", "preview", "publish/embed", "measure"],
    ux: ["template gallery", "visual configuration", "embed preview"]
  }),
  capability({
    key: "local-ai-visibility",
    name: "Local and AI Visibility",
    form: FORMS.ADD_ON,
    status: STATUS.IMPLEMENT_NEXT,
    targets: ["growth_studio", "business_builder"],
    value: "Measure and improve business discoverability across owned pages, listings, reviews, structured data, and AI-assisted discovery surfaces.",
    existing: ["market intelligence", "growth campaigns", "reviews", "business locations"],
    next: ["visibility source registry", "listing snapshots", "citation evidence", "structured-data checks", "competitor comparison"],
    data: ["market_intelligence_signals", "market_intelligence_competitors", "reviews", "business_locations"],
    workflow: ["scan", "evidence", "recommend", "approve", "apply", "rescan", "measure"],
    ux: ["visibility scorecard", "issue queue", "evidence diff"]
  }),
  capability({
    key: "reputation-manager",
    name: "Reputation Manager",
    form: FORMS.ADD_ON,
    status: STATUS.IMPLEMENT_NEXT,
    targets: ["growth_studio", "business_builder"],
    value: "Centralize reviews, response drafting, escalation, review requests, and service-recovery evidence.",
    existing: ["reviews", "growth consent", "customer records"],
    next: ["review source adapters", "response approval flow", "request policy", "negative-review escalation"],
    data: ["reviews", "growth_contact_consents", "customer_records"],
    workflow: ["ingest", "classify", "draft", "approve", "respond", "follow up"],
    ux: ["review inbox", "approval drawer", "location comparison"]
  }),
  capability({
    key: "voice-receptionist",
    name: "Voice Receptionist",
    form: FORMS.ADD_ON,
    status: STATUS.CONDITIONAL,
    targets: ["business_builder", "growth_studio"],
    value: "Answer inbound business calls, resolve allowed questions, qualify leads, book appointments, and transfer to humans.",
    existing: ["call sessions", "phone records", "bookings", "lead conversations", "voice permissions"],
    next: ["telephony provider adapter", "business knowledge policy", "call consent/recording controls", "transfer and fallback"],
    data: ["call_sessions", "phone_number_records", "bookings", "lead_conversations", "communication_preferences"],
    workflow: ["call", "identify intent", "knowledge check", "answer/qualify", "book/transfer", "CRM update"],
    ux: ["call inbox", "transcript/evidence", "availability and handoff settings"]
  }),
  capability({
    key: "unified-conversation-inbox",
    name: "Unified Conversation Inbox",
    form: FORMS.CORE,
    status: STATUS.IMPLEMENT_NEXT,
    targets: ["business_builder", "growth_studio", "creator_studio"],
    value: "Present customer conversations across supported channels as one chronological record.",
    existing: ["lead conversations", "call sessions", "notifications", "contact records"],
    next: ["channel-normalized conversation projection", "thread participants", "assignment", "SLA/response state"],
    data: ["lead_conversations", "call_sessions", "contact_records", "user_notifications"],
    workflow: ["ingest", "normalize", "assign", "respond", "resolve", "measure"],
    ux: ["conversation list", "record drawer", "customer timeline"]
  }),
  capability({
    key: "lead-intelligence",
    name: "Lead Intelligence and Follow-Up",
    form: FORMS.ADD_ON,
    status: STATUS.LIVE_FOUNDATION,
    targets: ["growth_studio", "business_builder"],
    value: "Capture, score, route, follow up, book, and measure leads under consent-safe controls.",
    existing: ["growth leads", "lead scoring", "routing rules", "followups", "conversions"],
    next: ["enrichment adapters", "explainable scoring evidence", "multi-channel response planning"],
    data: ["growth_leads", "lead_routing_rules", "growth_touchpoints", "growth_conversions"],
    workflow: ["capture", "enrich", "score", "route", "draft", "approve/send", "book", "convert"],
    ux: ["pipeline", "next-best-action", "follow-up queue"]
  }),
  capability({
    key: "creator-commerce",
    name: "Creator Commerce",
    form: FORMS.ADD_ON,
    status: STATUS.IMPLEMENT_NEXT,
    targets: ["creator_studio"],
    value: "Connect creative assets and releases to digital products, services, memberships, licensing, and customer records.",
    existing: ["creator monetization", "creator offers", "merchant products", "release packages"],
    next: ["digital delivery entitlement", "membership product type", "license record", "fan/customer purchase timeline"],
    data: ["creator_releases", "creator_assets", "merchant_products", "payments", "organization_entitlements"],
    workflow: ["create", "package", "price", "publish", "sell", "deliver", "retain"],
    ux: ["product builder", "release-to-product action", "sales timeline"]
  }),
  capability({
    key: "field-mode",
    name: "Mobile Field Mode",
    form: FORMS.VERTICAL,
    status: STATUS.DESIGN_ONLY,
    targets: ["business_builder"],
    value: "Large-touch mobile workflows for service work, photos, signatures, estimates, payments, and queued synchronization.",
    existing: ["PWA shell", "appointments", "assets", "quotes", "payments", "location events"],
    next: ["offline mutation queue", "conflict policy", "camera/signature input", "job-focused mobile shell"],
    data: ["business_appointments", "business_assets", "quotes", "payments", "location_events"],
    workflow: ["job", "capture", "estimate", "approve", "work", "pay", "review", "sync"],
    ux: ["large touch targets", "one-job context", "offline/sync state"]
  }),
  capability({
    key: "qr-physical-digital-bridge",
    name: "QR Physical-Digital Bridge",
    form: FORMS.ADD_ON,
    status: STATUS.DESIGN_ONLY,
    targets: ["business_builder", "creator_studio", "growth_studio"],
    value: "Resolve controlled QR links to menus, products, jobs, invoices, booking pages, review requests, events, and creator releases.",
    existing: ["shared links", "public booking pages", "merchant products"],
    next: ["typed QR resource registry", "expiry/revocation", "scan analytics", "public activation approval"],
    data: ["shared_links", "public_booking_pages", "merchant_products"],
    workflow: ["choose target", "generate", "approve", "activate", "scan", "measure/revoke"],
    ux: ["QR creator", "target preview", "scan activity"]
  }),
  capability({
    key: "kiosk-mode",
    name: "Kiosk and Check-In Mode",
    form: FORMS.VERTICAL,
    status: STATUS.DESIGN_ONLY,
    targets: ["business_builder"],
    value: "Bound self-service ordering, appointment check-in, event check-in, or form completion on shared devices.",
    existing: ["PWA", "orders", "bookings", "payments", "public forms"],
    next: ["device session isolation", "restricted kiosk route", "offline-safe queue", "operator unlock"],
    data: ["order_records", "bookings", "payments"],
    workflow: ["start session", "identify/choose", "confirm", "pay/check in", "receipt", "reset session"],
    ux: ["full-screen kiosk", "accessible touch UI", "operator status"]
  }),
  capability({
    key: "restaurant-operations-pack",
    name: "Restaurant Operations Pack",
    form: FORMS.VERTICAL,
    status: STATUS.LIVE_FOUNDATION,
    targets: ["business_builder"],
    value: "Restaurant costing, recipes, inventory, vendors, waste, staff, sales, and daily margin operations.",
    existing: ["menu", "recipes", "ingredients", "inventory", "vendors", "waste", "POS summaries", "staff/time"],
    next: ["prep lists", "par levels", "purchase suggestions", "vendor price history", "menu engineering", "daily manager report"],
    data: ["menu_items", "recipe_cards", "recipe_ingredients", "inventory_items", "waste_logs", "vendor_accounts", "pos_sales_summaries"],
    workflow: ["menu", "recipe", "inventory", "purchase", "sell", "waste", "margin review"],
    ux: ["daily ops", "food-cost dashboard", "prep/purchase actions"]
  }),
  capability({
    key: "home-services-pack",
    name: "Home and Field Services Pack",
    form: FORMS.VERTICAL,
    status: STATUS.IMPLEMENT_NEXT,
    targets: ["business_builder", "growth_studio"],
    value: "Lead-to-job workflow for mobile service companies such as HVAC, plumbing, cleaning, detailing, landscaping, and contractors.",
    existing: ["leads", "appointments", "quotes", "services", "payments", "reviews", "vehicles/routes"],
    next: ["work order projection", "dispatch board", "field mode", "maintenance recurrence", "material usage"],
    data: ["growth_leads", "business_appointments", "quotes", "business_service_items", "payments", "reviews", "vehicle_records"],
    workflow: ["lead", "book", "dispatch", "estimate", "approve", "work", "invoice", "pay", "review"],
    ux: ["dispatch board", "job card", "technician field mode"]
  }),
  capability({
    key: "beauty-wellness-pack",
    name: "Beauty and Wellness Pack",
    form: FORMS.VERTICAL,
    status: STATUS.IMPLEMENT_NEXT,
    targets: ["business_builder", "growth_studio"],
    value: "Booking, deposits, packages, memberships, staff, customer preferences, rebooking, reviews, and local visibility.",
    existing: ["bookings", "customers", "staff", "payments", "reviews"],
    next: ["package/membership service types", "commission rules", "waitlist", "rebooking workflow"],
    data: ["bookings", "customer_records", "employee_profiles", "payments", "reviews"],
    workflow: ["discover", "book", "deposit", "serve", "pay", "rebook", "review"],
    ux: ["booking calendar", "client profile", "rebooking actions"]
  }),
  capability({
    key: "professional-services-pack",
    name: "Independent Professional Pack",
    form: FORMS.VERTICAL,
    status: STATUS.IMPLEMENT_NEXT,
    targets: ["business_builder", "creator_studio"],
    value: "Inquiry-through-payment lifecycle for photographers, DJs, designers, consultants, coaches, and freelancers.",
    existing: ["lead capture", "customers", "quotes", "service requests", "deliverables", "invoices/payments"],
    next: ["proposal document", "contract-signature integration", "deposit milestone", "client portal projection"],
    data: ["lead_capture_pages", "customer_records", "quotes", "service_requests", "service_deliverables", "customer_invoices"],
    workflow: ["inquiry", "consultation", "proposal", "approval", "deposit", "project", "deliver", "invoice", "review"],
    ux: ["client pipeline", "project drawer", "portal"]
  }),
  capability({
    key: "agency-reseller-mode",
    name: "Agency and Reseller Mode",
    form: FORMS.STANDALONE,
    status: STATUS.DESIGN_ONLY,
    targets: ["sonara_one", "growth_studio"],
    value: "Provision and manage multiple client organizations with controlled branding, templates, billing, usage, and support boundaries.",
    existing: ["organizations", "memberships", "entitlements", "branding", "integrations"],
    next: ["parent-child organization relation", "client provisioning", "reseller entitlement", "usage rebilling", "white-label policy"],
    data: ["organizations", "organization_memberships", "organization_entitlements", "organization_integrations"],
    workflow: ["create client", "configure pack", "invite", "operate", "meter", "support", "bill"],
    ux: ["client switcher", "provisioning wizard", "portfolio analytics"]
  }),
  capability({
    key: "multi-location-operations",
    name: "Multi-Location Operations",
    form: FORMS.STANDALONE,
    status: STATUS.IMPLEMENT_NEXT,
    targets: ["business_builder", "growth_studio"],
    value: "Location-aware staffing, inventory, reputation, payments, reporting, and operating comparisons.",
    existing: ["business locations", "location transfers", "location events", "inventory", "employees"],
    next: ["location-level permission defaults", "location KPI projection", "cross-location comparison", "location review routing"],
    data: ["business_locations", "location_transfers", "location_events", "inventory_items", "employee_profiles"],
    workflow: ["location setup", "assign staff/resources", "operate", "compare", "transfer", "review"],
    ux: ["location switcher", "comparison dashboard", "transfer workflow"]
  }),
  capability({
    key: "extension-marketplace",
    name: "Extension and Workflow Marketplace",
    form: FORMS.STANDALONE,
    status: STATUS.DESIGN_ONLY,
    targets: ["sonara_one"],
    value: "Install reviewed workflows, templates, connectors, industry packs, widgets, and agent skills without granting automatic runtime authority.",
    existing: ["catalogs", "entitlements", "open-source review", "product catalog"],
    next: ["extension manifest", "publisher review", "versioning", "installation records", "entitlement", "rollback"],
    data: ["products", "organization_entitlements", "open_source_tools", "tool_reviews"],
    workflow: ["submit", "review", "approve", "list", "install", "configure", "upgrade/rollback"],
    ux: ["marketplace catalog", "permissions before install", "installed extensions"]
  }),
  capability({
    key: "agentic-commerce-distribution",
    name: "Agentic Commerce Distribution",
    form: FORMS.DISTRIBUTION,
    status: STATUS.RESEARCH_ONLY,
    targets: ["business_builder", "creator_studio"],
    value: "Make approved structured catalogs, services, availability, policies, and checkout actions discoverable to external commerce agents.",
    existing: ["merchant catalog", "service catalog", "bookings", "connected payments"],
    next: ["portable catalog contract", "external-agent policy", "availability projection", "transaction approval boundaries"],
    data: ["merchant_products", "business_service_catalog", "bookings", "business_payment_accounts"],
    workflow: ["discover", "qualify", "select", "confirm policy", "checkout/book", "receipt"],
    ux: ["distribution settings", "catalog eligibility", "external transaction log"]
  }),
  capability({
    key: "three-dimensional-experiences",
    name: "Interactive 3D Experiences",
    form: FORMS.ADD_ON,
    status: STATUS.RESEARCH_ONLY,
    targets: ["creator_studio", "business_builder"],
    value: "Optional interactive scenes for products, showrooms, events, creative worlds, and configurators.",
    existing: ["interactive-media research", "React Three Fiber research", "Creator visual-world concepts"],
    next: ["scene asset contract", "runtime budget", "accessibility fallback", "embed security"],
    data: ["creator_assets", "generation_artifacts"],
    workflow: ["scene brief", "assets", "compose", "interact", "review", "embed/export"],
    ux: ["scene preview", "object inspector", "fallback image/content"]
  }),
  capability({
    key: "payroll-tax-banking-rails",
    name: "Payroll, Tax, Banking, Lending, and Insurance Rails",
    form: FORMS.PARTNER,
    status: STATUS.DO_NOT_REBUILD,
    targets: ["business_builder"],
    value: "Keep SONARA as the workflow/control layer while regulated financial rails remain with reviewed providers.",
    existing: ["payroll export prep", "accounting exports", "connected payments"],
    next: ["provider selection", "least-privilege integrations", "readiness/evidence", "human approval"],
    data: ["accounting_exports", "employee_pay_statements", "business_payment_accounts"],
    workflow: ["prepare", "review", "send to provider", "provider executes", "sync evidence"],
    ux: ["provider connection", "export/reconciliation", "setup required"]
  })
]);

const INDUSTRY_PACKS = Object.freeze([
  pack("restaurant", "Restaurant Operations", "business_builder", "live_foundation", ["menu", "recipes", "inventory", "vendors", "waste", "staff", "sales"]),
  pack("home_services", "Home and Field Services", "business_builder", "implement_next", ["lead", "booking", "dispatch", "estimate", "job", "payment", "review"]),
  pack("beauty_wellness", "Beauty and Wellness", "business_builder", "implement_next", ["booking", "deposit", "packages", "membership", "staff", "rebook", "reviews"]),
  pack("independent_professional", "Independent Professional", "business_builder", "implement_next", ["inquiry", "proposal", "approval", "deposit", "project", "deliverable", "payment"]),
  pack("creator_business", "Creator Business", "creator_studio", "live_foundation", ["project", "asset", "release", "audience", "product", "sale", "rights"]),
  pack("agency_reseller", "Agency and Reseller", "sonara_one", "design_only", ["client organizations", "branding", "templates", "usage", "support", "rebilling"]),
  pack("multi_location", "Multi-Location", "business_builder", "implement_next", ["locations", "staff", "inventory", "reputation", "payments", "comparisons"])
]);

const STANDALONE_SKUS = Object.freeze([
  standalone("sonara_voice", "SONARA Voice", "Voice receptionist and communication automation", "conditional_on_configured_provider"),
  standalone("sonara_local", "SONARA Local", "Listings, reviews, local visibility, and AI-discovery evidence", "implement_next"),
  standalone("sonara_field", "SONARA Field", "Mobile field workflow and offline-safe job execution", "design_only"),
  standalone("sonara_commerce", "SONARA Commerce", "Catalog, checkout, invoices, memberships, and connected payments", "live_foundation"),
  standalone("sonara_media", "SONARA Media", "Interactive media, design documents, generation, and export", "implement_next"),
  standalone("sonara_agency", "SONARA Agency", "White-label/reseller and client-organization operations", "design_only")
]);

const SHARED_UX_PATTERNS = Object.freeze([
  "Outcome-first Nexus home",
  "Global command palette",
  "Universal record drawer",
  "Approval Center",
  "Activity timeline",
  "Progressive disclosure",
  "Visible setup/sync/error state",
  "Undo or explicit rollback for reversible changes",
  "Draft-before-send for sensitive outbound actions",
  "Mobile large-touch field surfaces",
  "Reduced-motion and keyboard accessibility",
  "No dead buttons or fictional success states"
]);

const IMPLEMENTATION_SEQUENCE = Object.freeze([
  "Keep release and tenant-security gates green.",
  "Complete durable generation persistence and provider-neutral lifecycle.",
  "Version workflow definitions and approval-linked execution.",
  "Add usage metering and commerce reconciliation.",
  "Build Local Visibility, Reputation, Lead Intelligence, and Voice as bounded add-ons.",
  "Add editable media/design document contracts before adding more generators.",
  "Ship field/offline/QR primitives before vertical field-service promises.",
  "Promote Restaurant, Home Services, Independent Professional, Beauty/Wellness, and Multi-Location packs from shared primitives.",
  "Add agency/reseller controls only after parent-child tenant and rebilling policies are proven.",
  "Expose MCP/agentic-commerce distribution only through explicit tool/catalog allowlists and audited policy checks.",
  "Open an extension marketplace only after publisher review, entitlement, versioning, install permissions, rollback, and payout policy exist."
]);

function getMarketExpansionRegistry() {
  const capabilities = CAPABILITIES.map(clone);
  const byStatus = countBy(capabilities, "status");
  const byForm = countBy(capabilities, "form");
  return {
    version: "2026-09-16",
    sourceWindow: "2026-09-14_through_2026-09-16_chat_and_market_convergence",
    authority: "planning_and_control_plane_only_unless_existing_is_explicitly_listed",
    rules: [
      "Existing implementation must be separated from planned or provider-dependent capability.",
      "Research, screenshots, chats, repositories, and vendor examples do not grant execution authority.",
      "Sensitive outbound, billing, payout, destructive, legal/policy, security, and publication actions remain owner-approval gated.",
      "Reuse existing SONARA tables and workflows before creating duplicate data models.",
      "Own business workflow and customer experience; integrate commodity or regulated infrastructure.",
      "All tenant-owned state remains organization scoped and server-side secrets never become client data."
    ],
    counts: {
      capabilities: capabilities.length,
      industryPacks: INDUSTRY_PACKS.length,
      standaloneSkus: STANDALONE_SKUS.length,
      byStatus,
      byForm
    },
    capabilities,
    industryPacks: INDUSTRY_PACKS.map(clone),
    standaloneSkus: STANDALONE_SKUS.map(clone),
    sharedUxPatterns: [...SHARED_UX_PATTERNS],
    implementationSequence: [...IMPLEMENTATION_SEQUENCE]
  };
}

function capability(input) {
  return Object.freeze({
    key: input.key,
    name: input.name,
    form: input.form,
    status: input.status,
    targets: Object.freeze([...(input.targets || [])]),
    value: input.value,
    existing: Object.freeze([...(input.existing || [])]),
    next: Object.freeze([...(input.next || [])]),
    data: Object.freeze([...(input.data || [])]),
    workflow: Object.freeze([...(input.workflow || [])]),
    ux: Object.freeze([...(input.ux || [])])
  });
}

function pack(key, name, product, status, workflow) {
  return Object.freeze({ key, name, product, status, workflow: Object.freeze([...workflow]) });
}

function standalone(key, name, purpose, status) {
  return Object.freeze({ key, name, purpose, status });
}

function countBy(records, property) {
  const counts = {};
  for (const record of records) counts[record[property]] = (counts[record[property]] || 0) + 1;
  return counts;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  STATUS,
  FORMS,
  CAPABILITIES,
  INDUSTRY_PACKS,
  STANDALONE_SKUS,
  SHARED_UX_PATTERNS,
  IMPLEMENTATION_SEQUENCE,
  getMarketExpansionRegistry
};
