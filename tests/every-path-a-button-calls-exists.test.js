"use strict";

// The paths a button reaches through JavaScript rather than through HTML.
//
// Three crawls now read the rendered surface: no-dead-links follows every
// `href`, every-form-posts-somewhere reads every `<form action>` in the empty
// state, and every-row-control-reaches-a-handler seeds a row and reads the
// controls that only exist once an account has data. All three read HTML.
//
// A button wired to `fetch()` is invisible to every one of them. The path lives
// in a client bundle, the click calls it, and nothing in the markup says where
// it went. So this reads the bundles.
//
// ## What is in the population, and why that is the interesting part
//
// Only the client files a page actually loads. That is not a convenience: it is
// the distinction that made the first run of this check meaningful.
//
// `public/creator-music-system.js` was the first finding and is the reason the
// population is defined this way. It declared eleven endpoints --
// /api/creator/artist-systems, /api/creator/voice-profiles and nine more -- and
// not one was a registered route. It would have been eleven dead buttons except
// that no page loaded the file, while /creator-studio/music-system/new told the
// customer in prose to use that helper "with the Creator Studio API routes to
// save real records": a promise neither end could keep.
//
// It is gone -- the file, the eleven declarations in
// lib/creator-music-system-config.cjs, and the sentence -- and
// scripts/report-declared-api-paths-nothing-serves.mjs now fails on a declared
// /api path the running application does not serve, so the shape cannot come
// back through a config module instead of a bundle.
//
// ## Concatenation, which is how a naive version of this lies
//
// `"/signals"` and `"/status"` appear as literals in sonara-call.js and resolve
// to nothing. They are not paths: the source says
// `api("/api/calls/" + encodeURIComponent(callId) + "/status", ...)`, so the
// literal is a fragment of a path built at runtime. A check that treated every
// quoted string starting with `/` as a path would report two dead endpoints that
// are both registered and both fine. Fragments adjacent to a `+` are therefore
// out of scope, and the count of what was skipped for that reason is asserted so
// the exclusion cannot quietly grow to cover a real one.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");

const root = path.join(__dirname, "..");
const app = require("../server");

// Measured 29 September 2026.
const MINIMUM_CLIENT_FILES = 10;
const MINIMUM_LITERALS = 30;

function registeredRoutes() {
  const routes = [];
  (function walk(stack) {
    for (const layer of stack) {
      if (layer.route) routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
      else if (layer.handle && layer.handle.stack) walk(layer.handle.stack);
    }
  })(app._router ? app._router.stack : app.router.stack);
  return routes;
}

