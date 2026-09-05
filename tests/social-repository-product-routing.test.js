"use strict";

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");
const { readOpenSourceTools } = require("../lib/sonara-open-source-registry.cjs");
const {
  BATCH_SLUGS,
  getSocialRepositoryProductPlacements,
  getPlacementCounts,
  customerAvailability
} = require("../lib/sonara-social-repository-product-routing.cjs");

describe("customer-facing technology reference routing", () => {
  const records = readOpenSourceTools();

  it("routes all 35 verified repositories exactly once", () => {
    const placements = getSocialRepositoryProductPlacements(records);
    assert.equal(placements.length, 35);
    assert.equal(new Set(placements.map((placement) => placement.slug)).size, 35);
    assert.deepEqual(new Set(placements.map((placement) => placement.slug)), new Set(BATCH_SLUGS));
    assert.equal(placements.every((placement) => placement.record), true);
    assert.deepEqual(getPlacementCounts(records), {
      shared_platform: 21,
      creator_studio: 9,
      business_builder: 4,
      growth_studio: 1
    });
  });

  it("renders the shared radar and protects each customer-business module", async () => {
    const shared = await request(app).get("/technology-radar").set("Accept", "text/html");
    assert.equal(shared.status, 200);
    assert.match(shared.text, /Reviewed technology references/i);
    assert.match(shared.text, /not installed customer integrations/i);

    for (const route of ["/business-builder/technology", "/creator-studio/technology", "/growth-studio/technology"]) {
      const response = await request(app).get(route).set("Accept", "text/html").redirects(0);
      assert.notEqual(response.status, 200, `${route} admitted a signed-out visitor`);
      assert.ok([301, 302, 303, 307, 308, 401, 403, 503].includes(response.status), `${route} returned ${response.status}`);
    }
  });

  it("links every product tool directory to its truthful technology module", async () => {
    for (const product of ["business-builder", "creator-studio", "growth-studio"]) {
      const response = await request(app).get(`/${product}/tools`).set("Accept", "text/html");
      assert.equal(response.status, 200);
      assert.match(response.text, new RegExp(`href="/${product}/technology"`));
      assert.match(response.text, /references, research, or unavailable/i);
    }
  });

  it("never presents blocked records as available", () => {
    const blocked = records.find((record) => record.slug === "openvid-browser-product-demo-editor");
    assert.equal(customerAvailability(blocked), "Not available — blocked");
    assert.equal(customerAvailability(records.find((record) => record.slug === "google-sam-agent-mesh-research")), "Not available — security review required");
  });
});
