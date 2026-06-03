import type { DeploymentApproval } from "./contracts.ts";
export function canApproveDeployment(approval: DeploymentApproval): boolean {
  return approval.ownerApproved && Boolean(approval.rollbackNotes);
}
