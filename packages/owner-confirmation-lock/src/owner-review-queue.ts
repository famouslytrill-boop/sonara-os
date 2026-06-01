import { createRecordId, redactSensitiveText } from "./owner-confirmation-policy.ts";
import type { OwnerReviewQueueItem, SensitiveActionRecord } from "./types.ts";

export function createOwnerReviewQueueItem(
  record: SensitiveActionRecord,
  createdAt = new Date().toISOString()
): OwnerReviewQueueItem {
  return Object.freeze({
    id: createRecordId("owner_review_queue"),
    action_id: record.id,
    organization_id: record.organization_id,
    created_by: record.created_by,
    created_at: createdAt,
    updated_at: createdAt,
    action_category: record.action_category,
    action_key: record.action_key,
    product_area: record.product_area,
    risk_level: record.risk_level,
    approval_status: record.approval_status,
    title: record.title,
    action_preview: redactSensitiveText(
      [
        record.description,
        record.before_preview ? `Before: ${record.before_preview}` : "",
        record.after_preview ? `After: ${record.after_preview}` : "",
        record.generated_content_preview ? `Generated: ${record.generated_content_preview}` : ""
      ]
        .filter(Boolean)
        .join(" ")
    ),
    affected_records: record.affected_records,
    expires_at: record.expires_at
  });
}
