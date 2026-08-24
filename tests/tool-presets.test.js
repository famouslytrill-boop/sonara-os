"use strict";

// Filling a tool in from a saved result, and the ways a preset misleads.
//
// The dangerous version fills in what matches and stays quiet. Somebody
// recognises the form, sees their old numbers, presses the button, and gets an
// answer computed partly from a blank they never noticed -- and a break-even
// worked out from a silent zero is a confident wrong answer, not an obvious one.
//
// So every test here is about a value surviving intact, a gap being named, or a
// value that cannot be held being refused rather than coerced.

const assert = require("node:assert/strict");
const { usable, asText, applyPreset, describe: describePreset } = require("../lib/sonara-tool-presets.cjs");

const FIELDS = [
  { name: "monthlyCosts", label: "Monthly costs", type: "number", required: true },
  { name: "price", label: "Price per sale", type: "number", required: true },
  { name: "unitCost", label: "Cost per sale", type: "number", required: true },
  { name: "notes", label: "Notes", type: "textarea" },
  {
    name: "vatRegistered", label: "VAT registered", type: "select", required: true,
    options: [{ value: "yes", label: "Yes" }, { value: "no", label: "Not yet" }]
  }
];

const FULL = { monthlyCosts: 4200, price: 60, unitCost: 25, notes: "spring quote", vatRegistered: "no" };

describe("filling a tool in from a saved result", () => {
  describe("what counts as a value", () => {
    it("keeps zero and false, which are real answers", () => {
      assert.equal(usable(0), true, "zero is a real cost and must survive");
      assert.equal(usable(false), true);
      assert.equal(asText(0), "0");
      assert.equal(asText(false), "no");
      assert.equal(asText(true), "yes");
    });

    it("refuses the things that are not answers", () => {
      for (const value of [null, undefined, "", "   ", NaN, Infinity]) {
        assert.equal(usable(value), false, `accepted ${JSON.stringify(value)}`);
      }
    });

    it("refuses a structure, rather than rendering it into a box", () => {
      // A payload carrying one is from a tool taking structured input, and
      // guessing a rendering puts "[object Object]" into a field somebody submits.
      assert.equal(usable({ a: 1 }), false);
      assert.equal(usable([1, 2]), false);
    });
  });

  describe("when the payload still matches the tool", () => {
    it("fills every field and says so", () => {
      const preset = applyPreset({ fields: FIELDS, payload: FULL });
      assert.equal(preset.ok, true);
      assert.equal(preset.complete, true);
      assert.deepEqual(preset.values, { monthlyCosts: "4200", price: "60", unitCost: "25", notes: "spring quote", vatRegistered: "no" });
      assert.deepEqual(preset.missing, []);
      assert.deepEqual(preset.ignored, []);
      assert.match(describePreset(preset), /Filled in from your saved result/);
    });

    it("keeps a zero rather than treating it as absent", () => {
      const preset = applyPreset({ fields: FIELDS, payload: { ...FULL, unitCost: 0 } });
      assert.equal(preset.values.unitCost, "0");
      assert.equal(preset.complete, true, "a cost of zero was read as a missing cost");
    });
  });

  describe("when the tool has changed since", () => {
    it("names a required field the payload cannot fill, and does not invent one", () => {
      const { price: _price, ...withoutPrice } = FULL;
      const preset = applyPreset({ fields: FIELDS, payload: withoutPrice });
      assert.equal(preset.complete, false);
      assert.deepEqual(preset.missing.map((field) => field.name), ["price"]);
      assert.ok(!("price" in preset.values), "a missing field was defaulted, and Number(null) is 0");
      assert.match(describePreset(preset), /still needs typing: Price per sale/);
    });

    it("says which of several are missing", () => {
      const preset = applyPreset({ fields: FIELDS, payload: { monthlyCosts: 4200 } });
      assert.deepEqual(preset.missing.map((field) => field.label).sort(), ["Cost per sale", "Price per sale", "VAT registered"].sort());
      assert.match(describePreset(preset), /still need typing/);
    });

    it("does not report an optional field as missing", () => {
      const { notes: _notes, ...withoutNotes } = FULL;
      const preset = applyPreset({ fields: FIELDS, payload: withoutNotes });
      assert.deepEqual(preset.missing, []);
      assert.equal(preset.complete, true);
    });

    it("reports what the payload carried that the tool no longer has", () => {
      // How somebody finds out the tool changed, rather than that they mistyped.
      const preset = applyPreset({ fields: FIELDS, payload: { ...FULL, oldFieldName: 12, anotherOne: "x" } });
      assert.deepEqual(preset.ignored, ["anotherOne", "oldFieldName"]);
      assert.equal(preset.complete, true, "a field the tool dropped does not stop the rest being usable");
    });

    it("does not report an ignored key that had nothing in it", () => {
      const preset = applyPreset({ fields: FIELDS, payload: { ...FULL, staleEmpty: "" } });
      assert.deepEqual(preset.ignored, []);
    });
  });

  describe("a value a field cannot hold", () => {
    it("refuses a select value that is not one of its options", () => {
      // A select whose value is not in its list renders as the first option, so
      // a stale answer would silently become a different, plausible one.
      const preset = applyPreset({ fields: FIELDS, payload: { ...FULL, vatRegistered: "flat_rate" } });
      assert.ok(!("vatRegistered" in preset.values), "a stale select value was carried into a different answer");
      assert.deepEqual(preset.missing.map((field) => field.name), ["vatRegistered"]);
      assert.equal(preset.complete, false);
    });

    it("accepts a select value that is one of its options", () => {
      const preset = applyPreset({ fields: FIELDS, payload: { ...FULL, vatRegistered: "yes" } });
      assert.equal(preset.values.vatRegistered, "yes", "or the assertion above passes by refusing everything");
    });

    it("fills a select from a boolean the way the form writes one", () => {
      const preset = applyPreset({ fields: FIELDS, payload: { ...FULL, vatRegistered: true } });
      assert.equal(preset.values.vatRegistered, "yes");
    });
  });

  describe("when there is nothing to fill in with", () => {
    it("refuses a payload that is not one", () => {
      for (const payload of [null, undefined, "", 12, [1, 2]]) {
        const preset = applyPreset({ fields: FIELDS, payload });
        assert.equal(preset.ok, false, `accepted ${JSON.stringify(payload)}`);
        assert.deepEqual(preset.values, {});
        assert.match(describePreset(preset), /nothing saved/);
      }
    });

    it("says nothing fits rather than showing an empty form as a preset", () => {
      const preset = applyPreset({ fields: FIELDS, payload: { somethingElse: 1 } });
      assert.equal(preset.ok, true);
      assert.deepEqual(preset.filled, []);
      assert.equal(preset.complete, false);
      assert.match(describePreset(preset), /Nothing on that saved result fits this tool/);
    });

    it("handles a tool with no fields without claiming it is complete", () => {
      const preset = applyPreset({ fields: [], payload: FULL });
      assert.equal(preset.complete, false, "a tool with nothing to fill was reported as fully filled");
    });
  });
});
