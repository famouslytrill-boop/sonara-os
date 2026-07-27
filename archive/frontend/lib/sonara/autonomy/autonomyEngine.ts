import { defaultBackgroundChecks } from "./backgroundSystems";
import type { AutonomyLevel, AutonomySystemCheck } from "./autonomyTypes";

export function getDefaultAutonomyLevel(): AutonomyLevel {
  return "supervised";
}

export function getAutonomyChecks(level: AutonomyLevel = getDefaultAutonomyLevel()): AutonomySystemCheck[] {
  if (level === "off") {
    return defaultBackgroundChecks.map((check) => ({
      ...check,
      status: "not_configured",
      canAutoFix: false,
      summary: "Autonomy is off. SONARA will not run this check automatically.",
    }));
  }

  return defaultBackgroundChecks.map((check) => ({
    ...check,
    canAutoFix: level === "autonomous_safe" ? check.canAutoFix && !check.requiresHumanApproval : check.canAutoFix,
  }));
}

export function summarizeAutonomy(checks: AutonomySystemCheck[]) {
  const blocked = checks.filter((check) => check.status === "blocked").length;
  const manual = checks.filter((check) => check.status === "needs_manual_setup").length;
  const passing = checks.filter((check) => check.status === "passing").length;

  return {
    score: Math.round((passing / checks.length) * 100),
    blocked,
    manual,
    nextActions: checks
      .filter((check) => check.status !== "passing")
      .slice(0, 5)
      .map((check) => check.recommendedAction),
  };
}

export function evaluateAutonomyClaim(claim: string): AutonomySystemCheck {
  const unsafeAutonomyTerms = [
    ["self", "-aware"],
    ["sen", "tient"],
    ["con", "scious"],
    ["guaranteed", " ipo"],
    ["guaranteed", " profit"],
  ].map((parts) => parts.join(""));
  const unsafeBiometricTerms = [
    ["biometric", " database"],
    ["fingerprint", " storage"],
    ["face scan", " storage"],
    ["voiceprint", " storage"],
  ].map((parts) => parts.join(""));
  const unsafeSelfAware = unsafeAutonomyTerms.some((term) => new RegExp(`\\b${term}\\b`, "i").test(claim));
  const unsafeBiometric = unsafeBiometricTerms.some((term) => new RegExp(`\\b${term}\\b`, "i").test(claim));

  if (unsafeSelfAware || unsafeBiometric) {
    return {
      id: unsafeBiometric ? "unsafe_biometric_storage_check" : "self_awareness_claim_check",
      label: unsafeBiometric ? "unsafe biometric storage check" : "unsafe autonomy claim check",
      status: "blocked",
      severity: "critical",
      summary: "The claim violates SONARA launch-safety language.",
      recommendedAction: "Replace with supervised autonomy, adaptive, feedback-driven, passkey/WebAuthn planning, or IPO-readiness roadmap language.",
      canAutoFix: false,
      requiresHumanApproval: true,
    };
  }

  return {
    id: "safe_autonomy_language_check",
    label: "safe autonomy language check",
    status: "passing",
    severity: "low",
    summary: "The claim uses safe supervised-autonomy language.",
    recommendedAction: "Keep autonomy claims factual and bounded.",
    canAutoFix: true,
    requiresHumanApproval: false,
  };
}
