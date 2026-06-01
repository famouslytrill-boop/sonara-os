import { scorePromptTemplateQuality } from "./prompt-quality-scorer.ts";
import { evaluatePromptSafety } from "./prompt-safety-gate.ts";
import { getPromptTemplateById } from "./prompt-template-registry.ts";
import type { BuiltPrompt, PromptBuildRequest, PromptTemplate } from "./types.ts";

export function buildRoleBasedPrompt(request: PromptBuildRequest): BuiltPrompt {
  const template = getPromptTemplateById(request.template_id);
  if (!template) {
    throw new Error(`Unknown prompt template: ${request.template_id}`);
  }
  const promptPreview = createPromptPreview(template, request);
  const safety = evaluatePromptSafety({
    text: promptPreview,
    product_area: template.product_area,
    category: template.category,
    risk_level: template.risk_level,
    public_facing: request.public_facing,
    customer_facing: request.customer_facing
  });
  const quality = scorePromptTemplateQuality(template);

  return Object.freeze({
    template,
    prompt_preview: promptPreview,
    safety,
    quality,
    approval_required:
      template.approval_required || safety.approval_status === "owner_review_required"
  });
}

export function createPromptPreview(template: PromptTemplate, request: PromptBuildRequest): string {
  const inputLines = template.input_fields.map((inputField) => {
    const value = request.inputs[inputField.id]?.trim() || "[missing]";
    return `- ${inputField.label}: ${value}`;
  });
  const approvalLine = template.approval_required
    ? "Owner approval is required before this draft is sent, published, or used publicly."
    : "Keep this as a draft until the owner reviews context and facts.";

  return [
    `Role: ${request.role.replaceAll("_", " ")}`,
    `Task: ${template.name}`,
    `Goal: ${template.prompt_goal}`,
    "User context:",
    ...inputLines,
    "Output format:",
    template.output_format,
    "Safety constraints:",
    "- Use original wording.",
    "- Use only user-provided facts.",
    "- Do not invent proof, outcomes, reviews, or credentials.",
    `- ${approvalLine}`
  ].join("\n");
}
