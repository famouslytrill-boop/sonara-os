// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Dated external market/technology evidence translated into SONARA-owned product
// strategy. These records are research evidence only. They do not install a
// provider, grant an agent authority, trigger a payment, make an investment
// recommendation, create a production worker, or claim a capability is live.

const MARKET_SNAPSHOT_DATE = "2026-09-20";

const MARKET_SIGNALS_2026 = Object.freeze([
  signal({
    key: "enterprise_ai_adoption",
    domain: "ai",
    asOf: "2026-09-20",
    sourceClass: "independent_research",
    source: "Stanford HAI — 2026 AI Index, Economy",
    sourceUrl: "https://hai.stanford.edu/ai-index/2026-ai-index-report/economy",
    finding: "Stanford reports AI use in at least one business function at 88% of surveyed organizations in 2025, while agent deployment remained in the single digits across nearly all business functions.",
    sonaraUse: "Treat AI as expected infrastructure, but differentiate with governed execution, workflow context, approvals, evidence, and deterministic fallbacks rather than generic chat."
  }),
  signal({
    key: "agent_scaling_gap",
    domain: "agents",
    asOf: "2026-08-25",
    sourceClass: "independent_survey",
    source: "McKinsey — The state of AI in 2026",
    sourceUrl: "https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai",
    finding: "McKinsey reports 40% of respondents from organizations above $1B revenue are scaling AI agents versus 22% at smaller organizations; 32% report forgoing at least one software purchase because agentic coding tools could build the capability internally.",
    sonaraUse: "Aim the product at organizations that need agentic capability without an internal platform team: pre-integrated workflows, bounded tools, tenant isolation, evaluation, and low-code composition."
  }),
  signal({
    key: "trades_ai_adoption_gap",
    domain: "field_services",
    asOf: "2026-09-20",
    sourceClass: "vendor_survey",
    source: "ServiceTitan — 2026 State of AI in the Trades",
    sourceUrl: "https://www.servicetitan.com/guides/2026-ai-in-the-trades",
    finding: "In a survey of 1,032 contractors, 12% said AI was embedded in operations and 34% were experimenting; training and integration complexity were each cited by 44% as barriers.",
    sonaraUse: "Prioritize simple field workflows, guided onboarding, embedded automation, explainable next actions, and integrations over a separate AI destination."
  }),
  signal({
    key: "restaurant_grounded_ai",
    domain: "restaurant",
    asOf: "2026-06-11",
    sourceClass: "vendor_platform_data",
    source: "Toast — Q1 2026 Restaurant Trends",
    sourceUrl: "https://pos.toasttab.com/blog/data/q1-2026-restaurant-ai-pos-trends",
    finding: "Toast reports approximately 171,000 platform locations as of March 31, 2026 and analyzed AI-assistant usage across more than 125,000 U.S. restaurant locations; frequent operator topics included sales, menu/inventory, guest/marketing, menu optimization, and labor.",
    sonaraUse: "Restaurant intelligence should be grounded in real menu, recipe, inventory, labor, sales, waste, ordering, and guest data and connect insights directly to approved operational actions."
  }),
  signal({
    key: "fleet_predictive_operations",
    domain: "fleet_logistics",
    asOf: "2026-09-20",
    sourceClass: "vendor_platform_data",
    source: "Geotab — 2026 State of Commercial Transportation",
    sourceUrl: "https://www.geotab.com/resources/ebook/state-of-commercial-transportation-2026/",
    finding: "Geotab's report draws on more than 5.8 million connected vehicles and emphasizes predictive safety, maintenance, utilization, electrification, and conversational access to fleet data.",
    sonaraUse: "Build fleet and delivery modules around exception queues, maintenance prediction inputs, route/job context, utilization, driver safety evidence, and partner telematics adapters rather than duplicating vehicle hardware."
  }),
  signal({
    key: "passkeys_mainstream",
    domain: "identity_security",
    asOf: "2026-05-07",
    sourceClass: "standards_body_research",
    source: "FIDO Alliance — State of Passkeys 2026",
    sourceUrl: "https://fidoalliance.org/the-state-of-passkeys-2026-global-consumer-and-workforce-report/",
    finding: "FIDO estimates 5 billion passkeys in active use; its surveys report 75% of consumers enabled passkeys on at least some accounts and 68% of organizations were deploying, piloting, or rolling them out for workforce authentication.",
    sonaraUse: "Keep passkeys/device-bound authentication on the near-term identity roadmap while retaining recovery, step-up authorization, tenant policy, and audit evidence."
  }),
  signal({
    key: "agentic_commerce",
    domain: "payments_commerce",
    asOf: "2026-04-29",
    sourceClass: "provider_announcement",
    source: "Stripe — Sessions 2026",
    sourceUrl: "https://stripe.com/newsroom/news/sessions-2026",
    finding: "Stripe announced agentic commerce features, agent-capable Link wallets, and support for AI-native business models; its Machine Payments Protocol work reflects a broader move toward machine-initiated transactions.",
    sonaraUse: "Make catalog, checkout, usage metering, delegated payment approval, budgets, idempotency, fraud signals, refunds, and reconciliation agent-ready while keeping payment credentials and final authority outside model context."
  }),
  signal({
    key: "web_attention_concentration",
    domain: "distribution",
    asOf: "2026-08-31",
    sourceClass: "traffic_measurement",
    source: "Similarweb — Top 100 Most Visited Websites, August 2026",
    sourceUrl: "https://www.similarweb.com/blog/research/market-research/most-visited-websites/",
    finding: "Similarweb ranked Google, YouTube, Facebook, Instagram, and ChatGPT as the five most-visited websites globally in August 2026.",
    sonaraUse: "Distribution strategy should optimize owned web properties, search/structured data, video/social syndication, and AI-readable product/service information instead of relying on a single acquisition channel."
  }),
  signal({
    key: "games_interactive_market",
    domain: "gaming_interactive_media",
    asOf: "2026-09-15",
    sourceClass: "industry_forecast",
    source: "Newzoo — Global Games Market Report 2026",
    sourceUrl: "https://newzoo.com/articles/executive-summary-ggmr-2026-free-edition",
    finding: "Newzoo forecasts a $213.9B global games market in 2026 with 3.70B players and 1.65B spenders, with mobile remaining the largest revenue platform.",
    sonaraUse: "Reuse game-industry patterns—real-time state, progression, interactive 3D, community, entitlements, telemetry, and low-latency media—without turning SONARA into a general-purpose game engine."
  }),
  signal({
    key: "large_company_technology_weight",
    domain: "market_structure",
    asOf: "2026-08-31",
    sourceClass: "market_index",
    source: "S&P Dow Jones Indices — S&P 500",
    sourceUrl: "https://www.spglobal.com/spdji/en/indices/equity/sp-500/",
    finding: "As of August 31, 2026, information technology represented 37.9% of S&P 500 index weight; the displayed largest constituents included Nvidia, Apple, Microsoft, Amazon, Alphabet, Broadcom, Meta, Micron, and Tesla.",
    sonaraUse: "Study reusable platform economics—compute, distribution, ecosystems, APIs, marketplaces, data flywheels, and capital efficiency—without equating index weight with a product roadmap."
  }),
  signal({
    key: "apple_subscription_state",
    domain: "mobile_billing",
    asOf: "2026-09-20",
    sourceClass: "official_platform_policy",
    source: "Apple Developer — Auto-renewable subscriptions",
    sourceUrl: "https://developer.apple.com/app-store/subscriptions/",
    finding: "Apple directs developers to StoreKit plus App Store Server API and App Store Server Notifications for subscription state, renewal, and billing-event handling.",
    sonaraUse: "Treat mobile subscription status as signed external entitlement evidence that must reconcile to canonical SONARA entitlements; do not infer paid state from the client."
  }),
  signal({
    key: "android_target_api",
    domain: "mobile_distribution",
    asOf: "2026-09-20",
    sourceClass: "official_platform_policy",
    source: "Android Developers — Google Play target API requirements",
    sourceUrl: "https://developer.android.com/google/play/requirements/target-sdk",
    finding: "For the 2026 policy cycle, Google Play requires new apps and updates to target Android 16 / API level 36 or higher after August 31, 2026, subject to documented category exceptions and extension rules.",
    sonaraUse: "Keep the Android packaging gate pinned to current Play policy, verify device behavior separately from CI packaging, and maintain web/control-plane parity."
  }),
  signal({
    key: "managed_agent_harnesses",
    domain: "agents",
    asOf: "2026-09-10",
    sourceClass: "provider_announcement",
    source: "OpenAI — Agents API",
    sourceUrl: "https://openai.com/index/introducing-the-agents-api/",
    finding: "OpenAI's September 2026 Agents API announcement describes long-running agent infrastructure built around a harness that manages context, tools, subagents, files, code execution, and intermediate state.",
    sonaraUse: "Keep SONARA's harness/provider separation: authority, tenant scope, approvals, budgets, verification and evidence remain SONARA-owned even when a managed agent runtime is used."
  }),
  signal({
    key: "cloud_ai_infrastructure_growth",
    domain: "cloud_compute",
    asOf: "2026-07-30",
    sourceClass: "market_research",
    source: "Synergy Research Group — Q2 2026 cloud infrastructure",
    sourceUrl: "https://www.srgresearch.com/articles/q2-cloud-market-passes-143-billion-highest-growth-rate-in-eight-years",
    finding: "Synergy estimates Q2 2026 enterprise cloud-infrastructure service revenue at about $143.4B, up 43% year over year, with AI cited as the primary acceleration driver.",
    sonaraUse: "Use provider-neutral compute/storage contracts, cost observability and workload-based scaling; do not add infrastructure complexity merely because market spending is rising."
  }),
  signal({
    key: "social_commerce_conversion",
    domain: "social_commerce",
    asOf: "2026-01-07",
    sourceClass: "industry_forecast",
    source: "EMARKETER — US Social Commerce Forecast 2026",
    sourceUrl: "https://www.emarketer.com/content/us-social-commerce-forecast-2026",
    finding: "EMARKETER forecasts that 51% of U.S. social buyers will shop on TikTok in 2026 and describes creator-led discovery plus built-in checkout as key social-commerce drivers.",
    sonaraUse: "Connect content calendars, creators, attribution, catalogs and checkout through governed adapters so discovery can become measurable commerce without duplicating source-of-truth product data."
  }),
  signal({
    key: "industrial_robot_growth",
    domain: "manufacturing_robotics",
    asOf: "2026-06-18",
    sourceClass: "industry_federation",
    source: "International Federation of Robotics — U.S. Robot Industry",
    sourceUrl: "https://ifr.org/ifr-press-releases/news/us-robot-industry-returns-to-double-digit-growth",
    finding: "IFR preliminary results report U.S. industrial robot installations rose 11% year over year to 38,000 units in 2025, while food-industry adoption rose 30%.",
    sonaraUse: "Provide work-order, quality, maintenance, asset and telemetry management around industrial systems; keep robot control and machine safety inside specialist hardware/software boundaries."
  }),
  signal({
    key: "real_estate_ai_to_action",
    domain: "real_estate",
    asOf: "2026-03-25",
    sourceClass: "provider_announcement",
    source: "Zillow Group — Zillow AI mode",
    sourceUrl: "https://investors.zillowgroup.com/news-and-events/news/news-details/2026/Zillow-debuts-AI-mode-bringing-guided-intelligence-to-every-step-of-the-housing-journey/default.aspx",
    finding: "Zillow introduced conversational housing search tied to live listings and actions such as tour scheduling and professional connection.",
    sonaraUse: "Use the same general pattern across verticals: conversation over current domain data should resolve into explicit workflow actions, not stop at generated text."
  }),
  signal({
    key: "consumer_agent_app_distribution",
    domain: "mobile_apps",
    asOf: "2026-09-20",
    sourceClass: "app_store_measurement",
    source: "AppBrain — U.S. Google Play Top Free Overall",
    sourceUrl: "https://www.appbrain.com/stats/google-play-rankings/top_free/all/us",
    finding: "On September 20, 2026, AppBrain's U.S. Google Play ranking listed Muse from Meta first and ChatGPT second among top-free overall apps.",
    sonaraUse: "Treat consumer-agent popularity as a distribution signal, not a permanent rank: keep mobile onboarding fast, permission-scoped, action-oriented, and capable of delegating into business workflows."
  }),
  signal({
    key: "ai_spending_infrastructure_acceleration",
    domain: "ai_cloud_compute",
    asOf: "2026-09-16",
    sourceClass: "market_forecast",
    source: "Gartner — Worldwide AI Spending Forecast, September 2026",
    sourceUrl: "https://www.gartner.com/en/newsroom/press-releases/2026-09-16-gartner-forecasts-worldwide-ai-spending-to-grow-49-point-5-percent-in-2026",
    finding: "Gartner forecasts worldwide AI spending at $2.7 trillion in 2026, up 49.5% year over year, with AI infrastructure the largest single spending area.",
    sonaraUse: "Treat compute as a metered platform dependency: route workloads by quality, latency and cost; preserve provider portability; and make capacity, token, GPU and storage economics visible per tenant and workflow."
  }),
  signal({
    key: "workflow_architecture_convergence",
    domain: "enterprise_workflows",
    asOf: "2026-03-02",
    sourceClass: "industry_research",
    source: "Deloitte and ServiceNow — 2026 Workflow Automation Outlook",
    sourceUrl: "https://www.deloitte.com/global/en/alliances/servicenow/about/2026-workflow-automation-outlook.html",
    finding: "The 2026 outlook emphasizes AI-ready architecture, process transformation, governance, autonomous action and business value over feature volume.",
    sonaraUse: "Standardize one governed workflow and event fabric across products so agents, deterministic steps and humans collaborate on measurable outcomes instead of creating isolated automations."
  }),
  signal({
    key: "mobile_monetization_depth",
    domain: "mobile_apps",
    asOf: "2026-01-21",
    sourceClass: "market_measurement",
    source: "Sensor Tower — State of Mobile 2026",
    sourceUrl: "https://sensortower.com/press/press-release-boosted-by-gen-ai-services-consumers-spent-more-money-in-apps-than-games-for-first-time",
    finding: "Sensor Tower reports global mobile in-app purchase revenue reached $167 billion in 2025, up about 10% year over year, while non-game app spending surpassed games for the first time.",
    sonaraUse: "Optimize mobile around retention, recurring value, transparent entitlements and measurable paid outcomes rather than download volume alone; reconcile store receipts into canonical SONARA subscription state."
  }),
  signal({
    key: "retail_agent_assisted_shopping",
    domain: "retail_agentic_commerce",
    asOf: "2026-01-07",
    sourceClass: "industry_consumer_research",
    source: "National Retail Federation and IBM — 2026 Agentic Commerce Consumer Research",
    sourceUrl: "https://nrf.com/research/own-the-agentic-commerce-experience",
    finding: "NRF and IBM report 41% of surveyed consumers use AI assistants for product research, while privacy, misuse and unwanted-marketing concerns remain widespread.",
    sonaraUse: "Make catalogs, availability, pricing, reviews, policies and checkout machine-readable while preserving consent, minimization, provenance and customer control over delegated shopping actions."
  }),
  signal({
    key: "genai_observability_standardization",
    domain: "ai_observability",
    asOf: "2026-05-14",
    sourceClass: "open_standard_guidance",
    source: "OpenTelemetry — GenAI Observability",
    sourceUrl: "https://opentelemetry.io/blog/2026/genai-observability/",
    finding: "OpenTelemetry GenAI semantic conventions standardize telemetry for model operations, token use, tool calls and agent traces, while content capture requires explicit privacy controls.",
    sonaraUse: "Instrument models, tools, retrieval, retries, approvals and business outcomes with correlated traces and cost metrics; keep sensitive prompts, PII and credentials out of telemetry by default."
  }),
  signal({
    key: "agent_security_least_privilege",
    domain: "agent_security",
    asOf: "2026-09-20",
    sourceClass: "security_guidance",
    source: "OWASP — AI Agent Security Cheat Sheet",
    sourceUrl: "https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html",
    finding: "OWASP highlights prompt injection, tool abuse, privilege escalation, exfiltration, memory poisoning, excessive autonomy, approval bypass and denial-of-wallet as agent-specific risks.",
    sonaraUse: "Enforce least-privilege tools, tenant-isolated memory, schema validation, bounded recursion/cost, approval-bound high-impact actions, independent authorization and adversarial regression tests."
  }),
  signal({
    key: "smart_manufacturing_trustworthy_ai",
    domain: "manufacturing_robotics",
    asOf: "2026-07-03",
    sourceClass: "federal_research",
    source: "NIST — 2026 Roadmap on AI and ML for Smart Manufacturing",
    sourceUrl: "https://www.nist.gov/publications/2026-roadmap-artificial-intelligence-and-machine-learning-smart-manufacturing",
    finding: "NIST identifies industrial data, sensing, autonomous systems, digital twins, robotics, supply-chain optimization, explainability, reliability and safety as central smart-manufacturing AI areas.",
    sonaraUse: "Build a management and evidence layer around industrial assets, telemetry, work orders, quality and maintenance while leaving safety-critical machine control inside specialist systems."
  }),
  signal({
    key: "mcp_2026_interoperability",
    domain: "agent_interoperability",
    asOf: "2026-07-28",
    sourceClass: "open_standard",
    source: "Model Context Protocol — 2026-07-28 Specification",
    sourceUrl: "https://blog.modelcontextprotocol.io/posts/2026-07-28/",
    finding: "The 2026 MCP release advances a stateless protocol core, extensions, task lifecycle support, caching and authorization hardening for interoperable agent tools and data.",
    sonaraUse: "Keep a provider-neutral MCP-compatible gateway, but map every tool call into SONARA identity, tenant policy, approvals, idempotency, rate limits, evidence and revocation."
  }),
  signal({
    key: "digital_video_creator_distribution",
    domain: "creator_media_marketing",
    asOf: "2026-05-05",
    sourceClass: "industry_forecast",
    source: "IAB — 2026 Digital Video Ad Spend and Strategy",
    sourceUrl: "https://www.iab.com/news/u-s-digital-video-ad-spend-to-surpass-80b-in-2026/",
    finding: "IAB projects U.S. digital video ad spend above $80 billion in 2026, with social video outpacing connected TV for the first time and AI moving from experimentation toward operations.",
    sonaraUse: "Connect Creator Studio and Growth Studio around reusable assets, rights, audience segments, attribution, campaign evidence and channel adapters so one production workflow can feed multiple distribution surfaces."
  })
]);

