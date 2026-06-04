import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { URL } from "node:url";
import ts from "typescript";
import { packageName, repoRoot, walkFiles } from "./workspace.mjs";
import { writeSecurityHeadersFile } from "./security-headers.mjs";

const packageArg = process.argv[2];
if (!packageArg) {
  throw new Error("Usage: node scripts/build-package.mjs <package-dir>");
}

const packageDir = path.resolve(process.cwd(), packageArg);
const srcDir = path.join(packageDir, "src");
const distDir = path.join(packageDir, "dist");
const name = packageName(packageDir);
const webVendorPackages = Object.freeze(
  new Map([
    ["@signal-os/ui", "signal-os-ui"],
    ["@signal-os/autopilot", "signal-os-autopilot"],
    ["@signal-os/owner-confirmation-lock", "signal-os-owner-confirmation-lock"],
    ["@signal-os/open-source-intake", "signal-os-open-source-intake"],
    ["@signal-os/deployment-sync", "signal-os-deployment-sync"],
    ["@signal-os/recommendation-transparency", "signal-os-recommendation-transparency"],
    ["@signal-os/github-update-watcher", "signal-os-github-update-watcher"],
    ["@signal-os/api-provider-registry", "signal-os-api-provider-registry"],
    ["@signal-os/agent-orchestration-guard", "signal-os-agent-orchestration-guard"],
    ["@signal-os/ai-cost-control", "signal-os-ai-cost-control"],
    ["@signal-os/market-pattern-lab", "signal-os-market-pattern-lab"],
    ["@signal-os/brand-experience-system", "signal-os-brand-experience-system"],
    ["@signal-os/notification-sound-system", "signal-os-notification-sound-system"],
    ["@signal-os/profitability-dashboard", "signal-os-profitability-dashboard"],
    ["@signal-os/prompt-playbook-center", "signal-os-prompt-playbook-center"]
  ])
);

if (!fs.existsSync(srcDir)) {
  throw new Error(`Missing src directory: ${path.relative(repoRoot, srcDir)}`);
}

if (name === "@signal-os/web") {
  ensureWebVendorPackagesBuilt();
}

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

for (const sourceFile of walkFiles(
  srcDir,
  (filePath) =>
    /\.(ts|tsx)$/.test(filePath) &&
    !filePath.endsWith(".test.ts") &&
    !filePath.endsWith(".test.tsx")
)) {
  const relativeSource = path.relative(srcDir, sourceFile);
  const relativeOutput = relativeSource.replace(/\.(ts|tsx)$/, ".mjs");
  const outputFile = path.join(distDir, relativeOutput);
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  const source = fs.readFileSync(sourceFile, "utf8");
  fs.writeFileSync(outputFile, transpileSource(source, outputFile), "utf8");
}

for (const assetFile of walkFiles(srcDir, (filePath) =>
  /\.(css|html|ico|json|png|svg|webmanifest|webp|xml)$/.test(filePath)
)) {
  const relativeAsset = path.relative(srcDir, assetFile);
  const outputFile = path.join(distDir, relativeAsset);
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.copyFileSync(assetFile, outputFile);
}

if (name === "@signal-os/web") {
  writeWebDeploymentArtifacts();
  copyWebVendorPackagesIntoWebDist();
}

function transpileSource(source, outputFile) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove
    }
  }).outputText;
  return rewriteWorkspaceBrowserImports(
    output.replace(/from "([^"]+)\.(ts|tsx)"/g, 'from "$1.mjs"'),
    outputFile
  );
}

function rewriteWorkspaceBrowserImports(output, outputFile) {
  if (name !== "@signal-os/web") {
    return output;
  }
  let rewritten = output;
  for (const [packageName, vendorDirectory] of webVendorPackages.entries()) {
    const vendorEntry = path.join(distDir, "vendor", vendorDirectory, "index.mjs");
    const relativeVendorEntry = toImportSpecifier(
      path.relative(path.dirname(outputFile), vendorEntry)
    );
    rewritten = rewritten.replaceAll(`from "${packageName}"`, `from "${relativeVendorEntry}"`);
  }
  return rewritten;
}

