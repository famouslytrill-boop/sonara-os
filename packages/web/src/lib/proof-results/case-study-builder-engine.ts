import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const caseStudyBuilderEngineModule: InfrastructureModule = {
  id: "proof-results.case-study-builder-engine",
  publicName: "Case Study Builder",
  internalName: "CaseStudyBuilderEngine",
  description:
    "Safe typed scaffold for Case Study Builder; production behavior requires human review and explicit enablement.",
  featureFlag: "PROOF_RESULTS_LEDGER_ENABLED",
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

export function createCaseStudyBuilderEngineReport() {
  return createInfrastructureReport(caseStudyBuilderEngineModule);
}
