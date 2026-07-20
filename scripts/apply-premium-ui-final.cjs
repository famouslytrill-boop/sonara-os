"use strict";

const fs = require("node:fs");
const path = require("node:path");

const serverPath = path.join(process.cwd(), "server.js");
if (!fs.existsSync(serverPath)) {
  console.error("server.js not found. Run from repository root.");
  process.exit(1);
}

let source = fs.readFileSync(serverPath, "utf8");
const version = "nexus-ui-20260720-v2";

function assembleAsset(sourceDirectory, outputPath) {
  const directory = path.join(process.cwd(), sourceDirectory);
  if (!fs.existsSync(directory)) {
    console.error(`Missing Nexus source directory: ${sourceDirectory}`);
    process.exit(1);
  }
  const files = fs.readdirSync(directory).filter((file) => /\.(?:css|js)$/.test(file)).sort();
  if (!files.length) {
    console.error(`No Nexus source modules found in ${sourceDirectory}`);
    process.exit(1);
  }
  const content = files.map((file) => fs.readFileSync(path.join(directory, file), "utf8")).join("\n");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content);
}

assembleAsset("ui/nexus/styles", path.join(process.cwd(), "public", "sonara-application-ui.css"));
assembleAsset("ui/nexus/scripts", path.join(process.cwd(), "public", "sonara-nexus.js"));
const prepaintPath = path.join(process.cwd(), "ui", "nexus", "prepaint.js");
if (!fs.existsSync(prepaintPath)) {
  console.error("Missing Nexus prepaint source.");
  process.exit(1);
}
fs.copyFileSync(prepaintPath, path.join(process.cwd(), "public", "sonara-prepaint.js"));

const homepageRenderer = `function renderNexusHomepage(readiness) {
  const proofItems = [
    { label: "Products", value: "Routes live", status: "ready" },
    { label: "Data", value: displayStatus(readiness.services.accountDatabase), status: readiness.services.accountDatabase },
    { label: "Payments", value: displayStatus(readiness.services.checkout), status: readiness.services.checkout },
    { label: "Support", value: readiness.services.accountDatabase === "configured" ? "Connected" : "Setup required", status: readiness.services.accountDatabase },
    { label: "Founder access", value: displayStatus(readiness.services.founderAccess), status: readiness.services.founderAccess }
  ];
  const proofMarkup = proofItems.map((item) => {
    const warning = ["ready", "configured", "enabled"].includes(String(item.status)) ? "" : " is-warning";
    return '<div class="nexus-proof-item"><b><span class="nexus-proof-dot' + warning + '"></span>' + escapeHtml(item.label) + '</b><span>' + escapeHtml(item.value) + '</span></div>';
  }).join("");
  return '<div class="nexus-home">' +
    '<section class="nexus-section" aria-labelledby="nexus-products-title">' +
      '<div class="nexus-section-head"><div><span class="nexus-kicker" data-i18n="productsKicker">Three operating modes</span><h2 id="nexus-products-title" data-i18n="productsHeading">One system. Three ways to move.</h2></div><p data-i18n="productsBody">Each workspace has its own rhythm, records, and tools while identity, billing, support, and delivery remain connected.</p></div>' +
      '<div class="nexus-product-grid">' +
        '<article class="nexus-product nexus-product--forge"><div class="nexus-product-meta"><img class="nexus-product-mark" src="/brand/business-builder-mark.svg" width="56" height="56" alt=""><span class="nexus-product-index">01 · OPERATE</span></div><h3>SONARA Forge</h3><p>Shape the offer, customer path, records, payment readiness, and operating rhythm without enterprise overhead.</p><a href="/business-builder/dashboard">Open Forge</a></article>' +
        '<article class="nexus-product nexus-product--canvas"><div class="nexus-product-meta"><img class="nexus-product-mark" src="/brand/creator-studio-mark.svg" width="56" height="56" alt=""><span class="nexus-product-index">02 · CREATE</span></div><h3>SONARA Canvas</h3><p>Organize assets, rights, releases, media systems, offers, and monetization in one responsive creative workspace.</p><a href="/creator-studio/dashboard">Open Canvas</a></article>' +
        '<article class="nexus-product nexus-product--signal"><div class="nexus-product-meta"><img class="nexus-product-mark" src="/brand/growth-studio-mark.svg" width="56" height="56" alt=""><span class="nexus-product-index">03 · REACH</span></div><h3>SONARA Signal</h3><p>Plan campaigns, manage leads, protect consent, review outcomes, and turn customer signals into the next useful action.</p><a href="/growth-studio/dashboard">Open Signal</a></article>' +
      '</div>' +
    '</section>' +
    '<section class="nexus-section nexus-flow" aria-labelledby="nexus-flow-title">' +
      '<div class="nexus-flow-copy"><span class="nexus-kicker" data-i18n="flowKicker">Designed for momentum</span><h2 id="nexus-flow-title" data-i18n="flowHeading">From intent to outcome without losing context.</h2><p>SONARA keeps the next action visible, separates free work from paid access, and never reports a save, payment, or delivery state unless the backend confirms it.</p><div class="card-actions"><a class="action" href="/start">See the operating model</a><a class="action" href="/requests">Track requests</a></div></div>' +
      '<div class="nexus-flow-list"><div class="nexus-flow-step"><strong>Choose the outcome</strong><small>Start from a product, a free tool, or a supported service.</small></div><div class="nexus-flow-step"><strong>Create useful work</strong><small>Complete one focused step with clear inputs and visible status.</small></div><div class="nexus-flow-step"><strong>Confirm the truth</strong><small>Database, billing, provider, and delivery states remain evidence-backed.</small></div><div class="nexus-flow-step"><strong>Keep momentum</strong><small>Return to saved records, requests, and deliverables without rebuilding context.</small></div></div>' +
    '</section>' +
    '<section class="nexus-section"><div class="nexus-proof"><span class="nexus-kicker" data-i18n="proofKicker">Live operational truth</span><h2 data-i18n="proofHeading">Fast when it can be. Honest when setup is required.</h2><p>Production readiness is surfaced as a real system state, not a decorative dashboard metric.</p><div class="nexus-proof-grid">' + proofMarkup + '</div><div class="card-actions"><a class="action" href="/readiness">Review readiness</a><a class="action" href="/security">Security posture</a></div></div></section>' +
    '<section class="nexus-cta" aria-label="Start using SONARA Nexus"><div><span class="nexus-kicker" data-i18n="ctaKicker">Start with the next useful action</span><h2 data-i18n="ctaHeading">Build something real before adding complexity.</h2><p>Explore the system for free. Upgrade only when saved work, deeper records, and operator support become valuable.</p></div><div class="card-actions"><a class="action" href="/signup">Start Free</a><a class="action" href="/free-tools">Try a free tool</a><a class="action" href="/pricing">See plans</a></div></section>' +
  '</div>';
}`;

