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
// release. This check is the missing read.
//
// The first version of this check read one named LICENSE and passed. Six more
// sat under tools/ -- songsmith, agentkit, aws-emulator, serverless-cli,
// voice-clone, disposable-domains -- each an MIT grant over code in a private
// repository, and each invisible to a check that reads a file by name. So this
// version *discovers* licence files rather than naming one, which is the
// difference between "the LICENSE is clean" and "no file in this repository
// grants rights over it".
//
// It is deliberately about the *grant* rather than about matching exact
// wording: rewording a notice is fine, reintroducing a permissive grant is not.
// It fails closed. A missing file is a finding, not a file to skip past.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// SPDX identifiers of licences that permit redistribution. `UNLICENSED` is the
// npm convention for "proprietary, no licence granted" and is the only value a
// package manifest here may carry. Note it is not `Unlicense`, which is the
// public domain dedication and the opposite of what is wanted -- so the
// comparison is case-sensitive on purpose.
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

// Directories that hold somebody else's code, where a permissive licence is
// theirs to grant and none of this applies.
const NOT_OURS = new Set(["node_modules", ".git", "archive", ".next", "dist", "build"]);

// Licence files that are permissive **by an owner's decision**, with the date
// and the reason. Empty today: nothing here has been deliberately released.
//
// Two-sided on purpose. An entry naming a file that no longer exists fails, so
// this cannot silently become a list of stale excuses -- which is the failure
// mode a one-sided exemption list always reaches. Adding an entry is a legal
// decision and belongs to the owner, not to whoever is editing this file.
const PERMISSIVE_BY_DECISION = new Map([
  // ["tools/example/LICENSE", "released publicly on YYYY-MM-DD, owner decision recorded in docs/SPRINT_LOG.md"]
]);

// Package manifests whose declared licence matters. Discovered the same way as
// the licence files, for the same reason.
const MANIFEST = "package.json";

const findings = [];
let bytesRead = 0;
const licenceFiles = [];
const manifests = [];
const readmes = [];

function walk(directory) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".github") continue;
    const full = path.join(directory, entry.name);
    const relative = path.relative(root, full);
    if (entry.isDirectory()) {
      if (NOT_OURS.has(entry.name)) continue;
      walk(full);
    } else if (/^LICEN[CS]E(\.(md|txt))?$/i.test(entry.name)) {
      licenceFiles.push(relative);
    } else if (entry.name === MANIFEST) {
      manifests.push(relative);
    } else if (/^README(\.md)?$/i.test(entry.name)) {
      readmes.push(relative);
    }
  }
}

walk(root);
licenceFiles.sort();
manifests.sort();

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

// The exemption list is checked against what is actually on disk before
// anything is excused by it.
for (const [relative, reason] of PERMISSIVE_BY_DECISION) {
  if (!licenceFiles.includes(relative)) {
    findings.push(`${relative}: listed as permissive by owner decision (${reason}) but no such file exists; remove the entry`);
  }
}

for (const relative of licenceFiles) {
  const text = read(relative);
  if (text === null) continue;
  if (PERMISSIVE_BY_DECISION.has(relative)) continue;
  for (const pattern of GRANTING) {
    if (pattern.test(text)) {
      findings.push(`${relative}: grants redistribution rights -- matched ${pattern}`);
    }
  }
  if (!MUST_REFUSE.test(text)) {
    findings.push(`${relative}: does not state that no licence is granted or that rights are reserved`);
  }
  const holder = text.match(FOREIGN_HOLDER);
  if (holder) findings.push(`${relative}: copyright is attributed to ${holder[0]}`);
  if (!/SONARA/i.test(text)) findings.push(`${relative}: does not name SONARA Industries as the owner`);
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

for (const relative of manifests) {
  const text = read(relative);
  if (text === null) continue;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    findings.push(`${relative}: could not be parsed -- ${error.message}`);
    continue;
  }
  const declared = parsed.license;
  if (declared === undefined) {
    findings.push(`${relative}: has no "license" field; declare "UNLICENSED" rather than leaving it absent`);
  } else if (declared !== "UNLICENSED") {
    findings.push(`${relative}: declares "license": ${JSON.stringify(declared)}; this repository is proprietary and must declare "UNLICENSED"`);
    if (typeof declared === "string" && REDISTRIBUTABLE.test(declared)) {
      findings.push(`${relative}: ${declared} permits redistribution of this source`);
    }
  }
  // Only the root manifest is publishable; the tools/ ones are never a package
  // this project would push, and requiring the flag on each would be a rule
  // whose reason had expired the moment somebody read it.
  if (relative === MANIFEST && parsed.private !== true) {
    findings.push(`${relative}: "private" is not true, so \`pnpm publish\` would push this source to the public registry`);
  }
}

