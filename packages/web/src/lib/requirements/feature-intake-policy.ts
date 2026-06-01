import type { FeatureIntakeSubmission } from "./feature-intake-schema.ts";
import { featureIntakeRequiredQuestions, validateFeatureIntake } from "./feature-intake-schema.ts";

export type FeatureSpecCard = Readonly<{
  title: string;
  audience: string;
  route: string;
  problem: string;
  dataNeeded: string;
  permissionsRequired: string;
  blockedBehavior: string;
  doneDefinition: string;
  tests: readonly string[];
  ownerReviewRequired: boolean;
}>;

const highRiskCategoryLabels = new Set<FeatureIntakeSubmission["category"]>([
  "pricing_change",
  "security_change",
  "research_candidate"
]);

export function createFeatureSpecCard(input: FeatureIntakeSubmission): FeatureSpecCard {
  const validation = validateFeatureIntake(input);
  if (!validation.ok) {
    throw new Error("Feature intake must be validated before a sprint spec can be generated.");
  }
  return Object.freeze({
    title: input.feature,
    audience: input.user,
    route: input.route,
    problem: input.problem,
    dataNeeded: input.dataNeeded,
    permissionsRequired: input.permissionsRequired,
    blockedBehavior: input.blockedBehavior,
    doneDefinition: input.doneDefinition,
    tests: Object.freeze(splitTests(input.tests)),
    ownerReviewRequired: highRiskCategoryLabels.has(input.category)
  });
}

export function createCodexRequirementsGatePrompt(input: FeatureIntakeSubmission): string {
  const spec = createFeatureSpecCard(input);
  return [
    `Feature: ${spec.title}`,
    `User: ${spec.audience}`,
    `Route: ${spec.route}`,
    `Problem: ${spec.problem}`,
    `Data needed: ${spec.dataNeeded}`,
    `Permissions required: ${spec.permissionsRequired}`,
    `Blocked behavior: ${spec.blockedBehavior}`,
    `Done means: ${spec.doneDefinition}`,
    `Tests: ${spec.tests.join("; ")}`,
    `Owner review required: ${spec.ownerReviewRequired ? "yes" : "no"}`,
    "Do not commit secrets.",
    "Do not bypass security, license, privacy, or human approval gates.",
    "Do not install third-party code unless explicitly approved."
  ].join("\n");
}

export function getFeatureIntakeRequiredQuestions(): readonly string[] {
  return featureIntakeRequiredQuestions;
}

function splitTests(tests: string): readonly string[] {
  return Object.freeze(
    tests
      .split(/\n|;/)
      .map((test) => test.trim())
      .filter(Boolean)
  );
}
