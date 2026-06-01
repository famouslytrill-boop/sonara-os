import { describe, expect, it } from "vitest";
import {
  createCodexRequirementsGatePrompt,
  createFeatureSpecCard,
  validateFeatureIntake
} from "./lib/requirements/index.ts";

const completeIntake = {
  feature: "Feature Intake Clarifier",
  user: "Owner and admin reviewers",
  problem: "Vague feature requests enter development without enough safety context.",
  route: "/admin/command-center",
  dataNeeded: "Feature title, user, route, permissions, blocked behavior, tests.",
  permissionsRequired: "Owner or admin review before sprint generation.",
  blockedBehavior: "No vague ASAP requests, bypasses, hidden prompt changes, or auto deploys.",
  doneDefinition: "A complete feature spec card and Codex requirements prompt can be generated.",
  tests: "Validate required questions; block unsafe wording; generate owner review flag.",
  category: "workflow_change" as const
};

describe("Feature Intake Clarifier", () => {
  it("requires clear specs before sprint generation", () => {
    const result = validateFeatureIntake({ feature: "ASAP thing" });
    expect(result.ok).toBe(false);
    expect(result.missingQuestions).toContain("Who uses it?");
  });

  it("creates a sprint-ready spec card from complete intake", () => {
    const spec = createFeatureSpecCard(completeIntake);
    expect(spec.title).toBe("Feature Intake Clarifier");
    expect(spec.tests).toContain("Validate required questions");
    expect(spec.ownerReviewRequired).toBe(false);
  });

  it("generates Codex prompts with safety requirements", () => {
    const prompt = createCodexRequirementsGatePrompt({
      ...completeIntake,
      category: "security_change"
    });
    expect(prompt).toContain("Owner review required: yes");
    expect(prompt).toContain("Do not commit secrets.");
    expect(prompt).toContain("Do not install third-party code unless explicitly approved.");
  });
});
