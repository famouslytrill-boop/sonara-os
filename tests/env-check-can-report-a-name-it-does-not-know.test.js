"use strict";

// A check that could only confirm what it already believed.
//
// scripts/verify-env.mjs exists to hold one line: every environment variable
// the code reads is classified, and every classified name is read. It found
// names two ways -- `process.env.X`, and bare string literals, because this
// codebase declares some variables by name rather than reaching for them
// directly. The literal pass was written like this:
//
//     if (candidateNames.has(match[1])) used.add(match[1]);
//
// So a literal was recorded only if it was *already classified*. A name the
// file had never heard of was skipped rather than flagged, which made "all
// classified" true by construction -- it could never be otherwise.
//
// Thirteen names sat in that gap and they were not incidental. The plan table
// in server.js declares its price variables as `env:` and `envAliases:` values,
// lib/sonara-readiness.cjs resolves them at line 301, and none was classified.
// **The three variables that gate every paid plan were invisible to the
// environment check while it reported success on every deploy.**
//
// The filter had a real purpose -- any shouty string literal would otherwise
// look like a variable -- so the fix was not to remove it but to add a pass
// that does not need one: a key literally named `env` is not ambiguous.
//
// This file guards the property rather than the line, because the line can be
// rewritten and the property is what matters.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const script = path.join(root, "scripts", "verify-env.mjs");

function runVerifyEnv() {
  try {
    return { ok: true, output: execFileSync("node", [script], { cwd: root, encoding: "utf8" }) };
  } catch (error) {
    return { ok: false, output: `${error.stdout || ""}${error.stderr || ""}` };
  }
}

describe("the environment check can report a name it has never heard of", () => {
  it("passes as the repository stands", () => {
    const { ok, output } = runVerifyEnv();
    assert.ok(ok, `verify:env fails on a clean tree:\n${output}`);
  });

  it("classifies the variables that gate every paid plan", () => {
    // Named individually rather than counted, because the count is what went
    // wrong last time: 58 classified names looked complete and was missing the
    // three that decide whether anything can be sold at all.
    const source = fs.readFileSync(script, "utf8");
    for (const name of ["STRIPE_PRICE_STARTER_MONTHLY", "STRIPE_PRICE_CORE_MONTHLY", "STRIPE_PRICE_PRO_MONTHLY"]) {
      assert.match(source, new RegExp(`["']${name}["']`), `${name} is read by the plan table and classified nowhere`);
    }
  });

  it("reads env: declarations without needing to already know the name", () => {
    // The property, stated directly. A declaration the file has never seen must
    // come back as an error -- if it comes back clean, the literal pass has
    // been re-gated on an allow-list and the blind spot is open again.
    const probe = path.join(root, "lib", "sonara-env-check-probe.cjs");
    const unknown = "SONARA_PROBE_VARIABLE_NOBODY_CLASSIFIED";
    fs.writeFileSync(probe, `"use strict";\nmodule.exports = { plan: { env: "${unknown}" } };\n`);
    try {
      const { ok, output } = runVerifyEnv();
      assert.equal(ok, false, "an unclassified env: declaration passed; the check cannot report a name it does not know");
      assert.match(output, new RegExp(unknown), "the check failed without naming the variable it objected to");
    } finally {
      fs.unlinkSync(probe);
    }
  });

  it("reads envAliases entries the same way", () => {
    // Aliases are fallbacks, so a missing classification there is quieter and
    // no less real -- lib/sonara-readiness.cjs resolves the primary name and
    // then every alias.
    const probe = path.join(root, "lib", "sonara-env-alias-probe.cjs");
    const unknown = "SONARA_PROBE_ALIAS_NOBODY_CLASSIFIED";
    fs.writeFileSync(probe, `"use strict";\nmodule.exports = { plan: { envAliases: ["${unknown}"] } };\n`);
    try {
      const { ok, output } = runVerifyEnv();
      assert.equal(ok, false, "an unclassified envAliases entry passed unnoticed");
      assert.match(output, new RegExp(unknown));
    } finally {
      fs.unlinkSync(probe);
    }
  });

  it("still objects to a classified name that nothing reads", () => {
    // The other direction, which already worked and must keep working: a stale
    // classification is how the previous rewrite's own bug got in.
    const source = fs.readFileSync(script, "utf8");
    assert.match(source, /classified in scripts\/verify-env\.mjs and read by no source file/);
  });
});
