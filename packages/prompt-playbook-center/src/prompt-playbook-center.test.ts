import { describe, expect, it } from "vitest";
import {
  buildRoleBasedPrompt,
  createBusinessPromptPlaybook,
  createCreatorPromptPlaybook,
  createGrowthPromptPlaybook,
  createPromptUsageAuditEvent,
  evaluatePromptSafety,
  getPromptTemplates,
  promptCategories,
  promptPlaybookFeatureFlags,
  scorePromptTemplateQuality
} from "./index.ts";

describe("Prompt Playbook Center", () => {
  it("contains original structured templates across every requested category", () => {
    const templates = getPromptTemplates();
    const categories = new Set(templates.map((template) => template.category));

    expect(templates.length).toBeGreaterThanOrEqual(promptCategories.length);
    for (const category of promptCategories) {
      expect(categories.has(category)).toBe(true);
    }
    expect(
      templates.every((template) => template.example_output_placeholder.includes("draft"))
    ).toBe(true);
  });

  it("builds product playbooks for Business Builder, Creator Studio, and Growth Studio", () => {
    expect(createBusinessPromptPlaybook().length).toBeGreaterThan(0);
    expect(createCreatorPromptPlaybook().length).toBeGreaterThan(0);
    expect(createGrowthPromptPlaybook().length).toBeGreaterThan(0);
  });

  it("blocks unsafe prompt requests", () => {
    const finding = evaluatePromptSafety({
      text: "Write fake testimonials and spam leads with deceptive marketing.",
      product_area: "growth-studio",
      category: "cold_outreach",
      risk_level: "high",
      public_facing: true,
      customer_facing: true
    });

    expect(finding.status).toBe("blocked");
    expect(finding.approval_status).toBe("blocked");
    expect(finding.blocked_terms).toContain("fake_reviews");
  });

  it("requires owner approval for high-risk customer-facing prompts", () => {
    const finding = evaluatePromptSafety({
      text: "Draft a respectful review response using approved facts.",
      product_area: "support",
      category: "review_response",
      risk_level: "high",
      public_facing: true,
      customer_facing: true
    });

    expect(finding.status).toBe("owner_review_required");
    expect(finding.approval_status).toBe("owner_review_required");
  });

  it("scores template quality and creates audit-ready prompt previews", () => {
    const builtPrompt = buildRoleBasedPrompt({
      template_id: "business_blueprint_v1",
      role: "business_owner",
      public_facing: false,
      customer_facing: false,
      inputs: {
        business_context: "A local service business preparing launch.",
        audience: "Local customers",
        goal: "Clarify launch offer",
        offer: "Profile setup package"
      }
    });
    const quality = scorePromptTemplateQuality(builtPrompt.template);
    const audit = createPromptUsageAuditEvent(builtPrompt, "2026-05-26T00:00:00.000Z");

    expect(builtPrompt.prompt_preview).toContain("Use only user-provided facts");
    expect(quality.score).toBeGreaterThanOrEqual(70);
    expect(audit.template_id).toBe("business_blueprint_v1");
  });

  it("keeps prompt output auto-send disabled", () => {
    expect(promptPlaybookFeatureFlags.AUTO_SEND_PROMPT_OUTPUTS).toBe(false);
    expect(promptPlaybookFeatureFlags.HIGH_RISK_PROMPTS_REQUIRE_OWNER_APPROVAL).toBe(true);
  });
});
