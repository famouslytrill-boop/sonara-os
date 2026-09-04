"use strict";

// A release-chain command printed "shared state are aligned" over a document
// whose two opening claims had been false for six weeks.
//
// `.ai/shared/CURRENT_STATE.md` is the baseline a Claude or Codex session reads
// before deciding what to do here. On 4 September 2026 it said `main` was
// `fa9402a8...` when it was `ccaea37...`, and that no live `claude/*` branch or
// open Claude pull request existed when origin carried eight. Both statements
// were written in the present tense in July and never revisited.
//
// The check over it asserted that five substrings -- "PR #100", "PR #101",
// "PR #103", "PR #104", "production lag" -- appeared somewhere in the file. All
// five were still there, because nothing had been deleted; only the truth had
// moved. So the chain went green across the drift, every run, for six weeks.
//
// That is the defect `CLAUDE.md` names: a signal that reports success without
// being true. The substring loop was not measuring staleness, it was measuring
// that somebody had not deleted the file, and the message it printed described
// the first thing while performing the second.
//
// ## What replaced it, and why it is shaped this way
//
// Nothing here can keep a hand-written file fresh, and pretending otherwise
// would produce a gate that fails on every commit until someone retypes a SHA
// into a markdown file -- which is a gate that gets deleted the first week.
//
// So the check does not ask "is this current". It asks **"does this still claim
// to be current once it is not"**, which is answerable and is the half that
// actually caused harm. The file names the commit it describes; while that
// commit is not the tip of `main`, it must also point at what is. Refreshing
// the document is what lets the pointer go away.
//
// The anti-deletion half is kept as it was, because it was protecting something
// real -- the July audit record holds findings somebody made, and deleting it
// loses them. It just was not the thing the message claimed.
//
// ## Broken, and confirmed red, before this was committed
//
//   removed `superseded-by`         -> named the stale baseline and the real tip
//   removed `baseline`              -> named the missing marker
//   pointed `superseded-by` at a
//     file that does not exist      -> "A pointer to nothing is worse than none"
//   baseline set to 0000...0000     -> "is not a commit in this repository"
//   deleted the `PR #104` line      -> the anti-deletion half still fires
//
// The first of those reproduces the original bug exactly: a baseline behind
// `main` with nothing saying so. It is red now and was green before.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const STATE = path.join(root, ".ai", "shared", "CURRENT_STATE.md");
const GATE = path.join(root, "scripts", "verify-agent-development-sync.mjs");

const source = fs.readFileSync(STATE, "utf8");
const gate = fs.readFileSync(GATE, "utf8");

