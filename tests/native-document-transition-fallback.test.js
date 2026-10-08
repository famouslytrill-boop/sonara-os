"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../public/sonara-prepaint.js"), "utf8");

function boot() {
  const handlers = new Map();
  const root = { dataset: {}, classList: { add() {}, remove() {} } };
  const window = {
    localStorage: { getItem: () => null }, matchMedia: () => ({ matches: false }), setTimeout: () => 0,
    addEventListener: (type, handler) => handlers.set(type, handler)
  };
  vm.runInNewContext(source, { window, document: { documentElement: root } });
  return handlers;
}
describe("native page transitions leave normal navigation usable", () => {
  it("handles expected ready rejection on both outgoing and incoming documents", () => {
    const handlers = boot();
    for (const type of ["pageswap", "pagereveal"]) {
      for (const name of ["AbortError", "InvalidStateError", "TimeoutError"]) {
        let caught = false;
        handlers.get(type)({ viewTransition: { ready: { catch: (handle) => {
          caught = true;
          assert.equal(handle({ name }), undefined);
        } } }, preventDefault() { throw new Error("native navigation must stay enabled"); } });
        assert.equal(caught, true);
      }
    }
  });
  it("does not swallow an unrelated failure in the transition promise", () => {
    const handlers = boot();
    const failure = new TypeError("actual application defect");
    for (const type of ["pageswap", "pagereveal"]) {
      assert.throws(() => handlers.get(type)({ viewTransition: {
        ready: { catch: (handle) => handle(failure) }
      } }), (error) => error === failure);
    }
  });
  it("keeps the same path working without a native transition", () => {
    const handlers = boot();
    for (const type of ["pageswap", "pagereveal"]) {
      assert.doesNotThrow(() => handlers.get(type)({ viewTransition: null }));
      assert.doesNotThrow(() => handlers.get(type)({}));
    }
  });
});
