export type LaunchReadinessStatus = "blocked" | "review" | "approved";
export interface LaunchChecklistItem {
  section: string;
  complete: boolean;
  ownerApproved?: boolean;
}
export interface EnvironmentVariableCheck {
  key: string;
  required: boolean;
  present: boolean;
  clientSafe: boolean;
}
export interface DeploymentApproval {
  ownerApproved: boolean;
  rollbackNotes?: string;
}
export interface RollbackPlan {
  summary: string;
  tested: boolean;
}
export interface SecretExposureRisk {
  exposed: boolean;
  location?: string;
}
export interface InfrastructureProvider {
  name: string;
  configured: boolean;
}
export interface LaunchReadinessInput {
  env: EnvironmentVariableCheck[];
  approval: DeploymentApproval;
  serviceRoleClientExposure: boolean;
}
