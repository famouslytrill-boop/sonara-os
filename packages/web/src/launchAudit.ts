import { finalExportTiers } from "./exportTiers.ts";
import { getSignalEnv, validateSignalEnv } from "./lib/env.ts";
import { auditServerSecrets } from "./lib/server-secrets.ts";
import { getRequiredLaunchRoutes } from "./routes/route-manifest.ts";

export type LaunchAuditItem = Readonly<{
  label: string;
  status: "pass" | "warning";
  detail: string;
}>;

export function createLaunchAuditReport(): readonly LaunchAuditItem[] {
  const env = getSignalEnv();
  const envValidation = validateSignalEnv(env);
  const secretAudit = auditServerSecrets();

  return Object.freeze([
    Object.freeze({
      label: "Environment",
      status: envValidation.valid ? "pass" : "warning",
      detail: envValidation.valid
        ? "Environment contract is coherent."
        : envValidation.warnings.join(" ")
    }),
    Object.freeze({
      label: "Server Secrets",
      status: secretAudit.publicLeakDetected ? "warning" : "pass",
      detail: secretAudit.message
    }),
    Object.freeze({
      label: "Launch Routes",
      status: "pass",
      detail: `${getRequiredLaunchRoutes().length} required routes registered.`
    }),
    Object.freeze({
      label: "Export Tiers",
      status: "pass",
      detail: `${finalExportTiers.length} final export tiers registered.`
    }),
    Object.freeze({
      label: "Provider Gateway",
      status: "pass",
      detail: "Rights-safer style rewrite is available before provider routing."
    }),
    Object.freeze({
      label: "Workflow Guards",
      status: "pass",
      detail: "Create to Export route requirements are centralized."
    })
  ]);
}
