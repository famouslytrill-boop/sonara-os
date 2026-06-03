import type { VoiceActionRequest } from "./contracts.ts";
export function evaluateVoiceConsent(request: VoiceActionRequest) {
  if (!request.consent) return { allowed: false, reason: "consent_required" };
  if (request.hiddenRecording) return { allowed: false, reason: "hidden_recording_blocked" };
  if (request.voiceCloning)
    return { allowed: false, reason: "voice_cloning_requires_separate_review" };
  return { allowed: true, reason: "sandbox_allowed" };
}
