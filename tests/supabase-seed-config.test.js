"use strict";

// The seed configuration has to describe files that exist.
//
// supabase/config.toml declared `[db.seed] enabled = false` and, two lines
// below it, `sql_paths = ["./seed.sql"]` -- naming a file this repository has
// never contained. This file keeps those two settings honest.
//
// What it is not: a fix for the Supabase branching integration. That was the
// reason the inconsistency got noticed -- the integration fails its Seeding
// task with "413 EntityTooLarge" on every pull request touching supabase/ --
// and the theory was that it was being asked to seed from a path with no file
// behind it. The theory was wrong. With sql_paths empty and seeding disabled it
// fails identically, so the cause lies somewhere this file cannot reach. The
// checks below are worth keeping on their own terms; they are not evidence
// about that failure.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const configPath = path.join(root, "supabase", "config.toml");

// Deliberately literal rather than a TOML parser: this file has no TOML
// dependency, and the two settings being read are simple scalars.
function seedSection() {
  const config = fs.readFileSync(configPath, "utf8");
  const section = config.split(/^\[db\.seed\]$/m)[1];
  assert.ok(section, "supabase/config.toml has no [db.seed] section; this check has gone blind");
  const body = section.split(/^\[/m)[0];
  const enabled = /^\s*enabled\s*=\s*true\s*$/m.test(body);
  const raw = body.match(/^\s*sql_paths\s*=\s*\[([^\]]*)\]/m);
  assert.ok(raw, "[db.seed] has no sql_paths setting; this check has gone blind");
  const paths = [...raw[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  return { enabled, paths };
}

describe("the Supabase seed configuration", () => {
  it("names only files that exist", () => {
    const { paths } = seedSection();
    // A glob is not resolved here -- it is checked as a directory that exists,
    // which is the part that can be wrong in the same way.
    const missing = paths.filter((entry) => {
      const target = path.join(root, "supabase", entry.replace(/^\.\//, ""));
      const base = entry.includes("*") ? path.dirname(target) : target;
      return !fs.existsSync(base);
    });
    assert.deepEqual(missing, [], `supabase/config.toml seeds from paths that do not exist:\n  ${missing.join("\n  ")}\n  The branching integration fails the Seeding task on every migration PR when this is wrong.`);
  });

  it("is not switched on with nothing to seed from", () => {
    const { enabled, paths } = seedSection();
    if (!enabled) return;
    assert.ok(paths.length, "seeding is enabled and sql_paths is empty, so a db reset would seed nothing while claiming to");
  });

  it("does not point at a seed file while seeding is disabled", () => {
    // The exact shape of the original defect. Harmless-looking -- the paths are
    // "not used" because the feature is off -- and it still broke the check on
    // every pull request that changed a migration.
    const { enabled, paths } = seedSection();
    if (enabled) return;
    assert.deepEqual(paths, [], `seeding is disabled but sql_paths still names ${paths.join(", ")}. Leave it empty so the branching integration has nothing to attempt.`);
  });
});
