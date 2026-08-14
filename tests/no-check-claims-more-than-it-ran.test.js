"use strict";

// A summary that overwrites its own skip.
//
// Two release scripts printed an unqualified "verified" on their last line
// regardless of whether their optional half had run:
//
//   verify-stripe-env.mjs     "[SKIP] STRIPE_SECRET_KEY is not set, so live
//                             prices cannot be compared."
//                             ...then: "Stripe configuration verified against
//                             the deployed server."
//
//   verify-open-source-registry.mjs  "Network verification: disabled"
//                             ...then: "Open-source and external repository
//                             controls verified."
//
// In both, the honest line was two lines above the misleading one, and the
// misleading one was the summary -- which is what a person scanning a release
// log actually reads. Neither script lied about skipping; both then described
// themselves as having verified the thing they skipped.
//
// This checks the property across every script the release chain runs, so a
// third one cannot arrive with the same shape. The rule: a script that can
// decline part of its work must not end with a bare claim of verification.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

// The chain itself, read rather than restated -- a script added to verify:launch
// is covered here without anybody remembering to add it.
const LAUNCH = String(packageJson.scripts?.["verify:launch"] || "");
const chainScripts = [...LAUNCH.matchAll(/pnpm run ([a-z:-]+)/g)]
  .map((match) => String(packageJson.scripts?.[match[1]] || ""))
  .map((command) => command.match(/scripts\/([A-Za-z0-9._-]+\.(?:mjs|cjs|js))/)?.[1])
  .filter(Boolean);

const unique = [...new Set(chainScripts)];

// A script "can decline part of its work" if it says so in its own output.
const DECLINES = /\[SKIP\]|: (?:"|`)?\$\{[^}]*\? "enabled" : "disabled"|verification: \$\{/;

function finalClaims(source) {
  // Every console.log whose text contains "verified" -- the word that carries
  // the claim in this repository's release output.
  return [...source.matchAll(/console\.log\(\s*([\s\S]{0,400}?)\);/g)]
    .map((match) => match[1])
    .filter((text) => /verified/i.test(text));
}

describe("no release check claims more than it ran", () => {
  it("found the release chain", () => {
    assert.ok(unique.length >= 10, `only ${unique.length} scripts parsed out of verify:launch; this check has gone blind`);
  });

  for (const name of unique) {
    const file = path.join(root, "scripts", name);
    if (!fs.existsSync(file)) continue;
    const source = fs.readFileSync(file, "utf8");
    if (!DECLINES.test(source)) continue;

    it(`${name} says which half ran`, () => {
      const claims = finalClaims(source);
      assert.ok(claims.length > 0, `${name} declines work and prints no verification summary at all`);

      // At least one claim must be guarded, and every claim must either name
      // the reduced scope or be inside a branch. A script with a single
      // unconditional "verified" line is the exact defect.
      const qualified = claims.filter((text) => /offline|including|NOT checked|not compared|was not/i.test(text));
      assert.ok(
        qualified.length > 0,
        `${name} can skip part of its work and still ends with an unqualified claim of verification. ` +
          `Say which half ran, as verify-stripe-env.mjs and verify-open-source-registry.mjs do.`
      );
    });
  }
});
