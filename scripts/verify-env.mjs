import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const classificationRequire = createRequire(import.meta.url);

// Every environment variable this application reads must have a decision
// attached to it.
//
// This was a hand-typed list of "required" names checked for presence in
// .env.example. Seven of its twelve were read by nothing — STRIPE_PRICE_STARTER
// and friends, whose real names all end _MONTHLY. It failed on every run, it was
// not in the release chain, and anybody who did run it would have chased eight
// variables that do not exist. A check nobody runs is not a check, and a stale
// one is worse than none: it teaches people the output is noise.
//
// So the list is derived from the source instead, and each name has to be
// classified below. Adding an env var without classifying it fails, which is
// the point — the classification is where somebody decides whether a paying
// customer can be served without it.

const root = process.cwd();
const SOURCE_DIRS = ["lib", "routes", "api", "scripts"];
const SOURCE_FILES = ["server.js"];
// .ts as well as .js: lib/env.ts and lib/env/server.ts declare names as string
// literals rather than reading process.env, and several variables are named
// only there. A scan that missed them reported STRIPE_WEBHOOK_SECRET as unused.
const SOURCE_EXTENSIONS = /\.(c?js|mjs|ts)$/;

// The classification lives in lib/ so this gate and the owner's key guide read
// one list. See that file for why each variable sits where it does.
const {
  REQUIRED,
  PLATFORM_PROVIDED,
  OPTIONAL_CAPABILITY,
  RATCHET,
  DEVELOPMENT_ONLY
} = classificationRequire("../lib/sonara-environment-classification.cjs");






function walk(directory) {
  const found = [];
  if (!fs.existsSync(directory)) return found;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else if (SOURCE_EXTENSIONS.test(entry.name)) found.push(full);
  }
  return found;
}

// Only names this file already classifies are matched as string literals, so an
// unrelated constant cannot be mistaken for an environment variable.
const candidateNames = new Set([...REQUIRED, ...PLATFORM_PROVIDED, ...OPTIONAL_CAPABILITY, ...RATCHET, ...DEVELOPMENT_ONLY]);

// This file is excluded from its own scan.
//
// It lives under scripts/, and the string-literal pass matches any classified
// name it finds -- so every name in the lists above counted as "used" purely by
// being listed, and the stale-name check could never fire. That is the exact
// check that would have caught STRIPE_PRICE_STARTER, quietly answering its own
// question. Verified by renaming an entry and watching the stale error appear.
const SELF = path.join(root, "scripts", "verify-env.mjs");

const files = [...SOURCE_FILES.map((name) => path.join(root, name)), ...SOURCE_DIRS.flatMap((dir) => walk(path.join(root, dir)))]
  .filter((file) => path.resolve(file) !== SELF);
const used = new Set();
// Names only the constant-resolving pass below can see. Asserted non-empty:
// if it finds nothing, either the shape has left the codebase or the pass has
// stopped matching, and those two look identical from in here.
const resolvedThroughConstant = new Set();
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
    const constantNames = new Map();
