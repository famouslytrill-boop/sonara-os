// The repository must not grant anyone a licence to redistribute it.
//
// On 26 August 2026 the root LICENSE was an MIT licence reading
// "Copyright (c) 2017-Present GitLab B.V.", and package.json declared
// "license": "MIT". CONTRIBUTING.md assigned contributions to GitLab B.V. and
// directed security reports to contact@gitlab.com. All three were inherited
// from a project scaffold and nobody had read them since.
//
// Two separate problems, and the second is the one that survives a casual look:
//
// 1. An MIT grant gives anyone who obtains a copy the right to copy, modify and
//    redistribute this source. The owner's standing instruction is that it stays
//    private. `"private": true` in package.json does not help -- that flag only
//    stops `pnpm publish`, it says nothing about the rights in the licence file.
//
// 2. The copyright line named a different company. A file that misattributes
//    ownership cannot be relied on to defend it.
//
// Nothing in scripts/ read either file, so both had sat green through every
// release. This check is the missing read. It is deliberately about the *grant*
// rather than about matching exact wording: rewording the notice is fine,
// reintroducing a permissive grant is not.
//
// It fails closed. A missing file is a finding, not a file to skip past.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// SPDX identifiers of licences that permit redistribution. `UNLICENSED` is the
// npm convention for "proprietary, no licence granted" and is the only value
// package.json may carry here. Note it is not `Unlicense`, which is the public
// domain dedication and the opposite of what is wanted -- so the comparison is
// case-sensitive on purpose.
const REDISTRIBUTABLE = /^(MIT|ISC|BSD-|Apache-|GPL-|LGPL-|AGPL-|MPL-|OSL-|Unlicense|CC0|0BSD|Zlib|Artistic|EPL-)/;

// Phrases that grant rights. Each is drawn from the operative sentence of a
// real permissive licence rather than invented, so a licence that reaches for
// any of them is caught whatever its heading says.
const GRANTING = [
  /permission is hereby granted, free of charge/i,
  /to deal in the software without restriction/i,
  /\bright to use, copy, modify, merge, publish, distribute, sublicense\b/i,
  /redistribution and use in source and binary forms/i,
  /licensed under the apache license/i,
  /you may obtain a copy of the license at/i,
  /this program is free software/i,
  /gnu general public license/i,
  /mozilla public license/i
];

// The proprietary notice has to actually say the two things that matter. A
// LICENSE file that merely omits a grant is not the same as one that refuses
// it, and the difference is what a reader relies on.
const MUST_REFUSE = /no licence is granted|no license is granted|all rights reserved/i;

// Companies whose scaffolds this repository has carried. A copyright line
// naming any of them is a misattribution, not a formatting preference.
const FOREIGN_HOLDER = /\b(GitLab B\.?V\.?|GitHub, Inc|Vercel, Inc|Meta Platforms|Google LLC|Automattic)\b/i;

const findings = [];
let bytesRead = 0;

function read(relative) {
  try {
    const text = readFileSync(path.join(root, relative), "utf8");
    bytesRead += text.length;
    return text;
  } catch {
    findings.push(`${relative}: named as a licence surface and not found`);
    return null;
  }
}

const licence = read("LICENSE");
if (licence) {
  for (const pattern of GRANTING) {
    if (pattern.test(licence)) {
      findings.push(`LICENSE: grants redistribution rights -- matched ${pattern}`);
    }
  }
  if (!MUST_REFUSE.test(licence)) {
    findings.push("LICENSE: does not state that no licence is granted or that rights are reserved");
  }
  const holder = licence.match(FOREIGN_HOLDER);
  if (holder) findings.push(`LICENSE: copyright is attributed to ${holder[0]}`);
  if (!/SONARA/i.test(licence)) findings.push("LICENSE: does not name SONARA Industries as the owner");
}

const contributing = read("CONTRIBUTING.md");
if (contributing) {
  const holder = contributing.match(FOREIGN_HOLDER);
  if (holder) findings.push(`CONTRIBUTING.md: assigns contributions or directs reports to ${holder[0]}`);
  // A contributor guide that sends security reports to somebody else's inbox is
  // the same class of defect as the licence: inherited text nobody read.
  // The trailing group repeats rather than allowing dots inside it, so a
  // sentence-ending period is not read as part of the domain. Probing this with
  // "contact@gitlab.com." reported the address with the period attached, which
  // is the kind of small wrongness that makes a reader distrust the finding.
  const foreignContact = contributing.match(/[\w.+-]+@(?!sonara)[\w-]+(?:\.[\w-]+)+/);
  if (foreignContact) {
    findings.push(`CONTRIBUTING.md: directs contact to ${foreignContact[0]}, which is not a SONARA address`);
  }
}

const manifest = read("package.json");
if (manifest) {
  let declared;
  try {
    declared = JSON.parse(manifest).license;
  } catch (error) {
    findings.push(`package.json: could not be parsed -- ${error.message}`);
  }
  if (declared === undefined) {
    findings.push('package.json: has no "license" field; declare "UNLICENSED" rather than leaving it absent');
  } else if (declared !== "UNLICENSED") {
    findings.push(`package.json: declares "license": ${JSON.stringify(declared)}; this repository is proprietary and must declare "UNLICENSED"`);
    if (typeof declared === "string" && REDISTRIBUTABLE.test(declared)) {
      findings.push(`package.json: ${declared} permits redistribution of this source`);
    }
  }
  const isPrivate = JSON.parse(manifest).private;
  if (isPrivate !== true) {
    findings.push('package.json: "private" is not true, so `pnpm publish` would push this source to the public registry');
  }
}

// Guards the check itself. Every branch above is skipped when a read returns
// null, and three silent misses would leave this printing "passed" having
// examined nothing.
if (bytesRead < 1000) {
  console.error(`Source licence check read only ${bytesRead} bytes across LICENSE, CONTRIBUTING.md and package.json; it has gone blind.`);
  process.exit(1);
}

if (findings.length) {
  console.error("Source licence check failed -- this repository would grant rights over its own source:");
  for (const finding of findings) console.error(`- ${finding}`);
  console.error("");
  console.error("Fix: LICENSE must reserve all rights to SONARA Industries and grant none,");
  console.error('CONTRIBUTING.md must not name another company, and package.json must declare');
  console.error('"license": "UNLICENSED" with "private": true.');
  process.exit(1);
}

console.log(`Source licence check passed: ${bytesRead} bytes across LICENSE, CONTRIBUTING.md and package.json, no redistribution grant, no foreign copyright holder.`);
