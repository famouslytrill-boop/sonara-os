"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

// This repository has one deployment target, and that is a decision rather than
// an accident.
//
// On 9 September 2026 a Cloudflare Worker service named `sonara-os` was created
// with a Git integration pointing here. It failed instantly on the first commit
// it saw -- in zero seconds, which is what "nothing to build" looks like -- and
// would have failed on every commit on every branch afterwards, because there is
// no Worker in this repository to build.
//
// The owner's decision was to disconnect the integration rather than add one.
// docs/architecture/EXTERNAL-SERVICES.md carries the reasoning; the short version
// is that a second production path is a path around the controlled deployment
// workflow, and that workflow has a live-price gate in front of it because a
// price mismatch once shipped while every check was green.
//
// This test exists because the next person to see a red "Workers Builds" check
// will reasonably try to make it pass by adding a wrangler config, which is the
// one fix that quietly undoes the decision. Failing here says so first.
//
// If a Worker is ever genuinely wanted, it belongs in its own repository. To
// change this decision, change it here and in EXTERNAL-SERVICES.md together --
// which is the point of asserting it at all.
describe("this repository is not a Cloudflare Worker", () => {
  const CONFIG_NAMES = ["wrangler.toml", "wrangler.json", "wrangler.jsonc", "wrangler.yaml", "wrangler.yml"];

  it("declares no wrangler configuration at the repository root", () => {
    const present = CONFIG_NAMES.filter((name) => fs.existsSync(path.join(root, name)));
    assert.deepEqual(
      present,
      [],
      `${present.join(", ")} would make this repository deploy to Cloudflare as well as Vercel. ` +
        "That is a second production path around the controlled deployment workflow and its live-price gate. " +
        "See the Cloudflare section of docs/architecture/EXTERNAL-SERVICES.md; if the decision has changed, change it there too."
    );
  });

  it("keeps the build script pointed at the Express application", () => {
    // The other half of the same fact. A wrangler config could be absent while
    // the build had been switched to a Worker bundler, and the assertion above
    // would still pass.
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const build = packageJson.scripts?.build || "";
    assert.ok(build.length > 0, "package.json declares no build script; this check has gone blind");
    assert.match(build, /server\.js/, `the build script no longer builds server.js: ${build}`);
    assert.doesNotMatch(build, /wrangler/, `the build script invokes wrangler: ${build}`);
  });

  it("names the reasoning somewhere a person will find it", () => {
    // A bare assertion with no explanation is how a decision becomes folklore.
    const doc = fs.readFileSync(path.join(root, "docs", "architecture", "EXTERNAL-SERVICES.md"), "utf8");
    assert.match(
      doc,
      /Cloudflare is an API this application calls, not a place it is deployed/,
      "the section explaining this decision is gone from EXTERNAL-SERVICES.md, leaving the assertion above unexplained"
    );
  });
});
