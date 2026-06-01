import { describe, expect, it } from "vitest";
import { featureFlags, isFeatureEnabled } from "./lib/feature-flags.ts";
import { getSignalEnv, isSupabaseConfigured } from "./lib/env.ts";
import { getNavigationRoutes } from "./routes/route-manifest.ts";
import { routeProviderRequest } from "./providers/provider-gateway.ts";
import {
  detectUnsafeCloneRequest,
  rewriteStyleRequestSafely
} from "./safety/music-style-safety.ts";
import { getMissingRequirement, getRecoveryRoute } from "./workflows/workflow-guards.ts";

describe("launch foundation", () => {
  it("reads stable environment defaults", () => {
    expect(getSignalEnv()).toMatchObject({
      appName: "SONARA Industries",
      enableSound: true,
      enableVideo: true,
      enableMic: true
    });
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("exposes feature flags without enabling heavy adapters", () => {
    expect(featureFlags.mutationLab).toBe(true);
    expect(isFeatureEnabled("qdrantMemory")).toBe(false);
  });

  it("rewrites direct clone language before provider routing", async () => {
    expect(detectUnsafeCloneRequest("sound just like a named artist")).toBe(true);
    expect(rewriteStyleRequestSafely("copy a named artist")).toContain("without cloning");

    const response = await routeProviderRequest({
      provider: "local",
      task: "analysis",
      prompt: "make this exactly like a named artist",
      userId: "u1"
    });

    expect(response.warnings).toHaveLength(1);
    expect(response.text).toContain("Provider gateway ready");
  });

  it("guards workflow route order", () => {
    expect(getMissingRequirement("compose", {})).toBe(
      "Analyze Intelligence is required before Compose System."
    );
    expect(getRecoveryRoute("export")).toBe("/mutation");
  });

  it("keeps navigation labels in product language", () => {
    expect(getNavigationRoutes().map((route) => route.label)).toContain("Analyze Intelligence");
    expect(getNavigationRoutes().map((route) => route.label)).toContain("Export Forge");
  });
});
