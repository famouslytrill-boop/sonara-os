// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const core = require("../public/creator-image-core.js");
const science = require("../lib/sonara-operations-science.cjs");
const register = require("../routes/sonara-account-profile-routes.cjs");

describe("bounded device image processing", () => {
  it("handles a 4K frame and refuses excessive dimensions, bytes and low-memory use", () => {
    const input = { width: 3840, height: 2160, inputBytes: 1000000 };
    const budget = core.imageBudget(input);
    assert.equal(budget.ok, true);
    assert.ok(budget.tileRows * input.width <= core.TILE_PIXELS);
    assert.equal(core.imageBudget({ ...input, deviceMemory: 2 }).ok, false);
    for (const change of [{ width: 8193 }, { width: 8192, height: 8192 }, { inputBytes: 20 * 1024 * 1024 + 1 }, { width: NaN }, { height: 0 }]) assert.equal(core.imageBudget({ ...input, ...change }).ok, false);
  });
  it("preserves alpha and source pixels while matching the integer formula", () => {
    const bytes = new Uint8ClampedArray(Array.from({ length: 256 * 4 }, (_, i) => i % 256));
    const source = bytes.slice();
    for (const percent of [0, 1, 50, 99, 100, 101, 150, 200]) {
      const result = core.scalePixels(bytes, percent);
      for (let i = 0; i < bytes.length; i++) assert.equal(result[i], i % 4 === 3 ? bytes[i] : Math.min(255, Math.floor((bytes[i] * percent + 50) / 100)));
    }
    assert.deepEqual(bytes, source);
    assert.throws(() => core.scalePixels(bytes, 0.5));
    assert.throws(() => core.scalePixels(new Uint8ClampedArray(core.TILE_PIXELS * 4 + 4), 100));
  });
});
describe("forecasts measured on later observations", () => {
  const prefix = [12, 14, 13, 16, 17, 19, 18, 21];
  it("does not use held-out observations to choose validation settings", () => {
    const first = science.forecastDemand([...prefix, 22, 24]);
    const changed = science.forecastDemand([...prefix, 600, 1]);
    const tuned = science.forecastDemand(prefix);
    for (const result of [first, changed]) {
      assert.equal(result.validation.alpha, tuned.alpha); assert.equal(result.validation.beta, tuned.beta);
      assert.equal(result.validation.trainingPeriods, 8); assert.equal(result.validation.periods, 2);
    }
    assert.notEqual(first.validation.meanAbsoluteError, changed.validation.meanAbsoluteError);
    const predicted = Math.max(0, tuned.level + tuned.trendPerPeriod);
    const level = tuned.alpha * 22 + (1 - tuned.alpha) * (tuned.level + tuned.trendPerPeriod);
    const trend = tuned.beta * (level - tuned.level) + (1 - tuned.beta) * tuned.trendPerPeriod;
    assert.equal(first.validation.meanAbsoluteError, (Math.abs(22 - predicted) + Math.abs(24 - Math.max(0, level + trend))) / 2);
    assert.equal(first.validation.naiveMeanAbsoluteError, (Math.abs(22 - 21) + Math.abs(24 - 22)) / 2);
  });
  it("distinguishes insufficient accuracy evidence from a fitted trend", () => {
    const result = science.forecastDemand(prefix);
    assert.equal(result.ok, true); assert.equal(result.validation.status, "insufficient_history"); assert.equal(result.beatsNaive, null);
  });
  it("refuses missing periods and malformed figures instead of changing time", () => {
    for (const bad of [null, "", true, -1, Infinity, "bad", 1e12 + 1]) assert.equal(science.forecastDemand([...prefix, bad, 20]).code, "invalid_history");
    const sparse = [...prefix]; sparse.length = 10;
    assert.equal(science.forecastDemand(sparse).code, "invalid_history");
  });
});
describe("fresh account device permissions", () => {
  const userId = "33333333-3333-4333-8333-333333333333";
  const previous = global.fetch;
  afterEach(() => { global.fetch = previous; });
  function appWith(signedIn = true) {
    const app = express();
    register(app, {
      layout: () => "", brandCard: () => "", linkAction: () => "", responsePage: () => "", escapeHtml: String,
      requireCustomer: (req, res, next) => { if (!signedIn) return res.status(401).json({ ok: false }); req.sonaraUser = { id: userId }; next(); },
      getSupabaseServerConfig: () => ({ ok: true, url: "https://example.invalid", serviceRoleKey: "test-only" }), supabaseHeaders: () => ({})
    });
    return app;
  }
  it("reads only the signed-in user, disables caching and returns no device labels", async () => {
    let asked;
    global.fetch = async (url) => { asked = url; return Response.json([{ capability: "camera", state: "granted", decided_at: "2026-10-04T00:00:00Z", device_label: "private" }]); };
    const result = await request(appWith()).get("/api/account/device-permissions?userId=another&organization_id=another").expect(200);
    assert.match(asked, new RegExp(`user_id=eq.${userId}`)); assert.doesNotMatch(asked, /another/);
    assert.equal(result.body.userId, userId); assert.equal(result.headers["cache-control"], "private, no-store");
    assert.equal(result.body.permissions.find((entry) => entry.key === "camera").allowed, true);
    assert.equal(result.body.permissions.find((entry) => entry.key === "microphone").allowed, false);
    assert.doesNotMatch(JSON.stringify(result.body), /device_label|test-only/);
  });
  it("refuses signed-out requests before reading records", async () => {
    global.fetch = async () => { throw new Error("must not be called"); };
    await request(appWith(false)).get("/api/account/device-permissions").expect(401);
  });
  it("fails closed on outages and malformed successful replies", async () => {
    for (const handler of [async () => { throw new Error("offline"); }, async () => Response.json({ rows: [] }), async () => Response.json([], { status: 500 })]) {
      global.fetch = handler;
      const result = await request(appWith()).get("/api/account/device-permissions").expect(503);
      assert.equal(result.body.code, "device_permissions_unreadable"); assert.equal(result.body.permissions, undefined);
    }
  });
});
