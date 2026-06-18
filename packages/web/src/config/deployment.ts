export type DeploymentConfig = Readonly<{
  siteUrl: string;
  appUrl: string;
  marketingUrl: string;
  supportEmail: string;
  companyName: string;
  appVersion: string;
  environment: string;
  publicAuth: PublicAuthConfig;
  diagnostics: DeploymentDiagnosticsConfig;
  stripeBillingHealth: StripeBillingDeploymentHealth;
}>;

export type PublicAuthConfig = Readonly<{
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}>;

export type DeploymentHeadMetadata = Readonly<{
  title: string;
  description: string;
  canonicalUrl: string;
  openGraphImageUrl: string;
  companyName: string;
}>;

export type DeploymentDiagnosticsConfig = Readonly<{
  database: EnvStatus;
  stripe: EnvStatus;
  aiProviders: EnvStatus;
}>;

export type StripeBillingDeploymentHealth = Readonly<{
  secretKeyConfigured: boolean;
  publishableKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
  priceIdsConfigured: boolean;
  webhookRouteReachable: boolean;
}>;

export type EnvStatus = Readonly<{
  configured: boolean;
  status: "configured" | "setup_required";
  message: string;
}>;

const defaultDeploymentConfig: DeploymentConfig = Object.freeze({
  siteUrl: "https://sonaraindustries.com",
  appUrl: "https://sonaraindustries.com/app",
  marketingUrl: "https://sonaraindustries.com",
  supportEmail: "support@example.com",
  companyName: "SONARA Industries",
  appVersion: "0.1.0",
  environment: "production",
  publicAuth: Object.freeze({}),
  diagnostics: Object.freeze({
    database: createEnvStatus(false, "Database connection is in setup mode."),
    stripe: createEnvStatus(false, "Stripe server secrets are not exposed to the client."),
    aiProviders: createEnvStatus(false, "AI provider keys are not exposed to the client.")
  }),
  stripeBillingHealth: Object.freeze({
    secretKeyConfigured: false,
    publishableKeyConfigured: false,
    webhookSecretConfigured: false,
    priceIdsConfigured: false,
    webhookRouteReachable: false
  })
});

const defaultTitle = "SONARA Industries";
const defaultDescription =
  "SONARA Industries brings Business Builder, Creator Studio, and Growth Studio into one launch-focused platform.";

type DeploymentConfigGlobal = typeof globalThis & {
  __SONARA_DEPLOYMENT_CONFIG__?: Partial<DeploymentConfig>;
};

export function getDeploymentConfig(): DeploymentConfig {
  const injected = (globalThis as DeploymentConfigGlobal).__SONARA_DEPLOYMENT_CONFIG__ ?? {};
  return Object.freeze({
    siteUrl: normalizeHttpUrl(injected.siteUrl, defaultDeploymentConfig.siteUrl),
    appUrl: normalizeHttpUrl(injected.appUrl, defaultDeploymentConfig.appUrl),
    marketingUrl: normalizeHttpUrl(injected.marketingUrl, defaultDeploymentConfig.marketingUrl),
    supportEmail: normalizeSupportEmail(injected.supportEmail),
    companyName: normalizeText(injected.companyName, defaultDeploymentConfig.companyName),
    appVersion: normalizeText(injected.appVersion, defaultDeploymentConfig.appVersion),
    environment: normalizeText(injected.environment, defaultDeploymentConfig.environment),
    publicAuth: normalizePublicAuthConfig(injected.publicAuth),
    diagnostics: normalizeDiagnostics(injected.diagnostics),
    stripeBillingHealth: normalizeStripeBillingHealth(injected.stripeBillingHealth)
  });
}

export function createDeploymentHeadMetadata(pathname = "/"): DeploymentHeadMetadata {
  const config = getDeploymentConfig();
  return Object.freeze({
    title: defaultTitle,
    description: defaultDescription,
    canonicalUrl: createUrl(config.siteUrl, pathname),
    openGraphImageUrl: createUrl(config.siteUrl, "/brand/sonara-one-og.svg"),
    companyName: config.companyName
  });
}

