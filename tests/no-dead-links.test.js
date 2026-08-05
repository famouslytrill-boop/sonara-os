"use strict";

// Every link on every page that a customer can load has to go somewhere.
//
// /research-lab/open-source was linked from /research-lab/huggingface and
// /research-lab/requested-repositories and returned 404 in production. The
// register behind it -- data/open-source-tools.ts, thirty-nine reviewed
// repositories, gated on every release -- had no page at all. So the work
// existed, the gate checked it, and the two links pointing at it were dead.
//
// The existing link checks did not catch it. The reason is worth recording,
// because it is the same shape as several other blind spots in this suite:
// they read links out of a fixed list of pages rather than out of every page
// the router serves, so a link on a page nobody thought to list is invisible.
//
// This crawls the router instead. Every registered GET page without a path
// parameter is fetched; every internal href on every page that returns 200 is
// followed; anything that 404s or errors fails the test.
//
// Protected pages redirect to /login for a logged-out crawl, which is correct
// and is why a 303 is a pass here. What is checked is that no link leads
// nowhere, not that everything is readable without an account.

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");

function registeredPages() {
  const routes = [];
  (function walk(stack) {
    for (const layer of stack) {
      if (layer.route) routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
      else if (layer.handle && layer.handle.stack) walk(layer.handle.stack);
    }
  })(app._router ? app._router.stack : app.router.stack);
  return [...new Set(routes.filter((route) => route.methods.includes("get")).map((route) => route.path))]
    .filter((route) => !route.includes(":"))
    .filter((route) => !route.startsWith("/api/"))
    .sort();
}

// A path that resolves: rendered, redirected, refused for auth, or gated on
// configuration this environment does not have.
//
// 503 counts as resolving, and that is a deliberate call rather than a
// loosening. This codebase uses 503 as its "not set up yet" signal everywhere
// -- sendSetupRequired, the auth routes, the recovery flow -- so a 503 means
// the route exists and is telling you what is missing. Locally /admin/login is
// 503 because the founder-access variables are unset; in production it is 200.
// /auth/callback is 503 in both, because Google sign-in is deferred, and that
// is the honest answer rather than a broken page.
//
// 404 and 5xx-other are what a dead link looks like: nothing is there, and
// nothing is going to tell you why.
function resolves(status) {
  if (status === 503) return true;
  return status !== 404 && status < 500;
}

describe("no dead links", () => {
  const pages = registeredPages();
  const seen = new Map();

  async function statusOf(url) {
    if (seen.has(url)) return seen.get(url);
    const res = await request(app).get(url).set("Accept", "text/html").redirects(0);
    seen.set(url, res.status);
    return res.status;
  }

  it("finds enough pages to be crawling something", () => {
    assert.ok(pages.length >= 200, `only ${pages.length} pages found; this check has gone blind`);
  });

  it("serves every registered page without a 404 or a server error", async function () {
    this.timeout(120000);
    const broken = [];
    for (const page of pages) {
      const status = await statusOf(page);
      if (!resolves(status)) broken.push(`${status}  ${page}`);
    }
    assert.deepEqual(broken, [], `these registered pages do not resolve:\n  ${broken.join("\n  ")}`);
  });

  it("follows every internal link on every page that renders", async function () {
    this.timeout(180000);
    const broken = new Map();
    for (const page of pages) {
      if ((await statusOf(page)) !== 200) continue;
      const res = await request(app).get(page).set("Accept", "text/html");
      const hrefs = [...new Set([...res.text.matchAll(/href="(\/[^"#?]*)"/g)].map((match) => match[1]))];
      for (const href of hrefs) {
        const status = await statusOf(href);
        if (resolves(status)) continue;
        if (!broken.has(href)) broken.set(href, { status, from: [] });
        broken.get(href).from.push(page);
      }
    }
    const report = [...broken].map(([href, info]) => `${info.status}  ${href}  (linked from ${info.from.length}: ${info.from.slice(0, 3).join(", ")})`);
    assert.deepEqual(report, [], `these links lead nowhere:\n  ${report.join("\n  ")}`);
  });

  it("serves the page that two research-lab pages had been linking into a 404", async () => {
    // The specific regression. Both links existed for as long as the page did
    // not.
    const res = await request(app).get("/research-lab/open-source").set("Accept", "text/html");
    assert.equal(res.status, 200);
    for (const source of ["/research-lab/huggingface", "/research-lab/requested-repositories"]) {
      const page = await request(app).get(source).set("Accept", "text/html");
      assert.equal(page.status, 200, `${source} does not render`);
      assert.match(page.text, /href="\/research-lab\/open-source"/, `${source} no longer links to the register`);
    }
  });

  it("renders every record the release gate checks", async () => {
    // A page showing fewer records than the gate validates would be a quieter
    // version of the same problem: the register looks complete and is not.
    const { readOpenSourceTools } = require("../lib/sonara-open-source-registry.cjs");
    const tools = readOpenSourceTools();
    assert.ok(tools.length >= 30, `only ${tools.length} records parsed; this check has gone blind`);

    const res = await request(app).get("/research-lab/open-source").set("Accept", "text/html");
    const rows = (res.text.match(/<tr>/g) || []).length - 1; // minus the header row
    assert.equal(rows, tools.length, `the page shows ${rows} records and the register holds ${tools.length}`);
  });

  it("parses the register the same way the release gate does", () => {
    // Two readers of one file that disagree is how a page starts showing a
    // different register from the one being gated.
    const fs = require("node:fs");
    const path = require("node:path");
    const source = fs.readFileSync(path.join(__dirname, "..", "data", "open-source-tools.ts"), "utf8");
    const gateBlocks = [...source.matchAll(/\{\s*\n\s*name:\s*"[^"]+"[\s\S]*?\n\s*\},/g)].length;
    const { readOpenSourceTools } = require("../lib/sonara-open-source-registry.cjs");
    assert.equal(readOpenSourceTools().length, gateBlocks, "the page and scripts/verify-open-source-registry.mjs disagree about how many records exist");
  });

  it("does not link out to an unresolved repository placeholder", async () => {
    // data/open-source-tools.ts still holds entries whose repoUrl is a bare
    // https://github.com/ -- the release gate reports them as warnings. Turning
    // those into anchors would ship dead links from the page whose job is to
    // stop them, which is why the register table renders the URL as text.
    const res = await request(app).get("/research-lab/open-source").set("Accept", "text/html");
    assert.doesNotMatch(res.text, /href="https:\/\/github\.com\/"/, "the page links to a bare github.com placeholder");
  });
});