function ensureWebVendorPackagesBuilt() {
  for (const packageName of webVendorPackages.keys()) {
    const vendorPackageDir = path.join(
      repoRoot,
      "packages",
      packageName.replace("@signal-os/", "")
    );
    if (!fs.existsSync(vendorPackageDir)) {
      continue;
    }
    const result = spawnSync(process.execPath, ["scripts/build-package.mjs", vendorPackageDir], {
      cwd: repoRoot,
      stdio: "inherit"
    });
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

function copyWebVendorPackagesIntoWebDist() {
  for (const [packageName, vendorDirectory] of webVendorPackages.entries()) {
    const vendorDistDir = path.join(
      repoRoot,
      "packages",
      packageName.replace("@signal-os/", ""),
      "dist"
    );
    if (!fs.existsSync(vendorDistDir)) {
      throw new Error(`Missing ${packageName} build output for web vendor copy.`);
    }
    copyDirectory(vendorDistDir, path.join(distDir, "vendor", vendorDirectory));
  }
}

function writeWebDeploymentArtifacts() {
  const version = readPackageVersion(packageDir);
  const deploymentConfig = getWebDeploymentConfig(version);
  const routes = [
    "/",
    "/business-builder",
    "/creator-studio",
    "/growth-studio",
    "/pricing",
    "/about",
    "/trust",
    "/security",
    "/contact",
    "/legal",
    "/legal/terms",
    "/legal/privacy",
    "/legal/refund-policy",
    "/legal/acceptable-use",
    "/legal/cookie-policy",
    "/legal/accessibility",
    "/legal/security",
    "/legal/dpa",
    "/terms",
    "/privacy",
    "/refund-policy",
    "/acceptable-use",
    "/beta",
    "/help",
    "/support",
    "/feedback",
    "/research-lab",
    "/research-lab/open-source",
    "/research-lab/github-radar",
    "/open-source",
    "/status",
    "/docs",
    "/api-webhooks",
    "/integrations",
    "/changelog",
    "/onboarding",
    "/login",
    "/signup",
    "/auth/auth-code-error",
    "/forgot-password",
    "/reset-password",
    "/settings/auth-status",
    "/app",
    "/app/dashboard",
    "/app/business-builder",
    "/app/creator-studio",
    "/app/growth-studio",
    "/app/settings",
    "/app/settings/readiness",
    "/app/admin",
    "/app/admin/auth-status",
    "/app/admin/setup",
    "/app/admin/launch-readiness",
    "/app/admin/command-center",
    "/app/admin/email-readiness",
    "/app/admin/github-radar",
    "/app/admin/integrations",
    "/app/security-center",
    "/app/billing",
    "/app/onboarding"
  ];

  fs.writeFileSync(
    path.join(distDir, "deployment-config.mjs"),
    `globalThis.__SONARA_DEPLOYMENT_CONFIG__ = Object.freeze(${JSON.stringify(
      deploymentConfig,
      null,
      2
    )});\n`,
    "utf8"
  );

  fs.writeFileSync(
    path.join(distDir, "robots.txt"),
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin/",
      "Disallow: /api/internal/",
      "Disallow: /api/admin/",
      `Sitemap: ${deploymentConfig.siteUrl}/sitemap.xml`,
      ""
    ].join("\n"),
    "utf8"
  );

  fs.writeFileSync(
    path.join(distDir, "sitemap.xml"),
    createSitemapXml(deploymentConfig.siteUrl, routes),
    "utf8"
  );

  fs.mkdirSync(path.join(distDir, "api"), { recursive: true });
  fs.writeFileSync(
    path.join(distDir, "api", "health"),
    JSON.stringify(
      {
        ok: true,
        service: "SONARA Industries web",
        status: "ready",
        version,
        siteUrl: deploymentConfig.siteUrl,
        companyName: deploymentConfig.companyName,
        generatedAt: new Date().toISOString(),
        checks: {
          staticShell: true,
          metadataConfig: true,
          robots: true,
          sitemap: true,
          manifest: true,
          diagnostics: true,
          securityHeaders: true
        }
      },
      null,
      2
    ),
    "utf8"
  );
  fs.mkdirSync(path.join(distDir, "api", "stripe"), { recursive: true });
  fs.writeFileSync(
    path.join(distDir, "api", "stripe", "webhook"),
    JSON.stringify(
      {
        ok: false,
        status: "setup_mode",
        service: "Stripe webhook",
        message:
          "Static build artifact only. Production webhook handling must run server-side and verify Stripe signatures against the raw body.",
        signatureVerificationRequired: true,
        secretsExposed: false
      },
      null,
      2
    ),
    "utf8"
  );
  for (const endpoint of ["checkout", "customer-portal"]) {
    fs.writeFileSync(
      path.join(distDir, "api", "stripe", endpoint),
      JSON.stringify(
        {
          ok: false,
          status: "setup_mode",
          service: `Stripe ${endpoint}`,
          message:
            "Static build artifact only. Production Stripe actions must run server-side, validate env, require auth where needed, and never expose secrets.",
          secretsExposed: false
        },
        null,
        2
      ),
      "utf8"
    );
  }

  writeDeploymentIndexHtml(deploymentConfig);
  writeSecurityHeadersFile(distDir);
}

function getWebDeploymentConfig(version) {
  const siteUrl = normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL, "https://sonaraindustries.com");
  return Object.freeze({
    siteUrl,
    appUrl: normalizeUrl(process.env.NEXT_PUBLIC_APP_URL, siteUrl),
    marketingUrl: normalizeUrl(process.env.NEXT_PUBLIC_MARKETING_URL, siteUrl),
    supportEmail: normalizeEmail(process.env.NEXT_PUBLIC_SUPPORT_EMAIL, "support@example.com"),
    companyName: normalizeText(process.env.NEXT_PUBLIC_COMPANY_NAME, "SONARA Industries"),
    appVersion: version,
    environment: normalizeText(
      process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
      "production"
    ),
    diagnostics: Object.freeze({
      database: createEnvStatus(
        Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        "Supabase public URL and anon key are checked as browser-safe public configuration."
      ),
      stripe: createEnvStatus(
        Boolean(
          process.env.STRIPE_SECRET_KEY &&
          process.env.STRIPE_WEBHOOK_SECRET &&
          process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
        ),
        "Stripe status is reduced to configured/not configured; secret values are never emitted."
      ),
      aiProviders: createEnvStatus(
        Boolean(
          process.env.OPENAI_API_KEY ||
          process.env.ANTHROPIC_API_KEY ||
          process.env.GOOGLE_GEMINI_API_KEY
        ),
        "AI provider status is reduced to configured/not configured; provider keys are never emitted."
      )
    }),
    stripeBillingHealth: Object.freeze({
      secretKeyConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      publishableKeyConfigured: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
      webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      priceIdsConfigured: areStripePriceIdsConfigured(process.env),
      webhookRouteReachable: false
    })
  });
}

