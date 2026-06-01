export type SignalWorkflowRoute = "create" | "analyze" | "compose" | "mutation" | "export";

export interface WorkflowGuardState {
  uploadedFileName?: string;
  analysisComplete?: boolean;
  composeComplete?: boolean;
  mutationComplete?: boolean;
}

export function getMissingRequirement(
  route: SignalWorkflowRoute,
  state: WorkflowGuardState
): string | undefined {
  if (route === "analyze" && !state.uploadedFileName) {
    return "Signal Initialization is required before Analyze Intelligence.";
  }
  if (route === "compose" && !state.analysisComplete) {
    return "Analyze Intelligence is required before Compose System.";
  }
  if (route === "mutation" && !state.composeComplete) {
    return "Compose System is required before Mutation Lab.";
  }
  if (route === "export" && !state.mutationComplete) {
    return "Mutation Lab is required before Export Forge.";
  }
  return undefined;
}

export function getRecoveryRoute(route: SignalWorkflowRoute): string {
  if (route === "analyze") {
    return "/create";
  }
  if (route === "compose") {
    return "/analyze";
  }
  if (route === "mutation") {
    return "/compose";
  }
  if (route === "export") {
    return "/mutation";
  }
  return "/create";
}