function matcher(routePath) {
  const source = routePath
    .split("/")
    .map((segment) => (segment.startsWith(":") ? "[^/]+" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${source}$`);
}

function staticFiles() {
  const found = new Set();
  (function walk(dir, prefix) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name), `${prefix}/${entry.name}`);
      else found.add(`${prefix}/${entry.name}`);
    }
  })(path.join(root, "public"), "");
  return found;
}

// A literal is a path only if the source does not build a larger string out of
// it. `"/api/calls/" + id + "/status"` makes fragments of both ends.
function pathLiterals(source) {
  const literals = [];
  for (const match of source.matchAll(/"(\/[a-zA-Z0-9][a-zA-Z0-9._~/-]*)"/g)) {
    const before = source.slice(Math.max(0, match.index - 3), match.index);
    const after = source.slice(match.index + match[0].length, match.index + match[0].length + 3);
    const concatenated = /\+\s*$/.test(before) || /^\s*\+/.test(after);
    literals.push({ value: match[1], concatenated });
  }
  return literals;
}

// Which client bundles a page actually serves, measured by rendering pages and
// reading the script tags out of the response.
//
// The first version of this grepped the route sources for `<script src=`, and it
// was wrong in the way this repository keeps being wrong. It reported
// creator-music-system.js as loaded, because
// routes/creator-music-system-readonly.cjs contained
// `<script src="/creator-music-system.js"></script>` inside `basicLayout` -- a
// fallback used only when a caller passes no layout, and
// `const layout = deps.layout || basicLayout` always receives the real one. The
// tag was in the source and reached no browser: all of that surface's routes
// were fetched and none served it. Both the tag and the file have since been
// removed, but the lesson is why this function renders pages instead of grepping
// them.
//
// So loadedness is a fact about a response, not about a file. Matching text
// found a tag that does not exist at runtime, exactly as matching the route
// table once reported nine static assets as dead links that all answer 200.
async function loadedClientFiles(pages, target = app) {
  const loaded = new Set();
  for (const page of pages) {
    let res;
    try {
      res = await request(target).get(page).set("Accept", "text/html");
    } catch {
      continue;
    }
    if (res.status !== 200) continue;
    if (!/text\/html/.test(res.headers["content-type"] || "")) continue;
    for (const match of res.text.matchAll(/<script[^>]*\bsrc="\/([A-Za-z0-9._-]+\.js)/g)) loaded.add(match[1]);
  }
  return loaded;
}

function crawlablePages(routes) {
  return [...new Set(routes.filter((route) => route.methods.includes("get")).map((route) => route.path))]
    .filter((route) => !route.includes(":"))
    .filter((route) => !route.startsWith("/api/"))
    .filter((route) => !route.startsWith("/admin"))
    .filter((route) => route !== "/auth/callback")
    .sort();
}

describe("every path a button calls through JavaScript exists", () => {
  const routes = registeredRoutes();
  const matchers = routes.map((route) => ({ re: matcher(route.path), methods: route.methods }));
  const assets = staticFiles();
  const clientFiles = fs.readdirSync(path.join(root, "public")).filter((n) => n.endsWith(".js"));
  let loaded = new Set();

  before(async function () {
    this.timeout(180000);
    loaded = await loadedClientFiles(crawlablePages(routes));
    // The project renderer exists only on a signed-in, parameterized page
    // with real timeline entries. Exercise the shipped route registrar with
    // injected storage rather than classifying its bundle as dead because
    // the anonymous empty-state crawl deliberately cannot reach it.
    const fixture = require("express")();
    const id = "00000000-0000-4000-8000-000000000001";
    const project = { id, title: "Recording", revision: 1, medium: "audio", graph: { version: 1, nodes: [
      { id, kind: "source", assetId: id, durationMs: 1000 },
      { id: "00000000-0000-4000-8000-000000000002", kind: "clip", sourceId: id, inMs: 0, outMs: 1000, startMs: 0, muted: false }
    ] } };
    require("../routes/sonara-creator-project-routes.cjs")(fixture, {
      projectStore: { get: async () => ({ ok: true, project }), assets: async () => ({ ok: true, rows: [] }) },
      requirePaidOrOwnerAccess: () => (_req, _res, next) => next(),
      layout: ({ sections }) => sections.join(""), brandCard: () => "", linkAction: () => "", escapeHtml: (text) => String(text).replace(/"/g, "&quot;")
    });
    for (const bundle of await loadedClientFiles([`/creator-studio/projects/${id}`], fixture)) loaded.add(bundle);
  });

  it("reads the bundles and the route table, so it is not passing on nothing", () => {
    assert.ok(
      clientFiles.length >= MINIMUM_CLIENT_FILES,
      `only ${clientFiles.length} client files found; the public/ walk has gone blind`
    );
    assert.ok(routes.length >= 500, `only ${routes.length} routes registered; the route walk has gone blind`);
    const total = clientFiles.reduce(
      (sum, name) => sum + pathLiterals(fs.readFileSync(path.join(root, "public", name), "utf8")).length,
      0
    );
    assert.ok(total >= MINIMUM_LITERALS, `only ${total} path literals found; the literal scan has gone blind`);
  });

  it("finds the bundles a page really serves", () => {
    assert.ok(
      loaded.size >= 4,
      `only ${loaded.size} client bundles appear in a served response; the scan for script tags has broken, ` +
        `which would put every bundle out of scope and make everything below vacuous`
    );
  });

  // Measured 29 September 2026, and the measurement is the point: not one of the
  // six served bundles contains a path literal. So this assertion examines
  // nothing today and says so rather than reading as though it verified
  // something. It is a forward guard -- the moment a served bundle gains a
  // `fetch("/...")`, that path has to resolve.
  it("resolves every path literal in a bundle a page serves", () => {
    const dead = [];
    let examined = 0;
    for (const name of clientFiles) {
      if (!loaded.has(name)) continue;
      for (const { value, concatenated } of pathLiterals(fs.readFileSync(path.join(root, "public", name), "utf8"))) {
        if (concatenated) continue;
        examined += 1;
        const trimmed = value.replace(/\/$/, "") || "/";
        if (assets.has(value) || assets.has(trimmed)) continue;
        if (matchers.some((candidate) => candidate.re.test(trimmed))) continue;
        dead.push(`${value}   (in public/${name})`);
      }
    }
    assert.deepEqual(
      dead,
      [],
      `${dead.length} path(s) in a served bundle resolve to no route and no file; a button wired to one does ` +
        `nothing and no HTML crawl can see it.\n  ${dead.join("\n  ")}`
    );
    // Recorded, not asserted as coverage: today this is zero.
    assert.equal(typeof examined, "number");
  });

  // The finding this file exists for, and it is two-sided on purpose.
  //
  // Client bundles that carry path literals and that no page serves. There were
  // six; creator-music-system.js was deleted rather than wired up, so there are
  // five, and the list below is what the crawl must find exactly. The
  // consequence is not cosmetic: public/sonara-experience.js line 57 holds the
  // ONLY `navigator.serviceWorker.register("/sw.js")` in the repository, so the
  // service worker is never installed, the offline precache never runs, and the
  // thirty-one paths in public/sw.js reach nothing. Fetching /, /pricing and
  // /free-tools confirms no served page mentions a service worker at all.
  //
  // Two-sided because a one-sided list rots: an orphan that appears must fail,
  // and an orphan that gets wired up must also fail, so nobody fixes one and
  // leaves a stale reason behind. docs/SPRINT_LOG.md carries the consequence of
  // each.
  it("accounts for every client bundle no page serves", () => {
    const ORPHANED = [
      // Registers /sw.js. Unserved, so the service worker never installs.
      "sonara-experience.js",
      // Sets theme-color, and tests/brand-palette.test.js asserts those values
      // match the palette -- a check whose subject no browser receives.
      "sonara-interface-engine.js",
      "sonara-builder-2027.js",
      "sonara-cohesive-2027.js",
      // Precache and offline page. Reached only through the registration above.
      "sw.js"
    ].sort();

    const carriesPaths = clientFiles.filter(
      (name) => pathLiterals(fs.readFileSync(path.join(root, "public", name), "utf8")).some((l) => !l.concatenated)
    );
    const unserved = carriesPaths.filter((name) => !loaded.has(name)).sort();

    assert.ok(carriesPaths.length >= 5, `only ${carriesPaths.length} bundles carry paths; the scan has gone blind`);
    assert.deepEqual(
      unserved,
      ORPHANED,
      "the set of path-carrying client bundles that no page serves has changed. A new name means a bundle went " +
        "dead; a missing name means one was wired up and its entry here, including the reason written beside it, " +
        "no longer describes anything."
    );
  });

  it("still has exactly one place that would register the service worker", () => {
    // If a second registrar appears, or this one moves into a served bundle, the
    // reasoning above stops holding and the note has to be rewritten.
    const registrars = clientFiles.filter((name) =>
      /navigator\.serviceWorker[\s\S]{0,80}\.register\(/.test(fs.readFileSync(path.join(root, "public", name), "utf8"))
    );
    assert.deepEqual(
      registrars,
      ["sonara-experience.js"],
      "the service-worker registration moved or multiplied; docs/SPRINT_LOG.md explains why its location decides " +
        "whether the offline precache runs at all"
    );
  });
});
