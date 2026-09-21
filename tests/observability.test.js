"use strict";

const assert = require("node:assert/strict");
const { startTelemetry, currentTelemetryState } = require("../lib/sonara-observability.cjs");

describe("OpenTelemetry production boundary", () => {
  it("is disabled unless explicitly enabled", () => {
    const state = startTelemetry({ NODE_ENV: "test" });
    assert.equal(state.enabled, false);
    assert.equal(state.status, "disabled");
    assert.deepEqual(currentTelemetryState(), { enabled: false, status: "disabled" });
  });
});
