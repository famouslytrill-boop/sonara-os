export {
  openSourceIntakeFeatureFlags,
  determineIntegrationStatus,
  isIntegrationBlocked
} from "./integration-status.ts";
export { classifyLicenseRisk, requiresLicenseReview } from "./license-risk-classifier.ts";
export {
  findOpenSourceProject,
  getBlockedOpenSourceProjects,
  getLicenseReviewProjects,
  getOpenSourceIntakeSummary,
  getOpenSourceProjectRegistry,
  getReferenceOnlyProjects,
  getSecurityReviewProjects,
  openSourceProjectRegistry
} from "./project-registry.ts";
export { hasProductFit, summarizeProductFit } from "./product-fit-classifier.ts";
export { buildExternalProjectRecommendation } from "./recommendation-builder.ts";
export { classifySecurityRisk, requiresSecurityReview } from "./security-risk-classifier.ts";
export { isTrackingParam, normalizeExternalProjectUrl } from "./url-normalizer.ts";
export { createOpenSourceAuditEvent, createOpenSourceAuditLedger } from "./audit-ledger.ts";
export type {
  ExternalProjectRecommendation,
  OpenSourceAuditEvent,
  OpenSourceIntegrationStatus,
  OpenSourceLicenseRisk,
  OpenSourceProductFit,
  OpenSourceProjectCategory,
  OpenSourceProjectRecord,
  OpenSourceSecurityRisk,
  OpenSourceUseMode
} from "./types.ts";
