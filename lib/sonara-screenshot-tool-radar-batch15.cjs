// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const {
  SOURCE_LEADS,
  PLATFORM_PATTERNS,
  AGENT_ROLES,
  SKILLS,
  getSeptember19PatternConvergence
} = require("./sonara-september19-pattern-convergence.cjs");

const VERIFIED_REPOSITORIES = Object.freeze(
  SOURCE_LEADS
    .filter((item) => item.sourceType === "verified_repository" && item.repository)
    .map((item) => Object.freeze({
      key: item.key,
      label: item.label,
      repository: item.repository,
      repoUrl: `https://github.com/${item.repository}`,
      repositoryVerified: true,
      license: item.license,
      licenseRisk: /AGPL|GPL|unreported|unresolved/i.test(item.license) ? "high" : "medium",
      reciprocalLicense: /AGPL|GPL/i.test(item.license),
      runtimeClass: item.placement,
      placement: item.placement,
      productFit: Object.freeze(productFit(item.key)),
      integrationStatus: item.key === "concat"
        ? "reference_only_license_gated"
        : "research_only",
      capabilities: Object.freeze(capabilities(item.key)),
      safety: Object.freeze([
        "This research record does not install, execute, authenticate to, or enable the third-party project.",
        "Any implementation must preserve tenant isolation, least privilege, approval boundaries, provenance, observability, and rollback.",
        item.nextStep
      ]),
      blockedUses: Object.freeze(item.blockedUses ? [...item.blockedUses] : ["production execution from the research catalog"]),
      nextStep: item.nextStep,
      enabledInProduction: false,
      configurationStatus: "cataloged_disabled",
      runtimeStatus: "not_executed",
      canExecute: false,
      humanReviewRequired: true,
      source: "user_submitted_screenshot_research_batch15_2026_09_19"
    }))
);

const NON_REPOSITORY_REFERENCES_BATCH15 = Object.freeze(
  SOURCE_LEADS
    .filter((item) => item.sourceType !== "verified_repository" || !item.repository)
    .map((item) => Object.freeze({
      key: item.key,
      label: item.label,
      status: item.sourceType,
      observedTheme: item.placement,
      reason: "The submitted screenshot or hosted-service reference is useful for architecture research but is not an approved executable repository dependency.",
      nextStep: item.nextStep,
      safety: Object.freeze([
        "No code, credentials, customer data, provider access, or runtime authority is granted by this record.",
        ...(item.blockedUses ? item.blockedUses.map((use) => `Blocked: ${use}`) : [])
      ]),
      source: "user_submitted_screenshot_research_batch15_2026_09_19"
    }))
);

function productFit(key) {
  if (key === "concat") return ["Creator Studio", "Media Runtime Research"];
  if (key === "grok_build") return ["Internal Development", "Founder Operations"];
  if (key === "situation_monitor") return ["Business Builder", "Founder Operations", "Research Lab"];
  return ["Research Lab"];
}

function capabilities(key) {
  if (key === "concat") return ["local-first media editing reference", "multi-track timeline patterns", "caption/TTS/MCP workflow research"];
  if (key === "grok_build") return ["terminal coding-agent reference", "long-running task orchestration", "agent-client protocol research"];
  if (key === "situation_monitor") return ["real-time dashboard reference", "event and market monitoring architecture", "source aggregation research"];
  return [];
}

function getPublicScreenshotToolCatalogBatch15() {
  return VERIFIED_REPOSITORIES.map((item) => ({
    ...item,
    productFit: [...item.productFit],
    capabilities: [...item.capabilities],
    safety: [...item.safety],
    blockedUses: [...item.blockedUses]
  }));
}

function getNonRepositoryReferencesBatch15() {
  return NON_REPOSITORY_REFERENCES_BATCH15.map((item) => ({
    ...item,
    safety: [...item.safety]
  }));
}

function getScreenshotToolReadinessBatch15() {
  const repositories = getPublicScreenshotToolCatalogBatch15();
  const convergence = getSeptember19PatternConvergence();
  return {
    ok: true,
    batch: 15,
    mode: "static_governed_screenshot_research_batch15",
    repositoryCount: repositories.length,
    verifiedCount: repositories.filter((item) => item.repositoryVerified).length,
    nonRepositoryReferenceCount: NON_REPOSITORY_REFERENCES_BATCH15.length,
    productionExecutionCount: 0,
    patternCount: PLATFORM_PATTERNS.length,
    agentRoleCount: AGENT_ROLES.length,
    skillCount: SKILLS.length,
    repositories,
    nonRepositoryReferences: getNonRepositoryReferencesBatch15(),
    architectureConvergence: convergence
  };
}

module.exports = {
  VERIFIED_REPOSITORIES_BATCH15: VERIFIED_REPOSITORIES,
  NON_REPOSITORY_REFERENCES_BATCH15,
  getPublicScreenshotToolCatalogBatch15,
  getNonRepositoryReferencesBatch15,
  getScreenshotToolReadinessBatch15
};
