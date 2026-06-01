import { getDeploymentConfig, type EnvStatus } from "../../config/deployment.ts";
import {
  areUnsafeFlagsDisabled,
  coreFeatureFlagDefaults,
  getUnsafeFeatureFlags
} from "../shared/feature-flags.ts";

export type DiagnosticsSnapshot = Readonly<{
  appVersion: string;
  environment: string;
  health: EnvStatus;
  database: EnvStatus;
  stripe: EnvStatus;
  aiProviders: EnvStatus;
  featureFlags: FeatureFlagSummary;
}>;

export type FeatureFlagSummary = Readonly<{
  coreEnabled: number;
  unsafeTotal: number;
  unsafeDisabled: boolean;
  summary: string;
}>;

export function createDiagnosticsSnapshot(): DiagnosticsSnapshot {
  const deployment = getDeploymentConfig();
  return Object.freeze({
    appVersion: deployment.appVersion,
    environment: deployment.environment,
    health: Object.freeze({
      configured: true,
      status: "configured",
      message: "Static health artifact is generated during build."
    }),
    database: deployment.diagnostics.database,
    stripe: deployment.diagnostics.stripe,
    aiProviders: deployment.diagnostics.aiProviders,
    featureFlags: createFeatureFlagSummary()
  });
}

export function createFeatureFlagSummary(): FeatureFlagSummary {
  const coreEnabled = Object.values(coreFeatureFlagDefaults).filter(Boolean).length;
  const unsafeTotal = getUnsafeFeatureFlags().length;
  const unsafeDisabled = areUnsafeFlagsDisabled();
  return Object.freeze({
    coreEnabled,
    unsafeTotal,
    unsafeDisabled,
    summary: unsafeDisabled
      ? `${coreEnabled} core flags enabled; ${unsafeTotal} unsafe flags disabled.`
      : "Unsafe feature flags require review before launch."
  });
}

export function formatEnvStatus(status: EnvStatus): string {
  return status.configured ? "Configured" : "Setup required";
}
