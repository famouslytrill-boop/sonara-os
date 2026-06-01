export const documentAiPolicy = {
  providerConfigured: false,
  humanReviewRequired: true,
  blockedOutputs: ["legal conclusions", "financial guidance", "medical conclusions", "tax guidance"],
  requiredControls: ["file type validation", "file size validation", "rights review", "confidence scores", "audit event"],
};
