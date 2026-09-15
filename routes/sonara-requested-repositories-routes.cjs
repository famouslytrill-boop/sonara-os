"use strict";

const {
  getPublicRequestedRepositoryCatalog,
  getRequestedRepositoryReadiness
} = require("../lib/sonara-requested-repository-registry.cjs");
const {
  getPublicScreenshotToolCatalog,
  getScreenshotToolReadiness
} = require("../lib/sonara-screenshot-tool-radar.cjs");
const {
  getPublicScreenshotToolCatalogBatch2,
  getScreenshotToolReadinessBatch2,
  getUnverifiedScreenshotLeadsBatch2
} = require("../lib/sonara-screenshot-tool-radar-batch2.cjs");
const {
  getPublicScreenshotToolCatalogBatch3,
  getScreenshotToolReadinessBatch3,
  getNonRepositoryReferencesBatch3
} = require("../lib/sonara-screenshot-tool-radar-batch3.cjs");
const {
  getPublicScreenshotToolCatalogBatch4,
  getScreenshotToolReadinessBatch4
} = require("../lib/sonara-screenshot-tool-radar-batch4.cjs");
const {
  getScreenshotToolReadinessBatch5
} = require("../lib/sonara-screenshot-tool-radar-batch5.cjs");
const {
  getScreenshotToolReadinessBatch6,
  getNonRepositoryReferencesBatch6
} = require("../lib/sonara-screenshot-tool-radar-batch6.cjs");
const {
  getPublicScreenshotToolCatalogBatch7,
  getScreenshotToolReadinessBatch7,
  getNonRepositoryReferencesBatch7
} = require("../lib/sonara-screenshot-tool-radar-batch7.cjs");

