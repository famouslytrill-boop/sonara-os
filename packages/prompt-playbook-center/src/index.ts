export * from "./types.ts";
export {
  getPromptTemplateById,
  getPromptTemplates,
  getPromptTemplatesByProductArea,
  promptCategories,
  promptProductAreas,
  promptTemplateRegistry,
  searchPromptTemplates
} from "./prompt-template-registry.ts";
export { createBusinessPromptPlaybook } from "./business-prompt-playbook.ts";
export { createGrowthPromptPlaybook } from "./growth-prompt-engine.ts";
export { createCreatorPromptPlaybook } from "./creator-prompt-engine.ts";
export { createAdminPromptPlaybook } from "./admin-prompt-playbook.ts";
export { evaluatePromptSafety, getBlockedPromptRuleKeys } from "./prompt-safety-gate.ts";
export { scorePromptTemplateQuality } from "./prompt-quality-scorer.ts";
export { buildRoleBasedPrompt, createPromptPreview } from "./role-based-prompt-builder.ts";
export {
  createPromptUsageAuditEvent,
  createPromptUsageAuditLedger
} from "./prompt-usage-audit-ledger.ts";

export const PromptLibraryEngine = Object.freeze({
  publicName: "AI Playbook Center",
  status: "setup_mode",
  safetyRule: "Prompt templates create draft guidance only and never send customer-facing output."
});
export const BusinessPromptPlaybook = Object.freeze({ status: "enabled" });
export const GrowthPromptEngine = Object.freeze({ status: "enabled" });
export const CreatorPromptEngine = Object.freeze({ status: "enabled" });
export const PromptSafetyGate = Object.freeze({ status: "enabled" });
export const PromptQualityScorer = Object.freeze({ status: "enabled" });
export const PromptTemplateRegistry = Object.freeze({ status: "enabled" });
export const PromptUsageAuditLedger = Object.freeze({ status: "audit_ready" });
export const RoleBasedPromptBuilder = Object.freeze({ status: "enabled" });

export const promptPlaybookFeatureFlags = Object.freeze({
  PROMPT_PLAYBOOK_CENTER_ENABLED: true,
  PUBLIC_PROMPT_LIBRARY_ENABLED: true,
  HIGH_RISK_PROMPTS_REQUIRE_OWNER_APPROVAL: true,
  AUTO_SEND_PROMPT_OUTPUTS: false
});
