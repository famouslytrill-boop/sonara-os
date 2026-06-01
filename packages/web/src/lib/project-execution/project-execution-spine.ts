import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const projectExecutionSpineModule: InfrastructureModule = {
  id: "project-execution.project-execution-spine",
  publicName: "Project Execution Spine",
  internalName: "ProjectExecutionSpineEngine",
  description:
    "Safe typed scaffold for Project Execution Spine; production behavior requires human review and explicit enablement.",
  featureFlag: "PROJECT_EXECUTION_SPINE_ENABLED",
  products: ["business_builder", "creator_studio", "growth_studio"],
  launchTier: "q1_core",
  riskLevel: "medium",
  publicVisible: false,
  adminOnly: false,
  betaGated: false,
  requiredHumanReview: true,
  connectedEngines: [],
  blockedScope: ["No production data writes", "No destructive commands", "No hidden automation"],
  safetyRules: ["Feature-gated scaffold", "Human review required", "Placeholder status disclosed"]
};

export function createProjectExecutionSpineReport() {
  return createInfrastructureReport(projectExecutionSpineModule);
}

export type LaunchScope = "q1_core" | "beta_or_admin" | "blocked";

const q1CoreTerms = [
  "Business Builder",
  "Creator Studio",
  "Growth Studio",
  "Trust Shield",
  "Payment Options",
  "Launch Checklist"
];
const gatedTerms = [
  "Advanced Debugger",
  "Model Evaluation",
  "Voice AI",
  "Visual Generation",
  "Marketplace Deal Room"
];

export function classifyLaunchScope(name: string): LaunchScope {
  if (q1CoreTerms.some((term) => name.includes(term))) return "q1_core";
  if (gatedTerms.some((term) => name.includes(term))) return "beta_or_admin";
  return "blocked";
}
