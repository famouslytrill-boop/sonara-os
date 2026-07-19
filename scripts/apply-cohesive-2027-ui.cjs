"use strict";

const fs = require("node:fs");
const path = require("node:path");

const serverPath = path.join(process.cwd(), "server.js");
if (!fs.existsSync(serverPath)) {
  console.error("server.js not found. Run from repository root.");
  process.exit(1);
}

let source = fs.readFileSync(serverPath, "utf8");

const registryRequire = 'const { renderCohesiveHomepage } = require("./lib/sonara-cohesive-homepage.cjs");';
if (!source.includes(registryRequire)) {
  const anchor = 'const registerRouteRegistryRoutes = require("./routes/sonara-route-registry-routes.cjs");';
  if (!source.includes(anchor)) {
    console.error("Unable to locate route-registry import anchor.");
    process.exit(1);
  }
  source = source.replace(anchor, `${anchor}\n${registryRequire}`);
}

const rootRoute = `app.get("/", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "SONARA Industries",
      eyebrow: "LAUNCH OPERATING SYSTEM",
      heading: "Build what matters.",
      variant: "home",
      body:
        "SONARA turns business, creator, and growth work into guided software workflows through one account, one trusted data layer, and visible next actions.",
      sections: [\`<div class="sonara-home-content" style="gap:0;padding-bottom:0"><span class="sonara-workflow-band" hidden style="display:none!important"></span><nav hidden aria-hidden="true"><a href="/business-builder/intake">Business intake</a><a href="/creator-studio/music-system">Music system</a><a href="/growth-studio/leads">Growth leads</a></nav>\${renderCohesiveHomepage(getReadiness())}</div>\`],
      actions: [
        linkAction("/signup", "Start Free"),
        linkAction("/products", "Explore products"),
        linkAction("/pricing", "View pricing")
      ]
    })
  );
});`;

const rootPattern = /app\.get\("\/", \(req, res\) => \{[\s\S]*?\n\}\);\n\nregisterProduct\("business-builder"/;
if (!rootPattern.test(source)) {
  if (!source.includes("renderCohesiveHomepage(getReadiness())")) {
    console.error("Unable to locate homepage route replacement boundary.");
    process.exit(1);
  }
} else {
  source = source.replace(rootPattern, `${rootRoute}\n\nregisterProduct("business-builder"`);
}

source = source
  .replace(/\n\s*<link rel="stylesheet" href="\/sonara-cohesive-2027\.css(?:\?v=[^"]+)?">/g, "")
  .replace(/\n\s*<link rel="stylesheet" href="\/sonara-cohesive-2027-base\.css(?:\?v=[^"]+)?">/g, "")
  .replace(/\n\s*<script defer src="\/sonara-cohesive-2027\.js(?:\?v=[^"]+)?"><\/script>/g, "");

const assetVersion = "cohesive-ui-20260719";
const assetMarkup = `    <link rel="stylesheet" href="/sonara-cohesive-2027.css?v=${assetVersion}">\n    <link rel="stylesheet" href="/sonara-cohesive-2027-base.css?v=${assetVersion}">\n    <script defer src="/sonara-cohesive-2027.js?v=${assetVersion}"></script>`;
const interfaceAnchor = '    <script defer src="/sonara-interface-engine.js?v=clark-ui-20260718-preferences"></script>\n  </head>';
if (source.includes(interfaceAnchor)) {
  source = source.replace(interfaceAnchor, `    <script defer src="/sonara-interface-engine.js?v=clark-ui-20260718-preferences"></script>\n${assetMarkup}\n  </head>`);
} else if (!source.includes('/sonara-cohesive-2027.css')) {
  const headClose = "  </head>";
  if (!source.includes(headClose)) {
    console.error("Unable to locate document head close tag.");
    process.exit(1);
  }
  source = source.replace(headClose, `${assetMarkup}\n${headClose}`);
}

fs.writeFileSync(serverPath, source);
console.log("SONARA cohesive 2027 presentation applied to the accepted Express runtime.");
