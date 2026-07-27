export type AutonomyLevel = "off" | "assistive" | "supervised" | "autonomous_safe";

export type AutonomyTaskStatus =
  | "passing"
  | "warning"
  | "blocked"
  | "needs_manual_setup"
  | "not_configured";

export type AutonomySystemCheck = {
  id: string;
  label: string;
  status: AutonomyTaskStatus;
  severity: "low" | "medium" | "high" | "critical";
  summary: string;
  recommendedAction: string;
  canAutoFix: boolean;
  requiresHumanApproval: boolean;
};
