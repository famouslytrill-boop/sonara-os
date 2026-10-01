"use strict";

// A file in scripts/ exists to be executed. Something has to execute it.
//
// `report-unreferenced-modules.mjs` asks this of `lib/` and `routes/`, and says
// so plainly. `scripts/` -- the one directory whose files exist only to be run --
// had no equivalent, and measured 30 September 2026, **24 of its 122 files were
// reachable from nothing at all**.
//
// That was not harmless. `verify-all.mjs` presented itself as the complete
// verification runner and listed 34 pnpm scripts of which 24 no longer existed.
// `verify-security.mjs` required a Next.js tree and exited 1, while
// `SECURITY_NOTES.md` cited it as a check that still held. `check-env-safety.mjs`
// guarded the rule that no public variable may carry a service-role key and read
// one file out of 256, because its extension filter excluded `.cjs`.
//
// This file holds the two properties the gate cannot hold for itself: that it runs
// in the release chain, and that its referencer model does not count a mention as
// a call -- which is the specific way the first version of the measurement was
// wrong, twice.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const GATE = "scripts/report-unreferenced-scripts.mjs";
const COMMAND = "verify:unreferenced-scripts";

function summary() {
  return execFileSync(process.execPath, [path.join(root, GATE), "--check"], { cwd: root, encoding: "utf8" });
}

describe("a script nobody runs is not a check", () => {
  it("runs the gate from the release chain", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const { chainCommands } = require("../lib/sonara-release-chain.cjs");

    assert.ok(pkg.scripts[COMMAND], `package.json has no ${COMMAND} script`);
    assert.ok(pkg.scripts[COMMAND].includes(GATE), `${COMMAND} runs "${pkg.scripts[COMMAND]}", which does not name ${GATE}`);

    const chain = chainCommands(pkg.scripts);
    assert.ok(chain.length > 40, `only ${chain.length} chain commands read; the chain walk has gone blind`);
    assert.ok(
      chain.includes(COMMAND),
      `${COMMAND} is not reachable from verify:launch, which would make it one of the things it is looking for`
    );
  });

  it("reads the whole of scripts/ and finds it reachable", () => {
    const output = summary();
    const counted = Number(/(\d+) files under scripts\//.exec(output)?.[1]);
    const reachable = Number(/(\d+) reachable/.exec(output)?.[1]);
    // The extension list comes from the gate rather than a copy here. The first
    // version of this line spelled its own, and when `.ps1` was added to the gate
    // the two disagreed: 108 against 106. A duplicated definition is a definition
    // that drifts, which is why the runtime walk lives in one module too.
    const gateSource = fs.readFileSync(path.join(root, GATE), "utf8");
    const declared = /const SCRIPT_EXTENSIONS = \[([^\]]*)\]/.exec(gateSource);
    assert.ok(declared, `${GATE} no longer declares SCRIPT_EXTENSIONS, so this test cannot agree with it about the population`);
    const extensions = (declared[1].match(/"[^"]+"/g) || []).map((quoted) => quoted.slice(1, -1));
    assert.ok(extensions.length >= 4, `only ${extensions.length} script extension(s) parsed from the gate`);
    const onDisk = fs
      .readdirSync(path.join(root, "scripts"))
      .filter((name) => extensions.some((extension) => name.endsWith(extension))).length;

    assert.ok(Number.isFinite(counted), `the gate does not report how many files it read: ${output.trim()}`);
    assert.equal(counted, onDisk, "the gate counted a different number of scripts from the number on disk");
    assert.ok(reachable >= 60, `only ${reachable} scripts read as reachable; the referencer scan has gone blind`);
  });

  // The error the measurement made, kept as a test because it is the one that
  // would return silently. A comment in one gate explaining that nothing runs
  // verify-all.mjs made verify-all.mjs read as reachable, and a register listing
  // operator tools made all five of them read as reachable once the gate was
  // wired in. Both times a mention counted as a call.
  it("does not count a mention as a call", () => {
    const source = fs.readFileSync(path.join(root, GATE), "utf8");

    // The CALL, not the import. The first version of this assertion matched
    // `/withoutComments|withoutHashComments/` anywhere in the file, and when the
    // stripping call was deleted the import line still satisfied it -- the test
    // passed on a gate that had stopped stripping. An assertion that survives the
    // break it was written for is the defect this whole suite is about.
    assert.ok(
      source.includes("withoutComments(source)"),
      `${GATE} does not call withoutComments(source), so a sentence saying nothing runs a script will count as something running it`
    );
    assert.ok(
      source.includes("withoutHashComments(source)"),
      `${GATE} does not call withoutHashComments(source), so a # comment in a workflow or shell script will count as a call`
    );
    assert.ok(
      source.includes("lib/sonara-comment-stripping.cjs"),
      `${GATE} must use the shared comment stripping rather than its own: four copies of that function is four chances for one to be subtly wrong`
    );

    // And the stripper really strips, checked here rather than assumed, because
    // the assertions above only establish that the gate calls it.
    const { withoutComments } = require("../lib/sonara-comment-stripping.cjs");
    const stripped = withoutComments('// nothing runs scripts/verify-all.mjs\nconst x = 1;\n');
    assert.ok(
      !stripped.includes("verify-all.mjs"),
      "lib/sonara-comment-stripping.cjs left a script name that was only inside a line comment"
    );
    // The register must not make its own entries reachable. The gate excludes its
    // own source for exactly this reason, and dropping that exclusion makes the
    // two-sided register accuse every tool it lists.
    assert.match(
      source,
      /const SELF = "scripts\/report-unreferenced-scripts\.mjs"/,
      `${GATE} no longer excludes its own source, so every file named in OPERATOR_TOOLS will read as reachable and the register will fail as stale on all of them`
    );
  });

  it("keeps a real reason on every operator tool", () => {
    const source = fs.readFileSync(path.join(root, GATE), "utf8");
    const block = /const OPERATOR_TOOLS = Object\.freeze\(\{([\s\S]*?)\n\}\);/.exec(source);
    assert.ok(block, `${GATE} has no OPERATOR_TOOLS register`);

    const entries = [...block[1].matchAll(/"(scripts\/[^"]+)":\s*\n?\s*"/g)].map((match) => match[1]);
    assert.ok(entries.length >= 3, `only ${entries.length} operator tools registered; the register parse has gone blind`);
    for (const relative of entries) {
      assert.ok(fs.existsSync(path.join(root, relative)), `OPERATOR_TOOLS names ${relative}, which does not exist`);
    }
  });
});
