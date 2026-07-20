"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const serverPath = path.join(root, "server.js");
const version = "nexus-ui-20260720-v3";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function assemble(directory, output) {
  const sourceDirectory = path.join(root, directory);
  if (!fs.existsSync(sourceDirectory)) fail(`Missing ${directory}`);
  const files = fs.readdirSync(sourceDirectory).filter((file) => /\.(css|js)$/.test(file)).sort();
  if (!files.length) fail(`No source modules in ${directory}`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, files.map((file) => fs.readFileSync(path.join(sourceDirectory, file), "utf8")).join("\n"));
}

if (!fs.existsSync(serverPath)) fail("server.js not found");
assemble("ui/nexus/styles", path.join(root, "public", "sonara-application-ui.css"));
assemble("ui/nexus/scripts", path.join(root, "public", "sonara-nexus.js"));
const prepaint = path.join(root, "ui", "nexus", "prepaint.js");
if (!fs.existsSync(prepaint)) fail("Missing Nexus prepaint source");
fs.copyFileSync(prepaint, path.join(root, "public", "sonara-prepaint.js"));

let source = fs.readFileSync(serverPath, "utf8");

const nav = `
        <a href="/start" data-i18n="platform">Platform</a>
        <a href="/business-builder" data-i18n="businessBuilder">Business Builder</a>
        <a href="/creator-studio" data-i18n="creatorStudio">Creator Studio</a>
        <a href="/growth-studio" data-i18n="growthStudio">Growth Studio</a>
        <a href="/free-tools" data-i18n="tools">Free tools</a>
        <a href="/pricing" data-i18n="pricing">Pricing</a>
        <a href="/support" data-i18n="support">Support</a>
        <a href="/login" data-i18n="login">Log in</a>
        <a class="sonara-nav-primary" href="/signup" data-i18n="start">Start Free</a>`;

const header = `<header class="sonara-site-header">
      <a class="brand" href="/" aria-label="SONARA Industries home"><img class="sonara-brand-mark" src="/brand/sonara-industries-mark.svg" alt="" width="36" height="36"><span class="nexus-brand-copy"><strong>SONARA Industries</strong><small>Nexus</small></span></a>
      <nav class="sonara-desktop-nav" aria-label="Primary">${nav}
      </nav>
      <div class="nexus-header-tools">
        <button type="button" class="nexus-icon-button" data-nexus-command aria-haspopup="dialog" aria-controls="nexus-command-dialog" aria-label="Open command navigation"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m14.5 14.5 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span class="nexus-tool-label" data-i18n="command">Command</span><kbd class="nexus-key">⌘K</kbd></button>
        <button type="button" class="nexus-icon-button" data-nexus-settings aria-haspopup="dialog" aria-controls="nexus-settings-dialog" aria-label="Open experience settings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M8 12h8M6 17h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span class="nexus-tool-label" data-i18n="experience">Experience</span></button>
      </div>
      <details class="sonara-mobile-menu"><summary aria-label="Open navigation" data-i18n="menu">Menu</summary><nav aria-label="Mobile primary">${nav}
      </nav></details>
    </header>`;

