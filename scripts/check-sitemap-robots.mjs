import fs from "node:fs";
import path from "node:path";
import { failIfIssues, read, repoPath } from "./check-utils.mjs";

const routes = [
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
  "/legal/security",
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

const issues = [];
const buildSource = read("scripts/build-package.mjs");
const indexHtml = read("packages/web/src/index.html");

for (const route of routes) {
  if (!buildSource.includes(`"${route}"`)) {
    issues.push(`Build sitemap source missing ${route}.`);
  }
}

for (const requiredHtml of [
  "<title>SONARA Industries</title>",
  'rel="canonical"',
  'rel="icon"',
  'rel="manifest"',
  'property="og:title"',
  'name="twitter:card"'
]) {
  if (!indexHtml.includes(requiredHtml)) {
    issues.push(`Web index metadata missing ${requiredHtml}.`);
  }
}

const distDir = repoPath("packages/web/dist");
const robotsPath = path.join(distDir, "robots.txt");
const sitemapPath = path.join(distDir, "sitemap.xml");
if (fs.existsSync(distDir)) {
  if (!fs.existsSync(robotsPath)) {
    issues.push("Built web dist is missing robots.txt.");
  } else {
    const robots = fs.readFileSync(robotsPath, "utf8");
    if (!robots.includes("Sitemap: https://sonaraindustries.com/sitemap.xml")) {
      issues.push("robots.txt must point to the production sitemap URL.");
    }
    if (robots.includes("localhost")) {
      issues.push("robots.txt must not contain localhost.");
    }
  }
  if (!fs.existsSync(sitemapPath)) {
    issues.push("Built web dist is missing sitemap.xml.");
  } else {
    const sitemap = fs.readFileSync(sitemapPath, "utf8");
    for (const route of routes) {
      if (!sitemap.includes(`https://sonaraindustries.com${route === "/" ? "/" : route}`)) {
        issues.push(`Built sitemap missing ${route}.`);
      }
    }
    if (sitemap.includes("localhost")) {
      issues.push("sitemap.xml must not contain localhost.");
    }
  }
}

failIfIssues("Sitemap and robots gate", issues);
