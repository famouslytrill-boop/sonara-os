import { describe, expect, it } from "vitest";
import {
  areDangerousBetaCapabilitiesDisabled,
  betaAuditPlaceholders,
  betaDangerousCapabilityDefaults,
  betaSafetyRules,
  betaStudioFeatureFlagDefaults,
  betaStudioShells,
  getBetaAuditPlaceholders,
  getBetaStudioShellByRoute
} from "./lib/beta-studios/index.ts";
import { featureFlags } from "./lib/shared/feature-flags.ts";

describe("Beta media studio shells", () => {
  it("enables beta shells while keeping dangerous capabilities off", () => {
    expect(betaStudioFeatureFlagDefaults).toEqual({
      VIDEO_INTELLIGENCE_ENABLED: true,
      VOICE_STUDIO_ENABLED: true,
      VISUAL_INTELLIGENCE_STUDIO_ENABLED: true
    });
    expect(betaDangerousCapabilityDefaults).toEqual({
      VIDEO_UPLOAD_PROCESSING_ENABLED: false,
      VOICE_CLONING_ENABLED: false,
      PUBLIC_VISUAL_GENERATION_ENABLED: false,
      LOCAL_VISUAL_MODELS_ENABLED: false
    });
    expect(areDangerousBetaCapabilitiesDisabled()).toBe(true);
    expect(featureFlags.VIDEO_INTELLIGENCE_ENABLED).toBe(true);
    expect(featureFlags.VIDEO_UPLOAD_PROCESSING_ENABLED).toBe(false);
    expect(featureFlags.VOICE_STUDIO_ENABLED).toBe(true);
    expect(featureFlags.VOICE_CLONING_ENABLED).toBe(false);
    expect(featureFlags.VISUAL_INTELLIGENCE_STUDIO_ENABLED).toBe(true);
    expect(featureFlags.PUBLIC_VISUAL_GENERATION_ENABLED).toBe(false);
    expect(featureFlags.LOCAL_VISUAL_MODELS_ENABLED).toBe(false);
  });

  it("defines beta route shells as draft-only", () => {
    expect(betaStudioShells.map((shell) => shell.route)).toEqual([
      "/admin/video-intelligence",
      "/creator-studio/video-review",
      "/creator-studio/voice-studio",
      "/creator-studio/visual-studio",
      "/growth-studio/campaign-visuals"
    ]);
    expect(betaStudioShells.every((shell) => shell.outputStatus === "draft_until_approved")).toBe(
      true
    );
    expect(getBetaStudioShellByRoute("/creator-studio/voice-studio")).toMatchObject({
      title: "Voice Studio",
      blockedFlags: ["VOICE_CLONING_ENABLED"]
    });
  });

  it("keeps explicit media safety warnings", () => {
    const rules = betaSafetyRules.map((rule) => `${rule.title} ${rule.description}`).join(" ");

    expect(rules).toMatch(/No cloning real voices without explicit consent/i);
    expect(rules).toMatch(/public figure/i);
    expect(rules).toMatch(/fake IDs/i);
    expect(rules).toMatch(/Sensitive or private video processing is disabled/i);
    expect(rules).toMatch(/drafts until explicitly approved/i);
  });

  it("defines audit placeholders for each beta system", () => {
    expect(betaAuditPlaceholders).toHaveLength(3);
    expect(getBetaAuditPlaceholders("video_intelligence")).toHaveLength(1);
    expect(getBetaAuditPlaceholders("voice_studio")[0]).toMatchObject({
      humanReviewRequired: true,
      riskLevel: "critical",
      status: "placeholder"
    });
    expect(
      betaAuditPlaceholders.every(
        (placeholder) => placeholder.status === "placeholder" && placeholder.humanReviewRequired
      )
    ).toBe(true);
  });
});
