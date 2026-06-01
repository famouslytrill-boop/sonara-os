export type BetaStudioId = "video_intelligence" | "voice_studio" | "visual_intelligence_studio";

export type BetaStudioRoute =
  | "/admin/video-intelligence"
  | "/creator-studio/video-review"
  | "/creator-studio/voice-studio"
  | "/creator-studio/visual-studio"
  | "/growth-studio/campaign-visuals"
  | "/security-center/voice-safety"
  | "/security-center/visual-safety"
  | "/security-center/video-source-safety";

export type BetaStudioRiskLevel = "low" | "medium" | "high" | "critical";

export type BetaStudioFeatureFlag =
  | "VIDEO_INTELLIGENCE_ENABLED"
  | "VOICE_STUDIO_ENABLED"
  | "VISUAL_INTELLIGENCE_STUDIO_ENABLED";

export type BetaDangerousCapabilityFlag =
  | "VIDEO_UPLOAD_PROCESSING_ENABLED"
  | "VOICE_CLONING_ENABLED"
  | "PUBLIC_VISUAL_GENERATION_ENABLED"
  | "LOCAL_VISUAL_MODELS_ENABLED";

export type BetaStudioShell = Readonly<{
  id: BetaStudioId;
  title: string;
  description: string;
  route: BetaStudioRoute;
  enabledFlag: BetaStudioFeatureFlag;
  blockedFlags: readonly BetaDangerousCapabilityFlag[];
  riskLevel: BetaStudioRiskLevel;
  outputStatus: "draft_until_approved";
}>;

export type BetaAuditPlaceholder = Readonly<{
  id: string;
  system: BetaStudioId;
  eventType: string;
  status: "placeholder";
  riskLevel: BetaStudioRiskLevel;
  humanReviewRequired: boolean;
  summary: string;
}>;

export type BetaSafetyRule = Readonly<{
  id: string;
  title: string;
  description: string;
  riskLevel: BetaStudioRiskLevel;
  required: boolean;
}>;

export const betaStudioFeatureFlagDefaults: Record<BetaStudioFeatureFlag, true> = Object.freeze({
  VIDEO_INTELLIGENCE_ENABLED: true,
  VOICE_STUDIO_ENABLED: true,
  VISUAL_INTELLIGENCE_STUDIO_ENABLED: true
});

export const betaDangerousCapabilityDefaults: Record<BetaDangerousCapabilityFlag, false> =
  Object.freeze({
    VIDEO_UPLOAD_PROCESSING_ENABLED: false,
    VOICE_CLONING_ENABLED: false,
    PUBLIC_VISUAL_GENERATION_ENABLED: false,
    LOCAL_VISUAL_MODELS_ENABLED: false
  });

export const betaStudioShells: readonly BetaStudioShell[] = Object.freeze([
  Object.freeze({
    id: "video_intelligence",
    title: "Video Intelligence",
    description:
      "Beta review shell for video source checks, consent notes, and human-approved processing plans.",
    route: "/admin/video-intelligence",
    enabledFlag: "VIDEO_INTELLIGENCE_ENABLED",
    blockedFlags: ["VIDEO_UPLOAD_PROCESSING_ENABLED"] as const,
    riskLevel: "high",
    outputStatus: "draft_until_approved"
  }),
  Object.freeze({
    id: "video_intelligence",
    title: "Video Review",
    description:
      "Creator-facing beta shell for reviewing video source, rights, consent, and release notes.",
    route: "/creator-studio/video-review",
    enabledFlag: "VIDEO_INTELLIGENCE_ENABLED",
    blockedFlags: ["VIDEO_UPLOAD_PROCESSING_ENABLED"] as const,
    riskLevel: "high",
    outputStatus: "draft_until_approved"
  }),
  Object.freeze({
    id: "voice_studio",
    title: "Voice Studio",
    description:
      "Beta shell for voice notes, consent review, disclosure planning, and draft-only voice workflows.",
    route: "/creator-studio/voice-studio",
    enabledFlag: "VOICE_STUDIO_ENABLED",
    blockedFlags: ["VOICE_CLONING_ENABLED"] as const,
    riskLevel: "critical",
    outputStatus: "draft_until_approved"
  }),
  Object.freeze({
    id: "visual_intelligence_studio",
    title: "Visual Intelligence Studio",
    description:
      "Beta shell for visual asset review, source notes, usage risk, and draft campaign creative plans.",
    route: "/creator-studio/visual-studio",
    enabledFlag: "VISUAL_INTELLIGENCE_STUDIO_ENABLED",
    blockedFlags: ["PUBLIC_VISUAL_GENERATION_ENABLED", "LOCAL_VISUAL_MODELS_ENABLED"] as const,
    riskLevel: "high",
    outputStatus: "draft_until_approved"
  }),
  Object.freeze({
    id: "visual_intelligence_studio",
    title: "Campaign Visuals",
    description:
      "Growth beta shell for campaign visual review without public generation or automated publishing.",
    route: "/growth-studio/campaign-visuals",
    enabledFlag: "VISUAL_INTELLIGENCE_STUDIO_ENABLED",
    blockedFlags: ["PUBLIC_VISUAL_GENERATION_ENABLED", "LOCAL_VISUAL_MODELS_ENABLED"] as const,
    riskLevel: "high",
    outputStatus: "draft_until_approved"
  })
]);

