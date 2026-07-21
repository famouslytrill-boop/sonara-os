"use strict";

const {
  getPublicAIIntegrationCatalog,
  getAIIntegrationReadiness
} = require("../lib/sonara-ai-integration-registry.cjs");

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

  app.get("/api/admin/ai-integrations/readiness", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.ai_integrations.probe", { path: req.path });
    const readiness = await getAIIntegrationReadiness({ probe: true });
    res.status(200).json(readiness);
  });

  app.get("/admin/ai-integrations", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.ai_integrations.view", { path: req.path });
    const readiness = await getAIIntegrationReadiness({ probe: true });
    const configured = readiness.integrations.filter((item) => item.configurationStatus === "configured").length;
    const ready = readiness.integrations.filter((item) => item.runtimeStatus === "ready").length;
    const sections = [
      brandCard("Governed catalog", `${readiness.integrationCount} tools are classified. Eight have opt-in HTTP adapters; model, framework, and developer CLI entries remain bounded to their proper runtime.`),
      brandCard("Runtime state", `${configured} adapters configured; ${ready} live probes ready. Disabled and setup-required states do not block SONARA launch.`),
      brandCard("Safety contract", "Credentials stay server-side. Probes are read-only, bounded, admin-only, and never execute workflows, tools, agents, prompts, or customer jobs."),
      ...readiness.integrations.map((item) => brandCard(
        `${item.label}: ${display(item.runtimeStatus)}`,
        integrationSummary(item)
      ))
    ];

    res.status(200).type("html").send(layout({
      title: "AI integrations",
      eyebrow: "Founder operations",
      heading: "Governed AI integration control plane",
      body: "Operational readiness for optional AI services, local model infrastructure, worker frameworks, and developer tools. No secret values are displayed.",
      sections,
      actions: [
        linkAction("/api/admin/ai-integrations/readiness", "Readiness JSON"),
        linkAction("/api/ecosystem/ai-integrations", "Public catalog JSON"),
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
