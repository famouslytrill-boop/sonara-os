"use strict";

const {
  getPublicAIIntegrationCatalog,
  getAIIntegrationReadiness
} = require("../lib/sonara-ai-integration-registry.cjs");
const { getModelEngineControlPlane } = require("../lib/sonara-model-engine-control-plane.cjs");
const { getAgentSkillStrategyCatalog } = require("../lib/sonara-agent-skill-strategies.cjs");
const { getUnifiedBatchConvergence } = require("../lib/sonara-batch-convergence-engine.cjs");
const { getSourceEvidenceRegister } = require("../lib/sonara-source-evidence-register.cjs");
const { getLearningMemoryControlPlane } = require("../lib/sonara-learning-memory-control-plane.cjs");

module.exports = function registerSonaraAIIntegrationRoutes(app, deps = {}) {
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;
  const requireAdmin = typeof deps.requireAdmin === "function" ? deps.requireAdmin : pass;
  const recordAdminAuditEvent = typeof deps.recordAdminAuditEvent === "function"
    ? deps.recordAdminAuditEvent
    : async () => undefined;

  app.get("/api/ecosystem/ai-integrations", (req, res) => {
    const integrations = getPublicAIIntegrationCatalog();
    res.status(200).json({
      ok: true,
      status: "cataloged",
      integrationCount: integrations.length,
      integrations
    });
  });

  app.get("/api/ecosystem/model-engines", (req, res) => {
    res.status(200).json(getModelEngineControlPlane());
  });

  app.get("/api/ecosystem/agent-skill-strategies", (req, res) => {
    res.status(200).json(getAgentSkillStrategyCatalog());
  });

  app.get("/api/ecosystem/batch-convergence", (req, res) => {
    res.status(200).json(getUnifiedBatchConvergence());
  });

  app.get("/api/ecosystem/source-evidence", (req, res) => {
    res.status(200).json(getSourceEvidenceRegister());
  });

  app.get("/api/ecosystem/learning-memory", (req, res) => {
    res.status(200).json(getLearningMemoryControlPlane());
  });

  app.get("/api/admin/ai-integrations/readiness", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.ai_integrations.probe", { path: req.path });
    const readiness = await getAIIntegrationReadiness({ probe: true });
    res.status(200).json({
      ...readiness,
      modelEngineControlPlane: getModelEngineControlPlane(),
      agentSkillStrategies: getAgentSkillStrategyCatalog(),
      batchConvergence: getUnifiedBatchConvergence(),
      sourceEvidence: getSourceEvidenceRegister(),
      learningMemory: getLearningMemoryControlPlane()
    });
  });

  app.get("/admin/ai-integrations", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.ai_integrations.view", { path: req.path });
    const readiness = await getAIIntegrationReadiness({ probe: true });
    const engineControlPlane = getModelEngineControlPlane();
    const skillStrategies = getAgentSkillStrategyCatalog();
    const convergence = getUnifiedBatchConvergence();
    const sourceEvidence = getSourceEvidenceRegister();
    const learningMemory = getLearningMemoryControlPlane();
    const configured = readiness.integrations.filter((item) => item.configurationStatus === "configured").length;
    const ready = readiness.integrations.filter((item) => item.runtimeStatus === "ready").length;
    const semanticState = learningMemory.currentState.semanticRetrieval.status;
    const sections = [
      brandCard("Governed integration catalog", `${readiness.integrationCount} existing integrations are classified. Optional adapters remain opt-in; model, framework, and developer CLI entries stay bounded to their proper runtime.`),
      brandCard("Batch 1-10 convergence", `${convergence.batchCount} batches plus requested/formal registries converge into ${convergence.counts.uniqueRepositoryResearch} unique repository records. ${convergence.counts.formalOpenSourceRegistryRecords} maintained open-source registry records are included and deduplicated without adding runtime authority.`),
      brandCard("Model and engine control plane", `${engineControlPlane.engineCount} explicitly placed engines/model families/workers sit on top of a ${engineControlPlane.repositoryInventoryCount}-repository governed inventory. Runtime placement distinguishes web process, isolated worker, browser runtime, owner-device companion, and research-only roles.`),
      brandCard("Commercial open-source posture", `${engineControlPlane.openSource.permissiveCandidateCount} permissive candidates have both a permissive licence and an allowed/allowed-after-review commercial-use state; ${engineControlPlane.openSource.copyleftReviewCount} copyleft items require isolation/licence review; ${engineControlPlane.openSource.blockedOrUnknownCount} blocked/unverified/unlicensed items remain unavailable for adoption.`),
      brandCard("Claude + ChatGPT/Codex strategies", `${skillStrategies.strategyCount} portable strategies cover Batch 1-10 convergence, open-source adoption, model/provider choice, governed learning/memory, Creator, Growth, Business Builder, authorized security, and release evidence. Skills never grant provider or account authority.`),
      brandCard("Learning and memory", `${learningMemory.memoryClassCount} governed memory classes are defined. Project agent memory is repository-native; legacy vector/agent-memory tables are not presented as a live organization-memory product. Semantic retrieval is ${display(semanticState)} and remains provider/model/dimension gated.`),
      brandCard("Uploaded source evidence", `${sourceEvidence.sourceCount} source-grounded PDF, design, model-registry, research, diagram/graph, and visual-evidence records are mapped to implementation requirements without turning uploaded material into executable authority.`),
      brandCard("Runtime state", `${configured} HTTP adapters configured; ${ready} live probes ready. Disabled and setup-required states do not block SONARA launch.`),
      brandCard("Safety contract", "Credentials stay server-side. Probes are read-only and bounded. Research, skills, model registries, source evidence, memory policy, and engine records cannot execute providers, install repositories, send campaigns, publish media, control customer accounts, or bypass tenant/owner/release gates."),
      ...engineControlPlane.engines.map((item) => brandCard(
        `${item.label}: ${display(item.adoptionStatus)}`,
        `Class: ${display(item.kind)}. Runtime: ${display(item.runtimeBoundary)}. License: ${item.license}. Products: ${item.products.join(", ")}. Capabilities: ${item.capabilities.join(", ")}.${item.restrictions.length ? ` Restrictions: ${item.restrictions.join(" ")}` : ""}`
      )),
      ...readiness.integrations.map((item) => brandCard(
        `${item.label}: ${display(item.runtimeStatus)}`,
        integrationSummary(item)
      ))
    ];

    res.status(200).type("html").send(layout({
      title: "AI integrations",
      eyebrow: "Founder operations",
      heading: "Governed AI, model, engine, source, memory, and agent control plane",
      body: "Operational readiness for optional AI services, local/open model infrastructure, Creator media workers, cross-agent skills, governed learning/memory, uploaded source evidence, external open-source research, and developer tools. No secret values are displayed and no research/source/memory policy record executes code.",
      sections,
      actions: [
        linkAction("/api/admin/ai-integrations/readiness", "Readiness JSON"),
        linkAction("/api/ecosystem/model-engines", "Model & engine JSON"),
        linkAction("/api/ecosystem/agent-skill-strategies", "Skill strategy JSON"),
        linkAction("/api/ecosystem/learning-memory", "Learning & memory JSON"),
        linkAction("/api/ecosystem/batch-convergence", "Batch 1-10 JSON"),
        linkAction("/api/ecosystem/source-evidence", "Source evidence JSON"),
        linkAction("/api/ecosystem/ai-integrations", "Integration catalog JSON"),
        linkAction("/admin/integrations", "Integrations"),
        linkAction("/admin/ecosystem", "Ecosystem")
      ]
    }));
  });
};

function integrationSummary(item) {
  if (item.runtimeClass !== "http_service") {
    return `Class: ${display(item.runtimeClass)}. Policy: ${display(item.integrationStatus)}. No production service probe or customer request-path execution.`;
  }
  const host = item.configuredHost ? ` Host: ${item.configuredHost}.` : "";
  const missing = item.missingConfiguration?.length
    ? ` Setup keys: ${item.missingConfiguration.join(", ")}.`
    : "";
  return `Configuration: ${display(item.configurationStatus)}. Runtime: ${display(item.runtimeStatus)}.${host}${missing} Human review required.`;
}

function display(value) {
  return String(value || "unknown").replace(/_/g, " ");
}

function pass(req, res, next) { next(); }
function esc(value) { return String(value || "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }
function card(title, body) { return `<article class="card"><h2>${esc(title)}</h2><p>${esc(body)}</p></article>`; }
function link(href, label) { return `<a class="action" href="${esc(href)}">${esc(label)}</a>`; }
function basicLayout(data) { return `<!doctype html><html><head><title>${esc(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><p>${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p>${esc(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section></main></body></html>`; }
