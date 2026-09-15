"use strict";

const { getScreenshotToolReadiness } = require("./sonara-screenshot-tool-radar.cjs");
const { getScreenshotToolReadinessBatch2 } = require("./sonara-screenshot-tool-radar-batch2.cjs");
const { getScreenshotToolReadinessBatch3 } = require("./sonara-screenshot-tool-radar-batch3.cjs");
const { getScreenshotToolReadinessBatch4 } = require("./sonara-screenshot-tool-radar-batch4.cjs");
const { getScreenshotToolReadinessBatch5 } = require("./sonara-screenshot-tool-radar-batch5.cjs");
const { getScreenshotToolReadinessBatch6 } = require("./sonara-screenshot-tool-radar-batch6.cjs");
const { getScreenshotToolReadinessBatch7 } = require("./sonara-screenshot-tool-radar-batch7.cjs");
const { getCapabilityDesignReadiness } = require("./sonara-capability-design-batches.cjs");
const { getBatch10OperationalReview } = require("./sonara-batch10-operational-review.cjs");

const EXTERNAL_BATCHES = Object.freeze([
  Object.freeze({ batch: 1, getter: getScreenshotToolReadiness }),
  Object.freeze({ batch: 2, getter: getScreenshotToolReadinessBatch2 }),
  Object.freeze({ batch: 3, getter: getScreenshotToolReadinessBatch3 }),
  Object.freeze({ batch: 4, getter: getScreenshotToolReadinessBatch4 }),
  Object.freeze({ batch: 5, getter: getScreenshotToolReadinessBatch5 }),
  Object.freeze({ batch: 6, getter: getScreenshotToolReadinessBatch6 }),
  Object.freeze({ batch: 7, getter: getScreenshotToolReadinessBatch7 })
]);

// Later batches can add evidence and can narrow or supersede an older policy,
// but a research record never overrides a production/runtime truth record.
// This keeps a shiny new screenshot from silently widening authority.
const AUTHORITY_PRECEDENCE = Object.freeze([
  "production_runtime_truth",
  "current_design_authority",
  "operational_requirement",
  "verified_external_research",
  "historical_reference"
]);

