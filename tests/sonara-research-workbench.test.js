"use strict";
const assert = require("node:assert/strict");
const { EXAMPLES, MAX_QUERY_KEYS, MAX_QUERY_BYTES,
  parseSubmission, renderResearchWorkbench } =
  require("../lib/sonara-research-workbench.cjs");

describe("SONARA bounded research workbench", () => {
  it("uses three bounded example forms, no trading or casino widgets", () => {
    assert.deepEqual(EXAMPLES.map(e => e.study), ["layout", "chord", "payoff"]);
    assert.ok(Object.isFrozen(EXAMPLES));
    assert.ok(EXAMPLES.every(e => Object.isFrozen(e) && Object.isFrozen(e.fields)));
    assert.ok(EXAMPLES.every(e => e.fields.every(f => Object.isFrozen(f))));
    assert.equal(MAX_QUERY_KEYS, 5);
    assert.equal(MAX_QUERY_BYTES, 256);
    assert.match(renderResearchWorkbench(), /method="get"/);
    assert.ok(!renderResearchWorkbench().includes('method="post"'));
  });
  it("stays available without any submitted parameters", () => {
    const state = parseSubmission({});
    assert.equal(state.result, null);
    assert.equal(state.error, null);
    const html = renderResearchWorkbench({});
    assert.match(html, /Business Builder/);
    assert.match(html, /Creator Studio/);
    assert.match(html, /Growth Studio/);
  });
  it("computes custom Business layout and labels its interpretation", () => {
    const result = parseSubmission({ study: "layout", width: "5", height: "2.5" });
    assert.equal(result.result.absoluteArea, 12.5);
    assert.equal(result.error, null);
    assert.match(renderResearchWorkbench({ study: "layout", width: "5", height: "2.5" }),
      /Illustrative area: 12.5 square units/);
  });
  it("rejects invalid layout lengths instead of rounding inputs", () => {
    for (const width of ["0", "-1", "100.01", "2.555", "1e9", "NaN", "", "101", "<script>"]) {
      assert.ok(parseSubmission({ study: "layout", width, height: "3" }).error, width);
    }
  });
  it("computes educational C-major MIDI notes with bounded choices", () => {
    const state = parseSubmission({ study: "chord", midi: "60", quality: "major" });
    assert.deepEqual(state.result.notes.map(x => x.midi), [60, 64, 67]);
    assert.match(renderResearchWorkbench({ study: "chord", midi: "60", quality: "major" }),
      /MIDI notes: 60, 64, 67/);
  });
  it("rejects unknown chord qualities, high MIDI roots and array params", () => {
    assert.ok(parseSubmission({ study: "chord", midi: "117", quality: "major" }).error);
    assert.ok(parseSubmission({ study: "chord", midi: "60", quality: "__proto__" }).error);
    assert.ok(parseSubmission({ study: "chord", midi: ["60", "61"], quality: "major" }).error);
  });
  it("computes two-player hypothetical mixed equilibrium", () => {
    const query = { study: "payoff", a: "1", b: "-1", c: "-1", d: "1" };
    const result = parseSubmission(query);
    assert.equal(result.result.equilibriumType, "mixed");
    assert.deepEqual(result.result.rowProbabilities, [0.5, 0.5]);
    assert.match(renderResearchWorkbench(query), /Mixed-strategy equilibrium/);
  });
  it("computes a pure equilibrium and does not assume mixed probabilities", () => {
    const result = parseSubmission({
      study: "payoff", a: "4", b: "2", c: "3", d: "1"
    });
    assert.equal(result.result.equilibriumType, "pure");
    assert.match(renderResearchWorkbench({
      study: "payoff", a: "4", b: "2", c: "3", d: "1"
    }), /Pure-strategy equilibrium/);
  });
  it("rejects negative and positive payoff input outside the documented range", () => {
    assert.ok(parseSubmission({ study: "payoff", a: "-11", b: "-1", c: "-1", d: "1" }).error);
    assert.ok(parseSubmission({ study: "payoff", a: "11", b: "-1", c: "-1", d: "1" }).error);
    assert.ok(parseSubmission({ study: "payoff", a: "1.444", b: "-1", c: "-1", d: "1" }).error);
  });
  it("never echoes hostile markup into rendered error output", () => {
    const html = renderResearchWorkbench({ study: "layout", width: '<img src=x onerror=alert(1)>', height: "3" });
    assert.ok(!html.includes("<img"));
    assert.match(html, /role="alert"/);
  });
  it("ignores unknown research mode without executing arbitrary keys", () => {
    const state = parseSubmission({ study: "execute" });
    assert.equal(state.result, null);
    assert.match(state.error, /Unknown research example/);
  });
  it("does not permit unlisted query fields, even well-formed numbers", () => {
    const state = parseSubmission({ study: "layout", width: "4", height: "3", account: "123" });
    assert.equal(state.result, null);
    assert.match(state.error, /Unexpected input/);
  });
  it("rejects oversized and repeated values instead of processing them", () => {
    assert.ok(parseSubmission({ study: "layout", width: "4", height: "3", padding: "x".repeat(2000) }).error);
    assert.ok(parseSubmission({ study: "layout", width: ["1", "2"], height: "3" }).error);
    assert.ok(parseSubmission({ study: "layout", width: "4", height: "3", x: "1", y: "1", z: "1" }).error);
  });
  it("never accepts inherited width or height values from a polluted prototype", () => {
    const inherited = Object.create({ width: "4", height: "3" });
    inherited.study = "layout";
    const state = parseSubmission(inherited);
    assert.equal(state.result, null);
    assert.match(state.error, /supply this field/);
  });
  it("rejects accessor fields without triggering user-supplied getter code", () => {
    let getterCalls = 0;
    const query = { study: "layout", height: "3" };
    Object.defineProperty(query, "width", { enumerable: true, get() {
      getterCalls += 1;
      throw new Error("must not invoke accessor");
    } });
    const state = parseSubmission(query);
    assert.equal(getterCalls, 0);
    assert.equal(state.result, null);
    assert.match(state.error, /Invalid example input/);
  });
  it("does not invoke hidden toJSON accessors while bounding query sizes", () => {
    let invoked = 0;
    const query = { study: "layout", width: "4", height: "3" };
    Object.defineProperty(query, "toJSON", { get() {
      invoked += 1;
      throw new Error("must not invoke serialization hook");
    } });
    const state = parseSubmission(query);
    assert.equal(state.error, null);
    assert.equal(state.result.absoluteArea, 12);
    assert.equal(invoked, 0);
  });
  it("uses actual labels and semantic keyboard-compatible form controls", () => {
    const html = renderResearchWorkbench({});
    assert.match(html, /<label for="sonara-layout-width">/);
    assert.match(html, /<label for="sonara-chord-quality">/);
    assert.match(html, /<select id="sonara-chord-quality"/);
    assert.match(html, /<button type="submit">/);
    assert.match(html, /Inputs appear in the page URL/);
  });
  it("keeps all submitted computations side-effect-free and without artifacts", () => {
    for (const study of ["layout", "chord", "payoff"]) {
      const example = EXAMPLES.find(x => x.study === study);
      const query = { study };
      for (const field of example.fields) query[field.key] = field.defaultValue;
      const state = parseSubmission(query);
      assert.equal(state.error, null);
      assert.ok(state.result);
      const html = renderResearchWorkbench(query);
      assert.ok(!/name="(payment|tenant_id|token|provider_key)"/.test(html));
    }
  });
});