for (const match of source.matchAll(/process\.env\.([A-Z][A-Z0-9_]{2,})/g)) used.add(match[1]);
  for (const match of source.matchAll(/process\.env\["([A-Z][A-Z0-9_]{2,})"\]/g)) used.add(match[1]);
  // Names that appear only as string literals -- readiness rows, the
  // infrastructure manifest, the env declarations in lib/env*.ts. A variable
  // this application knows about by name is one it uses, whether or not it
  // reaches it through process.env directly.
  for (const match of source.matchAll(/["'`]([A-Z][A-Z0-9_]{4,})["'`]/g)) {
    if (/^(GET|POST|PATCH|PUT|DELETE|HEAD|OPTIONS|TRUE|FALSE|NULL|HTML|JSON|UTF|SHA|HMAC|AES)/.test(match[1])) continue;
    if (candidateNames.has(match[1])) used.add(match[1]);
  }

  // The pass above cannot report anything.
  //
  // It only records a literal that is *already classified*, so a name this file
  // has never heard of is skipped rather than flagged -- which makes "every
  // variable the code reads is classified" true by construction. The filter is
  // there for a real reason (any shouty string literal would otherwise look
  // like a variable), but it turned the check into one that could only ever
  // confirm what it already believed.
  //
  // Thirteen names sat in that gap, and they were not incidental: the plan
  // table in server.js declares its price variables as `env:` and
  // `envAliases:` values, lib/sonara-readiness.cjs reads them at line 301, and
  // not one was classified. **The three that gate every paid plan were invisible
  // to the environment check while it reported success.**
  //
  // A key literally named `env` is not ambiguous, so this pass needs no
  // allow-list and is free to report a name nobody has classified yet.
  for (const match of source.matchAll(/\benv:\s*["'`]([A-Z][A-Z0-9_]{2,})["'`]/g)) used.add(match[1]);
  // `getEnv("NAME")` is the same hole one form later, and it was still open.
  //
  // lib/sonara-billing.cjs injects `getEnv` as a dependency, and modules taking
  // that injection read their variables through it rather than through
  // `process.env` directly. So a variable reached only that way was matched
  // only by the allow-listed literal pass above, which skips a name it has
  // never heard of. Adding lib/sonara-connected-payments.cjs with a brand new
  // STRIPE_CONNECT_ENABLED left this check reporting "all classified" while a
  // variable it had never seen gated whether a business could be paid.
  //
  // Worth stating plainly rather than implying a haul: when this pass was
  // added it surfaced exactly one unclassified name, the one just written. The
  // hole was real and nothing else had fallen into it.
  //
  // `getEnv` is as unambiguous as `env:`, so this pass needs no allow-list
  // either and is free to report a name nobody has classified.
  for (const match of source.matchAll(/\bgetEnv\(\s*["'`]([A-Z][A-Z0-9_]{2,})["'`]/g)) used.add(match[1]);

  // The same hole a third time, in the one shape the two passes above cannot
  // see: the name is bound to a constant and the read is by identifier.
  //
  //     const KEY_VARIABLE = "SONARA_TOTP_KEY";
  //     process.env[KEY_VARIABLE]
  //
  // `env:` and `getEnv("NAME")` both carry the name at the point of use. This
  // does not, so the only pass that could match it was the allow-listed literal
  // one -- which skips a name nobody has classified, making "all classified"
  // true by construction for exactly the names most likely to be missing.
  //
  // It surfaced two, and neither was incidental. **SONARA_TOTP_KEY is the key
  // every second factor on the system is sealed with**, and it was read by the
  // application and invisible to this check while the check reported success.
  // SONARA_UPLOAD_BUCKET names the bucket customer files are written to.
  //
  // Resolved per file rather than globally: two files may bind different names
  // to the same identifier, and a global map would attribute one to the other.
  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*["'`]([A-Z][A-Z0-9_]{2,})["'`]\s*;/g)) {
    constantNames.set(match[1], match[2]);
  }
  for (const match of source.matchAll(/process\.env\[\s*([A-Za-z_$][\w$]*)\s*\]/g)) {
    const resolved = constantNames.get(match[1]);
    if (resolved) { used.add(resolved); resolvedThroughConstant.add(resolved); }
  }
  for (const match of source.matchAll(/\bgetEnv\(\s*\[?\s*([A-Za-z_$][\w$]*)\s*\]?\s*\)/g)) {
    const resolved = constantNames.get(match[1]);
    if (resolved) { used.add(resolved); resolvedThroughConstant.add(resolved); }
  }
  for (const match of source.matchAll(/\benvAliases:\s*\[([^\]]*)\]/g)) {
    for (const alias of match[1].matchAll(/["'`]([A-Z][A-Z0-9_]{2,})["'`]/g)) used.add(alias[1]);
  }
}

const errors = [];

// What only the constant-resolving pass could see. Asserted non-empty below:
// if it ever finds nothing, either the shape has gone from the codebase or the
// pass has stopped matching, and those two look identical from here.


if (used.size < 30) errors.push(`only ${used.size} environment variables found in source; the scan is not working`);
// The constant-resolving pass, guarded the way every other population here is.
// It found exactly two when it was written, both previously unclassified. Zero
// means the shape has left the codebase or the pass has stopped matching, and
// from in here those are indistinguishable -- so it stops rather than reporting
// a clean scan over a form it can no longer see.
if (resolvedThroughConstant.size === 0) {
  errors.push(
    "no environment variable was reached through a constant-bound identifier; " +
      "two were when this pass was written (SONARA_TOTP_KEY, SONARA_UPLOAD_BUCKET), " +
      "so the pass has stopped matching rather than the shape having gone"
  );
}

const classified = new Set([...REQUIRED, ...PLATFORM_PROVIDED, ...OPTIONAL_CAPABILITY, ...RATCHET, ...DEVELOPMENT_ONLY]);
for (const name of [...used].sort()) {
  if (!classified.has(name)) {
    errors.push(`${name} is read by the code and classified nowhere in scripts/verify-env.mjs. Decide whether a paying customer can be served without it.`);
  }
}

// The other direction. A name classified here and read nowhere is the stale
// entry this rewrite exists to prevent.
for (const name of [...classified].sort()) {
  if (!used.has(name)) {
    errors.push(`${name} is classified in scripts/verify-env.mjs and read by no source file. Remove it, or it becomes the next STRIPE_PRICE_STARTER.`);
  }
}

// Everything a person has to set must appear in .env.example, so there is one
// place to read rather than a grep.
const examplePath = path.join(root, ".env.example");
const example = fs.existsSync(examplePath) ? fs.readFileSync(examplePath, "utf8") : "";
if (!example) errors.push(".env.example is missing, so there is nowhere to read what has to be set.");

// A ratchet is not always about paid usage -- SONARA_MIGRATION_REPLAY_REQUIRED
// is about CI and never reaches a customer -- so the two are reported in their
// own words. A message that tells the next reader a CI switch gates paid usage
// is a reason they would act on and it would be wrong.
for (const name of [...REQUIRED].sort()) {
  if (!example.includes(`${name}=`)) errors.push(`${name} must be set for paid usage and is not in .env.example.`);
}
for (const name of [...RATCHET].sort()) {
  if (!example.includes(`${name}=`)) errors.push(`${name} turns a warning into a gate and is not documented in .env.example.`);
}

for (const error of errors) console.error(`ERROR: ${error}`);
if (errors.length) {
  console.error(`\nEnvironment verification failed with ${errors.length} problem(s).`);
  process.exit(1);
}

console.log(
  `Environment verified: ${used.size} variables read by the code, all classified — ` +
  `${REQUIRED.size} required for paid usage, ${RATCHET.size} ratchet, ${DEVELOPMENT_ONLY.size} development-only, ` +
  `${OPTIONAL_CAPABILITY.size} optional, ${PLATFORM_PROVIDED.size} platform-provided.`
);
