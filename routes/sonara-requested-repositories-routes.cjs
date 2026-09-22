// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
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

const {
  getPublicScreenshotToolCatalogBatch12,
  getScreenshotToolReadinessBatch12,
  getNonRepositoryReferencesBatch12,
  getConductRefusalsBatch12,
  getConfirmedExistingRecordsBatch12
} = require("../lib/sonara-screenshot-tool-radar-batch12.cjs");
// Batch 13 was recorded on 16 September 2026 and wired here on 21 September.
// In between, this file required batches 12 and 14 with nothing between them,
// so four verified repository records and two non-repository references never
// reached the Research Lab catalog or any readiness count -- while
// `productionExecutionCount` was reported as covering all screenshot intake.
// `tests/every-screenshot-radar-batch-reaches-the-route.test.js` now fails when
// a batch module exists and this file does not name it.
const {
  getPublicScreenshotToolCatalogBatch13,
  getScreenshotToolReadinessBatch13,
  getNonRepositoryReferencesBatch13
} = require("../lib/sonara-screenshot-tool-radar-batch13.cjs");
const {
  getPublicScreenshotToolCatalogBatch14,
  getScreenshotToolReadinessBatch14,
  getNonRepositoryReferencesBatch14,
  getConfirmedExistingRecordsBatch14
} = require("../lib/sonara-screenshot-tool-radar-batch14.cjs");
const {
  getPublicScreenshotToolCatalogBatch15,
  getScreenshotToolReadinessBatch15,
  getNonRepositoryReferencesBatch15
} = require("../lib/sonara-screenshot-tool-radar-batch15.cjs");
const {
  getPublicScreenshotToolCatalogBatch16,
  getScreenshotToolReadinessBatch16,
  getNonRepositoryReferencesBatch16,
  getConfirmedExistingRecordsBatch16,
  getArchitectureExtensionsBatch16
} = require("../lib/sonara-screenshot-tool-radar-batch16.cjs");
const {
  getCapabilityDesignReadiness
} = require("../lib/sonara-capability-design-batches.cjs");
const {
  getSeptember19PatternConvergence
} = require("../lib/sonara-september19-pattern-convergence.cjs");

