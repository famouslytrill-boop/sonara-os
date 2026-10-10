// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Express req.route.path is server-declared. req.baseUrl can include RESOLVED
// router parameters containing tenant IDs, emails or customer-controlled data.
const SAFE_MOUNT_PREFIXES = Object.freeze(new Set([
  "/api", "/api/v1", "/api/creator", "/api/growth", "/api/business-builder",
  "/business-builder", "/creator-studio", "/growth-studio", "/account",
  "/api/account", "/api/sonara", "/api/owner"
]));
function safeRouteTemplate(req) {
  const route = req?.route?.path;
  if (typeof route !== "string" || !route.startsWith("/") || route.length > 160 ||
      /[?#\\\x00-\x1f]/.test(route)) return "unmatched";
  const baseUrl = req?.baseUrl ?? "";
  if (typeof baseUrl !== "string" || baseUrl.length > 80 ||
      /[?#\\\x00-\x1f]/.test(baseUrl)) return "unmatched";
  if (baseUrl && !SAFE_MOUNT_PREFIXES.has(baseUrl)) return "unmatched";
  const normalized = baseUrl + route;
  return normalized.length <= 160 ? normalized : "unmatched";
}
module.exports = { safeRouteTemplate };
