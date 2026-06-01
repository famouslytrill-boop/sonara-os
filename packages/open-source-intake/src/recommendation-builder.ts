import { requiresLicenseReview } from "./license-risk-classifier.ts";
import { requiresSecurityReview } from "./security-risk-classifier.ts";
import type { ExternalProjectRecommendation, OpenSourceProjectRecord } from "./types.ts";

export function buildExternalProjectRecommendation(
  project: OpenSourceProjectRecord
): ExternalProjectRecommendation {
  const reasons: string[] = [];
  const requiredReviews: ("legal" | "security" | "owner")[] = ["owner"];

  if (requiresLicenseReview(project)) {
    reasons.push(
      "License review is required before copying, vendoring, self-hosting, or adapter use."
    );
    requiredReviews.push("legal");
  }
  if (requiresSecurityReview(project.securityRisk)) {
    reasons.push("Security review is required before installation, automation, or user exposure.");
    requiredReviews.push("security");
  }
  if (project.integrationStatus === "blocked") {
    reasons.push("Project is blocked for production use by intake policy.");
  }
  if (project.useMode === "reference_only" || project.useMode === "concept_adapter") {
    reasons.push("Use only as reference or concept inspiration; do not copy source code.");
  }
  if (project.useMode === "beta_gated_feature") {
    reasons.push("Feature must remain beta-gated with safety review before public exposure.");
  }

  const decision =
    project.integrationStatus === "blocked"
      ? "block"
      : requiredReviews.length > 1
        ? "needs_review"
        : project.useMode === "reference_only" || project.useMode === "concept_adapter"
          ? "allow_reference"
          : "allow_adapter_after_review";

  return Object.freeze({
    projectId: project.id,
    repo: `${project.repoOwner}/${project.repoName}`,
    recommendedStatus: project.integrationStatus,
    recommendedUseMode: project.useMode,
    decision,
    reasons: Object.freeze(reasons),
    requiredReviews: Object.freeze(Array.from(new Set(requiredReviews)))
  });
}