const VERTICAL_OPPORTUNITIES = Object.freeze([
  vertical({
    key: "agentic_platform_core",
    label: "Agentic business operating core",
    products: ["SONARA One", "Business Builder", "Creator Studio", "Growth Studio"],
    coverage: ["agents", "LLMs", "RAG", "workflow automation", "deterministic rules", "skills", "memory", "approvals", "analytics"],
    buildVsIntegrate: "build_control_plane_integrate_models",
    next: ["versioned workflow definitions", "bounded tool registry", "evaluation harness", "one low-risk durable consumer", "cost and latency budgets"]
  }),
  vertical({
    key: "small_business_management",
    label: "Small-business management system",
    products: ["Business Builder", "Growth Studio"],
    coverage: ["CRM", "customers", "quotes", "invoices", "scheduling", "calendar", "staff", "timekeeping", "bookkeeping integrations", "customer service", "marketing", "SEO"],
    buildVsIntegrate: "build_workflow_integrate_regulated_rails",
    next: ["unified customer timeline", "daily operations dashboard", "workflow templates", "guided setup", "accounting adapter boundary"]
  }),
  vertical({
    key: "enterprise_management",
    label: "Multi-location and enterprise operations",
    products: ["SONARA One", "Business Builder"],
    coverage: ["organizations", "locations", "role policy", "approvals", "procurement", "analytics", "audit", "multi-entity reporting"],
    buildVsIntegrate: "build_shared_tenant_and_policy_layer",
    next: ["parent-child tenant policy", "location rollups", "delegated administration", "policy inheritance", "enterprise observability"]
  }),
  vertical({
    key: "restaurant_pos_kiosk",
    label: "Restaurant, POS, kiosk, ordering and delivery",
    products: ["Business Builder", "Growth Studio"],
    coverage: ["POS summaries", "menus", "recipes", "inventory", "food cost", "labor", "waste", "kiosk", "ordering", "delivery", "loyalty", "drive-through adapters"],
    buildVsIntegrate: "build_ops_integrate_payment_and_hardware",
    next: ["daily manager report", "menu engineering", "prep/par workflows", "kiosk session isolation", "delivery/POS adapters"]
  }),
  vertical({
    key: "field_services_trades",
    label: "Field services and skilled trades",
    products: ["Business Builder", "Growth Studio"],
    coverage: ["HVAC", "electrical", "plumbing", "carpentry", "cleaning", "construction", "landscaping", "waste services", "job management", "dispatch", "estimates"],
    buildVsIntegrate: "build_job_workflow_integrate_specialist_tools",
    next: ["dispatch board", "work-order projection", "field/offline mode", "material usage", "maintenance recurrence", "photo/signature evidence"]
  }),
  vertical({
    key: "fleet_logistics_delivery",
    label: "Fleet, trucking, logistics and delivery",
    products: ["Business Builder", "SONARA One"],
    coverage: ["vehicles", "drivers", "routes", "delivery", "maintenance", "fuel/energy", "safety", "utilization", "GPS"],
    buildVsIntegrate: "build_operations_integrate_telematics",
    next: ["telematics adapter contract", "route/job projection", "maintenance alerts", "utilization dashboard", "driver safety evidence"]
  }),
  vertical({
    key: "retail_store_ecommerce",
    label: "Retail, store and ecommerce operations",
    products: ["Business Builder", "Growth Studio"],
    coverage: ["catalog", "inventory", "orders", "returns", "subscriptions", "store operations", "omnichannel commerce", "QR", "customer support"],
    buildVsIntegrate: "build_catalog_and_order_orchestration",
    next: ["canonical order state", "returns/refunds workflow", "inventory reservation", "channel adapters", "agent-readable catalog"]
  }),
  vertical({
    key: "payments_fintech",
    label: "Payments, transfer and financial operations",
    products: ["SONARA One", "Business Builder"],
    coverage: ["checkout", "subscriptions", "refunds", "usage metering", "connected accounts", "payout visibility", "banking adapters", "agentic payments", "tokenization", "blockchain and decentralized-ledger adapter research"],
    buildVsIntegrate: "integrate_regulated_rails_build_reconciliation",
    next: ["canonical payment state machine", "provider reconciliation", "delegated spend approvals", "budget ceilings", "signed entitlement evidence"]
  }),
  vertical({
    key: "creator_social_streaming",
    label: "Creator, social, community and streaming",
    products: ["Creator Studio", "Growth Studio"],
    coverage: ["profiles", "media", "social publishing", "moderation", "communities", "live rooms", "streaming", "subscriptions", "fan commerce", "campaigns"],
    buildVsIntegrate: "build_creator_workflow_integrate_distribution",
    next: ["private creator/client spaces", "content calendar", "moderation queue", "rights/provenance", "channel syndication adapters", "commerce linkage"]
  }),
  vertical({
    key: "media_production",
    label: "Video, audio, image, movie, book and podcast production",
    products: ["Creator Studio"],
    coverage: ["video", "audio", "voice", "images", "film", "books", "artists", "podcasts", "recording", "editing", "rendering", "4K/HDR delivery"],
    buildVsIntegrate: "build_project_state_integrate_generation_and_rendering",
    next: ["structured media document", "timeline", "immutable source assets", "rendition pipeline", "caption/transcript workflow", "rights-aware export"]
  }),
  vertical({
    key: "manufacturing_robotics",
    label: "Manufacturing, quality, robotics and industrial operations",
    products: ["Business Builder", "SONARA One"],
    coverage: ["BOM/work orders", "quality", "OEE", "maintenance", "inventory", "computer vision", "robotics telemetry", "CAD file references", "3D printing"],
    buildVsIntegrate: "build_management_layer_integrate_machines",
    next: ["production/work-order projection", "quality evidence", "maintenance schedules", "machine/robot adapter boundary", "CAD/asset metadata"]
  }),
  vertical({
    key: "real_estate_rental",
    label: "Real estate, property and rental operations",
    products: ["Business Builder", "Growth Studio"],
    coverage: ["listings", "rentals", "properties", "maintenance", "booking", "tenant/customer communications", "payments", "documents"],
    buildVsIntegrate: "build_workflow_integrate_listing_and_financial_services",
    next: ["property/unit records", "maintenance workflow", "listing adapter contract", "document/e-sign integration", "payment reconciliation"]
  }),
  vertical({
    key: "gaming_interactive_spatial",
    label: "Gaming, interactive 3D and spatial experiences",
    products: ["Creator Studio"],
    coverage: ["games", "3D", "AR", "GPU/CPU performance", "frame rate", "refresh rate", "HDR", "interactive media", "in-app purchases"],
    buildVsIntegrate: "build_experience_tools_not_general_game_engine",
    next: ["interactive scene document", "asset budgets", "WebGPU/WebXR research", "performance telemetry", "entitlement hooks"]
  }),
  vertical({
    key: "education_translation",
    label: "Learning, classroom and translation",
    products: ["SONARA One", "Creator Studio"],
    coverage: ["courses", "classroom workflows", "translation", "accessibility", "sign language media references", "study plans", "knowledge retrieval"],
    buildVsIntegrate: "build_learning_workflow_integrate_language_models",
    next: ["course/content graph", "progress evidence", "translation provenance", "accessibility contracts", "grounded tutoring mode"]
  }),
  vertical({
    key: "security_identity_monitoring",
    label: "Security, identity and monitoring",
    products: ["SONARA One"],
    coverage: ["passkeys", "biometrics via platform APIs", "authorization", "audit", "monitoring", "risk assessment", "notifications", "incident evidence"],
    buildVsIntegrate: "build_policy_and_evidence_integrate_identity_primitives",
    next: ["passkeys", "step-up authorization", "security event model", "device/session evidence", "no central biometric template database"]
  }),
  vertical({
    key: "public_sector_integrations",
    label: "Government and public-access integrations",
    products: ["SONARA One", "Business Builder"],
    coverage: ["public access", "venues", "records", "procurement", "accessibility", "forms", "scheduling", "notifications", "audit"],
    buildVsIntegrate: "partner_and_compliance_first",
    next: ["accessibility baseline", "records retention policy hooks", "procurement/security evidence", "public-form templates", "no tactical or weapons capability"]
  }),
  vertical({
    key: "marketplaces_networks",
    label: "Marketplaces, jobs, venues, dating and network services",
    products: ["Business Builder", "Growth Studio", "SONARA One"],
    coverage: ["job listings", "service marketplaces", "venues", "public access", "booking", "RSVP", "dating/community profiles", "rentals", "sponsorships", "fundraising", "donations", "reviews", "moderation", "trust and safety"],
    buildVsIntegrate: "build_marketplace_state_integrate_specialist_verification",
    next: ["listing/profile graph", "search and matching", "booking/application state", "moderation queue", "reputation evidence", "payment/escrow adapter boundary", "privacy and consent controls"]
  })
]);


