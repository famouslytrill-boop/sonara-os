export type RiskLabel = "low" | "medium" | "high" | "critical";

export type SecurityItemStatus = "ready" | "review_required" | "blocked" | "placeholder";

export type AuditLogRecord = Readonly<{
  id: string;
  organization_id: string;
  created_by: string;
  created_at: string;
  event_type: string;
  entity_type: string;
  entity_id?: string;
  risk: RiskLabel;
  summary: string;
  metadata: Readonly<Record<string, string>>;
}>;

export type ApprovalEvent = Readonly<{
  id: string;
  organization_id: string;
  created_by: string;
  created_at: string;
  approval_type: string;
  status: "pending" | "approved" | "blocked";
  risk: RiskLabel;
  summary: string;
  requiredReview: string;
}>;

export type LaunchSecurityCheck = Readonly<{
  id: string;
  title: string;
  description: string;
  risk: RiskLabel;
  status: SecurityItemStatus;
  route: string;
}>;

export const trustShieldRiskLabels = Object.freeze([
  "low",
  "medium",
  "high",
  "critical"
] satisfies readonly RiskLabel[]);

export const launchSecurityChecklist: readonly LaunchSecurityCheck[] = Object.freeze([
  Object.freeze({
    id: "owner-lock",
    title: "Owner Lock",
    description:
      "High-risk publishing, payment, privacy, and security changes require owner review.",
    risk: "high",
    status: "placeholder",
    route: "/security-center/approval-gates"
  }),
  Object.freeze({
    id: "audit-logs",
    title: "Audit Logs",
    description: "Security events use organization, actor, timestamp, entity, and risk metadata.",
    risk: "medium",
    status: "ready",
    route: "/security-center/audit-logs"
  }),
  Object.freeze({
    id: "source-leak-prevention",
    title: "Source Leak Prevention",
    description:
      "Secrets, service-role keys, and private customer records must never enter public output.",
    risk: "critical",
    status: "blocked",
    route: "/security-center/source-leak-prevention"
  }),
  Object.freeze({
    id: "phishing-defense",
    title: "Phishing Defense",
    description:
      "Suspicious external links and payment destinations require review before display.",
    risk: "high",
    status: "review_required",
    route: "/security-center/phishing-defense"
  }),
  Object.freeze({
    id: "provider-safety",
    title: "Provider Safety",
    description:
      "External model work must stay behind Provider Gateway safety and policy boundaries.",
    risk: "critical",
    status: "blocked",
    route: "/security-center/external-model-safety"
  })
]);

export const auditLogModel: readonly AuditLogRecord[] = Object.freeze([
  Object.freeze({
    id: "audit-model-001",
    organization_id: "setup_organization",
    created_by: "setup_actor",
    created_at: "2026-05-18T00:00:00.000Z",
    event_type: "launch_security_check.reviewed",
    entity_type: "security_check",
    entity_id: "source-leak-prevention",
    risk: "critical",
    summary:
      "Source leak prevention remains blocked until secret scanning and review gates are wired.",
    metadata: Object.freeze({
      mode: "setup",
      data_classification: "model_only"
    })
  }),
  Object.freeze({
    id: "audit-model-002",
    organization_id: "setup_organization",
    created_by: "setup_actor",
    created_at: "2026-05-18T00:00:00.000Z",
    event_type: "approval_gate.created",
    entity_type: "approval_event",
    entity_id: "provider-safety",
    risk: "high",
    summary: "Provider changes require human review before production enablement.",
    metadata: Object.freeze({
      mode: "setup",
      data_classification: "model_only"
    })
  })
]);

export const approvalEventModel: readonly ApprovalEvent[] = Object.freeze([
  Object.freeze({
    id: "approval-model-001",
    organization_id: "setup_organization",
    created_by: "setup_actor",
    created_at: "2026-05-18T00:00:00.000Z",
    approval_type: "payment_or_security_change",
    status: "pending",
    risk: "high",
    summary: "Payment, billing, security, and permission changes require owner approval.",
    requiredReview: "Owner or admin review before enablement."
  }),
  Object.freeze({
    id: "approval-model-002",
    organization_id: "setup_organization",
    created_by: "setup_actor",
    created_at: "2026-05-18T00:00:00.000Z",
    approval_type: "source_or_secret_exposure",
    status: "blocked",
    risk: "critical",
    summary: "Service-role keys, secrets, and private records are blocked from public output.",
    requiredReview: "Critical risks stay blocked until reviewed and remediated."
  })
]);

export function getRiskLabelText(risk: RiskLabel): string {
  if (risk === "low") {
    return "Low";
  }
  if (risk === "medium") {
    return "Medium";
  }
  if (risk === "high") {
    return "High";
  }
  return "Critical";
}

export function isCriticalRiskBlocked(risk: RiskLabel, status: SecurityItemStatus): boolean {
  return risk === "critical" && status === "blocked";
}

export function summarizeSecurityChecklist() {
  const blocked = launchSecurityChecklist.filter((item) => item.status === "blocked").length;
  const reviewRequired = launchSecurityChecklist.filter(
    (item) => item.status === "review_required" || item.risk === "high"
  ).length;
  return Object.freeze({
    total: launchSecurityChecklist.length,
    blocked,
    reviewRequired
  });
}
