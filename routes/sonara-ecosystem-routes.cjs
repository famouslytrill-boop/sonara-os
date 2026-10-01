// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { getManifest, getAllManifestTables } = require("../lib/sonara-ecosystem-manifest.cjs");
const { getUnifiedBatchConvergence } = require("../lib/sonara-batch-convergence-engine.cjs");
const { getModelEngineControlPlane } = require("../lib/sonara-model-engine-control-plane.cjs");
const { getAgentSkillStrategyCatalog } = require("../lib/sonara-agent-skill-strategies.cjs");
const { getLearningMemoryControlPlane } = require("../lib/sonara-learning-memory-control-plane.cjs");
const { getSourceEvidenceRegister } = require("../lib/sonara-source-evidence-register.cjs");
const { getMarketExpansionRegistry } = require("../lib/sonara-market-expansion-registry.cjs");
const { getMarketExpansionSchemaPlan } = require("../lib/sonara-market-expansion-schema-plan.cjs");
const { getIndustryAlgorithmExpansion } = require("../lib/sonara-industry-algorithm-expansion.cjs");
const { getThirdSearchConvergence } = require("../lib/sonara-third-search-convergence.cjs");
const { getInventionSystemsIntelligence } = require("../lib/sonara-invention-systems-2026.cjs");


module.exports = function registerSonaraEcosystemRoutes(app, deps = {}) {
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;

  app.get("/ecosystem", (req, res) => {
    const manifest = getManifest();
    const convergence = getUnifiedBatchConvergence();
    const engines = getModelEngineControlPlane();
    const skills = getAgentSkillStrategyCatalog();
    const memory = getLearningMemoryControlPlane();
    const evidence = getSourceEvidenceRegister();
    const expansion = getMarketExpansionRegistry();
    const industryExpansion = getIndustryAlgorithmExpansion();
    const thirdSearch = getThirdSearchConvergence();
    const inventions = getInventionSystemsIntelligence();
    return res.status(200).type("html").send(layout({
      title: "SONARA Ecosystem",
      eyebrow: "Operating blueprint",
      heading: "SONARA Ecosystem",
      body: manifest.parentCompany.publicPositioning,
      sections: [
        brandCard("Parent company", `${manifest.parentCompany.name}: ${manifest.parentCompany.legalRole}`),
        ...manifest.currentCompanies.map((company) => brandCard(company.name, `${company.purpose} Apps: ${company.apps.slice(0, 8).join(" / ")}`)),
        brandCard("Infrastructure", manifest.infrastructure.requiredServices.join(" / ")),
        brandCard("Governed integrations", `${manifest.externalInspirationAndAdapters.governedAIIntegrations.length} optional AI/service integrations plus ${engines.engineCount} explicitly placed model/engine/runtime candidates. No registry record executes a provider by itself.`),
        brandCard("Research and open-source intelligence", `Research inputs through Batch ${convergence.latestBatch} plus maintained repository registries converge into ${convergence.counts.uniqueRepositoryResearch} deduplicated repository records. ${engines.openSource.permissiveCandidateCount} currently meet the control plane's permissive-license + allowed-commercial-state candidate rule; all still keep product/runtime review boundaries.`),
        brandCard("Market and product expansion", `${expansion.counts.capabilities} governed capability records, ${expansion.counts.industryPacks} industry packs, and ${expansion.counts.standaloneSkus} possible standalone SKUs now capture the September 14-16 market, workflow, media, field, vertical-SaaS, distribution, and usability research. Planned records do not claim production execution.`),
        brandCard("Industry and deterministic engine expansion", `${industryExpansion.counts.industries} broader industry systems, ${industryExpansion.counts.formulas} reusable business formulas, ${industryExpansion.counts.algorithms} algorithm strategies, and ${industryExpansion.counts.openSourceCandidates} open-source candidates are mapped into the same Nexus fabric. Scores are internal portfolio heuristics, not market forecasts.`),
        brandCard("Invention systems foundry", `${inventions.counts.inventionSystems} SONARA-owned system concepts map ${inventions.counts.domainCoverage} requested domain families with ${inventions.counts.formulas} deterministic invention formulas and are tracked through research → design → sandbox → validated → canary → production. Registry presence grants no runtime authority.`),
        brandCard("Third-search convergence", `${thirdSearch.inventory.governedRepositoryRecords} governed repository records and ${thirdSearch.inventory.marketExpansionCapabilities} product-expansion capabilities now resolve into one ordered plan: durable events, one low-risk worker, private creator/customer collaboration, provider-neutral observability, and reusable industry composition. Public social federation remains deferred.`),
        brandCard("Expansion direction", "Shared Nexus primitives first: workflow, approvals, commerce, communications, media/design, field/offline, visibility, geospatial/IoT, deterministic optimization, analytics, learning, and distribution. Industry packs reuse those primitives instead of becoming disconnected applications."),
        brandCard("Learning and memory", `${memory.memoryClassCount} governed memory classes. Project memory is active for development; customer semantic retrieval remains ${String(memory.currentState.semanticRetrieval.status).replace(/_/g, " ")} until provider/model/runtime verification.`),
        brandCard("Claude + ChatGPT/Codex strategies", `${skills.strategyCount} shared strategies cover governed reusable skill contracts, convergence, open source, models/providers, learning/memory, product workflows, security, and release evidence without granting account/provider authority.`),
        brandCard("Source evidence", `${evidence.sourceCount} uploaded PDF, research, design, model-registry, diagram/graph, and visual-evidence records are mapped as bounded context rather than executable product claims.`),
        brandCard("UI direction", manifest.uiExperience.direction),
        brandCard("Launch priority", manifest.launchPriorities.slice(0, 5).join(" / "))
      ],
      actions: [
        linkAction("/api/ecosystem/manifest", "Manifest JSON"),
        linkAction("/api/ecosystem/readiness", "Readiness JSON"),
        linkAction("/api/ecosystem/model-engines", "Models & engines"),
        linkAction("/api/ecosystem/batch-convergence", "Batch research"),
        linkAction("/api/ecosystem/agent-skill-strategies", "Agent strategies"),
        linkAction("/api/ecosystem/learning-memory", "Learning & memory"),
        linkAction("/api/ecosystem/source-evidence", "Source evidence"),
        linkAction("/api/ecosystem/ai-integrations", "AI integration catalog"),
        linkAction("/market-intelligence/invention-systems", "Invention systems"),
        linkAction("/formulas", "Formulas"),
        linkAction("/dashboard", "Dashboard")
      ]
    }));
  });

    app.get("/api/ecosystem/manifest", (req, res) => {
    res.status(200).json({
      ok: true,
      manifest: {
        ...getManifest(),
        marketExpansion: getMarketExpansionRegistry(),
        marketExpansionSchemaPlan: getMarketExpansionSchemaPlan(),
        industryAlgorithmExpansion: getIndustryAlgorithmExpansion(),
        thirdSearchConvergence: getThirdSearchConvergence()
      }
    });
  });

  app.get("/api/ecosystem/readiness", (req, res) => {
    res.status(200).json(getStaticEcosystemReadiness());
  });
};

