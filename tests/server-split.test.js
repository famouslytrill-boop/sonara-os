"use strict";

// Guard rails for splitting server.js, so the split can run in the background
// without ever being the reason a release is held.
//
// server.js was 5,119 lines and 44 scripts/apply-*.cjs mutate it in place. That
// combination is what makes the split risky: 765 distinct strings in the file
// are replacement targets or anchors for those generators, and moving one
// breaks the build in a way that surfaces only when apply:runtime next runs --
// which, before the codegen freeze, was during a production build.
//
// So the rule is: extract only what no generator anchors on, and prove it each
// time rather than remembering it.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const serverSource = fs.readFileSync(path.join(root, "server.js"), "utf8");

function generatorSources() {
  return fs
    .readdirSync(path.join(root, "scripts"))
    .filter((name) => name.startsWith("apply-") && name.endsWith(".cjs"))
    .map((name) => ({ name, source: fs.readFileSync(path.join(root, "scripts", name), "utf8") }));
}

// Modules lifted out of server.js so far. Each entry names what moved and the
// functions it now owns.
const EXTRACTED = [
  {
    module: "lib/sonara-product-pages.cjs",
    functions: [
      "getProductPageDefinitions",
      "productLandingActions",
      "productDashboardActions",
      "productLaunchReadinessActions"
    ]
  }
];

describe("the server.js split stays safe", () => {
  it("moved nothing a generator anchors on", () => {
    // This is the check that matters. A generator that anchors on a function
    // still in server.js keeps working; one that anchors on a function which
    // has moved fails at apply:runtime, long after the diff looked fine.
    const generators = generatorSources();
    const violations = [];

    for (const extraction of EXTRACTED) {
      for (const fn of extraction.functions) {
        for (const generator of generators) {
          if (generator.source.includes(fn)) {
            violations.push(`${fn} moved to ${extraction.module} but scripts/${generator.name} still references it`);
          }
        }
      }
    }

    assert.deepEqual(
      violations,
      [],
      `These extractions will break code generation:\n  ${violations.join("\n  ")}\n\n` +
        "Either leave the function in server.js, or update the generator in the same commit."
    );
  });

  it("left no orphan definition behind in server.js", () => {
    // Two definitions of the same function is what happened when
    // apply-catalog-helper-scope.cjs reinserted a helper that had been edited
    // in place: the file parsed, the tests passed, and the later definition
    // silently won.
    for (const extraction of EXTRACTED) {
      for (const fn of extraction.functions) {
        const declarations = (serverSource.match(new RegExp(`^function ${fn}\\(`, "gm")) || []).length;
        assert.equal(
          declarations,
          0,
          `${fn} was extracted to ${extraction.module} but server.js still declares it`
        );
      }
    }
  });

  it("exports everything it was asked to own", () => {
    for (const extraction of EXTRACTED) {
      const source = fs.readFileSync(path.join(root, extraction.module), "utf8");
      for (const fn of extraction.functions) {
        assert.match(source, new RegExp(`\\b${fn}\\b`), `${extraction.module} must define ${fn}`);
      }
    }
  });

  it("keeps server.js shrinking rather than growing", () => {
    // A ratchet, not a target. 5,047 lines after the first extraction, down
    // from 5,119. If a change adds to server.js instead of a module, this asks
    // whether that was deliberate.
    const lines = serverSource.split("\n").length;
    assert.ok(
      lines <= 5060,
      `server.js is ${lines} lines. The split is meant to reduce it; if this grew on purpose, raise the ceiling in this test and say why.`
    );
  });
});

describe("the extracted module stands on its own", () => {
  const { createProductPages } = require("../lib/sonara-product-pages.cjs");

  it("refuses to build without the helpers it needs", () => {
    // linkAction is referenced by 30 generators and has to stay in server.js,
    // so it is injected. Failing loudly beats rendering action bars with
    // undefined in them.
    assert.throws(() => createProductPages({}), TypeError);
    assert.throws(() => createProductPages({ linkAction: () => "" }), TypeError);
  });

  it("builds page definitions for every product workspace", () => {
    const pages = createProductPages({ linkAction: (href, label) => `${href}|${label}`, logoutAction: () => "logout" });
    for (const slug of ["business-builder", "creator-studio", "growth-studio"]) {
      const definitions = pages.getProductPageDefinitions(slug);
      assert.ok(definitions, `${slug} must have page definitions`);
      assert.ok(Array.isArray(definitions.free) && definitions.free.length > 0, `${slug} must have free pages`);
    }
  });

  it("builds action bars through the injected helper rather than its own", () => {
    const pages = createProductPages({ linkAction: (href, label) => `LINK:${href}:${label}`, logoutAction: () => "LOGOUT" });
    const actions = pages.productDashboardActions("business-builder");
    assert.ok(actions.every((action) => /^LINK:|^LOGOUT$/.test(action)), "every action must come from the injected helpers");
    assert.ok(actions.includes("LOGOUT"), "a signed-in workspace bar must offer logout");
  });

  it("has a sensible answer for a product it has never heard of", () => {
    const pages = createProductPages({ linkAction: (href, label) => `${href}|${label}`, logoutAction: () => "logout" });
    assert.doesNotThrow(() => pages.productLandingActions("not-a-product"));
    assert.ok(pages.productLandingActions("not-a-product").length > 0);
  });
});
