import { createActionQueue } from "./action-queue.ts";
import { createAutomationAuditLedger } from "./automation-audit-ledger.ts";
import { approveWorkflowRecord, rejectWorkflowRecord } from "./human-approval-gate.ts";
import { createRoutineTaskRunner } from "./routine-task-runner.ts";
import {
  canRunWithoutApproval,
  evaluateAutomationAction,
  isBlockedAutomationAction,
  requiresHumanApproval
} from "./safe-automation-policy.ts";
import { createAutopilotWorkflowEngine } from "./workflow-engine.ts";

export const AutopilotWorkflowEngine = Object.freeze({
  create: createAutopilotWorkflowEngine
});

export const HumanApprovalGate = Object.freeze({
  approve: approveWorkflowRecord,
  reject: rejectWorkflowRecord
});

export const RoutineTaskRunner = Object.freeze({
  create: createRoutineTaskRunner
});

export const SafeAutomationPolicy = Object.freeze({
  evaluate: evaluateAutomationAction,
  canRunWithoutApproval,
  requiresHumanApproval,
  isBlocked: isBlockedAutomationAction
});

export const ActionQueue = Object.freeze({
  create: createActionQueue
});

export const AutomationAuditLedger = Object.freeze({
  create: createAutomationAuditLedger
});
