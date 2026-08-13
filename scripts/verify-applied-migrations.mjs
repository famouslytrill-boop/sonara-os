// A migration that has been applied cannot be edited into production.
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
// So the content of every applied migration is pinned. Changing one fails here,
// with the only correct fix named: put the change in a new migration.
//
// **What this does not cover, stated rather than implied.** APPLIED_MIGRATIONS
// is a hand-kept list of the migrations known to have run in production, and it
// currently names the member-policy ones only. A migration that has run and is
// not on that list is not protected by this. Being on `main` is not the same as
// having been applied — the application deploys on merge and `supabase db push`
// is a separate step — so this check uses the repository's own declaration
// rather than inferring one from git history and being confidently wrong.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = path.join(root, "supabase", "migrations");
const manifestPath = path.join(root, "supabase", "applied-migration-checksums.json");

const { APPLIED_MIGRATIONS } = require(path.join(root, "scripts", "generate-member-read-policies.cjs"));

const write = process.argv.includes("--write");
const problems = [];

function digest(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

if (!Array.isArray(APPLIED_MIGRATIONS) || APPLIED_MIGRATIONS.length === 0) {
  // An empty list would make every assertion below vacuously true, and this
  // check would report success having pinned nothing.
  console.error("[fail] APPLIED_MIGRATIONS is empty, so this check is pinning nothing.");
  process.exit(1);
}

const current = {};
for (const name of APPLIED_MIGRATIONS) {
  const file = path.join(migrationsDirectory, name);
  if (!fs.existsSync(file)) {
    problems.push(`${name} is recorded as applied and is not in supabase/migrations/. A migration that has run cannot be deleted; production still has it.`);
    continue;
  }
  current[name] = digest(file);
}

if (write) {
  fs.writeFileSync(manifestPath, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`Wrote ${path.relative(root, manifestPath)}: ${Object.keys(current).length} applied migrations pinned.`);
  process.exit(problems.length ? 1 : 0);
}

if (!fs.existsSync(manifestPath)) {
  console.error(`[fail] ${path.relative(root, manifestPath)} is missing. Run: node scripts/verify-applied-migrations.mjs --write`);
  process.exit(1);
}

const pinned = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

for (const name of Object.keys(pinned)) {
  if (!APPLIED_MIGRATIONS.includes(name)) {
    problems.push(`${name} is pinned here and no longer listed as applied. Removing a migration from APPLIED_MIGRATIONS does not un-apply it.`);
  }
}

for (const [name, hash] of Object.entries(current)) {
  if (!pinned[name]) {
    problems.push(`${name} is applied and not pinned. Run \`node scripts/verify-applied-migrations.mjs --write\` when you add a migration to APPLIED_MIGRATIONS.`);
    continue;
  }
  if (pinned[name] !== hash) {
    problems.push(
      `${name} has changed since it was applied.\n` +
        "    supabase db push records a migration by filename, so this edit reaches this repository and never reaches production.\n" +
        "    Put the change in a new migration instead. If the edit is genuinely cosmetic, it is still not worth the risk of a\n" +
        "    checksum somebody re-pinned by habit."
    );
  }
}

if (problems.length) {
  console.error("Applied migrations have changed:\n  " + problems.join("\n  "));
  process.exit(1);
}

console.log(`Applied migrations verified: ${Object.keys(pinned).length} pinned and unchanged.`);
