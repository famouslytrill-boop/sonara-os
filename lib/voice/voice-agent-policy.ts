export const voiceAgentPolicy = {
  enabledByDefault: false,
  consentRequired: true,
  listeningIndicatorRequired: true,
  blockedActions: ["voice cloning without consent", "impersonation", "automated calls without consent", "emergency response claims", "automatic outreach"],
  humanEscalationRequired: true,
};
