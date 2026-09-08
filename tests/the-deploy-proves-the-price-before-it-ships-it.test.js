"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const WORKFLOW_PATH = path.join(root, ".github", "workflows", "controlled-production-deploy.yml");
const WORKFLOW = fs.readFileSync(WORKFLOW_PATH, "utf8");

// On 8 September 2026 the pricing page advertised $29 / $59 / $109 while the
// configured Stripe prices charged $19 / $39 / $79. Every headline plan refused
// checkout, and nothing anywhere reported a problem.
//
// One check compares an advertised amount against the price Stripe would
// actually charge -- scripts/verify-stripe-env.mjs -- and it had never run with
// a key. It skips without STRIPE_SECRET_KEY and exited 0 while skipping, so two
// owner runbooks compensated in prose: "read the last line rather than the exit
// code." That instruction was followed and the mismatch shipped regardless.
//
// The deployment now runs it with --require-live, against the pulled production
// environment, before the deploy step. These are the properties that make that
// worth anything, each asserted rather than assumed.
describe("the deploy proves the price before it ships it", () => {
  it("reads a workflow with steps in it, so none of this passes on an empty file", () => {
    assert.ok(WORKFLOW.length > 2000, `the deploy workflow is only ${WORKFLOW.length} bytes; this check has gone blind`);
    assert.match(WORKFLOW, /Deploy validated source to Vercel production/, "the deploy step is missing, so step order cannot be checked");
  });

  it("runs the live price comparison at all", () => {
    assert.match(
      WORKFLOW,
      /scripts\/verify-stripe-env\.mjs/,
      "the deployment no longer runs verify-stripe-env.mjs, so nothing compares advertised amounts against live Stripe prices"
    );
  });

  it("passes --require-live, because without it the check passes by not running", () => {
    const invocation = WORKFLOW.split("\n").find((line) => line.includes("scripts/verify-stripe-env.mjs"));
    assert.ok(invocation, "no invocation line found");
    assert.match(
      invocation,
      /--require-live/,
      "verify-stripe-env.mjs without --require-live skips the live comparison and exits 0, which is how the September mismatch shipped"
    );
  });

  it("gives it the secret key, which cannot come from the pulled environment", () => {
    // Vercel does not return sensitive variables as plaintext -- the workflow
    // says so itself, which is why the service-role key is injected the same
    // way for the two Supabase steps.
    assert.match(
      WORKFLOW,
      /STRIPE_SECRET_KEY:\s*\$\{\{\s*secrets\.STRIPE_SECRET_KEY\s*\}\}/,
      "the step must inject STRIPE_SECRET_KEY from the protected GitHub environment, or --require-live fails for want of a key"
    );
  });

  it("reads the price ids from the pulled production environment, not the repository", () => {
    const invocation = WORKFLOW.split("\n").find((line) => line.includes("scripts/verify-stripe-env.mjs"));
    assert.match(
      invocation,
      /--env-file=\.env\.production\.catalog-verification/,
      "without the pulled environment this would check whatever the runner happens to hold, not what production is configured with"
    );
  });

  it("runs before the deploy, so a mismatch stops the release rather than shipping it", () => {
    const checkAt = WORKFLOW.indexOf("scripts/verify-stripe-env.mjs");
    const deployAt = WORKFLOW.indexOf("Deploy validated source to Vercel production");
    assert.ok(checkAt > 0 && deployAt > 0, "one of the two steps is missing");
    assert.ok(
      checkAt < deployAt,
      "the price check must run before the deploy; after it, a wrong price is already live when the check notices"
    );
  });

  it("runs before the pulled environment is deleted, or it would have no price ids to read", () => {
    const checkAt = WORKFLOW.indexOf("scripts/verify-stripe-env.mjs");
    const cleanupAt = WORKFLOW.indexOf("Remove temporary production environment material");
    assert.ok(cleanupAt > 0, "the cleanup step is missing");
    assert.ok(
      checkAt < cleanupAt,
      "the price check reads .env.production.catalog-verification, so it must run before that file is removed"
    );
  });
});
