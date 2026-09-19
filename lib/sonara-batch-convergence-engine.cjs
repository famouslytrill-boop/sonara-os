// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { getScreenshotToolReadiness } = require("./sonara-screenshot-tool-radar.cjs");
const { getScreenshotToolReadinessBatch2 } = require("./sonara-screenshot-tool-radar-batch2.cjs");
const { getScreenshotToolReadinessBatch3 } = require("./sonara-screenshot-tool-radar-batch3.cjs");
const { getScreenshotToolReadinessBatch4 } = require("./sonara-screenshot-tool-radar-batch4.cjs");
const { getScreenshotToolReadinessBatch5 } = require("./sonara-screenshot-tool-radar-batch5.cjs");
const { getScreenshotToolReadinessBatch6 } = require("./sonara-screenshot-tool-radar-batch6.cjs");
const { getScreenshotToolReadinessBatch7 } = require("./sonara-screenshot-tool-radar-batch7.cjs");
const { getScreenshotToolReadinessBatch12 } = require("./sonara-screenshot-tool-radar-batch12.cjs");
const { getCapabilityDesignReadiness } = require("./sonara-capability-design-batches.cjs");
const { getBatch10OperationalReview } = require("./sonara-batch10-operational-review.cjs");
const { getBatch11OperationalReview } = require("./sonara-batch11-operational-review.cjs");
const { getPublicRequestedRepositoryCatalog } = require("./sonara-requested-repository-registry.cjs");
const { readOpenSourceTools, registryIntegrity } = require("./sonara-open-source-registry.cjs");
const repositoryIntake13 = require("../data/repository-intake-2026-09-18.json");

const EXTERNAL_BATCHES = Object.freeze([
  Object.freeze({ batch: 1, getter: getScreenshotToolReadiness }),
  Object.freeze({ batch: 2, getter: getScreenshotToolReadinessBatch2 }),
  Object.freeze({ batch: 3, getter: getScreenshotToolReadinessBatch3 }),
  Object.freeze({ batch: 4, getter: getScreenshotToolReadinessBatch4 }),
  Object.freeze({ batch: 5, getter: getScreenshotToolReadinessBatch5 }),
  Object.freeze({ batch: 6, getter: getScreenshotToolReadinessBatch6 }),
  Object.freeze({ batch: 7, getter: getScreenshotToolReadinessBatch7 }),
  // Batch 12, the 16 September 2026 screenshot intake.
  //
  // It took four numbers to land on 12, and the reason is worth a sentence
  // because it will happen again: the screenshot-radar filenames stop at
  // `batch7`, so 8 reads as the next free number and is not -- 8 and 9 are the
  // capability and design convergence records, 10 is
  // sonara-batch10-operational-review.cjs, and 11 was taken by
  // sonara-batch11-operational-review.cjs *while this intake was being written*.
  // That last one was caught by CI rather than locally, because the number was
  // free in this branch and claimed on main.
  //
  // So the collision check in tests/a-screenshot-is-not-a-licence.test.js derives
  // the claimed numbers by scanning lib/ instead of listing them. A hardcoded
  // list is what let the second collision through, and nothing local could have
  // caught the third.
  //
  // Being in this list is what makes the intake real. Recorded in the radar but
  // missing here, it would be published on the Research Lab page and absent from
  // every convergence figure -- the same defect one level up: a record that looks
  // accounted for because it exists somewhere.
  Object.freeze({ batch: 12, getter: getScreenshotToolReadinessBatch12 })
]);

// A source higher in this list may narrow or supersede a lower source. None of
// them may widen runtime authority merely by being present in the convergence
// record. Formal registry review outranks screenshot research because it is the
// repository's deeper adoption/licence decision surface.
const AUTHORITY_PRECEDENCE = Object.freeze([
  "production_runtime_truth",
  "current_design_authority",
  "formal_open_source_registry",
  "operational_requirement",
  "verified_external_research",
  "historical_reference"
]);

