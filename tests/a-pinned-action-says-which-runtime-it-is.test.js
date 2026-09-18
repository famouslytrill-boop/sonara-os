"use strict";

// A commit SHA is immutable and tells you nothing. Both halves matter.
//
// The supply-chain gate has pinned every external action to a 40-character
// commit since it was written, and that was doing its job. What it could not do
// was answer a question the owner asked on 18 September 2026 -- do any workflows
// still run on the deprecated Node 20 runtime? -- because the register held
// seven SHAs and no record of what any of them was.
//
// The answer, resolved against upstream that day, was no: six `node24` and one
// `composite`. But nothing enforced it, so the answer was luck. These assertions
// exist so the next pin bump cannot quietly reintroduce a retired runtime.
//
// ## These assertions execute the real script
//
// Every behavioural case below copies `scripts/verify-github-action-pins.mjs`
// into a temporary tree, breaks one thing, and runs it as a child process to see
// whether it exits non-zero and says why. Re-implementing the policy in this
// file would pass forever after the script changed underneath it -- shape 2,
// measuring a different population from the one claimed.
//
// The offline half is what runs in `verify:gates`. The `--network` half is
// asserted for shape only, because a test that needs the network either makes
// the suite flaky or acquires a `catch` that makes it pass when the fetch fails.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT_PATH = path.join(ROOT, "scripts", "verify-github-action-pins.mjs");
const WORKFLOW_DIR = path.join(ROOT, ".github", "workflows");
const SCRIPT = fs.readFileSync(SCRIPT_PATH, "utf8");

const WORKFLOWS = fs
  .readdirSync(WORKFLOW_DIR)
  .filter((name) => /\.ya?ml$/i.test(name))
  .sort();

