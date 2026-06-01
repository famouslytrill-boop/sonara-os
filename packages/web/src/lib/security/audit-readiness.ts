import type { AuditLogRecord, RiskLabel } from "./trust-shield-mvp.ts";

export type SensitiveAuditActionType =
  | "billing.change"
  | "owner_lock.change"
  | "provider_config.change"
  | "ai_provider.use"
  | "legal_review_packet.create"
  | "payment_link.change"
  | "role.change";

export type SensitiveAuditActionModel = Readonly<{
  action: SensitiveAuditActionType;
  label: string;
  risk: RiskLabel;
  requiresHumanReview: boolean;
  durableWriteStatus: "model_only";
}>;

export type SensitiveAuditRecordInput = Readonly<{
  action: SensitiveAuditActionType;
  organizationId: string;
  actorId: string;
  entityType: string;
  entityId?: string;
  summary: string;
}>;

export const sensitiveAuditActionModels: readonly SensitiveAuditActionModel[] = Object.freeze([
  Object.freeze({
    action: "billing.change",
    label: "Billing changes",
    risk: "high",
    requiresHumanReview: true,
    durableWriteStatus: "model_only"
  }),
  Object.freeze({
    action: "owner_lock.change",
    label: "Owner Lock changes",
    risk: "critical",
    requiresHumanReview: true,
    durableWriteStatus: "model_only"
  }),
  Object.freeze({
    action: "provider_config.change",
    label: "Provider config changes",
    risk: "critical",
    requiresHumanReview: true,
    durableWriteStatus: "model_only"
  }),
  Object.freeze({
    action: "ai_provider.use",
    label: "AI provider use",
    risk: "high",
    requiresHumanReview: false,
    durableWriteStatus: "model_only"
  }),
  Object.freeze({
    action: "legal_review_packet.create",
    label: "Legal review packets",
    risk: "high",
    requiresHumanReview: true,
    durableWriteStatus: "model_only"
  }),
  Object.freeze({
    action: "payment_link.change",
    label: "Payment link changes",
    risk: "high",
    requiresHumanReview: true,
    durableWriteStatus: "model_only"
  }),
  Object.freeze({
    action: "role.change",
    label: "Role changes",
    risk: "critical",
    requiresHumanReview: true,
    durableWriteStatus: "model_only"
  })
]);

export function getSensitiveAuditActionModel(
  action: SensitiveAuditActionType
): SensitiveAuditActionModel {
  const model = sensitiveAuditActionModels.find((item) => item.action === action);
  if (!model) {
    throw new Error(`Unknown sensitive audit action: ${action}`);
  }
  return model;
}

export function createSensitiveAuditRecord(input: SensitiveAuditRecordInput): AuditLogRecord {
  const model = getSensitiveAuditActionModel(input.action);
  return Object.freeze({
    id: `${input.action}.${input.entityId ?? "pending"}`,
    organization_id: input.organizationId,
    created_by: input.actorId,
    created_at: new Date().toISOString(),
    event_type: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    risk: model.risk,
    summary: input.summary,
    metadata: Object.freeze({
      durable_write_status: model.durableWriteStatus,
      requires_human_review: String(model.requiresHumanReview)
    })
  });
}
