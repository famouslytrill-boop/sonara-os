import { createActionQueue } from "./action-queue.ts";
import { approveWorkflowRecord, rejectWorkflowRecord } from "./human-approval-gate.ts";
import { createRoutineTaskRunner } from "./routine-task-runner.ts";
import type { WorkflowRecord, WorkflowRecordInput } from "./types.ts";

export const workflowTypeLabels = Object.freeze({
  follow_up_customer: "Follow up customer",
  request_review: "Request review",
  send_booking_reminder: "Send booking reminder",
  create_offer_draft: "Create offer draft",
  flag_unpaid_invoice: "Flag unpaid invoice",
  flag_incomplete_profile: "Flag incomplete profile",
  suggest_campaign: "Suggest campaign",
  suggest_win_back: "Suggest win-back",
  create_task: "Create task",
  draft_message: "Draft message",
  sync_external_connection: "Sync external connection"
});

export const defaultWorkflowInputs: readonly WorkflowRecordInput[] = Object.freeze([
  Object.freeze({
    workflowType: "flag_incomplete_profile",
    actionKind: "flag_missing_info",
    title: "Flag missing proof profile details",
    description: "Create an internal setup flag when key profile fields are missing.",
    confidence: 0.92
  }),
  Object.freeze({
    workflowType: "draft_message",
    actionKind: "draft_message",
    title: "Draft customer follow-up",
    description: "Prepare a message draft for owner review before sending.",
    confidence: 0.78
  }),
  Object.freeze({
    workflowType: "request_review",
    actionKind: "send_review_request",
    title: "Request review from recent customer",
    description: "Queue a review request that requires owner approval before sending.",
    confidence: 0.7
  }),
  Object.freeze({
    workflowType: "create_offer_draft",
    actionKind: "publish_offer",
    title: "Publish drafted offer",
    description: "Publishing changes public offer copy and must be owner reviewed.",
    confidence: 0.66
  }),
  Object.freeze({
    workflowType: "sync_external_connection",
    actionKind: "delete_customer_data",
    title: "Delete customer data from external source",
    description: "Deletion is blocked from routine automation.",
    confidence: 0.3
  })
]);

export function createAutopilotWorkflowEngine() {
  const queue = createActionQueue();
  const runner = createRoutineTaskRunner(queue);

  function seedDefaults() {
    for (const input of defaultWorkflowInputs) {
      runner.run(input);
    }
    return queue.getState();
  }

  function queueWorkflow(input: WorkflowRecordInput) {
    return runner.run(input);
  }

  function approve(record: WorkflowRecord, reviewerId: string) {
    const decision = approveWorkflowRecord(record, reviewerId);
    queue.recordApproval(decision.record, decision.auditEvent);
    return decision;
  }

  function reject(record: WorkflowRecord, reviewerId: string, reason?: string) {
    const decision = rejectWorkflowRecord(record, reviewerId, reason);
    queue.recordApproval(decision.record, decision.auditEvent);
    return decision;
  }

  return Object.freeze({
    seedDefaults,
    queueWorkflow,
    approve,
    reject,
    getState: queue.getState
  });
}
