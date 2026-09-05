"use strict";

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerOpenSourceRoutes = require("../routes/sonara-open-source-routes.cjs");
const { readOpenSourceTools } = require("../lib/sonara-open-source-registry.cjs");
const {
  FIT_LABEL_TO_SURFACE,
  SURFACES,
  getRepositoryProductPlacements,
  getRepositoryPlacementCounts,
  unknownFitLabels
} = require("../lib/sonara-repository-product-routing.cjs");

describe("the full repository register has customer-facing governance homes", () => {
  const records = readOpenSourceTools();
  const placements = getRepositoryProductPlacements(records);

  it("places every governed record at least once without losing multi-product fit", () => {
    assert.equal(records.length, 217);
    assert.equal(placements.length, 306);
    assert.deepEqual(new Set(placements.map(({ slug }) => slug)), new Set(records.map(({ slug }) => slug)));
    assert.deepEqual(getRepositoryPlacementCounts(records), {
      shared_platform: 164,
      creator_studio: 51,
      growth_studio: 36,
      business_builder: 55
    });
    assert.deepEqual(unknownFitLabels(records), []);
  });

  it("keeps no-fit records visible only through Shared Platform governance", () => {
    const governanceOnly = records.filter((record) =>
      !(record.productFit || []).some((label) => FIT_LABEL_TO_SURFACE.get(label))
    );
    assert.equal(governanceOnly.length, 42);
    for (const record of governanceOnly) {
      const homes = placements.filter(({ slug }) => slug === record.slug).map(({ surface }) => surface.key);
      assert.deepEqual(homes, [SURFACES.shared_platform.key], record.name);
    }
  });

  it("renders the whole registry across the shared and product reference modules", async () => {
    const app = express();
    registerOpenSourceRoutes(app, { requireCustomer: (req, res, next) => next() });

    const radar = await request(app).get("/technology-radar");
    assert.equal(radar.status, 200);
    assert.match(radar.text, /Shared SONARA platform \(164\)/);
    assert.match(radar.text, /Superpowers/);
    assert.match(radar.text, /Reviewed reference only|Research reference only|Not available/);

    const expected = new Map([
      ["/business-builder/technology", 55],
      ["/creator-studio/technology", 51],
      ["/growth-studio/technology", 36]
    ]);
    for (const [route, count] of expected) {
      const response = await request(app).get(route);
      assert.equal(response.status, 200);
      assert.match(response.text, new RegExp(`${count} records routed here`));
      assert.match(response.text, /None is connected to your account/);
    }
  });
});
