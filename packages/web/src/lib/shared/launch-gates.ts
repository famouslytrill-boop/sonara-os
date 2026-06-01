import { areUnsafeFlagsDisabled } from "./feature-flags.ts";
import type { SafetyGateDecision } from "./types.ts";

export interface LaunchGateInput {
  lintPassed: boolean;
  typecheckPassed: boolean;
  buildPassed: boolean;
  securityReviewed: boolean;
  paymentReviewed: boolean;
  privacyReviewed: boolean;
}

export function evaluateLaunchGate(input: LaunchGateInput): SafetyGateDecision {
  const blockedReasons: string[] = [];
  if (!input.lintPassed) blockedReasons.push("Lint must pass.");
  if (!input.typecheckPassed) blockedReasons.push("Typecheck must pass.");
  if (!input.buildPassed) blockedReasons.push("Build must pass.");
  if (!input.securityReviewed) blockedReasons.push("Security review is required.");
  if (!input.paymentReviewed) blockedReasons.push("Payment review is required.");
  if (!input.privacyReviewed) blockedReasons.push("Privacy review is required.");
  if (!areUnsafeFlagsDisabled()) blockedReasons.push("Unsafe flags must remain disabled.");

  return {
    allowed: blockedReasons.length === 0,
    blockedReasons,
    requiresHumanReview: blockedReasons.length > 0
  };
}
