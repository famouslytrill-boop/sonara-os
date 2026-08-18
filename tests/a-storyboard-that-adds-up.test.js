"use strict";

// The prompt version of this circulating online produces a handsome document
// whose shot durations do not sum to the runtime. That is not cosmetic: a
// creator books a shoot, a voice artist and an edit against those numbers and
// finds out on the timeline that the shot list was thirty seconds long for a
// fifteen-second slot.
//
// So the arithmetic is the product, and it is what this file checks. Every shot
// gets whole seconds, and they sum to exactly the runtime — which is why the
// allocation uses largest-remainder rather than rounding each shot on its own.
// Rounding eight shots independently loses or gains up to four seconds.

const assert = require("node:assert/strict");
const { STORYBOARD_TOOL, buildStoryboard, allocateSeconds, BEATS } = require("../lib/sonara-storyboard-tool.cjs");

const seconds = (output) => output.shotList.split("  ||  ").map((row) => Number(row.match(/— (\d+)s/)[1]));

describe("a storyboard that adds up", () => {
  it("allocates whole seconds that sum to the total, at every runtime", () => {
    // The property, checked across the awkward numbers rather than one tidy one.
    // 7 seconds over 8 shots is where independent rounding falls apart.
    for (const total of [7, 15, 20, 30, 45, 59, 60, 90, 121]) {
      for (const count of [3, 5, 8]) {
        const weights = BEATS.slice(0, count).map((beat) => beat.weight);
        const parts = allocateSeconds(total, weights);
        assert.equal(parts.reduce((carry, value) => carry + value, 0), total, `${total}s over ${count} shots did not sum`);
        assert.ok(parts.every((value) => Number.isInteger(value) && value >= 0), `${total}s over ${count} shots produced a fractional shot`);
      }
    }
  });

  it("builds a shot list whose seconds match the runtime asked for", () => {
    const output = buildStoryboard({ videoIdea: "Bakery opening", durationSeconds: "30", sceneCount: "8" });
    assert.match(output.runtime, /30 seconds across 8 shots/);
    assert.equal(seconds(output).reduce((carry, value) => carry + value, 0), 30);
    assert.match(output.durationsAddUp, /total 30 seconds/);
  });

  it("gives the hook and the ending more than an even split", () => {
    // The two shots that decide whether the middle is watched at all.
    const parts = seconds(buildStoryboard({ videoIdea: "Bakery opening", durationSeconds: "80", sceneCount: "8" }));
    const even = 80 / 8;
    assert.ok(parts[0] > even, `hook got ${parts[0]}s against an even ${even}s`);
    assert.ok(parts[parts.length - 1] > even, `ending got ${parts[parts.length - 1]}s against an even ${even}s`);
  });

  it("keeps the hook first and the ending last however many shots are asked for", () => {
    for (const count of [3, 4, 5, 6, 7, 8]) {
      const output = buildStoryboard({ videoIdea: "Bakery opening", durationSeconds: "40", sceneCount: String(count) });
      const rows = output.shotList.split("  ||  ");
      assert.equal(rows.length, count, `asked for ${count} shots and got ${rows.length}`);
      assert.match(rows[0], /Hook/);
      assert.match(rows[rows.length - 1], /Ending/);
    }
  });

  it("clamps a shot count that would make the piece unreadable", () => {
    const tooFew = buildStoryboard({ videoIdea: "Bakery opening", durationSeconds: "40", sceneCount: "1" });
    assert.equal(tooFew.shotList.split("  ||  ").length, 3, "one shot is not a storyboard");
    const tooMany = buildStoryboard({ videoIdea: "Bakery opening", durationSeconds: "40", sceneCount: "40" });
    assert.equal(tooMany.shotList.split("  ||  ").length, 8);
  });

  it("warns when the runtime leaves shots too short to read", () => {
    // 8 shots in 10 seconds gives shots a viewer cannot read anything in. Saying
    // so beats producing a plan that technically sums correctly.
    const output = buildStoryboard({ videoIdea: "Bakery opening", durationSeconds: "10", sceneCount: "8" });
    assert.match(output.shortestShot, /below the point a viewer can read/);
    assert.equal(seconds(output).reduce((carry, value) => carry + value, 0), 10, "the warning must not come at the cost of the sum");
  });

  it("refuses rather than inventing a runtime or a subject", () => {
    const noTime = buildStoryboard({ videoIdea: "Bakery opening", durationSeconds: "about a minute" });
    assert.match(noTime.couldNotCalculate, /runtime in seconds/);
    assert.equal(noTime.shotList, undefined, "a shot list was produced on a guessed runtime");

    const noIdea = buildStoryboard({ durationSeconds: "30" });
    assert.match(noIdea.couldNotCalculate, /No video idea/);
    assert.match(noIdea.nothingWasGuessed, /No subject has been invented/);
  });

  it("never prints a placeholder", () => {
    for (const body of [{}, { videoIdea: "x", durationSeconds: "0" }, { videoIdea: "x", durationSeconds: "-5" }, { videoIdea: "x", durationSeconds: "30", sceneCount: "nonsense" }]) {
      const output = buildStoryboard(body);
      assert.doesNotMatch(Object.values(output).join(" | "), /NaN|undefined|\[object Object\]/);
    }
  });

  it("is registered as a Creator Studio tool with the fields it requires", () => {
    assert.equal(STORYBOARD_TOOL.productKey, "creator_studio");
    assert.equal(STORYBOARD_TOOL.path, "/creator-studio/tools/storyboard");
    const names = STORYBOARD_TOOL.fields.map((field) => field.name);
    for (const required of STORYBOARD_TOOL.requiredFields) assert.ok(names.includes(required));
  });

  it("says the rights still need clearing", () => {
    // The tool plans a shoot. It is the last honest place to say that planning
    // is not clearance.
    const output = buildStoryboard({ videoIdea: "Bakery opening", durationSeconds: "30" });
    assert.match(output.rights, /Clear the music/);
    assert.match(output.rights, /anybody recognisable/);
  });
});
