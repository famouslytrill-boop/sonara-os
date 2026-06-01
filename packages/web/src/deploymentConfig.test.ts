import { afterEach, describe, expect, it } from "vitest";
import {
  createDeploymentHeadMetadata,
  createHealthResponse,
  getDeploymentConfig
} from "./config/deployment.ts";

type DeploymentConfigGlobal = typeof globalThis & {
  __SONARA_DEPLOYMENT_CONFIG__?: {
    siteUrl?: string;
    appUrl?: string;
    marketingUrl?: string;
    supportEmail?: string;
    companyName?: string;
    appVersion?: string;
    environment?: string;
  };
};

const deploymentGlobal = globalThis as DeploymentConfigGlobal;

describe("deployment config", () => {
  afterEach(() => {
    Reflect.deleteProperty(deploymentGlobal, "__SONARA_DEPLOYMENT_CONFIG__");
  });

  it("reads canonical deployment URLs from injected environment config", () => {
    deploymentGlobal.__SONARA_DEPLOYMENT_CONFIG__ = {
      siteUrl: "https://www.sonara.example/",
      appUrl: "https://app.sonara.example/",
      marketingUrl: "https://sonara.example/",
      supportEmail: "support@sonara.example",
      companyName: "SONARA Industries",
      appVersion: "0.2.0",
      environment: "preview"
    };

    const config = getDeploymentConfig();
    const metadata = createDeploymentHeadMetadata("/pricing");

    expect(config.siteUrl).toBe("https://www.sonara.example");
    expect(config.appUrl).toBe("https://app.sonara.example");
    expect(config.appVersion).toBe("0.2.0");
    expect(config.environment).toBe("preview");
    expect(metadata.canonicalUrl).toBe("https://www.sonara.example/pricing");
    expect(metadata.openGraphImageUrl).toBe("https://www.sonara.example/brand/sonara-one-og.svg");
  });

  it("falls back to safe defaults instead of localhost or invalid URLs", () => {
    deploymentGlobal.__SONARA_DEPLOYMENT_CONFIG__ = {
      siteUrl: "file:///tmp/site",
      supportEmail: "not-an-email"
    };

    const config = getDeploymentConfig();
    const health = createHealthResponse(new Date("2026-05-20T00:00:00.000Z"));

    expect(config.siteUrl).toBe("https://sonaraindustries.com");
    expect(config.supportEmail).toBe("support@example.com");
    expect(health.ok).toBe(true);
    expect(health.checks.sitemap).toBe(true);
    expect(health.checks.diagnostics).toBe(true);
  });
});
