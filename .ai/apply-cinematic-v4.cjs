"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function write(relative, content) {
  fs.writeFileSync(path.join(root, relative), content);
}

let styles = read("ui/nexus/styles/99-sonara-cinematic-system.css");
styles = styles.replace(
  ".sonara-interface-face,.sonara-proof-pill,.sonara-quick-bar,.sonara-command-button,.sonara-utility-dock",
  ".sonara-interface-face,.sonara-proof-pill,.sonara-command-button,.sonara-utility-dock"
);
write("ui/nexus/styles/99-sonara-cinematic-system.css", styles);

let patcher = read("scripts/apply-premium-ui-final.cjs");
const readinessLink = '<a class="action" href="/readiness">Readiness</a>';
if (!patcher.includes('href="/requests"')) {
  if (!patcher.includes(readinessLink)) throw new Error("Homepage readiness action was not found");
  patcher = patcher.replace(
    readinessLink,
    `${readinessLink}<a class="action" href="/requests">Requests</a><a class="action" href="/deliverables">Deliverables</a>`
  );
}
patcher = patcher.replace('eyebrow: "SONARA NEXUS"', 'eyebrow: "LAUNCH OPERATING SYSTEM"');
patcher = patcher.replace(
  "SONARA connects identity, organization access, saved records, billing, requests, delivery, and support without inventing activity or hiding setup requirements.",
  "SONARA is Software-in-a-Service built around identity, organization access, saved records, billing, requests, delivery, and support—without inventing activity or hiding setup requirements."
);
const oldMainPatcher = `.replace('<main id="sonara-main">', '<main id="sonara-main" data-sonara-interface="live" data-layout-contract="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); overflow-wrap: anywhere; word-break: break-word">');`;
const newMainPatcher = `.replace(/<main id="sonara-main"[^>]*>/, '<main id="sonara-main" data-sonara-interface="live" data-layout-contract="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); overflow-wrap: anywhere; word-break: break-word">');`;
if (patcher.includes(oldMainPatcher)) patcher = patcher.replace(oldMainPatcher, newMainPatcher);
if (!patcher.includes(newMainPatcher)) throw new Error("Canonical main-element normalizer is missing");
write("scripts/apply-premium-ui-final.cjs", patcher);

const testDirectory = path.join(root, "tests");
for (const name of fs.readdirSync(testDirectory)) {
  if (!name.endsWith(".js")) continue;
  const relative = path.join("tests", name);
  let source = read(relative);
  source = source.replaceAll("nexus-ui-20260720-v3", "nexus-ui-20260721-v4");
  source = source.replaceAll('"Make work move."', '"Build, create, and grow—without losing control."');
  source = source.replaceAll("/Make work move\\./", "/Build, create, and grow—without losing control\\./");
  source = source.replaceAll("/One operating layer\\. Three focused workspaces\\./", "/One system\\. Three focused ways to move\\./");
  source = source.replaceAll("/FORGE MODE/", "/FORGE/");
  source = source.replaceAll("/CANVAS MODE/", "/CANVAS/");
  source = source.replaceAll("/SIGNAL MODE/", "/SIGNAL/");
  source = source.replaceAll('/haptics\\s*:\\s*"on"/', '/haptics\\s*:\\s*"off"/');
  source = source.replaceAll('/preferences\\.haptics\\s*===\\s*"on"/', '/preferences\\.haptics\\s*!==\\s*"on"/');
  source = source.replaceAll('/language:"en"/', '/language\\s*:\\s*"en"/');
  write(relative, source);
}

for (const relative of [
  "tests/cohesive-2027-ui.test.js",
  "tests/premium-interface.test.js",
  "tests/advanced-builder-ui.test.js",
  "tests/premium-access-experience.test.js",
  "tests/premium-application.test.js",
  "tests/nexus-experience.test.js"
]) {
  const source = read(relative);
  if (source.includes("nexus-ui-20260720-v3")) throw new Error(`Stale asset version remains in ${relative}`);
}

const nexusTest = read("tests/nexus-experience.test.js");
if (!nexusTest.includes('haptics\\s*:\\s*"off"')) throw new Error("Haptics default test was not updated");
if (!nexusTest.includes('preferences\\.haptics\\s*!==\\s*"on"')) throw new Error("Haptics opt-in test was not updated");

console.log("Updated SONARA cinematic v4 source and test contracts.");
