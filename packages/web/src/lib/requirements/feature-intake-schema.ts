export type FeatureIntakeCategory =
  | "bug_report"
  | "new_feature"
  | "workflow_change"
  | "pricing_change"
  | "security_change"
  | "research_candidate";

export type FeatureIntakeSubmission = Readonly<{
  feature: string;
  user: string;
  problem: string;
  route: string;
  dataNeeded: string;
  permissionsRequired: string;
  blockedBehavior: string;
  doneDefinition: string;
  tests: string;
  category: FeatureIntakeCategory;
}>;

export type FeatureIntakeValidationResult = Readonly<{
  ok: boolean;
  missingQuestions: readonly string[];
  blockedReasons: readonly string[];
}>;

export const featureIntakeRequiredQuestions = Object.freeze([
  "What is the feature?",
  "Who uses it?",
  "What problem does it solve?",
  "What page or route does it affect?",
  "What data does it need?",
  "What permissions are required?",
  "What should be blocked?",
  "What does done mean?",
  "What tests prove it works?"
]);

const requiredFieldLabels: Readonly<Record<keyof FeatureIntakeSubmission, string>> = Object.freeze({
  feature: "What is the feature?",
  user: "Who uses it?",
  problem: "What problem does it solve?",
  route: "What page or route does it affect?",
  dataNeeded: "What data does it need?",
  permissionsRequired: "What permissions are required?",
  blockedBehavior: "What should be blocked?",
  doneDefinition: "What does done mean?",
  tests: "What tests prove it works?",
  category: "What category is it?"
});

const blockedRequestPatterns = Object.freeze([
  /asap/i,
  /just build/i,
  /no spec/i,
  /skip review/i,
  /bypass/i,
  /auto deploy/i,
  /auto charge/i,
  /scrape private/i,
  /jailbreak/i
]);

export function validateFeatureIntake(
  input: Partial<FeatureIntakeSubmission>
): FeatureIntakeValidationResult {
  const missingQuestions = (Object.keys(requiredFieldLabels) as (keyof FeatureIntakeSubmission)[])
    .filter((field) => !String(input[field] ?? "").trim())
    .map((field) => requiredFieldLabels[field]);
  const unsafeRequestText = Object.entries(input)
    .filter(([field]) => field !== "blockedBehavior")
    .map(([, value]) => String(value ?? ""))
    .join(" ");
  const blockedReasons = blockedRequestPatterns
    .filter((pattern) => pattern.test(unsafeRequestText))
    .map((pattern) => `Request contains blocked vague or unsafe term: ${pattern.source}`);

  return Object.freeze({
    ok: missingQuestions.length === 0 && blockedReasons.length === 0,
    missingQuestions: Object.freeze(missingQuestions),
    blockedReasons: Object.freeze(blockedReasons)
  });
}

export function createFeatureIntakeSubmission(
  input: FeatureIntakeSubmission
): FeatureIntakeSubmission {
  const validation = validateFeatureIntake(input);
  if (!validation.ok) {
    throw new Error(
      `Feature intake is incomplete: ${[...validation.missingQuestions, ...validation.blockedReasons].join("; ")}`
    );
  }
  return Object.freeze({
    feature: input.feature.trim(),
    user: input.user.trim(),
    problem: input.problem.trim(),
    route: input.route.trim(),
    dataNeeded: input.dataNeeded.trim(),
    permissionsRequired: input.permissionsRequired.trim(),
    blockedBehavior: input.blockedBehavior.trim(),
    doneDefinition: input.doneDefinition.trim(),
    tests: input.tests.trim(),
    category: input.category
  });
}