const homeContent = `<div class="nexus-home">
  <section class="nexus-section"><div class="nexus-section-head"><div><span class="nexus-kicker" data-i18n="productsKicker">Three connected companies</span><h2 data-i18n="productsHeading">One operating layer. Three focused workspaces.</h2></div><p data-i18n="productsBody">Business Builder, Creator Studio, and Growth Studio keep their own tools and records while identity, billing, support, and delivery stay connected through SONARA Nexus.</p></div>
    <div class="nexus-product-grid">
      <article class="nexus-product nexus-product--forge"><div class="nexus-product-meta"><img class="nexus-product-mark" src="/brand/business-builder-mark.svg" alt=""><span class="nexus-product-index">FORGE MODE · OPERATE</span></div><h3>Business Builder</h3><p>Shape the offer, customer path, records, payment readiness, and operating rhythm.</p><a href="/business-builder/dashboard">Open Business Builder</a></article>
      <article class="nexus-product nexus-product--canvas"><div class="nexus-product-meta"><img class="nexus-product-mark" src="/brand/creator-studio-mark.svg" alt=""><span class="nexus-product-index">CANVAS MODE · CREATE</span></div><h3>Creator Studio</h3><p>Organize assets, rights, releases, media systems, offers, and monetization.</p><a href="/creator-studio/dashboard">Open Creator Studio</a></article>
      <article class="nexus-product nexus-product--signal"><div class="nexus-product-meta"><img class="nexus-product-mark" src="/brand/growth-studio-mark.svg" alt=""><span class="nexus-product-index">SIGNAL MODE · REACH</span></div><h3>Growth Studio</h3><p>Plan campaigns, manage leads, protect consent, and learn from real outcomes.</p><a href="/growth-studio/dashboard">Open Growth Studio</a></article>
    </div>
  </section>
  <section class="nexus-section nexus-flow"><div class="nexus-flow-copy"><span class="nexus-kicker" data-i18n="flowKicker">Designed for momentum</span><h2 data-i18n="flowHeading">From intent to outcome without losing context.</h2><p>SONARA is Software-in-a-Service built around evidence-backed next actions, saved records, payments, requests, and deliverables.</p><div class="card-actions"><a class="action" href="/start">See the operating model</a><a class="action" href="/service-catalog">Service catalog</a><a class="action" href="/requests">Track requests</a><a class="action" href="/deliverables">Deliverables</a></div></div><div class="nexus-flow-list"><div class="nexus-flow-step"><strong>Choose the outcome</strong><small>Start from a company, free tool, or supported service.</small></div><div class="nexus-flow-step"><strong>Create useful work</strong><small>Complete one focused step with clear inputs.</small></div><div class="nexus-flow-step"><strong>Confirm the truth</strong><small>Billing, database, and delivery states remain real.</small></div><div class="nexus-flow-step"><strong>Keep momentum</strong><small>Return without rebuilding context.</small></div></div></section>
  <section class="nexus-section sonara-status-panel" aria-label="Company quick access and readiness"><div class="nexus-section-head"><div><span class="nexus-kicker">Quick access</span><h2>Move directly into the work.</h2></div><p>Provider-dependent workflows show <strong>Setup required</strong> only when a real connection or configuration is unavailable.</p></div><div class="nexus-product-grid"><article class="card"><h3>Business Builder</h3><div class="card-actions"><a class="action" href="/business-builder/dashboard">Dashboard</a><a class="action" href="/business-builder/intake">Intake</a></div></article><article class="card"><h3>Creator Studio</h3><div class="card-actions"><a class="action" href="/creator-studio/assets">Assets</a><a class="action" href="/creator-studio/music-system">Music system</a></div></article><article class="card"><h3>Growth Studio</h3><div class="card-actions"><a class="action" href="/growth-studio/campaigns">Campaigns</a><a class="action" href="/growth-studio/leads">Leads</a></div></article></div></section>
  <section class="nexus-cta"><div><span class="nexus-kicker" data-i18n="ctaKicker">Start with the next useful action</span><h2 data-i18n="ctaHeading">Build something real before adding complexity.</h2><p>Explore for free. Upgrade when saved work, deeper records, and support become valuable.</p></div><div class="card-actions"><a class="action" href="/signup">Start Free</a><a class="action" href="/free-tools">Try a free tool</a><a class="action" href="/pricing">See plans</a></div></section>
</div>`;

const rootRoute = `app.get("/", (req, res) => {
  return res.status(200).type("html").send(layout({
    title: "SONARA Industries",
    eyebrow: "LAUNCH OPERATING SYSTEM",
    heading: "Make work move.",
    variant: "home",
    body: "Business Builder, Creator Studio, and Growth Studio connect through one fast operating layer for founders, creators, and small teams.",
    sections: [${JSON.stringify(homeContent)}],
    actions: [linkAction("/start", "Enter SONARA Nexus"), linkAction("/free-tools", "Explore free tools"), linkAction("/pricing", "See plans")]
  }));
});`;

source = source
  .replace(/\n\s*<div id="nexus-loader"[\s\S]*?<div class="nexus-route-progress"[^>]*><\/div>/g, "")
  .replace(/\n\s*<dialog id="nexus-command-dialog"[\s\S]*?<div id="nexus-live"[^>]*><\/div>/g, "")
  .replace(/\s*\$\{variant === "home" \? `<aside class="sonara-interface-face"[\s\S]*?<\/aside>` : ""\}/g, "")
  .replace(/\s*<aside class="sonara-interface-face"[\s\S]*?<\/aside>/g, "")
  .replace(/\s*<nav class="sonara-quick-bar"[\s\S]*?<\/nav>/g, "")
  .replace(/\s*<button[^>]*class="[^"]*sonara-command-button[^"]*"[\s\S]*?<\/button>/g, "")
  .replace(/ data-sonara-interface="live"/g, "");