function getUnifiedBatchConvergence() {
  const external = EXTERNAL_BATCHES.map(({ batch, getter }) => normalizeExternalBatch(batch, getter()));
  const capabilityDesign = getCapabilityDesignReadiness();
  const batch10 = getBatch10OperationalReview();

  const repositoryMap = new Map();
  for (const batch of external) {
    for (const record of batch.repositories) mergeRepository(repositoryMap, record, batch.batch);
  }
  for (const record of safeArray(batch10.repositories)) {
    mergeRepository(repositoryMap, normalizeBatch10Repository(record), 10);
  }

  const repositories = [...repositoryMap.values()]
    .map(finalizeRepository)
    .sort((a, b) => a.repository.localeCompare(b.repository));

  const unresolved = [
    ...external.flatMap((batch) => batch.unresolved),
    ...safeArray(batch10.unresolvedLeads).map((item) => ({ batch: 10, ...item }))
  ];

  const nonRepositoryReferences = external.flatMap((batch) => batch.nonRepositoryReferences);
  const batchSummaries = [
    ...external.map((batch) => ({
      batch: batch.batch,
      kind: "external_research",
      repositoryRecords: batch.repositories.length,
      unresolvedRecords: batch.unresolved.length,
      nonRepositoryRecords: batch.nonRepositoryReferences.length,
      productionExecutionAdded: 0
    })),
    {
      batch: 8,
      kind: "capability_truth",
      repositoryRecords: 0,
      recordCount: Number(capabilityDesign.batch8Count || safeArray(capabilityDesign.capabilities).length),
      productionExecutionAdded: 0
    },
    {
      batch: 9,
      kind: "design_and_correctness_authority",
      repositoryRecords: 0,
      recordCount: Number(capabilityDesign.batch9Count || safeArray(capabilityDesign.designs).length),
      productionExecutionAdded: 0
    },
    {
      batch: 10,
      kind: "operational_and_repository_review",
      repositoryRecords: safeArray(batch10.repositories).length,
      recordCount: safeArray(batch10.records).length,
      unresolvedRecords: safeArray(batch10.unresolvedLeads).length,
      productionExecutionAdded: Number(batch10.productionExecutionAdded || 0)
    }
  ];

  const duplicateRepositoryRecords = repositories.reduce((count, item) => count + Math.max(0, item.seenInBatches.length - 1), 0);

  return {
    ok: true,
    mode: "batch_1_10_governed_convergence",
    batchCount: 10,
    authorityPrecedence: [...AUTHORITY_PRECEDENCE],
    currentAuthority: {
      publicPlatformName: "SONARA One",
      parentCompany: "SONARA Industries",
      productRoutes: ["/business-builder", "/creator-studio", "/growth-studio"],
      designSystem: "v3 / Balanced Precision",
      legacyDesignHandling: "Older Prism Wave/Nexus-era design material is historical or compatibility context only when it conflicts with Batch 9 authority.",
      researchExecutionPolicy: "Research records do not execute, install dependencies, widen provider access, or bypass tenant/approval/release controls."
    },
    counts: {
      batches: 10,
      uniqueRepositoryResearch: repositories.length,
      duplicateRepositoryRecordsCollapsed: duplicateRepositoryRecords,
      capabilityTruthRecords: safeArray(capabilityDesign.capabilities).length,
      designAuthorityRecords: safeArray(capabilityDesign.designs).length,
      operationalRequirementRecords: safeArray(batch10.records).length,
      unresolvedResearchLeads: unresolved.length,
      nonRepositoryReferences: nonRepositoryReferences.length,
      productionExecutionAdded: 0
    },
    batchSummaries,
    repositories,
    capabilityTruth: safeArray(capabilityDesign.capabilities).map(copy),
    designAuthority: safeArray(capabilityDesign.designs).map(copy),
    operationalRequirements: safeArray(batch10.records).map(copy),
    unresolvedResearch: unresolved.map(copy),
    nonRepositoryReferences: nonRepositoryReferences.map(copy),
    boundaries: [
      "Later evidence may correct older research metadata, but external research never overrides live product authorization or tenant boundaries.",
      "A repository appearing in multiple batches is one governed candidate with provenance from every batch, not multiple integrations.",
      "No model, provider, skill, MCP server, repository, or agent receives production authority from this convergence record.",
      "Current design/correctness authority comes from Batch 9 when older visual guidance conflicts."
    ]
  };
}

function normalizeExternalBatch(batch, result = {}) {
  const repositories = safeArray(result.repositories).map((record) => normalizeRepository(record, batch));
  const unresolved = [
    ...safeArray(result.unresolvedVisualLeads),
    ...safeArray(result.unverifiedLeads),
    ...safeArray(result.unresolvedLeads)
  ].map((item) => ({ batch, ...copy(item) }));
  const nonRepositoryReferences = [
    ...safeArray(result.nonRepositoryReferences),
    ...safeArray(result.references)
  ].map((item) => ({ batch, ...copy(item) }));
  return { batch, repositories, unresolved, nonRepositoryReferences };
}

function normalizeRepository(record = {}, batch) {
  const repository = canonicalRepository(record.repository || record.requestedRepository || record.repo || "");
  return {
    batch,
    key: String(record.key || repository || `batch_${batch}_unnamed`),
    label: String(record.label || repository || "Unlabeled repository"),
    repository,
    repositoryVerified: record.repositoryVerified !== false,
    license: String(record.license || "NOASSERTION"),
    licenseRisk: String(record.licenseRisk || inferLicenseRisk(record.license)),
    runtimeClass: String(record.runtimeClass || "research_reference"),
    integrationStatus: String(record.integrationStatus || "research_only"),
    integrationMode: String(record.integrationMode || "reference_only"),
    productFit: uniqueStrings(record.productFit),
    capabilities: uniqueStrings(record.capabilities),
    safety: uniqueStrings(record.safety),
    blockedUses: uniqueStrings(record.blockedUses),
    source: record.source || `batch_${batch}`,
    enabledInProduction: record.enabledInProduction === true,
    canExecute: record.canExecute === true,
    humanReviewRequired: record.humanReviewRequired !== false,
    nextStep: record.nextStep || null
  };
}