const STRATEGIC_MARKET_LAYERS_2026 = Object.freeze([
  strategicLayer({
    key: "governed_control_plane",
    priority: "P0",
    thesis: "One shared control plane should own identity, tenant scope, policy, approvals, workflows, events, agent harnesses, RAG evaluation, observability and evidence.",
    build: ["tenant and entitlement graph", "versioned workflow definitions", "tool policy registry", "RAG/evaluation harness", "event/outbox contracts", "OpenTelemetry correlation"],
    avoid: ["product-specific duplicate auth stacks", "unbounded agent authority", "provider-specific business logic"]
  }),
  strategicLayer({
    key: "revenue_and_customer_workflows",
    priority: "P0",
    thesis: "The fastest path to customer value is closed-loop work from lead or request through scheduling, service, order, payment, support and retention.",
    build: ["unified customer timeline", "scheduling and calendar", "catalog and order state", "payment/refund/subscription reconciliation", "customer service", "marketing attribution"],
    avoid: ["chat-only AI with no action path", "client-authoritative billing state"]
  }),
  strategicLayer({
    key: "vertical_operating_packs",
    priority: "P1",
    thesis: "Restaurant, trades, retail, logistics, property and manufacturing should compose shared platform primitives with domain-specific schemas and workflows.",
    build: ["restaurant operations pack", "field-service pack", "retail/commerce pack", "fleet/logistics pack", "property/rental pack", "manufacturing operations pack"],
    avoid: ["separate infrastructure stacks per industry", "rebuilding specialist hardware control"]
  }),
  strategicLayer({
    key: "creator_media_and_growth",
    priority: "P1",
    thesis: "Media creation, social distribution, campaigns and commerce should share one rights-aware asset and analytics graph.",
    build: ["structured media documents", "immutable source assets and renditions", "content calendar", "rights/provenance", "channel adapters", "conversion attribution"],
    avoid: ["duplicating social networks", "implicit publishing authority", "unclear training or reuse rights"]
  }),
  strategicLayer({
    key: "physical_world_and_edge",
    priority: "P2",
    thesis: "Cameras, GPS, sensors, device notifications, kiosks and offline field work are valuable when attached to a business workflow and evidence model.",
    build: ["device permission contracts", "offline mutation queue", "GPS/photo/signature evidence", "telemetry adapters", "edge health and sync"],
    avoid: ["covert tracking", "central biometric-template storage", "safety-critical device control without specialist review"]
  }),
  strategicLayer({
    key: "spatial_interactive_experiences",
    priority: "P2",
    thesis: "3D, AR and game-like interfaces are experience capabilities, not a reason to build a general-purpose game engine.",
    build: ["interactive scene documents", "WebGPU/WebXR adapters", "asset/performance budgets", "entitlements", "device telemetry"],
    avoid: ["general game engine", "custom GPU runtime", "cinematic effects that hide workflow state"]
  }),
  strategicLayer({
    key: "regulated_and_specialist_rails",
    priority: "PARTNER_ONLY",
    thesis: "Banking, insurance, investments, payroll, public-sector records and other regulated decisions should use reviewed providers and auditable adapters.",
    build: ["canonical reconciliation", "approval and consent evidence", "provider abstraction", "audit retention", "domain-specific policy gates"],
    avoid: ["acting as an unlicensed bank, insurer, broker or payment network", "autonomous high-impact decisions"]
  }),
  strategicLayer({
    key: "frontier_watchlist",
    priority: "WATCH",
    thesis: "Blockchain, decentralized ledgers, machine payments, advanced robotics, digital twins and custom operating-system capabilities are evaluated only where a measured customer problem justifies them.",
    build: ["research adapters", "benchmarks", "proofs of value", "license/security reviews"],
    avoid: ["technology-first rewrites", "custom foundation model training without an economic case", "custom general-purpose OS kernel"]
  })
]);

