"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const serverPath = path.join(root, "server.js");
const version = "sonara-ui-20260725-v5";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function assemble(directory, output) {
  const sourceDirectory = path.join(root, directory);
  if (!fs.existsSync(sourceDirectory)) fail(`Missing ${directory}`);
  const allFiles = fs.readdirSync(sourceDirectory).filter((file) => /\.(css|js)$/.test(file)).sort();
  if (!allFiles.length) fail(`No source modules in ${directory}`);
  const canonicalFiles = allFiles.filter((file) => /^99-/.test(file));
  const files = canonicalFiles.length ? canonicalFiles : allFiles;
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, files.map((file) => fs.readFileSync(path.join(sourceDirectory, file), "utf8")).join("\n"));
}

if (!fs.existsSync(serverPath)) fail("server.js not found");
assemble("ui/sonara/styles", path.join(root, "public", "sonara-application-ui.css"));
assemble("ui/sonara/scripts", path.join(root, "public", "sonara-one.js"));
const prepaint = path.join(root, "ui", "sonara", "prepaint.js");
if (!fs.existsSync(prepaint)) fail("Missing SONARA One prepaint source");
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
        <a class="sonara-nav-primary" href="/signup" data-i18n="start">Create account</a>`;

const accountMenu = `<details class="sonara-account-menu">
        <summary aria-label="Open account navigation">Account</summary>
        <div class="sonara-account-panel">
          <a href="/dashboard" data-i18n="dashboard">Dashboard</a>
          <a href="/account">Account</a>
          <a href="/settings" data-i18n="settings">Settings</a>
          <a href="/admin/login" data-i18n="admin">Administration</a>
          <form method="post" action="/logout"><button type="submit" data-i18n="logout">Log out</button></form>
        </div>
      </details>`;

const header = `<header class="sonara-site-header">
      <a class="brand" href="/" aria-label="SONARA Industries home"><img class="sonara-brand-mark" src="/brand/sonara-industries-mark.svg" alt="" width="40" height="40"><span class="sonara-brand-copy"><strong>SONARA Industries</strong><small>SONARA One</small></span></a>
      <nav class="sonara-desktop-nav" aria-label="Primary">${nav}
      </nav>
      <div class="sonara-header-tools">
        <button type="button" class="sonara-icon-button" data-sonara-command aria-haspopup="dialog" aria-controls="sonara-command-dialog" aria-label="Open command navigation"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m14.5 14.5 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span class="sonara-tool-label" data-i18n="command">Command</span><kbd class="sonara-key">⌘K</kbd></button>
        <button type="button" class="sonara-icon-button" data-sonara-settings aria-haspopup="dialog" aria-controls="sonara-settings-dialog" aria-label="Open experience settings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M8 12h8M6 17h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span class="sonara-tool-label" data-i18n="experience">Experience</span></button>
        ${accountMenu}
      </div>
      <details class="sonara-mobile-menu"><summary aria-label="Open navigation" data-i18n="menu">Menu</summary><nav aria-label="Mobile primary">${nav}
        <a href="/dashboard" data-i18n="dashboard">Dashboard</a>
        <a href="/settings" data-i18n="settings">Settings</a>
        <a href="/admin/login" data-i18n="admin">Administration</a>
      </nav></details>
    </header>`;

const homeContent = `<div class="sonara-home">
  <section class="sonara-section">
    <div class="sonara-section-head"><div><span class="sonara-kicker" data-i18n="productsKicker">Three connected companies</span><h2 data-i18n="productsHeading">One system. Three focused ways to move.</h2></div><p data-i18n="productsBody">Choose the workspace that matches the work. SONARA One keeps the account, evidence, and next action connected.</p></div>
    <div class="sonara-product-grid">
      <article class="sonara-product sonara-product--forge"><div class="sonara-product-meta"><img class="sonara-product-mark" src="/brand/business-builder-mark.svg" alt=""><span class="sonara-product-index">FORGE · OPERATE</span></div><h3>Business Builder</h3><p>Launch offers, organize customers, manage staff, inventory, menus, payments, locations, and daily operations.</p><a href="/business-builder/dashboard">Open Business Builder</a></article>
      <article class="sonara-product sonara-product--canvas"><div class="sonara-product-meta"><img class="sonara-product-mark" src="/brand/creator-studio-mark.svg" alt=""><span class="sonara-product-index">CANVAS · CREATE</span></div><h3>Creator Studio</h3><p>Develop artist systems, songs, prompt packs, assets, releases, media, rights checks, and export packages.</p><a href="/creator-studio/dashboard">Open Creator Studio</a></article>
      <article class="sonara-product sonara-product--signal"><div class="sonara-product-meta"><img class="sonara-product-mark" src="/brand/growth-studio-mark.svg" alt=""><span class="sonara-product-index">SIGNAL · GROW</span></div><h3>Growth Studio</h3><p>Plan consent-safe campaigns, leads, showcases, venues, promotions, follow-up, experiments, and conversion.</p><a href="/growth-studio/dashboard">Open Growth Studio</a></article>
    </div>
  </section>

  <section class="sonara-section sonara-flow">
    <div><span class="sonara-kicker" data-i18n="flowKicker">Designed for real operations</span><h2 data-i18n="flowHeading">Move from intention to evidence-backed action.</h2><p>SONARA is Software-in-a-Service built around identity, organization access, saved records, billing, requests, delivery, and support—without inventing activity or hiding setup requirements.</p><div class="card-actions"><a class="action" href="/start">See how SONARA One works</a><a class="action" href="/service-catalog">Service catalog</a><a class="action" href="/readiness">Readiness</a><a class="action" href="/requests">Requests</a><a class="action" href="/deliverables">Deliverables</a></div></div>
    <div class="sonara-flow-list"><div class="sonara-flow-step"><strong>Choose the outcome</strong><small>Enter the company that matches the work.</small></div><div class="sonara-flow-step"><strong>Complete one clear action</strong><small>Focused screens replace overloaded dashboards.</small></div><div class="sonara-flow-step"><strong>Confirm the real state</strong><small>Ready, setup required, permission required, or review required.</small></div><div class="sonara-flow-step"><strong>Return without rebuilding context</strong><small>Records, activity, billing, and support stay connected.</small></div></div>
  </section>

  <section class="sonara-section" aria-labelledby="operations-heading">
    <div class="sonara-section-head"><div><span class="sonara-kicker">Independent business operations</span><h2 id="operations-heading">Built for the places where work actually happens.</h2></div><p>Restaurants, bars, food trucks, service businesses, studios, venues, and independent teams can use focused tools without pretending to be an enterprise.</p></div>
    <div class="sonara-operations-strip"><div class="sonara-operation"><strong>Sell and fulfill</strong><small>Offers, orders, payments, appointments, POS-ready workflows, and delivery status.</small></div><div class="sonara-operation"><strong>Run the floor</strong><small>Menus, recipes, inventory, vendors, staff, shifts, locations, and assets.</small></div><div class="sonara-operation"><strong>Create and release</strong><small>Music projects, tracks, stems, artist systems, rights checks, media, and packages.</small></div><div class="sonara-operation"><strong>Reach and learn</strong><small>Campaigns, leads, consent, venues, showcases, promotions, and evidence.</small></div></div>
  </section>

  <section class="sonara-section sonara-status-panel" aria-label="Truthful readiness">
    <div class="sonara-section-head"><div><span class="sonara-kicker">Truth before theater</span><h2>Every status has to mean something.</h2></div><p>Provider-dependent workflows display Setup Required, Permission Required, Review Required, or Ready based on real configuration and access.</p></div>
    <div class="sonara-product-grid"><article class="card"><h3>Account and access</h3><p>Create an account, sign in, switch workspaces, review settings, or log out through one consistent identity layer.</p><div class="card-actions"><a class="action" href="/signup">Create account</a><a class="action" href="/login">Log in</a></div></article><article class="card"><h3>Founder administration</h3><p>Administrative readiness, users, roles, subscriptions, integrations, support, and audits stay protected behind founder access.</p><div class="card-actions"><a class="action" href="/admin/login">Admin access</a></div></article><article class="card"><h3>Free launch stack</h3><p>Explore useful tools before paying. Upgrade when saved work, deeper records, and supported operations become valuable.</p><div class="card-actions"><a class="action" href="/free-tools">Explore free tools</a><a class="action" href="/pricing">See plans</a></div></article></div>
  </section>

  <section class="sonara-section sonara-faq" aria-label="Common questions">
    <div class="sonara-section-head"><div><span class="sonara-kicker">Common questions</span><h2>Answers before you sign up.</h2></div><p>Straight answers about how SONARA works, what is free, and how your data is handled.</p></div>
    <div class="sonara-faq-list">
      <details><summary>What is SONARA?</summary><p>One operating layer for three focused companies — Business Builder, Creator Studio, and Growth Studio — with shared identity, billing, records, and support.</p></details>
      <details><summary>Is it really free to start?</summary><p>Yes. Create an account, use free tools, and save real work without entering a card. Paid plans begin at $7/mo when you want deeper records and support.</p></details>
      <details><summary>What happens when I upgrade?</summary><p>Paid tools unlock only after your payment is confirmed. If a payment lapses, paid access relocks — nothing is charged by surprise.</p></details>
      <details><summary>Do you ever show fake data?</summary><p>No. Every figure is your real saved data. When a connection or setup is missing, the page shows a clear setup-required state instead of inventing results.</p></details>
      <details><summary>Is my data private?</summary><p>Records are organization-scoped and private by default. Team access is controlled by role.</p></details>
      <details><summary>Can I cancel anytime?</summary><p>Yes. Manage billing from your account and cancel whenever you want.</p></details>
    </div>
  </section>

  <section class="sonara-cta"><div><span class="sonara-kicker" data-i18n="ctaKicker">Start with useful work</span><h2 data-i18n="ctaHeading">Begin free. Add depth when the work demands it.</h2><p>No fake urgency. No hidden enterprise maze. Start with the workspace and action you need now.</p></div><div class="card-actions"><a class="action" href="/signup">Create account</a><a class="action" href="/free-tools">Try a free tool</a><a class="action" href="/pricing">Compare plans</a></div></section>
