export type SpecProductArea =
  | "business-builder"
  | "creator-studio"
  | "growth-studio"
  | "security-center"
  | "shared-infrastructure";

export type FeatureSpecSectionName =
  | "problem"
  | "users"
  | "userStories"
  | "nonGoals"
  | "dataModelNotes"
  | "routeRequirements"
  | "apiRequirements"
  | "securityRequirements"
  | "privacyRequirements"
  | "acceptanceCriteria"
  | "testRequirements"
  | "launchGateRequirements";

export type FeatureSpec = Readonly<{
  id: string;
  title: string;
  productArea: SpecProductArea;
  problem: string;
  users: readonly string[];
  userStories: readonly string[];
  nonGoals: readonly string[];
  dataModelNotes: readonly string[];
  routeRequirements: readonly string[];
  apiRequirements: readonly string[];
  securityRequirements: readonly string[];
  privacyRequirements: readonly string[];
  acceptanceCriteria: readonly string[];
  testRequirements: readonly string[];
  launchGateRequirements: readonly string[];
}>;

export type FeatureSpecInput = Omit<FeatureSpec, FeatureSpecSectionName> &
  Partial<Pick<FeatureSpec, FeatureSpecSectionName>>;

export type SpecDriftIssue = Readonly<{
  section: FeatureSpecSectionName;
  message: string;
  severity: "error" | "warning";
}>;

export type SpecDriftReport = Readonly<{
  ok: boolean;
  issues: readonly SpecDriftIssue[];
}>;

export type ImplementationTask = Readonly<{
  id: string;
  title: string;
  description: string;
  sourceSection: FeatureSpecSectionName;
  required: boolean;
}>;

export type ImplementationPlan = Readonly<{
  specId: string;
  title: string;
  productArea: SpecProductArea;
  phases: readonly string[];
  tasks: readonly ImplementationTask[];
  acceptanceCriteria: readonly string[];
  testRequirements: readonly string[];
  launchGateRequirements: readonly string[];
}>;

export type CodexPromptOptions = Readonly<{
  repositoryName?: string;
  implementationMode?: "plan-only" | "implementation";
}>;
