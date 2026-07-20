"use strict";

const fs = require("node:fs");
const path = require("node:path");

const serverPath = path.join(process.cwd(), "server.js");
if (!fs.existsSync(serverPath)) {
  console.error("server.js not found. Run from repository root.");
  process.exit(1);
}

let source = fs.readFileSync(serverPath, "utf8");
const version = "application-ui-20260720-v2";

// Restore the stable, simple homepage renderer after older build patches have run.
const cleanRootRoute = `app.get("/", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "SONARA Industries",
      eyebrow: "Build. Create. Grow.",
      heading: "Build what matters.",
      variant: "home",
      body: "Choose a focused workspace, complete the next useful step, and keep account, billing, support, and saved records connected.",
      sections: [renderHomepageContent(getReadiness())],
      actions: [
        linkAction("/signup", "Start Free"),
        linkAction("/free-tools", "Try a free tool"),
        linkAction("/pricing", "View pricing")
      ]
    })
  );
});`;
const rootPattern = /app\.get\("\/", \(req, res\) => \{[\s\S]*?\n\}\);\n\nregisterProduct\("business-builder"/;
if (rootPattern.test(source)) {
  source = source.replace(rootPattern, `${cleanRootRoute}\n\nregisterProduct("business-builder"`);
}

// Remove every retired visual stylesheet and behavior script. The application now has one UI authority.
source = source
  .replace(/\n\s*<link rel="stylesheet" href="\/(?:sonara-brand-system|sonara-friendly-premium|sonara-interface-engine|sonara-launch-ui|sonara-cohesive-2027|sonara-cohesive-2027-base|sonara-builder-2027|sonara-premium-mobile-fix|sonara-premium-access-2027|sonara-premium-ux|sonara-premium-mobile-final|sonara-application-ui)\.css(?:\?v=[^"]+)?">/g, "")
  .replace(/\n\s*<script defer src="\/(?:sonara-experience|sonara-interface-engine|sonara-cohesive-2027|sonara-builder-2027)\.js(?:\?v=[^"]+)?"><\/script>/g, "");

// Remove the retired floating controls and decorative home device from the shared layout markup.
source = source
  .replace(/\n\s*<button type="button" class="sonara-command-button"[\s\S]*?<\/button>/, "")
  .replace(/\n\s*\$\{variant === "home" \? `<aside class="sonara-interface-face"[\s\S]*?<\/aside>` : ""\}/, "")
  .replace(/\n\s*<nav class="sonara-quick-bar" aria-label="Quick actions">[\s\S]*?<\/nav>/, "");

// Prevent stale document shells from surviving a deployment in mobile browser caches.
const staticAnchor = 'app.use(express.static(path.join(__dirname, "public")));';
const noStoreMiddleware = `${staticAnchor}\napp.use((req, res, next) => {\n  if (req.method === "GET" && !path.extname(req.path)) {\n    res.set("Cache-Control", "no-store, max-age=0");\n  }\n  next();\n});`;
if (source.includes(staticAnchor) && !source.includes('Cache-Control", "no-store, max-age=0')) {
  source = source.replace(staticAnchor, noStoreMiddleware);
}

const finalStyles = `    <link rel="stylesheet" href="/sonara-application-ui.css?v=${version}">`;
const headClose = "  </head>";
if (!source.includes(headClose)) {
  console.error("Unable to locate document head close tag.");
  process.exit(1);
}
source = source.replace(headClose, `${finalStyles}\n${headClose}`);

fs.writeFileSync(serverPath, source);
console.log("SONARA legacy visual systems removed; one responsive application shell is active.");