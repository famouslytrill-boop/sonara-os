"use strict";

// The starting points by trade, and the one way they could be worse than
// nothing: pointing somebody at a page that does not exist.
//
// business_vertical_templates has had columns since the platform redesign, and
// no rows and no reader. lib/sonara-subsystem-registry.cjs records it as
// "reference and reporting rather than a workspace" with the note that it "would
// fit the Business Builder setup flow if that gets built". Migration
// 20260819090000 seeds it and /business-builder/templates renders it.
//
// A template that linked to /business-builder/scheduling -- which sounds real
// and is not -- would be a starting point that starts with a 404, and the
// customer would reasonably conclude the product is broken rather than that the
// template is wrong. So every path in every seeded row is checked against the
// route registry.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ROUTE_REGISTRY } = require("../lib/sonara-route-registry.cjs");

const SEED = path.join(__dirname, "..", "supabase", "migrations", "20260819090000_seed_business_vertical_templates.sql");

describe("a starting point starts somewhere", () => {
  const sql = fs.readFileSync(SEED, "utf8");

  it("seeds enough trades to be worth showing", () => {
    const keys = [...sql.matchAll(/^\s*'([a-z_]+)',$/gm)].map((match) => match[1]);
    assert.ok(keys.length >= 6, `only ${keys.length} verticals are seeded; a list this short is a shorter list than a customer's trade`);
    assert.equal(new Set(keys).size, keys.length, "two verticals share a key, and the key is unique in the schema");
  });

  it("links only to pages this application actually serves", () => {
    const known = new Set(ROUTE_REGISTRY.map((record) => record.route));
    assert.ok(known.size > 200, `only ${known.size} routes were read; this check has gone blind`);
    const paths = [...new Set([...sql.matchAll(/"(\/[a-z0-9/-]+)"/g)].map((match) => match[1]))];
    assert.ok(paths.length >= 20, `only ${paths.length} paths were found in the seed; this check has gone blind`);
    const missing = paths.filter((route) => !known.has(route));
    assert.deepEqual(missing, [], `these starting points link to pages that do not exist:\n  ${missing.join("\n  ")}`);
  });

  it("does not switch anything on", () => {
    // A template says "a business like yours usually needs these" and the owner
    // decides. Turning features on from a dropdown labelled with somebody's
    // trade is how a customer ends up with pages they did not ask for.
    const route = fs.readFileSync(require.resolve("../routes/sonara-last9-routes.cjs"), "utf8");
    const start = route.indexOf("function registerVerticalTemplates");
    const end = route.indexOf("\nfunction isUuid", start);
    const body = route.slice(start, end);
    assert.ok(body.length > 500, "the templates handler was not found, so nothing below was checked");
    assert.doesNotMatch(body, /method:\s*"(POST|PATCH|PUT|DELETE)"/, "the templates page writes something");
    assert.match(body, /nothing is switched on|Nothing here switches/i, "the page does not tell the customer it changes nothing");
  });

  it("says a read failed rather than that there are no starting points", () => {
    const route = fs.readFileSync(require.resolve("../routes/sonara-last9-routes.cjs"), "utf8");
    const start = route.indexOf("function registerVerticalTemplates");
    const body = route.slice(start, route.indexOf("\nfunction isUuid", start));
    assert.match(body, /could not load the starting points/i, "a failed read renders as an empty list");
    // The two states have to read differently, or an outage looks like an empty
    // product.
    assert.match(body, /being prepared and none are available/i, "there is no separate wording for a genuinely empty list");
  });
});
