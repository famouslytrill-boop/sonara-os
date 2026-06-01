export type AllowedAgentTool = {
  key: string;
  description: string;
  maxRisk: "low" | "medium" | "high";
  approvalRequired: boolean;
};

export const agentToolAllowlist: AllowedAgentTool[] = [
  { key: "research_registry_lookup", description: "Read governed research and provider registry records.", maxRisk: "low", approvalRequired: false },
  { key: "draft_codex_prompt", description: "Draft an implementation prompt for human review.", maxRisk: "medium", approvalRequired: true },
  { key: "support_summary", description: "Summarize support metadata without private message logging.", maxRisk: "medium", approvalRequired: true },
];
