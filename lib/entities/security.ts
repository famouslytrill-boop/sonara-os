import type { EntityRole } from "./config";

const blockedProtocols = new Set(["javascript:", "data:", "file:", "ftp:"]);
const blockedHostPatterns = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/,
];

export type UrlSafetyResult = {
  ok: boolean;
  normalizedUrl?: string;
  reason?: string;
  previewAllowed: boolean;
};

export function validateEntityBrowserUrl(input: string): UrlSafetyResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, reason: "Enter a URL before opening the workspace preview.", previewAllowed: false };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, reason: "Use a valid https:// or http:// URL.", previewAllowed: false };
  }

  if (blockedProtocols.has(parsed.protocol)) {
    return { ok: false, reason: "This URL protocol is not allowed in the entity browser.", previewAllowed: false };
  }

  if (!["https:", "http:"].includes(parsed.protocol)) {
    return { ok: false, reason: "Only HTTP and HTTPS URLs are supported.", previewAllowed: false };
  }

  if (blockedHostPatterns.some((pattern) => pattern.test(parsed.hostname))) {
    return {
      ok: false,
      reason: "Local and private-network addresses are blocked for safety.",
      previewAllowed: false,
    };
  }

  return {
    ok: true,
    normalizedUrl: parsed.toString(),
    previewAllowed: parsed.protocol === "https:",
  };
}

export type EntityActionRisk = "low" | "medium" | "high" | "destructive";

export const destructiveActionTypes = new Set([
  "delete",
  "billing",
  "payment",
  "role_change",
  "public_alert_publish",
  "mass_notification",
  "database_write",
  "production_deploy",
]);

export function requiresHumanApproval(actionType: string, risk: EntityActionRisk = "medium") {
  return risk === "high" || risk === "destructive" || destructiveActionTypes.has(actionType);
}

export function canApproveEntityAction(role: EntityRole) {
  return role === "owner" || role === "admin";
}

export function canProposeEntityAction(role: EntityRole) {
  return role === "owner" || role === "admin" || role === "operator";
}

export function getSessionCookieName(entitySlug: string) {
  switch (entitySlug) {
    case "parent-company":
      return "sonara_admin_session";
    case "creator-music-technology":
      return "sonara_trackfoundry_session";
    case "business-operations":
      return "sonara_lineready_session";
    case "community-public-information":
      return "sonara_noticegrid_session";
    default:
      return "sonara_entity_session";
  }
}
