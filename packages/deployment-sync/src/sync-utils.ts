import type {
  DeploymentProvider,
  DeploymentSyncFinding,
  DeploymentSyncRiskLevel,
  DeploymentSyncStatus
} from "./types.ts";

export function makeFinding(
  provider: DeploymentProvider,
  status: DeploymentSyncStatus,
  riskLevel: DeploymentSyncRiskLevel,
  findingKey: string,
  message: string,
  metadata: Readonly<Record<string, unknown>> = {}
): DeploymentSyncFinding {
  return Object.freeze({
    provider,
    status,
    riskLevel,
    findingKey,
    message,
    metadata: Object.freeze(metadata)
  });
}

export function summarizeStatus(findings: readonly DeploymentSyncFinding[]) {
  const priority: readonly DeploymentSyncStatus[] = Object.freeze([
    "failed",
    "blocked",
    "needs_review",
    "not_configured",
    "configured",
    "verified",
    "skipped_for_mvp"
  ]);
  const status =
    priority.find((candidate) => findings.some((finding) => finding.status === candidate)) ??
    "needs_review";
  const riskLevel = findings.some((finding) => finding.riskLevel === "critical")
    ? "critical"
    : findings.some((finding) => finding.riskLevel === "high")
      ? "high"
      : findings.some((finding) => finding.riskLevel === "medium")
        ? "medium"
        : "low";
  return Object.freeze({ status, riskLevel });
}