source = source.replace(/app\.get\("\/", \(req, res\) => \{[\s\S]*?\n\}\);\n\nregisterProduct\("business-builder"/, `${rootRoute}\n\nregisterProduct("business-builder"`);
source = source.replace(/<header(?:\s[^>]*)?>[\s\S]*?<\/header>/, header);
source = source
  .replace(/\n\s*<script data-sonara-theme-prepaint>[\s\S]*?<\/script>/, "")
  .replace(/\n\s*<style>[\s\S]*?<\/style>/, "")
  .replace(/\n\s*<link rel="stylesheet" href="\/sonara-[^"]+\.css(?:\?v=[^"]+)?">/g, "")
  .replace(/\n\s*<script(?: defer)? src="\/sonara-[^"]+\.js(?:\?v=[^"]+)?"><\/script>/g, "")
  .replace(/\n\s*<script>\s*document\.querySelectorAll\("\[data-toggle-password\]"\)[\s\S]*?<\/script>/, "");

source = source
  .replace('<div class="eyebrow">${escapeHtml(eyebrow)}</div>', '<div class="eyebrow"${variant === "home" ? \' data-i18n="heroEyebrow"\' : ""}>${escapeHtml(eyebrow)}</div>')
  .replace('<h1>${escapeHtml(heading)}</h1>', '<h1${variant === "home" ? \' data-i18n="heroHeading"\' : ""}>${escapeHtml(heading)}</h1>')
  .replace('<p class="lede">${escapeHtml(body)}</p>', '<p class="lede"${variant === "home" ? \' data-i18n="heroBody"\' : ""}>${escapeHtml(body)}</p>')
  .replace('<main id="sonara-main">', '<main id="sonara-main" data-sonara-interface="live" data-layout-contract="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); overflow-wrap: anywhere; word-break: break-word">');

const loader = `<div id="nexus-loader" class="nexus-loader" role="status" aria-live="polite"><div class="nexus-loader__core"><img class="nexus-loader__mark" src="/brand/sonara-industries-mark.svg" alt=""><div class="nexus-loader__track" aria-hidden="true"></div><span class="nexus-loader__label">SONARA NEXUS</span></div></div><div class="nexus-route-progress" aria-hidden="true"></div>`;
source = source.replace(/(<body class="\$\{escapeHtml\(brandClass\)\} \$\{variant === "home" \? "sonara-home-v3" : "sonara-standard-page"\}">)/, `$1\n    ${loader}`);

const dialogs = `<dialog id="nexus-command-dialog" class="nexus-dialog" aria-labelledby="nexus-command-title"><div class="nexus-dialog__head"><strong id="nexus-command-title">Command</strong><button type="button" class="nexus-dialog__close" data-dialog-close aria-label="Close">×</button></div><div class="nexus-command-input"><label for="nexus-command-search">Navigate</label><input id="nexus-command-search" type="search" data-i18n="searchPlaceholder" placeholder="Search pages and actions"></div><ul class="nexus-command-list"></ul></dialog><dialog id="nexus-settings-dialog" class="nexus-dialog" aria-labelledby="nexus-settings-title"><div class="nexus-dialog__head"><strong id="nexus-settings-title" data-i18n="settingsTitle">Experience settings</strong><button type="button" class="nexus-dialog__close" data-dialog-close aria-label="Close">×</button></div><div class="nexus-settings"><label class="nexus-setting-row"><span><b data-i18n="language">Language</b><small data-i18n="languageHelp">Updates the interface and core product language.</small></span><select data-nexus-preference="language"><option value="en" lang="en">English</option><option value="es" lang="es">Español</option><option value="fr" lang="fr">Français</option><option value="de" lang="de">Deutsch</option></select></label><label class="nexus-setting-row"><span><b data-i18n="appearance">Appearance</b><small data-i18n="appearanceHelp">Follow your device or choose light or dark.</small></span><select data-nexus-preference="theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label class="nexus-setting-row"><span><b data-i18n="motion">Motion</b></span><input type="checkbox" data-nexus-preference="motion"></label><label class="nexus-setting-row"><span><b data-i18n="sound">Sound feedback</b></span><input type="checkbox" data-nexus-preference="sound"></label><label class="nexus-setting-row"><span><b data-i18n="haptics">Tactile feedback</b></span><input type="checkbox" data-nexus-preference="haptics"></label></div></dialog><div id="nexus-live" class="nexus-live" aria-live="polite"></div>`;
source = source.replace(/\n\s*<\/body>/, `\n    ${dialogs}\n  </body>`);

const staticAnchor = 'app.use(express.static(path.join(__dirname, "public")));';
if (source.includes(staticAnchor) && !source.includes('Cache-Control", "no-store, max-age=0')) {
  source = source.replace(staticAnchor, `${staticAnchor}\napp.use((req, res, next) => { if (req.method === "GET" && !path.extname(req.path)) res.set("Cache-Control", "no-store, max-age=0"); next(); });`);
}

const assets = `    <script src="/sonara-prepaint.js?v=${version}"></script>\n    <link rel="stylesheet" href="/sonara-application-ui.css?v=${version}">\n    <script defer src="/sonara-nexus.js?v=${version}"></script>`;
if (!source.includes("  </head>")) fail("Unable to locate document head");
source = source.replace("  </head>", `${assets}\n  </head>`);
fs.writeFileSync(serverPath, source);
console.log("SONARA Nexus experience engine applied.");
