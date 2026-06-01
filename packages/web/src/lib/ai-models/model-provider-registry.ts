import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export type AIProviderId =
  | "openai"
  | "anthropic"
  | "google_gemini"
  | "moonshot_kimi"
  | "local_model"
  | "custom_provider";

export type AIProviderCapability =
  | "text_generation"
  | "structured_output"
  | "tool_use"
  | "vision"
  | "coding"
  | "local_runtime";

export type AIProviderPrivacyRisk = "low" | "medium" | "high" | "critical";
export type ExternalModelApprovalStatus = "approved" | "review_required" | "disabled";
export type PromptRiskLabel =
  | "secret_pattern"
  | "service_role_pattern"
  | "private_key_pattern"
  | "jwt_pattern"
  | "full_private_repo_dump"
  | "sensitive_external_routing";

export type AIProviderDefinition = Readonly<{
  id: AIProviderId;
  publicName: string;
  defaultEnabled: boolean;
  configurable: boolean;
  external: boolean;
  localOnly: boolean;
  sensitiveDataRoutingEnabled: boolean;
  approvalStatus: ExternalModelApprovalStatus;
  privacyRisk: AIProviderPrivacyRisk;
  capabilities: readonly AIProviderCapability[];
  notes: string;
}>;

export type PromptRedactionGateResult = Readonly<{
  allowed: boolean;
  redactedPrompt: string;
  riskLabels: readonly PromptRiskLabel[];
  requiresApproval: boolean;
  message: string;
}>;

export type AIProviderUsageAuditRecord = Readonly<{
  id: string;
  providerId: AIProviderId;
  action: "provider_registry_view" | "model_router_review" | "prompt_redaction_gate";
  approvalStatus: ExternalModelApprovalStatus;
  redactionApplied: boolean;
  sensitiveDataBlocked: boolean;
  createdAt: string;
  metadata: Readonly<Record<string, string | number | boolean>>;
}>;

