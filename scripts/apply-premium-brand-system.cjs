"use strict";

const fs = require("node:fs");
const path = require("node:path");

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
  '<link rel="manifest" href="/site.webmanifest">\n    <link rel="stylesheet" href="/sonara-brand-system.css">\n    <title>${escapeHtml(title)} | SONARA Industries</title>`;'
);

source = source.replace(
  '  <body>\n    <header>',
  '  <body class="${escapeHtml(pageShellClass(title, heading, eyebrow))}">\n    <header>'
);

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

if (!source.includes("function pageShellClass(title")) {
  source = source.replace(
    'function renderHead(title) {',
    'function pageShellClass(title, heading, eyebrow) {\n  const text = `${title || ""} ${heading || ""} ${eyebrow || ""}`.toLowerCase();\n  if (text.includes("business builder")) return "shell-business-builder";\n  if (text.includes("creator studio") || text.includes("formula")) return text.includes("formula") ? "shell-formulas" : "shell-creator-studio";\n  if (text.includes("growth studio")) return "shell-growth-studio";\n  if (text.includes("admin") || text.includes("founder")) return "shell-admin";\n  if (text.includes("ecosystem")) return "shell-ecosystem";\n  return "shell-sonara";\n}\n\nfunction renderHead(title) {'
  );
}

fs.writeFileSync(serverPath, source);
console.log("Premium SONARA brand system wired into server.js with stable login redirects.");
