import { describe, expect, it } from "vitest";
import { finalExportTiers, isFinalExportTier } from "./exportTiers.ts";
import { createLaunchAuditReport } from "./launchAudit.ts";
import { auditServerSecrets } from "./lib/server-secrets.ts";
import { validateSignalEnv } from "./lib/env.ts";

describe("launch audit hardening", () => {
  it("validates final export tier utilities", () => {
    expect(finalExportTiers).toEqual([
      "prompt_bundle",
      "production_bundle",
      "daw_bundle",
      "release_bundle",
      "elite_mutation_bundle"
    ]);
    expect(isFinalExportTier("release_bundle")).toBe(true);
    expect(isFinalExportTier(["starter", "_bundle"].join(""))).toBe(false);
  });

  it("warns on partial Supabase public config", () => {
    expect(
      validateSignalEnv({
        appName: "SONARA Industries",
        supabaseUrl: "https://example.supabase.co",
        enableSound: true,
        enableVideo: true,
        enableMic: true
      }).valid
    ).toBe(false);
  });

  it("detects public service-role leakage", () => {
    expect(
      auditServerSecrets({
        NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "leak"
      }).publicLeakDetected
    ).toBe(true);
  });

  it("creates a consolidated launch audit report", () => {
    expect(createLaunchAuditReport().map((item) => item.label)).toContain("Workflow Guards");
  });
});