source = source.replace(/\nfunction renderNexusHomepage\(readiness\) \{[\s\S]*?\n\}\n\napp\.get\("\/"/, `\n${homepageRenderer}\n\napp.get("/"`);
if (!source.includes("function renderNexusHomepage(readiness)")) {
  source = source.replace(/\napp\.get\("\/", \(req, res\) => \{/, `\n${homepageRenderer}\n\napp.get("/", (req, res) => {`);
}

const nexusRootRoute = `app.get("/", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "SONARA Industries",
      eyebrow: "Adaptive operating system",
      heading: "Make work move.",
      variant: "home",
      body: "Shape the business, create the release, reach the audience, and keep every next action connected through one fast operating layer.",
      sections: [renderNexusHomepage(getReadiness())],
      actions: [
        '<a class="action" href="/start" data-i18n="primaryAction">Enter SONARA Nexus</a>',
        '<a class="action" href="/free-tools" data-i18n="secondaryAction">Explore free tools</a>',
        '<a class="action" href="/pricing" data-i18n="tertiaryAction">See plans</a>'
      ]
    })
  );
});`;
const rootPattern = /app\.get\("\/", \(req, res\) => \{[\s\S]*?\n\}\);\n\nregisterProduct\("business-builder"/;
if (!rootPattern.test(source)) {
  console.error("Unable to locate root route.");
  process.exit(1);
}
source = source.replace(rootPattern, `${nexusRootRoute}\n\nregisterProduct("business-builder"`);

const navigationLinks = `
        <a href="/start" data-i18n="platform">Platform</a>
        <a href="/business-builder" data-i18n="forge">SONARA Forge</a>
        <a href="/creator-studio" data-i18n="canvas">SONARA Canvas</a>
        <a href="/growth-studio" data-i18n="signal">SONARA Signal</a>
        <a href="/free-tools" data-i18n="tools">Free tools</a>
        <a href="/pricing" data-i18n="pricing">Pricing</a>
        <a href="/support" data-i18n="support">Support</a>
        <a href="/login" data-i18n="login">Log in</a>
        <a class="sonara-nav-primary" href="/signup" data-i18n="start">Start Free</a>`;

const nexusHeader = `<header class="sonara-site-header">
      <a class="brand" href="/" aria-label="SONARA Industries home"><img class="sonara-brand-mark" src="/brand/sonara-industries-mark.svg" alt="" width="36" height="36"><span class="nexus-brand-copy"><strong>SONARA</strong><small>Nexus</small></span></a>
      <nav class="sonara-desktop-nav" aria-label="Primary">${navigationLinks}
      </nav>
      <div class="nexus-header-tools">
        <button type="button" class="nexus-icon-button" data-nexus-command aria-haspopup="dialog" aria-controls="nexus-command-dialog" aria-label="Open command navigation"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m14.5 14.5 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span class="nexus-tool-label" data-i18n="command">Command</span><kbd class="nexus-key">⌘K</kbd></button>
        <button type="button" class="nexus-icon-button" data-nexus-settings aria-haspopup="dialog" aria-controls="nexus-settings-dialog" aria-label="Open experience settings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M8 12h8M6 17h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="9" cy="7" r="2" fill="var(--nx-bg-elevated)" stroke="currentColor" stroke-width="1.5"/><circle cx="14" cy="12" r="2" fill="var(--nx-bg-elevated)" stroke="currentColor" stroke-width="1.5"/><circle cx="11" cy="17" r="2" fill="var(--nx-bg-elevated)" stroke="currentColor" stroke-width="1.5"/></svg><span class="nexus-tool-label" data-i18n="experience">Experience</span></button>
      </div>
      <details class="sonara-mobile-menu">
        <summary aria-label="Open navigation" data-i18n="menu">Menu</summary>
        <nav aria-label="Mobile primary">${navigationLinks}
        </nav>
      </details>
    </header>`;
const layoutAnchor = 'function layout({ title, eyebrow, heading, body, sections, actions, variant = "standard" }) {\n  const brandClass = pageBrandClass(title, heading, eyebrow);';
const nexusLayoutStart = `function rebrandNexusCopy(value) {
  return String(value ?? "")
    .replace(/\bBusiness Builder\b/g, "SONARA Forge")
    .replace(/\bCreator Studio\b/g, "SONARA Canvas")
    .replace(/\bGrowth Studio\b/g, "SONARA Signal");
}

function layout({ title, eyebrow, heading, body, sections, actions, variant = "standard" }) {
  const brandClass = pageBrandClass(title, heading, eyebrow);
  title = rebrandNexusCopy(title);
  eyebrow = rebrandNexusCopy(eyebrow);
  heading = rebrandNexusCopy(heading);
  body = rebrandNexusCopy(body);
  sections = (sections || []).map(rebrandNexusCopy);
  actions = (actions || []).map(rebrandNexusCopy);`;
if (source.includes(layoutAnchor) && !source.includes("function rebrandNexusCopy(value)")) source = source.replace(layoutAnchor, nexusLayoutStart);

source = source.replace(/<header(?:\s[^>]*)?>[\s\S]*?<\/header>/, nexusHeader);

source = source
  .replace(/\n\s*<script data-sonara-theme-prepaint>[\s\S]*?<\/script>/, "")
  .replace(/\n\s*<style>[\s\S]*?<\/style>/, "")
  .replace(/\n\s*<link rel="stylesheet" href="\/(?:sonara-brand-system|sonara-friendly-premium|sonara-interface-engine|sonara-launch-ui|sonara-cohesive-2027|sonara-cohesive-2027-base|sonara-builder-2027|sonara-premium-mobile-fix|sonara-premium-access-2027|sonara-premium-ux|sonara-premium-mobile-final|sonara-application-ui)\.css(?:\?v=[^"]+)?">/g, "")
  .replace(/\n\s*<script defer src="\/(?:sonara-experience|sonara-interface-engine|sonara-cohesive-2027|sonara-builder-2027|sonara-nexus)\.js(?:\?v=[^"]+)?"><\/script>/g, "")
  .replace(/ data-sonara-interface="live"/g, "")
  .replace(/\n\s*\$\{variant === "home" \? `<aside class="sonara-interface-face"[\s\S]*?<\/aside>` : ""\}/, "")
  .replace(/\n\s*<nav class="sonara-quick-bar" aria-label="Quick actions">[\s\S]*?<\/nav>/, "");

source = source
  .replace('<div class="eyebrow">${escapeHtml(eyebrow)}</div>', '<div class="eyebrow"${variant === "home" ? \' data-i18n="heroEyebrow"\' : ""}>${escapeHtml(eyebrow)}</div>')
  .replace('<h1>${escapeHtml(heading)}</h1>', '<h1${variant === "home" ? \' data-i18n="heroHeading"\' : ""}>${escapeHtml(heading)}</h1>')
  .replace('<p class="lede">${escapeHtml(body)}</p>', '<p class="lede"${variant === "home" ? \' data-i18n="heroBody"\' : ""}>${escapeHtml(body)}</p>');

const loaderMarkup = `<div id="nexus-loader" class="nexus-loader" role="status" aria-live="polite"><div class="nexus-loader__core"><img class="nexus-loader__mark" src="/brand/sonara-industries-mark.svg" alt=""><div class="nexus-loader__track" aria-hidden="true"></div><span class="nexus-loader__label">SONARA NEXUS</span></div></div><div class="nexus-route-progress" aria-hidden="true"></div>`;
source = source.replace(/(<body class="\$\{escapeHtml\(brandClass\)\} \$\{variant === "home" \? "sonara-home-v3" : "sonara-standard-page"\}">)/, `$1\n    ${loaderMarkup}`);

const dialogsMarkup = `<dialog id="nexus-command-dialog" class="nexus-dialog" aria-labelledby="nexus-command-title"><div class="nexus-dialog__head"><strong id="nexus-command-title" data-i18n="command">Command</strong><button type="button" class="nexus-dialog__close" data-dialog-close aria-label="Close">×</button></div><div class="nexus-command-input"><label for="nexus-command-search">Navigate</label><input id="nexus-command-search" type="search" autocomplete="off" data-i18n="searchPlaceholder" placeholder="Search pages and actions"></div><ul class="nexus-command-list"></ul></dialog>
    <dialog id="nexus-settings-dialog" class="nexus-dialog" aria-labelledby="nexus-settings-title"><div class="nexus-dialog__head"><strong id="nexus-settings-title" data-i18n="settingsTitle">Experience settings</strong><button type="button" class="nexus-dialog__close" data-dialog-close aria-label="Close">×</button></div><div class="nexus-settings"><label class="nexus-setting-row"><span><b data-i18n="language">Language</b><small data-i18n="languageHelp">Updates the interface shell and core product language.</small></span><select data-nexus-preference="language" aria-label="Language"><option value="en" lang="en">English</option><option value="es" lang="es">Español</option><option value="fr" lang="fr">Français</option><option value="de" lang="de">Deutsch</option></select></label><label class="nexus-setting-row"><span><b data-i18n="appearance">Appearance</b><small data-i18n="appearanceHelp">Follow your device or choose light or dark.</small></span><select data-nexus-preference="theme" aria-label="Appearance"><option value="system" data-i18n="system">System</option><option value="light" data-i18n="light">Light</option><option value="dark" data-i18n="dark">Dark</option></select></label><label class="nexus-setting-row"><span><b data-i18n="motion">Motion</b><small data-i18n="motionHelp">Purposeful transitions, never required to understand status.</small></span><input class="nexus-toggle" type="checkbox" data-nexus-preference="motion" aria-label="Motion"></label><label class="nexus-setting-row"><span><b data-i18n="sound">Sound feedback</b><small data-i18n="soundHelp">Original synthesized SONARA tones. Off by default.</small></span><input class="nexus-toggle" type="checkbox" data-nexus-preference="sound" aria-label="Sound feedback"></label><label class="nexus-setting-row"><span><b data-i18n="haptics">Tactile feedback</b><small data-i18n="hapticsHelp">Uses device vibration only where the browser supports it.</small></span><input class="nexus-toggle" type="checkbox" data-nexus-preference="haptics" aria-label="Tactile feedback"></label></div></dialog>
    <div id="nexus-live" class="nexus-live" aria-live="polite" aria-atomic="true"></div>`;
source = source
  .replace(/\n\s*<script>\s*document\.querySelectorAll\("\[data-toggle-password\]"\)[\s\S]*?<\/script>/, "")
  .replace(/\n\s*<\/body>/, `\n    ${dialogsMarkup}\n  </body>`);

source = source
  .replace(/SONARA Industries builds launch infrastructure for Business Builder, Creator Studio, and Growth Studio\./g, "SONARA Industries connects SONARA Forge, SONARA Canvas, and SONARA Signal through one adaptive operating layer.")
  .replace(/>Business Builder<\/a>/g, ">SONARA Forge</a>")
  .replace(/>Creator Studio<\/a>/g, ">SONARA Canvas</a>")
  .replace(/>Growth Studio<\/a>/g, ">SONARA Signal</a>");

const staticAnchor = 'app.use(express.static(path.join(__dirname, "public")));';
const noStoreMiddleware = `${staticAnchor}\napp.use((req, res, next) => {\n  if (req.method === "GET" && !path.extname(req.path)) {\n    res.set("Cache-Control", "no-store, max-age=0");\n  }\n  next();\n});`;
if (source.includes(staticAnchor) && !source.includes('Cache-Control", "no-store, max-age=0')) source = source.replace(staticAnchor, noStoreMiddleware);

const assets = `    <script src="/sonara-prepaint.js?v=${version}"></script>\n    <link rel="stylesheet" href="/sonara-application-ui.css?v=${version}">\n    <script defer src="/sonara-nexus.js?v=${version}"></script>`;
const headClose = "  </head>";
if (!source.includes(headClose)) {
  console.error("Unable to locate document head close tag.");
  process.exit(1);
}
source = source.replace(headClose, `${assets}\n${headClose}`);

fs.writeFileSync(serverPath, source);
console.log("SONARA Nexus experience engine applied: original branding, cinematic motion, localization, feedback preferences, and responsive interaction shell.");
