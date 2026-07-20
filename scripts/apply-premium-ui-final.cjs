"use strict";

const fs = require("node:fs");
const path = require("node:path");

const serverPath = path.join(process.cwd(), "server.js");
if (!fs.existsSync(serverPath)) {
  console.error("server.js not found. Run from repository root.");
  process.exit(1);
}

let source = fs.readFileSync(serverPath, "utf8");
const version = "sonara-nexus-20260720-v6";

const cleanRootRoute = `app.get("/", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "SONARA Industries",
      eyebrow: "SONARA NEXUS",
      heading: "Make work move.",
      variant: "home",
      body: "One responsive operating layer for shaping a business, creating original work, reaching customers, and keeping every next action visible.",
      sections: [renderHomepageContent(getReadiness())],
      actions: [
        linkAction("/signup", "Enter SONARA"),
        linkAction("/free-tools", "Launch a free tool"),
        linkAction("/pricing", "Compare access")
      ]
    })
  );
});`;
const rootPattern = /app\.get\("\/", \(req, res\) => \{[\s\S]*?\n\}\);\n\nregisterProduct\("business-builder"/;
if (rootPattern.test(source)) source = source.replace(rootPattern, `${cleanRootRoute}\n\nregisterProduct("business-builder"`);

const navigationLinks = `
        <a href="/start">Nexus</a>
        <a href="/business-builder">Forge</a>
        <a href="/creator-studio">Canvas</a>
        <a href="/growth-studio">Signal</a>
        <a href="/free-tools">Tools</a>
        <a href="/pricing">Access</a>
        <a href="/support">Support</a>
        <a href="/login">Log in</a>
        <a class="sonara-nav-primary" href="/signup">Enter SONARA</a>`;

const cleanHeader = `<header class="sonara-site-header">
      <a class="brand" href="/"><img class="sonara-brand-mark" src="/brand/sonara-industries-mark.svg" alt="" width="38" height="38"> SONARA <span>Nexus</span></a>
      <nav class="sonara-desktop-nav" aria-label="Primary">${navigationLinks}
      </nav>
      <details class="sonara-mobile-menu">
        <summary aria-label="Open navigation">Menu</summary>
        <nav aria-label="Mobile primary">${navigationLinks}
        </nav>
      </details>
    </header>`;
source = source.replace(/<header(?:\s[^>]*)?>[\s\S]*?<\/header>/, cleanHeader);

source = source
  .replace(/var choice = "system";/, 'var choice = "dark";')
  .replace(/window\.localStorage\.getItem\("sonara-appearance"\)/, 'window.localStorage.getItem("sonara-theme")')
  .replace(/document\.documentElement\.setAttribute\("data-sonara-appearance", choice\);/, 'document.documentElement.setAttribute("data-sonara-theme", choice);')
  .replace(/<meta name="theme-color" content="[^"]+">/, '<meta name="theme-color" content="#070910">')
  .replace(/\n\s*<style>[\s\S]*?<\/style>/, "")
  .replace(/\n\s*<link rel="preconnect" href="https:\/\/fonts\.(?:googleapis|gstatic)\.com"(?: crossorigin)?>/g, "")
  .replace(/\n\s*<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^"]+">/g, "")
  .replace(/\n\s*<link rel="stylesheet" href="\/(?:sonara-brand-system|sonara-friendly-premium|sonara-interface-engine|sonara-launch-ui|sonara-cohesive-2027|sonara-cohesive-2027-base|sonara-builder-2027|sonara-premium-mobile-fix|sonara-premium-access-2027|sonara-premium-ux|sonara-premium-mobile-final|sonara-application-ui)\.css(?:\?v=[^"]+)?">/g, "")
  .replace(/\n\s*<script defer src="\/(?:sonara-experience|sonara-interface-engine|sonara-cohesive-2027|sonara-builder-2027|sonara-nexus)\.js(?:\?v=[^"]+)?"><\/script>/g, "")
  .replace(/ data-sonara-interface="live"/g, "")
  .replace(/\n\s*\$\{variant === "home" \? `<aside class="sonara-interface-face"[\s\S]*?<\/aside>` : ""\}/, "")
  .replace(/\n\s*<nav class="sonara-quick-bar" aria-label="Quick actions">[\s\S]*?<\/nav>/, "");

const staticAnchor = 'app.use(express.static(path.join(__dirname, "public")));';
const noStoreMiddleware = `${staticAnchor}\napp.use((req, res, next) => {\n  if (req.method === "GET" && !path.extname(req.path)) {\n    res.set("Cache-Control", "no-store, max-age=0");\n  }\n  next();\n});`;
if (source.includes(staticAnchor) && !source.includes('Cache-Control", "no-store, max-age=0')) source = source.replace(staticAnchor, noStoreMiddleware);

const finalAssets = `    <link rel="stylesheet" href="/sonara-application-ui.css?v=${version}">\n    <script defer src="/sonara-nexus.js?v=${version}"></script>`;
const headClose = "  </head>";
if (!source.includes(headClose)) {
  console.error("Unable to locate document head close tag.");
  process.exit(1);
}
source = source.replace(headClose, `${finalAssets}\n${headClose}`);

fs.writeFileSync(serverPath, source);
console.log("SONARA Nexus premium runtime applied with one visual authority, original motion, optional sound/haptics, command navigation, and localization controls.");
