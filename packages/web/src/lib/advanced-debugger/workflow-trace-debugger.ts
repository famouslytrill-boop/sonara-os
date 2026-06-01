import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const workflowTraceDebuggerModule: InfrastructureModule = {
  id: "advanced-debugger.workflow-trace-debugger",
  publicName: "Workflow Trace Debugger",
  internalName: "WorkflowTraceDebuggerEngine",
  description:
    "Safe typed scaffold for Workflow Trace Debugger; production behavior requires human review and explicit enablement.",
  featureFlag: "ADVANCED_DEBUGGER_ENGINE_ENABLED",
  products: ["business_builder", "creator_studio", "growth_studio"],
  launchTier: "admin_only",
  riskLevel: "medium",
  publicVisible: false,
  adminOnly: true,
  betaGated: false,
  requiredHumanReview: true,
  connectedEngines: [],
  blockedScope: ["No production data writes", "No destructive commands", "No hidden automation"],
  safetyRules: ["Feature-gated scaffold", "Human review required", "Placeholder status disclosed"]
};

export function createWorkflowTraceDebuggerReport() {
  return createInfrastructureReport(workflowTraceDebuggerModule);
}
