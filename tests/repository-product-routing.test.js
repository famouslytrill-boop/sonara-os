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

  function surfaceCountsFromLabels() {
    const counts = Object.fromEntries(Object.values(SURFACES).map((surface) => [surface.key, 0]));
    for (const record of records) {
      const surfaces = new Set(
        (record.productFit || [])
          .map((label) => FIT_LABEL_TO_SURFACE.get(label))
          .filter(Boolean)
          .map((surface) => surface.key)
      );
      if (surfaces.size === 0) surfaces.add(SURFACES.shared_platform.key);
      for (const key of surfaces) counts[key] += 1;
    }
    return counts;
  }

  it("places every governed record at least once without losing multi-product fit", () => {
    assert.ok(records.length >= 200, `only ${records.length} records read; this check has gone blind`);
    assert.deepEqual(new Set(placements.map(({ slug }) => slug)), new Set(records.map(({ slug }) => slug)));

    const derived = surfaceCountsFromLabels();
    assert.deepEqual(
      getRepositoryPlacementCounts(records),
      derived,
      "routing disagrees with FIT_LABEL_TO_SURFACE about where records belong"
    );
    assert.equal(
      placements.length,
      Object.values(derived).reduce((total, count) => total + count, 0),
      "the placement list and the per-surface totals do not describe the same set"
    );
    assert.deepEqual(unknownFitLabels(records), []);
  });

  it("keeps no-fit records visible only through Shared Platform governance", () => {
    const governanceOnly = records.filter((record) =>
      !(record.productFit || []).some((label) => FIT_LABEL_TO_SURFACE.get(label))
    );
    assert.ok(governanceOnly.length >= 1, "no governance-only records found; this case is checking nothing");
    for (const record of governanceOnly) {
      const homes = placements.filter(({ slug }) => slug === record.slug).map(({ surface }) => surface.key);
      assert.deepEqual(homes, [SURFACES.shared_platform.key], record.name);
    }
  });

  it("renders the whole registry and product-specific SONARA expansion plan", async () => {
    const app = express();
    registerOpenSourceRoutes(app, { requireCustomer: (req, res, next) => next() });

    const radar = await request(app).get("/technology-radar");
    assert.equal(radar.status, 200);
    const counts = getRepositoryPlacementCounts(records);
    assert.match(radar.text, new RegExp(`Shared SONARA platform \\(${counts.shared_platform}\\)`));
    assert.match(radar.text, /Superpowers/);
    assert.match(radar.text, /Reviewed reference only|Research reference only|Not available/);
    assert.match(radar.text, /SONARA-native expansion plan/);

    const expected = new Map([
      ["/business-builder/technology", counts.business_builder],
      ["/creator-studio/technology", counts.creator_studio],
      ["/growth-studio/technology", counts.growth_studio]
    ]);
    for (const count of expected.values()) {
      assert.ok(count >= 1, "a product surface routes no records at all; the page would render an empty table");
    }
    for (const [route, count] of expected) {
      const response = await request(app).get(route);
      assert.equal(response.status, 200);
      assert.match(response.text, new RegExp(`${count} external research records routed here`));
      assert.match(response.text, /None is connected to your account/);
      assert.match(response.text, /SONARA-native expansion plan/);
      assert.match(response.text, /Existing foundation|Requires configured provider|Planned next|Design only|Research only/);
    }
  });
});