export const betaSafetyRules: readonly BetaSafetyRule[] = Object.freeze([
  Object.freeze({
    id: "voice-consent",
    title: "Voice consent required",
    description: "No cloning real voices without explicit consent and human review.",
    riskLevel: "critical",
    required: true
  }),
  Object.freeze({
    id: "no-impersonation",
    title: "No impersonation",
    description: "No celebrity, public figure, private person, or brand impersonation.",
    riskLevel: "critical",
    required: true
  }),
  Object.freeze({
    id: "no-fake-proof",
    title: "No fake proof",
    description: "No fake IDs, fake proof, fake certifications, fake endorsements, or fake rights.",
    riskLevel: "critical",
    required: true
  }),
  Object.freeze({
    id: "private-video-blocked",
    title: "Sensitive video blocked by default",
    description:
      "Sensitive or private video processing is disabled by default and requires reviewed scope.",
    riskLevel: "high",
    required: true
  }),
  Object.freeze({
    id: "drafts-only",
    title: "Drafts until approved",
    description: "All video, voice, and visual outputs remain drafts until explicitly approved.",
    riskLevel: "high",
    required: true
  })
]);

export const betaAuditPlaceholders: readonly BetaAuditPlaceholder[] = Object.freeze([
  Object.freeze({
    id: "video-source-review-placeholder",
    system: "video_intelligence",
    eventType: "video_source_review.placeholder",
    status: "placeholder",
    riskLevel: "high",
    humanReviewRequired: true,
    summary: "Video source, consent, and private-content checks require audit wiring before use."
  }),
  Object.freeze({
    id: "voice-consent-review-placeholder",
    system: "voice_studio",
    eventType: "voice_consent_review.placeholder",
    status: "placeholder",
    riskLevel: "critical",
    humanReviewRequired: true,
    summary: "Voice consent and impersonation checks require audit wiring before any voice output."
  }),
  Object.freeze({
    id: "visual-output-review-placeholder",
    system: "visual_intelligence_studio",
    eventType: "visual_output_review.placeholder",
    status: "placeholder",
    riskLevel: "high",
    humanReviewRequired: true,
    summary:
      "Visual generation, rights, and fake-proof checks require audit wiring before public output."
  })
]);

export function getBetaStudioShellByRoute(route: BetaStudioRoute): BetaStudioShell {
  const shell = betaStudioShells.find((item) => item.route === route);
  if (!shell) {
    throw new Error(`Unknown beta studio route: ${route}`);
  }
  return shell;
}

export function getBetaAuditPlaceholders(system: BetaStudioId): readonly BetaAuditPlaceholder[] {
  return betaAuditPlaceholders.filter((item) => item.system === system);
}

export function areDangerousBetaCapabilitiesDisabled(): boolean {
  return Object.values(betaDangerousCapabilityDefaults).every((enabled) => enabled === false);
}
