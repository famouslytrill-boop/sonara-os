import { hasSectionContent, requiredSpecSections } from "./feature-spec.ts";
import type { FeatureSpec, SpecDriftIssue, SpecDriftReport } from "./types.ts";

export function checkSpecDrift(spec: Partial<FeatureSpec>): SpecDriftReport {
  const issues: SpecDriftIssue[] = [];

  for (const section of requiredSpecSections) {
    if (!hasSectionContent(spec, section)) {
      issues.push(
        Object.freeze({
          section,
          message: `Missing required spec section: ${section}.`,
          severity: "error" as const
        })
      );
    }
  }

  return Object.freeze({
    ok: issues.length === 0,
    issues: Object.freeze(issues)
  });
}