const TECHNOLOGY_REFERENCE_REPOSITORIES_2026 = Object.freeze([
  referenceTechnology("modelcontextprotocol/typescript-sdk", "agent_tool_interoperability", "github_api_noassertion_verify_upstream"),
  referenceTechnology("open-telemetry/opentelemetry-js", "traces_metrics_logs_and_genai_observability", "Apache-2.0"),
  referenceTechnology("pgvector/pgvector", "postgres_vector_retrieval", "github_api_noassertion_verify_upstream"),
  referenceTechnology("open-policy-agent/opa", "policy_as_code", "Apache-2.0"),
  referenceTechnology("kubernetes/kubernetes", "desired_state_runtime_reconciliation", "Apache-2.0"),
  referenceTechnology("argoproj/argo-rollouts", "progressive_delivery", "Apache-2.0"),
  referenceTechnology("grafana/k6", "load_and_threshold_testing", "AGPL-3.0_review_distribution_boundary"),
  referenceTechnology("supabase/supabase", "postgres_auth_storage_realtime_platform_reference", "Apache-2.0"),
  referenceTechnology("mrdoob/three.js", "web_3d_rendering_reference", "MIT"),
  referenceTechnology("BabylonJS/Babylon.js", "web_3d_and_spatial_reference", "Apache-2.0"),
  referenceTechnology("FFmpeg/FFmpeg", "media_transcode_reference", "github_api_noassertion_verify_build_license"),
  referenceTechnology("godotengine/godot", "interactive_and_game_system_reference", "MIT")
]);

