"use strict";

// One asset token, written out in eight places.
//
// Pages render /sonara-depth.js?v=<token>, the service worker precaches that
// exact URL, and two tests plus a launch gate assert the token. Nothing checked
// that all of them said the same thing.
//
// That mattered on 2026-08-04. A behaviour fix to public/sonara-depth.js needed
// the token bumped, or returning visitors would keep the old script -- the
// service worker precaches by exact URL and serves stale-while-revalidate, so a
// customer would get the buggy file for one more visit at minimum.
//
// Two things had gone wrong quietly:
//
//   The worker's own VERSION constant read
//   "clark-ui-20260718-preferences-motion3-customer-ready1" while the rendered
//   token read "sonara-ui-20260725-v6-motion3" -- two bumps behind, carrying a
//   retired name, directly under a comment saying "The cache version stays
//   aligned with the rendered asset token". Since CACHE_NAME derives from
//   VERSION and the activate handler deletes caches that do not match, a
//   VERSION that never changes means old entries are never swept.
//
//   The reason it never changed: tests/premium-application.test.js asserted the
//   literal string. Bumping the version failed the test, so nobody bumped it. A
//   test that pins a value it exists to let change is a lock, not a check.
//
// This file holds the invariant instead: every copy of the token agrees, and
// the worker's cache version is that same token.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

// The frame is the authority: it is what a browser actually requests.
const frame = read("lib/sonara-page-frame.cjs");
const TOKEN = (frame.match(/\/sonara-design-system\.css\?v=([A-Za-z0-9._-]+)/) || [])[1];

const FILES_CARRYING_THE_TOKEN = [
  "lib/sonara-page-frame.cjs",
  "public/sw.js",
  "public/sonara-fonts.css",
  "server.js",
  "scripts/verify-customer-ready-production-experience.mjs",
  "tests/motion-brand-system.test.js",
  "tests/asset-caching.test.js"
];

// A ?v= on a path that does not exist under public/ is a fixture, not an asset
// -- tests/asset-caching.test.js uses "/no-such-asset.js?v=1" on purpose to
// check the 404 path. Only real assets have to agree on the token.
function isRealAsset(assetPath) {
  return fs.existsSync(path.join(root, "public", assetPath.replace(/^\//, "")));
}

describe("the asset version token", () => {
  it("is readable from the page frame", () => {
    assert.ok(TOKEN, "no ?v= token found in lib/sonara-page-frame.cjs; this check has gone blind");
  });

  it("is the same everywhere it is written", () => {
    // Any ?v= value that is not the token, in any file that carries it. A
    // partial bump leaves pages asking for a URL the worker never precached.
    const disagreements = [];
    for (const file of FILES_CARRYING_THE_TOKEN) {
      const source = read(file);
      for (const match of source.matchAll(/(\/[A-Za-z0-9/._-]+)\?v=([A-Za-z0-9._-]+)/g)) {
        if (!isRealAsset(match[1])) continue;
        if (match[2] !== TOKEN) disagreements.push(`${file}: ${match[1]}?v=${match[2]}`);
      }
    }
    assert.deepEqual(disagreements, [], `these disagree with the frame's token ${TOKEN}: ${disagreements.join(", ")}`);
  });

  it("is what the service worker names its cache after", () => {
    const worker = read("public/sw.js");
    const version = (worker.match(/const VERSION = "([^"]+)";/) || [])[1];
    assert.ok(version, "the worker has no VERSION constant");
    assert.equal(version, TOKEN, "the worker's cache version and the rendered asset token have drifted apart, so old cache entries are never swept");
  });

  it("stages only URLs something actually requests", () => {
    // A URL the worker stages that no page or stylesheet asks for is fetched on
    // install and then never served -- dead weight that survives every sweep.
    //
    // This is how the font mismatch was found. The frame preloaded
    // /fonts/geist-latin.woff2?v=<token> and the worker staged the same URL,
    // but public/sonara-fonts.css asked for /fonts/geist-latin.woff2 with no
    // query at all. Three URLs, two resources: the preload and the precache
    // were for a URL the font-face rule never requested, so the browser
    // downloaded the font twice and the copy it actually used sat in the
    // five-minute bucket rather than the immutable one.
    const requested = new Set([
      ...[...frame.matchAll(/(?:href|src)="(\/[A-Za-z0-9/._-]+\?v=[A-Za-z0-9._-]+)"/g)].map((match) => match[1]),
      ...[...read("public/sonara-fonts.css").matchAll(/url\('(\/[A-Za-z0-9/._-]+\?v=[A-Za-z0-9._-]+)'\)/g)].map((match) => match[1])
    ]);
    const staged = new Set([...read("public/sw.js").matchAll(/"(\/[A-Za-z0-9/._-]+\?v=[A-Za-z0-9._-]+)"/g)].map((match) => match[1]));
    assert.ok(requested.size >= 5, `only ${requested.size} versioned assets found; this check has gone blind`);
    const orphaned = [...staged].filter((url) => !requested.has(url));
    assert.deepEqual(orphaned, [], `the worker precaches URLs nothing requests: ${orphaned.join(", ")}`);
  });

  it("preloads the same font URL the stylesheet asks for", () => {
    // A preload whose URL differs from the eventual request by even a query
    // string is a second download, not a head start. Chrome reports it as
    // "preloaded but not used" and the font still blocks on its own fetch.
    const preloaded = [...frame.matchAll(/rel="preload" href="([^"]+)"/g)].map((match) => match[1]);
    assert.ok(preloaded.length > 0, "nothing is preloaded; this check has gone blind");
    const fontCss = read("public/sonara-fonts.css");
    const unmatched = preloaded.filter((url) => !fontCss.includes(`url('${url}')`));
    assert.deepEqual(unmatched, [], `preloaded but never requested at that URL: ${unmatched.join(", ")}`);
  });

  it("carries no retired public name", () => {
    // The stale VERSION read "clark-ui-...". AGENTS.md keeps retired names out
    // of anything shipped, and this string is served to every visitor.
    assert.ok(!/clark/i.test(TOKEN), `the asset token carries a retired name: ${TOKEN}`);
    assert.ok(!/clark/i.test(read("public/sw.js")), "the service worker carries a retired name");
  });
});
