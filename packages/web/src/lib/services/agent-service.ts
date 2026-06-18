import { agentControlPlaneModules } from "../agents/agent-types.ts";
import { createServiceReadiness } from "./database-service.ts";

export function createAgentServiceReadiness() {
  return createServiceReadiness("agent control plane", "static_shell", "ready_for_adapter", [
    `${agentControlPlaneModules.length} control plane modules are modeled.`,
    "No model API calls, shell execution, browser automation, or file access are enabled by default.",
    "High-risk actions require preview, approval, and audit logs."
  ]);
}
