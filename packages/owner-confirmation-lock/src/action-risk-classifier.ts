import {
  getSensitiveActionRegistryEntry,
  isAlwaysBlockedActionKey,
  isOwnerConfirmationCategory
} from "./sensitive-action-registry.ts";
import type {
  ActionRiskLevel,
  OwnerApprovalRequirement,
  OwnerConfirmationAction,
  OwnerConfirmationCategory
} from "./types.ts";

export function classifyActionRisk(action: OwnerConfirmationAction): ActionRiskLevel {
  if (isAlwaysBlockedActionKey(action.actionKey)) {
    return "critical";
  }
  const entry = getSensitiveActionRegistryEntry(action.category);
  return entry?.riskLevel ?? "high";
}

export function classifyActionCategory(
  action: OwnerConfirmationAction
): OwnerConfirmationCategory | "unknown" {
  return isOwnerConfirmationCategory(action.category) ? action.category : "unknown";
}

export function getOwnerApprovalRequirement(
  action: OwnerConfirmationAction
): OwnerApprovalRequirement {
  if (isAlwaysBlockedActionKey(action.actionKey)) {
    return "blocked_always";
  }
  const entry = getSensitiveActionRegistryEntry(action.category);
  return entry?.approvalRequirement ?? "owner_review_required";
}

export function isUnknownSensitiveAction(action: OwnerConfirmationAction): boolean {
  return !isOwnerConfirmationCategory(action.category);
}
