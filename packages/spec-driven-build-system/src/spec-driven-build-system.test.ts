import { describe, expect, it } from "vitest";
import { checkSpecDrift, createCodexPrompt, createFeatureSpec } from "./index.ts";

describe("spec-driven build system", () => {
  it("flags missing acceptance criteria as spec drift", () => {
    const report = checkSpecDrift({
      id: "missing-criteria",
      title: "Missing Criteria",
      productArea: "business-builder"
    });

    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.section === "acceptanceCriteria")).toBe(true);
  });

  it("creates a structured Codex prompt from a complete spec", () => {
    const spec = createFeatureSpec({
      id: "proof-passport",
      title: "Proof Passport",
      productArea: "business-builder",
      problem: "Owners need one controlled proof profile before launch.",
      users: ["Business owner"],
      userStories: ["As an owner, I can review proof before publishing."],
      nonGoals: ["No automatic publishing."],
      dataModelNotes: ["Store draft and published fields separately."],
      routeRequirements: ["Owner route and public route are separate."],
      apiRequirements: ["Read public fields only from public endpoint."],
      securityRequirements: ["Owner action required to publish."],
      privacyRequirements: ["Private owner fields stay private."],
      acceptanceCriteria: ["Published profile never exposes private fields."],
      testRequirements: ["Test draft and published visibility."],
      launchGateRequirements: ["Run typecheck and build."]
    });

    const prompt = createCodexPrompt(spec, { repositoryName: "SONARA One" });

    expect(prompt).toContain("Feature: Proof Passport");
    expect(prompt).toContain("Acceptance Criteria");
    expect(prompt).toContain("Published profile never exposes private fields.");
    expect(prompt).toContain("Do not add features outside this spec.");
  });
});
