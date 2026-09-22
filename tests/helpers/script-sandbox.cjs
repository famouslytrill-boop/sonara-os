// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// A copy of the tree for tests that have to break something.
//
// Several checks here can only be proved by breaking what they check: a
// checksum gate is indistinguishable from a checksum file nobody compares
// until you edit a frozen file and watch it fail. Those tests mutated the
// **real tracked file** and restored it in a `finally`.
//
// A `finally` survives a thrown assertion. It does not survive a signal. That
// is not hypothetical: an interrupted run of this suite left
// `supabase/migrations/20260728120000_member_read_policies.sql` truncated to 33
// unterminated `execute '` statements, and
// `tests/an-applied-migration-cannot-be-edited.test.js` has a case that
// **deletes** that file outright. `git add -A` would have committed either.
//
// So the mutation happens in a copy. The scripts under `scripts/` resolve their
// own root from `import.meta.url`, so a copy carrying `scripts/`, `lib/`,
// `supabase/` and `package.json` is a working tree as far as they can tell --
// measured, not assumed: `verify-applied-migrations.mjs` reports the same 122
// frozen and 3 generator-owned migrations inside one as outside.
//
// The alternative was a signal handler, which would still lose to SIGKILL and
// would leave the window open while it installed.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.join(__dirname, "..", "..");

// Enough of the tree for a release script to resolve its own root and read what
// it audits. Kept narrow on purpose: copying node_modules would dominate the
// suite's runtime, and nothing under scripts/ reads it.
const DEFAULT_COPY = Object.freeze(["scripts", "lib", "supabase", "package.json"]);

// A sandbox that copied almost nothing would make every negative assertion in
// the calling test vacuous -- the checker would fail for the wrong reason and
// the test would still go green. Measured at 498 files on 21 September 2026;
// the floor is well below that and well above a broken copy.
const MINIMUM_FILES = 200;

function countFiles(directory) {
  let seen = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) seen += countFiles(path.join(directory, entry.name));
    else seen += 1;
  }
  return seen;
}

/**
 * Copy the parts of the tree a release script reads into a temp directory.
 *
 * The returned sandbox is disposable: nothing in it is tracked, so a run
 * interrupted mid-mutation leaves the repository clean and the leftovers in
 * the system temp directory.
 */
function createScriptSandbox({ prefix = "sonara-sandbox-", copy = DEFAULT_COPY, linkGit = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));

  // A gate that takes its root from `process.cwd()` and shells out to git needs
  // a repository to ask. The real `.git` is linked rather than copied: every
  // git call in scripts/verify-agent-development-sync.mjs is a read --
  // `rev-parse --verify --quiet`, `cat-file -e`, `rev-parse
  // --is-shallow-repository` -- checked rather than assumed, because linking a
  // writable `.git` into a directory tests mutate would be a worse version of
  // the problem this helper exists to fix.
  if (linkGit) fs.symlinkSync(path.join(root, ".git"), path.join(dir, ".git"));
  for (const entry of copy) {
    const from = path.join(root, entry);
    assert.ok(fs.existsSync(from), `${entry} is not in the repository, so this sandbox would be missing it silently`);
    fs.cpSync(from, path.join(dir, entry), { recursive: true });
  }

  const copied = countFiles(dir);
  assert.ok(
    copied >= MINIMUM_FILES,
    `the sandbox holds only ${copied} file(s); a copy this small would fail the checker for the wrong reason `
      + "and every negative assertion built on it would pass while measuring nothing"
  );

  const snapshots = new Map();

  return {
    dir,
    copied,

    /** Absolute path inside the sandbox. */
    file(relative) {
      return path.join(dir, relative);
    },

    /**
     * Run a script from inside the sandbox, so it resolves the sandbox as its
     * root rather than the repository.
     */
    run(scriptRelative, args = []) {
      try {
        const output = execFileSync("node", [path.join(dir, scriptRelative), ...args], { cwd: dir, stdio: "pipe" });
        return { ok: true, output: String(output || "") };
      } catch (error) {
        return {
          ok: false,
          output: `${String(error.stdout || "")}${String(error.stderr || "")}`
        };
      }
    },

    /** Remember a file's bytes so a case can put it back between assertions. */
    snapshot(relative) {
      snapshots.set(relative, fs.readFileSync(path.join(dir, relative)));
      return path.join(dir, relative);
    },

    /** Put a snapshotted file back, recreating it if the case deleted it. */
    restore(relative) {
      const bytes = snapshots.get(relative);
      assert.ok(bytes !== undefined, `${relative} was never snapshotted, so there is nothing to restore`);
      fs.writeFileSync(path.join(dir, relative), bytes);
    },

    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}

module.exports = { createScriptSandbox, DEFAULT_COPY, MINIMUM_FILES };