module.exports = function registerSonaraRequestedRepositoryRoutes(app, deps = {}) {
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;
  const requireAdmin = typeof deps.requireAdmin === "function" ? deps.requireAdmin : pass;
  const recordAdminAuditEvent = typeof deps.recordAdminAuditEvent === "function"
    ? deps.recordAdminAuditEvent
    : async () => undefined;

  app.get("/api/ecosystem/requested-repositories", (req, res) => {
    const repositories = getCombinedPublicCatalog();
    const unresolvedVisualLeads = getUnverifiedScreenshotLeadsBatch2();
    const nonRepositoryReferences = getAllNonRepositoryReferences();
    res.status(200).json({
      ok: true,
      status: "governed_catalog",
      repositoryCount: repositories.length,
      verifiedCount: repositories.filter((item) => item.repositoryVerified).length,
      blockedCount: repositories.filter((item) => item.integrationStatus === "blocked").length,
      screenshotResearchCount: getScreenshotResearchCount(),
      unresolvedVisualLeadCount: unresolvedVisualLeads.length,
      nonRepositoryReferenceCount: nonRepositoryReferences.length,
      repositories,
      unresolvedVisualLeads,
      nonRepositoryReferences
    });
  });

  app.get("/research-lab/requested-repositories", (req, res) => {
    const repositories = getCombinedPublicCatalog();
    const unresolvedVisualLeads = getUnverifiedScreenshotLeadsBatch2();
    const nonRepositoryReferences = getAllNonRepositoryReferences();
    const verified = repositories.filter((item) => item.repositoryVerified).length;
    const blocked = repositories.filter((item) => item.integrationStatus === "blocked").length;
    const screenshotResearchCount = getScreenshotResearchCount();
    const sections = [
      brandCard("Verified sources", `${verified} requested projects were matched to authoritative repositories and classified for controlled adoption.`),
      brandCard("Screenshot research", `${screenshotResearchCount} additional developer, design, media, security, research, infrastructure, document, social, 3D, GPU, AI-workspace, and agent tools supplied as screenshots were verified and added as non-executing research records.`),
      brandCard("Latest screenshot intake", "Batch 5 through Batch 7 appear in this catalog as non-executing research records, and each batch also has its own review page."),
      brandCard("Hosted/service references", `${nonRepositoryReferences.length} screenshot items were verified as hosted services or learning references and intentionally kept outside the executable repository catalog.`),
      brandCard("Unresolved visual leads", `${unresolvedVisualLeads.length} screenshot concepts remain intentionally unlinked until the exact upstream repository and license can be verified.`),
      brandCard("Rejected sources", `${blocked} supplied links remain blocked because the repository or claimed project could not be verified.`),
      brandCard("Production boundary", "No third-party repository is cloned, installed, executed, or enabled in the production web process by this catalog."),
      ...nonRepositoryReferences.map((item) => brandCard(
        `${item.label}: reference only`,
        `${item.observedTheme}. ${item.reason} Next: ${item.nextStep}`
      )),
      ...unresolvedVisualLeads.map((item) => brandCard(
        `${item.label}: source pending`,
        `${item.observedTheme}. ${item.reason} Next: ${item.nextStep}`
      )),
      ...repositories.map((item) => brandCard(
        `${item.label}: ${display(item.integrationStatus)}`,
        publicSummary(item)
      ))
    ];

    res.status(200).type("html").send(layout({
      title: "Requested repository integrations",
      eyebrow: "Research Lab",
      heading: "Governed external repository intake",
      body: "Verified repository identities, intended SONARA placement, license posture, safety boundaries, staged next actions, hosted-service references, and explicitly unresolved screenshot leads.",
      sections,
      actions: [
        linkAction("/research-lab/latest-screenshot-intake", "Latest screenshot intake"),
        linkAction("/api/ecosystem/requested-repositories", "Catalog JSON"),
        linkAction("/research-lab/open-source", "Open-source research"),
        linkAction("/", "SONARA home")
      ]
    }));
  });

  app.get("/research-lab/latest-screenshot-intake", (req, res) => {
    const latest = getLatestScreenshotIntake();
    const sections = [
      brandCard("Verified repository records", `${latest.repositories.length} Batch 5 through Batch 7 repositories are classified for product fit, license risk, runtime boundary, and staged next action.`),
      brandCard("Hosted/platform references", `${latest.nonRepositoryReferences.length} hosted or platform references remain outside the executable repository catalog.`),
      brandCard("Deduplicated references", `${latest.deduplicatedReferences.length} submitted items were already represented in earlier governed records and were not duplicated.`),
      brandCard("Execution state", "0 latest-intake repositories are enabled by this research surface. Cataloging is not installation, deployment, or permission to send customer data."),
      ...latest.nonRepositoryReferences.map((item) => brandCard(
        `${item.label}: reference only`,
        `${item.observedTheme || item.status}. ${item.reason || item.correction || "Hosted/platform reference only."} Next: ${item.nextStep}`
      )),
      ...latest.repositories.map((item) => brandCard(
        `${item.label}: ${display(item.integrationStatus)}`,
        publicSummary(item)
      ))
    ];

    res.status(200).type("html").send(layout({
      title: "Latest screenshot research",
      eyebrow: "Research Lab",
      heading: "2026-09-15 governed screenshot intake",
      body: "Batch 5 through Batch 7 preserve useful product and infrastructure ideas while keeping reciprocal licenses, privacy-sensitive OSINT, financial trading, capture permissions, desktop-only runtimes, and hosted services behind explicit review boundaries.",
      sections,
      actions: [
        linkAction("/research-lab/requested-repositories", "Repository intake"),
        linkAction("/research-lab/open-source", "Open-source research"),
        linkAction("/", "SONARA home")
      ]
    }));
  });

  app.get("/api/admin/requested-repositories/readiness", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.requested_repositories.probe", { path: req.path });
    res.status(200).json(getCombinedReadiness());
  });

  app.get("/admin/requested-repositories", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.requested_repositories.view", { path: req.path });
    const readiness = getCombinedReadiness();
    const sections = [
      brandCard("Governed intake", `${readiness.repositoryCount} requested repositories cataloged; ${readiness.verifiedCount} verified and ${readiness.blockedCount} blocked.`),
      brandCard("Screenshot research", `${readiness.screenshotResearchCount} screenshot-sourced tools are cataloged as disabled research records with product-fit and safety boundaries.`),
      brandCard("Latest screenshot intake", "Batch 5 through Batch 7 are counted in the readiness figures above and remain listed on a focused founder review surface."),
      brandCard("Hosted/service references", `${readiness.nonRepositoryReferenceCount} verified hosted/service references are kept outside the executable repository catalog.`),
      brandCard("Unresolved visual leads", `${readiness.unresolvedVisualLeadCount} screenshot concepts are held outside the executable repository catalog until exact upstream identity and license can be verified.`),
      brandCard("Execution state", `${readiness.productionExecutionCount} repositories enabled in production. All current records remain non-executing and human-reviewed.`),
      brandCard("Adoption rule", "Desktop tools, CLIs, coding agents, document binaries, skill libraries, media renderers, browser agents, GPU libraries, AI workspaces, infrastructure optimizers, model routers, social suites, and security tools require isolated workers, progressive client enhancement, or development environments—not the Vercel request process by default."),
      ...readiness.nonRepositoryReferences.map((item) => brandCard(
        `${item.label}: reference only`,
        `${item.reason} Next: ${item.nextStep}`
      )),
      ...readiness.unresolvedVisualLeads.map((item) => brandCard(
        `${item.label}: source pending`,
        `${item.reason} Next: ${item.nextStep}`
      )),
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
        linkAction("/admin/latest-screenshot-intake", "Latest screenshot readiness"),
        linkAction("/api/admin/requested-repositories/readiness", "Readiness JSON"),
        linkAction("/api/ecosystem/requested-repositories", "Public catalog JSON"),
        linkAction("/admin/ai-integrations", "AI integrations"),
        linkAction("/admin/ecosystem", "Ecosystem")
      ]
    }));
  });

  app.get("/admin/latest-screenshot-intake", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.latest_screenshot_intake.view", { path: req.path });
    const latest = getLatestScreenshotIntake();
    const sections = [
      brandCard("Latest governed intake", `${latest.repositories.length} repositories and ${latest.nonRepositoryReferences.length} hosted/platform references are represented across Batch 5 through Batch 7.`),
      brandCard("Production execution", "0 enabled. Every latest-intake repository remains cataloged-disabled and requires human review before implementation."),
      brandCard("Runtime boundaries", "Desktop capture/audio/networking stays on reviewed local companions; media rendering stays in isolated workers; OSINT and financial-trading projects stay research-only; diagram rendering must sanitize structured inputs."),
      ...latest.repositories.map((item) => brandCard(
        `${item.label}: ${display(item.configurationStatus)}`,
        adminSummary(item)
      )),
      ...latest.nonRepositoryReferences.map((item) => brandCard(
        `${item.label}: reference only`,
        `${item.reason || item.correction || item.observedTheme}. Next: ${item.nextStep}`
      ))
    ];

    res.status(200).type("html").send(layout({
      title: "Latest screenshot readiness",
      eyebrow: "Founder operations",
      heading: "2026-09-15 external-tool review",
      body: "Founder-facing readiness for the newest screenshot research. This surface is informational and never executes third-party code.",
      sections,
      actions: [
        linkAction("/research-lab/latest-screenshot-intake", "Public research view"),
        linkAction("/admin/requested-repositories", "All repository readiness"),
        linkAction("/admin/ecosystem", "Ecosystem")
      ]
    }));
  });
};

