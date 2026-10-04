"use strict";

const assert = require("node:assert/strict");

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
