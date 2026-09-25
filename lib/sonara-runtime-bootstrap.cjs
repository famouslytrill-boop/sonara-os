// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const {
  startTelemetry,
  currentTelemetryState,
  installHttpObservability
} = require("./sonara-observability.cjs");
const { createDefaultRuntimeCapabilityService } = require("./sonara-runtime-capabilities.cjs");

// The provider decision must happen before Express is loaded so automatic
// HTTP/Express instrumentation can patch the modules before they are required.
startTelemetry();
const express = require("express");
const runtimeCapabilities = createDefaultRuntimeCapabilityService();

function createRuntimeApp() {
  const app = express();
  installHttpObservability(app);
  return app;
}

function decorateRuntimeReadiness(readiness) {
  if (!readiness || !readiness.services) throw new TypeError("readiness with services is required");
  const telemetry = currentTelemetryState();
  readiness.services.openTelemetry = telemetry.enabled ? "configured" : telemetry.status;
  readiness.runtimeCapabilities = runtimeCapabilities.summary();
  return readiness;
}

module.exports = {
  express,
  createRuntimeApp,
  decorateRuntimeReadiness
};
