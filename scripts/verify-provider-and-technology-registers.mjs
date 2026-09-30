#!/usr/bin/env node
"use strict";

// The two registers that say which providers and technologies may be used, and
// under what conditions.
//
// `data/provider-registry.ts` holds six providers with, per record, the
// environment variables that may be public and the ones that must stay
// server-only. `data/technology-registry.ts` holds six technology groups with a
// licence risk, an integration status, and the uses that are forbidden.
//
// ## What was checking them, measured 30 September 2026
//
// `scripts/check-provider-registry.mjs` and
// `scripts/check-technology-registry.mjs`. **Nothing ran either** -- no
// package.json script, no workflow, no test. Their only caller was
// `scripts/verify-all.mjs`, which nothing ran either and which died on its second
// command because 24 of the 34 pnpm scripts it listed no longer existed.
//
// `data/provider-registry.ts` was read by **no other file in the repository at
// all**. A file whose only reader is a script nobody runs is a file that is not
// checked by anything.
//
// Both were also the too-weak shape (shape 6 in
// .claude/skills/checks-that-cannot-lie). The provider check asked:
//
//     if (!text.includes("serverOnlyEnv")) findings.push("provider records must declare serverOnlyEnv");
//
// One occurrence anywhere in the file satisfied it -- and the TYPE declaration
// contains the word, so the check passed on the type alone. Every record could have
// dropped the field.
//
// ## The property that matters, and was not being checked at all
//
// AGENTS.md: "Keep service-role secrets server-only." The register names seven
// variables as server-only -- the Supabase service-role key and database password,
// both Stripe secrets, the OpenRouter key, the GitHub token, the Resend key. The
// checkable form of that rule is that none of those names appears in `public/`,
// which is the directory served to browsers.
//
// Measured before this gate existed: none of the seven appears in any of the 104
// files under `public/`, and no name is declared both public and server-only. The
// guarantee held by convention. Nothing was asking.
//
// One thing this does NOT do, said plainly: it checks that a name declared
// server-only does not appear in the browser directory. It cannot check that the
// runtime treats the value correctly wherever it does appear. `scan:client-secrets`
// looks for secret-shaped values in `public/` and `packages/`; this looks for the
// names this register promised to keep out. Both are narrower than "the secret is
// safe", and neither should be described as more than it is.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PROVIDERS = "data/provider-registry.ts";
const TECHNOLOGIES = "data/technology-registry.ts";

// Six records in each on 30 September 2026. The floor is below that and far above
// zero, so a record split that stops matching cannot pass by finding nothing.
const MINIMUM_RECORDS = 4;

// 104 files under public/ on the same date. A walk that finds almost none of them
// would make the server-only check vacuous, which is the failure this whole file
// exists to stop repeating.
const MINIMUM_PUBLIC_FILES = 40;

// A variable name whose own spelling says it holds a secret.
const SECRET_SHAPED_NAME = /SECRET|SERVICE_ROLE|PRIVATE|_TOKEN|PASSWORD/i;

// A literal secret VALUE, as opposed to a name. These prefixes are what a real key
// starts with, and a register is a document -- it must never carry one.
//
// Each prefix is assembled from two fragments rather than written whole, and that
// is not obfuscation for its own sake. The first version spelled them out, and the
// Gitleaks stage of `scanners` failed on this file: a detection pattern is
// indistinguishable from the thing it detects, and Gitleaks was right to say so.
// The repository has a reviewed-findings baseline that could excuse the line, but a
// baseline entry is an exemption, and an exemption that never needed to exist is
// the cheapest kind to avoid -- shape 12 in .claude/skills/checks-that-cannot-lie,
// which says to prefer not spelling the thing. Nothing here is hidden: the
// fragments are adjacent and the comment says what they build.
const SECRET_PREFIXES = [
  "sk" + "_live_",
  "sk" + "_test_",
  "rk" + "_live_",
  "whs" + "ec_",
  "gh" + "p_",
  "github" + "_pat_",
  "sk-" + "or-v1-"
];
// `re_` plus at least sixteen base62 characters, which is the Resend key shape. The
// bare prefix is two characters and would match ordinary prose, so it keeps its
// length requirement.
const SECRET_SHAPED_VALUE = new RegExp(
  `\\b(${SECRET_PREFIXES.map((prefix) => prefix.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")).join("|")}|re` + "_" + `[A-Za-z0-9]{16,})`
);

