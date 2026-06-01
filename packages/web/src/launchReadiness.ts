import { checkAudioDeviceSupport } from "./media/audio-device-check.ts";
import { checkVideoDeviceSupport } from "./media/video-device-check.ts";
import { finalExportTiers } from "./exportTiers.ts";
import { createLaunchAuditReport } from "./launchAudit.ts";
import { getRequiredLaunchRoutes } from "./routes/route-manifest.ts";

export const requiredLaunchRoutes = getRequiredLaunchRoutes();
export { finalExportTiers };

export function createLaunchReadinessChecklist() {
  const audio = checkAudioDeviceSupport();
  const video = checkVideoDeviceSupport();
  return Object.freeze([
    Object.freeze({ label: "Build Status", value: "configured" }),
    Object.freeze({ label: "Route Health", value: `${requiredLaunchRoutes.length} launch routes` }),
    Object.freeze({ label: "Audio Readiness", value: audio.status }),
    Object.freeze({ label: "Video Readiness", value: video.status }),
    Object.freeze({ label: "Export Tiers", value: `${finalExportTiers.length} final tiers` }),
    Object.freeze({ label: "Emoji UI", value: "blocked by smoke gate" }),
    Object.freeze({ label: "Dependency Check", value: "current stable baseline" }),
    Object.freeze({ label: "Provider Gateway Safety", value: "clone language guard available" }),
    Object.freeze({ label: "Rights Passport", value: "provenance boundary available" }),
    Object.freeze({ label: "Workflow Guards", value: "step requirements available" })
  ]);
}

export function createLaunchReadinessSummary() {
  return Object.freeze({
    checks: createLaunchReadinessChecklist(),
    audit: createLaunchAuditReport()
  });
}