// A README that says "MIT licensed" is the same misrepresentation as a LICENSE
// that grants it, and it is the copy a reader actually reads. Six of these said
// MIT while the file beside them said otherwise, found the first time the walk
// above was widened -- a prose claim and a legal file drifting apart is the
// stale-claim defect this repository already has a check for, wearing a
// licence's clothes.
const CLAIMS_PERMISSIVE = /\b(MIT|Apache|BSD|GPL|ISC|MPL)[- ](licen[cs]ed|Licen[cs]e)\b|\breleased under the\b|\bopen[- ]sourced?\b/i;
// The register describes *other people's* repositories, so a page discussing
// their licences is doing its job. Only a claim about this project is a finding.
const ABOUT_OTHERS = /register|reviewed|third[- ]party|dependenc|upstream|their own licen/i;

for (const relative of readmes) {
  const text = read(relative);
  if (text === null) continue;
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!CLAIMS_PERMISSIVE.test(line)) return;
    if (ABOUT_OTHERS.test(line)) return;
    findings.push(`${relative}:${index + 1}: claims this project is permissively licensed -- ${line.trim().slice(0, 120)}`);
  });
}

// Guards the check itself. Every loop above passes over an empty list, and a
// walk that found nothing would leave this printing "passed" having examined
// nothing at all. The floors are set below what the repository holds today
// rather than at it, so adding a subproject does not fail this line. Counted on
// 26 August 2026: 7 licence files, 4 manifests outside archive/ and
// node_modules/. Three of the six tools/ subprojects carry no package.json --
// agentkit is Python, voice-clone and disposable-domains ship none -- which is
// why the manifest floor sits lower than the licence floor.
if (licenceFiles.length < 5) {
  console.error(`Source licence check found only ${licenceFiles.length} licence file(s); the walk has gone blind.`);
  process.exit(1);
}
if (manifests.length < 3) {
  console.error(`Source licence check found only ${manifests.length} package manifest(s); the walk has gone blind.`);
  process.exit(1);
}
if (readmes.length < 5) {
  console.error(`Source licence check found only ${readmes.length} README(s); the walk has gone blind.`);
  process.exit(1);
}
if (bytesRead < 1000) {
  console.error(`Source licence check read only ${bytesRead} bytes; it has gone blind.`);
  process.exit(1);
}

if (findings.length) {
  console.error("Source licence check failed -- this repository would grant rights over its own source:");
  for (const finding of findings) console.error(`- ${finding}`);
  console.error("");
  console.error("Fix: every LICENSE must reserve all rights to SONARA Industries and grant none,");
  console.error("CONTRIBUTING.md must not name another company, and every package.json must");
  console.error('declare "license": "UNLICENSED" (the root one also "private": true).');
  console.error("");
  console.error("If a subproject is being released deliberately, that is an owner decision:");
  console.error("record it in PERMISSIVE_BY_DECISION in this file with the date and the reason.");
  process.exit(1);
}

console.log(`Source licence check passed: ${licenceFiles.length} licence files, ${manifests.length} manifests, ${readmes.length} READMEs, ${bytesRead} bytes read, no redistribution grant, no foreign copyright holder.`);
