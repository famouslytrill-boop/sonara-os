"use strict";

// The owner's third broad market/technology search mixed four different kinds
// of evidence: company strategy, standards, external repositories, and SONARA
// source code. This module keeps those categories separate and turns the valid
// overlap into a bounded implementation sequence. It is a control-plane view;
// it cannot install a dependency, invoke a provider, publish content, or widen
// an agent's authority.

const { readOpenSourceTools } = require("./sonara-open-source-registry.cjs");
const { getMarketExpansionRegistry } = require("./sonara-market-expansion-registry.cjs");
const { getMarketExpansionSchemaPlan } = require("./sonara-market-expansion-schema-plan.cjs");
const { getIndustryAlgorithmExpansion } = require("./sonara-industry-algorithm-expansion.cjs");
const { getAgentSkillStrategyCatalog } = require("./sonara-agent-skill-strategies.cjs");
const { getSourceEvidenceRegister } = require("./sonara-source-evidence-register.cjs");
const {
  OUTBOX_TABLE,
  ATTEMPTS_TABLE,
  OBSERVATIONS_TABLE,
  EVALUATIONS_TABLE
} = require("./sonara-event-outbox.cjs");

const PRIMARY_SOURCES = Object.freeze([
  source("activitypub", "W3C ActivityPub Recommendation", "https://www.w3.org/TR/activitypub/", "Social actors, inbox/outbox, follows, likes, delivery, and the spam/denial-of-service threat model."),
  source("webrtc", "W3C WebRTC", "https://www.w3.org/TR/webrtc/", "Browser media/data connections, signaling, ICE, STUN, and TURN boundaries."),
  source("webauthn", "W3C WebAuthn Level 3", "https://www.w3.org/TR/webauthn-3/", "Public-key authentication with biometric recognition kept local to the authenticator."),
  source("postgres_select", "PostgreSQL SELECT locking", "https://www.postgresql.org/docs/current/sql-select.html", "FOR UPDATE SKIP LOCKED for concurrent claim workers."),
  source("postgres_rls", "PostgreSQL row security", "https://www.postgresql.org/docs/current/ddl-rowsecurity.html", "Default-deny behavior when row security is enabled without a policy."),
  source("opentelemetry", "OpenTelemetry signals", "https://opentelemetry.io/docs/concepts/signals/", "Vendor-neutral traces, metrics, logs, and context propagation."),
  source("google_search", "Google Search SEO Starter Guide", "https://developers.google.com/search/docs/fundamentals/seo-starter-guide", "Logical site structure, useful original content, descriptive URLs, and careful user-generated links."),
  source("sba_planning", "U.S. SBA business planning", "https://www.sba.gov/counseling/plan-your-business/", "Market research, business plans, startup costs, credit, and funding as guided small-business workflows."),
  source("microsoft_business", "Microsoft 365 for business", "https://www.microsoft.com/en-us/microsoft-365/business", "Identity, productivity, storage, communications, creation, security, and AI delivered as a connected business suite."),
  source("sap_platform", "SAP Business Technology Platform", "https://www.sap.com/products/technology-platform.html", "Business data, applications, workflows, governance, integration, and extensions in one operating layer."),
  source("siemens_strategy", "Siemens ONE Tech strategy", "https://press.siemens.com/global/en/pressrelease/siemens-enters-next-stage-growth-its-one-tech-company-program", "Industrial-domain depth joined to software, automation, services, and an ecosystem."),
  source("alibaba_reports", "Alibaba investor financial reports", "https://www.alibabagroup.com/en-US/ir-financial-reports", "Commerce and cloud disclosed as connected operating groups; used as a strategy archetype, not a stack specification."),
  source("tencent_reports", "Tencent 2025 annual report", "https://static.www.tencent.com/uploads/2026/04/09/62d786fcf3d3c8cb7e54791ee95439ac.pdf", "Content, engagement, advertising, payments, cloud, and mini-application ecosystem evidence.")
]);

