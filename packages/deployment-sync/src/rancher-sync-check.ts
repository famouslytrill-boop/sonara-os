import type { DeploymentSyncContext, RancherSyncStatus } from "./types.ts";
import { isEnvConfigured } from "./env-validator.ts";
import { makeFinding, summarizeStatus } from "./sync-utils.ts";

export function checkRancherSync(context: DeploymentSyncContext = {}): RancherSyncStatus {
  const env = context.env ?? {};
  const rancherConfigured =
    isEnvConfigured(env, "RANCHER_CLUSTER_ID") || isEnvConfigured(env, "RANCHER_PROJECT_ID");
  const findings = rancherConfigured
    ? [
        makeFinding(
          "rancher",
          isEnvConfigured(env, "RANCHER_CLUSTER_ID") ? "configured" : "not_configured",
          "medium",
          "rancher.cluster",
          "Rancher cluster ID is configured but still requires namespace, ingress, TLS, rollback, limits, and monitoring review."
        ),
        makeFinding(
          "rancher",
          isEnvConfigured(env, "RANCHER_PROJECT_ID") ? "configured" : "not_configured",
          "medium",
          "rancher.project",
          "Rancher project ID is configured; secrets must be managed outside the repo."
        ),
        makeFinding(
          "rancher",
          "needs_review",
          "high",
          "rancher.production_ops",
          "Rancher/Kubernetes must not become required for MVP unless the owner approves the ops path."
        )
      ]
    : [
        makeFinding(
          "rancher",
          "skipped_for_mvp",
          "low",
          "rancher.optional",
          "Rancher is optional for MVP and is skipped unless cluster/project configuration exists."
        )
      ];
  return Object.freeze({
    provider: "rancher",
    ...summarizeStatus(findings),
    findings: Object.freeze(findings),
    metadata: Object.freeze({ requiredForMvp: false })
  });
}
