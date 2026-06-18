import type { ModelRoutingDecision, ModelRoutingRequest } from "./model-provider-types.ts";

export type ModelRoutingAuditEntry = Readonly<{
  id: string;
  actorRole: ModelRoutingRequest["actorRole"];
  taskType: ModelRoutingRequest["taskType"];
  providerTier: ModelRoutingDecision["providerTier"];
  costTier: ModelRoutingDecision["costTier"];
  externalModelAllowed: boolean;
  requiresAdminReview: boolean;
  timestamp: string;
  secretsExposed: false;
}>;

export function createModelRoutingAuditEntry(
  request: ModelRoutingRequest,
  decision: ModelRoutingDecision,
  timestamp = new Date().toISOString()
): ModelRoutingAuditEntry {
  return Object.freeze({
    id: `model_route_${request.taskType}_${timestamp}`,
    actorRole: request.actorRole,
    taskType: request.taskType,
    providerTier: decision.providerTier,
    costTier: decision.costTier,
    externalModelAllowed: decision.externalModelAllowed,
    requiresAdminReview: decision.requiresAdminReview,
    timestamp,
    secretsExposed: false
  });
}
