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
const { createRunner } = require("../lib/sonara-agent-runner.cjs");
const hostedModels = require("../lib/sonara-model-provider-router.cjs");

const BUSINESS_DRAFT_MAX_CHARS = 8000;
const BUSINESS_DRAFT_MAX_OUTPUT_TOKENS = 900;

module.exports = function registerSonaraAIIntegrationRoutes(app, deps = {}) {
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;
  const requireAdmin = typeof deps.requireAdmin === "function" ? deps.requireAdmin : pass;
  const recordAdminAuditEvent = typeof deps.recordAdminAuditEvent === "function"
    ? deps.recordAdminAuditEvent
    : async () => undefined;
  const modelProviders = deps.modelProviders || hostedModels;

  // The drafting handler still goes through SONARA's authority runner. The
  // action is `draft_content`, which is deliberately on the self-serve list:
  // this endpoint returns text for a person to review and does not send,
  // publish, bill, alter a record, or act on a customer account.
  const draftingRunner = createRunner();
  draftingRunner.register("draft_content", async ({ provider, prompt }) => modelProviders.generate({
    provider,
    maxTokens: BUSINESS_DRAFT_MAX_OUTPUT_TOKENS,
    messages: [
      {
        role: "system",
        content:
          "You draft internal business material for SONARA Industries. Produce a draft only. " +
          "Do not claim that anything was sent, published, purchased, approved, filed, or changed. " +
          "Use only facts present in the user's prompt; label assumptions instead of inventing facts. " +
          "Do not request or reproduce passwords, API keys, card data, private keys, or access tokens."
      },
      { role: "user", content: prompt }
    ]
  }));

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
      hostedModelProviders: modelProviders.getProviderReadiness(),
      modelEngineControlPlane: getModelEngineControlPlane(),
      agentSkillStrategies: getAgentSkillStrategyCatalog(),
      batchConvergence: getUnifiedBatchConvergence(),
      sourceEvidence: getSourceEvidenceRegister(),
      learningMemory: getLearningMemoryControlPlane()
    });
  });

  app.get("/admin/ai-integrations/business-draft", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.ai_integrations.business_draft.view", { path: req.path });
    const providerState = modelProviders.getProviderReadiness();
    return res.status(200).type("html").send(businessDraftPage({
      layout,
      brandCard,
      linkAction,
      providerState
    }));
  });

  app.post("/admin/ai-integrations/business-draft", requireAdmin, async (req, res) => {
    const provider = String(req.body?.provider || "").trim().toLowerCase();
    const prompt = String(req.body?.prompt || "").trim();
    const providerState = modelProviders.getProviderReadiness();

    if (!["openai", "anthropic"].includes(provider)) {
      await recordAdminAuditEvent(req, "admin.ai_integrations.business_draft.refused", { path: req.path, reason: "unknown_provider" });
      return res.status(400).type("html").send(businessDraftPage({
        layout,
        brandCard,
        linkAction,
        providerState,
        prompt,
        error: "Choose OpenAI / ChatGPT or Anthropic Claude. No other provider is accepted on this route."
      }));
    }

    if (!prompt) {
      await recordAdminAuditEvent(req, "admin.ai_integrations.business_draft.refused", { path: req.path, provider, reason: "empty_prompt" });
      return res.status(400).type("html").send(businessDraftPage({
        layout,
        brandCard,
        linkAction,
        providerState,
        provider,
        error: "Enter the business material you want drafted."
      }));
    }

    if (prompt.length > BUSINESS_DRAFT_MAX_CHARS) {
      await recordAdminAuditEvent(req, "admin.ai_integrations.business_draft.refused", { path: req.path, provider, reason: "prompt_too_long" });
      return res.status(413).type("html").send(businessDraftPage({
        layout,
        brandCard,
        linkAction,
        providerState,
        provider,
        prompt: prompt.slice(0, BUSINESS_DRAFT_MAX_CHARS),
        error: `Keep the prompt at ${BUSINESS_DRAFT_MAX_CHARS.toLocaleString()} characters or fewer.`
      }));
    }

    const selectedState = providerState[provider];
    if (!selectedState?.enabled || selectedState.status !== "configured") {
      await recordAdminAuditEvent(req, "admin.ai_integrations.business_draft.refused", { path: req.path, provider, reason: "setup_required" });
      return res.status(503).type("html").send(businessDraftPage({
        layout,
        brandCard,
        linkAction,
        providerState,
        provider,
        prompt,
        error: selectedState?.detail || "That provider is not configured."
      }));
    }

    const run = await draftingRunner.run({
      action: { id: `business-draft-${provider}`, action_type: "draft_content" },
      context: { provider, prompt }
    });

    const providerResult = run.status === "completed" ? run.result : null;
    const ok = Boolean(providerResult?.ok);
    await recordAdminAuditEvent(req, ok ? "admin.ai_integrations.business_draft.completed" : "admin.ai_integrations.business_draft.failed", {
      path: req.path,
      provider,
      status: run.status,
      code: providerResult?.code || null
    });

    return res.status(ok ? 200 : 502).type("html").send(businessDraftPage({
      layout,
      brandCard,
      linkAction,
      providerState,
      provider,
      prompt,
      result: ok ? providerResult : null,
      error: ok ? "" : providerResult?.detail || run.reason || "The draft could not be generated."
    }));
  });

  app.get("/admin/ai-integrations", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.ai_integrations.view", { path: req.path });
    const readiness = await getAIIntegrationReadiness({ probe: true });
    const engineControlPlane = getModelEngineControlPlane();
    const skillStrategies = getAgentSkillStrategyCatalog();
    const convergence = getUnifiedBatchConvergence();
    const sourceEvidence = getSourceEvidenceRegister();
    const learningMemory = getLearningMemoryControlPlane();
    const providerState = modelProviders.getProviderReadiness();
    const configured = readiness.integrations.filter((item) => item.configurationStatus === "configured").length;
    const ready = readiness.integrations.filter((item) => item.runtimeStatus === "ready").length;
    const semanticState = learningMemory.currentState.semanticRetrieval.status;
    const sections = [
      brandCard("Governed integration catalog", `${readiness.integrationCount} existing integrations are classified. Optional adapters remain opt-in; model, framework, and developer CLI entries stay bounded to their proper runtime.`),
      brandCard("OpenAI / ChatGPT provider", providerState.openai.detail),
      brandCard("Anthropic Claude provider", providerState.anthropic.detail),
      brandCard("Hosted-provider rule", "Hosted model calls are explicit, server-side drafting only. SONARA never silently falls back from one paid provider to another, and deterministic local rules remain the default."),
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
        linkAction("/admin/ai-integrations/business-draft", "Business drafting: Claude + ChatGPT"),
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

function businessDraftPage({ layout, brandCard, linkAction, providerState, provider = "", prompt = "", result = null, error = "" }) {
  const openai = providerState?.openai || {};
  const anthropic = providerState?.anthropic || {};
  const providerOptions = [
    option("openai", `OpenAI / ChatGPT — ${openai.status === "configured" ? openai.model : "setup required"}`, provider, openai.status !== "configured"),
    option("anthropic", `Anthropic Claude — ${anthropic.status === "configured" ? anthropic.model : "setup required"}`, provider, anthropic.status !== "configured")
  ].join("");

  const form = `<article class="card sonara-depth" data-sonara-enter>
    <h2>Create a business draft</h2>
    <p>This sends only the text you enter below to the provider you explicitly choose. It does not pull customer records into the prompt.</p>
    <form method="post" action="/admin/ai-integrations/business-draft" class="sonara-form">
      <label for="business-draft-provider">Provider</label>
      <select id="business-draft-provider" name="provider" required>
        <option value="">Choose a configured provider</option>
        ${providerOptions}
      </select>
      <label for="business-draft-prompt">What should SONARA draft?</label>
      <textarea id="business-draft-prompt" name="prompt" rows="12" maxlength="${BUSINESS_DRAFT_MAX_CHARS}" required>${esc(prompt)}</textarea>
      <p>Maximum ${BUSINESS_DRAFT_MAX_CHARS.toLocaleString()} characters. Do not paste passwords, API keys, card data, private keys, or access tokens.</p>
      <button type="submit">Generate draft</button>
    </form>
  </article>`;

  const sections = [
    brandCard("OpenAI / ChatGPT", `${openai.status === "configured" ? `Ready with ${openai.model}.` : "Setup required."} ${openai.detail || ""}`),
    brandCard("Anthropic Claude", `${anthropic.status === "configured" ? `Ready with ${anthropic.model}.` : "Setup required."} ${anthropic.detail || ""}`),
    brandCard("Authority boundary", "This is drafting only. Nothing produced here is sent to customers, published, saved to a customer record, used to change billing, or treated as owner approval."),
    form
  ];

  if (error) sections.unshift(brandCard("Draft not generated", error));
  if (result?.text) {
    sections.unshift(`<article class="card sonara-depth" data-sonara-enter>
      <h2>Draft from ${esc(result.provider)} / ${esc(result.model)}</h2>
      <p>Review and edit this before using it. Nothing has been sent, published, approved, or saved.</p>
      <textarea rows="18" readonly>${esc(result.text)}</textarea>
    </article>`);
  }

  return layout({
    title: "Business model drafting",
    eyebrow: "Founder operations",
    heading: "Business drafting with Claude or ChatGPT",
    body: "Use an explicitly configured hosted provider for a reviewable draft while SONARA keeps deterministic rules as the default and keeps consequential actions behind their existing approval gates.",
    sections,
    actions: [
      linkAction("/admin/ai-integrations", "AI integrations"),
      linkAction("/admin", "Admin")
    ]
  });
}

function option(value, label, selected, disabled) {
  return `<option value="${esc(value)}"${selected === value ? " selected" : ""}${disabled ? " disabled" : ""}>${esc(label)}</option>`;
}

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

module.exports.BUSINESS_DRAFT_MAX_CHARS = BUSINESS_DRAFT_MAX_CHARS;
module.exports.BUSINESS_DRAFT_MAX_OUTPUT_TOKENS = BUSINESS_DRAFT_MAX_OUTPUT_TOKENS;
