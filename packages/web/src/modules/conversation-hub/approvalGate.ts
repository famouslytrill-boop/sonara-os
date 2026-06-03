import type { OutboundMessageDraft } from "./contracts.ts";
export function canSendOutboundMessage(draft: OutboundMessageDraft) {
  const allowed = Boolean(draft.organization_id && draft.approvedBy);
  return { allowed, reason: allowed ? "human_approved" : "human_approval_required" };
}
