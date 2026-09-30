#!/usr/bin/env node
"use strict";

// Three rules AGENTS.md states, and nothing in the release chain checked.
//
// ## 1 and 2: pnpm only, and no npm lockfile
//
// AGENTS.md: "Use pnpm only. Do not use npm, npm audit fix, or
// package-lock.json." `scripts/check-security-basics.mjs` asserted the
// `packageManager` field and `scripts/check-repo-standards.mjs` asserted the
// absence of `package-lock.json` and the presence of `pnpm-lock.yaml` and
// `.env.example`. Measured 30 September 2026: **nothing ran either of them** --
// no package.json script, no workflow, no test -- and no other script in the
// repository read `package-lock.json` or `"packageManager"` at all. An npm
// lockfile could have been committed and the whole chain would have passed.
//
// ## 3: a public environment variable that carries a secret
//
// This is the one worth reading. `docs/owner/INSTALL-ALL-KEYS.md` says, in bold:
//
//     There is no `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` and there must never be
//
// That is the right rule -- this project inherits the Vercel and Supabase
// convention where a `NEXT_PUBLIC_` prefix means the value is meant to reach a
// browser, so a service-role key behind that prefix is the canonical way to hand
// out row-level-security bypass. AGENTS.md states it as a safety rule of its own:
// "Keep service-role secrets server-only."
//
// It was enforced by nothing. `scripts/check-env-safety.mjs` was written for it,
// and it is the clearest instance of shape 1 in
// .claude/skills/checks-that-cannot-lie that this repository has produced:
//
//   * its scan roots were `app`, `components`, `lib`, `src`; three of the four do
//     not exist here;
//   * its file filter was `/\.(ts|tsx|js|jsx)$/`, so of `lib/` -- which holds 256
//     `.cjs` modules -- it could see **one file**;
//   * its second rule only fired on `.tsx` files, and this repository has none,
//     so that half could never fire at all;
//   * and it printed "Environment safety check passed." and exited 0.
//
// One file read, and a pass reported. Nothing ran it either, which is the only
// reason that did not matter.
//
// ## Why the register has exactly one entry
//
// The forbidden name appears once in the repository: inside the sentence in
// `docs/owner/INSTALL-ALL-KEYS.md` forbidding it. A document that states a
// prohibition has to be able to name the thing prohibited. The register is
// two-sided, so if that sentence is ever removed or reworded the entry fails
// rather than silently covering something new.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// A `NEXT_PUBLIC_` name whose own spelling says it holds a secret. The prefix is
// the part that matters: it is a promise that the value may be shipped to a
// browser, and these four words are what must never be behind it.
const PUBLIC_SECRET_NAME = /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|SERVICE_ROLE|PRIVATE|TOKEN)[A-Z0-9_]*/g;

// Where a public environment name could be read, set or documented. Recursive,
// and deliberately wider than the runtime: a name in `.env.example` or in a
// deploy document is the one somebody copies.
const SCANNED = Object.freeze({
  runtime: { directories: ["lib", "routes", "api", "tools"], extensions: [".cjs", ".mjs", ".js", ".ts"] },
  browser: { directories: ["public"], extensions: [".js", ".html", ".json", ".webmanifest"] },
  config: { directories: ["config", "supabase", "ops", "infra", "android"], extensions: [".json", ".yml", ".yaml", ".toml", ".sql", ".ts"] },
  docs: { directories: ["docs"], extensions: [".md"] },
  tests: { directories: ["tests"], extensions: [".js", ".mjs", ".cjs"] }
});

const ROOT_FILES = Object.freeze(["server.js", ".env.example", "Dockerfile", "vercel.json"]);

// Measured 30 September 2026 by running this script: 1,420 files. The floor is
// far below that and far above zero, so a broken walk cannot pass by measuring
// nothing -- which is precisely how the check this replaces passed.
const MINIMUM_SCANNED = 800;

// The one place the forbidden name may appear, with what it is doing there.
// Two-sided: if the sentence goes, this entry fails rather than covering
// something else.
const FORBIDDING_DOCUMENTS = Object.freeze({
  "docs/owner/INSTALL-ALL-KEYS.md": {
    requires: /There is no `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` and there must never be/,
    note: "the sentence that forbids it; a prohibition has to be able to name the thing prohibited"
  }
});

const failures = [];

function filesUnder(directory, extensions) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) return [];
  const found = [];
  (function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        walk(full);
        continue;
      }
      if (extensions.some((extension) => entry.name.endsWith(extension))) found.push(path.relative(root, full));
    }
  })(absolute);
  return found;
}

