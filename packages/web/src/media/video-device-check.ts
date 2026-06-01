import type { MediaReadinessStatus } from "./audio-device-check.ts";

export type VideoReadinessStatus = MediaReadinessStatus;

export type VideoDeviceCheck = Readonly<{
  status: VideoReadinessStatus;
  supported: boolean;
  mediaRecorderSupported: boolean;
  devices: readonly MediaDeviceInfo[];
  reason: string | null;
}>;

export interface VideoDeviceCheckResult {
  status: MediaReadinessStatus;
  devices: MediaDeviceInfo[];
  mediaRecorderSupported: boolean;
  message: string;
}

export function isVideoCaptureSupported(): boolean {
  return Boolean(getMediaDevices()?.getUserMedia);
}

export function checkVideoDeviceSupport(): VideoDeviceCheck {
  if (!isVideoCaptureSupported()) {
    return Object.freeze({
      status: "unavailable",
      supported: false,
      mediaRecorderSupported: isMediaRecorderSupported(),
      devices: Object.freeze([]),
      reason: "Browser camera capture is unavailable."
    });
  }

  return Object.freeze({
    status: "permission_needed",
    supported: true,
    mediaRecorderSupported: isMediaRecorderSupported(),
    devices: Object.freeze([]),
    reason: null
  });
}

export async function requestCameraPermission(): Promise<VideoDeviceCheck> {
  const support = checkVideoDeviceSupport();
  if (!support.supported) {
    return support;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    stopStream(stream);
    const devices = await listVideoInputDevices();
    return Object.freeze({
      status: devices.length > 0 ? "ready" : "supported",
      supported: true,
      mediaRecorderSupported: isMediaRecorderSupported(),
      devices,
      reason: null
    });
  } catch (error) {
    return Object.freeze({
      status: isPermissionDenied(error) ? "permission_denied" : "unavailable",
      supported: true,
      mediaRecorderSupported: isMediaRecorderSupported(),
      devices: Object.freeze([]),
      reason: error instanceof Error ? error.message : "Camera permission failed."
    });
  }
}

export async function requestVideoReadiness(): Promise<VideoDeviceCheckResult> {
  if (!isVideoCaptureSupported()) {
    return {
      status: "unavailable",
      devices: [],
      mediaRecorderSupported: isMediaRecorderSupported(),
      message: "Video capture is unavailable in this browser."
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stopStream(stream);
    const devices = await listVideoInputDevices();
    return {
      status: "ready",
      devices: [...devices],
      mediaRecorderSupported: isMediaRecorderSupported(),
      message: "Video capture is ready."
    };
  } catch {
    return {
      status: "permission_denied",
      devices: [],
      mediaRecorderSupported: isMediaRecorderSupported(),
      message: "Video permission was denied or unavailable."
    };
  }
}

export async function listVideoInputDevices(): Promise<readonly MediaDeviceInfo[]> {
  const mediaDevices = getMediaDevices();
  if (!mediaDevices?.enumerateDevices) {
    return Object.freeze([]);
  }

  const devices = await mediaDevices.enumerateDevices();
  return Object.freeze(devices.filter((device) => device.kind === "videoinput"));
}

export function isMediaRecorderSupported() {
  return typeof window !== "undefined" && "MediaRecorder" in window;
}

function getMediaDevices(): MediaDevices | null {
  if (typeof navigator === "undefined") {
    return null;
  }
  return navigator.mediaDevices ?? null;
}

function stopStream(stream: MediaStream) {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function isPermissionDenied(error: unknown) {
  return error instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(error.name);
}