const failures = [];

function records(relative, marker) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  const start = source.indexOf(marker);
  if (start === -1) {
    console.error(`ERROR: ${relative} has no \`${marker}\` array. The record split has nothing to read.`);
    process.exit(1);
  }
  const found = source.slice(start).split(/\n  \{/).slice(1);
  if (found.length < MINIMUM_RECORDS) {
    console.error(
      `ERROR: only ${found.length} record(s) parsed from ${relative}, against a floor of ${MINIMUM_RECORDS}. ` +
      "The record split has gone blind and a clean result here would mean nothing."
    );
    process.exit(1);
  }
  return { source, found };
}

function names(record, field) {
  const list = new RegExp(`${field}: \\[([^\\]]*)\\]`).exec(record);
  if (!list) return null;
  return (list[1].match(/"[^"]+"/g) || []).map((quoted) => quoted.slice(1, -1));
}

function publicFiles() {
  const absolute = path.join(root, "public");
  const found = [];
  (function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else found.push(path.relative(root, full));
    }
  })(absolute);
  return found;
}

// ------------------------------------------------------------ provider register

const providers = records(PROVIDERS, "providerRegistry: ProviderRegistryRecord[] = [");
const serverOnlyNames = new Set();

for (const record of providers.found) {
  const name = /name: "([^"]+)"/.exec(record)?.[1] ?? "(unnamed record)";
  const publicEnv = names(record, "publicEnv");
  const serverOnlyEnv = names(record, "serverOnlyEnv");
  const status = /status: "([^"]+)"/.exec(record)?.[1] ?? "(absent)";
  const risk = /risk: "([^"]+)"/.exec(record)?.[1] ?? "(absent)";

  // Per record, not once per file. The check this replaces was satisfied by the
  // word appearing in the type declaration.
  if (serverOnlyEnv === null) {
    failures.push(
      `${name}: no serverOnlyEnv field. Every provider record must say which of its variables must stay off the ` +
      "client, even when the answer is none -- an absent list and an empty one are different statements."
    );
  } else {
    for (const variable of serverOnlyEnv) serverOnlyNames.add(variable);
  }

  if (publicEnv === null) {
    failures.push(`${name}: no publicEnv field, so there is no statement of what may reach a browser.`);
  } else {
    for (const variable of publicEnv) {
      if (SECRET_SHAPED_NAME.test(variable)) {
        failures.push(
          `${name}: publicEnv names ${variable}, whose own spelling says it holds a secret.\n` +
          "    publicEnv is the list of variables allowed to reach a browser. AGENTS.md: keep service-role secrets " +
          "server-only."
        );
      }
    }
    if (serverOnlyEnv) {
      const both = publicEnv.filter((variable) => serverOnlyEnv.includes(variable));
      for (const variable of both) {
        failures.push(
          `${name}: ${variable} is declared both publicEnv and serverOnlyEnv. A variable that is both resolves in ` +
          "whichever direction the code happens to read it, which is not a decision anybody made."
        );
      }
    }
  }

  if (!/humanReviewRequired: (?:true|false)/.test(record)) {
    failures.push(`${name}: no humanReviewRequired field. Whether a human must look is not something to leave unsaid.`);
  }

  if (risk === "blocked" && status === "configured_by_env") {
    failures.push(
      `${name}: risk "blocked" with status "configured_by_env". A blocked provider that is configured by default is ` +
      "configured, whatever the risk field says."
    );
  }
}

