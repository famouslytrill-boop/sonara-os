"use strict";

const {
  getPublicRequestedRepositoryCatalog,
  getRequestedRepositoryReadiness
} = require("../lib/sonara-requested-repository-registry.cjs");

module.exports = function registerSonaraRequestedRepositoryRoutes(app, deps = {}) {
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;
  const requireAdmin = typeof deps.requireAdmin === "function" ? deps.requireAdmin : pass;
  const recordAdminAuditEvent = typeof deps.recordAdminAuditEvent === "function"
    ? deps.recordAdminAuditEvent
    : async () => undefined;

  app.get("/api/ecosystem/requested-repositories", (req, res) => {
    const repositories = getPublicRequestedRepositoryCatalog();
    res.status(200).json({
      ok: true,
      status: "governed_catalog",
      repositoryCount: repositories.length,
      verifiedCount: repositories.filter((item) => item.repositoryVerified).length,
      blockedCount: repositories.filter((item) => item.integrationStatus === "blocked").length,
      repositories
    });
  });

  app.get("/research-lab/requested-repositories", (req, res) => {
    const repositories = getPublicRequestedRepositoryCatalog();
    const verified = repositories.filter((item) => item.repositoryVerified).length;
    const blocked = repositories.filter((item) => item.integrationStatus === "blocked").length;
    const sections = [
      brandCard("Verified sources", `${verified} requested projects were matched to authoritative repositories and classified for controlled adoption.`),
      brandCard("Rejected sources", `${blocked} supplied links remain blocked because the repository or claimed project could not be verified.`),
      brandCard("Production boundary", "No third-party repository is cloned, installed, executed, or enabled in the production web process by this catalog."),
      ...repositories.map((item) => brandCard(
        `${item.label}: ${display(item.integrationStatus)}`,
        publicSummary(item)
      ))
    ];

    res.status(200).type("html").send(layout({
      title: "Requested repository integrations",
      eyebrow: "Research Lab",
      heading: "Governed external repository intake",
      body: "Verified repository identities, intended SONARA placement, license posture, safety boundaries, and staged next actions.",
      sections,
      actions: [
        linkAction("/api/ecosystem/requested-repositories", "Catalog JSON"),
        linkAction("/research-lab/open-source", "Open-source research"),
        linkAction("/", "SONARA home")
      ]
    }));
  });

  app.get("/api/admin/requested-repositories/readiness", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.requested_repositories.probe", { path: req.path });
    res.status(200).json(getRequestedRepositoryReadiness());
  });

  app.get("/admin/requested-repositories", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.requested_repositories.view", { path: req.path });
    const readiness = getRequestedRepositoryReadiness();
    const sections = [
      brandCard("Governed intake", `${readiness.repositoryCount} requested repositories cataloged; ${readiness.verifiedCount} verified and ${readiness.blockedCount} blocked.`),
      brandCard("Execution state", `${readiness.productionExecutionCount} repositories enabled in production. All current records remain non-executing and human-reviewed.`),
      brandCard("Adoption rule", "Desktop tools, CLIs, coding agents, document binaries, skill libraries, and security tools require isolated workers or development environments—not the Vercel request process."),
      ...readiness.repositories.map((item) => brandCard(
        `${item.label}: ${display(item.configurationStatus)}`,
        adminSummary(item)
      ))
    ];

    res.status(200).type("html").send(layout({
      title: "Requested repository readiness",
      eyebrow: "Founder operations",
      heading: "External repository integration control plane",
      body: "Static readiness and governance state. This page never executes external code or reveals credentials.",
      sections,
      actions: [
        linkAction("/api/admin/requested-repositories/readiness", "Readiness JSON"),
        linkAction("/api/ecosystem/requested-repositories", "Public catalog JSON"),
        linkAction("/admin/ai-integrations", "AI integrations"),
        linkAction("/admin/ecosystem", "Ecosystem")
      ]
    }));
  });
};

function publicSummary(item) {
  const source = item.repositoryVerified
    ? `Source: ${item.repository}.`
    : `Requested source is unverified and blocked.`;
  const correction = item.sourceCorrection ? ` ${item.sourceCorrection}` : "";
  const capabilities = item.capabilities.length ? ` Capabilities: ${item.capabilities.join(", ")}.` : "";
  return `${source}${correction} Class: ${display(item.runtimeClass)}. Placement: ${item.placement}. License: ${item.license}.${capabilities} Next: ${item.nextStep}`;
}

function adminSummary(item) {
  const source = item.repository || item.requestedRepository;
  return `Source: ${source}. Runtime: ${display(item.runtimeStatus)}. Policy: ${display(item.integrationStatus)}. Production enabled: no. Risk: ${display(item.licenseRisk)}. Human review required. Next: ${item.nextStep}`;
}

function display(value) {
  return String(value || "unknown").replace(/_/g, " ");
}

function pass(req, res, next) { next(); }
function esc(value) { return String(value || "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }
function card(title, body) { return `<article class="card"><h2>${esc(title)}</h2><p>${esc(body)}</p></article>`; }
function link(href, label) { return `<a class="action" href="${esc(href)}">${esc(label)}</a>`; }
function basicLayout(data) { return `<!doctype html><html><head><title>${esc(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><p>${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p>${esc(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section></main></body></html>`; }
