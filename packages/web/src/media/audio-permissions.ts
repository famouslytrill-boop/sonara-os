import {
  checkAudioDeviceSupport,
  listAudioInputDevices,
  requestAudioReadiness,
  type AudioDeviceCheck
} from "./audio-device-check.ts";

export async function requestMicrophonePermission(): Promise<AudioDeviceCheck> {
  const support = checkAudioDeviceSupport();
  if (!support.supported) {
    return support;
  }

  try {
    const result = await requestAudioReadiness();
    const devices = await listAudioInputDevices();
    return Object.freeze({
      status: result.status === "ready" && devices.length === 0 ? "supported" : result.status,
      supported: result.status !== "unavailable",
      devices,
      reason: result.status === "ready" ? null : result.message
    });
  } catch (error) {
    return Object.freeze({
      status: isPermissionDenied(error) ? "permission_denied" : "unavailable",
      supported: true,
      devices: Object.freeze([]),
      reason: error instanceof Error ? error.message : "Microphone permission failed."
    });
  }
}

function isPermissionDenied(error: unknown) {
  return error instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(error.name);
}
