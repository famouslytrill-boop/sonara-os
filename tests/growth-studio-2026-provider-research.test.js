"use strict";

const assert = require("node:assert/strict");
const {
  getGrowthProvider,
  getGrowthProviderReadiness,
  chooseGrowthProvider
} = require("../lib/growth-studio-provider-registry.cjs");

const PLANNED = [
  ["google_ads_data_manager", "offline_conversion_ingest"],
  ["google_search_console", "search_performance"],
  ["youtube_data", "video_upload"],
  ["app_store_connect_analytics", "app_acquisition"],
  ["google_play_reporting", "android_vitals"]
];

describe("Growth Studio 2026 provider research boundary", () => {
  it("publishes planned providers as research-only, not configured runtime adapters", () => {
    for (const [key] of PLANNED) {
      const provider = getGrowthProvider(key);
      assert.ok(provider, key);
      assert.equal(provider.adapterMode, "reference_only", key);
      assert.equal(provider.integrationStatus, "research_only", key);
      const readiness = getGrowthProviderReadiness(provider, {});
      assert.equal(readiness.configured, false, key);
      assert.equal(readiness.enabled, false, key);
      assert.equal(readiness.status, "research_only", key);
    }
  });

  it("cannot route a provider job to a research-only provider even when requested by name", () => {
    for (const [key, capability] of PLANNED) {
      const result = chooseGrowthProvider(capability, key, {});
      assert.equal(result.ok, false, key);
      assert.equal(result.code, "provider_not_runnable", key);
    }
  });

  it("does not let research-only providers satisfy automatic capability selection", () => {
    for (const [, capability] of PLANNED) {
      const result = chooseGrowthProvider(capability, "auto", {});
      if (result.ok) assert.notEqual(result.provider.adapterMode, "reference_only", capability);
      else assert.equal(result.code, "capability_not_supported", capability);
    }
  });

  it("keeps current runnable provider selection intact", () => {
    const result = chooseGrowthProvider("campaign_create", "hubspot", {});
    assert.equal(result.ok, true);
    assert.equal(result.provider.key, "hubspot");
    assert.notEqual(result.provider.adapterMode, "reference_only");
  });
});
