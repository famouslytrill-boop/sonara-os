import { formatAcceptanceCriteria } from "./acceptance-criteria.ts";
import type { CodexPromptOptions, FeatureSpec } from "./types.ts";

export function createCodexPrompt(spec: FeatureSpec, options: CodexPromptOptions = {}): string {
  const repositoryName = options.repositoryName ?? "SONARA Industries";
  const implementationMode = options.implementationMode ?? "implementation";
  return [
    `You are working inside ${repositoryName}.`,
    "",
    `Mode: ${implementationMode}`,
    `Feature: ${spec.title}`,
    `Spec ID: ${spec.id}`,
    `Product area: ${spec.productArea}`,
    "",
    "Problem",
    spec.problem,
    "",
    "Users",
    formatList(spec.users),
    "",
    "User Stories",
    formatList(spec.userStories),
    "",
    "Non-Goals",
    formatList(spec.nonGoals),
    "",
    "Data Model Notes",
    formatList(spec.dataModelNotes),
    "",
    "Route Requirements",
    formatList(spec.routeRequirements),
    "",
    "API Requirements",
    formatList(spec.apiRequirements),
    "",
    "Security Requirements",
    formatList(spec.securityRequirements),
    "",
    "Privacy Requirements",
    formatList(spec.privacyRequirements),
    "",
    "Acceptance Criteria",
    formatAcceptanceCriteria(spec),
    "",
    "Test Requirements",
    formatList(spec.testRequirements),
    "",
    "Launch Gate Requirements",
    formatList(spec.launchGateRequirements),
    "",
    "Working Rules",
    "- Do not add features outside this spec.",
    "- Do not weaken security or privacy requirements.",
    "- Stop and document any blocker instead of inventing missing architecture.",
    "- Finish with the listed validation commands and a concise implementation summary."
  ].join("\n");
}

function formatList(items: readonly string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- Not specified";
}
