"use strict";

const {
  getPublicHuggingFaceCatalog,
  getHuggingFaceReadiness
} = require("../lib/sonara-huggingface-catalog.cjs");

module.exports = function registerSonaraHuggingFaceRoutes(app, deps = {}) {
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;
  const requireAdmin = typeof deps.requireAdmin === "function" ? deps.requireAdmin : pass;
  const recordAdminAuditEvent = typeof deps.recordAdminAuditEvent === "function"
    ? deps.recordAdminAuditEvent
    : async () => undefined;

  app.get("/api/ecosystem/huggingface", (req, res) => {
    const resources = getPublicHuggingFaceCatalog();
    const counts = summarize(resources);
    res.status(200).json({
      ok: true,
      status: "governed_catalog",
      resourceCount: resources.length,
      counts,
      resources
    });
  });

  app.get("/research-lab/huggingface", (req, res) => {
    const resources = getPublicHuggingFaceCatalog();
    const counts = summarize(resources);
    const sections = [
      brandCard("Curated scope", `${resources.length} Hugging Face models, datasets, and platform specifications are classified for SONARA.`),
      brandCard("Adoption state", `${counts.pilot_ready || 0} resources are pilot-ready; ${counts.blocked_commercial || 0} are blocked from commercial use; all execution remains disabled by default.`),
      brandCard("Supply-chain boundary", "Model files, dataset files, custom code, and remote installers are never executed by this public catalog. Production use requires an isolated worker, pinned revision, license review, and human approval."),
      ...resources.map((item) => brandCard(
        `${item.label}: ${display(item.adoptionStatus)}`,
        publicSummary(item)
      ))
    ];

    res.status(200).type("html").send(layout({
      title: "Hugging Face resource intelligence",
      eyebrow: "Research Lab",
      heading: "Governed Hugging Face model and dataset catalog",
      body: "Curated models, datasets, specifications, licensing posture, runtime placement, and staged SONARA adoption decisions.",
      sections,
      actions: [
        linkAction("/api/ecosystem/huggingface", "Catalog JSON"),
        linkAction("/research-lab/requested-repositories", "Repository intake"),
        linkAction("/research-lab/open-source", "Open-source research"),
        linkAction("/", "SONARA home")
      ]
    }));
  });

  app.get("/api/admin/huggingface/readiness", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.huggingface.probe", { path: req.path });
    const readiness = await getHuggingFaceReadiness({ probe: true });
    res.status(200).json(readiness);
  });

  app.get("/admin/huggingface", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.huggingface.view", { path: req.path });
    const readiness = await getHuggingFaceReadiness({ probe: true });
    const sections = [
      brandCard("Catalog", `${readiness.resourceCount} resources classified. No model execution or dataset ingestion is enabled by this catalog.`),
      brandCard("Hub readiness", `Configuration: ${display(readiness.hub.configurationStatus)}. Runtime: ${display(readiness.hub.runtimeStatus)}. Token configured: ${readiness.hub.tokenConfigured ? "yes" : "no"}.`),
      brandCard("Production rule", "Only bounded read-only metadata probes are allowed here. Inference, training, dataset ingestion, custom code, and model downloads belong in separately approved workers."),
      ...readiness.resources.map((item) => brandCard(
        `${item.label}: ${display(item.adoptionStatus)}`,
        adminSummary(item)
      ))
    ];

    res.status(200).type("html").send(layout({
      title: "Hugging Face readiness",
      eyebrow: "Founder operations",
      heading: "Hugging Face integration control plane",
      body: "Static governance state plus one bounded metadata health probe. No credentials, model outputs, dataset rows, or customer data are displayed.",
      sections,
      actions: [
        linkAction("/api/admin/huggingface/readiness", "Readiness JSON"),
        linkAction("/api/ecosystem/huggingface", "Public catalog JSON"),
        linkAction("/admin/ai-integrations", "AI integrations"),
        linkAction("/admin/ecosystem", "Ecosystem")
      ]
    }));
  });
};

function summarize(resources) {
  return resources.reduce((summary, item) => {
    summary[item.resourceType] = (summary[item.resourceType] || 0) + 1;
    summary[item.adoptionStatus] = (summary[item.adoptionStatus] || 0) + 1;
    return summary;
  }, {});
}

function publicSummary(item) {
  const productFit = item.productFit.length ? ` Product fit: ${item.productFit.join(", ")}.` : "";
  const capabilities = item.capabilities.length ? ` Capabilities: ${item.capabilities.join(", ")}.` : "";
  return `Type: ${display(item.resourceType)}. Task: ${display(item.task)}. License: ${item.license}. Commercial use: ${display(item.commercialUse)}. Runtime: ${display(item.runtimeClass)}.${productFit}${capabilities} Next: ${item.nextStep}`;
}

function adminSummary(item) {
  return `Source: ${item.sourceUrl}. License: ${item.license}. Commercial use: ${display(item.commercialUse)}. Execution enabled: no. Human review required. Next: ${item.nextStep}`;
}

function display(value) {
  return String(value || "unknown").replace(/_/g, " ");
}

function pass(req, res, next) { next(); }
function esc(value) { return String(value || "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }
function card(title, body) { return `<article class="card"><h2>${esc(title)}</h2><p>${esc(body)}</p></article>`; }
function link(href, label) { return `<a class="action" href="${esc(href)}">${esc(label)}</a>`; }
function basicLayout(data) { return `<!doctype html><html><head><title>${esc(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><p>${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p>${esc(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section></main></body></html>`; }
