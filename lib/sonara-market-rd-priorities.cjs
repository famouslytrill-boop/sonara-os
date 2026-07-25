"use strict";

const MARKET_RD_PRIORITIES = Object.freeze({
  version: "2026-07-25",
  asOf: "2026-07-25",
  decisionRule: "No market signal becomes roadmap work until SONARA records a reachable segment, a measurable customer commitment, an owner, a cost ceiling, and a Product Lifecycle validation decision.",
  portfolioConclusion: "SONARA should consolidate fragmented work rather than imitate category leaders feature-for-feature. The portfolio advantage is a connected, affordable, governed path from first offer to transaction, original asset to rights-aware release, and consented customer evidence to measured growth.",
  crossCompanyFixes: Object.freeze([
    Object.freeze({
      key: "time_to_value",
      priority: 1,
      action: "Instrument the first-value event and elapsed time from account creation for every studio.",
      measures: ["median time to first value", "activation rate", "setup abandonment", "assisted setup rate"],
      reason: "Current small-team buyers prioritize ease of use, stack simplification, and clear outcomes over a larger feature list."
    }),
    Object.freeze({
      key: "shared_customer_and_consent_spine",
      priority: 2,
      action: "Use one portable customer, consent, suppression, source, asset, transaction, and attribution timeline across all studios.",
      measures: ["duplicate customer rate", "consent completeness", "cross-studio handoff completion", "export success rate"],
      reason: "First-party evidence, privacy-safe measurement, ownership, and reduced tool fragmentation are recurring needs in all three markets."
    }),
    Object.freeze({
      key: "value_and_cost_scorecards",
      priority: 3,
      action: "Attach value realization and cost-to-serve scorecards to every launched workflow and provider-backed operation.",
      measures: ["gross margin by workflow", "provider cost per completed outcome", "support minutes per active account", "retained usage"],
      reason: "SONARA's affordable pricing is defensible only when cost-bearing usage and support are measured and bounded."
    }),
    Object.freeze({
      key: "portable_evidence",
      priority: 4,
      action: "Make imports, exports, provenance, approvals, and audit evidence first-class product capabilities.",
      measures: ["successful import rate", "successful export rate", "records with provenance", "switching-friction incidents"],
      reason: "Customer ownership and portability differentiate SONARA from closed or percentage-fee ecosystems."
    })
  ]),
  companies: Object.freeze({
    business_builder: Object.freeze({
      strategicPosition: "The guided operating path for a solopreneur or small local team to complete and repeat a first transaction.",
      primaryBets: [
        "First Transaction Mode with one guided offer-to-payment-to-delivery checklist.",
        "Vertical starter packs for service operators, food and mobile vendors, consultants, and creator-led services.",
        "CSV and provider-assisted import/export with field mapping and ownership evidence.",
        "Security, recovery, permissions, and payment-boundary readiness.",
        "Posted-record cash-flow snapshots that do not claim to replace accounting, tax, payroll, or banking products."
      ],
      validationExperiments: [
        Object.freeze({ name: "concierge first transaction", method: "Run a guided setup with 10 representative owners", commitment: "publish an offer and attempt a real booking, order, or payment", success: "at least 6 complete the first-value event within 48 hours" }),
        Object.freeze({ name: "vertical starter pack test", method: "Test four starter packs with segment-specific landing and onboarding flows", commitment: "choose a pack and complete its required records", success: "one pack improves activation by at least 20% over blank setup" }),
        Object.freeze({ name: "switching import trial", method: "Import real customer or service records from a commonly used tool", commitment: "owner verifies mapped records", success: "90% of required fields import without manual re-entry" })
      ],
      successMetrics: ["first transaction activation", "median setup time", "repeat customer rate", "weekly retained operators", "support minutes per activated account"],
      killCriteria: ["customers still need multiple external tools before first value", "support cost exceeds plan economics", "starter packs do not outperform guided generic setup"]
    }),
    creator_studio: Object.freeze({
      strategicPosition: "The rights-aware operating system that turns original work into a portable release, client, archive, or brand-partnership package.",
      primaryBets: [
        "Release Package Builder with assets, versions, collaborators, approvals, rights, consent, source references, and provenance.",
        "Portable exports for DAWs, distributors, clients, brand partners, and archives.",
        "Creator-owned fan, buyer, collaborator, and partner records with consent and suppression controls.",
        "Brand Deal Operations covering brief, deliverables, approvals, disclosure readiness, payment status, and measurement handoff.",
        "Human-controlled generation with provider metadata, originality checks, and identity-imitation restrictions."
      ],
      validationExperiments: [
        Object.freeze({ name: "portable release package", method: "Have 10 creators package an existing project", commitment: "export and use the package outside SONARA", success: "at least 7 complete export without staff intervention" }),
        Object.freeze({ name: "brand deal operations pilot", method: "Track five real or representative partnerships end to end", commitment: "creator and reviewer approve deliverables and disclosures", success: "all required evidence is complete before campaign handoff" }),
        Object.freeze({ name: "direct audience ownership test", method: "Import or capture consented fan and buyer records", commitment: "creator performs an export or approved follow-up", success: "no unresolved consent or suppression defect" })
      ],
      successMetrics: ["completed project rate", "successful export rate", "repeat project creation", "rights evidence completeness", "direct buyer or fan record growth", "brand deliverable approval time"],
      killCriteria: ["the product competes mainly on generic generation volume", "portable packages are not usable outside SONARA", "rights and consent evidence is routinely incomplete"]
    }),
    growth_studio: Object.freeze({
      strategicPosition: "The governed layer between basic CRM or sending tools and expensive enterprise marketing operations.",
      primaryBets: [
        "First-party Customer Timeline shared with Business Builder transactions and Creator Studio assets.",
        "Purpose- and channel-specific consent, suppression, provider diagnostics, and human approval.",
        "Offline conversions, deduplication, freshness, attribution model, confidence, and sampling evidence.",
        "Holdout and incrementality experiment planning instead of last-click certainty.",
        "Creator partnership measurement with audience fit, deliverables, disclosures, and business outcomes.",
        "Answer-engine visibility evidence based on observable citations and referrals without placement guarantees."
      ],
      validationExperiments: [
        Object.freeze({ name: "customer timeline reconciliation", method: "Reconcile transactions, creator assets, touchpoints, and conversions for five organizations", commitment: "owner verifies one end-to-end customer journey", success: "at least 95% deduplicated linkage for required records" }),
        Object.freeze({ name: "incrementality planning pilot", method: "Design a holdout or phased test for five campaigns", commitment: "owner accepts hypothesis, exposure rule, primary metric, and stop condition", success: "no result is reported as lift without an eligible comparison" }),
        Object.freeze({ name: "creator partnership measurement", method: "Connect five creator deliverable sets to consented touchpoints and outcomes", commitment: "brand or creator verifies delivery and disclosure evidence", success: "every result includes source, confidence, freshness, and attribution limitations" })
      ],
      successMetrics: ["consent completeness", "deduplication rate", "offline conversion match rate", "experiment completion", "attribution evidence freshness", "retained active campaigns"],
      killCriteria: ["value depends on unauthorized sending or advertising", "measurement cannot distinguish modeled correlation from verified lift", "provider cost or compliance risk exceeds customer value"]
    })
  }),
  sources: Object.freeze([
    Object.freeze({ publisher: "U.S. Department for Business and Trade", title: "SME Digital Adoption Taskforce final report", observedAt: "2025-07-31", implication: "Prioritize simple adoption, interoperability, CRM and operations value rather than feature volume." }),
    Object.freeze({ publisher: "U.S. Small Business Administration", title: "2025 small-business reports and 2026 statistics", observedAt: "2026-01-30", implication: "Design for a large market of small and often nonemployer businesses with limited specialist staff." }),
    Object.freeze({ publisher: "Visa", title: "Monetized: Visa 2025 Creator Report", observedAt: "2025-11-11", implication: "Treat creators as businesses needing payment, finance, ownership, and growth operations." }),
    Object.freeze({ publisher: "Interactive Advertising Bureau", title: "2025 Creator Economy Ad Spend & Strategy Report", observedAt: "2025-11-20", implication: "Prioritize creator selection, measurement standards, and business-outcome evidence." }),
    Object.freeze({ publisher: "American Marketing Association / Act-On", title: "Marketing Automation and AI Trends Report", observedAt: "2026-05-20", implication: "Ease of use, stack simplification, reporting, attribution, integration, and ROI proof are high-value gaps." })
  ])
});

function getMarketRDPriorities() {
  return JSON.parse(JSON.stringify(MARKET_RD_PRIORITIES));
}

module.exports = { MARKET_RD_PRIORITIES, getMarketRDPriorities };
