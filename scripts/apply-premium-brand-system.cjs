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

source = source.replace(
  'app.post("/auth/signup", async (req, res) => {\n  const result = await handleEmailAuth("signup", req.body);\n  return sendEmailAuthResult(req, res, result, "/dashboard", "/login");\n});',
  'app.post("/auth/signup", async (req, res) => {\n  const result = await handleEmailAuth("signup", req.body);\n  return sendEmailAuthResult(req, res, result, "/dashboard?account=created", "/login");\n});'
);

source = source.replaceAll('"/dashboard?login=success"', '"/dashboard"');

source = source.replace(
  'sections: [\n        accessCard(req.sonaraAccess),',
  'sections: [\n        accountNoticeCard(req),\n        accessCard(req.sonaraAccess),'
);

source = source
  .replace(/\n\s*<link rel="stylesheet" href="\/sonara-brand-system\.css">/g, "")
  .replace(/\n\s*<link rel="stylesheet" href="\/sonara-friendly-premium\.css">/g, "")
  .replace(/\n\s*<script defer src="\/sonara-experience\.js"><\/script>/g, "");

if (!source.includes('href="/sonara-friendly-premium.css"')) {
  source = source.replace(
    '    </style>\n  </head>',
    '    </style>\n    <link rel="stylesheet" href="/sonara-brand-system.css">\n    <link rel="stylesheet" href="/sonara-friendly-premium.css">\n    <script defer src="/sonara-experience.js"></script>\n  </head>'
  );
}

source = source.replace(
  '  <body>\n    <header>',
  '  <body class="${escapeHtml(pageBrandClass(title, heading, eyebrow))}">\n    <header>'
);
source = source.replace(/pageShellClass/g, "pageBrandClass");
source = source.replace(/shell-business-builder/g, "sonara-business-builder");
source = source.replace(/shell-creator-studio/g, "sonara-creator-studio");
source = source.replace(/shell-growth-studio/g, "sonara-growth-studio");
source = source.replace(/shell-formulas/g, "sonara-formulas");
source = source.replace(/shell-ecosystem/g, "sonara-ecosystem");
source = source.replace(/shell-admin/g, "sonara-admin");
source = source.replace(/shell-sonara/g, "sonara-platform");

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
console.log("Premium SONARA brand system wired after base styles so the brighter interface loads correctly.");
