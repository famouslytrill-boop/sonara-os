"use strict";

// A migration that has run cannot be edited into production.
//
// `supabase db push` records a migration by filename. Once it has run the file
// is never read again, so editing it changes this repository and nothing else —
// and every check here reads the file, so they all keep passing while
// production sits without whatever was added.
//
// `scripts/generate-member-read-policies.cjs` says exactly this in a comment,
// and refuses to *write* an applied migration because the comment alone did not
// stop the mistake happening once. Nothing stopped a hand edit. Deleting all 33
// `create policy` statements from `20260728120000_member_read_policies.sql`
// left `pnpm run verify:launch` completely green.
//
// The content of each applied migration is pinned now. This asserts the pin is
// real, and — more importantly — that the checker fails when one changes,
// because a checksum file that is never compared looks identical to one that is.

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const script = path.join(root, "scripts", "verify-applied-migrations.mjs");
const manifestPath = path.join(root, "supabase", "applied-migration-checksums.json");
const { APPLIED_MIGRATIONS } = require("../scripts/generate-member-read-policies.cjs");

function run() {
  try {
    execFileSync("node", [script], { cwd: root, stdio: "pipe" });
    return { ok: true, output: "" };
  } catch (error) {
    return { ok: false, output: String(error.stdout || "") + String(error.stderr || "") };
  }
}

describe("an applied migration cannot be edited", () => {
  it("pins every migration the repository declares as applied", () => {
    assert.ok(APPLIED_MIGRATIONS.length >= 3, `only ${APPLIED_MIGRATIONS.length} applied migrations declared; this check would pin almost nothing`);
    const pinned = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    assert.deepEqual(Object.keys(pinned).sort(), [...APPLIED_MIGRATIONS].sort());
    for (const [name, hash] of Object.entries(pinned)) {
      const file = path.join(root, "supabase", "migrations", name);
      assert.ok(fs.existsSync(file), `${name} is pinned and missing`);
      assert.equal(createHash("sha256").update(fs.readFileSync(file)).digest("hex"), hash, `${name} does not match its pin`);
    }
  });

  it("passes on the tree as it stands", () => {
    assert.equal(run().ok, true, "the checker fails on an unmodified tree, so its failures mean nothing");
  });

  it("fails when an applied migration changes, which is the whole point", () => {
    const name = APPLIED_MIGRATIONS[0];
    const file = path.join(root, "supabase", "migrations", name);
    const original = fs.readFileSync(file);
    try {
      // The edit that was invisible: every policy statement removed.
      fs.writeFileSync(file, original.toString("utf8").replace(/create policy[\s\S]*?;/gi, ""));
      const result = run();
      assert.equal(result.ok, false, `${name} lost every policy and the checker passed`);
      assert.match(result.output, /has changed since it was applied/);
    } finally {
      fs.writeFileSync(file, original);
    }
    assert.equal(run().ok, true, "the tree was not restored");
  });

  it("fails when an applied migration is deleted", () => {
    const name = APPLIED_MIGRATIONS[0];
    const file = path.join(root, "supabase", "migrations", name);
    const original = fs.readFileSync(file);
    try {
      fs.unlinkSync(file);
      const result = run();
      assert.equal(result.ok, false, "an applied migration was deleted and the checker passed");
      assert.match(result.output, /cannot be deleted/);
    } finally {
      fs.writeFileSync(file, original);
    }
  });

  it("is in the release chain, not just runnable by hand", () => {
    const scripts = require("../package.json").scripts;
    assert.ok(scripts["verify:applied-migrations"], "no verify:applied-migrations script");
    assert.match(scripts["verify:launch"], /verify:applied-migrations/, "the check is not in verify:launch, so nothing runs it");
  });
});