function getLatestScreenshotIntake() {
  const batch5 = getScreenshotToolReadinessBatch5();
  const batch6 = getScreenshotToolReadinessBatch6();
  const batch7 = getScreenshotToolReadinessBatch7();
  return {
    repositories: [...batch5.repositories, ...batch6.repositories, ...batch7.repositories],
    nonRepositoryReferences: [
      ...(batch5.nonRepositoryReferences || []),
      ...getNonRepositoryReferencesBatch6(),
      ...getNonRepositoryReferencesBatch7()
    ],
    deduplicatedReferences: batch5.deduplicatedReferences || []
  };
}

function getCombinedPublicCatalog() {
  return [
    ...getPublicRequestedRepositoryCatalog(),
    ...getPublicScreenshotToolCatalog(),
    ...getPublicScreenshotToolCatalogBatch2(),
    ...getPublicScreenshotToolCatalogBatch3(),
    ...getPublicScreenshotToolCatalogBatch4(),
    ...getScreenshotToolReadinessBatch5().repositories,
    ...getScreenshotToolReadinessBatch6().repositories,
    ...getPublicScreenshotToolCatalogBatch7()
  ];
}

function getScreenshotResearchCount() {
  return getPublicScreenshotToolCatalog().length
    + getPublicScreenshotToolCatalogBatch2().length
    + getPublicScreenshotToolCatalogBatch3().length
    + getPublicScreenshotToolCatalogBatch4().length
    + getScreenshotToolReadinessBatch5().repositoryCount
    + getScreenshotToolReadinessBatch6().repositoryCount
    + getPublicScreenshotToolCatalogBatch7().length;
}

function getAllNonRepositoryReferences() {
  const batch5 = getScreenshotToolReadinessBatch5();
  return [
    ...getNonRepositoryReferencesBatch3(),
    ...(batch5.nonRepositoryReferences || []),
    ...getNonRepositoryReferencesBatch6(),
    ...getNonRepositoryReferencesBatch7()
  ];
}

function getCombinedReadiness() {
  const requested = getRequestedRepositoryReadiness();
  const screenshot = getScreenshotToolReadiness();
  const screenshotBatch2 = getScreenshotToolReadinessBatch2();
  const screenshotBatch3 = getScreenshotToolReadinessBatch3();
  const screenshotBatch4 = getScreenshotToolReadinessBatch4();
  const screenshotBatch5 = getScreenshotToolReadinessBatch5();
  const screenshotBatch6 = getScreenshotToolReadinessBatch6();
  const screenshotBatch7 = getScreenshotToolReadinessBatch7();
  const unresolvedVisualLeads = getUnverifiedScreenshotLeadsBatch2();
  const nonRepositoryReferences = getAllNonRepositoryReferences();
  const repositories = [
    ...requested.repositories,
    ...screenshot.repositories,
    ...screenshotBatch2.repositories,
    ...screenshotBatch3.repositories,
    ...screenshotBatch4.repositories,
    ...screenshotBatch5.repositories,
    ...screenshotBatch6.repositories,
    ...screenshotBatch7.repositories
  ];
  return {
    ok: true,
    mode: "static_governed_catalog",
    repositoryCount: repositories.length,
    verifiedCount: repositories.filter((item) => item.repositoryVerified).length,
    blockedCount: repositories.filter((item) => item.integrationStatus === "blocked").length,
    screenshotResearchCount: screenshot.repositoryCount + screenshotBatch2.repositoryCount + screenshotBatch3.repositoryCount + screenshotBatch4.repositoryCount + screenshotBatch5.repositoryCount + screenshotBatch6.repositoryCount + screenshotBatch7.repositoryCount,
    unresolvedVisualLeadCount: unresolvedVisualLeads.length,
    nonRepositoryReferenceCount: nonRepositoryReferences.length,
    productionExecutionCount: repositories.filter((item) => item.enabledInProduction).length,
    repositories,
    unresolvedVisualLeads,
    nonRepositoryReferences
  };
}

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