describe("a shared baseline that is behind must say so", () => {
/** Run the gate against a temporary rewrite of the shared baseline. */
function gateWith(rewrite) {
  const original = fs.readFileSync(STATE, "utf8");
  try {
    fs.writeFileSync(STATE, rewrite(original));
    const run = spawnSync("node", [GATE], { cwd: root, encoding: "utf8" });
    return { status: run.status, output: `${run.stdout}${run.stderr}` };
  } finally {
    // Restored by writing the bytes back, never by `git checkout --`, which
    // would take unrelated working-tree changes with it.
    fs.writeFileSync(STATE, original);
  }
}

it("the shared baseline names the commit it describes", () => {
  const baseline = /<!--\s*baseline:\s*([0-9a-f]{40})\s*-->/.exec(source);
  assert.ok(baseline, "CURRENT_STATE.md must carry a `baseline:` comment naming a 40-character commit");
  assert.notEqual(baseline[1], "0".repeat(40), "the null OID is git's way of saying no object, not a baseline");

  // Only assertable where the history is present. `actions/checkout` clones at
  // depth 1 unless asked otherwise, and in that clone a July commit is absent
  // whether or not it is real -- `cat-file` returns 128 either way. The first
  // version of this asserted unconditionally and turned three CI jobs red on a
  // document that was correct.
  const known = spawnSync("git", ["cat-file", "-e", `${baseline[1]}^{commit}`], { cwd: root, encoding: "utf8" });
  if (known.status === 0) return;

  const shallow = spawnSync("git", ["rev-parse", "--is-shallow-repository"], { cwd: root, encoding: "utf8" });
  assert.equal(
    shallow.stdout.trim(),
    "true",
    `baseline ${baseline[1]} is not a commit in this repository, and this checkout has the history to know it`
  );
});

it("a baseline that is behind main points at what is current instead", () => {
  const baseline = /<!--\s*baseline:\s*([0-9a-f]{40})\s*-->/.exec(source)[1];
  const tip = spawnSync("git", ["rev-parse", "--verify", "--quiet", "refs/remotes/origin/main"], {
    cwd: root,
    encoding: "utf8"
  });
  const mainTip = tip.status === 0 ? tip.stdout.trim() : null;

  if (mainTip === baseline) return; // Refreshed to the tip; the pointer is not required.

  const superseded = /<!--\s*superseded-by:\s*(\S+)\s*-->/.exec(source);
  assert.ok(superseded, "a baseline behind main must carry `superseded-by:` naming where the current picture is");
  assert.ok(
    fs.existsSync(path.join(root, superseded[1])),
    `superseded-by points at ${superseded[1]}, which does not exist`
  );
});

it("the document does not assert in the present tense that it is current", () => {
  // The two sentences that were false. Both now carry their observation date,
  // and this is what stops them being quietly reverted to the present tense.
  assert.match(
    source,
    /audited `main` on 26 July 2026 was/,
    "the July baseline SHA must be stated as a dated past observation, not as what main is"
  );
  assert.match(
    source,
    /live `claude\/\*` branch was found \*\*on that date\*\*/,
    "the branch finding must be scoped to the date it was made"
  );
  assert.match(source, /dated audit record, not a live description/i);
});

it("the gate fails when a stale baseline stops saying it is stale", () => {
  const result = gateWith((text) => text.split("\n").filter((line) => !line.includes("superseded-by:")).join("\n"));
  assert.notEqual(result.status, 0, "removing the pointer from a behind-baseline document must fail the gate");
  assert.match(result.output, /superseded-by/, "the failure must name the marker to add");
});

it("the gate fails when the baseline itself is removed", () => {
  const result = gateWith((text) => text.split("\n").filter((line) => !line.includes("baseline:")).join("\n"));
  assert.notEqual(result.status, 0);
  assert.match(result.output, /must carry `<!-- baseline:/);
});

it("the gate fails when the pointer names a file that does not exist", () => {
  const result = gateWith((text) => text.replace("docs/HANDOFF_PROMPT.md -->", "docs/NOT_A_FILE.md -->"));
  assert.notEqual(result.status, 0);
  assert.match(result.output, /A pointer to nothing is worse than no pointer/);
});

it("the gate rejects the null OID as a baseline, at any clone depth", () => {
  // The one fabricated value rejectable everywhere: git's own sentinel for "no
  // object". A shallow clone cannot tell any *other* invented SHA from one it
  // simply never fetched, which is why the strict check below is conditional
  // and this one is not.
  const result = gateWith((text) => text.replace(/baseline: [0-9a-f]{40}/, `baseline: ${"0".repeat(40)}`));
  assert.notEqual(result.status, 0);
  assert.match(result.output, /null commit as its baseline/);
});

it("the gate rejects an invented baseline wherever it has the history to tell", () => {
  const shallow = spawnSync("git", ["rev-parse", "--is-shallow-repository"], { cwd: root, encoding: "utf8" });
  const result = gateWith((text) => text.replace(/baseline: [0-9a-f]{40}/, "baseline: dead0000beef0000dead0000beef0000dead0000"));

  if (shallow.stdout.trim() === "true") {
    // Not a pass by omission: the run must SAY it could not check, and the
    // pointer requirement must still have been enforced.
    assert.match(
      result.output,
      /whether it is a real commit was NOT verified/,
      "a truncated clone must announce that it skipped the check rather than passing silently"
    );
    return;
  }
  assert.notEqual(result.status, 0);
  assert.match(result.output, /is not a commit in this repository/);
});

it("the audit record is still protected from deletion", () => {
  const result = gateWith((text) => text.split("\n").filter((line) => !line.includes("PR #104")).join("\n"));
  assert.notEqual(result.status, 0, "the half that stops the July findings being deleted must still fire");
});

it("the gate requires the pointer when it cannot prove what the tip of main is", () => {
  // A shallow CI checkout carries neither `refs/remotes/origin/main` nor
  // `refs/heads/main`. An unresolvable tip must take the same branch as a stale
  // baseline rather than passing -- otherwise the check quietly stops checking
  // on exactly the machines it runs on most.
  assert.match(
    gate,
    /const mainTip = resolveRef\("refs\/remotes\/origin\/main"\) \|\| resolveRef\("refs\/heads\/main"\);/,
    "the tip must be resolved from a ref, so that failing to resolve it is observable"
  );
  assert.match(
    gate,
    /if \(mainTip !== baselineSha\) \{/,
    "an unresolvable tip (null) must enter the same branch as a stale baseline, not skip it"
  );
});
});
