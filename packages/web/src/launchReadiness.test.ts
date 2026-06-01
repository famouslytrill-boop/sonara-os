import { describe, expect, it } from "vitest";
import { normalizeRoute } from "./app.ts";
import {
  createLaunchReadinessChecklist,
  finalExportTiers,
  requiredLaunchRoutes
} from "./launchReadiness.ts";

describe("launch readiness", () => {
  it("normalizes required launch routes", () => {
    for (const route of requiredLaunchRoutes) {
      expect(normalizeRoute(route)).toBe(route);
    }
  });

  it("keeps only final export tiers", () => {
    expect(finalExportTiers).toEqual([
      "prompt_bundle",
      "production_bundle",
      "daw_bundle",
      "release_bundle",
      "elite_mutation_bundle"
    ]);
  });

  it("creates launch checklist cards", () => {
    expect(createLaunchReadinessChecklist().map((item) => item.label)).toContain("Route Health");
  });
});
