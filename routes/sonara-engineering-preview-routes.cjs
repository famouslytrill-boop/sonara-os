// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Authenticated, rate-limited, stateless engineering previews. This router
// neither uploads a file nor persists submitted CAD or pose measurements.
const { tryParseAsciiDxf } = require("../lib/sonara-dxf-readonly-intake.cjs");
const { tryParsePoseWorldLandmarks } = require("../lib/sonara-pose-world-readonly-intake.cjs");
const { tryLinearMaterialEstimate } = require("../lib/sonara-cad-linear-estimate.cjs");

const DXF_BYTES_MAX = 512 * 1024;
const POSE_JSON_BYTES_MAX = 512 * 1024;
const PREVIEW_ROUTES = Object.freeze({
  dxf: "/api/business-builder/engineering/dxf-preview",
  estimate: "/api/business-builder/engineering/linear-estimate",
  pose: "/api/creator-studio/engineering/pose-preview"
});

function registerEngineeringPreviewRoutes(app, deps = {}) {
  if (!app || typeof app.post !== "function") throw new TypeError("Express app.post required");
  for (const key of ["requireWorkspaceAccess", "createRateLimiter", "getSupabaseServerConfig"]) {
    if (typeof deps[key] !== "function") throw new TypeError(`Missing required engineering preview dependency: ${key}`);
  }
  const guardBusiness = deps.requireWorkspaceAccess("business_builder");
  const guardCreator = deps.requireWorkspaceAccess("creator_studio");
  const limiter = deps.createRateLimiter({
    name: "engineering_readonly_previews",
    windowSeconds: 3600,
    maxAttempts: 30,
    degradedMaxAttempts: 30,
    scopes: ["ip", "subject"],
    subjectFrom: (req) => req.sonaraUser?.id || req.sonaraAccess?.user?.id,
    getSupabaseServerConfig: deps.getSupabaseServerConfig
  });
  if (typeof guardBusiness !== "function" || typeof guardCreator !== "function" ||
      typeof limiter !== "function") {
    throw new TypeError("Engineering preview authorization and rate limits must be middleware");
  }

  // The deployment owner must explicitly enable this experimental intake.
  // Missing/unavailable flag fails closed. Authorization and throttling remain
  // mandatory even when enabled; client requests cannot set the flag.
  const enabled = typeof deps.isEnabled === "function" ? deps.isEnabled : () => false;
  const featureGate = (req, res, next) => {
    if (enabled() !== true) return res.status(404).json({ ok: false, code: "not_found" });
    return next();
  };

  // Post-auth before computation, and shared limiter across all three routes.
  // JSON parser is registered upstream with a 1 MB body ceiling; these stricter
  // route-level caps defend against missing/misconfigured upstream limits.
  const preview = (handler, maxBytes, field = null) => (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!/^application\/json(?:\s*;|\s*$)/i.test(String(req.headers?.["content-type"] || ""))) {
      return res.status(415).json({ ok: false, code: "json_required" });
    }
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ ok: false, code: "invalid_request" });
    }
    // There are no multipart uploads, file-system paths, remote fetches or
    // base64 blobs; the user explicitly provides source content in JSON.
    if (field && (typeof body[field] !== "string" ||
        Buffer.byteLength(body[field], "utf8") > maxBytes)) {
      return res.status(413).json({ ok: false, code: "payload_too_large_or_missing" });
    }
    if (!field && Buffer.byteLength(JSON.stringify(body), "utf8") > maxBytes) {
      return res.status(413).json({ ok: false, code: "payload_too_large" });
    }
    const outcome = handler(body);
    return res.status(outcome.ok ? 200 : 400).json(outcome);
  };

  app.post(PREVIEW_ROUTES.dxf, featureGate, guardBusiness, limiter,
    preview((body) => tryParseAsciiDxf(body.dxfText), DXF_BYTES_MAX, "dxfText"));
  app.post(PREVIEW_ROUTES.estimate, featureGate, guardBusiness, limiter,
    preview((body) => tryLinearMaterialEstimate(body), DXF_BYTES_MAX, "dxfText"));
  app.post(PREVIEW_ROUTES.pose, featureGate, guardCreator, limiter,
    preview((body) => tryParsePoseWorldLandmarks(body), POSE_JSON_BYTES_MAX));
}

module.exports = { registerEngineeringPreviewRoutes, PREVIEW_ROUTES };
