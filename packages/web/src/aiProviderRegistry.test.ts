import { describe, expect, it } from "vitest";
import {
  createProviderUsageAuditRecord,
  evaluatePromptRedactionGate,
  getAIProviderById,
  getAIProviderRegistry,
  getDefaultEnabledProviders,
  providerUsageAuditModel
} from "./lib/ai-models/index.ts";

describe("AI Provider Registry MVP", () => {
  it("defines provider defaults without enabling every provider", () => {
    const providers = getAIProviderRegistry();
    const enabled = getDefaultEnabledProviders();

    expect(providers.map((provider) => provider.id)).toEqual([
      "openai",
      "anthropic",
      "google_gemini",
      "moonshot_kimi",
      "local_model",
      "custom_provider"
    ]);
    expect(enabled.map((provider) => provider.id)).toEqual(["local_model"]);
    expect(getAIProviderById("moonshot_kimi")).toMatchObject({
      defaultEnabled: false,
      approvalStatus: "disabled"
    });
    expect(providers.every((provider) => provider.sensitiveDataRoutingEnabled === false)).toBe(
      true
    );
  });

  it("blocks secret-bearing prompts before external routing", () => {
    const result = evaluatePromptRedactionGate({
      providerId: "openai",
      prompt: `Use this token sk_live_${"a".repeat(24)} in the request.`
    });

    expect(result.allowed).toBe(false);
    expect(result.riskLabels).toContain("secret_pattern");
    expect(result.riskLabels).toContain("sensitive_external_routing");
    expect(result.redactedPrompt).toContain("[REDACTED]");
    expect(result.redactedPrompt).not.toContain("sk_live_");
  });

  it("requires approval for full private repo dumps", () => {
    const result = evaluatePromptRedactionGate({
      providerId: "anthropic",
      prompt:
        "Here is the full private repo with package-lock.json and .env.local. Review all source files."
    });

    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(true);
    expect(result.riskLabels).toContain("full_private_repo_dump");
  });

  it("allows local placeholder prompts that do not contain sensitive data", () => {
    const result = evaluatePromptRedactionGate({
      providerId: "local_model",
      prompt: "Summarize the release checklist."
    });

    expect(result.allowed).toBe(true);
    expect(result.riskLabels).toEqual([]);
  });

  it("tracks usage audit metadata without storing prompts or keys", () => {
    const record = createProviderUsageAuditRecord({
      providerId: "openai",
      action: "prompt_redaction_gate",
      approvalStatus: "review_required",
      redactionApplied: true,
      sensitiveDataBlocked: true,
      metadata: {
        riskCount: 2,
        promptStored: false
      },
      createdAt: "2026-05-18T00:00:00.000Z",
      id: "provider-audit-test"
    });

    expect(providerUsageAuditModel.length).toBeGreaterThan(0);
    expect(record.metadata.promptStored).toBe(false);
    expect(JSON.stringify(record)).not.toContain("sk_live");
    expect(JSON.stringify(record)).not.toContain("api_key");
  });
});
