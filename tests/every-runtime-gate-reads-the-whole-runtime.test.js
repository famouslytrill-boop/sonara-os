"use strict";

// A release gate that reads "the runtime" must read all of it.
//
// Three gates built the list themselves with a flat `readdirSync` over `lib/` and
// `routes/`, so `lib/catalog/` -- four product catalogue modules one directory
// down -- was outside every one of their populations. Each then printed its own
// total as though it were the runtime: verify:request-tenant-ids said 304 files,
// verify:filter-encoding said 303, while verify:tenant-queries and typecheck,
// which do walk recursively, said 307. Three numbers for one population.
//
// It was proven rather than reasoned. A file placed in `lib/catalog/` reading
// `req.body.organizationId` -- an unregistered request-supplied tenant id, the one
// thing verify:request-tenant-ids exists to catch -- left that gate exiting 0 with
// byte-identical output.
//
// The walk now lives in lib/sonara-runtime-source-files.cjs. This file holds two
// properties that module cannot hold for itself: that the walk really does descend,
// and that no gate has gone back to building its own.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { runtimeSourceFiles, blindnessReason, MINIMUM_RUNTIME_FILES } = require("../lib/sonara-runtime-source-files.cjs");

const root = path.join(__dirname, "..");

// The three gates converted to the shared walk, and the population each asks for.
// Named rather than globbed: "some gate somewhere" is a weaker statement than
// "these three", and the weaker one passes when a gate stops using it.
const CONVERTED = [
  "scripts/verify-request-supplied-tenant-ids.mjs",
  "scripts/verify-postgrest-filter-encoding.mjs",
  "scripts/verify-supabase-contract.mjs"
];

describe("every gate that reads the runtime reads all of it", () => {
  it("descends into subdirectories", () => {
    const files = runtimeSourceFiles({ root, directories: ["lib", "routes", "api"] });

    assert.ok(
      files.length >= MINIMUM_RUNTIME_FILES,
      `only ${files.length} runtime files found against a floor of ${MINIMUM_RUNTIME_FILES}; this check has gone blind`
    );

    // The specific directory the flat walks missed. Asserted by name because it
    // is the evidence: a walk that finds 300 files and none of these is the bug.
    const nested = files.filter((file) => file.startsWith(`lib${path.sep}catalog${path.sep}`));
    assert.ok(
      nested.length >= 4,
      `the walk found ${nested.length} files under lib/catalog/, which is where three gates were blind. ` +
        "A recursive walk that finds none of them has stopped descending."
    );

    // And every nested file on disk is in the list, so the assertion above cannot
    // pass by finding some of them.
    const onDisk = [];
    (function walk(absolute) {
      for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
        const full = path.join(absolute, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(cjs|mjs|js)$/.test(entry.name)) onDisk.push(path.relative(root, full));
      }
    })(path.join(root, "lib"));
    const missed = onDisk.filter((file) => !files.includes(file)).sort();
    assert.deepEqual(missed, [], `the shared walk missed ${missed.length} file(s) under lib/: ${missed.join(", ")}`);
  });

  it("reports blindness rather than a clean run when the population collapses", () => {
    assert.equal(blindnessReason(runtimeSourceFiles({ root, directories: ["lib"] })), null);
    const reason = blindnessReason(["server.js"]);
    assert.ok(reason, "a one-file population must be reported as blindness, not passed as clean");
    assert.match(reason, /gone blind/);
    // An empty directory list is refused outright: it is the population error this
    // module exists to prevent, so it throws rather than returning nothing.
    assert.throws(() => runtimeSourceFiles({ root, directories: [] }), TypeError);
    assert.throws(() => runtimeSourceFiles({ directories: ["lib"] }), TypeError);
  });

  // The second side. A gate that goes back to building its own flat walk is the
  // way this regresses, and it regresses silently -- the gate still passes, it
  // just stops seeing part of the tree.
  it("has no converted gate that builds its own directory walk again", () => {
    const offenders = [];
    for (const relative of CONVERTED) {
      const source = fs.readFileSync(path.join(root, relative), "utf8");
      assert.ok(
        source.includes("runtimeSourceFiles"),
        `${relative} no longer calls runtimeSourceFiles, so it is reading some population of its own`
      );
      // A flat readdirSync over a runtime directory, which is the exact shape that
      // was wrong. `withFileTypes` plus an isDirectory branch is a real walk and is
      // not flagged; reading supabase/migrations flat is correct and is not either.
      for (const match of source.matchAll(/readdirSync\(([^)]*)\)/g)) {
        const argument = match[1];
        if (/migrations|withFileTypes/.test(argument)) continue;
        if (/"lib"|"routes"|"api"|directory|dir\b/.test(argument)) offenders.push(`${relative}: readdirSync(${argument.trim()})`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `${offenders.length} converted gate(s) read a runtime directory directly again instead of asking ` +
        `lib/sonara-runtime-source-files.cjs:\n  ${offenders.join("\n  ")}`
    );
  });
});
