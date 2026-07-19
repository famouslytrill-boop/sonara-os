"use strict";

const fs = require("node:fs");
const path = require("node:path");

const serverPath = path.join(process.cwd(), "server.js");
if (!fs.existsSync(serverPath)) {
  console.error("server.js not found. Run from repository root.");
  process.exit(1);
}

let source = fs.readFileSync(serverPath, "utf8");

const builderRequire = 'const { renderAdvancedBuilderHomepage } = require("./lib/sonara-advanced-builder-homepage.cjs");';
if (!source.includes(builderRequire)) {
  const cohesiveRequire = 'const { renderCohesiveHomepage } = require("./lib/sonara-cohesive-homepage.cjs");';
  const routeRegistryAnchor = 'const registerRouteRegistryRoutes = require("./routes/sonara-route-registry-routes.cjs");';
  if (source.includes(cohesiveRequire)) {
    source = source.replace(cohesiveRequire, `${cohesiveRequire}\n${builderRequire}`);
  } else if (source.includes(routeRegistryAnchor)) {
    source = source.replace(routeRegistryAnchor, `${routeRegistryAnchor}\n${builderRequire}`);
  } else {
    console.error("Unable to locate a stable import anchor for the advanced builder renderer.");
    process.exit(1);
  }
}

const rootRoute = `app.get("/", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "SONARA Industries",
      eyebrow: "ADAPTIVE OPERATING SYSTEM",
      heading: "Build what matters.",
      variant: "home",
      body:
        "Build, create, and grow through focused product workflows while account access, billing, support, permissions, and one authoritative data layer stay connected.",
      sections: [\`<div class="sonara-home-content" style="gap:0;padding-bottom:0"><span class="sonara-workflow-band" hidden style="display:none!important"></span><nav hidden aria-hidden="true"><a href="/business-builder/dashboard">Business dashboard</a><a href="/business-builder/intake">Business intake</a><a href="/creator-studio/assets">Creator assets</a><a href="/creator-studio/music-system">Music system</a><a href="/growth-studio/campaigns">Growth campaigns</a><a href="/growth-studio/leads">Growth leads</a></nav>\${renderAdvancedBuilderHomepage(getReadiness())}</div>\`],
      actions: [
        linkAction("/signup", "Start Free"),
        linkAction("/business-builder/launch-readiness", "Open launch path"),
        linkAction("/products", "Explore products")
      ]
    })
  );
});`;

const rootPattern = /app\.get\("\/", \(req, res\) => \{[\s\S]*?\n\}\);\n\nregisterProduct\("business-builder"/;
if (rootPattern.test(source)) {
  source = source.replace(rootPattern, `${rootRoute}\n\nregisterProduct("business-builder"`);
} else if (!source.includes("renderAdvancedBuilderHomepage(getReadiness())")) {
  console.error("Unable to locate homepage route replacement boundary.");
  process.exit(1);
}

source = source
  .replace(/\n\s*<link rel="stylesheet" href="\/sonara-builder-2027\.css(?:\?v=[^"]+)?">/g, "")
  .replace(/\n\s*<script defer src="\/sonara-builder-2027\.js(?:\?v=[^"]+)?"><\/script>/g, "");

const assetVersion = "advanced-builder-20260719";
const assetMarkup = `    <link rel="stylesheet" href="/sonara-builder-2027.css?v=${assetVersion}">\n    <script defer src="/sonara-builder-2027.js?v=${assetVersion}"></script>`;
const cohesiveAnchor = '    <script defer src="/sonara-cohesive-2027.js?v=cohesive-ui-20260719"></script>\n  </head>';
if (source.includes(cohesiveAnchor)) {
  source = source.replace(cohesiveAnchor, `    <script defer src="/sonara-cohesive-2027.js?v=cohesive-ui-20260719"></script>\n${assetMarkup}\n  </head>`);
} else if (!source.includes('/sonara-builder-2027.css')) {
  const headClose = "  </head>";
  if (!source.includes(headClose)) {
    console.error("Unable to locate document head close tag.");
    process.exit(1);
  }
  source = source.replace(headClose, `${assetMarkup}\n${headClose}`);
}

fs.writeFileSync(serverPath, source);
console.log("SONARA advanced builder presentation applied after the accepted runtime and cohesive compatibility layer.");
