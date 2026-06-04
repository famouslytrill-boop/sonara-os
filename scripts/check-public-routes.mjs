import { failIfIssues, read } from "./check-utils.mjs";

const requiredPublicRoutes = [
  "/",
  "/about",
  "/pricing",
  "/trust",
  "/contact",
  "/support",
  "/help",
  "/feedback",
  "/legal",
  "/legal/terms",
  "/legal/privacy",
  "/legal/refund-policy",
  "/legal/acceptable-use",
  "/legal/cookie-policy",
  "/legal/accessibility",
  "/legal/security",
  "/legal/dpa",
  "/business-builder",
  "/creator-studio",
  "/growth-studio",
  "/research-lab",
  "/research-lab/open-source",
  "/research-lab/github-radar",
  "/open-source",
  "/status",
  "/docs",
  "/api-webhooks",
  "/integrations",
  "/changelog"
];

const requiredProtectedRoutes = [
  "/app",
  "/app/dashboard",
  "/app/settings",
  "/app/settings/readiness",
  "/app/admin",
  "/app/admin/email-readiness",
  "/app/admin/github-radar",
  "/app/admin/integrations",
  "/app/business-builder",
  "/app/creator-studio",
  "/app/growth-studio"
];

const manifest = read("packages/web/src/routes/route-manifest.ts");
const appRouter = read("packages/web/src/app.ts");
const buildPackage = read("scripts/build-package.mjs");
const publicMarketing = read("packages/web/src/lib/public-marketing/marketing-content.ts");

const issues = [];
for (const route of [...requiredPublicRoutes, ...requiredProtectedRoutes]) {
  if (!manifest.includes(`route: "${route}"`)) {
    issues.push(`Route manifest missing ${route}.`);
  }
  if (!appRouter.includes(`"${route}"`)) {
    issues.push(`App route normalizer/render table missing ${route}.`);
  }
}

for (const route of requiredPublicRoutes) {
  if (!buildPackage.includes(`"${route}"`)) {
    issues.push(`Sitemap source list missing public route ${route}.`);
  }
  if (!publicMarketing.includes(`"${route}"`)) {
    issues.push(`Public marketing route set missing ${route}.`);
  }
}

const legacyCreatorRouteBase = `/${"track"}${"foundry"}`;
for (const legacyRoute of [
  legacyCreatorRouteBase,
  `${legacyCreatorRouteBase}/app`,
  `${legacyCreatorRouteBase}/features`,
  `${legacyCreatorRouteBase}/how-it-works`,
  `${legacyCreatorRouteBase}/pricing`,
  `${legacyCreatorRouteBase}/resources`,
  `${legacyCreatorRouteBase}/security`,
  `${legacyCreatorRouteBase}/signup`
]) {
  if (!appRouter.includes(`["${legacyRoute}",`)) {
    issues.push(`Legacy compatibility redirect missing ${legacyRoute}.`);
  }
}

failIfIssues("Public route gate", issues);
