"use strict";

// Static assets used to be served with express.static's default,
// `Cache-Control: public, max-age=0`. Checked against production on
// 2026-07-28, every stylesheet, script and logo came back that way, so a
// browser revalidated all of them on every navigation -- a round trip per
// asset before the page could paint.
//
// These tests hold the fix in place. It is the kind of thing that silently
// reverts: a max-age=0 header looks like a header, and nothing about a working
// page tells you the browser is asking again every time.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");

const app = require("../server");
const root = path.join(__dirname, "..");

// The version token the renderers put on their asset links.
const VERSIONED = "/sonara-one.js?v=sonara-ui-20260725-v6-motion3";

describe("static asset caching", () => {
  it("caches a versioned asset for a year", async () => {
    const response = await request(app).get(VERSIONED);
    assert.equal(response.status, 200);
    assert.match(
      response.headers["cache-control"] || "",
      /max-age=31536000/,
      "a versioned URL changes when the file changes, so it can be cached indefinitely"
    );
    assert.match(response.headers["cache-control"] || "", /immutable/);
  });

  it("gives an unversioned asset a short life rather than a year", async () => {
    const response = await request(app).get("/favicon.svg");
    assert.equal(response.status, 200);
    const cacheControl = response.headers["cache-control"] || "";
    assert.match(cacheControl, /max-age=300/, "an unversioned asset must be able to self-heal");
    assert.match(cacheControl, /stale-while-revalidate/);
    assert.doesNotMatch(cacheControl, /immutable/);
  });

  it("never serves an asset with max-age=0", async () => {
    for (const asset of ["/sonara-design-system.css", "/sonara-application-ui.css", "/sonara-experience-controls.js"]) {
      const response = await request(app).get(asset);
      assert.equal(response.status, 200, `${asset} must be served`);
      assert.doesNotMatch(
        response.headers["cache-control"] || "",
        /max-age=0/,
        `${asset} is back to revalidating on every page view`
      );
    }
  });

  it("does not cache a missing file", async () => {
    // The header is set from setHeaders, which only runs for a real file.
    // Middleware would have stamped it on the 404 too, pinning a transient
    // miss for a year.
    for (const missing of ["/no-such-asset.js?v=1", "/no-such-asset.js"]) {
      const response = await request(app).get(missing);
      assert.equal(response.status, 404);
      assert.doesNotMatch(
        response.headers["cache-control"] || "",
        /max-age=31536000/,
        `${missing} does not exist and must not be cached for a year`
      );
    }
  });

  it("keeps rendered pages uncacheable", async () => {
    // Every page carries the signed-in navigation. A shared cache holding one
    // would hand a signed-in header to the next anonymous visitor.
    for (const page of ["/", "/pricing", "/dashboard", "/account"]) {
      const response = await request(app).get(page).set("accept", "text/html");
      if (response.status !== 200) continue;
      assert.match(
        response.headers["cache-control"] || "",
        /no-store/,
        `${page} renders per-visitor navigation and must not be stored`
      );
    }
  });

  it("still sends validators so an expired asset costs 304 rather than a full body", async () => {
    const response = await request(app).get("/sonara-design-system.css");
    assert.ok(response.headers.etag || response.headers["last-modified"], "static assets need a validator");
  });

  it("versions every asset the renderers ask to be cached forever", () => {
    // If a renderer links an asset without ?v=, it lands in the five-minute
    // bucket. That is correct but slower, so the mismatch should be visible.
    const runtime = [
      fs.readFileSync(path.join(root, "server.js"), "utf8"),
      ...fs
        .readdirSync(path.join(root, "routes"))
        .filter((name) => name.endsWith(".cjs"))
        .map((name) => fs.readFileSync(path.join(root, "routes", name), "utf8"))
    ].join("\n");

    const versionTokens = new Set([...runtime.matchAll(/\?v=([\w.-]+)/g)].map((match) => match[1]));
    assert.equal(
      versionTokens.size,
      1,
      `every long-cached asset must share one version token, found: ${[...versionTokens].join(", ")}`
    );
  });
});