function normalizeBatch10Repository(record = {}) {
  return {
    batch: 10,
    key: String(record.key || record.repository || "batch_10_repository"),
    label: String(record.label || record.repository || "Batch 10 repository"),
    repository: canonicalRepository(record.repository || ""),
    repositoryVerified: !String(record.licenseStatus || "").includes("blocked_no_declared_license"),
    license: String(record.license || "NOASSERTION"),
    licenseRisk: inferLicenseRisk(record.license),
    runtimeClass: "research_reference",
    integrationStatus: String(record.integrationStatus || "research_only"),
    integrationMode: "reference_only",
    productFit: uniqueStrings(record.productFit),
    capabilities: uniqueStrings([record.value]),
    safety: uniqueStrings([record.boundary]),
    blockedUses: [],
    source: "batch_10_verified_repository_review",
    enabledInProduction: false,
    canExecute: false,
    humanReviewRequired: record.humanReviewRequired !== false,
    nextStep: record.boundary || null
  };
}

function mergeRepository(map, record, batch) {
  if (!record.repository) return;
  const id = record.repository.toLowerCase();
  const current = map.get(id);
  if (!current) {
    map.set(id, {
      ...copy(record),
      seenInBatches: [batch],
      sourceRecords: [{ batch, key: record.key, source: record.source }]
    });
    return;
  }

  // Newer research metadata can correct an older repository record, while the
  // provenance from the older record remains visible.
  const merged = {
    ...current,
    ...copy(record),
    repository: current.repository,
    seenInBatches: [...new Set([...current.seenInBatches, batch])].sort((a, b) => a - b),
    sourceRecords: [...current.sourceRecords, { batch, key: record.key, source: record.source }],
    productFit: uniqueStrings([...current.productFit, ...record.productFit]),
    capabilities: uniqueStrings([...current.capabilities, ...record.capabilities]),
    safety: uniqueStrings([...current.safety, ...record.safety]),
    blockedUses: uniqueStrings([...current.blockedUses, ...record.blockedUses]),
    enabledInProduction: Boolean(current.enabledInProduction || record.enabledInProduction),
    canExecute: Boolean(current.canExecute || record.canExecute),
    humanReviewRequired: Boolean(current.humanReviewRequired || record.humanReviewRequired)
  };
  map.set(id, merged);
}

function finalizeRepository(record) {
  return {
    ...record,
    // Research convergence must not become an execution path. If an upstream
    // catalog ever accidentally marks a research record executable, surface it
    // as a policy conflict instead of honoring it here.
    convergenceExecutionAllowed: false,
    policyConflict: record.enabledInProduction || record.canExecute
      ? "upstream research record claims execution; convergence refuses to widen authority"
      : null
  };
}

function canonicalRepository(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "");
}

function inferLicenseRisk(license) {
  const value = String(license || "NOASSERTION").toUpperCase();
  if (!value || value === "NOASSERTION" || value.includes("UNKNOWN")) return "high";
  if (value.includes("AGPL") || value.includes("GPL") || value.includes("NON-COMMERCIAL") || value.includes("NC")) return "high";
  if (value.includes("APACHE") || value.includes("MIT") || value.includes("BSD") || value.includes("CC0")) return "low";
  return "medium";
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values) {
  return [...new Set(safeArray(values).map((value) => String(value || "").trim()).filter(Boolean))];
}

function copy(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(copy);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)]));
}

module.exports = {
  AUTHORITY_PRECEDENCE,
  getUnifiedBatchConvergence,
  canonicalRepository,
  inferLicenseRisk
};