const MARKET_ARCHETYPES = Object.freeze([
  archetype({
    key: "us_platform_suite",
    market: "United States platform software",
    representatives: ["Microsoft", "Salesforce", "ServiceNow", "Adobe", "Intuit", "Amazon/AWS"],
    observedPattern: "Compound distribution by connecting identity, data, creation, collaboration, commerce, developer tools, and recurring subscriptions.",
    sonaraDecision: "Keep one organization record and shared workflow/approval layer across the three studios instead of duplicating accounts, billing, files, and customer history.",
    evidenceKeys: ["microsoft_business", "opentelemetry", "sba_planning"]
  }),
  archetype({
    key: "european_industry_depth",
    market: "European enterprise and industrial software",
    representatives: ["SAP", "Siemens", "ASML", "Dassault Systemes", "Schneider Electric", "Spotify"],
    observedPattern: "Pair deep domain workflows and long-lived records with partner ecosystems, interoperability, engineering discipline, and services.",
    sonaraDecision: "Build reusable platform primitives once, then package restaurant, field-service, creator, and professional-service workflows as governed industry packs.",
    evidenceKeys: ["sap_platform", "siemens_strategy"]
  }),
  archetype({
    key: "china_mobile_ecosystems",
    market: "Chinese mobile and commerce ecosystems",
    representatives: ["Alibaba", "Tencent", "Huawei", "BYD", "Xiaomi", "ByteDance"],
    observedPattern: "Reduce friction by joining discovery, communication, transactions, embedded applications, devices, and frequent customer feedback loops.",
    sonaraDecision: "Use mobile-first capture, profiles, follows, private engagement spaces, commerce links, and notifications while keeping consent and provider boundaries explicit.",
    evidenceKeys: ["alibaba_reports", "tencent_reports"]
  }),
  archetype({
    key: "industrial_installed_base",
    market: "Manufacturing and physical operations",
    representatives: ["Siemens", "Caterpillar", "Deere", "Honeywell", "Eaton", "Emerson"],
    observedPattern: "Defensibility comes from installed workflows, reliability, service/support, training, monitoring, financing or partner rails, and continuous improvement—not a feature list alone.",
    sonaraDecision: "Sell repeatable operating systems, evidence, templates, training, and service support; integrate regulated or capital-intensive rails instead of pretending SONARA manufactures them.",
    evidenceKeys: ["siemens_strategy"]
  }),
  archetype({
    key: "creator_interactive_media",
    market: "Creator, communications, and interactive media",
    representatives: ["YouTube", "Twitch", "Spotify", "Discord", "Zoom", "Adobe"],
    observedPattern: "Creation, reusable media, live interaction, community, distribution, measurement, and monetization reinforce one another.",
    sonaraDecision: "Start with creator-owned profiles, private client/community spaces, review rooms, calls, rights-aware media, and commerce. Public feed ranking and federation remain later decisions.",
    evidenceKeys: ["activitypub", "webrtc", "google_search"]
  })
]);

const IMPLEMENTATION_SEQUENCE = Object.freeze([
  Object.freeze({ order: 1, key: "durable_events", state: "implemented_in_source_pending_controlled_migration", outcome: "Persist bounded, tenant-scoped events and delivery/evaluation evidence before adding more asynchronous agents." }),
  Object.freeze({ order: 2, key: "single_worker", state: "next", outcome: "Run one approved low-risk consumer, expose failure/dead-letter evidence, and prove replay/idempotency before adopting a broker." }),
  Object.freeze({ order: 3, key: "private_commons", state: "next", outcome: "Compose existing profiles, follows, calls, assets, notifications, and commerce into private Creator/Growth client and community spaces." }),
  Object.freeze({ order: 4, key: "provider_neutral_observability", state: "next", outcome: "Connect sanitized model/provider measurements to traces, metrics, and logs without storing raw prompts, responses, or secrets." }),
  Object.freeze({ order: 5, key: "vertical_composition", state: "planned", outcome: "Ship small-business and creator workflows as industry packs over shared primitives rather than standalone code silos." }),
  Object.freeze({ order: 6, key: "public_social_or_federation", state: "deferred", outcome: "Consider public discovery or federation only after moderation, blocking/reporting, abuse response, retention, takedown, and measurable demand exist." })
]);

const CREATOR_GROWTH_COMMONS = Object.freeze({
  name: "Creator and Growth Commons",
  placement: Object.freeze(["creator_studio", "growth_studio"]),
  state: "existing_foundations_only",
  existing: Object.freeze([
    "creator_artist_profiles",
    "creator_follows",
    "creator_assets",
    "call_sessions",
    "call_signals",
    "user_notifications",
    "growth_content_queue",
    "merchant_products"
  ]),
  next: Object.freeze([
    "private creator/client spaces",
    "membership and role projection",
    "rights-aware posts and media references",
    "review threads and moderated comments",
    "scheduled call/live-room records",
    "content-to-lead-to-sale attribution"
  ]),
  requiredBeforePublicDiscovery: Object.freeze([
    "report and block controls",
    "moderation queue and appeal evidence",
    "takedown and rights workflow",
    "rate limits and anti-spam controls",
    "retention and deletion policy",
    "minor-safety and age-policy decision",
    "operations staffing and incident process"
  ]),
  transportDecision: "Use the existing bounded WebRTC signaling path for browser calls and a reviewed managed relay/provider when production NAT traversal requires it; do not build a global media network first.",
  federationDecision: "Use ActivityStreams/ActivityPub as vocabulary and threat-model references only. Federation is not enabled by this plan."
});

