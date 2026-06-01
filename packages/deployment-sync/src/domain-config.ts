import type { DeploymentSyncContext, DomainConnectionStatus } from "./types.ts";

export const canonicalDomain = "sonaraindustries.com";
export const canonicalPublicBaseUrl = `https://${canonicalDomain}`;
export const appBasePath = "/app";
export const optionalAppAlias = "app.sonaraindustries.com";

export const canonicalPublicRoutes = Object.freeze([
  "/",
  "/business-builder",
  "/creator-studio",
  "/growth-studio",
  "/pricing",
  "/security",
  "/about",
  "/contact",
  "/terms",
  "/privacy",
  "/refund-policy"
]);

export const canonicalAppRoutes = Object.freeze([
  "/app",
  "/app/business-builder",
  "/app/creator-studio",
  "/app/growth-studio",
  "/app/admin/command-center",
  "/app/security-center",
  "/app/billing",
  "/app/onboarding"
]);

export function createDomainStatus(context: DeploymentSyncContext = {}): DomainConnectionStatus {
  const env = context.env ?? {};
  const siteUrl = normalizeUrl(env.NEXT_PUBLIC_SITE_URL);
  const appUrl = normalizeUrl(env.NEXT_PUBLIC_APP_URL);
  const findings = [
    siteUrl === canonicalPublicBaseUrl
      ? finding(
          "configured",
          "low",
          "domain.site_url",
          "NEXT_PUBLIC_SITE_URL uses the canonical domain."
        )
      : finding(
          siteUrl ? "blocked" : "not_configured",
          "high",
          "domain.site_url",
          "NEXT_PUBLIC_SITE_URL must be https://sonaraindustries.com before public launch.",
          { configuredHost: siteUrl ? safeHost(siteUrl) : "missing" }
        ),
    appUrl === canonicalPublicBaseUrl || appUrl === `${canonicalPublicBaseUrl}${appBasePath}`
      ? finding(
          "configured",
          "low",
          "domain.app_url",
          "NEXT_PUBLIC_APP_URL maps to the canonical domain."
        )
      : finding(
          appUrl ? "needs_review" : "not_configured",
          "medium",
          "domain.app_url",
          "NEXT_PUBLIC_APP_URL should use sonaraindustries.com and the /app base path.",
          { configuredHost: appUrl ? safeHost(appUrl) : "missing" }
        ),
    finding(
      "needs_review",
      "high",
      "domain.dns_ssl",
      "DNS and SSL cannot be verified from this static repo check. Verify registrar, Vercel domain, SSL, and redirect behavior manually."
    ),
    finding(
      "skipped_for_mvp",
      "low",
      "domain.optional_alias",
      "app.sonaraindustries.com is optional for MVP and should redirect to /app only after DNS is verified.",
      { optionalAlias: optionalAppAlias }
    )
  ] as const;
  return Object.freeze({
    provider: "domain",
    status: findings.some((item) => item.status === "blocked") ? "blocked" : "needs_review",
    riskLevel: findings.some((item) => item.status === "blocked") ? "high" : "medium",
    findings: Object.freeze([...findings]),
    metadata: Object.freeze({
      canonicalDomain,
      publicBaseUrl: canonicalPublicBaseUrl,
      publicRoutes: canonicalPublicRoutes,
      appRoutes: canonicalAppRoutes
    })
  });
}

function normalizeUrl(value: string | undefined) {
  if (!value?.trim()) {
    return "";
  }
  try {
    const url = new URL(value.trim());
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim();
  }
}

function safeHost(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return "invalid_url";
  }
}

function finding(
  status: DomainConnectionStatus["status"],
  riskLevel: DomainConnectionStatus["riskLevel"],
  findingKey: string,
  message: string,
  metadata: Readonly<Record<string, unknown>> = {}
) {
  return Object.freeze({
    provider: "domain" as const,
    status,
    riskLevel,
    findingKey,
    message,
    metadata: Object.freeze(metadata)
  });
}