const IMPLEMENTATION_SEQUENCE = Object.freeze([
  "shared_identity_tenant_entitlement_and_approval_contract",
  "versioned_workflows_action_runs_idempotency_and_evidence",
  "bounded_agent_tool_registry_rag_evaluation_and_cost_controls",
  "unified_customer_conversation_and_service_timeline",
  "canonical_catalog_order_payment_refund_subscription_and_reconciliation",
  "restaurant_field_service_and_fleet_composition_over_shared_primitives",
  "creator_media_social_distribution_and_rights_aware_commerce",
  "offline_field_device_camera_location_notification_and_sync_contracts",
  "passkeys_step_up_authorization_security_monitoring_and_recovery",
  "forecasting_analytics_quality_inventory_routing_and_capacity_formulas",
  "provider_neutral_external_adapter_and_mcp_gateway",
  "interactive_3d_spatial_and_game_like_experience_tools",
  "regulated_partner_integrations_only_after_domain_specific_review"
]);

const DEFAULT_OPPORTUNITY_WEIGHTS = Object.freeze({
  pain: 0.25,
  platformReuse: 0.25,
  dataAdvantage: 0.20,
  monetization: 0.15,
  adoptionReadiness: 0.15,
  integrationRiskPenalty: 0.12,
  regulatoryRiskPenalty: 0.13
});

