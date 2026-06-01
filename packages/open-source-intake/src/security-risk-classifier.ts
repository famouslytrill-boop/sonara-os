import type { OpenSourceProjectCategory, OpenSourceSecurityRisk } from "./types.ts";

export function classifySecurityRisk(input: {
  category: OpenSourceProjectCategory;
  useMode?: string;
  rules?: readonly string[];
}): OpenSourceSecurityRisk {
  if (input.useMode === "blocked") {
    return "critical";
  }
  if (input.useMode === "needs_security_review") {
    return "high";
  }
  if (input.category === "scraping" || input.category === "whatsapp_automation") {
    return "critical";
  }
  if (
    input.category === "VPN_security" ||
    input.category === "VPN_ops" ||
    input.category === "remote_desktop_or_android_desktop" ||
    input.category === "browser_agent"
  ) {
    return "high";
  }
  if (
    input.category === "voice_ai" ||
    input.category === "voice_audio" ||
    input.category === "image_generation" ||
    input.category === "music_audio_ui"
  ) {
    return "high";
  }
  if (input.category === "unknown") {
    return "unknown";
  }
  return "medium";
}

export function requiresSecurityReview(securityRisk: OpenSourceSecurityRisk): boolean {
  return securityRisk === "unknown" || securityRisk === "high" || securityRisk === "critical";
}
