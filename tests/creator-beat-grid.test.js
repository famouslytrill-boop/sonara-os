// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const { FRAME_RATES, planBeatGrid, beatGridCsv } = require("../lib/sonara-creator-beat-grid.cjs");
const registerCreatorProjectRoutes = require("../routes/sonara-creator-project-routes.cjs");

describe("Creator music-to-picture beat grid", () => {
  it("calculates exact 24 fps markers at 120 BPM without cumulative rounding", () => {
    const grid = planBeatGrid({ bpm: 120, beatsPerBar: 4, bars: 16, frameRate: "24" });
    assert.equal(grid.durationFrames, 768);
    assert.equal(grid.approximateDurationSeconds, 32);
    assert.deepEqual(grid.markers[0], { bar: "1", beat: 0, frame: 0, seconds: 0 });
    assert.deepEqual(grid.markers[1], { bar: "2", beat: 4, frame: 48, seconds: 2 });
    assert.deepEqual(grid.markers.at(-1), { bar: "END", beat: 64, frame: 768, seconds: 32 });
    assert.equal(beatGridCsv(grid).split("\n").length, 19);
  });

  it("uses exact rational fractional film rates and absolute frame rounding", () => {
    for (const rate of Object.keys(FRAME_RATES)) {
      const { numerator, denominator } = FRAME_RATES[rate];
      const grid = planBeatGrid({ bpm: 137, beatsPerBar: 7, bars: 128, frameRate: rate, offsetFrames: 31 });
      assert.equal(grid.markers.length, 129);
      assert.equal(grid.markers[0].frame, 31);
      for (const marker of grid.markers) {
        const exactFrame = 31 + marker.beat * 60 * numerator / (137 * denominator);
        assert.ok(Math.abs(marker.frame - exactFrame) <= 0.5 + 1e-9, rate + " timing drift");
      }
      assert.equal(grid.durationFrames, grid.markers.at(-1).frame - 31);
    }
    const ntsc = planBeatGrid({ bpm: 120, beatsPerBar: 4, bars: 10, frameRate: "30000/1001" });
    assert.equal(ntsc.durationFrames, 599);
    assert.equal(ntsc.approximateDurationSeconds, 20);
  });

  it("rejects invalid settings, injection, unsupported rates, and unbounded grids", () => {
    const invalid = [
      { bpm: 0 }, { bpm: 19 }, { bpm: "Infinity" }, { bpm: "NaN" },
      { bpm: "120<script>" }, { bpm: ["120", "160"] }, { bpm: 320.5 },
      { bars: 129 }, { bars: -1 }, { beatsPerBar: 1 },
      { frameRate: "24;rm -rf" }, { offsetFrames: "9999999999999999999" }, { offsetFrames: -1 }
    ];
    for (const entry of invalid) assert.throws(() => planBeatGrid(entry), JSON.stringify(entry));
    assert.throws(() => planBeatGrid(null));
    assert.throws(() => beatGridCsv({}));
  });

  it("serves accessible calculation and clean CSV only after creator access", async () => {
    const app = express();
    const layout = (args) => args.sections.join("\n");
    const guard = (_product) => (req, res, next) => {
      if (req.get("x-deny")) return res.status(403).end();
      next();
    };
    registerCreatorProjectRoutes(app, {
      layout,
      brandCard: (heading, body) => "<p>" + heading + ": " + body + "</p>",
      linkAction: () => "",
      escapeHtml: (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
      requirePaidOrOwnerAccess: guard,
      wantsJson: () => false,
      projectStore: {}
    });
    const path = "/creator-studio/projects/beat-grid";
    const html = await request(app).get(path).query({ bpm: 120, bars: 16, frameRate: "24" });
    assert.equal(html.status, 200);
    assert.match(html.text, /Download beat-marker CSV/);
    assert.match(html.text, /<th scope="col">Absolute frame<\/th>/);
    assert.match(html.text, /<td>768<\/td>/);
    const csv = await request(app).get(path).query({ bpm: 120, bars: 1, frameRate: "24", format: "csv" });
    assert.equal(csv.status, 200);
    assert.equal(csv.headers["content-type"].startsWith("text/csv"), true);
    assert.match(csv.headers["content-disposition"], /attachment/);
    assert.equal(csv.text, "bar,beat,frame,seconds\n1,0,0,0\nEND,4,48,2\n");
    assert.equal((await request(app).get(path).query({ bpm: 0 })).status, 400);
    assert.equal((await request(app).get(path).query({ format: "exe" })).status, 400);
    assert.equal((await request(app).get(path).set("x-deny", "1")).status, 403);
  });
});
