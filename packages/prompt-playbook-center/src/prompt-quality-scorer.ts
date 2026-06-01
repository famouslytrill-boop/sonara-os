import type { PromptQualityScore, PromptTemplate } from "./types.ts";

export function scorePromptTemplateQuality(template: PromptTemplate): PromptQualityScore {
  const reasons: string[] = [];
  let score = 100;

  if (template.input_fields.length < 2) {
    score -= 20;
    reasons.push("Template needs at least two input fields for useful context.");
  }
  if (!template.output_format.includes("Assumptions to verify")) {
    score -= 15;
    reasons.push("Output format should ask the user to verify assumptions.");
  }
  if (template.safety_notes.length < 3) {
    score -= 15;
    reasons.push("Template needs explicit safety notes.");
  }
  if (
    (template.risk_level === "high" || template.risk_level === "critical") &&
    !template.approval_required
  ) {
    score -= 35;
    reasons.push("High-risk templates must require owner approval.");
  }
  if (!template.example_output_placeholder.toLowerCase().includes("draft")) {
    score -= 10;
    reasons.push("Example placeholder should keep generated output draft-only.");
  }
  if (reasons.length === 0) {
    reasons.push("Template is structured, original, safety-scoped, and review-aware.");
  }

  return Object.freeze({
    score: Math.max(0, score),
    status:
      score >= 85 ? "strong" : score >= 70 ? "usable" : score > 0 ? "needs_context" : "blocked",
    reasons: Object.freeze(reasons)
  });
}
