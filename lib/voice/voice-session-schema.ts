export type VoiceSession = {
  id: string;
  organizationId: string;
  consentState: "not_requested" | "granted" | "denied";
  status: "planned" | "listening" | "paused" | "ended" | "blocked";
  transcriptStorage: "disabled" | "tenant_private";
};