function areStripePriceIdsConfigured(env) {
  return [
    "STRIPE_PRICE_STARTER",
    "STRIPE_PRICE_CORE",
    "STRIPE_PRICE_GROWTH",
    "STRIPE_PRICE_PRO",
    "STRIPE_PRICE_AGENCY",
    "STRIPE_PRICE_SETUP_99",
    "STRIPE_PRICE_SETUP_299",
    "STRIPE_PRICE_SETUP_499"
  ].every((key) => Boolean(env[key]));
}

function normalizeUrl(value, fallback) {
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

function normalizeEmail(value, fallback) {
  const source = value?.trim();
  return source && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(source) ? source : fallback;
}

function normalizeText(value, fallback) {
  return value?.trim() || fallback;
}

function createEnvStatus(configured, message) {
  return Object.freeze({
    configured,
    status: configured ? "configured" : "setup_required",
    message
  });
}

function readPackageVersion(packageDir) {
  const manifestPath = path.join(packageDir, "package.json");
  if (!fs.existsSync(manifestPath)) {
    return "0.0.0";
  }
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")).version ?? "0.0.0";
}

function createSitemapXml(siteUrl, routes) {
  const lastmod = new Date().toISOString().slice(0, 10);
  const body = routes
    .map(
      (route) => `  <url>
    <loc>${escapeXml(new URL(route, `${siteUrl}/`).toString())}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

function writeDeploymentIndexHtml(deploymentConfig) {
  const indexPath = path.join(distDir, "index.html");
  if (!fs.existsSync(indexPath)) {
    return;
  }
  const title = "SONARA Industries";
  const description =
    "SONARA Industries brings Business Builder, Creator Studio, and Growth Studio into one launch-focused platform.";
  const imageUrl = `${deploymentConfig.siteUrl}/brand/sonara-one-og.svg`;
  let html = fs.readFileSync(indexPath, "utf8");
  html = html
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
      `<meta name="description" content="${escapeHtml(description)}" />`
    )
    .replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/,
      `<link rel="canonical" href="${escapeHtml(`${deploymentConfig.siteUrl}/`)}" />`
    )
    .replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/>/,
      `<meta property="og:url" content="${escapeHtml(`${deploymentConfig.siteUrl}/`)}" />`
    )
    .replace(
      /<meta\s+property="og:image"\s+content="[^"]*"\s*\/>/,
      `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`
    )
    .replace(
      /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/>/,
      `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`
    );
  fs.writeFileSync(indexPath, html, "utf8");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeXml(value) {
  return escapeHtml(value).replaceAll("'", "&apos;");
}

function copyDirectory(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function toImportSpecifier(relativePath) {
  const normalized = relativePath.replaceAll(path.sep, "/");
  return normalized.startsWith(".") ? normalized : `./${normalized}`;
}