export const modelProviderRegistryModule: InfrastructureModule = {
  id: "ai-models.model-provider-registry",
  publicName: "Model Provider Registry",
  internalName: "ModelProviderRegistryEngine",
  description:
    "Safe typed scaffold for Model Provider Registry; production behavior requires human review and explicit enablement.",
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

export const aiProviderRegistry: readonly AIProviderDefinition[] = Object.freeze([
  Object.freeze({
    id: "openai",
    publicName: "OpenAI",
    defaultEnabled: false,
    configurable: true,
    external: true,
    localOnly: false,
    sensitiveDataRoutingEnabled: false,
    approvalStatus: "review_required",
    privacyRisk: "medium",
    capabilities: defineCapabilities([
      "text_generation",
      "structured_output",
      "tool_use",
      "vision"
    ]),
    notes: "External provider. Requires approval before sensitive routing."
  }),
  Object.freeze({
    id: "anthropic",
    publicName: "Anthropic",
    defaultEnabled: false,
    configurable: true,
    external: true,
    localOnly: false,
    sensitiveDataRoutingEnabled: false,
    approvalStatus: "review_required",
    privacyRisk: "medium",
    capabilities: defineCapabilities([
      "text_generation",
      "structured_output",
      "tool_use",
      "coding"
    ]),
    notes: "External provider. Requires approval before sensitive routing."
  }),
  Object.freeze({
    id: "google_gemini",
    publicName: "Google Gemini",
    defaultEnabled: false,
    configurable: true,
    external: true,
    localOnly: false,
    sensitiveDataRoutingEnabled: false,
    approvalStatus: "review_required",
    privacyRisk: "medium",
    capabilities: defineCapabilities(["text_generation", "structured_output", "vision"]),
    notes: "External provider. Requires approval before sensitive routing."
  }),
  Object.freeze({
    id: "moonshot_kimi",
    publicName: "Moonshot/Kimi",
    defaultEnabled: false,
    configurable: true,
    external: true,
    localOnly: false,
    sensitiveDataRoutingEnabled: false,
    approvalStatus: "disabled",
    privacyRisk: "high",
    capabilities: defineCapabilities(["text_generation", "coding"]),
    notes: "Disabled by default. Review required before any external use."
  }),
  Object.freeze({
    id: "local_model",
    publicName: "Local model placeholder",
    defaultEnabled: true,
    configurable: true,
    external: false,
    localOnly: true,
    sensitiveDataRoutingEnabled: false,
    approvalStatus: "approved",
    privacyRisk: "low",
    capabilities: defineCapabilities(["text_generation", "local_runtime"]),
    notes: "Placeholder for local runtime routing. No external provider call is made by this MVP."
  }),
  Object.freeze({
    id: "custom_provider",
    publicName: "Custom provider placeholder",
    defaultEnabled: false,
    configurable: true,
    external: true,
    localOnly: false,
    sensitiveDataRoutingEnabled: false,
    approvalStatus: "disabled",
    privacyRisk: "critical",
    capabilities: defineCapabilities(["text_generation"]),
    notes: "Disabled until provider policy, data handling, and approval requirements are reviewed."
  })
]);

export const providerUsageAuditModel: readonly AIProviderUsageAuditRecord[] = Object.freeze([
  createProviderUsageAuditRecord({
    providerId: "local_model",
    action: "provider_registry_view",
    approvalStatus: "approved",
    redactionApplied: false,
    sensitiveDataBlocked: false,
    metadata: { source: "mvp_registry_seed" }
  }),
  createProviderUsageAuditRecord({
    providerId: "moonshot_kimi",
    action: "model_router_review",
    approvalStatus: "disabled",
    redactionApplied: false,
    sensitiveDataBlocked: true,
    metadata: { reason: "disabled_by_default" }
  })
]);

const secretPatterns: readonly (readonly [PromptRiskLabel, RegExp])[] = [
  ["secret_pattern", /\bsk_(?:live|test)_[A-Za-z0-9_=-]{12,}\b/g],
  [
    "secret_pattern",
    /\b(?:api[_-]?key|client[_-]?secret|webhook[_-]?secret|token)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{20,}/gi
  ],
  [
    "service_role_pattern",
    /^SUPABASE_SERVICE_ROLE_KEY[^\S\r\n]*=[^\S\r\n]*(?!["']?(?:placeholder|replace-me|todo|example)\b)["']?\S{12,}/gim
  ],
  ["private_key_pattern", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ["jwt_pattern", /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g]
];

export function createModelProviderRegistryReport() {
  return createInfrastructureReport(modelProviderRegistryModule);
}

export function getAIProviderRegistry(): readonly AIProviderDefinition[] {
  return aiProviderRegistry;
}

export function getAIProviderById(providerId: AIProviderId): AIProviderDefinition | undefined {
  return aiProviderRegistry.find((provider) => provider.id === providerId);
}

export function getDefaultEnabledProviders(): readonly AIProviderDefinition[] {
  return aiProviderRegistry.filter((provider) => provider.defaultEnabled);
}

export function evaluatePromptRedactionGate({
  prompt,
  providerId
}: {
  prompt: string;
  providerId: AIProviderId;
}): PromptRedactionGateResult {
  const provider = getAIProviderById(providerId);
  const riskLabels = new Set<PromptRiskLabel>();
  let redactedPrompt = prompt;

  for (const [label, pattern] of secretPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(prompt)) {
      riskLabels.add(label);
      pattern.lastIndex = 0;
      redactedPrompt = redactedPrompt.replace(pattern, "[REDACTED]");
    }
  }

  if (looksLikePrivateRepoDump(prompt)) {
    riskLabels.add("full_private_repo_dump");
  }

  const hasSensitiveData = riskLabels.size > 0;
  if (provider?.external && hasSensitiveData && !provider.sensitiveDataRoutingEnabled) {
    riskLabels.add("sensitive_external_routing");
  }

  const requiresApproval =
    riskLabels.has("full_private_repo_dump") ||
    provider?.approvalStatus === "review_required" ||
    provider?.approvalStatus === "disabled";
  const allowed =
    provider !== undefined &&
    provider.approvalStatus !== "disabled" &&
    !riskLabels.has("secret_pattern") &&
    !riskLabels.has("service_role_pattern") &&
    !riskLabels.has("private_key_pattern") &&
    !riskLabels.has("jwt_pattern") &&
    !(provider?.external && hasSensitiveData && !provider.sensitiveDataRoutingEnabled);

  return Object.freeze({
    allowed,
    redactedPrompt,
    riskLabels: Object.freeze([...riskLabels]),
    requiresApproval,
    message: createGateMessage({ provider, allowed, riskLabels })
  });
}

export function createProviderUsageAuditRecord({
  providerId,
  action,
  approvalStatus,
  redactionApplied,
  sensitiveDataBlocked,
  metadata,
  createdAt = new Date().toISOString(),
  id = createAuditId(providerId)
}: Omit<AIProviderUsageAuditRecord, "createdAt" | "id"> & {
  createdAt?: string;
  id?: string;
}): AIProviderUsageAuditRecord {
  return Object.freeze({
    id,
    providerId,
    action,
    approvalStatus,
    redactionApplied,
    sensitiveDataBlocked,
    createdAt,
    metadata: Object.freeze({ ...metadata })
  });
}

function looksLikePrivateRepoDump(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  const repoSignals = [
    "package-lock.json",
    "begin full repo",
    "entire private repo",
    "full private repo",
    "all source files",
    "service_role_key",
    ".env.local"
  ];
  return repoSignals.filter((signal) => lower.includes(signal)).length >= 2 || prompt.length > 8000;
}

function defineCapabilities(
  capabilities: readonly AIProviderCapability[]
): readonly AIProviderCapability[] {
  return Object.freeze([...capabilities]);
}

function createGateMessage({
  provider,
  allowed,
  riskLabels
}: {
  provider: AIProviderDefinition | undefined;
  allowed: boolean;
  riskLabels: Set<PromptRiskLabel>;
}): string {
  if (!provider) {
    return "Unknown provider. Routing blocked.";
  }
  if (provider.approvalStatus === "disabled") {
    return `${provider.publicName} is disabled until reviewed.`;
  }
  if (riskLabels.has("full_private_repo_dump")) {
    return "Full private repo dumps require approval before external model routing.";
  }
  if (!allowed) {
    return "Prompt contains sensitive material. Redaction gate blocked routing.";
  }
  return provider.external
    ? "Prompt passed redaction checks, but external model routing still requires configured approval."
    : "Prompt passed redaction checks for local placeholder routing.";
}

function createAuditId(providerId: AIProviderId): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `provider-audit-${providerId}-${random}`;
}
