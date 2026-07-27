// Enforce the codegen freeze.
//
// `apply:runtime` used to run on every `pretest` and every `vercel-build`,
// which meant the committed tree was never the deployed artifact: reading the
// repository at any commit told you something different from what production
// ran. The generated output is now committed, and the generators are no longer
// part of the build.
//
// This check keeps that true. It re-runs the generators and fails if they would
// change any tracked file. A failure means one of two things:
//
//   1. Someone edited a generator without committing its regenerated output.
//      Fix: run `pnpm run apply:runtime` and commit the result.
//   2. Someone hand-edited a generated file. Fix: make the change in the
//      generator, then regenerate and commit.
//
// It also catches non-determinism. `scripts/apply-prompt-library-system.cjs`
// previously guarded on a string its own inserted block never contained, so it
// appended nine lines to docs/SONARA_EXTERNAL_REPOSITORY_REGISTRY.md on every
// single run. This check fails on that class of bug instead of shipping a
// different artifact every build.
//
// See CRIT-1 in docs/audits/2026-07-27-ENGINEERING_AUDIT.md.

import { execFileSync } from "node:child_process";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function fail(message, detail) {
  console.error(`[fail] ${message}`);
  if (detail) console.error(detail);
  process.exit(1);
}

const dirtyBefore = git(["status", "--porcelain"]);
if (dirtyBefore) {
  // Running the generators over a dirty tree cannot distinguish generator drift
  // from the caller's own edits, so refuse rather than report a false result.
  fail(
    "the working tree has uncommitted changes, so generator drift cannot be measured",
    dirtyBefore
  );
}

try {
  execFileSync("pnpm", ["run", "apply:runtime"], { stdio: "pipe" });
} catch (error) {
  fail("apply:runtime failed", error.stdout?.toString() || error.message);
}

const drift = git(["status", "--porcelain"]);

if (drift) {
  const changed = git(["diff", "--stat"]);
  fail(
    "running the generators changed the tree, so committed output is stale or the generators are not deterministic",
    `${drift}\n\n${changed}\n\nRun \`pnpm run apply:runtime\` and commit the result.`
  );
}

console.log("Generated output verified: the committed tree matches the generators exactly.");
