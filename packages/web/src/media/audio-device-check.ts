export type AudioReadinessStatus =
  | "supported"
  | "permission_needed"
  | "permission_denied"
  | "ready"
  | "unavailable";

export type MediaReadinessStatus = AudioReadinessStatus;

export type AudioDeviceCheck = Readonly<{
  status: AudioReadinessStatus;
  supported: boolean;
  devices: readonly MediaDeviceInfo[];
  reason: string | null;
}>;

export interface AudioDeviceCheckResult {
  status: MediaReadinessStatus;
  devices: MediaDeviceInfo[];
  message: string;
}

export function isAudioCaptureSupported(): boolean {
  return Boolean(getMediaDevices()?.getUserMedia);
}

export function checkAudioDeviceSupport(): AudioDeviceCheck {
  if (!isAudioCaptureSupported()) {
    return Object.freeze({
      status: "unavailable",
      supported: false,
      devices: Object.freeze([]),
      reason: "Browser microphone capture is unavailable."
    });
  }

  return Object.freeze({
    status: "permission_needed",
    supported: true,
    devices: Object.freeze([]),
    reason: null
  });
}

export async function listAudioInputDevices(): Promise<readonly MediaDeviceInfo[]> {
  const mediaDevices = getMediaDevices();
  if (!mediaDevices?.enumerateDevices) {
    return Object.freeze([]);
  }

  const devices = await mediaDevices.enumerateDevices();
  return Object.freeze(devices.filter((device) => device.kind === "audioinput"));
}

export function getMediaDevices(): MediaDevices | null {
  if (typeof navigator === "undefined") {
    return null;
  }
  return navigator.mediaDevices ?? null;
}

export async function requestAudioReadiness(): Promise<AudioDeviceCheckResult> {
  if (!isAudioCaptureSupported()) {
    return {
      status: "unavailable",
      devices: [],
      message: "Audio capture is unavailable in this browser."
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) {
      track.stop();
    }
    const devices = await listAudioInputDevices();
    return {
      status: "ready",
      devices: [...devices],
      message: "Audio capture is ready."
    };
  } catch {
    return {
      status: "permission_denied",
      devices: [],
      message: "Audio permission was denied or unavailable."
    };
  }
}
