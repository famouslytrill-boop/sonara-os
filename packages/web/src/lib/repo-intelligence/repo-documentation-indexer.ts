import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const repoDocumentationIndexerModule: InfrastructureModule = {
  id: "repo-intelligence.repo-documentation-indexer",
  publicName: "Repo Documentation Indexer",
  internalName: "RepoDocumentationIndexerEngine",
  description:
    "Safe typed scaffold for Repo Documentation Indexer; production behavior requires human review and explicit enablement.",
  featureFlag: "CODEBASE_KNOWLEDGE_GRAPH_ENABLED",
  products: ["business_builder", "creator_studio", "growth_studio"],
  launchTier: "q1_core",
  riskLevel: "medium",
  publicVisible: false,
  adminOnly: true,
  betaGated: false,
  requiredHumanReview: true,
  connectedEngines: [],
  blockedScope: ["No production data writes", "No destructive commands", "No hidden automation"],
  safetyRules: ["Feature-gated scaffold", "Human review required", "Placeholder status disclosed"]
};

export function createRepoDocumentationIndexerReport() {
  return createInfrastructureReport(repoDocumentationIndexerModule);
}
