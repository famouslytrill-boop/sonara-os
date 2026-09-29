// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function harness() {
  const source = fs.readFileSync(path.join(__dirname, "../public/sonara-one.js"), "utf8");
  const start = source.indexOf("  function installRouteProgress()");
  const end = source.indexOf("  function installCurrentNavigation()", start);
  assert.ok(start >= 0 && end > start);
  const handlers = {};
  const classes = new Set();
  const classList = { add: (name) => classes.add(name), remove: (name) => classes.delete(name) };
  const loader = { hidden: true, dataset: {}, classList, querySelector: () => null };
  let timeout;
  const context = {
    root: { classList },
    document: { querySelector: (selector) => selector === "#sonara-loader" ? loader : { classList }, addEventListener: (name, fn) => { handlers[name] = fn; } },
    window: { URL, location: { href: "https://example.com/", origin: "https://example.com" },
      setTimeout: (fn, delay) => { assert.equal(delay, 8000); timeout = fn; return 1; },
      clearTimeout: () => {}, addEventListener: (name, fn) => { handlers[name] = fn; } }
  };
  vm.runInNewContext(source.slice(start, end) + "installRouteProgress();", context);
  return { loader, classes, handlers, expire: () => timeout(),
    click: (overrides = {}, target = "") => handlers.click({ button: 0, target: { closest: () => ({ href: "https://example.com/pricing", target, hasAttribute: () => false }) }, ...overrides }) };
}

describe("route progress recovery", () => {
  it("leaves the current page usable for cancelled and new-window clicks", () => {
    const h = harness();
    h.click({ defaultPrevented: true });
    h.click({}, "preview");
    h.click({ button: 1 });
    assert.equal(h.loader.hidden, true);
    assert.equal(h.classes.has("sonara-leaving"), false);
  });
  it("clears the overlay when navigation never completes", () => {
    const h = harness();
    h.click();
    assert.equal(h.loader.hidden, false);
    h.expire();
    assert.equal(h.loader.hidden, true);
    assert.equal(h.classes.has("sonara-leaving"), false);
  });
  it("clears the overlay when browser history restores the document", () => {
    const h = harness();
    h.click();
    h.handlers.pageshow();
    assert.equal(h.loader.hidden, true);
  });
});