function getUnifiedBatchConvergence() {
  const external = EXTERNAL_BATCHES.map(({ batch, getter }) => normalizeExternalBatch(batch, getter()));
  const capabilityDesign = getCapabilityDesignReadiness();
  const batch10 = getBatch10OperationalReview();
  const batch11 = getBatch11OperationalReview();
  const requestedRegistry = getPublicRequestedRepositoryCatalog();
  const formalRegistry = readOpenSourceTools();
  const integrity = registryIntegrity();
  const batch13 = normalizeRepositoryIntake(repositoryIntake13);

  const repositoryMap = new Map();
  for (const batch of external) {
    for (const record of batch.repositories) mergeRepository(repositoryMap, record, batch.batch);
  }
  for (const record of safeArray(batch10.repositories)) {
    mergeRepository(repositoryMap, normalizeReviewedRepository(record, 10), 10);
  }
  for (const record of safeArray(batch11.repositories)) {
    mergeRepository(repositoryMap, normalizeReviewedRepository(record, 11), 11);
  }
  for (const record of batch13.repositories) {
    mergeRepository(repositoryMap, record, 13);
  }
  for (const record of requestedRegistry) {
    mergeRepository(repositoryMap, normalizeRequestedRepository(record), "requested_registry");
  }
  // Merge the maintained formal registry last so its explicit commercial-use,
  // licence-risk and integration decisions win over older intake metadata.
  for (const record of formalRegistry) {
    const normalized = normalizeFormalRepository(record);
    if (normalized.repository) mergeRepository(repositoryMap, normalized, "formal_registry");
  }

  const repositories = [...repositoryMap.values()]
    .map(finalizeRepository)
    .sort((a, b) => a.repository.localeCompare(b.repository));

  const unresolved = [
    ...external.flatMap((batch) => batch.unresolved),
    ...safeArray(batch10.unresolvedLeads).map((item) => ({ batch: 10, ...item })),
    ...safeArray(batch11.unresolvedLeads).map((item) => ({ batch: 11, ...item })),
    ...requestedRegistry
      .filter((item) => !item.repositoryVerified || !item.repository)
      .map((item) => ({ batch: "requested_registry", key: item.key, label: item.label, reason: item.sourceCorrection || "Repository remains unverified." }))
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
    },
    {
      batch: 11,
      kind: "verification_first_operational_and_repository_review",
      repositoryRecords: safeArray(batch11.repositories).length,
      recordCount: safeArray(batch11.records).length,
      unresolvedRecords: safeArray(batch11.unresolvedLeads).length,
      productionExecutionAdded: Number(batch11.productionExecutionAdded || 0)
    },
    {
      batch: 13,
      kind: "cross_host_repository_intake",
      repositoryRecords: batch13.repositories.length,
      researchOnlyRecords: batch13.researchOnlyCount,
      pinnedInstallTargetRecords: batch13.installTargetCount,
      productionExecutionAdded: 0
    }
  ];

  const duplicateRepositoryRecords = repositories.reduce((count, item) => count + Math.max(0, item.sourceRecords.length - 1), 0);
  const operationalRequirements = [
    ...safeArray(batch10.records),
    ...safeArray(batch11.records)
  ];

  return {
    ok: true,
    mode: "batch_1_13_plus_formal_registry_governed_convergence",
    // `batchCount` is a compatibility field for callers/tests built before the
    // Batch 11 intake. New consumers must use latestBatch/counts.batches.
    batchCount: 10,
    latestBatch: 13,
    batchCountDeprecated: true,
    authorityPrecedence: [...AUTHORITY_PRECEDENCE],
    currentAuthority: {
      publicPlatformName: "SONARA One",
      parentCompany: "SONARA Industries",
      productRoutes: ["/business-builder", "/creator-studio", "/growth-studio"],
      designSystem: "v3 / Balanced Precision",
      legacyDesignHandling: "Older Prism Wave/Nexus-era design material is historical or compatibility context only when it conflicts with Batch 9 authority.",
      researchExecutionPolicy: "Research records do not execute, install dependencies, widen provider access, or bypass tenant/approval/release controls.",
      formalRegistryPolicy: "data/open-source-tools.ts is the maintained repository adoption/licence register and supersedes older intake metadata when records conflict."
    },
    counts: {
      batches: 13,
      repositoryIntakeResearchOnly: batch13.researchOnlyCount,
      repositoryIntakeInstallTargets: batch13.installTargetCount,
      requestedRegistryRecords: requestedRegistry.length,
      formalOpenSourceRegistryRecords: formalRegistry.length,
      formalOpenSourceRegistryIntegrity: integrity,
      uniqueRepositoryResearch: repositories.length,
      duplicateRepositoryRecordsCollapsed: duplicateRepositoryRecords,
      capabilityTruthRecords: safeArray(capabilityDesign.capabilities).length,
      designAuthorityRecords: safeArray(capabilityDesign.designs).length,
      operationalRequirementRecords: operationalRequirements.length,
      unresolvedResearchLeads: unresolved.length,
      nonRepositoryReferences: nonRepositoryReferences.length,
      productionExecutionAdded: 0
    },
    batchSummaries,
    repositories,
    capabilityTruth: safeArray(capabilityDesign.capabilities).map(copy),
    designAuthority: safeArray(capabilityDesign.designs).map(copy),
    operationalRequirements: operationalRequirements.map(copy),
    unresolvedResearch: unresolved.map(copy),
    nonRepositoryReferences: nonRepositoryReferences.map(copy),
    boundaries: [
      "Later evidence may correct older research metadata, but external research never overrides live product authorization or tenant boundaries.",
      "A repository appearing in multiple batches/registries is one governed candidate with provenance from every source, not multiple integrations.",
      "No model, provider, skill, MCP server, repository, or agent receives production authority from this convergence record.",
      "Current design/correctness authority comes from Batch 9 when older visual guidance conflicts.",
      "Formal registry commercial-use and integration decisions win over older screenshot/intake metadata when the same repository appears in both."
    ]
  };
}

