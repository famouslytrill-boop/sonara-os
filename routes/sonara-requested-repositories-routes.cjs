// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const {
  getPublicRequestedRepositoryCatalog,
} = require("../lib/sonara-requested-repository-registry.cjs");
const {
  getPublicScreenshotToolCatalog,
} = require("../lib/sonara-screenshot-tool-radar.cjs");
const {
  getPublicScreenshotToolCatalogBatch2,
  getUnverifiedScreenshotLeadsBatch2
} = require("../lib/sonara-screenshot-tool-radar-batch2.cjs");
const {
  getPublicScreenshotToolCatalogBatch3,
  getNonRepositoryReferencesBatch3
} = require("../lib/sonara-screenshot-tool-radar-batch3.cjs");
const {
  getPublicScreenshotToolCatalogBatch4,
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
  getPublicScreenshotToolCatalogBatch17,
  getScreenshotToolReadinessBatch17,
  getNonRepositoryReferencesBatch17,
  getConfirmedExistingRecordsBatch17,
  getArchitectureExtensionsBatch17
} = require("../lib/sonara-screenshot-tool-radar-batch17.cjs");
const {
  getPublicScreenshotToolCatalogBatch18,
  getScreenshotToolReadinessBatch18,
  getNonRepositoryReferencesBatch18,
  getConfirmedExistingRecordsBatch18,
  getArchitectureExtensionsBatch18
} = require("../lib/sonara-screenshot-tool-radar-batch18.cjs");
const {
  getPublicScreenshotToolCatalogBatch19,
  getScreenshotToolReadinessBatch19,
  getNonRepositoryReferencesBatch19,
  getConfirmedExistingRecordsBatch19,
  getArchitectureExtensionsBatch19
} = require("../lib/sonara-screenshot-tool-radar-batch19.cjs");
const {
  getPublicScreenshotToolCatalogBatch20,
  getScreenshotToolReadinessBatch20,
  getNonRepositoryReferencesBatch20,
  getConfirmedExistingRecordsBatch20,
  getArchitectureExtensionsBatch20
} = require("../lib/sonara-screenshot-tool-radar-batch20.cjs");
const {
  getPublicScreenshotToolCatalogBatch21,
  getScreenshotToolReadinessBatch21,
  getNonRepositoryReferencesBatch21,
  getConfirmedExistingRecordsBatch21,
  getDeduplicatedReferencesBatch21,
  getArchitectureExtensionsBatch21
} = require("../lib/sonara-screenshot-tool-radar-batch21.cjs");
const {
  getPublicScreenshotToolCatalogBatch22,
  getScreenshotToolReadinessBatch22,
  getNonRepositoryReferencesBatch22,
  getArchitectureExtensionsBatch22
} = require("../lib/sonara-screenshot-tool-radar-batch22.cjs");
const {
  getPublicScreenshotToolCatalogBatch23,
  getScreenshotToolReadinessBatch23,
  getNonRepositoryReferencesBatch23,
  getConfirmedExistingRecordsBatch23,
  getArchitectureExtensionsBatch23
} = require("../lib/sonara-screenshot-tool-radar-batch23.cjs");
const {
  getPublicScreenshotToolCatalogBatch25,
  getScreenshotToolReadinessBatch25,
  getNonRepositoryReferencesBatch25,
  getConfirmedExistingRecordsBatch25,
  getArchitectureExtensionsBatch25
} = require("../lib/sonara-screenshot-tool-radar-batch25.cjs");
const {
  getPublicScreenshotToolCatalogBatch26,
  getScreenshotToolReadinessBatch26,
  getNonRepositoryReferencesBatch26,
  getConfirmedExistingRecordsBatch26,
  getArchitectureExtensionsBatch26
} = require("../lib/sonara-screenshot-tool-radar-batch26.cjs");
const {
  getPublicScreenshotToolCatalogBatch24,
  getScreenshotToolReadinessBatch24,
  getNonRepositoryReferencesBatch24,
  getConfirmedExistingRecordsBatch24,
  getDeduplicatedReferencesBatch24,
  getArchitectureExtensionsBatch24
} = require("../lib/sonara-screenshot-tool-radar-batch24.cjs");
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
      brandCard("Latest screenshot intake", "Batch 26 adds governed media, local AI, security, RAG and licensing research after Batch 25 workflow, agent-control-plane, rental-booking, Growth analytics, learning, prompt-efficiency and specialist-agent research while preserving the earlier Batch 24 surface. Candidates remain disabled and approval boundaries stay in force."),
      brandCard("Earlier screenshot intake", "Batch 24 reviews code-graph impact analysis, multi-harness routing, local media/transcript workflows, authorized security testing, screen sharing, GraphRAG, agent evaluation, model optimization, realtime voice and request-lifecycle architecture from the latest upload. Candidates remain disabled and approval boundaries stay in force."),
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
      ...[
        ...getArchitectureExtensionsBatch16(),
        ...getArchitectureExtensionsBatch17(),
        ...getArchitectureExtensionsBatch18(),
        ...getArchitectureExtensionsBatch19(),
        ...getArchitectureExtensionsBatch20(),
        ...getArchitectureExtensionsBatch21(),
        ...getArchitectureExtensionsBatch22(),
        ...getArchitectureExtensionsBatch23(),
        ...getArchitectureExtensionsBatch24(),
        ...getArchitectureExtensionsBatch25(),
        ...getArchitectureExtensionsBatch26()
      ].map((item) => brandCard(
        `${item.title}: Screenshot architecture`,
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
      brandCard("Repository records", `${latest.repositories.length} current screenshot-research repositories, including the governed Batch 26 intake, are classified for product fit, verification state, license risk, runtime boundary, and staged next action.`),
      brandCard("Batch 8 capability truth", `${convergence.batch8Count} internal records separate available, setup-gated, development-compatible, and research-ready capability states across SONARA and its agent workflows.`),
      brandCard("Batch 9 design/correctness", `${convergence.batch9Count} records define the current v3 design authority and the repair/review items that must not be marketed as complete.`),
      brandCard("Hosted/platform references", `${latest.nonRepositoryReferences.length} hosted or platform references remain outside the executable repository catalog.`),
      brandCard("Deduplicated references", `${latest.deduplicatedReferences.length} submitted items were repeated in earlier batches or uploads and were not duplicated.`),
      brandCard("Earlier confirmations", `${latest.confirmedExistingRecords.length} submitted projects were already covered by governed records and were re-confirmed instead of duplicated.`),
      brandCard("Screenshot architecture extensions", `${latest.architectureExtensions.length} repository-owned architecture decisions convert screenshot research into bounded provenance, execution, device, media, memory, model-promotion, approval, security and design-truth rules.`),
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
        `${item.title}: Screenshot architecture`,
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
      body: "The Research Lab preserves verified external leads through Batch 26, internal capability/design authority, and explicit adoption boundaries. None of these records widens runtime authority by itself.",
      sections,
      actions: [
        linkAction("/research-lab/requested-repositories", "Repository intake"),
        linkAction("/research-lab/open-source", "Open-source research"),
        linkAction("/", "SONARA home")
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
  const batch17 = getScreenshotToolReadinessBatch17();
  const batch18 = getScreenshotToolReadinessBatch18();
  const batch19 = getScreenshotToolReadinessBatch19();
  const batch20 = getScreenshotToolReadinessBatch20();
  const batch21 = getScreenshotToolReadinessBatch21();
  const batch25 = getScreenshotToolReadinessBatch25();
  const batch26 = getScreenshotToolReadinessBatch26();
  const batch24 = getScreenshotToolReadinessBatch24();
  return {
    repositories: [
      ...batch5.repositories,
      ...batch6.repositories,
      ...batch7.repositories,
      ...batch12.repositories,
      ...batch13.repositories,
      ...batch14.repositories,
      ...batch15.repositories,
      ...batch16.repositories,
      ...batch17.repositories,
      ...batch18.repositories,
      ...batch19.repositories,
      ...batch20.repositories,
      ...batch21.repositories,
      ...getScreenshotToolReadinessBatch22().repositories,
      ...getScreenshotToolReadinessBatch23().repositories,
      ...batch24.repositories,
      ...batch25.repositories,
      ...batch26.repositories
    ],
    nonRepositoryReferences: [
      ...(batch5.nonRepositoryReferences || []),
      ...getNonRepositoryReferencesBatch6(),
      ...getNonRepositoryReferencesBatch7(),
      ...getNonRepositoryReferencesBatch12(),
      ...getNonRepositoryReferencesBatch13(),
      ...getNonRepositoryReferencesBatch14(),
      ...getNonRepositoryReferencesBatch15(),
      ...getNonRepositoryReferencesBatch16(),
      ...getNonRepositoryReferencesBatch17(),
      ...getNonRepositoryReferencesBatch18(),
      ...getNonRepositoryReferencesBatch19(),
      ...getNonRepositoryReferencesBatch20(),
      ...getNonRepositoryReferencesBatch21(),
      ...getNonRepositoryReferencesBatch22(),
      ...getNonRepositoryReferencesBatch23(),
      ...getNonRepositoryReferencesBatch24(),
      ...getNonRepositoryReferencesBatch25(),
      ...getNonRepositoryReferencesBatch26()
    ].filter((item) => item.key !== "searchphone"),
    deduplicatedReferences: [
      ...(batch5.deduplicatedReferences || []),
      ...getDeduplicatedReferencesBatch21(),
      ...getDeduplicatedReferencesBatch24()
    ],
    // Refused for what using them would do rather than for what their licence
    // says -- three of the five are permissively licensed, so filing them as
    // licence problems would imply a relicence could unblock them.
    conductRefusals: getConductRefusalsBatch12(),
    confirmedExistingRecords: getAllConfirmedExistingRecords(),
    architectureExtensions: [
      ...getArchitectureExtensionsBatch16(),
      ...getArchitectureExtensionsBatch17(),
      ...getArchitectureExtensionsBatch18(),
      ...getArchitectureExtensionsBatch19(),
      ...getArchitectureExtensionsBatch20(),
      ...getArchitectureExtensionsBatch21(),
      ...getArchitectureExtensionsBatch22(),
      ...getArchitectureExtensionsBatch23(),
      ...getArchitectureExtensionsBatch24(),
      ...getArchitectureExtensionsBatch25(),
      ...getArchitectureExtensionsBatch26()
    ]
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
    ...getPublicScreenshotToolCatalogBatch16(),
    ...getPublicScreenshotToolCatalogBatch17(),
    ...getPublicScreenshotToolCatalogBatch18(),
    ...getPublicScreenshotToolCatalogBatch19(),
    ...getPublicScreenshotToolCatalogBatch20(),
    ...getPublicScreenshotToolCatalogBatch21(),
    ...getPublicScreenshotToolCatalogBatch22(),
    ...getPublicScreenshotToolCatalogBatch23(),
    ...getPublicScreenshotToolCatalogBatch24(),
    ...getPublicScreenshotToolCatalogBatch25(),
    ...getPublicScreenshotToolCatalogBatch26()
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
    + getPublicScreenshotToolCatalogBatch16().length
    + getPublicScreenshotToolCatalogBatch17().length
    + getPublicScreenshotToolCatalogBatch18().length
    + getPublicScreenshotToolCatalogBatch19().length
    + getPublicScreenshotToolCatalogBatch20().length
    + getPublicScreenshotToolCatalogBatch21().length
    + getPublicScreenshotToolCatalogBatch22().length
    + getPublicScreenshotToolCatalogBatch23().length
    + getPublicScreenshotToolCatalogBatch24().length
    + getPublicScreenshotToolCatalogBatch25().length
    + getPublicScreenshotToolCatalogBatch26().length;
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
    ...getNonRepositoryReferencesBatch16(),
    ...getNonRepositoryReferencesBatch17(),
    ...getNonRepositoryReferencesBatch18(),
    ...getNonRepositoryReferencesBatch19(),
    ...getNonRepositoryReferencesBatch20(),
    ...getNonRepositoryReferencesBatch21(),
    ...getNonRepositoryReferencesBatch22(),
    ...getNonRepositoryReferencesBatch23(),
    ...getNonRepositoryReferencesBatch24(),
    ...getNonRepositoryReferencesBatch25(),
    ...getNonRepositoryReferencesBatch26()
  ].filter((item) => item.key !== "searchphone");
}

function getAllConfirmedExistingRecords() {
  return [
    ...getConfirmedExistingRecordsBatch12(),
    ...getConfirmedExistingRecordsBatch14(),
    ...getConfirmedExistingRecordsBatch16(),
    ...getConfirmedExistingRecordsBatch17(),
    ...getConfirmedExistingRecordsBatch18(),
    ...getConfirmedExistingRecordsBatch19(),
    ...getConfirmedExistingRecordsBatch20(),
    ...getConfirmedExistingRecordsBatch21(),
    ...getConfirmedExistingRecordsBatch23(),
    ...getConfirmedExistingRecordsBatch24(),
    ...getConfirmedExistingRecordsBatch25(),
    ...getConfirmedExistingRecordsBatch26()
  ];
}

function publicSummary(item) {
  const source = item.repositoryVerified
    ? `Source: ${item.repository}.`
    : `Requested source is unverified and blocked.`;
  const correction = item.sourceCorrection ? ` ${item.sourceCorrection}` : "";
  const capabilities = item.capabilities.length ? ` Capabilities: ${item.capabilities.join(", ")}.` : "";
  return `${source}${correction} Class: ${display(item.runtimeClass)}. Placement: ${item.placement}. License: ${item.license}.${capabilities} Next: ${item.nextStep}`;
}

function display(value) {
  return String(value || "unknown").replace(/_/g, " ");
}

function esc(value) { return String(value || "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }
function card(title, body) { return `<article class="card"><h2>${esc(title)}</h2><p>${esc(body)}</p></article>`; }
function link(href, label) { return `<a class="action" href="${esc(href)}">${esc(label)}</a>`; }
function basicLayout(data) { return `<!doctype html><html><head><title>${esc(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><p>${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p>${esc(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section></main></body></html>`; }
