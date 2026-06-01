import { describe, expect, it } from "vitest";
import {
  createGitHubUpdateWatchReport,
  githubUpdateWatcherFeatureFlags,
  requiresOwnerApprovalForRepository
} from "./index.ts";

describe("GitHub Update Watcher", () => {
  it("reports watched repositories without auto-updating", () => {
    const report = createGitHubUpdateWatchReport("2026-05-26T00:00:00.000Z");
    expect(report.repositories).toHaveLength(13);
    expect(report.policy.autoInstallExternalRepos).toBe(false);
    expect(report.policy.autoMergeUpdates).toBe(false);
    expect(report.findings.some((finding) => finding.repo === "frappe/erpnext")).toBe(true);
    expect(report.findings.some((finding) => finding.repo === "microsoft/SkillOpt")).toBe(true);
    expect(report.findings.some((finding) => finding.repo === "GH05TCREW/pentestagent")).toBe(true);
  });

  it("requires owner approval for risky adoption", () => {
    const report = createGitHubUpdateWatchReport();
    expect(report.repositories.filter(requiresOwnerApprovalForRepository).length).toBeGreaterThan(
      0
    );
    expect(githubUpdateWatcherFeatureFlags.AUTO_UPDATE_PRODUCTION_DEPENDENCIES).toBe(false);
  });
});
