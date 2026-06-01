import type { FeatureSpec } from "./types.ts";

export function normalizeAcceptanceCriteria(criteria: readonly string[]): readonly string[] {
  return Object.freeze(criteria.map((item) => item.trim()).filter(Boolean));
}

export function hasAcceptanceCriteria(spec: Partial<FeatureSpec>): boolean {
  return (
    Array.isArray(spec.acceptanceCriteria) &&
    normalizeAcceptanceCriteria(spec.acceptanceCriteria).length > 0
  );
}

export function formatAcceptanceCriteria(spec: FeatureSpec): string {
  const criteria = normalizeAcceptanceCriteria(spec.acceptanceCriteria);
  if (criteria.length === 0) {
    return "No acceptance criteria defined.";
  }
  return criteria.map((criterion, index) => `${index + 1}. ${criterion}`).join("\n");
}
