"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = process.cwd();

function fail(message) {
  throw new Error(message);
}

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function write(relative, content) {
  fs.writeFileSync(path.join(root, relative), content);
}

function replaceRange(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  if (start < 0) fail(`Missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) fail(`Missing end marker after ${startMarker}: ${endMarker}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

function wrapAdminRoute(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) fail(`Missing route: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) fail(`Missing route boundary: ${endMarker}`);
  let segment = source.slice(start, end);

  if (segment.startsWith(`${startMarker}, requireAdminAccess(`)) return source;

  const opening = ", (req, res) => {";
  const openingIndex = segment.indexOf(opening);
  if (openingIndex < 0) fail(`Unexpected route opening for ${startMarker}`);
  segment =
    segment.slice(0, openingIndex) +
    ", requireAdminAccess((req, res) => {" +
    segment.slice(openingIndex + opening.length);

  const closing = "\n});";
  const closingIndex = segment.lastIndexOf(closing);
  if (closingIndex < 0) fail(`Unexpected route closing for ${startMarker}`);
  segment = segment.slice(0, closingIndex) + "\n}));" + segment.slice(closingIndex + closing.length);

  return source.slice(0, start) + segment + source.slice(end);
}

let server = read("server.js");

server = wrapAdminRoute(
  server,
  'app.get("/infrastructure"',
  'app.get("/api/infrastructure/manifest"'
);
server = wrapAdminRoute(
  server,
  'app.get("/api/infrastructure/manifest"',
  'app.get("/api/infrastructure/readiness"'
);
server = wrapAdminRoute(
  server,
  'app.get("/api/infrastructure/readiness"',
  'app.get("/api/open-source/readiness"'
);

const contactRoute = `app.get("/contact", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "SONARA Industries",
      eyebrow: "Contact",
      heading: "Start from the right workspace.",
      body:
        "Choose a product workspace to start real work, or sign in to continue an existing request. Support is available inside each workspace so messages stay attached to the right product and account.",
      sections: [],
      actions: [
        linkAction("/login", "Log in"),
        linkAction("/business-builder", "Open Business Builder"),
        linkAction("/creator-studio", "Open Creator Studio"),
        linkAction("/growth-studio", "Open Growth Studio")
      ]
    })
  );
});

`;
server = replaceRange(server, 'app.get("/contact"', 'app.get("/security"', contactRoute);

const supportRoute = `app.get("/support", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "SONARA Industries Support",
      eyebrow: "Support",
      heading: "Support that stays with your work.",
      body:
        "Sign in and open the product workspace you need help with. Support messages and request history stay attached to the same account and product context.",
      sections: [],
      actions: [
        linkAction("/login", "Log in"),
        linkAction("/business-builder/support", "Business Builder support"),
        linkAction("/creator-studio/support", "Creator Studio support"),
        linkAction("/growth-studio/support", "Growth Studio support")
      ]
    })
  );
});

`;
server = replaceRange(server, 'app.get("/support"', "function registerProductSupportPage", supportRoute);

server = server
  .replace('  ["/contact", "Contact"],\n', "")
  .replace('  ["/support", "Support"],\n', "");

if (server.includes('app.post("/contact"')) fail("Anonymous contact POST still exists");
if (server.includes('app.post("/support/request"')) fail("Anonymous support POST still exists");
for (const route of [
  'app.get("/infrastructure", requireAdminAccess(',
  'app.get("/api/infrastructure/manifest", requireAdminAccess(',
  'app.get("/api/infrastructure/readiness", requireAdminAccess('
]) {
  if (!server.includes(route)) fail(`Admin wrapper missing: ${route}`);
}
write("server.js", server);

const rejectedTests = [
  "tests/premium-access-experience.test.js",
  "tests/premium-application.test.js",
  "tests/route-registry.test.js",
  "tests/server.test.js"
];

for (const relative of rejectedTests) {
  const reject = path.join(root, ".ai", "patch-rejects", `${relative}.rej.txt`);
  if (!fs.existsSync(reject)) fail(`Missing preserved reject: ${reject}`);
  const result = spawnSync("patch", ["-p1", "--batch", "--forward", "--fuzz=3"], {
    cwd: root,
    input: fs.readFileSync(reject),
    encoding: "utf8"
  });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) fail(`Unable to reconcile ${relative}`);
}

const checks = [
  ["tests/premium-access-experience.test.js", /protects infrastructure diagnostics from public access/],
  ["tests/route-registry.test.js", /Request processing failed\./],
  ["tests/server.test.js", /POST \/contact is not registered/],
  ["tests/server.test.js", /POST \/support\/request is not registered/],
  ["tests/server.test.js", /keeps support informational and free of backend configuration details/]
];
for (const [relative, pattern] of checks) {
  if (!pattern.test(read(relative))) fail(`Expected reconciliation missing in ${relative}: ${pattern}`);
}

fs.rmSync(path.join(root, ".ai", "patch-rejects"), { recursive: true, force: true });
for (const relative of rejectedTests) {
  const original = path.join(root, `${relative}.orig`);
  const reject = path.join(root, `${relative}.rej`);
  fs.rmSync(original, { force: true });
  fs.rmSync(reject, { force: true });
}

console.log("Reconciled uploaded SONARA patch overlaps while preserving newer production fixes.");
