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
// **Which migrations are frozen is derived, not remembered.** The first version
// of the checker pinned only the three names in the member-policy generator's
// APPLIED_MIGRATIONS, which left the same hole one file over:
// 20260728130000_sync_published_catalog_names.sql is a generated migration its
// generator has moved past, so it can only change by hand, and it was not on
// the list. The rule is inverted now — a migration is writable only while a
// generator still owns it, and every generator names its current output.
//
// This asserts the pin is real and, more importantly, that the checker fails
// when a frozen migration changes: a checksum file nothing compares looks
// identical to one that is compared. It also asserts that re-pinning by habit
// is refused, because a checksum anybody can rewrite reports success for
// whatever it was last shown.

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const script = path.join(root, "scripts", "verify-applied-migrations.mjs");
const manifestPath = path.join(root, "supabase", "applied-migration-checksums.json");
const migrationsDirectory = path.join(root, "supabase", "migrations");

// The migrations a generator may still rewrite, read the way the checker reads
// them. Everything else in the directory is frozen.
const GENERATOR_OWNED = [
  require("../scripts/generate-member-read-policies.cjs").migrationName,
  require("../scripts/generate-catalog-sync-migration.cjs").migrationName
];

function run(args = []) {
  try {
    execFileSync("node", [script, ...args], { cwd: root, stdio: "pipe" });
    return { ok: true, output: "" };
  } catch (error) {
    return { ok: false, output: String(error.stdout || "") + String(error.stderr || "") };
  }
}

// A frozen migration to experiment on: the one whose policies were deleted with
// nothing noticing.
const FROZEN = "20260728120000_member_read_policies.sql";

describe("an applied migration cannot be edited", () => {
  it("pins every migration no generator still owns", () => {
    const migrations = fs.readdirSync(migrationsDirectory).filter((name) => name.endsWith(".sql"));
    assert.ok(migrations.length >= 50, `only ${migrations.length} migrations found; this check would be measuring almost nothing`);
    const pinned = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const expected = migrations.filter((name) => !GENERATOR_OWNED.includes(name)).sort();
    assert.deepEqual(Object.keys(pinned).sort(), expected, "the manifest and the migrations directory disagree about what is frozen");
    for (const [name, hash] of Object.entries(pinned)) {
      const file = path.join(migrationsDirectory, name);
      assert.ok(fs.existsSync(file), `${name} is pinned and missing`);
      assert.equal(createHash("sha256").update(fs.readFileSync(file)).digest("hex"), hash, `${name} does not match its pin`);
    }
  });

  it("leaves the migrations a generator still writes out of the pin", () => {
    // Pinning these would break the generators, which legitimately rewrite them
    // when the tables they cover change. Every generator names its own, so this
    // cannot fall behind.
    assert.ok(GENERATOR_OWNED.length >= 2 && GENERATOR_OWNED.every(Boolean), "a generator stopped naming its migration");
    const pinned = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    for (const name of GENERATOR_OWNED) assert.ok(!pinned[name], `${name} is generator-owned and pinned`);
  });

  it("passes on the tree as it stands", () => {
    assert.equal(run().ok, true, "the checker fails on an unmodified tree, so its failures mean nothing");
  });

  it("fails when a frozen migration changes, which is the whole point", () => {
    const name = FROZEN;
    const file = path.join(migrationsDirectory, name);
    const original = fs.readFileSync(file);
    try {
      // The edit that was invisible: every policy statement removed.
      fs.writeFileSync(file, original.toString("utf8").replace(/create policy[\s\S]*?;/gi, ""));
      const result = run();
      assert.equal(result.ok, false, `${name} lost every policy and the checker passed`);
      assert.match(result.output, /has changed since it shipped/);
    } finally {
      fs.writeFileSync(file, original);
    }
    assert.equal(run().ok, true, "the tree was not restored");
  });

  it("catches a generated migration its generator has moved past", () => {
    // The hole the first version left. This file is generated, its generator
    // now writes a later one, and nothing will ever rewrite it -- so a hand
    // edit is the only way it can change, and a hand edit cannot reach
    // production. It was not on the hand-kept applied list.
    const name = "20260728130000_sync_published_catalog_names.sql";
    const file = path.join(migrationsDirectory, name);
    assert.ok(fs.existsSync(file), `${name} is gone; this check is asserting about nothing`);
    assert.ok(!GENERATOR_OWNED.includes(name), `${name} is still generator-owned, so it is not the case this test is about`);
    const original = fs.readFileSync(file);
    try {
      fs.appendFileSync(file, "\n-- edited by hand\n");
      assert.equal(run().ok, false, "a superseded generated migration was edited and the checker passed");
      // And re-pinning it must not be the way out.
      const rewritten = run(["--write"]);
      assert.equal(rewritten.ok, false, "the edit could be recorded away by regenerating the manifest");
      assert.match(rewritten.output, /is frozen and has changed/);
    } finally {
      fs.writeFileSync(file, original);
    }
    assert.equal(run().ok, true, "the tree was not restored");
  });

  it("fails when a frozen migration is deleted", () => {
    const name = FROZEN;
    const file = path.join(migrationsDirectory, name);
    const original = fs.readFileSync(file);
    try {
      fs.unlinkSync(file);
      const result = run();
      assert.equal(result.ok, false, "a frozen migration was deleted and the checker passed");
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