function normalizeRepositoryIntake(input = {}) {
  const research = safeArray(input.researchOnly).map((record) => normalizeRepositoryIntakeRecord(record, "research_only"));
  const installTargets = safeArray(input.installSet).map((record) => normalizeRepositoryIntakeRecord(record, "install_target"));
  return {
    repositories: [...research, ...installTargets],
    researchOnlyCount: research.length,
    installTargetCount: installTargets.length
  };
}

function normalizeRepositoryIntakeRecord(record = {}, lane) {
  const installTarget = lane === "install_target";
  return {
    batch: 13,
    key: String(record.key || record.repository || "repository_intake_record"),
    label: String(record.repository || record.key || "Repository intake record"),
    repository: canonicalRepository(record.repository || ""),
    repositoryVerified: Boolean(record.repository && record.url),
    license: String(record.license || "NOASSERTION"),
    licenseRisk: inferLicenseRisk(record.license),
    commercialUseStatus: installTarget ? "allowed_after_review" : "needs_review",
    runtimeClass: installTarget ? String(record.installClass || "install_candidate") : "research_reference",
    integrationStatus: installTarget ? "pinned_install_target" : "research_only",
    integrationMode: installTarget ? "exact_sha_install_candidate" : "reference_only",
    productFit: uniqueStrings(record.productFit),
    capabilities: uniqueStrings(installTarget ? [record.installClass, record.packageName] : record.researchValue),
    safety: uniqueStrings([record.reasonNotInstalled, record.activationBoundary]),
    blockedUses: [],
    source: "repository_intake_2026_09_18",
    enabledInProduction: false,
    canExecute: false,
    humanReviewRequired: true,
    nextStep: installTarget
      ? `Install only through the reviewed package/repository workflow pinned to ${record.sha}; keep runtime activation disabled until full CI and product-specific checks pass.`
      : String(record.reasonNotInstalled || "Research only; do not install.")
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
    commercialUseStatus: String(record.commercialUseStatus || "needs_review"),
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

function normalizeReviewedRepository(record = {}, batch) {
  const noDeclaredLicense = String(record.licenseStatus || "").includes("blocked_no_declared_license") || /NOASSERTION/i.test(String(record.license));
  return {
    batch,
    key: String(record.key || record.repository || `batch_${batch}_repository`),
    label: String(record.label || record.repository || `Batch ${batch} repository`),
    repository: canonicalRepository(record.repository || ""),
    repositoryVerified: Boolean(record.repository) && !String(record.licenseStatus || "").includes("unverified_repository"),
    license: String(record.license || "NOASSERTION"),
    licenseRisk: inferLicenseRisk(record.license),
    commercialUseStatus: noDeclaredLicense ? "blocked_until_review" : "needs_review",
    runtimeClass: "research_reference",
    integrationStatus: String(record.integrationStatus || "research_only"),
    integrationMode: "reference_only",
    productFit: uniqueStrings(record.productFit),
    capabilities: uniqueStrings([record.value]),
    safety: uniqueStrings([record.boundary]),
    blockedUses: [],
    source: `batch_${batch}_verified_repository_review`,
    enabledInProduction: false,
    canExecute: false,
    humanReviewRequired: record.humanReviewRequired !== false,
    nextStep: record.boundary || null
  };
}

function normalizeRequestedRepository(record = {}) {
  return {
    batch: "requested_registry",
    key: String(record.key || record.repository || record.requestedRepository || "requested_repository"),
    label: String(record.label || record.repository || record.requestedRepository || "Requested repository"),
    repository: canonicalRepository(record.repository || ""),
    repositoryVerified: record.repositoryVerified === true,
    license: String(record.license || "NOASSERTION"),
    licenseRisk: String(record.licenseRisk || inferLicenseRisk(record.license)),
    commercialUseStatus: String(record.commercialUseStatus || "needs_review"),
    runtimeClass: String(record.runtimeClass || "research_reference"),
    integrationStatus: String(record.integrationStatus || "research_only"),
    integrationMode: String(record.integrationMode || "reference_only"),
    productFit: uniqueStrings(record.productFit),
    capabilities: uniqueStrings(record.capabilities),
    safety: uniqueStrings(record.safety),
    blockedUses: uniqueStrings(record.blockedUses),
    source: "requested_repository_registry",
    enabledInProduction: record.enabledInProduction === true,
    canExecute: false,
    humanReviewRequired: record.humanReviewRequired !== false,
    nextStep: record.nextStep || record.sourceCorrection || null
  };
}

function normalizeFormalRepository(record = {}) {
  const repository = repositoryFromGithubUrl(record.repoUrl);
  const blocked = /blocked/i.test(String(record.integrationStatus || ""));
  return {
    batch: "formal_registry",
    key: String(record.slug || repository || "formal_repository"),
    label: String(record.name || repository || "Formal repository"),
    repository,
    repositoryVerified: Boolean(repository),
    license: String(record.license || "NOASSERTION"),
    licenseRisk: String(record.licenseRisk || inferLicenseRisk(record.license)),
    commercialUseStatus: String(record.commercialUseStatus || "needs_review"),
    runtimeClass: "formal_registry_record",
    integrationStatus: String(record.integrationStatus || "research_only"),
    integrationMode: "formal_registry_policy",
    productFit: uniqueStrings(record.productFit),
    capabilities: uniqueStrings(record.category),
    safety: uniqueStrings(record.safetyBoundaries),
    blockedUses: uniqueStrings(record.blockedUses),
    source: "data/open-source-tools.ts",
    enabledInProduction: false,
    canExecute: false,
    humanReviewRequired: record.humanReviewRequired !== false,
    nextStep: blocked ? "Remain blocked unless the formal registry decision changes after review." : "Follow the formal registry integration status and product-specific adoption review."
  };
}

function mergeRepository(map, record, sourceId) {
  if (!record.repository) return;
  const id = record.repository.toLowerCase();
  const current = map.get(id);
  if (!current) {
    map.set(id, {
      ...copy(record),
      seenInBatches: numericBatches(record.batch),
      sourceRecords: [{ sourceId, key: record.key, source: record.source }]
    });
    return;
  }

  const merged = {
    ...current,
    ...copy(record),
    repository: current.repository,
    seenInBatches: [...new Set([...current.seenInBatches, ...numericBatches(record.batch)])].sort((a, b) => a - b),
    sourceRecords: [...current.sourceRecords, { sourceId, key: record.key, source: record.source }],
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

function repositoryFromGithubUrl(value) {
  const raw = String(value || "").trim();
  if (!/^https?:\/\/github\.com\//i.test(raw)) return "";
  const repository = canonicalRepository(raw);
  return repository.split("/").length >= 2 ? repository : "";
}

function inferLicenseRisk(license) {
  const value = String(license || "NOASSERTION").toUpperCase();
  if (!value || value === "NOASSERTION" || value.includes("UNKNOWN") || value.includes("UNVERIFIED")) return "high";
  if (value.includes("AGPL") || value.includes("GPL") || value.includes("NON-COMMERCIAL") || value.includes("NC") || value.includes("ELV2")) return "high";
  if (value.includes("APACHE") || value.includes("MIT") || value.includes("BSD") || value.includes("CC0") || value.includes("POSTGRESQL")) return "low";
  return "medium";
}

function numericBatches(value) {
  return Number.isInteger(value) && value >= 1 && value <= 13 ? [value] : [];
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
  repositoryFromGithubUrl,
  inferLicenseRisk
};