module.exports = function registerSonaraRequestedRepositoryRoutes(app, deps = {}) {
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;
  const requireAdmin = typeof deps.requireAdmin === "function" ? deps.requireAdmin : pass;
  const recordAdminAuditEvent = typeof deps.recordAdminAuditEvent === "function"
    ? deps.recordAdminAuditEvent
    : async () => undefined;

  app.get("/api/ecosystem/platform-patterns", (req, res) => {
    res.status(200).json(getSeptember19PatternConvergence());
  });

  app.get("/api/ecosystem/requested-repositories", (req, res) => {
    const repositories = getCombinedPublicCatalog();
    const unresolvedVisualLeads = getUnverifiedScreenshotLeadsBatch2();
    const nonRepositoryReferences = getAllNonRepositoryReferences();
    const confirmedExistingRecords = getAllConfirmedExistingRecords();
    res.status(200).json({
      ok: true,
      status: "governed_catalog",
      repositoryCount: repositories.length,
      verifiedCount: repositories.filter((item) => item.repositoryVerified).length,
      blockedCount: repositories.filter((item) => item.integrationStatus === "blocked").length,
      screenshotResearchCount: getScreenshotResearchCount(),
      unresolvedVisualLeadCount: unresolvedVisualLeads.length,
      nonRepositoryReferenceCount: nonRepositoryReferences.length,
      confirmedExistingRecordCount: confirmedExistingRecords.length,
      repositories,
      unresolvedVisualLeads,
      nonRepositoryReferences,
      confirmedExistingRecords
    });
  });

  app.get("/research-lab/requested-repositories", (req, res) => {
    const repositories = getCombinedPublicCatalog();
    const unresolvedVisualLeads = getUnverifiedScreenshotLeadsBatch2();
    const nonRepositoryReferences = getAllNonRepositoryReferences();
    const convergence = getCapabilityDesignReadiness();
    const verified = repositories.filter((item) => item.repositoryVerified).length;
    const blocked = repositories.filter((item) => item.integrationStatus === "blocked").length;
    const screenshotResearchCount = getScreenshotResearchCount();
    const sections = [
      brandCard("Verified sources", `${verified} requested projects were matched to authoritative repositories and classified for controlled adoption.`),
      brandCard("Screenshot research", `${screenshotResearchCount} additional developer, design, media, security, research, infrastructure, document, social, 3D, GPU, AI-workspace, and agent tools supplied as screenshots are cataloged as non-executing research records; verification state remains explicit per record.`),
      brandCard("Capability convergence — Batch 8", `${convergence.batch8Count} truth records describe actual SONARA One, Business Builder, Creator Studio, Growth Studio, Claude, ChatGPT/Codex, and cross-agent delivery capability without enabling anything from the research surface.`),
      brandCard("Design and correctness — Batch 9", `${convergence.batch9Count} current design/correctness records preserve the v3 SONARA One identity, Balanced Precision interaction system, truthful loading/state language, cross-agent authority, and named repair/review work.`),
      brandCard("Latest screenshot intake", "Batch 16 adds verified developer-agent, MCP, browser-worker, schema-design, local capture, visualization, market/media, ARM64 and Physical AI references while preserving non-execution, licence, privacy, tenant, and release boundaries."),
      brandCard("Hosted/service references", `${nonRepositoryReferences.length} screenshot items are kept as hosted services, learning references, or unresolved non-repository leads outside the executable repository catalog.`),
      brandCard("Unresolved visual leads", `${unresolvedVisualLeads.length} screenshot concepts remain intentionally unlinked until the exact upstream repository and license can be verified.`),
      brandCard("Rejected sources", `${blocked} supplied links remain blocked because the repository or claimed project could not be verified.`),
      brandCard("Production boundary", "No third-party repository is cloned, installed, executed, or enabled in the production web process by this catalog."),
      ...convergence.capabilities.map((item) => brandCard(
        `${item.label}: ${display(item.capabilityStatus)}`,
        `${item.capabilities.join("; ")}. Boundary: ${item.boundaries.join(" ")}`
      )),
      ...convergence.designs.map((item) => brandCard(
        `${item.label}: ${display(item.status)}`,
        item.rule
      )),
      ...nonRepositoryReferences.map((item) => brandCard(
        `${item.label}: reference only`,
        `${item.observedTheme}. ${item.reason} Next: ${item.nextStep}`
      )),
      ...getArchitectureExtensionsBatch16().map((item) => brandCard(
        `${item.title}: Batch 16 architecture`,
        `${item.principle} SONARA implementation: ${item.implementation}`
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
      body: "Verified repository identities, intended SONARA placement, license posture, safety boundaries, staged next actions, hosted-service references, explicitly unresolved screenshot leads, and non-executing capability/design convergence records.",
      sections,
      actions: [
        linkAction("/research-lab/latest-screenshot-intake", "Latest screenshot intake"),
        linkAction("/api/ecosystem/requested-repositories", "Catalog JSON"),
        linkAction("/api/ecosystem/platform-patterns", "Platform patterns JSON"),
        linkAction("/research-batch15-platform-patterns.html", "Architecture patterns"),
        linkAction("/research-lab/open-source", "Open-source research"),
        linkAction("/", "SONARA home")
      ]
    }));
  });

  app.get("/research-lab/latest-screenshot-intake", (req, res) => {
    const latest = getLatestScreenshotIntake();
    const convergence = getCapabilityDesignReadiness();
    const sections = [
      brandCard("Repository records", `${latest.repositories.length} current screenshot-research repositories, including Batch 16, are classified for product fit, verification state, license risk, runtime boundary, and staged next action.`),
      brandCard("Batch 8 capability truth", `${convergence.batch8Count} internal records separate available, setup-gated, development-compatible, and research-ready capability states across SONARA and its agent workflows.`),
      brandCard("Batch 9 design/correctness", `${convergence.batch9Count} records define the current v3 design authority and the repair/review items that must not be marketed as complete.`),
      brandCard("Hosted/platform references", `${latest.nonRepositoryReferences.length} hosted or platform references remain outside the executable repository catalog.`),
      brandCard("Deduplicated references", `${latest.deduplicatedReferences.length} submitted items were already represented in earlier governed records and were not duplicated.`),
      brandCard("Earlier confirmations", `${latest.confirmedExistingRecords.length} submitted projects were already covered by governed records and were re-confirmed instead of duplicated.`),
      brandCard("Batch 16 architecture extensions", `${latest.architectureExtensions.length} repository-owned architecture decisions convert the new research into bounded tool-gateway, developer-agent, multi-agent, evidence-capture, schema, browser-verification, and specialized-runtime rules.`),
      brandCard("Execution state", "0 latest-intake repositories are enabled by this research surface. Cataloging and capability/design documentation are not installation, deployment, or permission to send customer data."),
      ...convergence.capabilities.map((item) => brandCard(
        `${item.label}: ${display(item.capabilityStatus)}`,
        `${item.capabilities.join("; ")}. ${item.boundaries.join(" ")}`
      )),
      ...convergence.designs.map((item) => brandCard(
        `${item.label}: ${display(item.status)}`,
        item.rule
      )),
      ...latest.nonRepositoryReferences.map((item) => brandCard(
        `${item.label}: reference only`,
        `${item.observedTheme || item.status}. ${item.reason || item.correction || "Hosted/platform reference only."} Next: ${item.nextStep}`
      )),
      ...latest.architectureExtensions.map((item) => brandCard(
        `${item.title}: Batch 16 architecture`,
        `${item.principle} SONARA implementation: ${item.implementation}`
      )),
      ...latest.repositories.map((item) => brandCard(
        `${item.label}: ${display(item.integrationStatus)}`,
        publicSummary(item)
      ))
    ];

    res.status(200).type("html").send(layout({
      title: "Latest screenshot research",
      eyebrow: "Research Lab",
      heading: "Governed screenshot intake and convergence",
      body: "The Research Lab preserves verified external leads through Batch 16, internal capability/design authority, and explicit adoption boundaries. None of these records widens runtime authority by itself.",
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
      brandCard("Batch 8 capability truth", `${readiness.capabilityBatch8.length} internal capability records distinguish actual runtime capability from setup-gated or research-only agent integration.`),
      brandCard("Batch 9 design/correctness", `${readiness.designBatch9.length} design and correctness records define current visual authority and unresolved repair/review work.`),
      brandCard("Latest screenshot intake", "Aggregate repository readiness now covers Batch 16 developer-agent, MCP, browser, schema, capture, visualization, market/media, ARM64, and Physical AI research while preserving the earlier system-design, security, licensing, tenant, and memory boundaries. Batches 8 and 9 remain separate internal capability/design convergence records."),
      brandCard("Hosted/service references", `${readiness.nonRepositoryReferenceCount} hosted/service references are kept outside the executable repository catalog.`),
      brandCard("Unresolved visual leads", `${readiness.unresolvedVisualLeadCount} screenshot concepts are held outside the executable repository catalog until exact upstream identity and license can be verified.`),
      brandCard("Execution state", `${readiness.productionExecutionCount} repositories enabled in production. All current repository-research records remain non-executing and human-reviewed.`),
      brandCard("Adoption rule", "Desktop tools, CLIs, coding agents, document binaries, skill libraries, media renderers, browser agents, GPU libraries, AI workspaces, infrastructure optimizers, model routers, social suites, and security tools require isolated workers, progressive client enhancement, or development environments—not the Vercel request process by default."),
      ...readiness.capabilityBatch8.map((item) => brandCard(
        `${item.label}: ${display(item.capabilityStatus)}`,
        `Evidence: ${item.evidence.join(", ")}. Boundaries: ${item.boundaries.join(" ")}`
      )),
      ...readiness.designBatch9.map((item) => brandCard(
        `${item.label}: ${display(item.status)}`,
        `${item.rule} Evidence: ${item.evidence.join(", ")}.`
      )),
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
      body: "Static readiness and governance state plus internal capability/design convergence. This page never executes external code or reveals credentials.",
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
    const convergence = getCapabilityDesignReadiness();
    const sections = [
      brandCard("Latest governed intake", `${latest.repositories.length} repositories and ${latest.nonRepositoryReferences.length} hosted/institutional references are represented through Batch 16.`),
      brandCard("Batch 8 capability truth", `${convergence.batch8Count} non-executing truth records map current SONARA/product/agent workflow capability.`),
      brandCard("Batch 9 design/correctness", `${convergence.batch9Count} non-executing design and correctness records define the current visual authority and unresolved work.`),
      brandCard("Production execution", "0 enabled by the research/convergence records. Every latest-intake repository remains cataloged-disabled and requires human review before implementation."),
      brandCard("Batch 16 architecture extensions", `${latest.architectureExtensions.length} bounded architecture decisions are attached to the latest intake.`),
      brandCard("Runtime boundaries", "Desktop capture/audio/networking stays on reviewed local companions; browser and MCP tools remain scope/policy gated; media rendering stays in isolated workers; OSINT and market-data projects stay research-only; Physical AI remains simulator-first and safety-gated."),
      ...convergence.capabilities.map((item) => brandCard(
        `${item.label}: ${display(item.capabilityStatus)}`,
        `Evidence: ${item.evidence.join(", ")}. ${item.boundaries.join(" ")}`
      )),
      ...convergence.designs.map((item) => brandCard(
        `${item.label}: ${display(item.status)}`,
        `${item.rule} Evidence: ${item.evidence.join(", ")}.`
      )),
      ...latest.architectureExtensions.map((item) => brandCard(
        `${item.title}: Batch 16 architecture`,
        `${item.principle} SONARA implementation: ${item.implementation}`
      )),
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
      heading: "External-tool and capability review through Batch 16",
      body: "Founder-facing readiness for the newest repository research plus Batch 8 capability truth and Batch 9 design/correctness convergence. This surface is informational and never executes third-party code.",
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
  const batch12 = getScreenshotToolReadinessBatch12();
  const batch13 = getScreenshotToolReadinessBatch13();
  const batch14 = getScreenshotToolReadinessBatch14();
  const batch15 = getScreenshotToolReadinessBatch15();
  const batch16 = getScreenshotToolReadinessBatch16();
  return {
    repositories: [
      ...batch5.repositories,
      ...batch6.repositories,
      ...batch7.repositories,
      ...batch12.repositories,
      ...batch13.repositories,
      ...batch14.repositories,
      ...batch15.repositories,
      ...batch16.repositories
    ],
    nonRepositoryReferences: [
      ...(batch5.nonRepositoryReferences || []),
      ...getNonRepositoryReferencesBatch6(),
      ...getNonRepositoryReferencesBatch7(),
      ...getNonRepositoryReferencesBatch12(),
      ...getNonRepositoryReferencesBatch13(),
      ...getNonRepositoryReferencesBatch14(),
      ...getNonRepositoryReferencesBatch15(),
      ...getNonRepositoryReferencesBatch16()
    ].filter((item) => item.key !== "searchphone"),
    deduplicatedReferences: batch5.deduplicatedReferences || [],
    // Refused for what using them would do rather than for what their licence
    // says -- three of the five are permissively licensed, so filing them as
    // licence problems would imply a relicence could unblock them.
    conductRefusals: getConductRefusalsBatch12(),
    confirmedExistingRecords: getAllConfirmedExistingRecords(),
    architectureExtensions: getArchitectureExtensionsBatch16()
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
    ...getPublicScreenshotToolCatalogBatch7(),
    ...getPublicScreenshotToolCatalogBatch12(),
    ...getPublicScreenshotToolCatalogBatch13(),
    ...getPublicScreenshotToolCatalogBatch14(),
    ...getPublicScreenshotToolCatalogBatch15(),
    ...getPublicScreenshotToolCatalogBatch16()
  ];
}

function getScreenshotResearchCount() {
  return getPublicScreenshotToolCatalog().length
    + getPublicScreenshotToolCatalogBatch2().length
    + getPublicScreenshotToolCatalogBatch3().length
    + getPublicScreenshotToolCatalogBatch4().length
    + getScreenshotToolReadinessBatch5().repositoryCount
    + getScreenshotToolReadinessBatch6().repositoryCount
    + getPublicScreenshotToolCatalogBatch7().length
    + getPublicScreenshotToolCatalogBatch12().length
    + getPublicScreenshotToolCatalogBatch13().length
    + getPublicScreenshotToolCatalogBatch14().length
    + getPublicScreenshotToolCatalogBatch15().length
    + getPublicScreenshotToolCatalogBatch16().length;
}

function getAllNonRepositoryReferences() {
  const batch5 = getScreenshotToolReadinessBatch5();
  return [
    ...getNonRepositoryReferencesBatch3(),
    ...(batch5.nonRepositoryReferences || []),
    ...getNonRepositoryReferencesBatch6(),
    ...getNonRepositoryReferencesBatch7(),
    ...getNonRepositoryReferencesBatch12(),
    ...getNonRepositoryReferencesBatch13(),
    ...getNonRepositoryReferencesBatch14(),
    ...getNonRepositoryReferencesBatch15(),
    ...getNonRepositoryReferencesBatch16()
  ].filter((item) => item.key !== "searchphone");
}

function getAllConfirmedExistingRecords() {
  return [
    ...getConfirmedExistingRecordsBatch12(),
    ...getConfirmedExistingRecordsBatch14(),
    ...getConfirmedExistingRecordsBatch16()
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
  const screenshotBatch12 = getScreenshotToolReadinessBatch12();
  const screenshotBatch13 = getScreenshotToolReadinessBatch13();
  const screenshotBatch14 = getScreenshotToolReadinessBatch14();
  const screenshotBatch15 = getScreenshotToolReadinessBatch15();
  const screenshotBatch16 = getScreenshotToolReadinessBatch16();
  const convergence = getCapabilityDesignReadiness();
  const unresolvedVisualLeads = getUnverifiedScreenshotLeadsBatch2();
  const nonRepositoryReferences = getAllNonRepositoryReferences();
  const confirmedExistingRecords = getAllConfirmedExistingRecords();
  const repositories = [
    ...requested.repositories,
    ...screenshot.repositories,
    ...screenshotBatch2.repositories,
    ...screenshotBatch3.repositories,
    ...screenshotBatch4.repositories,
    ...screenshotBatch5.repositories,
    ...screenshotBatch6.repositories,
    ...screenshotBatch7.repositories,
    ...screenshotBatch12.repositories,
    ...screenshotBatch13.repositories,
    ...screenshotBatch14.repositories,
    ...screenshotBatch15.repositories,
    ...screenshotBatch16.repositories
  ];
  return {
    ok: true,
    mode: "static_governed_catalog_with_capability_design_convergence",
    repositoryCount: repositories.length,
    verifiedCount: repositories.filter((item) => item.repositoryVerified).length,
    blockedCount: repositories.filter((item) => item.integrationStatus === "blocked").length,
    screenshotResearchCount: screenshot.repositoryCount
      + screenshotBatch2.repositoryCount
      + screenshotBatch3.repositoryCount
      + screenshotBatch4.repositoryCount
      + screenshotBatch5.repositoryCount
      + screenshotBatch6.repositoryCount
      + screenshotBatch7.repositoryCount
      + screenshotBatch12.repositoryCount
      + screenshotBatch13.repositoryCount
      + screenshotBatch14.repositoryCount
      + screenshotBatch15.repositoryCount
      + screenshotBatch16.repositoryCount,
    unresolvedVisualLeadCount: unresolvedVisualLeads.length,
    nonRepositoryReferenceCount: nonRepositoryReferences.length,
    confirmedExistingRecordCount: confirmedExistingRecords.length,
    productionExecutionCount: repositories.filter((item) => item.enabledInProduction).length,
    capabilityBatch8: convergence.capabilities,
    designBatch9: convergence.designs,
    convergenceProductionExecutionAdded: convergence.productionExecutionAdded,
    repositories,
    unresolvedVisualLeads,
    nonRepositoryReferences,
    confirmedExistingRecords
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
