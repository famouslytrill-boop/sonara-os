import type { VoiceActionRequest } from "./contracts.ts";
export function requiresStepUp(request: VoiceActionRequest): boolean {
  return request.sensitiveAction === true;
}
export function canRunVoiceAction(request: VoiceActionRequest) {
  const allowed =
    request.consent &&
    !request.hiddenRecording &&
    (!request.sensitiveAction || request.stepUpConfirmed === true);
  return { allowed, reason: allowed ? "confirmed" : "blocked_by_voice_safety" };
}
