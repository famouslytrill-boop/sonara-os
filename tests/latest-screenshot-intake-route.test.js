"use strict";

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");

describe("latest screenshot intake research surface", () => {
  it("renders Batch 5 and Batch 6 as non-executing governed research", async () => {
    const response = await request(app).get("/research-lab/latest-screenshot-intake");
    assert.equal(response.status, 200);
    assert.match(response.text, /2026-09-14 governed screenshot intake/i);
    assert.match(response.text, /Social Analyzer/i);
    assert.match(response.text, /TradingAgents/i);
    assert.match(response.text, /diagram-design/i);
    assert.match(response.text, /Claude Ads/i);
    assert.match(response.text, /Terrain/i);
    assert.match(response.text, /Revealer\.US/i);
    assert.match(response.text, /0 latest-intake repositories are enabled/i);
  });

  it("links the existing repository intake page to the latest research", async () => {
    const response = await request(app).get("/research-lab/requested-repositories");
    assert.equal(response.status, 200);
    assert.match(response.text, /\/research-lab\/latest-screenshot-intake/);
    assert.match(response.text, /Latest screenshot intake/i);
  });
});
