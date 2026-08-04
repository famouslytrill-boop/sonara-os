"use strict";

// The asset cache-busting token, read from the page frame rather than typed out.
//
// Five test files used to pin it as a literal (/sonara-one\.js\?v=sonara-ui-20260725-v6/),
// and public/sw.js pinned its own copy in a sixth. Bumping the token therefore
// broke six tests at once, so it was easier not to bump it -- and the service
// worker's cache version drifted two releases behind the rendered token while
// its comment claimed the two stayed aligned.
//
// That is backwards. These tests exist to check that pages link versioned
// assets, not to freeze which version. Deriving the token here means a bump is
// a one-line change in lib/sonara-page-frame.cjs, and tests/asset-version.test.js
// is the single place that checks every copy of it agrees.

const fs = require("node:fs");
const path = require("node:path");

const frame = fs.readFileSync(path.join(__dirname, "..", "..", "lib", "sonara-page-frame.cjs"), "utf8");

const ASSET_VERSION = (frame.match(/\/sonara-design-system\.css\?v=([A-Za-z0-9._-]+)/) || [])[1];

if (!ASSET_VERSION) throw new Error("no ?v= asset token found in lib/sonara-page-frame.cjs");

function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Matches `<name>?v=<current token>` as rendered into a page.
function assetUrlPattern(assetName) {
  return new RegExp(`${escapeForRegExp(assetName)}\\?v=${escapeForRegExp(ASSET_VERSION)}`);
}

module.exports = { ASSET_VERSION, assetUrlPattern };
