"use strict";

// What a piece of media can be used for, and what each crop costs.
//
// Sprint 09 was "media", held back because everything media-shaped in this
// product costs money per use -- generation runs through a provider and a
// provider sends a bill. This is the half that does not. Deciding whether a
// 1920x1080 file survives a 9:16 crop is geometry, and geometry is free.
//
// The assertions are properties of the arithmetic rather than of this code: an
// area that is thrown away, an upscale factor, a ratio reduced to lowest terms.
// All of them can be checked by hand against a fixture anybody can picture.

const assert = require("node:assert/strict");
const specs = require("../lib/sonara-media-specs.cjs");
const { mediaPlacements } = require("../lib/sonara-planner-tools.cjs");

describe("where this file fits", () => {
  describe("the geometry", () => {
    it("reduces a ratio the way somebody would say it", () => {
      assert.equal(specs.ratioLabel(1920, 1080), "16:9");
      assert.equal(specs.ratioLabel(1080, 1920), "9:16");
      assert.equal(specs.ratioLabel(1080, 1080), "1:1");
      assert.equal(specs.ratioLabel(1080, 1350), "4:5");
      assert.equal(specs.ratioLabel(3000, 3000), "1:1");
    });

    it("costs nothing when the shapes already match", () => {
      const fit = specs.fitCost(1920, 1080, 1280, 720);
      assert.equal(fit.sameShape, true);
      assert.ok(Math.abs(fit.croppedAway) < 1e-9, `a same-shape fit lost ${fit.croppedAway}`);
      assert.ok(Math.abs(fit.paddedArea) < 1e-9);
      assert.equal(fit.croppedFrom, "nothing");
    });

    it("works out what a square crop of a 16:9 file throws away", () => {
      // 16:9 into 1:1 keeps 9/16 of the width, so 7/16 -- 43.75% -- is cut. That
      // is arithmetic anybody can do on paper, which is why it is the fixture.
      const fit = specs.fitCost(1920, 1080, 1080, 1080);
      assert.ok(Math.abs(fit.croppedAway - 7 / 16) < 1e-6, `expected 43.75% cut, got ${(fit.croppedAway * 100).toFixed(2)}%`);
      assert.equal(fit.croppedFrom, "sides");
    });

    it("knows which edge is being cut", () => {
      assert.equal(specs.fitCost(1920, 1080, 1080, 1920).croppedFrom, "sides", "a wide file into a tall frame loses its sides");
      assert.equal(specs.fitCost(1080, 1920, 1920, 1080).croppedFrom, "top and bottom", "a tall file into a wide frame loses top and bottom");
    });

    it("offers the other answer as well, because losing nothing is sometimes the point", () => {
      // cover throws part of the picture away; contain keeps all of it and adds
      // bars. Which is acceptable depends on what is in the frame, and this
      // cannot see the frame -- so it reports both rather than choosing.
      const fit = specs.fitCost(1920, 1080, 1080, 1080);
      assert.ok(fit.croppedAway > 0, "nothing was cropped, so there is nothing to compare");
      assert.ok(fit.paddedArea > 0, "the contain answer reports no padding for a shape change");
      assert.equal(fit.paddedWith, "bars above and below");
    });

    it("says when a target needs more pixels than the file has", () => {
      // Upscaling is possible and is not free, and no platform tells anybody it
      // happened.
      const small = specs.fitCost(640, 360, 3000, 3000);
      assert.equal(small.needsUpscale, true);
      assert.ok(small.upscaleFactor > 4);
      const large = specs.fitCost(4000, 4000, 1080, 1080);
      assert.equal(large.needsUpscale, false);
    });
  });

  describe("the plan", () => {
    it("refuses a size that is not one", () => {
      assert.equal(specs.mediaPlan({}).code, "size_required");
      assert.equal(specs.mediaPlan({ width: 0, height: 100 }).code, "size_impossible");
      assert.equal(specs.mediaPlan({ width: -10, height: 100 }).code, "size_impossible");
      assert.equal(specs.mediaPlan({ width: "wide", height: "tall" }).code, "size_required");
    });

    it("covers every placement it declares", () => {
      const plan = specs.mediaPlan({ width: 1920, height: 1080 });
      assert.equal(plan.ok, true);
      assert.ok(specs.PLACEMENTS.length >= 6, "too few placements for this to be worth a page");
      assert.equal(plan.placements.length, specs.PLACEMENTS.length, "a placement was dropped from the plan");
      for (const placement of plan.placements) {
        assert.ok(placement.verdict, `${placement.key} has no verdict, so somebody reads a percentage and guesses`);
        assert.ok(placement.ratio, `${placement.key} has no ratio`);
      }
    });

    it("names what is too long rather than only what is the wrong shape", () => {
      const plan = specs.mediaPlan({ width: 1080, height: 1920, seconds: 200 });
      assert.equal(plan.ok, true);
      // The story placement caps at 60 seconds; the short-video one at 180.
      assert.ok(plan.tooLong.includes("Story"), "a 200-second file was not flagged for a 60-second placement");
      assert.ok(plan.tooLong.length >= 2);
      // And a file inside every limit flags nothing.
      assert.deepEqual(specs.mediaPlan({ width: 1080, height: 1920, seconds: 30 }).tooLong, []);
    });

    it("says the file fits exactly where it does", () => {
      const vertical = specs.mediaPlan({ width: 1080, height: 1920 });
      const exact = vertical.placements.filter((entry) => entry.sameShape).map((entry) => entry.key);
      assert.ok(exact.includes("vertical_reel"), "a 9:16 file was not reported as fitting a 9:16 placement");
      assert.ok(!exact.includes("square_feed"), "a 9:16 file was reported as fitting a square");
    });

    it("carries the date its numbers were recorded", () => {
      // Platform requirements change without notice, and a specification table
      // is the kind of thing that is quietly wrong for a year.
      const plan = specs.mediaPlan({ width: 1080, height: 1080 });
      assert.match(plan.recordedOn, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(plan.recordedOn, specs.RECORDED_ON);
    });
  });

  describe("loudness", () => {
    it("carries a target for every platform it names", () => {
      assert.ok(specs.LOUDNESS_TARGETS.length >= 4);
      for (const target of specs.LOUDNESS_TARGETS) {
        assert.ok(target.platform, "a loudness target names no platform");
        // Every real normalisation target is negative LUFS. A positive one would
        // be a typo that reads as authoritative.
        assert.ok(target.lufs < 0 && target.lufs > -30, `${target.platform} has an impossible target of ${target.lufs} LUFS`);
        assert.ok(target.note, `${target.platform} has a number and no explanation of what it means`);
      }
    });

    it("keeps broadcast well below the streaming targets, because they are not the same job", () => {
      const broadcast = specs.LOUDNESS_TARGETS.find((entry) => /broadcast/i.test(entry.platform));
      const streaming = specs.LOUDNESS_TARGETS.filter((entry) => !/broadcast/i.test(entry.platform));
      assert.ok(broadcast, "no broadcast target is recorded, so the distinction is not made");
      for (const target of streaming) {
        assert.ok(broadcast.lufs < target.lufs, `broadcast (${broadcast.lufs}) is not quieter than ${target.platform} (${target.lufs})`);
      }
    });
  });

  describe("the page a customer fills in", () => {
    it("tells them where it fits and what each crop costs", () => {
      const output = mediaPlacements({ width: "1920", height: "1080", seconds: "45" });
      assert.ok(!output.couldNotCalculate, output.couldNotCalculate);
      assert.match(output.whatYouHave, /16:9/);
      assert.match(output.whereItFitsAsIs, /Landscape video/);
      assert.match(output.whereItCostsTooMuch, /%|too small|loses/);
    });

    it("says the thing about loudness that is most often got wrong", () => {
      const output = mediaPlacements({ width: "1080", height: "1080" });
      assert.match(output.ifThereIsSoundOnIt, /LUFS/);
      // Mastering hot buys nothing on a platform that normalises, and costs the
      // dynamic range. That sentence is the most useful one in the module.
      assert.match(output.ifThereIsSoundOnIt, /turns it back down|does not make it louder/i);
    });

    it("says when the numbers were checked", () => {
      const output = mediaPlacements({ width: "1080", height: "1080" });
      assert.match(output.whenThisWasChecked, /\d{4}-\d{2}-\d{2}/);
      assert.match(output.whenThisWasChecked, /change without notice/i);
    });

    it("admits it has not seen the picture", () => {
      // The limit that matters. It can say 43% is cut and cannot say whether the
      // 43% contained the subject's face.
      const output = mediaPlacements({ width: "1920", height: "1080" });
      assert.match(output.whatThisIsMeasuring, /has not seen the picture/i);
    });

    it("costs nothing to run", () => {
      const source = require("node:fs").readFileSync(require.resolve("../lib/sonara-media-specs.cjs"), "utf8");
      assert.doesNotMatch(source, /\bfetch\s*\(/, "the media module reaches the network");
      assert.doesNotMatch(source, /\brequire\s*\(/, "the media module pulls in a dependency");
    });
  });
});