// Runs the policy against a tree we control: `scripts/` holds the real script,
// `.github/workflows/` holds whatever the case wants it to read.
function runPolicy({ script = SCRIPT, workflows = "copy", args = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-pins-"));
  try {
    fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
    fs.mkdirSync(path.join(dir, ".github", "workflows"), { recursive: true });
    fs.writeFileSync(path.join(dir, "scripts", "verify-github-action-pins.mjs"), script);

    if (workflows === "copy") {
      for (const name of WORKFLOWS) {
        fs.copyFileSync(path.join(WORKFLOW_DIR, name), path.join(dir, ".github", "workflows", name));
      }
    } else if (workflows && typeof workflows === "object") {
      for (const [name, body] of Object.entries(workflows)) {
        fs.writeFileSync(path.join(dir, ".github", "workflows", name), body);
      }
    }

    const result = spawnSync(process.execPath, [path.join(dir, "scripts", "verify-github-action-pins.mjs"), ...args], {
      encoding: "utf8",
      cwd: dir
    });
    return { status: result.status, out: `${result.stdout || ""}${result.stderr || ""}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Reads the register out of the script by evaluating its literal, so these
// assertions are about the values that ship rather than a second copy of them.
function readRegister() {
  const start = SCRIPT.indexOf("const approved = new Map([");
  assert.ok(start > -1, "the register is no longer a `const approved = new Map([` literal; this reader has stopped reading it");
  const open = SCRIPT.indexOf("[", start + "const approved = new Map(".length - 1);
  let depth = 0;
  let end = -1;
  for (let i = open; i < SCRIPT.length; i += 1) {
    if (SCRIPT[i] === "[") depth += 1;
    if (SCRIPT[i] === "]") {
      depth -= 1;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  assert.ok(end > -1, "could not find the end of the register literal");
  const entries = new Function(`return ${SCRIPT.slice(open, end)};`)();
  return new Map(entries);
}

function namedSet(constName) {
  const match = SCRIPT.match(new RegExp(`const ${constName} = new Set\\(\\[([^\\]]*)\\]`));
  assert.ok(match, `${constName} is no longer a Set literal`);
  return new Set([...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));
}

function namedMapKeys(constName) {
  const start = SCRIPT.indexOf(`const ${constName} = new Map([`);
  assert.ok(start > -1, `${constName} is no longer a Map literal`);
  const slice = SCRIPT.slice(start, SCRIPT.indexOf("]);", start));
  return new Set([...slice.matchAll(/\["([^"]+)",/g)].map((m) => m[1]));
}

describe("a pinned action says which runtime it is", () => {
  it("reads a plausible number of workflows, so it cannot pass by reading nothing", () => {
    assert.ok(
      WORKFLOWS.length >= 10,
      `only ${WORKFLOWS.length} workflow files found; this test has gone blind and so has the gate it covers`
    );
  });

  it("records a SHA, a release and a runtime for every approved action", () => {
    const register = readRegister();
    assert.ok(register.size >= 5, `only ${register.size} actions registered; the register has emptied out`);

    for (const [action, record] of register) {
      assert.match(record.sha, /^[0-9a-f]{40}$/, `${action}: sha is not a full commit SHA`);
      assert.match(
        record.version,
        /^[0-9]+\.[0-9]+\.[0-9]+$/,
        `${action}: version must be the exact release read at that commit, not a major alias -- a SHA with a vague version is a SHA nobody can review`
      );
      assert.match(record.reviewed, /^\d{4}-\d{2}-\d{2}$/, `${action}: reviewed must be the date the manifest was actually read`);
      assert.ok(
        typeof record.runtime === "string" && record.runtime.length > 0,
        `${action}: no runtime recorded. That omission is the whole reason this file exists.`
      );
    }
  });

  it("registers no action on a runtime it also calls retired", () => {
    const register = readRegister();
    const retired = namedMapKeys("RETIRED_RUNTIMES");
    const live = namedSet("LIVE_RUNTIMES");

    assert.ok(retired.has("node20"), "node20 must be named as retired; it is the runtime this register was created to keep out");
    assert.ok(retired.size >= 3, `only ${retired.size} retired runtimes named`);

    for (const [action, record] of register) {
      assert.ok(!retired.has(record.runtime), `${action} is registered on the retired runtime ${record.runtime}`);
      assert.ok(live.has(record.runtime), `${action} is on runtime ${record.runtime}, which is in neither the live nor the retired set`);
    }
  });

  it("finds every workflow reference pinned to the reviewed commit with an honest comment", () => {
    const register = readRegister();
    let references = 0;

    for (const name of WORKFLOWS) {
      const lines = fs.readFileSync(path.join(WORKFLOW_DIR, name), "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        if (line.trimStart().startsWith("#")) return;
        const match = line.match(/\buses:\s*([^\s#]+)/);
        if (!match) return;
        const target = match[1].replace(/^["']|["']$/g, "");
        if (target.startsWith("./") || target.startsWith("docker://")) return;

        references += 1;
        const where = `${name}:${index + 1}`;
        const at = target.lastIndexOf("@");
        const action = target.slice(0, at).split("/").slice(0, 2).join("/");
        const ref = target.slice(at + 1);

        const record = register.get(action);
        assert.ok(record, `${where}: ${action} is used but not registered`);
        assert.equal(ref, record.sha, `${where}: ${action} is not on the reviewed commit`);

        // The comment is the only version a reader sees on this line.
        const commented = line.match(/#\s*v?([0-9]+(?:\.[0-9]+)*)/);
        assert.ok(commented, `${where}: ${action} is pinned with no version comment, so the line states nothing a human can check`);
        const stated = commented[1];
        assert.ok(
          stated === record.version || record.version.startsWith(`${stated}.`),
          `${where}: comment says v${stated} but the pin is the reviewed commit for v${record.version}`
        );
      });
    }

    assert.ok(references >= 40, `only ${references} action references found across ${WORKFLOWS.length} workflows; the matcher has stopped matching`);
  });

  it("passes on the repository as it stands", () => {
    const { status, out } = runPolicy();
    assert.equal(status, 0, `the policy failed on an unmodified tree:\n${out}`);
    assert.match(out, /no retired Node runtime is registered or referenced/);
  });

  // --- the behavioural half: break one thing, watch it refuse ------------------

  it("refuses an empty workflow directory instead of reporting nothing verified", () => {
    // This is not hypothetical. Before the floors existed the script printed
    // "verified: 0 external action reference(s) ... across 0 workflow file(s)"
    // and exited 0, with the zero right there in the success line.
    const { status, out } = runPolicy({ workflows: {} });
    assert.equal(status, 1, `an empty workflow directory passed:\n${out}`);
    assert.match(out, /gone blind/);
  });

  it("refuses a register entry moved onto Node 20, and names the runtime", () => {
    const register = readRegister();
    const [firstAction] = [...register].find(([, r]) => r.runtime === "node24");
    assert.ok(firstAction, "no node24 entry to downgrade; this case can no longer test what it claims");

    // Rewrite that one entry's runtime and nothing else.
    const broken = SCRIPT.replace(
      new RegExp(`(\\["${firstAction.replace("/", "\\/")}",[\\s\\S]*?runtime: ")node24(")`),
      "$1node20$2"
    );
    assert.notEqual(broken, SCRIPT, "the node20 substitution did not land, so this case measured nothing");

    const { status, out } = runPolicy({ script: broken });
    assert.equal(status, 1, `a node20 runtime passed the gate:\n${out}`);
    assert.match(out, /node20/, "it failed, but without naming the runtime that caused it");
    assert.ok(out.includes(firstAction), `it failed without naming ${firstAction}`);
  });

  it("refuses a version comment that names a different release from the pin", () => {
    const name = WORKFLOWS.find((file) =>
      /#\s*v[0-9]/.test(fs.readFileSync(path.join(WORKFLOW_DIR, file), "utf8"))
    );
    assert.ok(name, "no workflow carries a version comment; this case measured nothing");

    const original = fs.readFileSync(path.join(WORKFLOW_DIR, name), "utf8");
    const drifted = original.replace(/#\s*v[0-9]+(\.[0-9]+)*/, "# v4.1.7");
    assert.notEqual(drifted, original, "the comment rewrite did not land");

    const workflows = {};
    for (const file of WORKFLOWS) {
      workflows[file] = file === name ? drifted : fs.readFileSync(path.join(WORKFLOW_DIR, file), "utf8");
    }

    const { status, out } = runPolicy({ workflows });
    assert.equal(status, 1, `a comment naming the wrong release passed:\n${out}`);
    assert.match(out, /comment says v4\.1\.7/);
  });

  it("refuses a mutable ref even when the action is registered", () => {
    const register = readRegister();
    const [, record] = [...register][0];
    const workflows = {};
    for (const file of WORKFLOWS) {
      workflows[file] = fs
        .readFileSync(path.join(WORKFLOW_DIR, file), "utf8")
        .split(record.sha)
        .join("v7");
    }

    const { status, out } = runPolicy({ workflows });
    assert.equal(status, 1, `a floating tag passed:\n${out}`);
    assert.match(out, /mutable ref/);
  });

  it("refuses a reviewed entry no workflow references any more", () => {
    const broken = SCRIPT.replace(
      "const approved = new Map([\n",
      'const approved = new Map([\n  ["acme/retired-thing", { sha: "1111111111111111111111111111111111111111", version: "1.0.0", runtime: "node24", reviewed: "2026-09-18" }],\n'
    );
    assert.notEqual(broken, SCRIPT, "the orphan entry was not inserted");

    const { status, out } = runPolicy({ script: broken });
    assert.equal(status, 1, `an unreferenced register entry passed:\n${out}`);
    assert.match(out, /acme\/retired-thing/);
  });

  // --- the networked half, asserted for shape only ---------------------------

  it("keeps the upstream confirmation out of the offline chain and refuses to pass on a failed fetch", () => {
    assert.ok(SCRIPT.includes("--network"), "the networked half is gone");

    const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    assert.ok(packageJson.scripts["verify:action-pins:network"], "the networked half has no script entry, so nothing can run it");
    assert.ok(
      !packageJson.scripts["verify:gates"].includes("verify:action-pins:network"),
      "the networked check is in verify:gates; the release chain runs offline and a network check there either flakes or grows a catch that lets it pass"
    );
    assert.ok(
      packageJson.scripts["verify:gates"].includes("verify:action-pins"),
      "the offline check is no longer in verify:gates"
    );

    const health = fs.readFileSync(path.join(WORKFLOW_DIR, "external-repository-health.yml"), "utf8");
    assert.ok(
      health.includes("verify-github-action-pins.mjs --network"),
      "nothing runs the networked confirmation, so the register can be wrong indefinitely"
    );

    // The fetch failure path must refuse, not shrug. Asserted on the source
    // because provoking a real network failure here would be the flakiness this
    // separation exists to avoid.
    const networkHalf = SCRIPT.slice(SCRIPT.indexOf("if (!NETWORK) process.exit(0);"));
    assert.match(
      networkHalf,
      /could not confirm the runtime/,
      "a manifest that cannot be read must be a failure; treating it as fine is the defect this repository keeps finding"
    );
    assert.match(networkHalf, /confirmed === 0/, "the networked half can pass having read zero manifests");
  });
});
