"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

describe("native replay Unix ownership", () => {
  let replayOwner;
  before(async () => {
    ({ replayOwner } = await import("../scripts/postgres-replay-owner.mjs"));
  });

  it("uses the actual primary group when it differs from the username", () => {
    const calls = [];
    const owner = replayOwner("nobody", (command, args) => {
      calls.push([command, ...args]);
      return args[0] === "-u" ? "65534\n" : "1234\n";
    });
    assert.equal(owner, "65534:1234");
    assert.deepEqual(calls, [["id", "-u", "nobody"], ["id", "-g", "nobody"]]);
  });

  it("does not switch ownership for an already unprivileged process", () => {
    assert.equal(replayOwner(null, () => { throw new Error("must not resolve an identity"); }), null);
  });

  it("rejects root and invalid identity responses", () => {
    for (const uid of ["0", "invalid", "65534:65534", ""]) {
      assert.throws(() => replayOwner("nobody", (_command, args) => args[0] === "-u" ? uid : "65534"), /non-root Unix identity/);
    }
  });

  it("preserves identity lookup failures", () => {
    assert.throws(() => replayOwner("missing", () => { throw new Error("identity unavailable"); }), /identity unavailable/);
  });
});

describe("native replay binary selection", () => {
  let replayBinaries;
  before(async () => {
    ({ replayBinaries } = await import("../scripts/postgres-replay-owner.mjs"));
  });

  it("requires all three binaries in the selected directory", () => {
    const directory = path.resolve("selected-postgres-17");
    const inspected = [];
    assert.equal(replayBinaries(directory, (file) => { inspected.push(file); return true; }), directory);
    assert.deepEqual(inspected, ["initdb", "pg_ctl", "psql"].map((name) => path.join(directory, name)));
  });

  it("rejects each incomplete selection without looking in another directory", () => {
    const directory = path.resolve("selected-postgres-17");
    for (const missing of ["initdb", "pg_ctl", "psql"]) {
      assert.equal(replayBinaries(directory, (file) => {
        assert.equal(path.dirname(file), directory);
        return path.basename(file) !== missing;
      }), null);
    }
  });

  it("rejects absent, malformed and relative directories before probing", () => {
    for (const directory of [null, undefined, {}, "", "postgres/17/bin"]) {
      assert.equal(replayBinaries(directory, () => { throw new Error("must not probe"); }), null);
    }
  });

  it("normalizes an absolute directory before checking its binaries", () => {
    const directory = `${path.resolve("selected-postgres-17")}${path.sep}..${path.sep}selected-postgres-16`;
    assert.equal(replayBinaries(directory, () => true), path.resolve(directory));
  });
});
