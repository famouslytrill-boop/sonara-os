import { entityConfigs, type EntityConfig, type EntitySlug } from "./config";
import { requiresHumanApproval, type EntityActionRisk } from "./security";

export type EntityHeartbeatStatus = "healthy" | "warning" | "critical" | "unknown" | "setup_required";

export type EntityHeartbeatSummary = {
  entitySlug: EntitySlug;
  entityName: string;
  status: EntityHeartbeatStatus;
  healthScore: number;
  warnings: string[];
  blockers: string[];
  recommendedNextActions: string[];
  checkedAt: string;
};

export function createEntityHeartbeatSummary(entity: EntityConfig): EntityHeartbeatSummary {
  const setupRequired = entity.connectors.filter((connector) => connector.status === "setup_required").length;
  const activeTools = entity.tools.filter((tool) => tool.status === "active").length;
  const baseScore = 72 + activeTools * 4 - setupRequired * 5;
  const healthScore = Math.max(25, Math.min(92, baseScore));

  return {
    entitySlug: entity.slug,
    entityName: entity.name,
    status: setupRequired > 0 ? "setup_required" : "healthy",
    healthScore,
    warnings: setupRequired > 0 ? ["Some connectors or tools require external setup before live operations."] : [],
    blockers: setupRequired > 0 ? ["Credentials, MCP servers, worker queues, or production secrets are not configured in code."] : [],
    recommendedNextActions: entity.proactiveActions.map((action) => action.title),
    checkedAt: new Date().toISOString(),
  };
}

export function createAllEntityHeartbeatSummaries() {
  return entityConfigs.map(createEntityHeartbeatSummary);
}

export type ProposedEntityActionInput = {
  entitySlug: EntitySlug;
  title: string;
  description: string;
  actionType: string;
  priority?: "low" | "medium" | "high" | "critical";
  risk?: EntityActionRisk;
};

export function proposeEntityAction(input: ProposedEntityActionInput) {
  const requiresApproval = requiresHumanApproval(input.actionType, input.risk);

  return {
    ...input,
    priority: input.priority ?? (requiresApproval ? "high" : "medium"),
    status: "proposed" as const,
    requiresApproval,
    approvalStatus: requiresApproval ? ("pending" as const) : ("not_required" as const),
    createdAt: new Date().toISOString(),
  };
}

export function approveEntityAction(action: ReturnType<typeof proposeEntityAction>, approvedByRole: "owner" | "admin") {
  return {
    ...action,
    status: "approved" as const,
    approvalStatus: "approved" as const,
    approvedByRole,
    decidedAt: new Date().toISOString(),
  };
}

export function rejectEntityAction(action: ReturnType<typeof proposeEntityAction>, decisionNote: string) {
  return {
    ...action,
    status: "rejected" as const,
    approvalStatus: "rejected" as const,
    decisionNote,
    decidedAt: new Date().toISOString(),
  };
}

export function markActionInProgress(action: ReturnType<typeof proposeEntityAction>) {
  return { ...action, status: "in_progress" as const, startedAt: new Date().toISOString() };
}

export function completeEntityAction(action: ReturnType<typeof proposeEntityAction>, summary: string) {
  return { ...action, status: "completed" as const, summary, completedAt: new Date().toISOString() };
}

export function logEntityActionRun(input: {
  entitySlug: EntitySlug;
  runType: string;
  status: "queued" | "running" | "completed" | "failed" | "setup_required";
  summary: string;
  logs?: string[];
}) {
  return {
    ...input,
    logs: input.logs ?? [],
    createdAt: new Date().toISOString(),
  };
}