const EXPLICITLY_DEFERRED = Object.freeze([
  Object.freeze({ key: "wifi_credentials", decision: "not_a_product_feature", reason: "Credential discovery or network scanning does not advance the authorized customer workflow." }),
  Object.freeze({ key: "biometric_database", decision: "do_not_build", reason: "Use device-mediated WebAuthn/passkeys; biometric material should remain local to the authenticator." }),
  Object.freeze({ key: "global_streaming_network", decision: "integrate_when_needed", reason: "Relay, transcoding, moderation, and abuse operations are a separate capital- and reliability-heavy business." }),
  Object.freeze({ key: "public_social_feed", decision: "deferred", reason: "The current value is private creator/customer workflow; public discovery adds a moderation and safety company before demand proves it." }),
  Object.freeze({ key: "regulated_financial_and_health_rails", decision: "partner_only", reason: "Payments, payroll, tax, lending, insurance, and clinical systems require reviewed regulated providers and human accountability." }),
  Object.freeze({ key: "bulk_repository_installation", decision: "forbidden", reason: "Research presence and permissive licensing do not prove product fit, dependency safety, tenant isolation, cost, or production ownership." })
]);

function getThirdSearchConvergence() {
  const expansion = getMarketExpansionRegistry();
  const schemaPlan = getMarketExpansionSchemaPlan();
  const industryExpansion = getIndustryAlgorithmExpansion();
  const skillCatalog = getAgentSkillStrategyCatalog();
  const sourceEvidence = getSourceEvidenceRegister();
  const tools = readOpenSourceTools();
  const reviewable = tools.filter((record) =>
    ["reference_only", "research_only"].includes(record.integrationStatus)
    && ["allowed", "allowed_after_review"].includes(record.commercialUseStatus)
  );
  const interactiveMedia = expansion.capabilities.find((item) => item.key === "interactive-media-studio") || null;

  return clone({
    version: "2026-09-17",
    authority: "research_and_source_convergence_only",
    decision: "Advance the shared operating layer, durable events, private creator/customer collaboration, observability, and vertical composition before adding another framework or public network.",
    inventory: {
      governedRepositoryRecords: tools.length,
      reviewableReferenceRecords: reviewable.length,
      marketExpansionCapabilities: expansion.counts.capabilities,
      reuseFirstSchemaContracts: schemaPlan.count,
      industrySystems: industryExpansion.counts.industries,
      deterministicFormulas: industryExpansion.counts.formulas,
      algorithmStrategies: industryExpansion.counts.algorithms,
      openSourceExpansionCandidates: industryExpansion.counts.openSourceCandidates,
      sharedAgentStrategies: skillCatalog.strategyCount,
      businessAISkills: skillCatalog.businessAI.skillCount,
      sourceEvidenceRecords: sourceEvidence.sourceCount,
      uploadedPdfRecords: sourceEvidence.classes.uploaded_pdf || 0
    },
    deliveryFoundation: {
      sourceStatus: "implemented_in_source_pending_controlled_migration",
      tables: [OUTBOX_TABLE, ATTEMPTS_TABLE, OBSERVATIONS_TABLE, EVALUATIONS_TABLE],
      firstProducer: "owner_queue_agent_runs",
      workerStatus: "not_enabled",
      browserAccess: "denied"
    },
    creatorGrowthCommons: CREATOR_GROWTH_COMMONS,
    interactiveMediaCapability: interactiveMedia,
    marketArchetypes: MARKET_ARCHETYPES,
    implementationSequence: IMPLEMENTATION_SEQUENCE,
    explicitlyDeferred: EXPLICITLY_DEFERRED,
    primarySources: PRIMARY_SOURCES,
    governingPrinciple: "Own the customer workflow, data model, permissions, evidence, and experience; integrate commodity, regulated, or capital-intensive infrastructure behind reviewed adapters."
  });
}

function source(key, title, url, use) {
  return Object.freeze({ key, title, url, type: "primary_or_authoritative", readAt: "2026-09-17", use });
}

function archetype(input) {
  return Object.freeze({
    key: input.key,
    market: input.market,
    representatives: Object.freeze([...input.representatives]),
    observedPattern: input.observedPattern,
    sonaraDecision: input.sonaraDecision,
    evidenceKeys: Object.freeze([...input.evidenceKeys]),
    claimType: "strategy_inference_from_primary_disclosures_and_current_product_evidence"
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  PRIMARY_SOURCES,
  MARKET_ARCHETYPES,
  IMPLEMENTATION_SEQUENCE,
  CREATOR_GROWTH_COMMONS,
  EXPLICITLY_DEFERRED,
  getThirdSearchConvergence
};
