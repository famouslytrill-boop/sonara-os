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

const LIVE_PROBE_TIMEOUT_MS = 800;

module.exports = function registerSonaraEcosystemRoutes(app, deps = {}) {
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;
  const requireAdmin = typeof deps.requireAdmin === "function" ? deps.requireAdmin : pass;
  const safeListTable = typeof deps.safeListTable === "function" ? deps.safeListTable : undefined;

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
        brandCard("Third-search convergence", `${thirdSearch.inventory.governedRepositoryRecords} governed repository records and ${thirdSearch.inventory.marketExpansionCapabilities} product-expansion capabilities now resolve into one ordered plan: durable events, one low-risk worker, private creator/customer collaboration, provider-neutral observability, and reusable industry composition. Public social federation remains deferred.`),
        brandCard("Expansion direction", "Shared Nexus primitives first: workflow, approvals, commerce, communications, media/design, field/offline, visibility, geospatial/IoT, deterministic optimization, analytics, learning, and distribution. Industry packs reuse those primitives instead of becoming disconnected applications."),
        brandCard("Learning and memory", `${memory.memoryClassCount} governed memory classes. Project memory is active for development; customer semantic retrieval remains ${String(memory.currentState.semanticRetrieval.status).replace(/_/g, " ")} until provider/model/runtime verification.`),
        brandCard("Claude + ChatGPT/Codex strategies", `${skills.strategyCount} shared strategies cover convergence, open source, models/providers, learning/memory, product workflows, security, and release evidence without granting account/provider authority.`),
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
        linkAction("/formulas", "Formulas"),
        linkAction("/dashboard", "Dashboard")
      ]
    }));
  });

  app.get("/admin/ecosystem", requireAdmin, async (req, res) => {
    const manifest = getManifest();
    const readiness = await getEcosystemReadiness(safeListTable, { probe: true });
    const convergence = getUnifiedBatchConvergence();
    const engines = getModelEngineControlPlane();
    const skills = getAgentSkillStrategyCatalog();
    const memory = getLearningMemoryControlPlane();
    const evidence = getSourceEvidenceRegister();
    const expansion = getMarketExpansionRegistry();
    const schemaPlan = getMarketExpansionSchemaPlan();
    const industryExpansion = getIndustryAlgorithmExpansion();
    const thirdSearch = getThirdSearchConvergence();
    const missingCount = readiness.tables.filter((item) => !item.ok).length;
    return res.status(200).type("html").send(layout({
      title: "Ecosystem control plane",
      eyebrow: "Founder operations",
      heading: "Ecosystem control plane",
      body: "Admin source-of-truth view for SONARA companies, modules, integrations, models/engines, repository research, source evidence, market expansion, deterministic strategy, infrastructure, database domains, and launch blockers.",
      sections: [
        brandCard("System model", `${manifest.currentCompanies.length} companies, ${manifest.requiredDatabaseDomains.length} database domains, ${getAllManifestTables().length} required table references.`),
        brandCard("Database readiness", `${readiness.tables.length - missingCount}/${readiness.tables.length} table references returned OK. ${missingCount} still need setup, migration, or read permission review.`),
        brandCard("Batch repository convergence", `${convergence.counts.uniqueRepositoryResearch} unique repository records after collapsing ${convergence.counts.duplicateRepositoryRecordsCollapsed} duplicate/source overlaps. Formal open-source registry integrity: ${convergence.counts.formalOpenSourceRegistryIntegrity.ok ? "verified" : "review required"}.`),
        brandCard("Commercial open-source decisions", `${engines.openSource.permissiveCandidateCount} permissive/allowed candidates, ${engines.openSource.copyleftReviewCount} copyleft review items, ${engines.openSource.blockedOrUnknownCount} blocked/unverified/unknown items, ${engines.openSource.researchOnlyCount} research/review-only items.`),
        brandCard("Models and engines", `${engines.engineCount} explicitly placed engines/model families/runtime companions; full repository inventory remains separately governed.`),
        brandCard("Market expansion control plane", `${expansion.counts.capabilities} capabilities classified across core platform, add-ons, industry packs, standalone SKUs, distribution, and partner integrations. Current status split: ${formatCounts(expansion.counts.byStatus)}.`),
        brandCard("Broad industry portfolio", `${industryExpansion.counts.industries} industry opportunities. Priority split: ${formatCounts(industryExpansion.counts.priorities)}. The internal value score is a reproducible strategy heuristic and does not promise revenue or market success.`),
        brandCard("Formula and algorithm engine", `${industryExpansion.counts.formulas} formula definitions plus ${industryExpansion.counts.algorithms} deterministic/statistical/optimization strategies cover finance, inventory, manufacturing, quality, routing, field service, property, construction, growth, fundraising, reliability, security, media, music theory, and learning.`),
        brandCard("Open-source expansion candidates", `${industryExpansion.counts.openSourceCandidates} candidates are classified by use and license boundary. Copyleft, AGPL, provider, medical, trading, and externally hosted components remain review-gated.`),
        brandCard("Schema planning", `${schemaPlan.count} reuse-first schema contracts distinguish existing-table reuse, projections, and candidate new tables before any migration is allowed. Decision split: ${formatCounts(schemaPlan.decisions)}.`),
        brandCard("Third-search architecture decision", `${thirdSearch.deliveryFoundation.tables.length} durable event/evaluation tables are implemented in source and pending the controlled migration path. The first producer is ${thirdSearch.deliveryFoundation.firstProducer.replace(/_/g, " ")}; no worker, public social feed, federation, biometric database, Wi-Fi credential feature, or global media network is enabled by this research.`),
        brandCard("Industry packs", expansion.industryPacks.map((item) => `${item.name}: ${item.status.replace(/_/g, " ")}`).join(" / ")),
        brandCard("Standalone SKU candidates", expansion.standaloneSkus.map((item) => `${item.name}: ${item.status.replace(/_/g, " ")}`).join(" / ")),
        brandCard("Expansion guardrail", "A market-expansion record does not install, activate, message, publish, bill, trade, diagnose, pay out, mutate infrastructure, or grant provider authority. Existing implementation and planned work remain explicitly separated."),
        brandCard("Cross-agent strategy", `${skills.strategyCount} shared Claude + ChatGPT/Codex strategies. Repository strategy does not install a ChatGPT app or widen connected-app permissions.`),
        brandCard("Learning and memory", `${memory.memoryClassCount} memory classes; organization learning runtime is ${String(memory.currentState.organizationLearningRuntime.status).replace(/_/g, " ")}; semantic retrieval is ${String(memory.currentState.semanticRetrieval.status).replace(/_/g, " ")}.`),
        brandCard("Source evidence", `${evidence.sourceCount} source-grounded records from uploaded PDFs, designs, research, machine-readable model data, and visual evidence.`),
        brandCard("Adapter policy", manifest.externalInspirationAndAdapters.adapterRules.join(" / ")),
        brandCard("AI integration control plane", `${manifest.externalInspirationAndAdapters.governedAIIntegrations.length} classified optional tools with admin-only, read-only service probes.`),
        brandCard("UI layer", manifest.uiExperience.layers.join(" / ")),
        brandCard("Next priorities", industryExpansion.highestValueSequence.slice(0, 8).join(" / ")),
        ...manifest.currentCompanies.map((company) => brandCard(company.name, company.modules.slice(0, 14).join(" / ")))
      ],
      actions: [
        linkAction("/admin", "Admin"),
        linkAction("/admin/formulas", "Formulas"),
        linkAction("/api/ecosystem/manifest", "Manifest JSON"),
        linkAction("/api/ecosystem/readiness", "Readiness JSON"),
        linkAction("/api/ecosystem/model-engines", "Models & engines"),
        linkAction("/api/ecosystem/batch-convergence", "Batch convergence"),
        linkAction("/api/ecosystem/agent-skill-strategies", "Agent strategies"),
        linkAction("/api/ecosystem/learning-memory", "Learning & memory"),
        linkAction("/api/ecosystem/source-evidence", "Source evidence"),
        linkAction("/admin/ai-integrations", "AI integrations")
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

async function getEcosystemReadiness(safeListTable, options = {}) {
  if (!safeListTable || options.probe !== true) return getStaticEcosystemReadiness();

  const manifest = getManifest();
  const industryExpansion = getIndustryAlgorithmExpansion();
  const thirdSearch = getThirdSearchConvergence();
  const tableNames = unique(getAllManifestTables()).filter((table) => !table.includes("."));
  const tables = await Promise.all(tableNames.map(async (table) => {
    const result = await boundedProbe(() => safeListTable(table, "?select=id&limit=1"), LIVE_PROBE_TIMEOUT_MS);
    return {
      table,
      ok: Boolean(result.ok),
      status: result.ok ? "ready" : "setup_required",
      reason: result.code === "timeout" ? "timeout" : undefined
    };
  }));

  return {
    ok: true,
    mode: "live_bounded",
    probeTimeoutMs: LIVE_PROBE_TIMEOUT_MS,
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
    tables
  };
}

async function boundedProbe(run, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(run).catch(() => ({ ok: false, code: "unavailable" })),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve({ ok: false, code: "timeout" }), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function formatCounts(counts) {
  return Object.entries(counts || {})
    .map(([key, value]) => `${key.replace(/_/g, " ")} ${value}`)
    .join(" / ");
}

function unique(values) {
  return Array.from(new Set(values));
}

function pass(req, res, next) { next(); }
function esc(value) { return String(value || "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }
function card(title, body) { return `<article class="card"><h2>${esc(title)}</h2><p>${esc(body)}</p></article>`; }
function link(href, label) { return `<a class="action" href="${esc(href)}">${esc(label)}</a>`; }
function basicLayout(data) { return `<!doctype html><html><head><title>${esc(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><p>${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p>${esc(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section></main></body></html>`; }
