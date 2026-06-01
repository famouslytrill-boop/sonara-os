import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const buildOrderPlannerModule: InfrastructureModule = {
  id: "implementation-sequencer.build-order-planner",
  publicName: "Build Order Planner",
  internalName: "BuildOrderPlannerEngine",
  description:
    "Safe typed scaffold for Build Order Planner; production behavior requires human review and explicit enablement.",
  featureFlag: "IMPLEMENTATION_SEQUENCER_ENABLED",
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

export function createBuildOrderPlannerReport() {
  return createInfrastructureReport(buildOrderPlannerModule);
}

export const q1BuildOrder = [
  "Shared feature flags and registries",
  "Trust Shield and Launch Security Gate",
  "Public product shell: Business Builder, Creator Studio, Growth Studio",
  "Business Profile / Proof Passport",
  "Payment Options and Get Paid Page",
  "Booking/Appointments",
  "Quotes",
  "Customer Records",
  "Reviews",
  "Files & Records",
  "Template Library",
  "Launch Checklist",
  "Consent Center and Usage Meter",
  "Connected Links",
  "Customer Import",
  "Help Center",
  "Operating Twin basic Next Best Step",
  "Debugging Tools basic report",
  "Safe Release Lab basic checklist",
  "Proof Builder basic milestone tracking",
  "Privacy Timeline basic records view",
  "Project Execution Spine / MVP Lock",
  "Final Launch Hardening",
  "Implementation Sequencer"
] as const;

export function getQ1BuildOrder(): readonly string[] {
  return q1BuildOrder;
}
