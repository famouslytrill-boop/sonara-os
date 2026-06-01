import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const repoTaskRouterModule: InfrastructureModule = {
  id: "ai-models.repo-task-router",
  publicName: "Repo Task Router",
  internalName: "RepoTaskRouterEngine",
  description:
    "Safe typed scaffold for Repo Task Router; production behavior requires human review and explicit enablement.",
  featureFlag: "MODEL_PROVIDER_REGISTRY_ENABLED",
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

export function createRepoTaskRouterReport() {
  return createInfrastructureReport(repoTaskRouterModule);
}