// ---------------------------------------------------------------- 1. pnpm only

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (!/^pnpm@\d/.test(String(pkg.packageManager || ""))) {
  failures.push(
    `package.json declares packageManager "${pkg.packageManager ?? "(absent)"}", and AGENTS.md says pnpm only. ` +
    "The field is what makes corepack and CI agree on the package manager; without it a contributor's npm is as " +
    "authoritative as the lockfile."
  );
}

// ------------------------------------------------- 2. the lockfile and the tree

if (fs.existsSync(path.join(root, "package-lock.json"))) {
  failures.push(
    "package-lock.json exists. AGENTS.md forbids it outright: two lockfiles mean two dependency trees, and the one " +
    "that installs is whichever command somebody typed."
  );
}
for (const required of ["pnpm-lock.yaml", ".env.example", "pnpm-workspace.yaml"]) {
  if (!fs.existsSync(path.join(root, required))) {
    failures.push(`${required} is missing, and the install and environment contract depends on it being there.`);
  }
}

// ------------------------- 3. no public environment name that carries a secret

const groups = {};
let scanned = 0;
const hits = new Map();

for (const [group, spec] of Object.entries(SCANNED)) {
  const files = spec.directories.flatMap((directory) => filesUnder(directory, spec.extensions));
  groups[group] = files.length;
  scanned += files.length;
  for (const relative of files) {
    const names = [...new Set(fs.readFileSync(path.join(root, relative), "utf8").match(PUBLIC_SECRET_NAME) || [])];
    if (names.length > 0) hits.set(relative, names);
  }
}

const rootFiles = ROOT_FILES.filter((name) => fs.existsSync(path.join(root, name)));
groups.root = rootFiles.length;
scanned += rootFiles.length;
for (const name of rootFiles) {
  const names = [...new Set(fs.readFileSync(path.join(root, name), "utf8").match(PUBLIC_SECRET_NAME) || [])];
  if (names.length > 0) hits.set(name, names);
}

if (scanned < MINIMUM_SCANNED) {
  console.error(
    `ERROR: only ${scanned} files scanned, against a floor of ${MINIMUM_SCANNED}. The walk has broken, and a check ` +
    "that reads almost nothing and reports a pass is the exact failure this gate was written to replace."
  );
  process.exit(1);
}

for (const [relative, names] of [...hits].sort()) {
  if (FORBIDDING_DOCUMENTS[relative]) continue;
  failures.push(
    `${relative} names ${names.join(", ")}.\n` +
    "    A NEXT_PUBLIC_ prefix is a promise the value may be shipped to a browser, and these four words are what\n" +
    "    must never be behind it. AGENTS.md: keep service-role secrets server-only. If this is a document stating\n" +
    "    the prohibition, add it to FORBIDDING_DOCUMENTS in scripts/verify-repository-standards.mjs with the\n" +
    "    sentence it must contain."
  );
}

for (const [relative, entry] of Object.entries(FORBIDDING_DOCUMENTS)) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    failures.push(`FORBIDDING_DOCUMENTS names ${relative}, which no longer exists. Remove the entry.`);
    continue;
  }
  if (!entry.requires.test(fs.readFileSync(absolute, "utf8"))) {
    failures.push(
      `FORBIDDING_DOCUMENTS excuses ${relative} because it holds ${entry.note}, and that sentence is no longer ` +
      `there -- ${entry.requires} does not match.\n` +
      "    Either the prohibition moved or it is gone. A wrong reason inside an exemption is what the next person\n" +
      "    reads instead of checking, and this one would be covering a leaked service-role key."
    );
  }
  if (!hits.has(relative)) {
    failures.push(
      `FORBIDDING_DOCUMENTS names ${relative} and nothing in it matches the forbidden shape, so the entry excuses ` +
      "nothing. Remove it."
    );
  }
}

if (failures.length > 0) {
  console.error(`Repository standards are not all in order (${failures.length} finding(s)):\n`);
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

const groupSummary = Object.entries(groups)
  .map(([name, count]) => `${count} ${name}`)
  .join(", ");

console.log(
  `Repository standards verified: packageManager ${pkg.packageManager}, no npm lockfile, pnpm-lock.yaml and ` +
  `.env.example present. No NEXT_PUBLIC_ name carrying SECRET, SERVICE_ROLE, PRIVATE or TOKEN across ${scanned} ` +
  `files (${groupSummary}) -- ${hits.size} match, in the document that forbids it.`
);
