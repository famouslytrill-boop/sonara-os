import { describe, expect, it } from "vitest";
import {
  canonicalAppRoutes,
  canonicalDomain,
  canonicalPublicBaseUrl,
  canonicalPublicRoutes,
  checkRancherSync,
  createDeploymentSyncReport,
  redactEnvValue,
  validateDeploymentEnv
} from "./index.ts";

describe("deployment sync", () => {
  it("uses sonaraindustries.com as the canonical domain and maps public/app routes", () => {
    expect(canonicalDomain).toBe("sonaraindustries.com");
    expect(canonicalPublicBaseUrl).toBe("https://sonaraindustries.com");
    expect(canonicalPublicRoutes).toContain("/business-builder");
    expect(canonicalPublicRoutes).toContain("/refund-policy");
    expect(canonicalAppRoutes).toContain("/app/admin/command-center");
    expect(canonicalAppRoutes).toContain("/app/billing");
  });

  it("redacts secrets and flags dangerous public secret names", () => {
    const result = validateDeploymentEnv({
      env: {
        NEXT_PUBLIC_SITE_URL: "https://sonaraindustries.com",
        NEXT_PUBLIC_APP_URL: "https://sonaraindustries.com/app",
        NEXT_PUBLIC_COMPANY_NAME: "SONARA Industries",
        NEXT_PUBLIC_PLATFORM_NAME: "SONARA Industries",
        NEXT_PUBLIC_SUPPORT_EMAIL: "support@example.com",
        NEXT_PUBLIC_SERVICE_ROLE_KEY: "do-not-print",
        STRIPE_SECRET_KEY: "sk_test_redacted"
      }
    });

    expect(redactEnvValue("STRIPE_SECRET_KEY", "sk_test_redacted")).toBe("configured_redacted");
    expect(JSON.stringify(result)).not.toContain("do-not-print");
    expect(JSON.stringify(result)).not.toContain("sk_test_redacted");
    expect(result.findings.some((finding) => finding.riskLevel === "critical")).toBe(true);
  });

  it("does not claim cloud providers are verified from local configuration", () => {
    const report = createDeploymentSyncReport({
      env: {
        NEXT_PUBLIC_SITE_URL: "https://sonaraindustries.com",
        NEXT_PUBLIC_APP_URL: "https://sonaraindustries.com/app",
        GITHUB_REPOSITORY: "owner/repo",
        VERCEL_PROJECT_ID: "project",
        VERCEL_ORG_ID: "org"
      },
      repoFiles: new Set([
        ".github/workflows/ci.yml",
        "scripts/security-headers.mjs",
        "scripts/security-scan-artifacts.mjs"
      ]),
      now: new Date("2026-05-21T00:00:00.000Z")
    });

    expect(report.statuses.github.status).not.toBe("verified");
    expect(report.statuses.vercel.status).not.toBe("verified");
    expect(report.statuses.domain.status).toBe("needs_review");
    expect(report.findings.some((finding) => finding.findingKey === "domain.dns_ssl")).toBe(true);
  });

  it("keeps Rancher optional for MVP unless configured", () => {
    const rancher = checkRancherSync({ env: {} });
    expect(rancher.status).toBe("skipped_for_mvp");
    expect(rancher.metadata.requiredForMvp).toBe(false);
  });

  it("shows Stripe and paywall blockers/review items without payment custody claims", () => {
    const report = createDeploymentSyncReport({ env: {} });
    expect(report.statuses.stripe.metadata.rawCardDataStored).toBe(false);
    expect(report.statuses.stripe.metadata.marketplaceConnectDefault).toBe(false);
    expect(report.statuses.paywall.findings.map((finding) => finding.findingKey)).toContain(
      "paywall.feature_gates"
    );
    expect(report.findings.some((finding) => finding.findingKey === "stripe.secret_key")).toBe(
      true
    );
  });
});
