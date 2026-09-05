// A migration that has shipped cannot be edited into production.
//
// `supabase db push` records a migration by filename. Once it has run, the file
// is never read again — so editing it changes this repository and nothing else.
// Every check here reads the file, so they all go on passing while production
// sits without whatever was added.
//
// scripts/generate-member-read-policies.cjs already says this in a comment and
// refuses to *write* an applied migration, because the comment alone did not
// stop the mistake happening once. Nothing stopped a hand edit. Deleting all 33
// `create policy` statements from 20260728120000_member_read_policies.sql left
// `pnpm run verify:launch` completely green, which is how this check came to be
// written.
//
// **Which migrations are frozen, and why it is not a hand-kept list.**
//
// The first version of this pinned only the three names in the member-policy
// generator's APPLIED_MIGRATIONS. That left the same hole one file over:
// 20260728130000_sync_published_catalog_names.sql is a generated migration its
// generator has moved past — it will never be rewritten, so it can only change
// by hand, and a hand edit cannot reach production. It was not on the list.
//
// So the rule is inverted. A migration is **writable** only while a generator
// still owns it, and every generator names its current output. Everything else
// is frozen the moment it is pinned. That is derived rather than remembered,
// and it covers every migration in the repository instead of three.
//
// `--write` will add a pin for a file that has none, and **refuses to change an
// existing pin** for a frozen migration. Without that this would be a checksum
// anybody could re-pin by habit, which is a check that reports success for
// whatever it was last shown.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = path.join(root, "supabase", "migrations");
const manifestPath = path.join(root, "supabase", "applied-migration-checksums.json");

// The migrations a generator may still rewrite. Read from the generators
// themselves, so adding one cannot be forgotten here.
const GENERATORS = ["generate-member-read-policies.cjs", "generate-catalog-sync-migration.cjs"];
const writable = new Set();
for (const generator of GENERATORS) {
  const module = require(path.join(root, "scripts", generator));
  // A generator may own more than one file. generate-catalog-sync-migration.cjs
  // owns two since the catalog assertions moved out of the retirement migration
  // into one dated after the products they assert about exist -- reading only
  // `migrationName` would have frozen the second, and the next regeneration
  // would have failed the pin on a file a generator is supposed to rewrite.
  const owned = [module.migrationName, module.assertionMigrationName, ...(module.migrationNames || [])].filter(Boolean);
  if (!owned.length) {
    console.error(`[fail] ${generator} does not export migrationName, so this check cannot tell which migration it still owns.`);
    process.exit(1);
  }
  for (const name of owned) {
    // A generator naming a file that is not there is a reason that has outlived
    // the thing it describes -- the shape that leaves a stale exemption sitting
    // over a real problem. Refused rather than skipped.
    if (!fs.existsSync(path.join(migrationsDirectory, name))) {
      console.error(`[fail] ${generator} says it owns ${name}, and there is no such migration. Regenerate, or correct the generator.`);
      process.exit(1);
    }
    writable.add(name);
  }
}

const write = process.argv.includes("--write");
const problems = [];
const digest = (file) => createHash("sha256")
  .update(fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n"))
  .digest("hex");

const migrations = fs.readdirSync(migrationsDirectory).filter((name) => name.endsWith(".sql")).sort();
if (migrations.length < 50) {
  // Vacuous success is the failure this repository keeps finding. A directory
  // that suddenly holds almost nothing is a broken checkout, not a clean tree.
  console.error(`[fail] only ${migrations.length} migrations found; this check would be pinning almost nothing.`);
  process.exit(1);
}

const frozen = migrations.filter((name) => !writable.has(name));
const current = Object.fromEntries(frozen.map((name) => [name, digest(path.join(migrationsDirectory, name))]));
const pinned = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};

if (write) {
  const next = { ...pinned };
  for (const [name, hash] of Object.entries(current)) {
    if (pinned[name] && pinned[name] !== hash) {
      problems.push(
        `${name} is frozen and has changed.\n` +
          "    Re-pinning it would record the edit rather than prevent it. supabase db push records a migration by filename,\n" +
          "    so the change reaches this repository and never reaches production. Put it in a new migration."
      );
      continue;
    }
    next[name] = hash;
  }
  for (const name of Object.keys(next)) {
    if (!current[name]) delete next[name];
  }
  if (problems.length) {
    console.error("Refusing to write:\n  " + problems.join("\n  "));
    process.exit(1);
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Wrote ${path.relative(root, manifestPath)}: ${Object.keys(next).length} frozen migrations pinned, ${writable.size} still generator-owned.`);
  process.exit(0);
}

if (!fs.existsSync(manifestPath)) {
  console.error(`[fail] ${path.relative(root, manifestPath)} is missing. Run: pnpm run gen:applied-migrations`);
  process.exit(1);
}

for (const name of Object.keys(pinned)) {
  if (writable.has(name)) continue;
  if (!current[name]) {
    problems.push(`${name} is pinned and is not in supabase/migrations/. A migration that has run cannot be deleted; production still has it.`);
  }
}

for (const [name, hash] of Object.entries(current)) {
  if (!pinned[name]) {
    problems.push(`${name} is not pinned. Run \`pnpm run gen:applied-migrations\` and commit the result.`);
    continue;
  }
  if (pinned[name] !== hash) {
    problems.push(
      `${name} has changed since it shipped.\n` +
        "    supabase db push records a migration by filename, so this edit reaches this repository and never reaches production.\n" +
        "    Put the change in a new migration instead."
    );
  }
}

if (problems.length) {
  console.error("Frozen migrations have changed:\n  " + problems.join("\n  "));
  process.exit(1);
}

console.log(`Applied migrations verified: ${Object.keys(pinned).length} frozen and unchanged, ${writable.size} still generator-owned.`);
