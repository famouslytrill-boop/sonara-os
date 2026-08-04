"use strict";

// The page frame: the document shell every screen is rendered into, the
// homepage body, the one-message result page, and the founder-operations
// chrome.
//
// This was step 7b of the split, and it was marked "do not attempt" for most of
// the work. Not because of the code -- because eleven generators anchored on
// markup inside these functions, four of them on the string `  </head>` alone.
// An earlier attempt to move `layout` cascaded into five generator repairs
// before a scan found six more, and was reset rather than pushed.
//
// The generators are retired, so this is now an ordinary extraction.
//
// Three dependencies are injected because they belong to other concerns:
// legalPages reads the legal document set, safeListTable reads the database, and
// readinessStatusClass is shared with the readiness screens. The card and link
// helpers come from lib/sonara-shell.cjs directly -- they are leaves and this
// module is their only large consumer.

const { PRODUCTION_ORIGIN } = require("./sonara-route-registry.cjs");
const {
  actionCard,
  brandCard,
  displayStatus,
  escapeHtml,
  linkAction
} = require("./sonara-shell.cjs");

const REQUIRED = ["legalPages", "readinessStatusClass", "safeListTable"];

function createPageFrame(deps = {}) {
  for (const name of REQUIRED) {
    if (typeof deps[name] !== "function") throw new TypeError(`createPageFrame requires ${name}`);
  }
  const { legalPages, readinessStatusClass, safeListTable } = deps;

  // Every page shipped with a title and an image and no description at all --
  // no <meta name="description">, no og:description, no twitter card, no
  // canonical. Search results showed whatever a crawler chose to lift, and a
  // link pasted into Slack, WhatsApp or X rendered as a headline and a picture
  // with nothing underneath saying what the page was.
  //
  // The summary already existed: `body` is the one-sentence description each
  // page passes to layout() and renders in its hero. It is reused here rather
  // than a second description being written and left to drift.
  //
  // Canonical matters because the duplication is deliberate: legalAliasPages()
  // serves the same text at /terms and /legal/terms, /privacy and
  // /legal/privacy, and six more pairs. Without a canonical those are eight
  // pairs of duplicate pages competing with each other.
  const DESCRIPTION_LIMIT = 300;

  function pageDescription(body) {
    const text = String(body || "").replace(/\s+/g, " ").trim();
    if (text.length <= DESCRIPTION_LIMIT) return text;
    // Cut on a word boundary rather than mid-word.
    return `${text.slice(0, text.lastIndexOf(" ", DESCRIPTION_LIMIT - 1))}…`;
  }

  function renderHead(title, themeColor = "#FAF8F4", body = "", canonical = "") {
    const pageTitle = title === "SONARA Industries" ? title : `${title} | SONARA Industries`;
    const description = pageDescription(body);
    const canonicalUrl = canonical ? `${PRODUCTION_ORIGIN}${canonical}` : "";
    return `<meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta name="theme-color" content="${escapeHtml(themeColor)}">
      <meta name="apple-mobile-web-app-capable" content="yes">
      <meta name="apple-mobile-web-app-title" content="SONARA">
      ${description ? `<meta name="description" content="${escapeHtml(description)}">` : ""}
      <meta property="og:title" content="${escapeHtml(pageTitle)}">
      ${description ? `<meta property="og:description" content="${escapeHtml(description)}">` : ""}
      <meta property="og:site_name" content="SONARA Industries">
      <meta property="og:type" content="website">
      <meta property="og:image" content="/og-image.png">
      ${canonicalUrl ? `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">` : ""}
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
      ${description ? `<meta name="twitter:description" content="${escapeHtml(description)}">` : ""}
      ${canonicalUrl ? `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">` : ""}
      <link rel="icon" href="/favicon.ico" sizes="any">
      <link rel="icon" href="/favicon.svg" type="image/svg+xml">
      <link rel="apple-touch-icon" href="/icons/icon-180.png">
      <link rel="manifest" href="/site.webmanifest">
      <title>${escapeHtml(pageTitle)}</title>`;
  }

  function pageBrandClass(title, heading, eyebrow) {
    const text = `${title || ""} ${heading || ""} ${eyebrow || ""}`.toLowerCase();
    if (text.includes("business builder")) return "sonara-business-builder";
    if (text.includes("creator studio") || text.includes("formula")) return text.includes("formula") ? "sonara-formulas" : "sonara-creator-studio";
    if (text.includes("growth studio")) return "sonara-growth-studio";
    if (text.includes("admin") || text.includes("founder")) return "sonara-admin";
    if (text.includes("ecosystem")) return "sonara-ecosystem";
    return "sonara-platform";
  }

  function renderInterfaceStatusPanel(readiness) {
    const items = [
      { label: "Products", value: "Routes live", status: "ready" },
      { label: "Database", value: displayStatus(readiness.services.accountDatabase), status: readiness.services.accountDatabase },
      { label: "Payments", value: displayStatus(readiness.services.checkout), status: readiness.services.checkout },
      {
        label: "Support queue",
        value: readiness.services.accountDatabase === "configured" ? "Database-backed" : "Setup required",
        status: readiness.services.accountDatabase
      },
      { label: "Admin", value: displayStatus(readiness.services.founderAccess), status: readiness.services.founderAccess }
    ];
    return `<div class="sonara-status-panel" aria-label="Operational status">${items.map((item) => `<span class="sonara-status-chip ${escapeHtml(readinessStatusClass(item.status))}"><b>${escapeHtml(item.label)}</b><em>${escapeHtml(item.value)}</em></span>`).join("")}</div>`;
  }

  // Which pages get depth.
  //
  // The design system has carried .sonara-stage / .sonara-depth / .sonara-reveal
  // for a while, along with a rule that strips all of it inside
  // [data-sonara-surface="work"]. None of it was ever rendered: those class
  // names appeared zero times across server.js, lib/ and routes/. The 3D
  // interface existed only in the stylesheet.
  //
  // The default here is "work", not "marketing", and deliberately so. AGENTS.md
  // asks for public overview screens to feel polished and for work screens to
  // stay calm and operational, and of the two the expensive mistake is animating
  // an operational screen. A page has to ask for depth; forgetting leaves it
  // calm. Every existing caller keeps exactly the behaviour it has today,
  // because today no caller renders any of these classes.
  // Fonts are served from this origin. They used to come from
  // fonts.googleapis.com and fonts.gstatic.com, which meant every visitor's
  // browser contacted Google and Google received their IP address -- on public
  // pages, before sign-in and before any consent. That was the only third party
  // in this document and the only external request it made. See
  // public/sonara-fonts.css and docs/legal/COUNSEL_REVIEW_BRIEF.md finding F-1.
  //
  // This note lives here rather than in the emitted HTML. The first version was
  // an HTML comment, which shipped the word "Google" to every visitor in every
  // response -- caught by the existing check that /login must not mention it.
  // An explanation belongs in the source, not in the response body.
  function layout({ title, eyebrow, heading, body, sections, actions, variant = "standard", surface = "work", canonical = "" }) {
    const brandClass = pageBrandClass(title, heading, eyebrow);
    const isMarketing = surface === "marketing";
    const mainClass = isMarketing ? "sonara-ds sonara-stage" : "sonara-ds";
    return `<!doctype html>
  <html lang="en">
    <head>
      ${renderHead(title, brandClass === "sonara-admin" ? "#0C1122" : "#FAF8F4", body, canonical)}
      <link rel="preload" href="/fonts/geist-latin.woff2?v=sonara-ui-20260804-v7-entrance" as="font" type="font/woff2" crossorigin>
      <link rel="stylesheet" href="/sonara-fonts.css?v=sonara-ui-20260804-v7-entrance">
      <script src="/sonara-prepaint.js?v=sonara-ui-20260804-v7-entrance"></script>
      <link rel="stylesheet" href="/sonara-design-system.css?v=sonara-ui-20260804-v7-entrance">
      <link rel="stylesheet" href="/sonara-application-ui.css?v=sonara-ui-20260804-v7-entrance">
      <script defer src="/sonara-one.js?v=sonara-ui-20260804-v7-entrance"></script>
      <script defer src="/sonara-experience-controls.js?v=sonara-ui-20260804-v7-entrance"></script>
      ${isMarketing ? `<script defer src="/sonara-depth.js?v=sonara-ui-20260804-v7-entrance"></script>` : ""}
    </head>
    <body class="${escapeHtml(brandClass)} ${variant === "home" ? "sonara-home-v3" : "sonara-standard-page"}">
      <div id="sonara-loader" class="sonara-loader" role="status" aria-live="polite" aria-label="SONARA One is loading">
        <div class="sonara-startup-frame">
          <div class="sonara-startup-stage" aria-hidden="true">
            <span class="sonara-startup-orbit sonara-startup-orbit--outer"></span>
            <span class="sonara-startup-orbit sonara-startup-orbit--inner"></span>
            <span class="sonara-startup-glow"></span>
            <span class="sonara-startup-mark-wrap">
              <img class="sonara-startup-mark sonara-startup-mark--light" src="/brand/sonara-one-mark-v3.svg" alt="">
              <img class="sonara-startup-mark sonara-startup-mark--dark" src="/brand/sonara-one-mark-v3-dark.svg" alt="">
            </span>
            <span class="sonara-startup-particle sonara-startup-particle--one"></span>
            <span class="sonara-startup-particle sonara-startup-particle--two"></span>
            <span class="sonara-startup-particle sonara-startup-particle--three"></span>
          </div>
          <div class="sonara-startup-wordmark" aria-hidden="true"><strong>SONARA</strong><span>One</span></div>
          <p class="sonara-startup-tagline">Build. Create. Grow.</p>
          <p class="sonara-loader__status" data-sonara-loader-status>Preparing your workspace</p>
          <div class="sonara-loader__track" aria-hidden="true"><span></span></div>
          <button class="sonara-loader__skip" type="button" data-sonara-loader-skip>Skip animation</button>
        </div>
      </div><div class="sonara-route-progress" aria-hidden="true"></div>
      <a class="sonara-skip" href="#sonara-main">Skip to content</a>
      <header class="sonara-site-header">
        <a class="brand" href="/" aria-label="SONARA Industries home"><img class="sonara-brand-mark" src="/brand/sonara-one-mark-v3.svg" data-legacy-mark="/brand/sonara-industries-mark.svg" alt="" width="40" height="40"><span class="sonara-brand-copy"><strong>SONARA Industries</strong><small>SONARA One</small></span></a>
        <nav class="sonara-desktop-nav" aria-label="Primary">
          <a href="/start" data-i18n="platform">Platform</a>
          <a href="/dashboard" data-i18n="dashboard">Workspace</a>
          <details class="sonara-workspace-menu"><summary>Workspaces</summary><div><a href="/business-builder">Business Builder</a><a href="/creator-studio">Creator Studio</a><a href="/growth-studio">Growth Studio</a></div></details>
          <a href="/free-tools" data-i18n="tools">Tools</a>
          <a href="/pricing" data-i18n="pricing">Pricing</a>
          <a href="/support" data-i18n="support">Support</a>
          <a href="/login" data-i18n="login">Log in</a>
          <a class="sonara-nav-primary" href="/signup" data-i18n="start">Create account</a>
        </nav>
        <div class="sonara-header-tools">
          <button type="button" class="sonara-icon-button" data-sonara-command aria-haspopup="dialog" aria-controls="sonara-command-dialog" aria-label="Open command navigation"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m14.5 14.5 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span class="sonara-tool-label" data-i18n="command">Command</span><kbd class="sonara-key">⌘K</kbd></button>
          <button type="button" class="sonara-icon-button" data-sonara-settings aria-haspopup="dialog" aria-controls="sonara-settings-dialog" aria-label="Open experience settings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M8 12h8M6 17h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span class="sonara-tool-label" data-i18n="experience">Experience</span></button>
          <details class="sonara-account-menu">
          <summary aria-label="Open account navigation">Account</summary>
          <div class="sonara-account-panel">
            <a href="/dashboard" data-i18n="dashboard">Dashboard</a>
            <a href="/account">Account</a>
            <a href="/settings" data-i18n="settings">Settings</a>
            <form method="post" action="/logout"><button type="submit" data-i18n="logout">Log out</button></form>
          </div>
        </details>
        </div>
        <details class="sonara-mobile-menu"><summary aria-label="Open navigation" data-i18n="menu">Menu</summary><nav aria-label="Mobile primary">
          <a href="/start" data-i18n="platform">Platform</a>
          <a href="/dashboard" data-i18n="dashboard">Workspace</a>
          <a href="/business-builder">Business Builder</a>
          <a href="/creator-studio">Creator Studio</a>
          <a href="/growth-studio">Growth Studio</a>
          <a href="/free-tools" data-i18n="tools">Tools</a>
          <a href="/pricing" data-i18n="pricing">Pricing</a>
          <a href="/support" data-i18n="support">Support</a>
          <a href="/login" data-i18n="login">Log in</a>
          <a class="sonara-nav-primary" href="/signup" data-i18n="start">Create account</a>
        </nav></details>
      </header>
      <main id="sonara-main" class="${mainClass}" data-sonara-surface="${isMarketing ? "marketing" : "work"}" data-sonara-interface="live" data-layout-contract="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); overflow-wrap: anywhere; word-break: break-word">
        <section class="hero sonara-hero-stage">
          <div class="sonara-hero-copy${isMarketing ? " sonara-reveal" : ""}">
            <div class="eyebrow"${variant === "home" ? ' data-i18n="heroEyebrow"' : ""}>${escapeHtml(eyebrow)}</div>
            <h1${variant === "home" ? ' data-i18n="heroHeading"' : ""}>${escapeHtml(heading)}</h1>
            <p class="lede"${variant === "home" ? ' data-i18n="heroBody"' : ""}>${escapeHtml(body)}</p>
            <div class="actions">${actions.join("")}</div>
          </div>
        </section>
        <section class="grid">${sections.join("")}</section>
      </main>
      <footer>
        <div class="sonara-footer-grid">
          <div class="sonara-footer-brand">
            <span class="brand"><img class="sonara-brand-mark" src="/brand/sonara-one-mark-v3.svg" data-legacy-mark="/brand/sonara-industries-mark.svg" alt="" width="24" height="24"> SONARA Industries</span>
            <p>SONARA Industries builds launch infrastructure for Business Builder, Creator Studio, and Growth Studio.</p>
          </div>
          <nav aria-label="Products and support">
            <a href="/about">About</a>
            <a href="/business-builder">Business Builder</a>
            <a href="/creator-studio">Creator Studio</a>
            <a href="/growth-studio">Growth Studio</a>
            <a href="/pricing">Pricing</a>
            <a href="/free-tools">Free tools</a>
            <a href="/support">Support</a>
            <a href="/contact">Contact</a>
            <a href="/security">Security</a>
          </nav>
        </div>
        <nav aria-label="Legal">
          ${legalPages().map((page) => `<a href="${escapeHtml(page.href)}">${escapeHtml(page.title)}</a>`).join("")}
        </nav>
      </footer>
      <dialog id="sonara-command-dialog" class="sonara-dialog" aria-labelledby="sonara-command-title"><div class="sonara-dialog__head"><strong id="sonara-command-title">Command</strong><button type="button" class="sonara-dialog__close" data-dialog-close aria-label="Close">×</button></div><div class="sonara-command-input"><label for="sonara-command-search">Navigate</label><input id="sonara-command-search" type="search" data-i18n="searchPlaceholder" placeholder="Search pages, products, and actions"></div><ul class="sonara-command-list"></ul></dialog><dialog id="sonara-settings-dialog" class="sonara-dialog" aria-labelledby="sonara-settings-title"><div class="sonara-dialog__head"><strong id="sonara-settings-title" data-i18n="settingsTitle">Experience settings</strong><button type="button" class="sonara-dialog__close" data-dialog-close aria-label="Close">×</button></div><div class="sonara-settings"><label class="sonara-setting-row"><span><b data-i18n="language">Language</b><small data-i18n="languageHelp">Updates the interface language.</small></span><select data-sonara-preference="language"><option value="en" lang="en">English</option><option value="es" lang="es">Español</option><option value="fr" lang="fr">Français</option><option value="de" lang="de">Deutsch</option><option value="pt" lang="pt">Português</option></select></label><label class="sonara-setting-row"><span><b data-i18n="appearance">Appearance</b><small data-i18n="appearanceHelp">Follow your device or choose light or dark.</small></span><select data-sonara-preference="theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label class="sonara-setting-row sonara-setting-row--range"><span><b>Brightness</b><small>Adjust this device without changing your account.</small></span><span class="sonara-range-control"><input type="range" min="92" max="112" step="1" value="104" data-sonara-preference="brightness" aria-label="Interface brightness"><output data-sonara-brightness-output>104%</output></span></label>
          <label class="sonara-setting-row"><span><b data-i18n="motion">Motion</b></span><input type="checkbox" data-sonara-preference="motion"></label><label class="sonara-setting-row"><span><b data-i18n="sound">Sound feedback</b></span><input type="checkbox" data-sonara-preference="sound"></label><label class="sonara-setting-row"><span><b data-i18n="haptics">Tactile feedback</b></span><input type="checkbox" data-sonara-preference="haptics"></label></div></dialog><div id="sonara-live" class="sonara-live" aria-live="polite"></div>
    </body>
  </html>`;
  }

  function responsePage(title, body, actions) {
    return layout({ title, eyebrow: "System response", heading: title, body, sections: [], actions });
  }

  function renderHomepageContent(readiness) {
    const products = [
      {
        number: "01",
        name: "Business Builder",
        descriptor: "Operations",
        className: "is-business",
        mark: "/brand/business-builder-mark-v3.svg",
        body: "Shape the offer, capture intake, verify launch readiness, and keep business records organized.",
        actions: [
          ["/business-builder/dashboard", "Dashboard"],
          ["/business-builder/intake", "Intake"],
          ["/business-builder/launch-readiness", "Launch checklist"],
          ["/business-builder/billing", "Billing"]
        ]
      },
      {
        number: "02",
        name: "Creator Studio",
        descriptor: "Media",
        className: "is-creator",
        mark: "/brand/creator-studio-mark-v3.svg",
        body: "Organize assets, build offers, plan releases, and manage creator deliverables in one workspace.",
        actions: [
          ["/creator-studio/dashboard", "Dashboard"],
          ["/creator-studio/assets", "Assets"],
          ["/creator-studio/offers/free", "Offer draft"],
          ["/creator-studio/music-system", "Music system"]
        ]
      },
      {
        number: "03",
        name: "Growth Studio",
        descriptor: "Campaigns",
        className: "is-growth",
        mark: "/brand/growth-studio-mark-v3.svg",
        body: "Plan consent-safe campaigns, track leads, and turn customer follow-up into a reviewable routine.",
        actions: [
          ["/growth-studio/dashboard", "Dashboard"],
          ["/growth-studio/campaigns", "Campaigns"],
          ["/growth-studio/leads", "Leads"],
          ["/growth-studio/checklist", "Consent checklist"]
        ]
      }
    ];

    return `<div class="sonara-home-content">
      <section class="sonara-home-section" aria-labelledby="products-title">
        <div class="sonara-section-heading">
          <div><span class="eyebrow">Three focused products</span><h2 id="products-title">Choose the workspace that fits the work.</h2></div>
          <p>Each product has its own tools and records while account, billing, support, and security stay connected.</p>
        </div>
        <div class="sonara-product-grid">
          ${products.map((product) => `<article class="sonara-product-card ${product.className}">
            <div class="sonara-product-card-head">
              <img src="${product.mark}" width="42" height="42" alt="">
              <span>${product.number} &middot; ${product.descriptor}</span>
            </div>
            <h3>${product.name}</h3>
            <p>${product.body}</p>
            <div class="sonara-product-links">${product.actions.map(([href, label]) => `<a href="${href}">${label}</a>`).join("")}</div>
          </article>`).join("")}
        </div>
      </section>

      <section class="sonara-workflow-band" aria-labelledby="workflow-title">
        <div>
          <span class="eyebrow">How SONARA works</span>
          <h2 id="workflow-title">From a scattered idea to a delivered outcome.</h2>
          <p>Use free tools yourself or request operator-supported work. Every saved request, payment state, and deliverable follows a visible path.</p>
          <div class="card-actions">${linkAction("/start", "See how it works")}${linkAction("/service-catalog", "Service catalog")}${linkAction("/requests", "My requests")}${linkAction("/deliverables", "Deliverables")}</div>
        </div>
        <ol>
          <li><span>01</span><strong>Choose the outcome</strong><small>Pick a workspace, free tool, or service.</small></li>
          <li><span>02</span><strong>Create useful work</strong><small>Generate an output or submit validated intake.</small></li>
          <li><span>03</span><strong>Review real status</strong><small>See setup, billing, and delivery state without simulated success.</small></li>
          <li><span>04</span><strong>Track delivery</strong><small>Keep references, requests, and deliverables together.</small></li>
        </ol>
      </section>

      <section class="sonara-home-section" aria-labelledby="today-title">
        <div class="sonara-section-heading compact">
          <div><span class="eyebrow">What works today</span><h2 id="today-title">Useful before you pay. Clear when setup is required.</h2></div>
        </div>
        <div class="sonara-capability-grid">
          ${actionCard("Free tools preview", "Fifteen deterministic tools cover offers, readiness, pricing, briefs, releases, campaigns, and KPIs. They do not pretend to save unless the database insert succeeds.", [linkAction("/free-tools", "Open free tools")])}
          ${actionCard("Paid workflows preview", "Saved workspaces, operator review, deliverable tracking, premium templates, and exports unlock only from confirmed billing records.", [linkAction("/pricing", "View pricing"), linkAction("/billing", "Billing status")])}
          ${actionCard("Trust and readiness", "Public readiness shows what is configured and what still needs attention. Private admin proof remains protected.", [linkAction("/readiness", "Platform readiness"), linkAction("/security", "Security")])}
          ${actionCard("Account and database states", "Login, organization membership, storage, and provider gaps produce a specific next action instead of a blank screen.", [linkAction("/account/setup", "Account setup"), linkAction("/support", "Get support")])}
        </div>
      </section>

      <section class="sonara-readiness-band" aria-labelledby="readiness-title">
        <div>
          <span class="eyebrow">Operational proof</span>
          <h2 id="readiness-title">A launch interface that tells the truth.</h2>
          <p>Software-in-a-Service with payment-backed access, database-scoped records, a support queue, and protected founder operations.</p>
        </div>
        ${renderInterfaceStatusPanel(readiness)}
        <div class="card-actions">${linkAction("/readiness", "Review readiness")}${linkAction("/admin", "Founder operations")}</div>
      </section>

      <section class="sonara-launch-cta" aria-label="Start using SONARA">
        <div><span class="eyebrow">Start with a real outcome</span><h2>Use a free tool now. Upgrade when saved work and support matter.</h2></div>
        <div class="card-actions">${linkAction("/signup", "Start Free")}${linkAction("/free-tools", "Try a free tool")}${linkAction("/pricing", "View pricing")}</div>
      </section>
    </div>`;
  }

  function adminActions() {
    return [
      linkAction("/admin", "Admin"),
      linkAction("/admin/users", "Users"),
      linkAction("/admin/roles", "Roles"),
      linkAction("/admin/subscriptions", "Subscriptions"),
      linkAction("/admin/webhooks", "Payment updates"),
      linkAction("/admin/support", "Support queue"),
      linkAction("/admin/catalog", "Catalog"),
      linkAction("/admin/system", "System"),
      linkAction("/admin/database", "Database"),
      linkAction("/admin/storage", "Storage"),
      linkAction("/admin/formulas", "Formulas"),
      linkAction("/admin/ecosystem", "Ecosystem"),
      linkAction("/admin/infrastructure", "Infrastructure"),
      linkAction("/admin/business-builder", "Business Builder"),
      linkAction("/admin/creator-studio", "Creator Studio"),
      linkAction("/admin/growth-studio", "Growth Studio"),
      adminLogoutAction()
    ];
  }

  function adminLogoutAction() {
    return `<form method="post" action="/admin/logout"><button class="action" type="submit">Logout</button></form>`;
  }

  function adminLoginForm() {
    const inputId = "admin-founder-password";
    return `<article class="card">
      <h2>Protected access</h2>
      <form method="post" action="/admin/login">
        <label>Founder email<input name="email" type="email" autocomplete="username" required></label>
        <label>Password<input id="${inputId}" name="password" type="password" autocomplete="current-password" minlength="8" required></label>
        <button type="button" data-toggle-password="${inputId}" aria-controls="${inputId}" aria-pressed="false" aria-label="Show password">Show password</button>
        <button type="submit">Sign in to admin</button>
      </form>
    </article>`;
  }

  function adminRoleForm() {
    return `<article class="card">
      <h2>Update role</h2>
      <form method="post" action="/admin/roles">
        <label>User ID<input name="userId" type="text" required></label>
        <label>Role<select name="role" required><option value="owner">Owner</option><option value="admin">Admin</option><option value="customer">Customer</option><option value="employee">Employee</option></select></label>
        <label>Action<select name="action" required><option value="grant">Grant role</option><option value="revoke">Revoke role</option></select></label>
        <button type="submit">Update role</button>
      </form>
    </article>`;
  }

  async function adminRowsPage({ title, heading, body, table, query, emptyText, rowTitle, rowBody, extraSections = [], actions }) {
    const rows = await safeListTable(table, query);
    const sections = [...extraSections];
    if (!rows.ok) sections.push(brandCard("Setup required", `${table} rows are unavailable until the account database tables are migrated and service-role server access is configured.`));
    else if (!rows.rows.length) sections.push(brandCard("No rows", emptyText));
    else sections.push(...rows.rows.map((row) => brandCard(rowTitle(row), rowBody(row))));
    return layout({ title, eyebrow: "Founder operations", heading, body, sections, actions });
  }

  return {
    adminActions,
    adminLoginForm,
    adminLogoutAction,
    adminRoleForm,
    adminRowsPage,
    layout,
    pageBrandClass,
    renderHead,
    renderHomepageContent,
    renderInterfaceStatusPanel,
    responsePage
  };
}

module.exports = { createPageFrame, REQUIRED };