function getStaticEcosystemReadiness() {
  const manifest = getManifest();
  const tableNames = unique(getAllManifestTables()).filter((table) => !table.includes("."));
  const industryExpansion = getIndustryAlgorithmExpansion();
  const thirdSearch = getThirdSearchConvergence();
  return {
    ok: true,
    mode: "static",
    companies: manifest.currentCompanies.map((company) => ({
      key: company.key,
      name: company.name,
      appCount: company.apps.length,
      moduleCount: company.modules.length
    })),
    serviceCount: manifest.infrastructure.requiredServices.length,
    aiIntegrationCount: manifest.externalInspirationAndAdapters.governedAIIntegrations.length,
    expansionCapabilityCount: getMarketExpansionRegistry().counts.capabilities,
    expansionSchemaContractCount: getMarketExpansionSchemaPlan().count,
    industryExpansionCount: industryExpansion.counts.industries,
    formulaExpansionCount: industryExpansion.counts.formulas,
    algorithmExpansionCount: industryExpansion.counts.algorithms,
    thirdSearchPriorityCount: thirdSearch.implementationSequence.length,
    durableEventFoundationTableCount: thirdSearch.deliveryFoundation.tables.length,
    tables: tableNames.map((table) => ({ table, ok: false, status: "setup_required" }))
  };
}

function unique(values) {
  return Array.from(new Set(values));
}

function esc(value) { return String(value || "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }
function card(title, body) { return `<article class="card"><h2>${esc(title)}</h2><p>${esc(body)}</p></article>`; }
function link(href, label) { return `<a class="action" href="${esc(href)}">${esc(label)}</a>`; }
function basicLayout(data) { return `<!doctype html><html><head><title>${esc(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><p>${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p>${esc(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section></main></body></html>`; }