function signal(input) {
  return Object.freeze({
    ...input,
    runtimeAuthority: "none",
    productionCapability: false
  });
}

function vertical(input) {
  return Object.freeze({
    ...input,
    products: Object.freeze([...(input.products || [])]),
    coverage: Object.freeze([...(input.coverage || [])]),
    next: Object.freeze([...(input.next || [])]),
    executionStatus: "planning_only"
  });
}

function strategicLayer(input) {
  return Object.freeze({
    ...input,
    build: Object.freeze([...(input.build || [])]),
    avoid: Object.freeze([...(input.avoid || [])]),
    executionStatus: "planning_only"
  });
}

function referenceTechnology(repository, use, licenseStatus) {
  return Object.freeze({
    repository,
    use,
    licenseStatus,
    reviewedAt: MARKET_SNAPSHOT_DATE,
    installedByResearch: false,
    enabledInProduction: false
  });
}

function unit(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new RangeError(`${field} must be between 0 and 1`);
  }
  return number;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function opportunityScore(input = {}) {
  const pain = unit(input.pain, "pain");
  const platformReuse = unit(input.platformReuse, "platformReuse");
  const dataAdvantage = unit(input.dataAdvantage, "dataAdvantage");
  const monetization = unit(input.monetization, "monetization");
  const adoptionReadiness = unit(input.adoptionReadiness, "adoptionReadiness");
  const integrationRisk = unit(input.integrationRisk, "integrationRisk");
  const regulatoryRisk = unit(input.regulatoryRisk, "regulatoryRisk");

  const gross =
    pain * DEFAULT_OPPORTUNITY_WEIGHTS.pain +
    platformReuse * DEFAULT_OPPORTUNITY_WEIGHTS.platformReuse +
    dataAdvantage * DEFAULT_OPPORTUNITY_WEIGHTS.dataAdvantage +
    monetization * DEFAULT_OPPORTUNITY_WEIGHTS.monetization +
    adoptionReadiness * DEFAULT_OPPORTUNITY_WEIGHTS.adoptionReadiness;

  const penalty =
    integrationRisk * DEFAULT_OPPORTUNITY_WEIGHTS.integrationRiskPenalty +
    regulatoryRisk * DEFAULT_OPPORTUNITY_WEIGHTS.regulatoryRiskPenalty;

  return round(Math.max(0, Math.min(1, gross - penalty)));
}