</div>`;

const rootRoute = `app.get("/", (req, res) => {
  return res.status(200).type("html").send(layout({
    title: "SONARA Industries",
    eyebrow: "LAUNCH OPERATING SYSTEM",
    heading: "Build, create, and grow—without losing control.",
    variant: "home",
    body: "Three focused companies share one secure operating layer for identity, records, billing, support, and real work.",
    sections: [${JSON.stringify(homeContent)}],
    actions: [linkAction("/signup", "Create account"), linkAction("/free-tools", "Explore free tools"), linkAction("/pricing", "Compare plans")]
  }));
});`;

source = source
  .replace(/\n\s*<div id="sonara-loader"[\s\S]*?<div class="sonara-route-progress"[^>]*><\/div>/g, "")
  .replace(/\n\s*<dialog id="sonara-command-dialog"[\s\S]*?<div id="sonara-live"[^>]*><\/div>/g, "")
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
  .replace(/<main id="sonara-main"[^>]*>/, '<main id="sonara-main" data-sonara-interface="live" data-layout-contract="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); overflow-wrap: anywhere; word-break: break-word">');

const loader = `<div id="sonara-loader" class="sonara-loader" role="status" aria-live="polite"><div class="sonara-loader__core"><img class="sonara-loader__mark" src="/brand/sonara-industries-mark.svg" alt=""><div class="sonara-loader__track" aria-hidden="true"></div><span class="sonara-loader__label">SONARA ONE</span></div></div><div class="sonara-route-progress" aria-hidden="true"></div>`;
source = source.replace(/(<body class="\$\{escapeHtml\(brandClass\)\} \$\{variant === "home" \? "sonara-home-v3" : "sonara-standard-page"\}">)/, `$1\n    ${loader}`);

const dialogs = `<dialog id="sonara-command-dialog" class="sonara-dialog" aria-labelledby="sonara-command-title"><div class="sonara-dialog__head"><strong id="sonara-command-title">Command</strong><button type="button" class="sonara-dialog__close" data-dialog-close aria-label="Close">×</button></div><div class="sonara-command-input"><label for="sonara-command-search">Navigate</label><input id="sonara-command-search" type="search" data-i18n="searchPlaceholder" placeholder="Search pages, products, and actions"></div><ul class="sonara-command-list"></ul></dialog><dialog id="sonara-settings-dialog" class="sonara-dialog" aria-labelledby="sonara-settings-title"><div class="sonara-dialog__head"><strong id="sonara-settings-title" data-i18n="settingsTitle">Experience settings</strong><button type="button" class="sonara-dialog__close" data-dialog-close aria-label="Close">×</button></div><div class="sonara-settings"><label class="sonara-setting-row"><span><b data-i18n="language">Language</b><small data-i18n="languageHelp">Updates the interface language.</small></span><select data-sonara-preference="language"><option value="en" lang="en">English</option><option value="es" lang="es">Español</option><option value="fr" lang="fr">Français</option><option value="de" lang="de">Deutsch</option><option value="pt" lang="pt">Português</option></select></label><label class="sonara-setting-row"><span><b data-i18n="appearance">Appearance</b><small data-i18n="appearanceHelp">Follow your device or choose light or dark.</small></span><select data-sonara-preference="theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label class="sonara-setting-row"><span><b data-i18n="motion">Motion</b></span><input type="checkbox" data-sonara-preference="motion"></label><label class="sonara-setting-row"><span><b data-i18n="sound">Sound feedback</b></span><input type="checkbox" data-sonara-preference="sound"></label><label class="sonara-setting-row"><span><b data-i18n="haptics">Tactile feedback</b></span><input type="checkbox" data-sonara-preference="haptics"></label></div></dialog><div id="sonara-live" class="sonara-live" aria-live="polite"></div>`;
source = source.replace(/\n\s*<\/body>/, `\n    ${dialogs}\n  </body>`);

const staticAnchor = 'app.use(express.static(path.join(__dirname, "public")));';
if (source.includes(staticAnchor) && !source.includes('Cache-Control", "no-store, max-age=0')) {
  source = source.replace(staticAnchor, `${staticAnchor}\napp.use((req, res, next) => { if (req.method === "GET" && !path.extname(req.path)) res.set("Cache-Control", "no-store, max-age=0"); next(); });`);
}

const assets = `    <script src="/sonara-prepaint.js?v=${version}"></script>\n    <link rel="stylesheet" href="/sonara-application-ui.css?v=${version}">\n    <script defer src="/sonara-one.js?v=${version}"></script>`;
if (!source.includes("  </head>")) fail("Unable to locate document head");
source = source.replace("  </head>", `${assets}\n  </head>`);
fs.writeFileSync(serverPath, source);
console.log("SONARA One Balanced Precision experience applied.");
