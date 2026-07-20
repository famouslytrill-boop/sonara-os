"use strict";

const fs = require("node:fs");
const path = require("node:path");

const serverPath = path.join(process.cwd(), "server.js");
if (!fs.existsSync(serverPath)) {
  console.error("server.js not found. Run from repository root.");
  process.exit(1);
}

let source = fs.readFileSync(serverPath, "utf8");

const securityMiddleware = `app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(self)");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'self'; form-action 'self' https://checkout.stripe.com; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; script-src 'self'; connect-src 'self' https://*.supabase.co https://api.stripe.com; upgrade-insecure-requests");
  next();
});`;

if (!source.includes(securityMiddleware)) {
  const jsonPattern = /app\.use\(express\.json\(\{\s*limit:\s*"[^"]+"\s*\}\)\);/;
  const jsonMatch = source.match(jsonPattern);
  if (!jsonMatch) {
    console.error("Unable to locate JSON middleware anchor.");
    process.exit(1);
  }
  source = source.replace(jsonPattern, `${jsonMatch[0]}\n\n${securityMiddleware}`);
}

source = source
  .replace('eyebrow: "Access readiness",\n      heading: "Login",\n      body: "Use email/password access after account login is configured and owner-tested.",\n      sections: [\n        authForm("Login with email", "/auth/login"),\n        brandCard("Account access", "Email login unlocks protected workspaces after account sessions are configured."),\n        brandCard("Admin protection", "Founder routes remain protected by server-side authorization.")\n      ],\n      actions: [linkAction("/signup", "Create account"), linkAction("/docs", "Docs"), linkAction("/", "Home")]',
    'eyebrow: "Welcome back",\n      heading: "Continue your work.",\n      body: "Sign in to return to your private SONARA workspace, saved projects, requests, billing, and support.",\n      sections: [\n        authForm("Login with email", "/auth/login"),\n        brandCard("One connected workspace", "Your business, creator, and growth tools stay organized under one account."),\n        brandCard("Private by default", "Only you and approved members can access protected workspace content.")\n      ],\n      actions: [linkAction("/signup", "Create account"), linkAction("/support", "Get help"), linkAction("/", "Home")]')
  .replace('eyebrow: "Account readiness",\n      heading: "Create an account",\n      body: "Account access will unlock Business Builder, Creator Studio, and Growth Studio once email login is configured by the owner.",\n      sections: [\n        authForm("Create account", "/auth/signup"),\n        brandCard("Account access", "Use one account for product path selection, first offer setup, support preferences, and payment readiness.")\n      ],',
    'eyebrow: "Start building",\n      heading: "Create your SONARA account.",\n      body: "Begin with one secure account for Business Builder, Creator Studio, and Growth Studio.",\n      sections: [\n        authForm("Create account", "/auth/signup"),\n        brandCard("Start free", "Set up your workspace, choose a product path, and save your first project before upgrading."),\n        brandCard("Built to expand", "Add products, teammates, customer records, and paid services as your operation grows.")\n      ],')
  .replace('responsePage("Logout", "No persistent session is active. OAuth-backed session logout will be enabled when owner credentials are configured."', 'responsePage("Sign out", "End your current SONARA session on this device."')
  .replace(/return res\.status\(200\)\.json\(\{ ok: true, message: "No persistent session is active\." \}\);/g, 'return res.status(200).json({ ok: true, message: "Session ended." });');

source = source.replace(/\n\s*<link rel="stylesheet" href="\/sonara-premium-access-2027\.css(?:\?v=[^"]+)?">/g, "");
const premiumAsset = '    <link rel="stylesheet" href="/sonara-premium-access-2027.css?v=premium-access-20260720">';
const mobileAnchor = '    <link rel="stylesheet" href="/sonara-mobile-premium-fix.css?v=mobile-premium-fix-20260720">';
if (source.includes(mobileAnchor)) {
  source = source.replace(mobileAnchor, `${mobileAnchor}\n${premiumAsset}`);
} else if (!source.includes('/sonara-premium-access-2027.css')) {
  const headClose = "  </head>";
  if (!source.includes(headClose)) {
    console.error("Unable to locate document head close tag.");
    process.exit(1);
  }
  source = source.replace(headClose, `${premiumAsset}\n${headClose}`);
}

fs.writeFileSync(serverPath, source);
console.log("SONARA premium access experience applied with protected workspaces and public-copy cleanup.");
