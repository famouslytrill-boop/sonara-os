import type { FeatureSpec, FeatureSpecInput, FeatureSpecSectionName } from "./types.ts";

export const requiredSpecSections: readonly FeatureSpecSectionName[] = Object.freeze([
  "problem",
  "users",
  "userStories",
  "nonGoals",
  "dataModelNotes",
  "routeRequirements",
  "apiRequirements",
  "securityRequirements",
  "privacyRequirements",
  "acceptanceCriteria",
  "testRequirements",
  "launchGateRequirements"
]);

export function createFeatureSpec(input: FeatureSpecInput): FeatureSpec {
  return Object.freeze({
    id: input.id,
    title: input.title,
    productArea: input.productArea,
    problem: input.problem ?? "",
    users: freezeList(input.users),
    userStories: freezeList(input.userStories),
    nonGoals: freezeList(input.nonGoals),
    dataModelNotes: freezeList(input.dataModelNotes),
    routeRequirements: freezeList(input.routeRequirements),
    apiRequirements: freezeList(input.apiRequirements),
    securityRequirements: freezeList(input.securityRequirements),
    privacyRequirements: freezeList(input.privacyRequirements),
    acceptanceCriteria: freezeList(input.acceptanceCriteria),
    testRequirements: freezeList(input.testRequirements),
    launchGateRequirements: freezeList(input.launchGateRequirements)
  });
}

export function isFeatureSpecComplete(spec: Partial<FeatureSpec>): boolean {
  return requiredSpecSections.every((section) => hasSectionContent(spec, section));
}

export function hasSectionContent(
  spec: Partial<FeatureSpec>,
  section: FeatureSpecSectionName
): boolean {
  const value = spec[section];
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return Array.isArray(value) && value.some((item) => item.trim().length > 0);
}

function freezeList(value: readonly string[] | undefined): readonly string[] {
  return Object.freeze([...(value ?? [])].map((item) => item.trim()).filter(Boolean));
}
