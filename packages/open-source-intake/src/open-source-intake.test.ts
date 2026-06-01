import { describe, expect, it } from "vitest";
import {
  buildExternalProjectRecommendation,
  findOpenSourceProject,
  getBlockedOpenSourceProjects,
  getOpenSourceIntakeSummary,
  getOpenSourceProjectRegistry,
  getSecurityReviewProjects,
  normalizeExternalProjectUrl,
  openSourceIntakeFeatureFlags,
  requiresLicenseReview
} from "./index.ts";

describe("open source intake registry", () => {
  it("lists every owner-provided intake candidate without marking integrations live", () => {
    const projects = getOpenSourceProjectRegistry();
    expect(projects).toHaveLength(40);
    expect(projects.every((project) => project.metadata.externalCodeCopied === false)).toBe(true);
    expect(projects.every((project) => project.metadata.integrationConfigured === false)).toBe(
      true
    );
    expect(
      projects.every((project) => project.normalizedUrl.startsWith("https://github.com/"))
    ).toBe(true);
  });

  it("strips tracking parameters before URLs are saved", () => {
    const normalized = normalizeExternalProjectUrl(
      "https://github.com/xai-org/x-algorithm?fbclid=123&utm_source=facebook&ref=bad#readme"
    );
    expect(normalized).toBe("https://github.com/xai-org/x-algorithm");
    for (const project of getOpenSourceProjectRegistry()) {
      expect(project.normalizedUrl).not.toContain("fbclid");
      expect(project.normalizedUrl).not.toContain("utm_");
      expect(project.normalizedUrl).not.toContain("#");
    }
  });

  it("marks GPL and AGPL projects as license-review required", () => {
    const erpnext = findOpenSourceProject("frappe", "erpnext");
    const nextcloud = findOpenSourceProject("nextcloud", "server");
    expect(erpnext?.licenseRisk).toBe("high");
    expect(nextcloud?.licenseRisk).toBe("critical");
    expect(erpnext && requiresLicenseReview(erpnext)).toBe(true);
    expect(nextcloud && requiresLicenseReview(nextcloud)).toBe(true);
  });

  it("blocks scraping and unofficial WhatsApp automation by default", () => {
    const blocked = getBlockedOpenSourceProjects().map((project) => project.repoName);
    expect(blocked).toContain("Google-Maps-Scrapper");
    expect(blocked).toContain("OpenWA");
    expect(openSourceIntakeFeatureFlags.RISKY_SCRAPING_TOOLS_ENABLED).toBe(false);
    expect(openSourceIntakeFeatureFlags.UNOFFICIAL_MESSAGING_AUTOMATION_ENABLED).toBe(false);
  });

  it("keeps voice, visual, media, browser automation, VPN, and unknown projects review-gated", () => {
    const omniVoice = findOpenSourceProject("debpalash", "OmniVoice-Studio");
    const sana = findOpenSourceProject("NVlabs", "Sana");
    const browserAgent = findOpenSourceProject("nicedreamzapp", "browser-agent");
    const droidDesk = findOpenSourceProject("orailnoor", "DroidDesk");
    const unknown = findOpenSourceProject("dograh-hq", "dograh");
    expect(omniVoice?.useMode).toBe("beta_gated_feature");
    expect(sana?.integrationStatus).toBe("not_reviewed");
    expect(browserAgent?.useMode).toBe("needs_security_review");
    expect(droidDesk?.useMode).toBe("needs_security_review");
    expect(unknown?.integrationStatus).toBe("not_reviewed");
    expect(getSecurityReviewProjects().some((project) => project.repoName === "DroidDesk")).toBe(
      true
    );
  });

  it("adds recent GitHub Radar candidates without marking them integrated", () => {
    const openJarvis = findOpenSourceProject("open-jarvis", "OpenJarvis");
    const skillOpt = findOpenSourceProject("microsoft", "SkillOpt");
    const longLive = findOpenSourceProject("NVlabs", "LongLive");
    const pentestAgent = findOpenSourceProject("GH05TCREW", "pentestagent");
    const worldview = findOpenSourceProject("nasa-gibs", "worldview");

    expect(openJarvis?.metadata.githubRadarScore).toBe(84);
    expect(skillOpt?.metadata.recommendedAction).toBe("priority_candidate");
    expect(longLive?.metadata.integrationStatusLabel).toBe("research_only");
    expect(pentestAgent?.metadata.publicRecommendationAllowed).toBe(false);
    expect(worldview?.rules.join(" ")).toContain("No NASA partnership");
    expect(
      [openJarvis, skillOpt, longLive, pentestAgent, worldview].every(
        (project) =>
          project !== null &&
          project.metadata.externalCodeCopied === false &&
          project.metadata.productionDependencyInstalled === false &&
          project.metadata.integrationConfigured === false
      )
    ).toBe(true);
  });

  it("builds recommendations that do not install blocked or unreviewed projects", () => {
    const scraper = findOpenSourceProject("zohaibbashir", "Google-Maps-Scrapper");
    const recommendation = buildExternalProjectRecommendation(scraper!);
    expect(recommendation.decision).toBe("block");
    expect(recommendation.requiredReviews).toContain("owner");
    expect(recommendation.reasons.join(" ")).toContain("blocked");
    expect(getOpenSourceIntakeSummary()).toMatchObject({
      total: 40,
      blocked: 2,
      betaGated: 3
    });
  });
});
