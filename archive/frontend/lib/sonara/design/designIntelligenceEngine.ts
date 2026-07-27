import type { DesignAuditInput, DesignAuditResult } from "./designIntelligenceTypes";

export function runDesignAudit(input: DesignAuditInput): DesignAuditResult {
  const checks = [
    input.hasDarkTheme,
    input.hasReadableText,
    input.hasMobileNav,
    input.hasPrimaryCta,
    Boolean(input.usesWarmAccent),
    Boolean(input.hasTrustLinks),
  ];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const warnings: string[] = [];

  if (!input.hasReadableText) warnings.push("Readable text contrast needs review.");
  if (!input.hasMobileNav) warnings.push("Mobile navigation must remain tappable and non-overlapping.");
  if (!input.usesWarmAccent) warnings.push("Add warm accent moments to avoid a cold tool-only feel.");
  if (!input.hasTrustLinks) warnings.push("Trust, support, privacy, and terms links should be easy to find.");

  return {
    score,
    status: score >= 85 ? "passing" : score >= 65 ? "warning" : "blocked",
    strengths: ["Dark workspace", "Premium card system", "Simple conversion path"].filter((_, index) => checks[index]),
    warnings,
    nextActions: warnings.length ? warnings : ["Keep mobile conversion QA in the launch checklist."],
  };
}
