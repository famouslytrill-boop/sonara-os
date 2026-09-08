"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const root = path.join(__dirname, "..");
const SCRIPT = path.join("scripts", "verify-stripe-env.mjs");

// This script does exactly one thing with the key: GET /v1/prices/{id}. So a
// Stripe *restricted* key with read access to Prices is enough, and a
// restricted key that leaks cannot charge anybody, refund anybody, or read a
// customer.
//
// That matters more since the check moved into
// .github/workflows/controlled-production-deploy.yml. Requiring `sk_` meant the
// only key that worked was the one that can do everything, so a full live
// secret key had to sit in CI to perform three reads.
//
// Rejecting `rk_` was also silent in the worst way: a restricted key was
// reported as "STRIPE_SECRET_KEY is not set", which sends somebody to set a
// variable they had already set.
function run(env) {
  try {
    return execFileSync("node", [SCRIPT], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, STRIPE_SECRET_KEY: "", ...env }
    });
  } catch (error) {
    // A non-zero exit still carries the output worth asserting on.
    return `${error.stdout || ""}${error.stderr || ""}`;
  }
}

describe("a read-only key is enough to check a price", () => {
  it("produces output at all, so none of this passes on an empty string", () => {
    const output = run({});
    assert.ok(output.length > 200, `only ${output.length} bytes of output; this check has gone blind`);
    assert.match(output, /\[OK\]/, "the offline half did not run, so the assertions below mean nothing");
  });

  it("tells somebody with no key that a restricted one would do", () => {
    const output = run({});
    assert.match(output, /STRIPE_SECRET_KEY is not set/);
    assert.match(
      output,
      /restricted key \(rk_\.\.\.\) with read access to Prices is enough/,
      "the message must name the least-privilege option, or the full secret key is the only one anybody knows about"
    );
  });

  it("accepts a restricted key rather than calling it unset", () => {
    // The key is syntactically valid and unusable, so the run gets past the
    // shape check and fails at Stripe. Reaching a 401 IS the assertion: it
    // proves the key was accepted rather than dismissed.
    const output = run({ STRIPE_SECRET_KEY: "rk_live_notarealkey", STRIPE_PRICE_WORKSPACE_MONTHLY: "price_notreal" });
    assert.doesNotMatch(output, /STRIPE_SECRET_KEY is not set/, "a restricted key must not be reported as unset");
    assert.match(output, /Stripe returned 401/, "the restricted key should have been used for a live call");
  });

  it("separates a malformed value from an absent one", () => {
    const output = run({ STRIPE_SECRET_KEY: "hunter2" });
    assert.match(output, /does not look like a Stripe API key/);
    assert.doesNotMatch(output, /STRIPE_SECRET_KEY is not set/, "set-but-wrong is not the same fault as unset");
    assert.doesNotMatch(output, /hunter2/, "the value must never be printed");
  });

  it("still exits 0 without a key when --require-live is not passed", () => {
    // The release chain runs this without the flag and without a key. If that
    // ever started failing, every deploy would stop for a check that is
    // deliberately advisory there.
    execFileSync("node", [SCRIPT], { cwd: root, encoding: "utf8", env: { ...process.env, STRIPE_SECRET_KEY: "" } });
  });
});