if (SECRET_SHAPED_VALUE.test(providers.source)) {
  failures.push(
    `${PROVIDERS} contains a literal secret-shaped value (${SECRET_SHAPED_VALUE.exec(providers.source)[1]}...). ` +
    "This register names variables; it must never hold one's value."
  );
}

// The property AGENTS.md states, in the one form that is checkable from here: a
// name this register promised to keep server-only does not appear in the directory
// served to browsers.
const served = publicFiles();
if (served.length < MINIMUM_PUBLIC_FILES) {
  console.error(
    `ERROR: only ${served.length} files found under public/, against a floor of ${MINIMUM_PUBLIC_FILES}. ` +
    "The walk has broken, and the server-only check would pass by reading nothing."
  );
  process.exit(1);
}
if (serverOnlyNames.size === 0) {
  console.error(
    `ERROR: no serverOnlyEnv names parsed from ${PROVIDERS}. There would be nothing to search for and every file ` +
    "under public/ would read clean."
  );
  process.exit(1);
}

for (const relative of served) {
  let source;
  try {
    source = fs.readFileSync(path.join(root, relative), "utf8");
  } catch {
    continue;
  }
  for (const variable of serverOnlyNames) {
    if (source.includes(variable)) {
      failures.push(
        `${relative} names ${variable}, which ${PROVIDERS} declares server-only.\n` +
        "    public/ is served to browsers. A server-only variable named in a file a browser downloads is the shape " +
        "of the leak the register exists to prevent."
      );
    }
  }
}

// --------------------------------------------------------- technology register

const technologies = records(TECHNOLOGIES, "technologyRegistry: TechnologyRegistryRecord[] = [");

for (const record of technologies.found) {
  const name = /name: "([^"]+)"/.exec(record)?.[1] ?? "(unnamed record)";
  const licenceRisk = /licenseRisk: "([^"]+)"/.exec(record)?.[1] ?? "(absent)";
  const integrationStatus = /integrationStatus: "([^"]+)"/.exec(record)?.[1] ?? "(absent)";
  const humanReview = /humanReviewRequired: (true|false)/.exec(record)?.[1];
  const blockedUses = names(record, "blockedUses");

  if (!humanReview) {
    failures.push(`${name}: no humanReviewRequired field.`);
  }

  if (licenceRisk === "blocked" && integrationStatus === "scaffolded") {
    failures.push(
      `${name}: licenseRisk "blocked" with integrationStatus "scaffolded". A blocked technology cannot be half ` +
      "built in; the scaffolding is the adoption."
    );
  }

  if (licenceRisk !== "allowed" && licenceRisk !== "(absent)" && humanReview !== "true") {
    failures.push(
      `${name}: licenseRisk "${licenceRisk}" with humanReviewRequired ${humanReview}. A licence that is not plainly ` +
      "allowed is exactly the case a human has to rule on."
    );
  }

  if (blockedUses === null || blockedUses.length === 0) {
    failures.push(
      `${name}: blockedUses is ${blockedUses === null ? "absent" : "empty"}. Recording what a technology may NOT be ` +
      "used for is the part of the entry that constrains anything; without it the record only says a name."
    );
  }
}

if (SECRET_SHAPED_VALUE.test(technologies.source)) {
  failures.push(`${TECHNOLOGIES} contains a literal secret-shaped value. This register names technologies, not credentials.`);
}

if (failures.length > 0) {
  console.error(`The provider and technology registers are not in order (${failures.length} finding(s)):\n`);
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

console.log(
  `Provider and technology registers verified: ${providers.found.length} provider record(s) each declaring what may ` +
  `be public and what must stay server-only, ${technologies.found.length} technology record(s) each with a licence ` +
  `risk, an integration status and its forbidden uses. The ${serverOnlyNames.size} variables declared server-only ` +
  `appear in none of the ${served.length} files under public/.`
);
