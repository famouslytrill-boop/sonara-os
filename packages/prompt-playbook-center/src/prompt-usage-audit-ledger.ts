import type { BuiltPrompt, PromptUsageAuditEvent } from "./types.ts";

export function createPromptUsageAuditEvent(
  builtPrompt: BuiltPrompt,
  createdAt = new Date().toISOString()
): PromptUsageAuditEvent {
  return Object.freeze({
    id: `prompt_audit_${builtPrompt.template.id}_${createdAt}`,
    template_id: builtPrompt.template.id,
    product_area: builtPrompt.template.product_area,
    category: builtPrompt.template.category,
    risk_level: builtPrompt.safety.risk_level,
    approval_status: builtPrompt.safety.approval_status,
    summary: `${builtPrompt.template.name} evaluated as ${builtPrompt.safety.status}.`,
    created_at: createdAt,
    metadata: Object.freeze({
      qualityScore: builtPrompt.quality.score,
      publicApprovalRequired: builtPrompt.approval_required,
      blockedTerms: builtPrompt.safety.blocked_terms
    })
  });
}

export function createPromptUsageAuditLedger(
  builtPrompts: readonly BuiltPrompt[]
): readonly PromptUsageAuditEvent[] {
  return Object.freeze(builtPrompts.map((builtPrompt) => createPromptUsageAuditEvent(builtPrompt)));
}
