"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const repository = path.resolve(__dirname, "..");
const currentKey = "sonara:nexus:preferences:v2";
const legacyKey = "sonara:nexus:preferences:v1";

function paint(file, store, prefersDark = false) {
  const classes = new Set();
  const root = { dataset: {}, classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) } };
  const browser = {
    localStorage: { getItem: (key) => store[key] || null },
    matchMedia: (query) => ({ matches: query.includes("color-scheme") ? prefersDark : false }),
    setTimeout: () => {}
  };
  vm.runInNewContext(fs.readFileSync(path.join(repository, file), "utf8"), {
    window: browser, document: { documentElement: root }
  });
  return { theme: root.dataset.theme, appearance: root.dataset.sonaraAppearance, language: root.lang };
}

for (const file of ["ui/sonara/prepaint.js", "public/sonara-prepaint.js"]) {
  describe(`${file} canonical first paint`, () => {
    it("prefers v2 theme and language over stale v1 and appearance stores", () => {
      assert.deepEqual(paint(file, {
        [currentKey]: JSON.stringify({ theme: "light", language: "pt" }),
        [legacyKey]: JSON.stringify({ theme: "dark", language: "de" }),
        "sonara-appearance": "dark"
      }, true), { theme: "light", appearance: "light", language: "pt-BR" });
    });

    it("retains v1 migration with canonical language", () => {
      assert.deepEqual(paint(file, { [legacyKey]: JSON.stringify({ theme: "dark", language: "en" }) }),
        { theme: "dark", appearance: "dark", language: "en-US" });
    });

    it("matches runtime default recovery when v2 is malformed", () => {
      assert.deepEqual(paint(file, {
        [currentKey]: "{broken", [legacyKey]: JSON.stringify({ theme: "light", language: "fr" })
      }, true), { theme: "dark", appearance: "system", language: "en-US" });
    });

    it("falls back to system appearance and canonical English for invalid values", () => {
      assert.deepEqual(paint(file, { [currentKey]: JSON.stringify({ theme: "unknown", language: "unknown" }) }, true),
        { theme: "dark", appearance: "system", language: "en-US" });
    });

    it("keeps the appearance-only compatibility path", () => {
      assert.deepEqual(paint(file, { "sonara-appearance": "dark" }),
        { theme: "dark", appearance: "dark", language: "en-US" });
    });

    it("does not let unavailable storage prevent first paint", () => {
      const store = new Proxy({}, { get: () => { throw new Error("storage unavailable"); } });
      assert.deepEqual(paint(file, store), { theme: "light", appearance: "system", language: "en-US" });
    });
  });
}
