import type { MemoryRecord } from "./contracts.ts";
export function createForgetRequest(record: MemoryRecord) {
  return {
    organization_id: record.organization_id,
    status: "pending_review",
    targetType: record.type
  };
}
