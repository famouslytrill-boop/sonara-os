import type { MemoryRecord, MemoryDecision } from "./contracts.ts";
export function evaluateMemoryConsent(record: MemoryRecord): MemoryDecision {
  if (!record.organization_id) return { allowed: false, reason: "missing_organization_id" };
  if (record.sensitive && !record.consent)
    return { allowed: false, reason: "sensitive_memory_requires_consent" };
  return { allowed: record.consent, reason: record.consent ? "consented" : "consent_required" };
}
