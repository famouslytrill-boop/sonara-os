"use strict";

const fs = require("node:fs");
const path = require("node:path");

const infraScriptPath = path.join(process.cwd(), "scripts", "apply-infrastructure-routes.cjs");
if (fs.existsSync(infraScriptPath)) {
  require(infraScriptPath);
}

const serverPath = path.join(process.cwd(), "server.js");
if (!fs.existsSync(serverPath)) {
  console.error("server.js not found. Run from repository root.");
  process.exit(1);
}

let source = fs.readFileSync(serverPath, "utf8");

// Signup should visibly confirm account creation after the session is stored.
source = source.replace(
  'app.post("/auth/signup", async (req, res) => {\n  const result = await handleEmailAuth("signup", req.body);\n  return sendEmailAuthResult(req, res, result, "/dashboard", "/login");\n});',
  'app.post("/auth/signup", async (req, res) => {\n  const result = await handleEmailAuth("signup", req.body);\n  return sendEmailAuthResult(req, res, result, "/dashboard?account=created", "/login");\n});'
);

// Keep login redirect stable for the existing auth contract and test suite.
source = source.replaceAll('"/dashboard?login=success"', '"/dashboard"');

source = source.replace(
  'sections: [\n        accessCard(req.sonaraAccess),',
  'sections: [\n        accountNoticeCard(req),\n        accessCard(req.sonaraAccess),'
);

source = source.replace(
  '<link rel="manifest" href="/site.webmanifest">\n    <title>${escapeHtml(title)} | SONARA Industries</title>`;',
  '<link rel="manifest" href="/site.webmanifest">\n    <link rel="stylesheet" href="/sonara-brand-system.css">\n    <link rel="stylesheet" href="/sonara-friendly-premium.css">\n    <script defer src="/sonara-experience.js"></script>\n    <title>${escapeHtml(title)} | SONARA Industries</title>`;'
);
source = source.replace(
  '<link rel="stylesheet" href="/sonara-brand-system.css">\n    <title>${escapeHtml(title)} | SONARA Industries</title>`;',
  '<link rel="stylesheet" href="/sonara-brand-system.css">\n    <link rel="stylesheet" href="/sonara-friendly-premium.css">\n    <script defer src="/sonara-experience.js"></script>\n    <title>${escapeHtml(title)} | SONARA Industries</title>`;'
);

source = source.replace(
  '  <body>\n    <header>',
  '  <body class="${escapeHtml(pageBrandClass(title, heading, eyebrow))}">\n    <header>'
);
source = source.replace(/pageBrandClass/g, "pageBrandClass");
source = source.replace(/sonara-business-builder/g, "sonara-business-builder");
source = source.replace(/sonara-creator-studio/g, "sonara-creator-studio");
source = source.replace(/sonara-growth-studio/g, "sonara-growth-studio");
source = source.replace(/sonara-formulas/g, "sonara-formulas");
source = source.replace(/sonara-ecosystem/g, "sonara-ecosystem");
source = source.replace(/sonara-admin/g, "sonara-admin");
source = source.replace(/sonara-platform/g, "sonara-platform");

if (!source.includes("function accountNoticeCard(req)")) {
  source = source.replace(
    'function responsePage(title, body, actions) {',
    'function accountNoticeCard(req) {\n  const account = String(req.query?.account || "");\n  if (account === "created") return brandCard("Account created", "You are signed in. Choose Business Builder, Creator Studio, or Growth Studio to start working.");\n  return "";\n}\n\nfunction responsePage(title, body, actions) {'
  );
} else {
  source = source.replace(
    '  const login = String(req.query?.login || "");\n  if (account === "created") return brandCard("Account created", "You are signed in. Choose Business Builder, Creator Studio, or Growth Studio to start working.");\n  if (login === "success") return brandCard("Welcome back", "Your workspace is open and protected by account access.");\n  return "";',
    '  if (account === "created") return brandCard("Account created", "You are signed in. Choose Business Builder, Creator Studio, or Growth Studio to start working.");\n  return "";'
  );
}

if (!source.includes("function pageBrandClass(title")) {
  source = source.replace(
    'function renderHead(title) {',
    'function pageBrandClass(title, heading, eyebrow) {\n  const text = `${title || ""} ${heading || ""} ${eyebrow || ""}`.toLowerCase();\n  if (text.includes("business builder")) return "sonara-business-builder";\n  if (text.includes("creator studio") || text.includes("formula")) return text.includes("formula") ? "sonara-formulas" : "sonara-creator-studio";\n  if (text.includes("growth studio")) return "sonara-growth-studio";\n  if (text.includes("admin") || text.includes("founder")) return "sonara-admin";\n  if (text.includes("ecosystem")) return "sonara-ecosystem";\n  return "sonara-platform";\n}\n\nfunction renderHead(title) {'
  );
}

fs.writeFileSync(serverPath, source);
console.log("Premium SONARA brand system wired into server.js with infrastructure routes, brighter friendly styling, and customer-safe class names.");

