// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server.js");
const { renderProductEntry } = require("../lib/sonara-product-entry.cjs");

describe("studio entry paths are real", () => {
  for (const slug of ["business-builder", "creator-studio", "growth-studio"]) {
    it(`${slug} has a complete entry and registered destinations`, async () => {
      const response = await request(app).get(`/${slug}`);
      assert.equal(response.status, 200);
      assert.match(response.text, /class="[^\"]*sonara-product-entry/);
      assert.match(response.text, /aria-label="[^"]*workflow destinations"/);
      assert.match(response.text, /Sign in to save your work/);
      assert.match(response.text, /sonara-product-entry\.css/);
      const entry = response.text.match(/<nav class="product-entry-map"[\s\S]*?<\/nav>/)[0];
      const paths = response.text.match(/<section class="product-entry-paths"[\s\S]*?<\/section>/)[0];
      const destinations = [...new Set([...`${entry}${paths}`.matchAll(/href="([^"]+)"/g)].map((match) => match[1]))];
      assert.ok(destinations.length >= 4, "the entry must expose real work, not one repeated destination");
      for (const destination of destinations) {
        const target = await request(app).get(destination).set("Accept", "text/html");
        assert.ok([200, 302, 303, 401, 402, 403].includes(target.status), `${destination}: unexpected HTTP ${target.status}`);
        assert.notEqual(target.status, 404);
      }
      const hero = response.text.match(/<section class="hero sonara-hero-stage"[\s\S]*?<\/section>/)[0];
      assert.equal([...hero.matchAll(/class="action"/g)].length, 3, "the first decision must stay focused");
    });
  }
  it("escapes descriptions and rejects an unknown product", () => {
    const rendered = renderProductEntry("business-builder", { name: '<script>alert("x")</script>', audience: "<img onerror=x>", cards: [["<b>title</b>", "<script>x</script>"]] });
    assert.doesNotMatch(rendered.sections.join(""), /<script>|<img onerror|<b>title/);
    assert.match(rendered.sections.join(""), /&lt;script&gt;/);
    assert.throws(() => renderProductEntry("unknown", {}), RangeError);
  });
});
