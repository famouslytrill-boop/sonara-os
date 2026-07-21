"use strict";

const fs = require("node:fs");
const path = require("node:path");

const serverPath = path.join(process.cwd(), "server.js");
if (!fs.existsSync(serverPath)) throw new Error("server.js not found");

let source = fs.readFileSync(serverPath, "utf8");
const marker = '<section class=\\"nexus-section sonara-status-panel\\" aria-label=\\"Truthful readiness\\">';
const quickAccess = `<section class="nexus-section sonara-status-panel" aria-label="Company quick access">
    <div class="nexus-section-head"><div><span class="nexus-kicker">Quick access</span><h2>Move directly into the work.</h2></div><p>Open the real workflow you need. Access, setup, and provider requirements remain enforced by the server.</p></div>
    <div class="nexus-product-grid"><article class="card"><h3>Business Builder</h3><p>Launch and operate the business.</p><div class="card-actions"><a class="action" href="/business-builder/dashboard">Dashboard</a><a class="action" href="/business-builder/intake">Intake</a></div></article><article class="card"><h3>Creator Studio</h3><p>Organize creative work and releases.</p><div class="card-actions"><a class="action" href="/creator-studio/assets">Assets</a><a class="action" href="/creator-studio/music-system">Music system</a></div></article><article class="card"><h3>Growth Studio</h3><p>Plan campaigns and follow-up.</p><div class="card-actions"><a class="action" href="/growth-studio/campaigns">Campaigns</a><a class="action" href="/growth-studio/leads">Leads</a></div></article></div>
  </section>

  `;
const escapedQuickAccess = JSON.stringify(quickAccess).slice(1, -1);

if (!source.includes('aria-label=\\"Company quick access\\"')) {
  if (!source.includes(marker)) throw new Error("Truthful readiness section not found");
  source = source.replace(marker, escapedQuickAccess + marker);
}

for (const route of [
  "/business-builder/dashboard",
  "/business-builder/intake",
  "/creator-studio/assets",
  "/creator-studio/music-system",
  "/growth-studio/campaigns",
  "/growth-studio/leads"
]) {
  if (!source.includes(`href=\\"${route}\\"`)) throw new Error(`Quick-access route missing: ${route}`);
}

fs.writeFileSync(serverPath, source);
console.log("SONARA cinematic quick access applied.");
