import { describe, expect, it } from "vitest";
import {
  createSourceLeakRiskReport,
  isUnsafeEnvFile,
  scanArtifactTarget
} from "./lib/security/source-leak-prevention.ts";

describe("Source Leak Prevention scanner", () => {
  it("flags real env files but allows safe examples", () => {
    expect(isUnsafeEnvFile(".env")).toBe(true);
    expect(isUnsafeEnvFile(".env.local")).toBe(true);
    expect(isUnsafeEnvFile(".env.example")).toBe(false);
  });

  it("detects API key-like values and service-role patterns", () => {
    const apiKey = `sk_live_${"a".repeat(24)}`;
    const serviceRoleKey = ["SUPABASE_SERVICE_ROLE_KEY", "b".repeat(32)].join("=");
    const findings = scanArtifactTarget({
      filePath: "src/config.ts",
      content: `const key = "${apiKey}";\n${serviceRoleKey}`
    });

    expect(findings.map((finding) => finding.type)).toContain("api_key_pattern");
    expect(findings.map((finding) => finding.type)).toContain("service_role_pattern");
    expect(findings.every((finding) => finding.blocksRelease)).toBe(true);
  });

  it("detects source maps in build output", () => {
    const findings = scanArtifactTarget({
      filePath: "dist/app.js.map",
      content: "{}",
      isBuildOutput: true
    });

    expect(findings.map((finding) => finding.type)).toContain("source_map");
    expect(findings.find((finding) => finding.type === "source_map")?.severity).toBe("high");
  });

  it("creates a release-blocking report for critical findings", () => {
    const report = createSourceLeakRiskReport([
      { filePath: ".env", content: "PUBLIC_FLAG=true" },
      { filePath: "dist/app.js.map", content: "{}", isBuildOutput: true }
    ]);

    expect(report.ok).toBe(false);
    expect(report.criticalCount).toBe(1);
    expect(report.blocksRelease).toBe(true);
  });
});