export function applyDeploymentMetadata(pathname = "/") {
  if (typeof document === "undefined") {
    return;
  }
  const metadata = createDeploymentHeadMetadata(pathname);
  document.title = metadata.title;
  setMeta("name", "description", metadata.description);
  setMeta("name", "robots", "index,follow");
  setMeta("property", "og:title", metadata.title);
  setMeta("property", "og:description", metadata.description);
  setMeta("property", "og:type", "website");
  setMeta("property", "og:site_name", metadata.companyName);
  setMeta("property", "og:url", metadata.canonicalUrl);
  setMeta("property", "og:image", metadata.openGraphImageUrl);
  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", metadata.title);
  setMeta("name", "twitter:description", metadata.description);
  setMeta("name", "twitter:image", metadata.openGraphImageUrl);
  setCanonical(metadata.canonicalUrl);
}

export function createHealthResponse(now = new Date()) {
  const config = getDeploymentConfig();
  return Object.freeze({
    ok: true,
    service: "SONARA Industries web",
    status: "ready",
    version: config.appVersion,
    environment: config.environment,
    siteUrl: config.siteUrl,
    companyName: config.companyName,
    generatedAt: now.toISOString(),
    checks: Object.freeze({
      staticShell: true,
      metadataConfig: true,
      robots: true,
      sitemap: true,
      manifest: true,
      diagnostics: true
    })
  });
}

export function normalizeDiagnostics(
  diagnostics: Partial<DeploymentDiagnosticsConfig> | undefined
): DeploymentDiagnosticsConfig {
  return Object.freeze({
    database: normalizeEnvStatus(
      diagnostics?.database,
      defaultDeploymentConfig.diagnostics.database.message
    ),
    stripe: normalizeEnvStatus(
      diagnostics?.stripe,
      defaultDeploymentConfig.diagnostics.stripe.message
    ),
    aiProviders: normalizeEnvStatus(
      diagnostics?.aiProviders,
      defaultDeploymentConfig.diagnostics.aiProviders.message
    )
  });
}

export function normalizeStripeBillingHealth(
  health: Partial<StripeBillingDeploymentHealth> | undefined
): StripeBillingDeploymentHealth {
  return Object.freeze({
    secretKeyConfigured: Boolean(health?.secretKeyConfigured),
    publishableKeyConfigured: Boolean(health?.publishableKeyConfigured),
    webhookSecretConfigured: Boolean(health?.webhookSecretConfigured),
    priceIdsConfigured: Boolean(health?.priceIdsConfigured),
    webhookRouteReachable: Boolean(health?.webhookRouteReachable)
  });
}

function normalizePublicAuthConfig(config: Partial<PublicAuthConfig> | undefined): PublicAuthConfig {
  return Object.freeze({
    supabaseUrl: normalizeOptionalHttpsUrl(config?.supabaseUrl),
    supabaseAnonKey: normalizeText(config?.supabaseAnonKey, "")
  });
}

function normalizeHttpUrl(value: string | undefined, fallback: string) {
  const source = value?.trim() || fallback;
  try {
    const url = new URL(source);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return fallback;
    }
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

function normalizeOptionalHttpsUrl(value: string | undefined) {
  const source = value?.trim();
  if (!source) {
    return undefined;
  }
  try {
    const url = new URL(source);
    if (url.protocol !== "https:") {
      return undefined;
    }
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

function normalizeSupportEmail(value: string | undefined) {
  const source = value?.trim();
  if (!source || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(source)) {
    return defaultDeploymentConfig.supportEmail;
  }
  return source;
}

function normalizeText(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function normalizeEnvStatus(status: Partial<EnvStatus> | undefined, fallbackMessage: string) {
  return createEnvStatus(Boolean(status?.configured), status?.message ?? fallbackMessage);
}

function createEnvStatus(configured: boolean, message: string): EnvStatus {
  return Object.freeze({
    configured,
    status: configured ? "configured" : "setup_required",
    message
  });
}

function createUrl(baseUrl: string, pathname: string) {
  const cleanPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(cleanPath, `${baseUrl}/`).toString().replace(/\/$/, cleanPath === "/" ? "/" : "");
}

function setMeta(attribute: "name" | "property", key: string, content: string) {
  const selector = `meta[${attribute}="${key}"]`;
  const element = document.querySelector(selector) ?? document.createElement("meta");
  element.setAttribute(attribute, key);
  element.setAttribute("content", content);
  if (!element.parentElement) {
    document.head.append(element);
  }
}

function setCanonical(href: string) {
  const selector = 'link[rel="canonical"]';
  const element = document.querySelector(selector) ?? document.createElement("link");
  element.setAttribute("rel", "canonical");
  element.setAttribute("href", href);
  if (!element.parentElement) {
    document.head.append(element);
  }
}