function technologyFitScore(input = {}) {
  const interoperability = unit(input.interoperability, "interoperability");
  const platformReuse = unit(input.platformReuse, "platformReuse");
  const maturity = unit(input.maturity, "maturity");
  const maintainability = unit(input.maintainability, "maintainability");
  const ecosystem = unit(input.ecosystem, "ecosystem");
  const securityFit = unit(input.securityFit, "securityFit");
  const integrationRisk = unit(input.integrationRisk, "integrationRisk");
  const lockInRisk = unit(input.lockInRisk, "lockInRisk");
  const licenseRisk = unit(input.licenseRisk, "licenseRisk");

  const value =
    0.20 * interoperability +
    0.20 * platformReuse +
    0.15 * maturity +
    0.15 * maintainability +
    0.15 * ecosystem +
    0.15 * securityFit -
    0.15 * integrationRisk -
    0.10 * lockInRisk -
    0.10 * licenseRisk;

  return round(Math.max(0, Math.min(1, value)));
}

function get2026MarketIntelligence() {
  return {
    ok: true,
    snapshotDate: MARKET_SNAPSHOT_DATE,
    researchOnly: true,
    productionExecutionCount: 0,
    marketSignalCount: MARKET_SIGNALS_2026.length,
    verticalOpportunityCount: VERTICAL_OPPORTUNITIES.length,
    strategicMarketLayerCount: STRATEGIC_MARKET_LAYERS_2026.length,
    technologyReferenceRepositoryCount: TECHNOLOGY_REFERENCE_REPOSITORIES_2026.length,
    implementationStepCount: IMPLEMENTATION_SEQUENCE.length,
    marketSignals: MARKET_SIGNALS_2026.map((item) => ({ ...item })),
    verticalOpportunities: VERTICAL_OPPORTUNITIES.map((item) => ({
      ...item,
      products: [...item.products],
      coverage: [...item.coverage],
      next: [...item.next]
    })),
    strategicMarketLayers: STRATEGIC_MARKET_LAYERS_2026.map((item) => ({
      ...item,
      build: [...item.build],
      avoid: [...item.avoid]
    })),
    technologyReferenceRepositories: TECHNOLOGY_REFERENCE_REPOSITORIES_2026.map((item) => ({ ...item })),
    implementationSequence: [...IMPLEMENTATION_SEQUENCE],
    formulas: {
      opportunityScore: "0.25*pain + 0.25*platform_reuse + 0.20*data_advantage + 0.15*monetization + 0.15*adoption_readiness - 0.12*integration_risk - 0.13*regulatory_risk",
      technologyFitScore: "0.20*interoperability + 0.20*platform_reuse + 0.15*maturity + 0.15*maintainability + 0.15*ecosystem + 0.15*security_fit - 0.15*integration_risk - 0.10*lock_in_risk - 0.10*license_risk"
    },
    guardrails: [
      "Research evidence does not execute a provider or third-party repository.",
      "Market forecasts and vendor surveys are directional inputs, not guarantees.",
      "Regulated rails such as payments, banking, insurance, payroll, identity and public-sector systems stay behind reviewed adapters.",
      "Biometrics use platform/device primitives where possible; no central biometric-template database is created by this research.",
      "No investment, lending, insurance, medical, military, law-enforcement or public-policy decision is automated by this research layer.",
      "Reference repositories are research inputs only: no repository is installed, copied, enabled or granted runtime authority by this module.",
      "Repository license metadata marked noassertion is unresolved, not license-free; upstream terms must be verified before adoption or distribution.",
      "Frontier capabilities enter the product only after a customer problem, measurable success criteria, tenant/security design and rollback path are documented."
    ]
  };
}

module.exports = {
  MARKET_SNAPSHOT_DATE,
  MARKET_SIGNALS_2026,
  VERTICAL_OPPORTUNITIES,
  STRATEGIC_MARKET_LAYERS_2026,
  TECHNOLOGY_REFERENCE_REPOSITORIES_2026,
  IMPLEMENTATION_SEQUENCE,
  DEFAULT_OPPORTUNITY_WEIGHTS,
  opportunityScore,
  technologyFitScore,
  get2026MarketIntelligence
};
