"use strict";

// The prohibition in the owner documentation is enforced by something.
//
// `docs/owner/INSTALL-ALL-KEYS.md` says, in bold, that there is no public
// Supabase service-role variable and there must never be one. The rule is right --
// this project inherits the Vercel and Supabase convention where a `NEXT_PUBLIC_`
// prefix means the value is meant to reach a browser, so a service-role key behind
// that prefix hands out row-level-security bypass. It is AGENTS.md's own rule too:
// keep service-role secrets server-only.
//
// This file does not spell the forbidden name. The gate scans `tests/`, so the
// first version of this comment made the test itself a finding -- correctly. The
// answer is not to exempt the test: an exemption is the thing that later gets
// widened, and the one place the name may appear is the sentence forbidding it.
//
// Nothing enforced it. `scripts/check-env-safety.mjs` was written for it, nothing
// ran it, and it is the clearest instance of shape 1 this repository has produced:
// its scan roots were `app`, `components`, `lib`, `src`, three of which do not
// exist here; its filter was `/\.(ts|tsx|js|jsx)$/`, so of `lib/` -- 256 `.cjs`
// modules -- it could see one file; and its second rule only fired on `.tsx`,
// of which there are none. It read one file and printed "Environment safety check
// passed."
//
// Two AGENTS.md build rules were in the same state: `"packageManager": "pnpm@"`
// and the absence of `package-lock.json` were each asserted by an unrun script,
// and no other file in the repository read either.
//
// scripts/verify-repository-standards.mjs replaces all three. This file holds the
// properties that gate cannot hold for itself: that it runs in the chain, and that
// the population it reads is the one the rule needs -- above all `lib/`, which is
// where the check it replaces went blind.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const GATE = "scripts/verify-repository-standards.mjs";
const COMMAND = "verify:repo-standards";

function summary() {
  return execFileSync(process.execPath, [path.join(root, GATE)], { cwd: root, encoding: "utf8" });
}

describe("a public environment variable cannot carry a service-role key", () => {
  it("runs the gate from the release chain", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const { chainCommands } = require("../lib/sonara-release-chain.cjs");

    assert.ok(pkg.scripts[COMMAND], `package.json has no ${COMMAND} script`);
    assert.ok(fs.existsSync(path.join(root, GATE)), `${COMMAND} points at ${GATE}, which does not exist`);

    const chain = chainCommands(pkg.scripts);
    assert.ok(chain.length > 40, `only ${chain.length} chain commands read; the chain walk has gone blind`);
    assert.ok(chain.includes(COMMAND), `${COMMAND} is not reachable from verify:launch, which is how its predecessor failed`);
  });

  // The specific blindness being fixed. `lib/` holds the runtime as `.cjs`, and the
  // check this replaces could not see `.cjs` at all, so the count for the runtime
  // group is the evidence rather than a detail.
  it("reads the runtime it is protecting", () => {
    const output = summary();
    const runtime = Number(/(\d+) runtime\b/.exec(output)?.[1]);
    const cjsInLib = fs.readdirSync(path.join(root, "lib")).filter((name) => name.endsWith(".cjs")).length;

    assert.ok(Number.isFinite(runtime), `the gate does not report how many runtime files it read: ${output.trim()}`);
    assert.ok(
      runtime >= cjsInLib,
      `the gate read ${runtime} runtime files while lib/ alone holds ${cjsInLib} .cjs modules. ` +
        "Its predecessor read one, because its extension filter excluded the extension this runtime is written in."
    );
  });

  it("reads every population the rule names", () => {
    const output = summary();
    for (const [group, floor] of Object.entries({ runtime: 250, browser: 15, config: 40, docs: 300, tests: 200, root: 3 })) {
      const match = new RegExp(`(\\d+) ${group}\\b`).exec(output);
      assert.ok(match, `the gate's summary reports no count for ${group}: ${output.trim()}`);
      assert.ok(Number(match[1]) >= floor, `the gate read ${match[1]} ${group} file(s), below ${floor}; that group has gone blind`);
    }
  });

  // The rule itself, asserted here as well, so it does not live only in the gate.
  it("has no public secret-shaped name outside the document forbidding it", () => {
    const output = summary();
    const matches = Number(/-- (\d+) match/.exec(output)?.[1]);
    assert.equal(
      matches,
      1,
      `the gate reports ${matches} file(s) naming a NEXT_PUBLIC_ secret. Exactly one is expected: the sentence in ` +
        "docs/owner/INSTALL-ALL-KEYS.md that forbids it."
    );
  });

  it("holds the two build rules AGENTS.md states", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    assert.match(String(pkg.packageManager || ""), /^pnpm@\d/, "AGENTS.md says pnpm only, and packageManager is what makes that stick");
    assert.equal(fs.existsSync(path.join(root, "package-lock.json")), false, "package-lock.json is forbidden outright");
    for (const required of ["pnpm-lock.yaml", ".env.example", "pnpm-workspace.yaml"]) {
      assert.ok(fs.existsSync(path.join(root, required)), `${required} is missing`);
    }
  });
});
